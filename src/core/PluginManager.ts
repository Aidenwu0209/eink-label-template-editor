import type { IPlugin, IPluginConstructor, PluginContext } from './types';
import type { EditorCore } from './EditorCore';

/**
 * Plugin lifecycle manager
 * - Registers plugins with dependency injection via PluginContext
 * - Supports Waterfall hooks (data flows through) and Sync hooks (notify only)
 * - Destroys plugins in reverse registration order
 */
export class PluginManager {
  private plugins = new Map<string, IPlugin>();
  private initOrder: string[] = [];
  private editor: EditorCore;

  constructor(editor: EditorCore) {
    this.editor = editor;
  }

  register(Ctor: IPluginConstructor, options?: Record<string, unknown>): void {
    const name = Ctor.pluginName;
    if (this.plugins.has(name)) {
      throw new Error(`Plugin "${name}" already registered`);
    }

    const context: PluginContext = {
      canvas: this.editor.fabricCanvas,
      editor: this.editor,
      config: this.editor.bootConfig,
      eventBus: this.editor.events,
    };

    const instance = new Ctor(context, options);
    this.plugins.set(name, instance);
    this.initOrder.push(name);

    // Proxy API methods onto EditorCore
    if (instance.apis) {
      for (const api of instance.apis) {
        if (api in this.editor) {
          console.warn(`[PluginManager] API "${api}" conflicts, skipping`);
          continue;
        }
        (this.editor as any)[api] = (...args: any[]) =>
          (instance as any)[api].apply(instance, args);
      }
    }

    // Call onInit lifecycle hook
    instance.onInit?.();
  }

  get(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Waterfall hook: data flows through each plugin sequentially.
   * Each plugin can transform the data.
   * Used for: hookImportBefore, hookSaveBefore
   */
  async runHookWaterfall<T>(hookName: string, data: T): Promise<T> {
    let result = data;
    for (const name of this.initOrder) {
      const plugin = this.plugins.get(name)!;
      const hook = (plugin as any)[hookName];
      if (typeof hook === 'function') {
        const returned = await hook.call(plugin, result);
        if (returned !== undefined) result = returned;
      }
    }
    return result;
  }

  /**
   * Sync hook: notify all plugins, no data transformation.
   * Used for: hookImportAfter, hookSaveAfter
   */
  async runHookSync(hookName: string, data?: any): Promise<void> {
    for (const name of this.initOrder) {
      const plugin = this.plugins.get(name)!;
      const hook = (plugin as any)[hookName];
      if (typeof hook === 'function') {
        await hook.call(plugin, data);
      }
    }
  }

  destroyAll(): void {
    for (let i = this.initOrder.length - 1; i >= 0; i--) {
      const name = this.initOrder[i];
      this.plugins.get(name)?.destroy?.();
    }
    this.plugins.clear();
    this.initOrder = [];
  }
}
