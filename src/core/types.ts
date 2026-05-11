/**
 * Editor Core type definitions
 */
import type { BootConfig, FabricJSON } from '@/boot/types';
import type { EventBus } from './EventBus';
import type { EditorCore } from './EditorCore';

/** Plugin lifecycle hooks */
export interface PluginHooks {
  onInit?(): void | Promise<void>;
  onDestroy?(): void;
  hookImportBefore?(json: any): Promise<any> | any;
  hookImportAfter?(json: any): Promise<void> | void;
  hookSaveBefore?(data: any): Promise<any> | any;
  hookSaveAfter?(data: any): Promise<void> | void;
}

/** Context injected into every plugin */
export interface PluginContext {
  canvas: fabric.Canvas;
  editor: EditorCore;
  config: BootConfig;
  eventBus: EventBus<EditorEvents>;
}

/** Plugin instance interface */
export interface IPlugin extends PluginHooks {
  readonly name: string;
  readonly apis?: string[];
  readonly events?: string[];
  hotkeys?: string[];
  hotkeyEvent?(name: string, e: KeyboardEvent): void;
  destroy?(): void;
}

/** Plugin constructor interface */
export interface IPluginConstructor {
  new (context: PluginContext, options?: Record<string, unknown>): IPlugin;
  pluginName: string;
}

/** Plugin menu item */
export interface PluginMenuItem {
  text: string;
  command?: () => void;
  children?: PluginMenuItem[];
}

/** Typed editor events */
export interface EditorEvents {
  'object:selected': fabric.Object[];
  'object:deselected': undefined;
  'canvas:rendered': undefined;
  'template:loaded': FabricJSON;
  'template:saved': FabricJSON;
  'eink:preview-updated': ImageData;
}
