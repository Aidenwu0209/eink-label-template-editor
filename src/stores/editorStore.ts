import { defineStore } from 'pinia';
import { computed, shallowRef, ref } from 'vue';
import * as fabric from 'fabric';
import { EditorCore } from '@/core/EditorCore';
import { EinkColorPlugin } from '@/plugins/eink/EinkColorPlugin';
import { EinkRenderPlugin } from '@/plugins/eink/EinkRenderPlugin';
import { EinkExportPlugin } from '@/plugins/eink/EinkExportPlugin';
import type { BootConfig, FabricJSON, FabricObjectJSON } from '@/boot/types';
import type { ColorEntry } from '@/screen/types';
import { buildSavePayload, type SavePayload } from '@/export/SavePayloadBuilder';
import {
  createBarcodeVisual,
  createDiscountVisual,
  createImageVisual,
  createPriceVisual,
  createQrcodeVisual,
  type VisualBounds,
} from '@/rendering/componentVisuals';

/** Error thrown when neither onSave nor saveApi is configured */
export class SaveConfigError extends Error {
  constructor() {
    super('保存配置错误：未提供 onSave 回调或 saveApi 地址');
    this.name = 'SaveConfigError';
  }
}

/** Error thrown when saveApi request fails */
export class SaveApiError extends Error {
  readonly status: number;
  constructor(status: number, statusText: string) {
    super(`保存请求失败：${status} ${statusText}`);
    this.name = 'SaveApiError';
    this.status = status;
  }
}

/** Error thrown when saveApi network request fails */
export class SaveNetworkError extends Error {
  constructor(cause: string) {
    super(`保存网络错误：${cause}`);
    this.name = 'SaveNetworkError';
  }
}

/** TEXT component overflow modes */
export const TEXT_OVERFLOW_MODES = ['clip', 'ellipsis', 'wrap'] as const;
export type TextOverflowMode = (typeof TEXT_OVERFLOW_MODES)[number];

/** TEXT component extension data stored on fabric object */
export interface TextExtension {
  fieldBinding: string | null;
  overflow: TextOverflowMode;
  lineClamp: number;
  verticalAlign: 'top' | 'middle' | 'bottom';
}

/** IMAGE fit mode */
export const IMAGE_FIT_MODES = ['contain', 'cover', 'fill'] as const;
export type ImageFitMode = (typeof IMAGE_FIT_MODES)[number];

export interface ComponentWarning {
  code: string;
  message: string;
  severity: 'warning';
}

/** IMAGE component extension data stored on fabric object */
export interface ImageExtension {
  /** static or dynamic image source */
  source: 'static' | 'dynamic';
  /** For static: base64 or URL; for dynamic: resolved from previewData.imageUrl */
  src: string;
  /** Field binding for dynamic images — always 'imageUrl' */
  fieldBinding: string | null;
  /** Object-fit behavior */
  fitMode: ImageFitMode;
  /** Background color (palette-constrained) */
  backgroundColor: string;
  /** Last render load status, used by the properties panel for explicit feedback */
  loadStatus?: 'empty' | 'loaded' | 'error';
  /** Last render load error, if any */
  loadError?: string | null;
}

/** PRICE style for a single segment (currency / integer / decimal) */
export interface PriceStyleSegment {
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
}

/** QRCODE error correction levels */
export const QRCODE_ERROR_CORRECTIONS = ['L', 'M', 'Q', 'H'] as const;
export type QrcodeErrorCorrection = (typeof QRCODE_ERROR_CORRECTIONS)[number];

/** QRCODE component extension data stored on fabric object */
export interface QrcodeExtension {
  /** Always 'qrContent' */
  fieldBinding: 'qrContent';
  /** Error correction level, default M */
  errorCorrection: QrcodeErrorCorrection;
  /** Margin in modules, default 1 */
  margin: number;
  /** Foreground color (palette-constrained) */
  foregroundColor: string;
  /** Background color (palette-constrained) */
  backgroundColor: string;
  /** Last render readability warnings */
  readabilityWarnings?: ComponentWarning[];
}

/** BARCODE component extension data stored on fabric object */
export interface BarcodeExtension {
  /** Always 'barcodeContent' */
  fieldBinding: 'barcodeContent';
  /** Only CODE128 is supported in v1 */
  format: 'CODE128';
  /** Whether to show text below barcode */
  showText: boolean;
  /** Foreground color (palette-constrained) */
  foregroundColor: string;
  /** Background color (palette-constrained) */
  backgroundColor: string;
  /** Last render readability warnings */
  readabilityWarnings?: ComponentWarning[];
}

/** DISCOUNT component extension data stored on fabric object */
export interface DiscountExtension {
  /** Always 'discount' */
  fieldBinding: 'discount';
  /** Format template, e.g. '{value}折' */
  formatTemplate: string;
  /** Background color (palette-constrained) */
  backgroundColor: string;
  /** Text color (palette-constrained) */
  textColor: string;
  /** Font size */
  fontSize: number;
  /** Font weight */
  fontWeight: 'normal' | 'bold';
  /** Horizontal alignment */
  textAlign: 'left' | 'center' | 'right';
  /** Vertical alignment */
  verticalAlign: 'top' | 'middle' | 'bottom';
}

/** PRICE component extension data stored on fabric object */
export interface PriceExtension {
  /** Always 'price' */
  fieldBinding: 'price';
  /** Currency symbol, default ¥ */
  currencySymbol: string;
  /** Whether to show currency symbol */
  showCurrency: boolean;
  /** Number of decimal places */
  decimalPlaces: number;
  /** Thousand separator, e.g. ',' */
  thousandSeparator: string;
  /** Decimal separator, e.g. '.' */
  decimalSeparator: string;
  /** Style for currency symbol segment */
  currencyStyle: PriceStyleSegment;
  /** Style for integer segment */
  integerStyle: PriceStyleSegment;
  /** Style for decimal segment (supports offsetY) */
  decimalStyle: PriceStyleSegment & { offsetY: number };
}

type HorizontalAlignment = 'left' | 'center' | 'right';
type VerticalAlignment = 'top' | 'middle' | 'bottom';
type LayerMove = 'forward' | 'backward' | 'front' | 'back';

interface HistoryState {
  version?: string;
  background?: unknown;
  objects: FabricObjectJSON[];
  selectedIds: string[];
}

const WORKSPACE_ID = 'workspace';
const HISTORY_LIMIT = 40;
const FABRIC_STATE_KEYS = [
  'id',
  'selectable',
  'hasControls',
  'editable',
  'evented',
  'hoverCursor',
  'lockMovementX',
  'lockMovementY',
  'lockScalingX',
  'lockScalingY',
  'lockRotation',
  'lockSkewingX',
  'lockSkewingY',
  'locked',
  'extensionType',
  'extension',
  'verticalAlign',
];
const RUNTIME_STATE_KEYS = [
  'selectable',
  'hasControls',
  'editable',
  'evented',
  'hoverCursor',
  'lockMovementX',
  'lockMovementY',
  'lockScalingX',
  'lockScalingY',
  'lockRotation',
  'lockSkewingX',
  'lockSkewingY',
  'locked',
];

export const useEditorStore = defineStore('editor', () => {
  const editor = shallowRef<EditorCore | null>(null);
  const isReady = ref(false);
  const selectedObject = shallowRef<fabric.Object | null>(null);
  const savePayload = ref<SavePayload | null>(null);
  const isSaving = ref(false);
  const historyStack = ref<HistoryState[]>([]);
  const historyIndex = ref(-1);
  const clipboardObjects = ref<FabricObjectJSON[] | null>(null);
  const selectionVersion = ref(0);

  let historySuppression = 0;
  let objectIdCounter = 0;
  let pasteOffset = 0;

  const canUndo = computed(() => historyIndex.value > 0);
  const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < historyStack.value.length - 1);
  const hasClipboard = computed(() => Boolean(clipboardObjects.value?.length));
  const hasActiveSelection = computed(() => {
    selectionVersion.value;
    return getActiveDrawableObjects().length > 0;
  });
  const isActiveSelectionLocked = computed(() => {
    selectionVersion.value;
    const objects = getActiveDrawableObjects();
    return objects.length > 0 && objects.every(isObjectLocked);
  });

  function initEditor(el: HTMLCanvasElement, config: BootConfig) {
    const core = new EditorCore(el, config);
    core
      .use(EinkColorPlugin)
      .use(EinkRenderPlugin)
      .use(EinkExportPlugin);

    // Bind selection events
    core.events.on('object:selected', (objects) => {
      const drawableObjects = objects.filter((obj) => !isWorkspaceObject(obj));
      selectedObject.value = drawableObjects.length === 1 ? drawableObjects[0] : null;
      selectionVersion.value++;
    });
    core.events.on('object:deselected', () => {
      selectedObject.value = null;
      selectionVersion.value++;
    });

    editor.value = core;
    isReady.value = true;
    bindHistoryEvents(core);
    ensureWorkspace(core);
    resetHistoryToCurrent();
  }

  function getPalette(): ColorEntry[] {
    return editor.value?.bootConfig.screen.profile.palette.slice() ?? [];
  }

  function isWorkspaceObject(obj: fabric.Object | null | undefined): boolean {
    return Boolean(obj && (obj as any).id === WORKSPACE_ID);
  }

  function getCanvasDrawableObjects(core: EditorCore): fabric.Object[] {
    return core.fabricCanvas.getObjects().filter((obj) => !isWorkspaceObject(obj));
  }

  function getActiveDrawableObjects(core = editor.value): fabric.Object[] {
    if (!core) return [];
    return core.fabricCanvas.getActiveObjects().filter((obj) => !isWorkspaceObject(obj));
  }

  function createObjectId(type = 'object'): string {
    const safeType = type.replace(/[^a-z0-9]+/gi, '_').toLowerCase() || 'object';
    objectIdCounter++;
    return `${safeType}_${Date.now().toString(36)}_${objectIdCounter.toString(36)}`;
  }

  function ensureObjectId(obj: fabric.Object): string | undefined {
    if (isWorkspaceObject(obj)) return undefined;
    if (!(obj as any).id) {
      (obj as any).id = createObjectId((obj as any).extensionType ?? obj.type ?? 'object');
    }
    return (obj as any).id;
  }

  function assignFreshObjectId(obj: fabric.Object): void {
    if (isWorkspaceObject(obj)) return;
    (obj as any).id = createObjectId((obj as any).extensionType ?? obj.type ?? 'object');
  }

  function ensureAllObjectIds(core: EditorCore): void {
    getCanvasDrawableObjects(core).forEach(ensureObjectId);
  }

  function findWorkspace(core: EditorCore): fabric.Object | undefined {
    return core.fabricCanvas.getObjects().find(isWorkspaceObject);
  }

  function createWorkspaceObject(core: EditorCore): fabric.Rect {
    const workspace = new fabric.Rect({
      left: 0,
      top: 0,
      width: core.bootConfig.canvas.width,
      height: core.bootConfig.canvas.height,
      fill: core.bootConfig.screen.profile.defaultBackground,
      selectable: false,
      hasControls: false,
      hoverCursor: 'default',
      strokeWidth: 0,
    });
    (workspace as any).id = WORKSPACE_ID;
    return workspace;
  }

  function ensureWorkspace(core: EditorCore): fabric.Object {
    const canvas = core.fabricCanvas;
    const workspaces = canvas.getObjects().filter(isWorkspaceObject);
    let workspace = workspaces[0];

    workspaces.slice(1).forEach((obj) => canvas.remove(obj));

    if (!workspace) {
      workspace = createWorkspaceObject(core);
      canvas.insertAt(0, workspace);
    } else {
      workspace.set({
        left: 0,
        top: 0,
        width: core.bootConfig.canvas.width,
        height: core.bootConfig.canvas.height,
        fill: core.bootConfig.screen.profile.defaultBackground,
        selectable: false,
        hasControls: false,
        hoverCursor: 'default',
        strokeWidth: 0,
      });
      canvas.moveObjectTo(workspace, 0);
    }

    return workspace;
  }

  function workspaceToJSON(core: EditorCore): FabricObjectJSON {
    const workspace = findWorkspace(core) ?? createWorkspaceObject(core);
    return cloneJson(workspace.toObject(FABRIC_STATE_KEYS) as FabricObjectJSON);
  }

  function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  function serializeObject(obj: fabric.Object): FabricObjectJSON {
    return cloneJson(obj.toObject(FABRIC_STATE_KEYS) as FabricObjectJSON);
  }

  function historySignature(state: HistoryState): string {
    return JSON.stringify({
      background: state.background ?? null,
      objects: state.objects,
    });
  }

  function captureHistoryState(core: EditorCore): HistoryState {
    ensureAllObjectIds(core);
    const json = core.fabricCanvas.toObject(FABRIC_STATE_KEYS) as unknown as FabricJSON;
    const objects = (json.objects ?? [])
      .filter((obj) => obj.id !== WORKSPACE_ID)
      .map((obj) => cloneJson(obj));
    const selectedIds = getActiveDrawableObjects(core)
      .map(ensureObjectId)
      .filter((id): id is string => Boolean(id));

    return {
      version: json.version,
      background: json.background,
      objects,
      selectedIds,
    };
  }

  function resetHistoryToCurrent(): void {
    const core = editor.value;
    if (!core) return;
    const state = captureHistoryState(core);
    historyStack.value = [state];
    historyIndex.value = 0;
  }

  function commitHistory(): void {
    const core = editor.value;
    if (!core || historySuppression > 0) return;

    const state = captureHistoryState(core);
    const current = historyStack.value[historyIndex.value];
    if (current && historySignature(current) === historySignature(state)) {
      current.selectedIds = state.selectedIds;
      return;
    }

    if (historyIndex.value < historyStack.value.length - 1) {
      historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
    }

    historyStack.value.push(state);
    if (historyStack.value.length > HISTORY_LIMIT) {
      historyStack.value.shift();
    } else {
      historyIndex.value++;
    }

    if (historyStack.value.length === HISTORY_LIMIT) {
      historyIndex.value = historyStack.value.length - 1;
    }
  }

  function bindHistoryEvents(core: EditorCore): void {
    const onCanvasChanged = (event: { target?: fabric.Object }) => {
      if (historySuppression > 0) return;
      if (event.target && isWorkspaceObject(event.target)) return;
      commitHistory();
    };

    core.fabricCanvas.on('object:added', onCanvasChanged);
    core.fabricCanvas.on('object:removed', onCanvasChanged);
    core.fabricCanvas.on('object:modified', onCanvasChanged);
  }

  async function loadCanvasJSON(core: EditorCore, json: FabricJSON): Promise<void> {
    await core.fabricCanvas.loadFromJSON(json);
    core.fabricCanvas.renderAll();
  }

  async function restoreHistoryState(state: HistoryState): Promise<void> {
    const core = editor.value;
    if (!core) return;

    historySuppression++;
    try {
      const json = {
        version: state.version,
        background: state.background,
        objects: [
          workspaceToJSON(core),
          ...cloneJson(state.objects),
        ],
      } as FabricJSON;

      await loadCanvasJSON(core, json);
      ensureWorkspace(core);
      ensureAllObjectIds(core);

      const objectsById = new Map(
        getCanvasDrawableObjects(core).map((obj) => [(obj as any).id, obj] as const)
      );
      const restoredSelection = state.selectedIds
        .map((id) => objectsById.get(id))
        .filter((obj): obj is fabric.Object => Boolean(obj));
      selectObjects(core, restoredSelection);
      core.fabricCanvas.renderAll();
    } finally {
      historySuppression--;
    }
  }

  function runHistoryMutation(mutator: () => void): void {
    historySuppression++;
    try {
      mutator();
    } finally {
      historySuppression--;
    }
    selectionVersion.value++;
    commitHistory();
  }

  function isObjectOnCanvas(core: EditorCore, obj: fabric.Object): boolean {
    return core.fabricCanvas.getObjects().includes(obj);
  }

  function selectObjects(core: EditorCore, objects: fabric.Object[]): void {
    const canvas = core.fabricCanvas;
    const selectableObjects = objects.filter((obj) => !isWorkspaceObject(obj) && isObjectOnCanvas(core, obj));

    canvas.discardActiveObject();
    if (selectableObjects.length === 1) {
      canvas.setActiveObject(selectableObjects[0]);
      selectedObject.value = selectableObjects[0];
    } else if (selectableObjects.length > 1) {
      const selection = new fabric.ActiveSelection(selectableObjects, { canvas } as any);
      canvas.setActiveObject(selection);
      selectedObject.value = null;
    } else {
      selectedObject.value = null;
    }

    selectionVersion.value++;
    canvas.requestRenderAll();
  }

  function discardActiveSelectionForMutation(core: EditorCore, objects: fabric.Object[]): void {
    if (objects.length > 1 && core.fabricCanvas.getActiveObject()?.type === 'activeSelection') {
      core.fabricCanvas.discardActiveObject();
      objects.forEach((obj) => obj.setCoords());
    }
  }

  function addVisualObject(obj: fabric.Object): void {
    const core = editor.value;
    if (!core) return;
    ensureObjectId(obj);
    runHistoryMutation(() => {
      core.fabricCanvas.add(obj);
      core.fabricCanvas.setActiveObject(obj);
      selectedObject.value = obj;
      core.fabricCanvas.renderAll();
    });
  }

  function getObjectBounds(obj: fabric.Object): VisualBounds {
    return {
      left: Math.round(obj.left ?? 0),
      top: Math.round(obj.top ?? 0),
      width: Math.max(1, Math.round(obj.width ?? obj.getScaledWidth() ?? 1)),
      height: Math.max(1, Math.round(obj.height ?? obj.getScaledHeight() ?? 1)),
    };
  }

  function updateDynamicText(obj: fabric.Object): void {
    const ext = (obj as any).extension as TextExtension | undefined;
    if ((obj as any).extensionType !== 'TEXT' || !ext?.fieldBinding) return;
    const value = editor.value?.bootConfig.previewData?.[ext.fieldBinding];
    (obj as fabric.Textbox).set('text', value == null ? '' : String(value));
  }

  function copyObjectRuntimeState(oldObj: fabric.Object, nextObj: fabric.Object): void {
    const id = ensureObjectId(oldObj);
    if (id) (nextObj as any).id = id;
    RUNTIME_STATE_KEYS.forEach((key) => {
      const value = (oldObj as any)[key];
      if (value !== undefined) {
        (nextObj as any)[key] = value;
      }
    });
    if (isObjectLocked(oldObj)) {
      setObjectLocked(nextObj, true);
    }
  }

  function replaceObject(oldObj: fabric.Object, nextObj: fabric.Object): void {
    const core = editor.value;
    if (!core) return;
    copyObjectRuntimeState(oldObj, nextObj);
    const index = core.fabricCanvas.getObjects().indexOf(oldObj);
    core.fabricCanvas.remove(oldObj);
    core.fabricCanvas.insertAt(Math.max(index, 0), nextObj);
    core.fabricCanvas.setActiveObject(nextObj);
    selectedObject.value = nextObj;
    core.fabricCanvas.renderAll();
  }

  async function refreshExtendedObject(obj: fabric.Object): Promise<void> {
    const core = editor.value;
    if (!core) return;
    const type = (obj as any).extensionType as string | undefined;
    const ext = (obj as any).extension;
    const bounds = getObjectBounds(obj);

    if (type === 'TEXT') {
      updateDynamicText(obj);
      obj.setCoords();
      core.fabricCanvas.renderAll();
      return;
    }

    if (type === 'PRICE') {
      replaceObject(obj, createPriceVisual(core.bootConfig, bounds, ext as PriceExtension));
    } else if (type === 'DISCOUNT') {
      replaceObject(
        obj,
        createDiscountVisual(bounds, core.bootConfig.previewData?.discount, ext as DiscountExtension)
      );
    } else if (type === 'IMAGE') {
      replaceObject(obj, await createImageVisual(bounds, ext as ImageExtension));
    } else if (type === 'QRCODE') {
      replaceObject(
        obj,
        createQrcodeVisual(bounds, core.bootConfig.previewData?.qrContent, ext as QrcodeExtension)
      );
    } else if (type === 'BARCODE') {
      replaceObject(
        obj,
        createBarcodeVisual(bounds, core.bootConfig.previewData?.barcodeContent, ext as BarcodeExtension)
      );
    }
  }

  function addRect(): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const w = Math.min(100, config.canvas.width * 0.3);
    const h = Math.min(60, config.canvas.height * 0.3);
    const left = Math.round((config.canvas.width - w) / 2);
    const top = Math.round((config.canvas.height - h) / 2);

    const rect = new fabric.Rect({
      left,
      top,
      width: w,
      height: h,
      fill: config.screen.profile.defaultBackground === '#FFFFFF' ? '#000000' : '#FFFFFF',
      stroke: '#000000',
      strokeWidth: 1,
    });
    (rect as any).extensionType = 'RECT';

    addVisualObject(rect);
  }

  function addLine(): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const x1 = Math.round(config.canvas.width * 0.2);
    const y1 = Math.round(config.canvas.height / 2);
    const x2 = Math.round(config.canvas.width * 0.8);
    const y2 = y1;

    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: '#000000',
      strokeWidth: 2,
    });
    (line as any).extensionType = 'LINE';

    addVisualObject(line);
  }

  function addText(): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const w = Math.min(200, config.canvas.width * 0.6);
    const h = 40;
    const left = Math.round((config.canvas.width - w) / 2);
    const top = Math.round((config.canvas.height - h) / 2);

    const text = new fabric.Textbox('文本', {
      left,
      top,
      width: w,
      fontFamily: 'AlibabaPuHuiTi',
      fontSize: 16,
      fontWeight: 'normal',
      fill: '#000000',
      textAlign: 'left',
      lineHeight: 1.2,
    });
    (text as any).extensionType = 'TEXT';
    (text as any).extension = {
      fieldBinding: null,
      overflow: 'ellipsis' as TextOverflowMode,
      lineClamp: 0,
      verticalAlign: 'top' as const,
    };

    addVisualObject(text);
  }

  function addDiscount(): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const w = Math.min(100, config.canvas.width * 0.3);
    const h = 40;
    const left = Math.round((config.canvas.width - w) / 2);
    const top = Math.round((config.canvas.height - h) / 2);

    const ext = {
      fieldBinding: 'discount',
      formatTemplate: '{value}折',
      backgroundColor: '#FFFFFF',
      textColor: '#000000',
      fontSize: 20,
      fontWeight: 'normal' as const,
      textAlign: 'center' as const,
      verticalAlign: 'middle' as const,
    } satisfies DiscountExtension;

    addVisualObject(createDiscountVisual({ left, top, width: w, height: h }, config.previewData?.discount, ext));
  }

  function addPrice(): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const w = Math.min(160, config.canvas.width * 0.5);
    const h = 50;
    const left = Math.round((config.canvas.width - w) / 2);
    const top = Math.round((config.canvas.height - h) / 2);

    const ext = {
      fieldBinding: 'price',
      currencySymbol: '¥',
      showCurrency: true,
      decimalPlaces: 2,
      thousandSeparator: ',',
      decimalSeparator: '.',
      currencyStyle: {
        fontSize: 14,
        fontWeight: 'normal' as const,
        color: '#000000',
      },
      integerStyle: {
        fontSize: 28,
        fontWeight: 'bold' as const,
        color: '#000000',
      },
      decimalStyle: {
        fontSize: 16,
        fontWeight: 'normal' as const,
        color: '#000000',
        offsetY: -12,
      },
    } satisfies PriceExtension;

    addVisualObject(createPriceVisual(config, { left, top, width: w, height: h }, ext));
  }

  async function addStaticImage(): Promise<void> {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const size = Math.min(80, config.canvas.width * 0.25, config.canvas.height * 0.65);
    const left = Math.round((config.canvas.width - size) / 2);
    const top = Math.round((config.canvas.height - size) / 2);

    const ext = {
      source: 'static',
      src: '',
      fieldBinding: null,
      fitMode: 'contain' as ImageFitMode,
      backgroundColor: '#FFFFFF',
    } satisfies ImageExtension;

    addVisualObject(await createImageVisual({ left, top, width: size, height: size }, ext));
  }

  async function addDynamicImage(): Promise<void> {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const size = Math.min(80, config.canvas.width * 0.25, config.canvas.height * 0.65);
    const left = Math.round((config.canvas.width - size) / 2);
    const top = Math.round((config.canvas.height - size) / 2);

    const previewUrl = config.previewData?.imageUrl ?? '';

    const ext = {
      source: 'dynamic',
      src: previewUrl,
      fieldBinding: 'imageUrl',
      fitMode: 'contain' as ImageFitMode,
      backgroundColor: '#FFFFFF',
    } satisfies ImageExtension;

    addVisualObject(await createImageVisual({ left, top, width: size, height: size }, ext));
  }

  function addQrcode(): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const size = Math.min(80, config.canvas.width * 0.25, config.canvas.height * 0.5);
    const left = Math.round((config.canvas.width - size) / 2);
    const top = Math.round((config.canvas.height - size) / 2);

    const ext = {
      fieldBinding: 'qrContent',
      errorCorrection: 'M' as QrcodeErrorCorrection,
      margin: 1,
      foregroundColor: '#000000',
      backgroundColor: '#FFFFFF',
    } satisfies QrcodeExtension;

    addVisualObject(createQrcodeVisual({ left, top, width: size, height: size }, config.previewData?.qrContent, ext));
  }

  function addBarcode(): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const w = Math.min(180, config.canvas.width * 0.7);
    const h = Math.min(42, config.canvas.height * 0.25);
    const left = Math.round((config.canvas.width - w) / 2);
    const top = Math.round((config.canvas.height - h) / 2);

    const ext = {
      fieldBinding: 'barcodeContent',
      format: 'CODE128',
      showText: true,
      foregroundColor: '#000000',
      backgroundColor: '#FFFFFF',
    } satisfies BarcodeExtension;

    addVisualObject(createBarcodeVisual({ left, top, width: w, height: h }, config.previewData?.barcodeContent, ext));
  }

  async function updateObjectProp(key: string, value: unknown): Promise<void> {
    const obj = selectedObject.value;
    const core = editor.value;
    if (!obj || !core) return;
    let shouldRefreshVisual = false;

    historySuppression++;
    try {
      if (obj.type === 'line' && ['x1', 'y1', 'x2', 'y2'].includes(key)) {
        const line = obj as fabric.Line;
        const coords = {
          x1: (line as any).x1,
          y1: (line as any).y1,
          x2: (line as any).x2,
          y2: (line as any).y2,
        };
        coords[key as 'x1' | 'y1' | 'x2' | 'y2'] = value as number;
        line.set({ x1: coords.x1, y1: coords.y1, x2: coords.x2, y2: coords.y2 });
      } else if ((obj as any).extensionType === 'TEXT' && key.startsWith('ext.')) {
        const extKey = key.slice(4);
        const ext = (obj as any).extension;
        if (ext) {
          ext[extKey] = value;
        }
        shouldRefreshVisual = true;
      } else if ((obj as any).extensionType === 'PRICE' && key.startsWith('ext.')) {
        const extKey = key.slice(4);
        const ext = (obj as any).extension;
        if (ext) {
          ext[extKey] = value;
        }
        shouldRefreshVisual = true;
      } else if ((obj as any).extensionType === 'DISCOUNT' && key.startsWith('ext.')) {
        const extKey = key.slice(4);
        const ext = (obj as any).extension;
        if (ext) {
          ext[extKey] = value;
        }
        shouldRefreshVisual = true;
      } else if ((obj as any).extensionType === 'IMAGE' && key.startsWith('ext.')) {
        const extKey = key.slice(4);
        const ext = (obj as any).extension;
        if (ext) {
          ext[extKey] = value;
        }
        shouldRefreshVisual = true;
      } else if ((obj as any).extensionType === 'QRCODE' && key.startsWith('ext.')) {
        const extKey = key.slice(4);
        const ext = (obj as any).extension;
        if (ext) {
          ext[extKey] = value;
        }
        shouldRefreshVisual = true;
      } else if ((obj as any).extensionType === 'BARCODE' && key.startsWith('ext.')) {
        const extKey = key.slice(4);
        const ext = (obj as any).extension;
        if (ext) {
          ext[extKey] = value;
        }
        shouldRefreshVisual = true;
      } else {
        obj.set(key as any, value);
        shouldRefreshVisual = Boolean((obj as any).extensionType)
          && ['width', 'height', 'left', 'top'].includes(key);
      }

      obj.setCoords();
      if (shouldRefreshVisual) {
        await refreshExtendedObject(obj);
      } else {
        core.fabricCanvas.renderAll();
      }
    } finally {
      historySuppression--;
    }

    selectionVersion.value++;
    commitHistory();
  }

  async function loadTemplate(json: FabricJSON): Promise<void> {
    const core = editor.value;
    if (!core) return;

    historySuppression++;
    try {
      await core.loadTemplate(json);
      ensureWorkspace(core);
      ensureAllObjectIds(core);
      const extendedObjects = getCanvasDrawableObjects(core)
        .filter((obj) => Boolean((obj as any).extensionType));
      for (const obj of extendedObjects) {
        await refreshExtendedObject(obj);
      }
      core.fabricCanvas.discardActiveObject();
      selectedObject.value = null;
      selectionVersion.value++;
      core.fabricCanvas.renderAll();
    } finally {
      historySuppression--;
    }

    resetHistoryToCurrent();
  }

  async function undo(): Promise<void> {
    if (!canUndo.value) return;
    const targetIndex = historyIndex.value - 1;
    await restoreHistoryState(historyStack.value[targetIndex]);
    historyIndex.value = targetIndex;
  }

  async function redo(): Promise<void> {
    if (!canRedo.value) return;
    const targetIndex = historyIndex.value + 1;
    await restoreHistoryState(historyStack.value[targetIndex]);
    historyIndex.value = targetIndex;
  }

  function deleteSelected(): void {
    const core = editor.value;
    if (!core) return;
    const objects = getActiveDrawableObjects(core);
    if (!objects.length) return;

    runHistoryMutation(() => {
      discardActiveSelectionForMutation(core, objects);
      core.fabricCanvas.discardActiveObject();
      objects.forEach((obj) => core.fabricCanvas.remove(obj));
      selectedObject.value = null;
      core.fabricCanvas.renderAll();
    });
  }

  function serializeActiveSelection(): FabricObjectJSON[] {
    const core = editor.value;
    if (!core) return [];
    const objects = getActiveDrawableObjects(core);
    if (!objects.length) return [];

    discardActiveSelectionForMutation(core, objects);
    const json = objects.map(serializeObject);
    selectObjects(core, objects);
    return json;
  }

  function copySelected(): void {
    const json = serializeActiveSelection();
    if (!json.length) return;
    clipboardObjects.value = json;
  }

  async function enlivenObjects(objects: FabricObjectJSON[]): Promise<fabric.Object[]> {
    return fabric.util.enlivenObjects<fabric.Object>(cloneJson(objects));
  }

  async function pasteObjects(objectsJson: FabricObjectJSON[], offset = 10): Promise<void> {
    const core = editor.value;
    if (!core || !objectsJson.length) return;
    const objects = await enlivenObjects(objectsJson);
    if (!objects.length) return;

    runHistoryMutation(() => {
      core.fabricCanvas.discardActiveObject();
      objects.forEach((obj) => {
        assignFreshObjectId(obj);
        obj.set({
          left: Math.round((obj.left ?? 0) + offset),
          top: Math.round((obj.top ?? 0) + offset),
        });
        obj.setCoords();
        core.fabricCanvas.add(obj);
      });
      selectObjects(core, objects);
      core.fabricCanvas.renderAll();
    });
  }

  async function pasteClipboard(): Promise<void> {
    if (!clipboardObjects.value?.length) return;
    pasteOffset = pasteOffset >= 80 ? 10 : pasteOffset + 10;
    await pasteObjects(clipboardObjects.value, pasteOffset);
  }

  async function duplicateSelected(): Promise<void> {
    const json = serializeActiveSelection();
    if (!json.length) return;
    await pasteObjects(json, 10);
  }

  function getObjectCanvasIndex(core: EditorCore, obj: fabric.Object): number {
    return core.fabricCanvas.getObjects().indexOf(obj);
  }

  function sortByCanvasIndex(core: EditorCore, objects: fabric.Object[], direction: 'asc' | 'desc'): fabric.Object[] {
    return objects
      .slice()
      .sort((a, b) => {
        const delta = getObjectCanvasIndex(core, a) - getObjectCanvasIndex(core, b);
        return direction === 'asc' ? delta : -delta;
      });
  }

  function moveSelectedLayer(move: LayerMove): void {
    const core = editor.value;
    if (!core) return;
    const objects = getActiveDrawableObjects(core);
    if (!objects.length) return;

    runHistoryMutation(() => {
      discardActiveSelectionForMutation(core, objects);
      const selectedSet = new Set(objects);
      const canvas = core.fabricCanvas;

      if (move === 'front') {
        sortByCanvasIndex(core, objects, 'asc').forEach((obj) => {
          canvas.moveObjectTo(obj, canvas.getObjects().length - 1);
        });
      } else if (move === 'back') {
        sortByCanvasIndex(core, objects, 'desc').forEach((obj) => {
          canvas.moveObjectTo(obj, 1);
        });
      } else if (move === 'forward') {
        sortByCanvasIndex(core, objects, 'desc').forEach((obj) => {
          const currentObjects = canvas.getObjects();
          const index = currentObjects.indexOf(obj);
          const next = currentObjects[index + 1];
          if (index >= 0 && index < currentObjects.length - 1 && !selectedSet.has(next)) {
            canvas.moveObjectTo(obj, index + 1);
          }
        });
      } else {
        sortByCanvasIndex(core, objects, 'asc').forEach((obj) => {
          const currentObjects = canvas.getObjects();
          const index = currentObjects.indexOf(obj);
          const previous = currentObjects[index - 1];
          if (index > 1 && !selectedSet.has(previous)) {
            canvas.moveObjectTo(obj, index - 1);
          }
        });
      }

      selectObjects(core, objects);
      canvas.renderAll();
    });
  }

  function bringSelectedForward(): void {
    moveSelectedLayer('forward');
  }

  function sendSelectedBackward(): void {
    moveSelectedLayer('backward');
  }

  function bringSelectedToFront(): void {
    moveSelectedLayer('front');
  }

  function sendSelectedToBack(): void {
    moveSelectedLayer('back');
  }

  function getObjectsBounds(objects: fabric.Object[]): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    centerX: number;
    centerY: number;
  } {
    const rects = objects.map((obj) => obj.getBoundingRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.left + rect.width));
    const bottom = Math.max(...rects.map((rect) => rect.top + rect.height));
    return {
      left,
      top,
      right,
      bottom,
      centerX: left + (right - left) / 2,
      centerY: top + (bottom - top) / 2,
    };
  }

  function alignSelectedHorizontal(alignment: HorizontalAlignment): void {
    const core = editor.value;
    if (!core) return;
    const objects = getActiveDrawableObjects(core);
    if (!objects.length) return;

    runHistoryMutation(() => {
      discardActiveSelectionForMutation(core, objects);
      const reference = objects.length > 1
        ? getObjectsBounds(objects)
        : {
            left: 0,
            top: 0,
            right: core.canvasWidth,
            bottom: core.canvasHeight,
            centerX: core.canvasWidth / 2,
            centerY: core.canvasHeight / 2,
          };

      objects.forEach((obj) => {
        const rect = obj.getBoundingRect();
        const targetDelta = alignment === 'left'
          ? reference.left - rect.left
          : alignment === 'center'
            ? reference.centerX - (rect.left + rect.width / 2)
            : reference.right - (rect.left + rect.width);
        obj.set('left', Math.round((obj.left ?? 0) + targetDelta));
        obj.setCoords();
      });

      selectObjects(core, objects);
      core.fabricCanvas.renderAll();
    });
  }

  function alignSelectedVertical(alignment: VerticalAlignment): void {
    const core = editor.value;
    if (!core) return;
    const objects = getActiveDrawableObjects(core);
    if (!objects.length) return;

    runHistoryMutation(() => {
      discardActiveSelectionForMutation(core, objects);
      const reference = objects.length > 1
        ? getObjectsBounds(objects)
        : {
            left: 0,
            top: 0,
            right: core.canvasWidth,
            bottom: core.canvasHeight,
            centerX: core.canvasWidth / 2,
            centerY: core.canvasHeight / 2,
          };

      objects.forEach((obj) => {
        const rect = obj.getBoundingRect();
        const targetDelta = alignment === 'top'
          ? reference.top - rect.top
          : alignment === 'middle'
            ? reference.centerY - (rect.top + rect.height / 2)
            : reference.bottom - (rect.top + rect.height);
        obj.set('top', Math.round((obj.top ?? 0) + targetDelta));
        obj.setCoords();
      });

      selectObjects(core, objects);
      core.fabricCanvas.renderAll();
    });
  }

  function isObjectLocked(obj: fabric.Object): boolean {
    return Boolean(
      (obj as any).locked
      ||
      (obj as any).lockMovementX
      || (obj as any).lockMovementY
      || (obj as any).lockScalingX
      || (obj as any).lockScalingY
      || (obj as any).lockRotation
    );
  }

  function setObjectLocked(obj: fabric.Object, locked: boolean): void {
    (obj as any).locked = locked;
    obj.set({
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
      lockSkewingX: locked,
      lockSkewingY: locked,
      hasControls: !locked,
      hoverCursor: locked ? 'not-allowed' : 'move',
    } as any);
    if ('editable' in obj) {
      obj.set('editable' as any, !locked);
    }
    obj.setCoords();
  }

  function toggleLockSelected(): void {
    const core = editor.value;
    if (!core) return;
    const objects = getActiveDrawableObjects(core);
    if (!objects.length) return;
    const shouldLock = !objects.every(isObjectLocked);

    runHistoryMutation(() => {
      discardActiveSelectionForMutation(core, objects);
      objects.forEach((obj) => setObjectLocked(obj, shouldLock));
      selectObjects(core, objects);
      core.fabricCanvas.renderAll();
    });
  }

  /** Get TEXT extension data from selected object */
  function getTextExtension(): TextExtension | null {
    const obj = selectedObject.value;
    if (!obj || (obj as any).extensionType !== 'TEXT') return null;
    return (obj as any).extension as TextExtension;
  }

  /** Get IMAGE extension data from selected object */
  function getImageExtension(): ImageExtension | null {
    const obj = selectedObject.value;
    if (!obj || (obj as any).extensionType !== 'IMAGE') return null;
    return (obj as any).extension as ImageExtension;
  }

  /** Get PRICE extension data from selected object */
  function getPriceExtension(): PriceExtension | null {
    const obj = selectedObject.value;
    if (!obj || (obj as any).extensionType !== 'PRICE') return null;
    return (obj as any).extension as PriceExtension;
  }

  /** Get DISCOUNT extension data from selected object */
  function getDiscountExtension(): DiscountExtension | null {
    const obj = selectedObject.value;
    if (!obj || (obj as any).extensionType !== 'DISCOUNT') return null;
    return (obj as any).extension as DiscountExtension;
  }

  /** Get QRCODE extension data from selected object */
  function getQrcodeExtension(): QrcodeExtension | null {
    const obj = selectedObject.value;
    if (!obj || (obj as any).extensionType !== 'QRCODE') return null;
    return (obj as any).extension as QrcodeExtension;
  }

  /** Get BARCODE extension data from selected object */
  function getBarcodeExtension(): BarcodeExtension | null {
    const obj = selectedObject.value;
    if (!obj || (obj as any).extensionType !== 'BARCODE') return null;
    return (obj as any).extension as BarcodeExtension;
  }

  /** Save error message for UI display */
  const saveError = ref<string | null>(null);

  /** POST the save payload to saveApi endpoint */
  async function postToSaveApi(saveApi: string, payload: SavePayload): Promise<void> {
    let response: Response;
    try {
      response = await fetch(saveApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      throw new SaveNetworkError(err?.message ?? '网络请求失败');
    }
    if (!response.ok) {
      throw new SaveApiError(response.status, response.statusText);
    }
  }

  function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function exportStaticImage(core: EditorCore): Promise<string> {
    const exportPlugin = core.getPlugin<EinkExportPlugin>('EinkExportPlugin');
    if (!exportPlugin) {
      return core.fabricCanvas.toDataURL({ format: 'png' as const, multiplier: 1 });
    }
    const blob = await exportPlugin.exportDitheredImage('png');
    return blobToDataURL(blob);
  }

  /** Generate save payload from current editor state */
  async function save(): Promise<SavePayload> {
    const core = editor.value;
    if (!core) throw new Error('Editor not initialized');

    isSaving.value = true;
    saveError.value = null;
    try {
      const fabricJson = await core.exportJSON();

      const canvasDataURL = await exportStaticImage(core);

      const payload = buildSavePayload(core.bootConfig, fabricJson, canvasDataURL);
      savePayload.value = payload;

      const onSave = core.bootConfig.onSave;
      const saveApi = core.bootConfig.saveApi;
      if (onSave) {
        await onSave(payload);
      } else if (saveApi) {
        await postToSaveApi(saveApi, payload);
      } else {
        throw new SaveConfigError();
      }

      return payload;
    } catch (err: any) {
      saveError.value = err?.message ?? '未知保存错误';
      throw err;
    } finally {
      isSaving.value = false;
    }
  }

  function dispose() {
    editor.value?.dispose();
    editor.value = null;
    isReady.value = false;
    selectedObject.value = null;
    historyStack.value = [];
    historyIndex.value = -1;
    clipboardObjects.value = null;
    selectionVersion.value++;
  }

  return {
    editor,
    isReady,
    selectedObject,
    savePayload,
    isSaving,
    saveError,
    canUndo,
    canRedo,
    hasClipboard,
    hasActiveSelection,
    isActiveSelectionLocked,
    initEditor,
    loadTemplate,
    getPalette,
    addRect,
    addLine,
    addText,
    addPrice,
    addStaticImage,
    addDynamicImage,
    addDiscount,
    addQrcode,
    addBarcode,
    updateObjectProp,
    undo,
    redo,
    deleteSelected,
    copySelected,
    pasteClipboard,
    duplicateSelected,
    bringSelectedForward,
    sendSelectedBackward,
    bringSelectedToFront,
    sendSelectedToBack,
    alignSelectedHorizontal,
    alignSelectedVertical,
    toggleLockSelected,
    getTextExtension,
    getImageExtension,
    getPriceExtension,
    getDiscountExtension,
    getQrcodeExtension,
    getBarcodeExtension,
    save,
    dispose,
  };
});
