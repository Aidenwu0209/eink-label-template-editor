import { BasePlugin } from '../BasePlugin';
import type { PluginContext } from '@/core/types';
import { EinkRenderer } from '@/renderer/EinkRenderer';
import type { RenderResult } from '@/renderer/types';
import type { DitheringConfig } from '@/screen/types';

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
  private readonly DEBOUNCE_MS = 300;

  constructor(context: PluginContext) {
    super(context);
    this.renderer = new EinkRenderer(context.config.screen.profile);

    this.bindCanvas('after:render', () => this.scheduleRender());
  }

  async renderPreview(): Promise<RenderResult> {
    const start = performance.now();
    const imageData = this.editor.getCanvasImageData();
    const preview = this.renderer.renderPreview(imageData);
    this.lastResult = {
      imageData: preview,
      deviceBuffer: new Uint8Array(0),
      duration: performance.now() - start,
      strategyName: this.renderer.strategyName,
    };
    this.eventBus.emit('eink:preview-updated', this.lastResult.imageData);
    return this.lastResult;
  }

  getLastPreview(): RenderResult | undefined {
    return this.lastResult;
  }

  setDitheringAlgorithm(algorithm: DitheringConfig['algorithm']): void {
    this.renderer.setStrategy(algorithm);
    this.renderPreview();
  }

  private scheduleRender(): void {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.renderPreview(), this.DEBOUNCE_MS);
  }

  destroy(): void {
    super.destroy();
    if (this.renderTimer) clearTimeout(this.renderTimer);
  }
}
