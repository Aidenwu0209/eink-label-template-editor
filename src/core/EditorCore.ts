import { fabric } from 'fabric';
import { EventBus } from './EventBus';
import { PluginManager } from './PluginManager';
import type { BootConfig, FabricJSON } from '@/boot/types';
import type { ScreenProfile } from '@/screen/types';
import type { IPluginConstructor, IPlugin, EditorEvents } from './types';

/** Extension keys to preserve in Fabric JSON export */
const EXTENSION_KEYS = [
  'id',
  'selectable',
  'hasControls',
  'editable',
  'extensionType',
  'extension',
  'verticalAlign',
];

/**
 * EditorCore — Fabric.js wrapper with plugin system
 *
 * Key constraints:
 * - Canvas dimensions are frozen at construction time
 * - All E-ink logic lives in plugins, not in this class
 * - Plugins communicate via EventBus, not direct coupling
 */
export class EditorCore {
  private _canvas: fabric.Canvas;
  private _pluginManager: PluginManager;
  private _eventBus: EventBus<EditorEvents>;
  private _config: BootConfig;
  private _disposed = false;

  readonly canvasWidth: number;
  readonly canvasHeight: number;

  constructor(canvasElement: HTMLCanvasElement, config: BootConfig) {
    this._config = config;
    this.canvasWidth = config.canvas.width;
    this.canvasHeight = config.canvas.height;

    // ★ Create Fabric Canvas with exact dimensions from BootConfig
    this._canvas = this.createFabricCanvas(canvasElement, config);

    // Initialize subsystems
    this._eventBus = new EventBus<EditorEvents>();
    this._pluginManager = new PluginManager(this);

    // Bind Fabric events to typed EventBus
    this.bindFabricEvents();

    // Freeze canvas dimensions
    this.freezeDimensions();
  }

  // ══════════ Canvas Creation (Private) ══════════

  private createFabricCanvas(
    el: HTMLCanvasElement,
    config: BootConfig
  ): fabric.Canvas {
    el.width = config.canvas.width;
    el.height = config.canvas.height;

    const canvas = new fabric.Canvas(el, {
      width: config.canvas.width,
      height: config.canvas.height,
      backgroundColor: config.screen.profile.defaultBackground,
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true,
      renderOnAddRemove: false,
      skipOffscreen: true,
    });

    // Create workspace rect (defines export area)
    const workspace = new fabric.Rect({
      width: config.canvas.width,
      height: config.canvas.height,
      fill: config.screen.profile.defaultBackground,
      selectable: false,
      hasControls: false,
      hoverCursor: 'default',
      strokeWidth: 0,
    });
    (workspace as any).id = 'workspace';
    canvas.add(workspace);
    canvas.renderAll();

    return canvas;
  }

  private freezeDimensions(): void {
    this._canvas.setDimensions = (() => {
      console.warn(
        '[EditorCore] Canvas dimensions are frozen. Ignoring setDimensions call.'
      );
      return this._canvas;
    }) as any;
  }

  private bindFabricEvents(): void {
    this._canvas.on('selection:created', () => {
      this._eventBus.emit(
        'object:selected',
        this._canvas.getActiveObjects()
      );
    });
    this._canvas.on('selection:updated', () => {
      this._eventBus.emit(
        'object:selected',
        this._canvas.getActiveObjects()
      );
    });
    this._canvas.on('selection:cleared', () => {
      this._eventBus.emit('object:deselected', undefined);
    });
    this._canvas.on('after:render', () => {
      this._eventBus.emit('canvas:rendered', undefined);
    });
  }

  // ══════════ Public API ══════════

  get fabricCanvas(): fabric.Canvas {
    return this._canvas;
  }
  get events(): EventBus<EditorEvents> {
    return this._eventBus;
  }
  get bootConfig(): BootConfig {
    return this._config;
  }
  get screenProfile(): ScreenProfile {
    return this._config.screen.profile;
  }

  /** Chain-register a plugin */
  use(Ctor: IPluginConstructor, options?: Record<string, unknown>): this {
    this._pluginManager.register(Ctor, options);
    return this;
  }

  /** Get plugin instance by name */
  getPlugin<T extends IPlugin>(name: string): T | undefined {
    return this._pluginManager.get(name) as T | undefined;
  }

  /** Load template JSON into canvas */
  async loadTemplate(json: FabricJSON): Promise<void> {
    const processed = await this._pluginManager.runHookWaterfall(
      'hookImportBefore',
      json
    );
    return new Promise<void>((resolve, reject) => {
      try {
        this._canvas.loadFromJSON(
          JSON.stringify(processed),
          () => {
            this._canvas.renderAll();
            this._pluginManager.runHookSync('hookImportAfter', processed);
            this._eventBus.emit('template:loaded', processed);
            resolve();
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Export current canvas state as Fabric JSON */
  async exportJSON(): Promise<FabricJSON> {
    let json = this._canvas.toJSON(EXTENSION_KEYS) as unknown as FabricJSON;
    json = await this._pluginManager.runHookWaterfall('hookSaveBefore', json);
    await this._pluginManager.runHookSync('hookSaveAfter', json);
    this._eventBus.emit('template:saved', json);
    return json;
  }

  /** Get raw ImageData from canvas (for renderer) */
  getCanvasImageData(): ImageData {
    const el = this._canvas.toCanvasElement();
    const ctx = el.getContext('2d')!;
    return ctx.getImageData(0, 0, this.canvasWidth, this.canvasHeight);
  }

  /** Trigger canvas re-render */
  requestRender(): void {
    this._canvas.requestRenderAll();
  }

  /** Dispose editor and all plugins */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._pluginManager.destroyAll();
    this._eventBus.removeAllListeners();
    this._canvas.dispose();
  }
}
