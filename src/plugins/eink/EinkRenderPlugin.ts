import { BasePlugin } from '../BasePlugin';
import type { PluginContext } from '@/core/types';
import { EinkRenderer } from '@/renderer/EinkRenderer';
import type { RenderResult } from '@/renderer/types';
import type { DitheringConfig } from '@/screen/types';

type BrowserScheduler = typeof globalThis & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number }
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
  requestAnimationFrame?: (callback: () => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
};

type RenderWaiter = {
  minVersion: number;
  resolve: (result: RenderResult) => void;
  reject: (error: unknown) => void;
};

/**
 * EinkRenderPlugin — bridges Fabric canvas to EinkRenderer
 *
 * - Auto-renders preview on canvas changes (debounced)
 * - Emits 'eink:preview-updated' for PreviewCanvas consumption
 */
export class EinkRenderPlugin extends BasePlugin {
  static pluginName = 'EinkRenderPlugin';
  readonly name = EinkRenderPlugin.pluginName;
  readonly apis = ['renderPreview', 'getLastPreview', 'setDitheringAlgorithm'];

  private renderer: EinkRenderer;
  private lastResult?: RenderResult;
  private renderTimer?: ReturnType<typeof setTimeout>;
  private taskTimer?: ReturnType<typeof setTimeout>;
  private idleCallbackId?: number;
  private frameCallbackId?: number;
  private isRendering = false;
  private isTaskScheduled = false;
  private isDestroyed = false;
  private requestedVersion = 0;
  private queuedVersion = 0;
  private appliedVersion = 0;
  private waiters: RenderWaiter[] = [];

  private readonly DEBOUNCE_MS = 300;
  private readonly IDLE_TIMEOUT_MS = 500;

  constructor(context: PluginContext) {
    super(context);
    this.renderer = new EinkRenderer(context.config.screen.profile);

    this.bindCanvas('after:render', () => this.scheduleRender());
  }

  async renderPreview(): Promise<RenderResult> {
    if (this.isDestroyed) {
      throw new Error('E-ink renderer destroyed');
    }

    const version = this.requestRenderVersion();
    this.clearDebounceTimer();
    this.scheduleRenderTask();
    return this.waitForRender(version);
  }

  private renderCurrentPreview(): RenderResult {
    const start = performance.now();
    const imageData = this.editor.getCanvasImageData();
    const preview = this.renderer.renderPreview(imageData);
    return {
      imageData: preview,
      deviceBuffer: new Uint8Array(0),
      duration: performance.now() - start,
      strategyName: this.renderer.strategyName,
    };
  }

  getLastPreview(): RenderResult | undefined {
    return this.lastResult;
  }

  setDitheringAlgorithm(algorithm: DitheringConfig['algorithm']): void {
    this.renderer.setStrategy(algorithm);
    void this.renderPreview().catch(() => {
      // renderPreview already logs failures; avoid an unhandled promise here.
    });
  }

  private scheduleRender(): void {
    this.requestRenderVersion();
    this.clearScheduledRenderTask();
    this.clearDebounceTimer();
    this.renderTimer = setTimeout(() => {
      this.renderTimer = undefined;
      this.scheduleRenderTask();
    }, this.DEBOUNCE_MS);
  }

  private requestRenderVersion(): number {
    const version = ++this.requestedVersion;
    this.queuedVersion = version;
    return version;
  }

  private waitForRender(minVersion: number): Promise<RenderResult> {
    if (this.lastResult && this.appliedVersion >= minVersion) {
      return Promise.resolve(this.lastResult);
    }

    return new Promise((resolve, reject) => {
      this.waiters.push({ minVersion, resolve, reject });
    });
  }

  private scheduleRenderTask(): void {
    if (
      this.isDestroyed ||
      this.isRendering ||
      this.isTaskScheduled ||
      this.queuedVersion <= this.appliedVersion
    ) {
      return;
    }

    const scheduler = globalThis as BrowserScheduler;
    const run = () => {
      this.isTaskScheduled = false;
      this.idleCallbackId = undefined;
      this.frameCallbackId = undefined;
      this.taskTimer = undefined;
      this.flushRenderQueue();
    };

    this.isTaskScheduled = true;
    if (typeof scheduler.requestIdleCallback === 'function') {
      this.idleCallbackId = scheduler.requestIdleCallback(run, {
        timeout: this.IDLE_TIMEOUT_MS,
      });
    } else if (typeof scheduler.requestAnimationFrame === 'function') {
      this.frameCallbackId = scheduler.requestAnimationFrame(run);
    } else {
      this.taskTimer = setTimeout(run, 0);
    }
  }

  private flushRenderQueue(): void {
    if (
      this.isDestroyed ||
      this.isRendering ||
      this.queuedVersion <= this.appliedVersion
    ) {
      return;
    }

    const version = this.queuedVersion;
    this.isRendering = true;

    try {
      const result = this.renderCurrentPreview();
      if (this.isDestroyed) return;

      if (version !== this.queuedVersion) {
        this.scheduleRenderTask();
        return;
      }

      this.lastResult = result;
      this.appliedVersion = version;
      this.eventBus.emit('eink:preview-updated', result.imageData);
      this.resolveWaiters(version, result);
    } catch (error) {
      if (version >= this.queuedVersion) {
        this.appliedVersion = version;
      }
      console.warn('[EinkRenderPlugin] Failed to render E-ink preview.', error);
      this.rejectWaiters(version, error);
    } finally {
      this.isRendering = false;
      if (!this.isDestroyed && this.queuedVersion > this.appliedVersion) {
        this.scheduleRenderTask();
      }
    }
  }

  private resolveWaiters(version: number, result: RenderResult): void {
    const pending: RenderWaiter[] = [];
    for (const waiter of this.waiters) {
      if (waiter.minVersion <= version) {
        waiter.resolve(result);
      } else {
        pending.push(waiter);
      }
    }
    this.waiters = pending;
  }

  private rejectWaiters(version: number, error: unknown): void {
    const pending: RenderWaiter[] = [];
    for (const waiter of this.waiters) {
      if (waiter.minVersion <= version) {
        waiter.reject(error);
      } else {
        pending.push(waiter);
      }
    }
    this.waiters = pending;
  }

  private clearDebounceTimer(): void {
    if (!this.renderTimer) return;
    clearTimeout(this.renderTimer);
    this.renderTimer = undefined;
  }

  private clearScheduledRenderTask(): void {
    if (!this.isTaskScheduled) return;

    const scheduler = globalThis as BrowserScheduler;
    if (
      this.idleCallbackId !== undefined &&
      typeof scheduler.cancelIdleCallback === 'function'
    ) {
      scheduler.cancelIdleCallback(this.idleCallbackId);
    }
    if (
      this.frameCallbackId !== undefined &&
      typeof scheduler.cancelAnimationFrame === 'function'
    ) {
      scheduler.cancelAnimationFrame(this.frameCallbackId);
    }
    if (this.taskTimer) {
      clearTimeout(this.taskTimer);
    }

    this.isTaskScheduled = false;
    this.idleCallbackId = undefined;
    this.frameCallbackId = undefined;
    this.taskTimer = undefined;
  }

  destroy(): void {
    this.isDestroyed = true;
    super.destroy();
    this.clearDebounceTimer();
    this.clearScheduledRenderTask();
    this.rejectWaiters(
      this.requestedVersion,
      new Error('E-ink renderer destroyed')
    );
  }
}
