import type { IPlugin, PluginContext, EditorEvents } from '@/core/types';
import type { EventBus } from '@/core/EventBus';
import type { EditorCore } from '@/core/EditorCore';
import type { BootConfig } from '@/boot/types';
import type * as fabric from 'fabric';

type EventHandler<T = any> = (data: T) => void;

/**
 * Base plugin class with automatic event cleanup on destroy.
 * Plugins should extend this to get safe canvas/bus binding.
 */
export abstract class BasePlugin implements IPlugin {
  abstract readonly name: string;
  readonly apis?: string[];
  readonly events?: string[];

  protected canvas: fabric.Canvas;
  protected editor: EditorCore;
  protected config: BootConfig;
  protected eventBus: EventBus<EditorEvents>;

  private fabricListeners: Array<{ event: string; handler: Function }> = [];
  private busListeners: Array<{ event: string; handler: Function }> = [];

  constructor(context: PluginContext) {
    this.canvas = context.canvas;
    this.editor = context.editor;
    this.config = context.config;
    this.eventBus = context.eventBus;
  }

  /** Bind a Fabric canvas event (auto-cleaned on destroy) */
  protected bindCanvas(event: string, handler: (...args: any[]) => void): void {
    this.canvas.on(event as any, handler as any);
    this.fabricListeners.push({ event, handler });
  }

  /** Bind an EventBus event (auto-cleaned on destroy) */
  protected bindBus<K extends keyof EditorEvents>(
    event: K,
    handler: EventHandler<EditorEvents[K]>
  ): void {
    this.eventBus.on(event, handler);
    this.busListeners.push({ event: event as string, handler });
  }

  destroy(): void {
    this.fabricListeners.forEach(({ event, handler }) => {
      this.canvas.off(event as any, handler as any);
    });
    this.busListeners.forEach(({ event, handler }) => {
      this.eventBus.off(event as any, handler as any);
    });
    this.fabricListeners = [];
    this.busListeners = [];
  }
}
