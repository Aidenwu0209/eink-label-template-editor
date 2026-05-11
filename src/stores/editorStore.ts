import { defineStore } from 'pinia';
import { shallowRef, ref } from 'vue';
import { fabric } from 'fabric';
import { EditorCore } from '@/core/EditorCore';
import { EinkColorPlugin } from '@/plugins/eink/EinkColorPlugin';
import { EinkRenderPlugin } from '@/plugins/eink/EinkRenderPlugin';
import { EinkExportPlugin } from '@/plugins/eink/EinkExportPlugin';
import type { BootConfig } from '@/boot/types';
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

export const useEditorStore = defineStore('editor', () => {
  const editor = shallowRef<EditorCore | null>(null);
  const isReady = ref(false);
  const selectedObject = shallowRef<fabric.Object | null>(null);
  const savePayload = ref<SavePayload | null>(null);
  const isSaving = ref(false);

  function initEditor(el: HTMLCanvasElement, config: BootConfig) {
    const core = new EditorCore(el, config);
    core
      .use(EinkColorPlugin)
      .use(EinkRenderPlugin)
      .use(EinkExportPlugin);

    // Bind selection events
    core.events.on('object:selected', (objects) => {
      selectedObject.value = objects.length === 1 ? objects[0] : null;
    });
    core.events.on('object:deselected', () => {
      selectedObject.value = null;
    });

    editor.value = core;
    isReady.value = true;
  }

  function getPalette(): ColorEntry[] {
    return editor.value?.bootConfig.screen.profile.palette.slice() ?? [];
  }

  function addVisualObject(obj: fabric.Object): void {
    const core = editor.value;
    if (!core) return;
    core.fabricCanvas.add(obj);
    core.fabricCanvas.setActiveObject(obj);
    selectedObject.value = obj;
    core.fabricCanvas.renderAll();
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

  function replaceObject(oldObj: fabric.Object, nextObj: fabric.Object): void {
    const core = editor.value;
    if (!core) return;
    const index = core.fabricCanvas.getObjects().indexOf(oldObj);
    core.fabricCanvas.remove(oldObj);
    core.fabricCanvas.insertAt(nextObj, Math.max(index, 0), false);
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

  function updateObjectProp(key: string, value: unknown): void {
    const obj = selectedObject.value;
    const core = editor.value;
    if (!obj || !core) return;
    let shouldRefreshVisual = false;

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
      void refreshExtendedObject(obj);
    } else {
      core.fabricCanvas.renderAll();
    }
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
  }

  return {
    editor,
    isReady,
    selectedObject,
    savePayload,
    isSaving,
    saveError,
    initEditor,
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
