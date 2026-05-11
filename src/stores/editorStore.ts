import { defineStore } from 'pinia';
import { computed, shallowRef, ref } from 'vue';
import * as fabric from 'fabric';
import { EditorCore } from '@/core/EditorCore';
import { EinkColorPlugin } from '@/plugins/eink/EinkColorPlugin';
import { EinkRenderPlugin } from '@/plugins/eink/EinkRenderPlugin';
import { EinkExportPlugin } from '@/plugins/eink/EinkExportPlugin';
import type { BootConfig, FabricJSON, FabricObjectJSON, PreviewData, SaveExportMode } from '@/boot/types';
import { ScreenType, type ColorEntry, type ScreenProfile } from '@/screen/types';
import { SCREEN_PROFILES } from '@/screen/profiles';
import { findNearestColor, hexToRgb } from '@/renderer/colorUtils';
import { buildSavePayload, type SavePayload } from '@/export/SavePayloadBuilder';
import { PRICE_BINDABLE_FIELDS, validateCustomFieldId, type PriceBindableField } from '@/fields/constants';
import { DEFAULT_EDITOR_FONT_FAMILY, resolveEditorFontFamily, resolveEditorFontWeight, type EditorFontWeight } from '@/fonts';
import type { RecognizedPriceTag } from '@/ocr/types';
import {
  createPriceTagTemplatePlan,
  type SmartTemplateKind,
  type TemplateElementPlan,
} from '@/ocr/templatePlanner';
import {
  createBarcodeVisual,
  createDiscountVisual,
  createImageVisual,
  createPriceVisual,
  createQrcodeVisual,
  type VisualBounds,
} from '@/rendering/componentVisuals';
import { getMarketProfile, translate, type LocaleCode, type MarketCode } from '@/i18n';

/** Error thrown when neither onSave nor saveApi is configured */
export class SaveConfigError extends Error {
  constructor() {
    super(translate('errors.saveConfig'));
    this.name = 'SaveConfigError';
  }
}

/** Error thrown when saveApi request fails */
export class SaveApiError extends Error {
  readonly status: number;
  constructor(status: number, statusText: string) {
    super(translate('errors.saveApi', { status, statusText }));
    this.name = 'SaveApiError';
    this.status = status;
  }
}

/** Error thrown when saveApi network request fails */
export class SaveNetworkError extends Error {
  constructor(cause: string) {
    super(translate('errors.saveNetwork', { cause }));
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

export interface RenderMeta {
  fitWarnings?: ComponentWarning[];
  readabilityWarnings?: ComponentWarning[];
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
  fontWeight: EditorFontWeight;
  color: string;
}

/** QRCODE error correction levels */
export const QRCODE_ERROR_CORRECTIONS = ['L', 'M', 'Q', 'H'] as const;
export type QrcodeErrorCorrection = (typeof QRCODE_ERROR_CORRECTIONS)[number];

/** QRCODE component extension data stored on fabric object */
export interface QrcodeExtension {
  /** Dynamic preview-data field or static per-element content */
  source: 'dynamic' | 'static';
  /** Field binding for dynamic QR codes */
  fieldBinding: 'qrContent' | null;
  /** Static QR code content */
  content: string;
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
  renderMeta?: RenderMeta;
}

/** BARCODE component extension data stored on fabric object */
export interface BarcodeExtension {
  /** Dynamic preview-data field or static per-element content */
  source: 'dynamic' | 'static';
  /** Field binding for dynamic barcodes */
  fieldBinding: 'barcodeContent' | null;
  /** Static barcode content */
  content: string;
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
  renderMeta?: RenderMeta;
}

/** DISCOUNT component extension data stored on fabric object */
export interface DiscountExtension {
  /** Always 'discount' */
  fieldBinding: 'discount';
  /** Format template, e.g. '{value}折' */
  formatTemplate: string;
  /** Background color (palette-constrained) */
  backgroundColor: string;
  /** Whether to render a filled background badge */
  showBackground?: boolean;
  /** Optional badge border color */
  borderColor?: string;
  /** Optional badge border width */
  borderWidth?: number;
  /** Optional badge corner radius */
  cornerRadius?: number;
  /** Text color (palette-constrained) */
  textColor: string;
  /** Font family */
  fontFamily?: string;
  /** Font size */
  fontSize: number;
  /** Font weight */
  fontWeight: EditorFontWeight;
  /** Horizontal alignment */
  textAlign: 'left' | 'center' | 'right';
  /** Vertical alignment */
  verticalAlign: 'top' | 'middle' | 'bottom';
  renderMeta?: RenderMeta;
}

/** PRICE component extension data stored on fabric object */
export interface PriceExtension {
  /** Preview data field rendered by this price component */
  fieldBinding: PriceBindableField;
  /** Font family used by all price segments */
  fontFamily?: string;
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
  renderMeta?: RenderMeta;
}

export interface LayerEntry {
  id: string;
  label: string;
  type: string;
  index: number;
  locked: boolean;
  selected: boolean;
}

type HorizontalAlignment = 'left' | 'center' | 'right';
type VerticalAlignment = 'top' | 'middle' | 'bottom';
type LayerMove = 'forward' | 'backward' | 'front' | 'back';
export type StarterTemplateKind = 'retail' | 'barcode' | 'qr';
export type ScreenColorMode = 'BW' | 'BWR' | 'BWRY' | 'E6';
export type ToolKind =
  | 'RECT'
  | 'LINE'
  | 'TEXT'
  | 'CUSTOM_DATA_TEXT'
  | 'PRICE'
  | 'DISCOUNT'
  | 'IMAGE_STATIC'
  | 'IMAGE_DYNAMIC'
  | 'QRCODE'
  | 'BARCODE';
export type SnippetKind =
  | 'PRODUCT_TITLE'
  | 'SPEC_TEXT'
  | 'PROMO_TEXT'
  | 'ORIGINAL_PRICE'
  | 'MEMBER_PRICE'
  | 'DISCOUNT_BADGE'
  | 'DIVIDER_LINE';

export interface ToolPosition {
  left: number;
  top: number;
}

interface HistoryState {
  version?: string;
  background?: unknown;
  canvas: {
    width: number;
    height: number;
  };
  screen: {
    type: ScreenType;
    profile: ScreenProfile;
  };
  previewData: PreviewData;
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

type PresetElementType =
  | 'RECT'
  | 'LINE'
  | 'TEXT'
  | 'PRICE'
  | 'DISCOUNT'
  | 'IMAGE'
  | 'QRCODE'
  | 'BARCODE';

const PRESET_CANVAS_WIDTH = 296;
const PRESET_CANVAS_HEIGHT = 128;
const COLOR_MODE_TO_SCREEN_TYPE: Record<ScreenColorMode, ScreenType> = {
  BW: ScreenType.BW,
  BWR: ScreenType.TRI,
  BWRY: ScreenType.BWRY,
  E6: ScreenType.SIX,
};
const SCREEN_TYPE_TO_COLOR_MODE: Record<ScreenType, ScreenColorMode> = {
  [ScreenType.BW]: 'BW',
  [ScreenType.TRI]: 'BWR',
  [ScreenType.BWRY]: 'BWRY',
  [ScreenType.SIX]: 'E6',
};

function clampNumber(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function roundNumber(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function getPresetScale(config: BootConfig): number {
  const widthScale = config.canvas.width / PRESET_CANVAS_WIDTH;
  const heightScale = config.canvas.height / PRESET_CANVAS_HEIGHT;
  return clampNumber(Math.min(widthScale, heightScale), 0.65, 2.5);
}

function scaledPresetValue(config: BootConfig, value: number): number {
  return Math.max(1, Math.round(value * getPresetScale(config)));
}

function scaledStarterBounds(config: BootConfig, bounds: VisualBounds): VisualBounds {
  const widthScale = config.canvas.width / PRESET_CANVAS_WIDTH;
  const heightScale = config.canvas.height / PRESET_CANVAS_HEIGHT;
  return fitBoundsToCanvas(config, {
    left: Math.round(bounds.left * widthScale),
    top: Math.round(bounds.top * heightScale),
    width: Math.round(bounds.width * widthScale),
    height: Math.round(bounds.height * heightScale),
  });
}

function fitBoundsToCanvas(config: BootConfig, bounds: VisualBounds): VisualBounds {
  const canvasWidth = Math.max(1, roundNumber(config.canvas.width));
  const canvasHeight = Math.max(1, roundNumber(config.canvas.height));
  const width = clampNumber(roundNumber(bounds.width), 1, canvasWidth);
  const height = clampNumber(roundNumber(bounds.height), 1, canvasHeight);

  return {
    left: clampNumber(roundNumber(bounds.left), 0, canvasWidth - width),
    top: clampNumber(roundNumber(bounds.top), 0, canvasHeight - height),
    width,
    height,
  };
}

function getNamedPaletteColor(config: BootConfig, colorName: string): string | null {
  const target = colorName.toLowerCase();
  return config.screen.profile.palette.find((color) => color.name.toLowerCase() === target)?.hex ?? null;
}

function screenTypeToColorMode(type: ScreenType): ScreenColorMode {
  return SCREEN_TYPE_TO_COLOR_MODE[type] ?? 'BW';
}

function buildRuntimeProfile(colorMode: ScreenColorMode, width: number, height: number): ScreenProfile {
  const base = SCREEN_PROFILES[COLOR_MODE_TO_SCREEN_TYPE[colorMode]];
  return {
    ...base,
    palette: base.palette.map((color) => ({ ...color })),
    defaultWidth: width,
    defaultHeight: height,
  };
}

function profileToPayloadPalette(profile: ScreenProfile): Array<{ name: string; value: string }> {
  return profile.palette.map((color) => ({ name: color.name, value: color.hex }));
}

function isTransparentPaint(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  if (normalized === 'transparent') return true;
  const rgbaMatch = normalized.match(/^rgba\([^,]+,[^,]+,[^,]+,([^)]+)\)$/);
  return rgbaMatch ? Number(rgbaMatch[1]) === 0 : false;
}

function remapPaintToPalette(value: unknown, palette: readonly ColorEntry[]): unknown {
  if (typeof value !== 'string' || isTransparentPaint(value)) return value;
  if (!/^#[0-9a-f]{6}$/i.test(value)) return value;
  const rgb = hexToRgb(value);
  if (rgb.some((channel) => Number.isNaN(channel))) return value;
  return findNearestColor(rgb[0], rgb[1], rgb[2], palette).entry.hex;
}

function remapExtensionColors(ext: Record<string, any> | undefined, palette: readonly ColorEntry[]): void {
  if (!ext) return;

  for (const key of ['backgroundColor', 'foregroundColor', 'textColor', 'borderColor', 'color']) {
    if (typeof ext[key] === 'string') {
      ext[key] = remapPaintToPalette(ext[key], palette);
    }
  }

  for (const key of ['currencyStyle', 'integerStyle', 'decimalStyle']) {
    if (ext[key]?.color) {
      ext[key] = {
        ...ext[key],
        color: remapPaintToPalette(ext[key].color, palette),
      };
    }
  }
}

export const useEditorStore = defineStore('editor', () => {
  const editor = shallowRef<EditorCore | null>(null);
  const isReady = ref(false);
  const selectedObject = shallowRef<fabric.Object | null>(null);
  const savePayload = ref<SavePayload | null>(null);
  const isSaving = ref(false);
  const saveExportMode = ref<SaveExportMode>('fabric-json');
  const historyStack = ref<HistoryState[]>([]);
  const historyIndex = ref(-1);
  const clipboardObjects = ref<FabricObjectJSON[] | null>(null);
  const selectionVersion = ref(0);

  let historySuppression = 0;
  let objectIdCounter = 0;
  let pasteOffset = 0;
  const renderTokens = new Map<string, number>();

  const canUndo = computed(() => historyIndex.value > 0);
  const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < historyStack.value.length - 1);
  const hasClipboard = computed(() => Boolean(clipboardObjects.value?.length));
  const hasActiveSelection = computed(() => {
    selectionVersion.value;
    return getActiveDrawableObjects().length > 0;
  });
  const drawableObjectCount = computed(() => {
    selectionVersion.value;
    const core = editor.value;
    return core ? getCanvasDrawableObjects(core).length : 0;
  });
  const isActiveSelectionLocked = computed(() => {
    selectionVersion.value;
    const objects = getActiveDrawableObjects();
    return objects.length > 0 && objects.every(isObjectLocked);
  });
  const layerEntries = computed<LayerEntry[]>(() => {
    selectionVersion.value;
    const core = editor.value;
    if (!core) return [];

    const activeIds = new Set(
      getActiveDrawableObjects(core)
        .map((obj) => (obj as any).id)
        .filter((id): id is string => Boolean(id))
    );

    return getCanvasDrawableObjects(core)
      .map((obj, index) => {
        const id = ensureObjectId(obj);
        return {
          id: id ?? `layer_${index}`,
          label: getObjectLayerLabel(obj, index),
          type: getObjectType(obj),
          index,
          locked: isObjectLocked(obj),
          selected: id ? activeIds.has(id) : false,
        };
      })
      .reverse();
  });

  function initEditor(el: HTMLCanvasElement, config: BootConfig) {
    saveExportMode.value = normalizeSaveExportMode(config.saveExportMode);
    config.saveExportMode = saveExportMode.value;
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

  function normalizeSaveExportMode(mode: unknown): SaveExportMode {
    return mode === 'static-dynamic' ? 'static-dynamic' : 'fabric-json';
  }

  function setSaveExportMode(mode: SaveExportMode): void {
    const next = normalizeSaveExportMode(mode);
    saveExportMode.value = next;
    if (editor.value) {
      editor.value.bootConfig.saveExportMode = next;
    }
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

  function beginObjectRender(obj: fabric.Object): { id: string; token: number } | null {
    const id = ensureObjectId(obj);
    if (!id) return null;
    const token = (renderTokens.get(id) ?? 0) + 1;
    renderTokens.set(id, token);
    return { id, token };
  }

  function isLatestObjectRender(render: { id: string; token: number } | null): boolean {
    return !render || renderTokens.get(render.id) === render.token;
  }

  function assignFreshObjectId(obj: fabric.Object): void {
    if (isWorkspaceObject(obj)) return;
    (obj as any).id = createObjectId((obj as any).extensionType ?? obj.type ?? 'object');
  }

  function ensureAllObjectIds(core: EditorCore): void {
    getCanvasDrawableObjects(core).forEach((obj) => {
      ensureObjectId(obj);
      prepareEditableObject(obj);
    });
  }

  function getObjectType(obj: fabric.Object): string {
    const ext = (obj as any).extensionType;
    if (typeof ext === 'string' && ext) return ext;
    if (obj.type === 'rect') return 'RECT';
    if (obj.type === 'line') return 'LINE';
    return String(obj.type ?? 'OBJECT').toUpperCase();
  }

  function prepareEditableObject(obj: fabric.Object): void {
    if (isWorkspaceObject(obj)) return;

    if (obj instanceof fabric.Textbox) {
      obj.set({
        fontFamily: resolveEditorFontFamily(obj.fontFamily as string | undefined),
        fontWeight: resolveEditorFontWeight(obj.fontWeight),
      } as any);
    }

    const ext = (obj as any).extension as Record<string, any> | undefined;
    if (ext) {
      if ('fontFamily' in ext) ext.fontFamily = resolveEditorFontFamily(ext.fontFamily);
      if ('fontWeight' in ext) ext.fontWeight = resolveEditorFontWeight(ext.fontWeight);
      for (const key of ['currencyStyle', 'integerStyle', 'decimalStyle']) {
        if (ext[key]?.fontWeight != null) {
          ext[key] = {
            ...ext[key],
            fontWeight: resolveEditorFontWeight(ext[key].fontWeight),
          };
        }
      }
    }

    const locked = isObjectLocked(obj);
    obj.set({
      selectable: true,
      evented: true,
      hasBorders: true,
      hasControls: !locked,
      hoverCursor: locked ? 'not-allowed' : 'move',
      moveCursor: locked ? 'not-allowed' : 'move',
      lockScalingFlip: true,
      transparentCorners: false,
      cornerStyle: 'rect',
      cornerColor: '#f5d74f',
      cornerStrokeColor: '#1f6feb',
      borderColor: '#82b1ff',
      cornerSize: 8,
      touchCornerSize: 18,
      borderScaleFactor: 1,
      padding: 2,
    } as any);

    if ('editable' in obj) {
      obj.set('editable' as any, !locked);
    }
  }

  function getPresetColumnMetrics(config: BootConfig) {
    const scale = getPresetScale(config);
    const margin = clampNumber(Math.round(12 * scale), 6, Math.max(6, Math.floor(Math.min(config.canvas.width, config.canvas.height) / 5)));
    const gutter = Math.max(4, Math.round(8 * scale));
    const rightSize = clampNumber(
      Math.round(56 * scale),
      28,
      Math.max(28, Math.min(config.canvas.width - margin * 2, config.canvas.height - margin * 2, Math.round(68 * scale)))
    );
    const rightLeft = Math.max(margin, config.canvas.width - margin - rightSize);
    const mainRight = Math.max(margin, rightLeft - gutter);
    const mainWidth = Math.max(1, mainRight - margin);

    return { margin, gutter, rightSize, rightLeft, mainWidth };
  }

  function getElementPresetBounds(core: EditorCore, type: PresetElementType): VisualBounds {
    const config = core.bootConfig;
    const scale = getPresetScale(config);
    const { margin, gutter, rightSize, rightLeft, mainWidth } = getPresetColumnMetrics(config);
    const canvasWidth = config.canvas.width;
    const canvasHeight = config.canvas.height;

    const textHeight = scaledPresetValue(config, 24);
    const priceHeight = scaledPresetValue(config, 38);
    const discountWidth = clampNumber(scaledPresetValue(config, 58), 36, Math.max(36, mainWidth));
    const discountHeight = scaledPresetValue(config, 26);
    const barcodeHeight = scaledPresetValue(config, 26);
    const qrSize = clampNumber(
      scaledPresetValue(config, 52),
      28,
      Math.max(28, Math.min(canvasWidth - margin * 2, canvasHeight - margin * 2, scaledPresetValue(config, 58)))
    );
    const barcodeWidth = Math.min(canvasWidth - margin * 2, scaledPresetValue(config, 152));

    const presets: Record<PresetElementType, VisualBounds> = {
      RECT: {
        left: margin,
        top: margin,
        width: canvasWidth - margin * 2,
        height: canvasHeight - margin * 2,
      },
      LINE: {
        left: margin,
        top: Math.round(canvasHeight * 0.5),
        width: canvasWidth - margin * 2,
        height: 1,
      },
      TEXT: {
        left: margin,
        top: margin,
        width: Math.min(mainWidth, scaledPresetValue(config, 168)),
        height: textHeight,
      },
      PRICE: {
        left: margin,
        top: clampNumber(Math.round(canvasHeight * 0.36), margin + textHeight + 2, canvasHeight - margin - priceHeight),
        width: Math.min(mainWidth, scaledPresetValue(config, 132)),
        height: priceHeight,
      },
      DISCOUNT: {
        left: margin + Math.min(mainWidth - discountWidth, scaledPresetValue(config, 136)),
        top: clampNumber(Math.round(canvasHeight * 0.42), margin, canvasHeight - margin - discountHeight),
        width: discountWidth,
        height: discountHeight,
      },
      IMAGE: {
        left: rightLeft,
        top: margin,
        width: rightSize,
        height: rightSize,
      },
      QRCODE: {
        left: Math.round((canvasWidth - qrSize) / 2),
        top: Math.round((canvasHeight - qrSize) / 2),
        width: qrSize,
        height: qrSize,
      },
      BARCODE: {
        left: Math.round((canvasWidth - barcodeWidth) / 2),
        top: clampNumber(Math.round(canvasHeight * 0.68), margin, canvasHeight - margin - barcodeHeight),
        width: barcodeWidth,
        height: barcodeHeight,
      },
    };

    const existingSameTypeCount = getCanvasDrawableObjects(core).filter((obj) => getObjectType(obj) === type).length;
    const offset = existingSameTypeCount % 5 * Math.max(4, Math.round(6 * scale));
    const base = presets[type];
    const cascaded = type === 'LINE'
      ? { ...base, top: base.top + offset }
      : { ...base, left: base.left + offset, top: base.top + offset };

    return fitBoundsToCanvas(config, cascaded);
  }

  function getPresetTypeForTool(kind: ToolKind): PresetElementType {
    if (kind === 'IMAGE_STATIC' || kind === 'IMAGE_DYNAMIC') return 'IMAGE';
    if (kind === 'CUSTOM_DATA_TEXT') return 'TEXT';
    return kind;
  }

  function getToolBounds(core: EditorCore, kind: ToolKind, position?: ToolPosition): VisualBounds {
    const bounds = getElementPresetBounds(core, getPresetTypeForTool(kind));
    if (!position) return bounds;

    return fitBoundsToCanvas(core.bootConfig, {
      ...bounds,
      left: position.left - bounds.width / 2,
      top: position.top - bounds.height / 2,
    });
  }

  function getPaletteAccentColors(config: BootConfig): { accent: string; onAccent: string; hasChromaticAccent: boolean } {
    const red = getNamedPaletteColor(config, 'Red');
    if (red) return { accent: red, onAccent: '#FFFFFF', hasChromaticAccent: true };
    const yellow = getNamedPaletteColor(config, 'Yellow');
    if (yellow) return { accent: yellow, onAccent: '#000000', hasChromaticAccent: true };
    return { accent: '#000000', onAccent: '#FFFFFF', hasChromaticAccent: false };
  }

  function getDiscountBadgeColors(config: BootConfig): { backgroundColor: string; textColor: string } {
    const { accent, onAccent, hasChromaticAccent } = getPaletteAccentColors(config);
    if (hasChromaticAccent) {
      return { backgroundColor: accent, textColor: onAccent };
    }

    return { backgroundColor: '#000000', textColor: '#FFFFFF' };
  }

  function getMarketPriceDefaults(config: BootConfig) {
    return config.marketProfile.price;
  }

  function getStarterText(config: BootConfig) {
    return {
      ...config.marketProfile.starterText,
      defaultTemplateName: translate('starter.defaultTemplateName'),
      productName: translate('starter.productName'),
      productTitle: translate('starter.productTitle'),
      specText: translate('starter.specText'),
      promoText: translate('starter.promoText'),
      memberLabel: translate('starter.memberLabel'),
      qrHeadline: translate('starter.qrHeadline'),
      qrDescription: translate('starter.qrDescription'),
    };
  }

  function shouldReplaceMarketSampleValue(current: unknown, previousSample: unknown): boolean {
    return current == null || current === '' || current === previousSample;
  }

  function applyMarketSamplePreviewData(config: BootConfig, nextMarket: MarketCode): void {
    const previousProfile = config.marketProfile;
    const nextProfile = getMarketProfile(nextMarket);
    const previewData = config.previewData ??= {};

    for (const [field, nextValue] of Object.entries(nextProfile.samplePreviewData)) {
      const previousValue = previousProfile.samplePreviewData[field];
      if (shouldReplaceMarketSampleValue(previewData[field], previousValue)) {
        previewData[field] = nextValue;
      }
    }
  }

  function applyRegionalPreferences(locale: LocaleCode, market: MarketCode): void {
    const core = editor.value;
    if (!core) return;
    const marketChanged = core.bootConfig.market !== market;
    if (marketChanged) {
      applyMarketSamplePreviewData(core.bootConfig, market);
    }
    core.bootConfig.locale = locale;
    core.bootConfig.market = market;
    core.bootConfig.marketProfile = getMarketProfile(market);
    selectionVersion.value++;
  }

  function applyRuntimeScreenProfile(core: EditorCore, type: ScreenType, profile: ScreenProfile): void {
    core.bootConfig.screen.type = type;
    core.bootConfig.screen.profile = profile;
    core.bootConfig.screen.palette = profile.palette;
    if (core.bootConfig.sourceProfile) {
      core.bootConfig.sourceProfile.colorMode = screenTypeToColorMode(type);
      core.bootConfig.sourceProfile.palette = profileToPayloadPalette(profile);
      core.bootConfig.sourceProfile.width = core.bootConfig.canvas.width;
      core.bootConfig.sourceProfile.height = core.bootConfig.canvas.height;
    }

    core.fabricCanvas.backgroundColor = profile.defaultBackground;
    core.getPlugin<EinkColorPlugin>('EinkColorPlugin')?.setProfile(profile);
    core.getPlugin<EinkRenderPlugin>('EinkRenderPlugin')?.setProfile(profile);
    core.getPlugin<EinkExportPlugin>('EinkExportPlugin')?.setProfile(profile);
  }

  function remapObjectPaints(obj: fabric.Object, palette: readonly ColorEntry[]): void {
    const fill = remapPaintToPalette(obj.fill, palette);
    const stroke = remapPaintToPalette(obj.stroke, palette);
    if (fill !== obj.fill) obj.set('fill' as any, fill as any);
    if (stroke !== obj.stroke) obj.set('stroke' as any, stroke as any);

    if (obj instanceof fabric.Group) {
      obj.getObjects().forEach((child) => remapObjectPaints(child, palette));
    }
  }

  async function changeScreenColorMode(colorMode: ScreenColorMode): Promise<void> {
    const core = editor.value;
    if (!core) return;

    const nextType = COLOR_MODE_TO_SCREEN_TYPE[colorMode];
    const nextProfile = buildRuntimeProfile(colorMode, core.bootConfig.canvas.width, core.bootConfig.canvas.height);
    if (
      core.bootConfig.screen.type === nextType
      && core.bootConfig.screen.profile.palette.length === nextProfile.palette.length
    ) {
      return;
    }

    const selectedIds = getActiveDrawableObjects(core)
      .map(ensureObjectId)
      .filter((id): id is string => Boolean(id));

    historySuppression++;
    try {
      applyRuntimeScreenProfile(core, nextType, nextProfile);
      ensureWorkspace(core);

      const objects = getCanvasDrawableObjects(core);
      for (const obj of objects) {
        remapObjectPaints(obj, nextProfile.palette);
        remapExtensionColors((obj as any).extension, nextProfile.palette);
        const type = (obj as any).extensionType as string | undefined;
        if (isCompositeVisualType(type)) {
          await refreshExtendedObject(obj);
        } else {
          prepareEditableObject(obj);
          obj.setCoords();
        }
      }

      ensureWorkspace(core);
      const objectsById = new Map(
        getCanvasDrawableObjects(core).map((obj) => [(obj as any).id, obj] as const)
      );
      selectObjects(
        core,
        selectedIds.map((id) => objectsById.get(id)).filter((obj): obj is fabric.Object => Boolean(obj))
      );
      core.fabricCanvas.requestRenderAll();
    } finally {
      historySuppression--;
    }

    selectionVersion.value++;
    commitHistory();
  }

  function normalizeQrcodeExtension(ext: Partial<QrcodeExtension> | undefined): QrcodeExtension {
    const source = ext?.source ?? 'dynamic';
    return {
      source,
      fieldBinding: source === 'dynamic' ? 'qrContent' : null,
      content: ext?.content ?? '',
      errorCorrection: ext?.errorCorrection ?? 'M',
      margin: ext?.margin ?? 1,
      foregroundColor: ext?.foregroundColor ?? '#000000',
      backgroundColor: ext?.backgroundColor ?? '#FFFFFF',
      readabilityWarnings: ext?.readabilityWarnings,
      renderMeta: ext?.renderMeta,
    };
  }

  function normalizeBarcodeExtension(ext: Partial<BarcodeExtension> | undefined): BarcodeExtension {
    const source = ext?.source ?? 'dynamic';
    return {
      source,
      fieldBinding: source === 'dynamic' ? 'barcodeContent' : null,
      content: ext?.content ?? '',
      format: 'CODE128',
      showText: ext?.showText ?? true,
      foregroundColor: ext?.foregroundColor ?? '#000000',
      backgroundColor: ext?.backgroundColor ?? '#FFFFFF',
      readabilityWarnings: ext?.readabilityWarnings,
      renderMeta: ext?.renderMeta,
    };
  }

  function resolveQrcodeContent(config: BootConfig, ext: QrcodeExtension): unknown {
    return ext.source === 'static' ? ext.content : config.previewData?.[ext.fieldBinding ?? 'qrContent'];
  }

  function resolveBarcodeContent(config: BootConfig, ext: BarcodeExtension): unknown {
    return ext.source === 'static' ? ext.content : config.previewData?.[ext.fieldBinding ?? 'barcodeContent'];
  }

  function getObjectLayerLabel(obj: fabric.Object, index: number): string {
    const type = getObjectType(obj);
    const typeLabel = translate(`objects.${type}`);
    if (type === 'TEXT') {
      const text = ((obj as fabric.Textbox).text ?? '').trim();
      return text ? `${typeLabel} · ${text.slice(0, 12)}` : typeLabel;
    }
    return `${typeLabel} ${index + 1}`;
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
    canvas: state.canvas,
    screen: state.screen,
    previewData: state.previewData,
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
      canvas: {
        width: core.bootConfig.canvas.width,
        height: core.bootConfig.canvas.height,
      },
      screen: {
        type: core.bootConfig.screen.type,
        profile: cloneJson(core.bootConfig.screen.profile),
      },
      previewData: cloneJson((core.bootConfig.previewData ?? {}) as PreviewData),
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

  function hasObjectScale(obj: fabric.Object): boolean {
    return Math.abs((obj.scaleX ?? 1) - 1) > 0.001 || Math.abs((obj.scaleY ?? 1) - 1) > 0.001;
  }

  function normalizeRectTransform(obj: fabric.Object): void {
    if (!hasObjectScale(obj)) return;
    const bounds = getObjectBounds(obj);
    obj.set({
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      scaleX: 1,
      scaleY: 1,
    });
    obj.setCoords();
  }

  function normalizeTextboxTransform(obj: fabric.Textbox): void {
    if (!hasObjectScale(obj)) return;
    const bounds = getObjectBounds(obj);
    const scaledFontSize = Math.max(6, Math.round((obj.fontSize ?? 16) * (obj.scaleY ?? 1)));
    obj.set({
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      fontSize: scaledFontSize,
      scaleX: 1,
      scaleY: 1,
    });
    updateDynamicText(obj);
    obj.setCoords();
  }

  function clampObjectToCanvas(core: EditorCore, obj: fabric.Object): void {
    if (isWorkspaceObject(obj)) return;

    const rect = obj.getBoundingRect();
    let deltaX = 0;
    let deltaY = 0;

    if (rect.width >= core.canvasWidth) {
      deltaX = -rect.left;
    } else if (rect.left < 0) {
      deltaX = -rect.left;
    } else if (rect.left + rect.width > core.canvasWidth) {
      deltaX = core.canvasWidth - (rect.left + rect.width);
    }

    if (rect.height >= core.canvasHeight) {
      deltaY = -rect.top;
    } else if (rect.top < 0) {
      deltaY = -rect.top;
    } else if (rect.top + rect.height > core.canvasHeight) {
      deltaY = core.canvasHeight - (rect.top + rect.height);
    }

    if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) return;

    obj.set({
      left: Math.round((obj.left ?? 0) + deltaX),
      top: Math.round((obj.top ?? 0) + deltaY),
    });
    obj.setCoords();
  }

  async function normalizeModifiedObject(core: EditorCore, obj: fabric.Object): Promise<void> {
    if (isWorkspaceObject(obj)) return;
    prepareEditableObject(obj);

    const type = getObjectType(obj);
    if (type === 'LINE') {
      clampObjectToCanvas(core, obj);
      return;
    }

    if (type === 'TEXT' && obj instanceof fabric.Textbox) {
      normalizeTextboxTransform(obj);
      clampObjectToCanvas(core, obj);
      return;
    }

    if (type === 'RECT') {
      normalizeRectTransform(obj);
      clampObjectToCanvas(core, obj);
      return;
    }

    if (hasObjectScale(obj) && (obj as any).extensionType) {
      await refreshExtendedObject(obj);
      if (selectedObject.value) {
        clampObjectToCanvas(core, selectedObject.value);
      }
      return;
    }

    clampObjectToCanvas(core, obj);
  }

  async function normalizeModifiedTarget(core: EditorCore, target?: fabric.Object): Promise<void> {
    if (!target || isWorkspaceObject(target)) return;

    if (target.type === 'activeSelection') {
      getActiveDrawableObjects(core).forEach(prepareEditableObject);
      return;
    }

    await normalizeModifiedObject(core, target);
  }

  function bindHistoryEvents(core: EditorCore): void {
    const onCanvasChanged = (event: { target?: fabric.Object }) => {
      if (historySuppression > 0) return;
      if (event.target && isWorkspaceObject(event.target)) return;
      commitHistory();
    };

    const onObjectModified = (event: { target?: fabric.Object }) => {
      if (historySuppression > 0) return;
      if (event.target && isWorkspaceObject(event.target)) return;

      historySuppression++;
      void normalizeModifiedTarget(core, event.target)
        .finally(() => {
          historySuppression--;
          selectionVersion.value++;
          core.fabricCanvas.requestRenderAll();
          commitHistory();
        });
    };

    core.fabricCanvas.on('object:added', onCanvasChanged);
    core.fabricCanvas.on('object:removed', onCanvasChanged);
    core.fabricCanvas.on('object:modified', onObjectModified);
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
      if (
        core.bootConfig.canvas.width !== state.canvas.width
        || core.bootConfig.canvas.height !== state.canvas.height
      ) {
        core.resizeCanvas(state.canvas.width, state.canvas.height);
      }
      if (state.screen) {
        applyRuntimeScreenProfile(core, state.screen.type, cloneJson(state.screen.profile));
      }
      const json = {
        version: state.version,
        background: state.background,
        objects: [
          workspaceToJSON(core),
          ...cloneJson(state.objects),
        ],
      } as FabricJSON;

      await loadCanvasJSON(core, json);
      core.bootConfig.previewData = cloneJson(state.previewData);
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
    prepareEditableObject(obj);
    runHistoryMutation(() => {
      core.fabricCanvas.add(obj);
      core.fabricCanvas.setActiveObject(obj);
      selectedObject.value = obj;
      core.fabricCanvas.renderAll();
    });
  }

  function clearCanvasObjects(): void {
    const core = editor.value;
    if (!core) return;
    const objects = getCanvasDrawableObjects(core);
    if (!objects.length) return;

    runHistoryMutation(() => {
      core.fabricCanvas.discardActiveObject();
      objects.forEach((obj) => core.fabricCanvas.remove(obj));
      selectedObject.value = null;
      core.fabricCanvas.renderAll();
    });
  }

  function getObjectBounds(obj: fabric.Object): VisualBounds {
    const scaleX = Number.isFinite(obj.scaleX) ? obj.scaleX ?? 1 : 1;
    const scaleY = Number.isFinite(obj.scaleY) ? obj.scaleY ?? 1 : 1;
    const width = obj.width ?? obj.getScaledWidth?.() ?? 1;
    const height = obj.height ?? obj.getScaledHeight?.() ?? 1;

    return {
      left: Math.round(obj.left ?? 0),
      top: Math.round(obj.top ?? 0),
      width: Math.max(1, Math.round(width * scaleX)),
      height: Math.max(1, Math.round(height * scaleY)),
    };
  }

  function updateDynamicText(obj: fabric.Object): void {
    const ext = (obj as any).extension as TextExtension | undefined;
    if ((obj as any).extensionType !== 'TEXT' || !ext?.fieldBinding) return;
    const value = editor.value?.bootConfig.previewData?.[ext.fieldBinding];
    (obj as fabric.Textbox).set('text', value == null ? '' : String(value));
  }

  function isCompositeVisualType(type: string | undefined): boolean {
    return type === 'PRICE'
      || type === 'DISCOUNT'
      || type === 'IMAGE'
      || type === 'QRCODE'
      || type === 'BARCODE';
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
    prepareEditableObject(nextObj);
    const index = core.fabricCanvas.getObjects().indexOf(oldObj);
    if (index < 0) return;
    core.fabricCanvas.remove(oldObj);
    core.fabricCanvas.insertAt(index, nextObj);
    core.fabricCanvas.setActiveObject(nextObj);
    selectedObject.value = nextObj;
    core.fabricCanvas.renderAll();
  }

  async function refreshExtendedObjectWithBounds(obj: fabric.Object, nextBounds: VisualBounds): Promise<void> {
    const core = editor.value;
    if (!core) return;
    const type = (obj as any).extensionType as string | undefined;
    const ext = (obj as any).extension;
    const bounds = fitBoundsToCanvas(core.bootConfig, nextBounds);

    if (type === 'PRICE') {
      replaceObject(obj, createPriceVisual(core.bootConfig, bounds, ext as PriceExtension));
    } else if (type === 'DISCOUNT') {
      replaceObject(
        obj,
        createDiscountVisual(bounds, core.bootConfig.previewData?.discount, ext as DiscountExtension)
      );
    } else if (type === 'IMAGE') {
      const render = beginObjectRender(obj);
      const imageExt = ext as ImageExtension;
      const nextExt = imageExt.source === 'dynamic'
        ? { ...imageExt, src: String(core.bootConfig.previewData?.[imageExt.fieldBinding ?? 'imageUrl'] ?? '') }
        : imageExt;
      const nextObj = await createImageVisual(bounds, nextExt);
      if (!isLatestObjectRender(render)) return;
      replaceObject(obj, nextObj);
    } else if (type === 'QRCODE') {
      const normalizedExt = normalizeQrcodeExtension(ext as Partial<QrcodeExtension>);
      replaceObject(
        obj,
        createQrcodeVisual(bounds, resolveQrcodeContent(core.bootConfig, normalizedExt), normalizedExt)
      );
    } else if (type === 'BARCODE') {
      const normalizedExt = normalizeBarcodeExtension(ext as Partial<BarcodeExtension>);
      replaceObject(
        obj,
        createBarcodeVisual(bounds, resolveBarcodeContent(core.bootConfig, normalizedExt), normalizedExt)
      );
    }
  }

  async function refreshExtendedObject(obj: fabric.Object): Promise<void> {
    const core = editor.value;
    if (!core) return;
    const type = (obj as any).extensionType as string | undefined;

    if (type === 'TEXT') {
      updateDynamicText(obj);
      obj.setCoords();
      core.fabricCanvas.renderAll();
      return;
    }

    await refreshExtendedObjectWithBounds(obj, getObjectBounds(obj));
  }

  function addRect(position?: ToolPosition): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const bounds = getToolBounds(core, 'RECT', position);

    const rect = new fabric.Rect({
      ...bounds,
      fill: config.screen.profile.defaultBackground === '#FFFFFF' ? '#FFFFFF' : '#000000',
      stroke: '#000000',
      strokeWidth: 1,
    });
    (rect as any).extensionType = 'RECT';

    addVisualObject(rect);
  }

  function addLine(position?: ToolPosition): void {
    const core = editor.value;
    if (!core) return;

    const bounds = getToolBounds(core, 'LINE', position);
    const x1 = bounds.left;
    const y1 = bounds.top;
    const x2 = bounds.left + bounds.width;
    const y2 = y1;

    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: '#000000',
      strokeWidth: 1,
    });
    (line as any).extensionType = 'LINE';

    addVisualObject(line);
  }

  function addText(position?: ToolPosition): void {
    const core = editor.value;
    if (!core) return;

    const bounds = getToolBounds(core, 'TEXT', position);

    const text = new fabric.Textbox(getStarterText(core.bootConfig).productName, {
      left: bounds.left,
      top: bounds.top,
      originX: 'left',
      originY: 'top',
      width: bounds.width,
      fontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      fontSize: Math.max(10, scaledPresetValue(core.bootConfig, 16)),
      fontWeight: resolveEditorFontWeight('bold'),
      fill: '#000000',
      textAlign: 'left',
      lineHeight: 1.2,
      editable: true,
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

  function addCustomDataText(options: {
    fieldId: string;
    label?: string;
    sampleValue: string;
    position?: ToolPosition;
  }): void {
    const core = editor.value;
    if (!core) return;

    const fieldId = options.fieldId.trim();
    const errors = validateCustomFieldId(fieldId);
    if (errors.length > 0) {
      throw new Error(errors[0].message);
    }

    const previewData = (core.bootConfig.previewData ??= {} as PreviewData);
    previewData[fieldId] = options.sampleValue;

    const bounds = getToolBounds(core, 'CUSTOM_DATA_TEXT', options.position);
    const textValue = options.sampleValue || options.label || fieldId;
    const text = new fabric.Textbox(textValue, {
      left: bounds.left,
      top: bounds.top,
      originX: 'left',
      originY: 'top',
      width: bounds.width,
      fontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      fontSize: Math.max(10, scaledPresetValue(core.bootConfig, 14)),
      fontWeight: resolveEditorFontWeight('normal'),
      fill: '#000000',
      textAlign: 'left',
      lineHeight: 1.2,
      editable: true,
    });
    (text as any).extensionType = 'TEXT';
    (text as any).extension = {
      fieldBinding: fieldId,
      overflow: 'ellipsis' as TextOverflowMode,
      lineClamp: 1,
      verticalAlign: 'top' as const,
    };

    addVisualObject(text);
  }

  function createStarterTextObject(
    config: BootConfig,
    bounds: VisualBounds,
    options: {
      fallback: string;
      fieldBinding?: string | null;
      fontSize: number;
      fontWeight?: 'normal' | 'bold';
      textAlign?: 'left' | 'center' | 'right';
      fill?: string;
      lineClamp?: number;
    }
  ): fabric.Textbox {
    const fieldBinding = options.fieldBinding ?? null;
    const value = fieldBinding ? config.previewData?.[fieldBinding] : null;
    const text = new fabric.Textbox(value == null ? options.fallback : String(value), {
      left: bounds.left,
      top: bounds.top,
      originX: 'left',
      originY: 'top',
      width: bounds.width,
      fontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      fontSize: scaledPresetValue(config, options.fontSize),
      fontWeight: resolveEditorFontWeight(options.fontWeight ?? 'bold'),
      fill: options.fill ?? '#000000',
      textAlign: options.textAlign ?? 'left',
      lineHeight: 1.15,
      editable: true,
    });
    (text as any).extensionType = 'TEXT';
    (text as any).extension = {
      fieldBinding,
      overflow: 'ellipsis' as TextOverflowMode,
      lineClamp: options.lineClamp ?? 1,
      verticalAlign: 'top' as const,
    };
    return text;
  }

  function createStarterPriceObject(
    config: BootConfig,
    bounds: VisualBounds,
    fieldBinding: PriceBindableField = 'price',
    variant: 'main' | 'secondary' = 'main'
  ): fabric.Group {
    const { accent } = getPaletteAccentColors(config);
    const mainIntegerSize = variant === 'main' ? 34 : 15;
    const mainCurrencySize = variant === 'main' ? 13 : 9;
    const mainDecimalSize = variant === 'main' ? 16 : 9;
    const mainColor = variant === 'main' ? accent : '#000000';
    const priceDefaults = getMarketPriceDefaults(config);
    const ext = {
      fieldBinding,
      fontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      currencySymbol: priceDefaults.currencySymbol,
      showCurrency: priceDefaults.showCurrency,
      decimalPlaces: priceDefaults.decimalPlaces,
      thousandSeparator: priceDefaults.thousandSeparator,
      decimalSeparator: priceDefaults.decimalSeparator,
      currencyStyle: {
        fontSize: scaledPresetValue(config, mainCurrencySize),
        fontWeight: variant === 'main' ? 'bold' as const : 'normal' as const,
        color: '#000000',
      },
      integerStyle: {
        fontSize: scaledPresetValue(config, mainIntegerSize),
        fontWeight: 'bold' as const,
        color: mainColor,
      },
      decimalStyle: {
        fontSize: scaledPresetValue(config, mainDecimalSize),
        fontWeight: 'normal' as const,
        color: mainColor,
        offsetY: -scaledPresetValue(config, variant === 'main' ? 8 : 4),
      },
    } satisfies PriceExtension;

    return createPriceVisual(config, bounds, ext);
  }

  function createStarterDiscountObject(config: BootConfig, bounds: VisualBounds): fabric.Group {
    const { backgroundColor, textColor } = getDiscountBadgeColors(config);
    const ext = {
      fieldBinding: 'discount',
      formatTemplate: config.marketProfile.discountFormatTemplate,
      backgroundColor,
      showBackground: true,
      borderWidth: 0,
      cornerRadius: 4,
      textColor,
      fontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      fontSize: scaledPresetValue(config, 23),
      fontWeight: 'bold' as const,
      textAlign: 'center' as const,
      verticalAlign: 'middle' as const,
    } satisfies DiscountExtension;

    return createDiscountVisual(bounds, config.previewData?.discount, ext);
  }

  function createStarterBarcodeObject(config: BootConfig, bounds: VisualBounds, showText = true): fabric.Group {
    const ext = {
      source: 'dynamic',
      fieldBinding: 'barcodeContent',
      content: '',
      format: 'CODE128',
      showText,
      foregroundColor: '#000000',
      backgroundColor: '#FFFFFF',
    } satisfies BarcodeExtension;

    return createBarcodeVisual(bounds, resolveBarcodeContent(config, ext), ext);
  }

  function createStarterQrcodeObject(config: BootConfig, bounds: VisualBounds): fabric.Group {
    const ext = {
      source: 'dynamic',
      fieldBinding: 'qrContent',
      content: '',
      errorCorrection: 'M' as QrcodeErrorCorrection,
      margin: 1,
      foregroundColor: '#000000',
      backgroundColor: '#FFFFFF',
    } satisfies QrcodeExtension;

    return createQrcodeVisual(bounds, resolveQrcodeContent(config, ext), ext);
  }

  function replaceCanvasObjects(objects: fabric.Object[]): void {
    const core = editor.value;
    if (!core) return;

    runHistoryMutation(() => {
      core.fabricCanvas.discardActiveObject();
      getCanvasDrawableObjects(core).forEach((obj) => core.fabricCanvas.remove(obj));
      objects.forEach((obj) => {
        ensureObjectId(obj);
        prepareEditableObject(obj);
        core.fabricCanvas.add(obj);
      });
      core.fabricCanvas.discardActiveObject();
      selectedObject.value = null;
      core.fabricCanvas.renderAll();
    });
  }

  function createTemplatePlanObject(config: BootConfig, element: TemplateElementPlan): fabric.Object {
    if (element.type === 'TEXT') {
      return createStarterTextObject(config, element.bounds, {
        fallback: element.fallback,
        fieldBinding: element.fieldBinding,
        fontSize: element.fontSize,
        fontWeight: element.fontWeight,
        textAlign: element.textAlign,
        fill: element.fill,
        lineClamp: element.lineClamp,
      });
    }

    if (element.type === 'PRICE') {
      return createStarterPriceObject(config, element.bounds, element.fieldBinding, element.variant);
    }

    if (element.type === 'DISCOUNT') {
      return createStarterDiscountObject(config, element.bounds);
    }

    if (element.type === 'BARCODE') {
      return createStarterBarcodeObject(config, element.bounds, element.showText);
    }

    if (element.type === 'QRCODE') {
      return createStarterQrcodeObject(config, element.bounds);
    }

    const y = element.bounds.top;
    const line = new fabric.Line([
      element.bounds.left,
      y,
      element.bounds.left + element.bounds.width,
      y,
    ], {
      stroke: '#000000',
      strokeWidth: Math.max(1, element.bounds.height),
    });
    (line as any).extensionType = 'LINE';
    return line;
  }

  function mergeRecognizedPreviewData(config: BootConfig, tag: RecognizedPriceTag): void {
    const previewData = (config.previewData ??= {} as PreviewData);
    const merged = {
      ...tag.fields,
      ...tag.codes,
      ...(tag.customFields ?? {}),
    };

    for (const [field, value] of Object.entries(merged)) {
      if (value === undefined || value === null || value === '') continue;
      previewData[field] = normalizePreviewDataValue(field, value);
    }
  }

  function applyRecognizedPriceTagTemplate(tag: RecognizedPriceTag, preferredKind: SmartTemplateKind = 'auto'): void {
    const core = editor.value;
    if (!core) return;

    mergeRecognizedPreviewData(core.bootConfig, tag);
    const plan = createPriceTagTemplatePlan(core.bootConfig, tag, preferredKind);
    const objects = plan.elements.map((element) => createTemplatePlanObject(core.bootConfig, element));
    replaceCanvasObjects(objects);
  }

  function addDiscount(position?: ToolPosition): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const bounds = getToolBounds(core, 'DISCOUNT', position);
    const ext = {
      fieldBinding: 'discount',
      formatTemplate: config.marketProfile.discountFormatTemplate,
      backgroundColor: '#FFFFFF',
      showBackground: false,
      borderWidth: 0,
      textColor: '#000000',
      fontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      fontSize: Math.max(10, Math.min(bounds.height - 6, scaledPresetValue(config, 17))),
      fontWeight: 'bold' as const,
      textAlign: 'center' as const,
      verticalAlign: 'middle' as const,
    } satisfies DiscountExtension;

    addVisualObject(createDiscountVisual(bounds, config.previewData?.discount, ext));
  }

  function addPrice(position?: ToolPosition): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const bounds = getToolBounds(core, 'PRICE', position);
    const { accent } = getPaletteAccentColors(config);
    const priceDefaults = getMarketPriceDefaults(config);

    const ext = {
      fieldBinding: 'price',
      fontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      currencySymbol: priceDefaults.currencySymbol,
      showCurrency: priceDefaults.showCurrency,
      decimalPlaces: priceDefaults.decimalPlaces,
      thousandSeparator: priceDefaults.thousandSeparator,
      decimalSeparator: priceDefaults.decimalSeparator,
      currencyStyle: {
        fontSize: Math.max(9, scaledPresetValue(config, 13)),
        fontWeight: 'normal' as const,
        color: '#000000',
      },
      integerStyle: {
        fontSize: Math.max(18, Math.min(bounds.height - 6, scaledPresetValue(config, 28))),
        fontWeight: 'bold' as const,
        color: accent,
      },
      decimalStyle: {
        fontSize: Math.max(10, scaledPresetValue(config, 15)),
        fontWeight: 'normal' as const,
        color: accent,
        offsetY: -Math.max(6, scaledPresetValue(config, 10)),
      },
    } satisfies PriceExtension;

    addVisualObject(createPriceVisual(config, bounds, ext));
  }

  async function addStaticImage(position?: ToolPosition): Promise<void> {
    const core = editor.value;
    if (!core) return;

    const bounds = getToolBounds(core, 'IMAGE_STATIC', position);

    const ext = {
      source: 'static',
      src: '',
      fieldBinding: null,
      fitMode: 'contain' as ImageFitMode,
      backgroundColor: '#FFFFFF',
    } satisfies ImageExtension;

    addVisualObject(await createImageVisual(bounds, ext));
  }

  async function addDynamicImage(position?: ToolPosition): Promise<void> {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const bounds = getToolBounds(core, 'IMAGE_DYNAMIC', position);

    const previewUrl = config.previewData?.imageUrl ?? '';

    const ext = {
      source: 'dynamic',
      src: previewUrl,
      fieldBinding: 'imageUrl',
      fitMode: 'contain' as ImageFitMode,
      backgroundColor: '#FFFFFF',
    } satisfies ImageExtension;

    addVisualObject(await createImageVisual(bounds, ext));
  }

  function addQrcode(position?: ToolPosition): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const bounds = getToolBounds(core, 'QRCODE', position);

    const ext = {
      source: 'dynamic',
      fieldBinding: 'qrContent',
      content: '',
      errorCorrection: 'M' as QrcodeErrorCorrection,
      margin: 1,
      foregroundColor: '#000000',
      backgroundColor: '#FFFFFF',
    } satisfies QrcodeExtension;

    addVisualObject(createQrcodeVisual(bounds, resolveQrcodeContent(config, ext), ext));
  }

  function addBarcode(position?: ToolPosition): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const bounds = getToolBounds(core, 'BARCODE', position);

    const ext = {
      source: 'dynamic',
      fieldBinding: 'barcodeContent',
      content: '',
      format: 'CODE128',
      showText: true,
      foregroundColor: '#000000',
      backgroundColor: '#FFFFFF',
    } satisfies BarcodeExtension;

    addVisualObject(createBarcodeVisual(bounds, resolveBarcodeContent(config, ext), ext));
  }

  function getSnippetBounds(core: EditorCore, kind: SnippetKind, position?: ToolPosition): VisualBounds {
    const config = core.bootConfig;
    const presets: Record<SnippetKind, VisualBounds> = {
      PRODUCT_TITLE: scaledStarterBounds(config, { left: 10, top: 10, width: 176, height: 22 }),
      SPEC_TEXT: scaledStarterBounds(config, { left: 10, top: 34, width: 154, height: 16 }),
      PROMO_TEXT: scaledStarterBounds(config, { left: 10, top: 92, width: 184, height: 18 }),
      ORIGINAL_PRICE: scaledStarterBounds(config, { left: 152, top: 73, width: 76, height: 18 }),
      MEMBER_PRICE: scaledStarterBounds(config, { left: 10, top: 48, width: 142, height: 46 }),
      DISCOUNT_BADGE: scaledStarterBounds(config, { left: 154, top: 42, width: 78, height: 30 }),
      DIVIDER_LINE: scaledStarterBounds(config, { left: 10, top: 86, width: 206, height: 1 }),
    };
    const base = presets[kind];
    if (!position) return base;

    return fitBoundsToCanvas(config, {
      ...base,
      left: position.left - base.width / 2,
      top: position.top - base.height / 2,
    });
  }

  async function addSnippet(kind: SnippetKind, position?: ToolPosition): Promise<void> {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const bounds = getSnippetBounds(core, kind, position);
    const starterText = getStarterText(config);

    if (kind === 'PRODUCT_TITLE') {
      addVisualObject(createStarterTextObject(config, bounds, {
        fallback: starterText.productTitle,
        fieldBinding: 'productName',
        fontSize: 15,
        fontWeight: 'bold',
      }));
    } else if (kind === 'SPEC_TEXT') {
      addVisualObject(createStarterTextObject(config, bounds, {
        fallback: starterText.specText,
        fieldBinding: config.previewData?.spec != null ? 'spec' : 'description',
        fontSize: 9,
        fontWeight: 'normal',
      }));
    } else if (kind === 'PROMO_TEXT') {
      addVisualObject(createStarterTextObject(config, bounds, {
        fallback: starterText.promoText,
        fieldBinding: config.previewData?.promoText != null ? 'promoText' : 'description',
        fontSize: 10,
        fontWeight: 'bold',
      }));
    } else if (kind === 'ORIGINAL_PRICE') {
      addVisualObject(createStarterPriceObject(config, bounds, 'originalPrice', 'secondary'));
    } else if (kind === 'MEMBER_PRICE') {
      addVisualObject(createStarterPriceObject(config, bounds, 'memberPrice', 'main'));
    } else if (kind === 'DISCOUNT_BADGE') {
      addVisualObject(createStarterDiscountObject(config, bounds));
    } else {
      const y = bounds.top;
      const line = new fabric.Line([bounds.left, y, bounds.left + bounds.width, y], {
        stroke: '#000000',
        strokeWidth: Math.max(1, bounds.height),
      });
      (line as any).extensionType = 'LINE';
      addVisualObject(line);
    }
  }

  async function addElement(kind: ToolKind, position?: ToolPosition): Promise<void> {
    if (kind === 'RECT') {
      addRect(position);
    } else if (kind === 'LINE') {
      addLine(position);
    } else if (kind === 'TEXT') {
      addText(position);
    } else if (kind === 'PRICE') {
      addPrice(position);
    } else if (kind === 'DISCOUNT') {
      addDiscount(position);
    } else if (kind === 'IMAGE_STATIC') {
      await addStaticImage(position);
    } else if (kind === 'IMAGE_DYNAMIC') {
      await addDynamicImage(position);
    } else if (kind === 'QRCODE') {
      addQrcode(position);
    } else if (kind === 'BARCODE') {
      addBarcode(position);
    }
  }

  function applyStarterTemplate(kind: StarterTemplateKind): void {
    const core = editor.value;
    if (!core) return;

    const config = core.bootConfig;
    const bounds = (left: number, top: number, width: number, height: number) =>
      scaledStarterBounds(config, { left, top, width, height });
    const starterText = getStarterText(config);

    if (kind === 'retail') {
      replaceCanvasObjects([
        createStarterTextObject(config, bounds(10, 10, 170, 22), {
          fallback: starterText.productName,
          fieldBinding: 'productName',
          fontSize: 15,
        }),
        createStarterPriceObject(config, bounds(10, 36, 128, 48)),
        createStarterDiscountObject(config, bounds(152, 42, 132, 36)),
        createStarterBarcodeObject(config, bounds(10, 94, 204, 25), false),
      ]);
    } else if (kind === 'barcode') {
      replaceCanvasObjects([
        createStarterTextObject(config, bounds(10, 12, 205, 22), {
          fallback: starterText.productName,
          fieldBinding: 'productName',
          fontSize: 15,
        }),
        createStarterBarcodeObject(config, bounds(10, 48, 190, 42), false),
        createStarterTextObject(config, bounds(10, 94, 190, 16), {
          fallback: String(config.previewData?.barcodeContent ?? starterText.barcodeFallback),
          fieldBinding: 'barcodeContent',
          fontSize: 9,
          fontWeight: 'normal',
          textAlign: 'center',
        }),
        createStarterQrcodeObject(config, bounds(225, 36, 58, 58)),
      ]);
    } else {
      replaceCanvasObjects([
        createStarterQrcodeObject(config, bounds(10, 28, 72, 72)),
        createStarterTextObject(config, bounds(96, 16, 180, 22), {
          fallback: starterText.qrHeadline,
          fieldBinding: 'productName',
          fontSize: 15,
        }),
        createStarterDiscountObject(config, bounds(96, 52, 128, 34)),
        createStarterTextObject(config, bounds(96, 92, 180, 18), {
          fallback: starterText.qrDescription,
          fieldBinding: 'description',
          fontSize: 10,
          fontWeight: 'normal',
        }),
      ]);
    }
  }

  async function updateObjectProp(key: string, value: unknown): Promise<void> {
    const obj = selectedObject.value;
    const core = editor.value;
    if (!obj || !core) return;
    let shouldRefreshVisual = false;
    let didRefreshVisual = false;

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
          if (extKey === 'source') {
            ext.fieldBinding = value === 'static' ? null : 'qrContent';
            ext.content ??= '';
          }
        }
        shouldRefreshVisual = true;
      } else if ((obj as any).extensionType === 'BARCODE' && key.startsWith('ext.')) {
        const extKey = key.slice(4);
        const ext = (obj as any).extension;
        if (ext) {
          ext[extKey] = value;
          if (extKey === 'source') {
            ext.fieldBinding = value === 'static' ? null : 'barcodeContent';
            ext.content ??= '';
          }
        }
        shouldRefreshVisual = true;
      } else if (
        isCompositeVisualType((obj as any).extensionType as string | undefined)
        && ['left', 'top', 'width', 'height'].includes(key)
      ) {
        const bounds = getObjectBounds(obj);
        if (key === 'left' || key === 'top') {
          bounds[key] = Number(value);
        } else if (key === 'width') {
          bounds.width = Math.max(1, Number(value));
        } else {
          bounds.height = Math.max(1, Number(value));
        }
        await refreshExtendedObjectWithBounds(obj, bounds);
        didRefreshVisual = true;
      } else {
        if (key === 'left' || key === 'top') {
          const rect = obj.getBoundingRect();
          const current = key === 'left' ? rect.left : rect.top;
          obj.set(key as any, Math.round(((obj as any)[key] ?? 0) + Number(value) - current));
        } else {
          obj.set(key as any, value);
        }
        shouldRefreshVisual = Boolean((obj as any).extensionType)
          && ['width', 'height', 'left', 'top'].includes(key);
      }

      obj.setCoords();
      if (didRefreshVisual) {
        core.fabricCanvas.renderAll();
      } else if (shouldRefreshVisual) {
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

  async function updateObjectPropsBatch(patches: Array<{ key: string; value: unknown }>): Promise<void> {
    const obj = selectedObject.value;
    const core = editor.value;
    if (!obj || !core || patches.length === 0) return;

    let shouldRefreshVisual = false;
    historySuppression++;
    try {
      for (const patch of patches) {
        if (patch.key.startsWith('ext.')) {
          const ext = (obj as any).extension;
          if (!ext) continue;
          const extKey = patch.key.slice(4);
          ext[extKey] = patch.value;
          if ((obj as any).extensionType === 'QRCODE' && extKey === 'source') {
            ext.fieldBinding = patch.value === 'static' ? null : 'qrContent';
            ext.content ??= '';
          }
          if ((obj as any).extensionType === 'BARCODE' && extKey === 'source') {
            ext.fieldBinding = patch.value === 'static' ? null : 'barcodeContent';
            ext.content ??= '';
          }
          shouldRefreshVisual = Boolean((obj as any).extensionType);
        } else {
          obj.set(patch.key as any, patch.value);
        }
      }

      if (shouldRefreshVisual) {
        await refreshExtendedObject(obj);
      } else {
        obj.setCoords();
        core.fabricCanvas.renderAll();
      }
    } finally {
      historySuppression--;
    }

    selectionVersion.value++;
    commitHistory();
  }

  function normalizePreviewDataValue(field: string, value: unknown): unknown {
    if (PRICE_BINDABLE_FIELDS.includes(field as PriceBindableField) || field === 'discount') {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : value;
    }
    return value;
  }

  function isPreviewFieldObject(obj: fabric.Object, field: string): boolean {
    const type = (obj as any).extensionType as string | undefined;
    const ext = (obj as any).extension as { fieldBinding?: string | null; source?: string } | undefined;

    if (type === 'TEXT') return ext?.fieldBinding === field;
    if (type === 'PRICE') return (ext?.fieldBinding ?? 'price') === field;
    if (type === 'DISCOUNT') return field === 'discount';
    if (type === 'IMAGE') return ext?.source === 'dynamic' && ext?.fieldBinding === field;
    if (type === 'QRCODE') return (ext?.source ?? 'dynamic') === 'dynamic' && (ext?.fieldBinding ?? 'qrContent') === field;
    if (type === 'BARCODE') return (ext?.source ?? 'dynamic') === 'dynamic' && (ext?.fieldBinding ?? 'barcodeContent') === field;
    return false;
  }

  async function updatePreviewDataField(field: string, value: unknown): Promise<void> {
    const core = editor.value;
    if (!core || !field) return;

    const previewData = (core.bootConfig.previewData ??= {} as PreviewData);
    previewData[field] = normalizePreviewDataValue(field, value);

    historySuppression++;
    try {
      const objects = getCanvasDrawableObjects(core).filter((obj) => isPreviewFieldObject(obj, field));
      for (const obj of objects) {
        if ((obj as any).extensionType === 'TEXT') {
          updateDynamicText(obj);
          obj.setCoords();
        } else {
          await refreshExtendedObject(obj);
        }
      }
      core.fabricCanvas.requestRenderAll();
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

  async function resizeCanvas(width: number, height: number, scaleObjects = true): Promise<void> {
    const core = editor.value;
    if (!core) return;

    const nextWidth = clampNumber(roundNumber(width), 16, 4096);
    const nextHeight = clampNumber(roundNumber(height), 16, 4096);
    const oldWidth = core.bootConfig.canvas.width;
    const oldHeight = core.bootConfig.canvas.height;
    if (nextWidth === oldWidth && nextHeight === oldHeight) return;

    const scaleX = nextWidth / oldWidth;
    const scaleY = nextHeight / oldHeight;
    const textScale = Math.min(scaleX, scaleY);
    const selectedIds = getActiveDrawableObjects(core)
      .map(ensureObjectId)
      .filter((id): id is string => Boolean(id));

    historySuppression++;
    try {
      core.fabricCanvas.discardActiveObject();
      core.resizeCanvas(nextWidth, nextHeight);
      ensureWorkspace(core);

      const objects = getCanvasDrawableObjects(core);
      if (scaleObjects) {
        for (const obj of objects) {
          const type = getObjectType(obj);
          if (isCompositeVisualType(type)) {
            const bounds = getObjectBounds(obj);
            await refreshExtendedObjectWithBounds(obj, {
              left: bounds.left * scaleX,
              top: bounds.top * scaleY,
              width: bounds.width * scaleX,
              height: bounds.height * scaleY,
            });
            continue;
          }

          if (obj instanceof fabric.Textbox) {
            obj.set({
              left: Math.round((obj.left ?? 0) * scaleX),
              top: Math.round((obj.top ?? 0) * scaleY),
              width: Math.max(1, Math.round((obj.width ?? obj.getScaledWidth() ?? 1) * scaleX)),
              fontSize: Math.max(6, Math.round((obj.fontSize ?? 16) * textScale)),
            } as any);
          } else if (type === 'LINE') {
            obj.set({
              left: Math.round((obj.left ?? 0) * scaleX),
              top: Math.round((obj.top ?? 0) * scaleY),
              scaleX: (obj.scaleX ?? 1) * scaleX,
              scaleY: (obj.scaleY ?? 1) * scaleY,
              strokeWidth: Math.max(1, Math.round((obj.strokeWidth ?? 1) * textScale)),
            } as any);
          } else {
            const bounds = getObjectBounds(obj);
            obj.set({
              left: Math.round(bounds.left * scaleX),
              top: Math.round(bounds.top * scaleY),
              width: Math.max(1, Math.round(bounds.width * scaleX)),
              height: Math.max(1, Math.round(bounds.height * scaleY)),
              scaleX: 1,
              scaleY: 1,
            } as any);
            if (typeof obj.strokeWidth === 'number') {
              obj.set('strokeWidth' as any, Math.max(0, Math.round(obj.strokeWidth * textScale)));
            }
          }
          clampObjectToCanvas(core, obj);
          prepareEditableObject(obj);
          obj.setCoords();
        }
      } else {
        objects.forEach((obj) => {
          clampObjectToCanvas(core, obj);
          obj.setCoords();
        });
      }

      const objectsById = new Map(
        getCanvasDrawableObjects(core).map((obj) => [(obj as any).id, obj] as const)
      );
      selectObjects(
        core,
        selectedIds.map((id) => objectsById.get(id)).filter((obj): obj is fabric.Object => Boolean(obj))
      );
      core.fabricCanvas.renderAll();
    } finally {
      historySuppression--;
    }

    selectionVersion.value++;
    commitHistory();
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
        prepareEditableObject(obj);
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

  function selectObjectById(id: string): void {
    const core = editor.value;
    if (!core) return;
    const obj = getCanvasDrawableObjects(core).find((item) => (item as any).id === id);
    if (!obj) return;
    selectObjects(core, [obj]);
  }

  function moveLayerTo(sourceId: string, targetId: string): void {
    const core = editor.value;
    if (!core || sourceId === targetId) return;

    const drawableObjects = getCanvasDrawableObjects(core);
    const source = drawableObjects.find((obj) => (obj as any).id === sourceId);
    const target = drawableObjects.find((obj) => (obj as any).id === targetId);
    if (!source || !target || source === target) return;

    const targetDrawableIndex = drawableObjects.indexOf(target);
    runHistoryMutation(() => {
      discardActiveSelectionForMutation(core, [source]);
      core.fabricCanvas.moveObjectTo(source, targetDrawableIndex + 1);
      selectObjects(core, [source]);
      core.fabricCanvas.renderAll();
    });
  }

  async function exportCurrentTemplate(): Promise<FabricJSON> {
    const core = editor.value;
    if (!core) throw new Error('Editor not initialized');
    return core.exportJSON();
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
      throw new SaveNetworkError(err?.message ?? translate('errors.networkRequest'));
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

  function isDynamicExportObject(obj: fabric.Object): boolean {
    const extType = (obj as any).extensionType as string | undefined;
    const ext = (obj as any).extension as { fieldBinding?: string | null; source?: string | null } | undefined;

    if (extType === 'TEXT') return Boolean(ext?.fieldBinding);
    if (extType === 'PRICE' || extType === 'DISCOUNT') return true;
    if (extType === 'IMAGE') return ext?.source === 'dynamic';
    if (extType === 'QRCODE' || extType === 'BARCODE') return (ext?.source ?? 'dynamic') === 'dynamic';
    return false;
  }

  async function exportStaticImage(core: EditorCore): Promise<string> {
    const canvas = core.fabricCanvas;
    const dynamicObjects = canvas.getObjects().filter(isDynamicExportObject);
    const visibilityState = dynamicObjects.map((obj) => ({ obj, visible: obj.visible }));
    const activeObjects = canvas.getActiveObjects();

    canvas.discardActiveObject();
    dynamicObjects.forEach((obj) => obj.set('visible', false));
    canvas.renderAll();

    const exportPlugin = core.getPlugin<EinkExportPlugin>('EinkExportPlugin');
    try {
      if (!exportPlugin) {
        return core.fabricCanvas.toDataURL({ format: 'png' as const, multiplier: 1 });
      }
      const blob = await exportPlugin.exportDitheredImage('png');
      return blobToDataURL(blob);
    } finally {
      visibilityState.forEach(({ obj, visible }) => obj.set('visible', visible));
      selectObjects(core, activeObjects);
      canvas.renderAll();
    }
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

      const payload = buildSavePayload(core.bootConfig, fabricJson, canvasDataURL, {
        exportMode: saveExportMode.value,
      });
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
      saveError.value = err?.message ?? translate('editor.unknownError');
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
    saveExportMode,
    canUndo,
    canRedo,
    hasClipboard,
    hasActiveSelection,
    isActiveSelectionLocked,
    drawableObjectCount,
    layerEntries,
    selectionVersion,
    initEditor,
    loadTemplate,
    getPalette,
    setSaveExportMode,
    addRect,
    addLine,
    addText,
    addCustomDataText,
    addPrice,
    addStaticImage,
    addDynamicImage,
    addDiscount,
    addQrcode,
    addBarcode,
    addElement,
    addSnippet,
    applyStarterTemplate,
    changeScreenColorMode,
    applyRegionalPreferences,
    applyRecognizedPriceTagTemplate,
    clearCanvasObjects,
    resizeCanvas,
    updateObjectProp,
    updateObjectPropsBatch,
    updatePreviewDataField,
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
    selectObjectById,
    moveLayerTo,
    exportCurrentTemplate,
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
