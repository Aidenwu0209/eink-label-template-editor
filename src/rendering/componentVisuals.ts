import * as fabric from 'fabric';
import QRCode from 'qrcode';
import type { BootConfig } from '@/boot/types';
import type {
  BarcodeExtension,
  ComponentWarning,
  DiscountExtension,
  ImageExtension,
  PriceExtension,
  QrcodeExtension,
} from '@/stores/editorStore';

export interface VisualBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MIN_QR_MODULE_PIXELS = 2;
const MIN_BARCODE_MODULE_PIXELS = 1.5;
const LONG_BARCODE_CONTENT_LENGTH = 32;

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
] as const;

export function formatPrice(value: unknown, ext: PriceExtension): {
  currency: string;
  integer: string;
  decimal: string;
} {
  const n = Number(value ?? 0);
  const fixed = Number.isFinite(n) ? n.toFixed(ext.decimalPlaces) : (0).toFixed(ext.decimalPlaces);
  const [integerRaw, decimalRaw = ''] = fixed.split('.');
  const integer = ext.thousandSeparator
    ? integerRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ext.thousandSeparator)
    : integerRaw;
  return {
    currency: ext.showCurrency ? ext.currencySymbol : '',
    integer,
    decimal: ext.decimalPlaces > 0 ? `${ext.decimalSeparator}${decimalRaw}` : '',
  };
}

export function createPriceVisual(
  config: BootConfig,
  bounds: VisualBounds,
  ext: PriceExtension
): fabric.Group {
  const value = formatPrice(config.previewData?.price, ext);
  const baseline = Math.max(2, Math.round((bounds.height - ext.integerStyle.fontSize) / 2));
  const parts: fabric.Object[] = [
    new fabric.Rect({
      left: 0,
      top: 0,
      width: bounds.width,
      height: bounds.height,
      fill: 'rgba(255,255,255,0)',
      strokeWidth: 0,
      selectable: false,
      evented: false,
    }),
  ];

  let x = 0;
  if (value.currency) {
    const currency = new fabric.Text(value.currency, {
      left: x,
      top: baseline + Math.max(0, ext.integerStyle.fontSize - ext.currencyStyle.fontSize),
      fontFamily: 'AlibabaPuHuiTi',
      fontSize: ext.currencyStyle.fontSize,
      fontWeight: ext.currencyStyle.fontWeight,
      fill: ext.currencyStyle.color,
      selectable: false,
      evented: false,
    });
    parts.push(currency);
    x += currency.width ?? ext.currencyStyle.fontSize;
  }

  const integer = new fabric.Text(value.integer, {
    left: x,
    top: baseline,
    fontFamily: 'AlibabaPuHuiTi',
    fontSize: ext.integerStyle.fontSize,
    fontWeight: ext.integerStyle.fontWeight,
    fill: ext.integerStyle.color,
    selectable: false,
    evented: false,
  });
  parts.push(integer);
  x += integer.width ?? ext.integerStyle.fontSize * value.integer.length;

  if (value.decimal) {
    parts.push(new fabric.Text(value.decimal, {
      left: x,
      top: baseline + ext.decimalStyle.offsetY + Math.max(0, ext.integerStyle.fontSize - ext.decimalStyle.fontSize),
      fontFamily: 'AlibabaPuHuiTi',
      fontSize: ext.decimalStyle.fontSize,
      fontWeight: ext.decimalStyle.fontWeight,
      fill: ext.decimalStyle.color,
      selectable: false,
      evented: false,
    }));
  }

  return withExtension(createBoundedGroup(parts, bounds), 'PRICE', ext);
}

export function createDiscountVisual(bounds: VisualBounds, value: unknown, ext: DiscountExtension): fabric.Group {
  const text = ext.formatTemplate.replace('{value}', value == null ? '' : String(value));
  const textObj = new fabric.Textbox(text, {
    left: 4,
    top: verticalTextTop(bounds.height, ext.fontSize, ext.verticalAlign),
    width: Math.max(0, bounds.width - 8),
    fontFamily: 'AlibabaPuHuiTi',
    fontSize: ext.fontSize,
    fontWeight: ext.fontWeight,
    fill: ext.textColor,
    textAlign: ext.textAlign,
    selectable: false,
    evented: false,
  });

  return withExtension(createBoundedGroup([
    new fabric.Rect({
      left: 0,
      top: 0,
      width: bounds.width,
      height: bounds.height,
      fill: ext.backgroundColor,
      stroke: ext.textColor,
      strokeWidth: ext.backgroundColor === ext.textColor ? 0 : 1,
      rx: Math.min(4, Math.max(0, bounds.height / 5)),
      ry: Math.min(4, Math.max(0, bounds.height / 5)),
      selectable: false,
      evented: false,
    }),
    textObj,
  ], bounds), 'DISCOUNT', ext);
}

export async function createImageVisual(bounds: VisualBounds, ext: ImageExtension): Promise<fabric.Group> {
  const objects: fabric.Object[] = [
    new fabric.Rect({
      left: 0,
      top: 0,
      width: bounds.width,
      height: bounds.height,
      fill: ext.backgroundColor,
      stroke: '#000000',
      strokeWidth: 1,
      selectable: false,
      evented: false,
    }),
  ];
  let loadStatus: ImageExtension['loadStatus'] = ext.src ? 'error' : 'empty';
  let loadError: string | null = null;

  if (ext.src) {
    const image = await loadFabricImage(ext.src).catch(() => {
      loadError = '图片加载失败，请检查图片地址或文件内容';
      return null;
    });
    if (image) {
      fitImage(image, bounds, ext.fitMode);
      objects.push(image);
      loadStatus = 'loaded';
    } else {
      addImagePlaceholder(objects, bounds, '图片加载失败', '请检查地址或重新上传');
    }
  }

  if (objects.length === 1) {
    addImagePlaceholder(
      objects,
      bounds,
      ext.source === 'dynamic' ? 'imageUrl 为空' : '未选择图片',
      ext.source === 'dynamic' ? '等待动态图片地址' : '上传或输入图片地址'
    );
  }

  return withExtension(createBoundedGroup(objects, bounds), 'IMAGE', {
    ...ext,
    loadStatus,
    loadError,
  });
}

export function createQrcodeVisual(bounds: VisualBounds, content: unknown, ext: QrcodeExtension): fabric.Group {
  const value = String(content ?? '');
  const qr = QRCode.create(value || ' ', { errorCorrectionLevel: ext.errorCorrection });
  const margin = Math.max(0, Math.round(ext.margin));
  const totalModules = qr.modules.size + margin * 2;
  const cell = Math.max(1, Math.floor(Math.min(bounds.width, bounds.height) / totalModules));
  const qrSize = totalModules * cell;
  const offsetX = Math.round((bounds.width - qrSize) / 2);
  const offsetY = Math.round((bounds.height - qrSize) / 2);
  const objects: fabric.Object[] = [
    new fabric.Rect({
      left: 0,
      top: 0,
      width: bounds.width,
      height: bounds.height,
      fill: ext.backgroundColor,
      strokeWidth: 0,
      selectable: false,
      evented: false,
    }),
  ];

  for (let y = 0; y < qr.modules.size; y++) {
    for (let x = 0; x < qr.modules.size; x++) {
      if (!qr.modules.get(x, y)) continue;
      objects.push(new fabric.Rect({
        left: offsetX + (x + margin) * cell,
        top: offsetY + (y + margin) * cell,
        width: cell,
        height: cell,
        fill: ext.foregroundColor,
        strokeWidth: 0,
        selectable: false,
        evented: false,
      }));
    }
  }

  return withExtension(createBoundedGroup(objects, bounds), 'QRCODE', {
    ...ext,
    readabilityWarnings: getQrcodeReadabilityWarnings(bounds, content, ext),
  });
}

export function createBarcodeVisual(bounds: VisualBounds, content: unknown, ext: BarcodeExtension): fabric.Group {
  const rawValue = String(content ?? '');
  const value = sanitizeCode128(rawValue);
  const pattern = encodeCode128B(value || ' ');
  const textHeight = ext.showText ? 12 : 0;
  const barHeight = Math.max(1, bounds.height - textHeight);
  const objects: fabric.Object[] = [
    new fabric.Rect({
      left: 0,
      top: 0,
      width: bounds.width,
      height: bounds.height,
      fill: ext.backgroundColor,
      strokeWidth: 0,
      selectable: false,
      evented: false,
    }),
  ];

  objects.push(createBarcodeImage(pattern, bounds.width, barHeight, ext));

  if (ext.showText) {
    objects.push(new fabric.Text(value, {
      left: bounds.width / 2,
      top: barHeight,
      originX: 'center',
      fontFamily: 'AlibabaPuHuiTi',
      fontSize: 10,
      fill: ext.foregroundColor,
      textAlign: 'center',
      selectable: false,
      evented: false,
    }));
  }

  return withExtension(createBoundedGroup(objects, bounds), 'BARCODE', {
    ...ext,
    readabilityWarnings: getBarcodeReadabilityWarnings(bounds, rawValue),
  });
}

export function getQrcodeReadabilityWarnings(
  bounds: VisualBounds,
  content: unknown,
  ext: QrcodeExtension
): ComponentWarning[] {
  const value = String(content ?? '');
  const qr = QRCode.create(value || ' ', { errorCorrectionLevel: ext.errorCorrection });
  const margin = Math.max(0, Math.round(ext.margin));
  const totalModules = qr.modules.size + margin * 2;
  const minSide = Math.min(bounds.width, bounds.height);
  const modulePixels = minSide / totalModules;

  if (modulePixels >= MIN_QR_MODULE_PIXELS) return [];

  const recommendedSize = Math.ceil(totalModules * MIN_QR_MODULE_PIXELS);
  return [{
    code: 'qrcode-too-small',
    severity: 'warning',
    message: `二维码偏小：当前每格约 ${modulePixels.toFixed(1)}px，建议尺寸至少 ${recommendedSize}×${recommendedSize}px。`,
  }];
}

export function getBarcodeReadabilityWarnings(
  bounds: VisualBounds,
  content: unknown
): ComponentWarning[] {
  const rawValue = String(content ?? '');
  const value = sanitizeCode128(rawValue);
  const encodedValue = value || ' ';
  const pattern = encodeCode128B(encodedValue);
  const totalModules = pattern.reduce((sum, n) => sum + n, 0);
  const modulePixels = bounds.width / totalModules;
  const warnings: ComponentWarning[] = [];

  if (modulePixels < MIN_BARCODE_MODULE_PIXELS) {
    warnings.push({
      code: 'barcode-too-narrow',
      severity: 'warning',
      message: `条码宽度偏窄：当前最细条约 ${modulePixels.toFixed(1)}px，建议宽度至少 ${Math.ceil(totalModules * MIN_BARCODE_MODULE_PIXELS)}px。`,
    });
  }

  if (value.length > LONG_BARCODE_CONTENT_LENGTH || rawValue.length > LONG_BARCODE_CONTENT_LENGTH) {
    warnings.push({
      code: 'barcode-content-too-long',
      severity: 'warning',
      message: `条码内容较长：当前 ${rawValue.length} 字符，建议不超过 ${LONG_BARCODE_CONTENT_LENGTH} 字符或继续加宽。`,
    });
  }

  return warnings;
}

function withExtension<T extends fabric.Object>(obj: T, type: string, extension: unknown): T {
  (obj as any).extensionType = type;
  (obj as any).extension = structuredClone(extension);
  return obj;
}

function groupBounds(bounds: VisualBounds): Partial<fabric.GroupProps> {
  return {
    ...bounds,
    originX: 'left',
    originY: 'top',
  };
}

function createBoundedGroup(objects: fabric.Object[], bounds: VisualBounds): fabric.Group {
  const group = new fabric.Group(objects, groupBounds(bounds));
  group.set({
    ...groupBounds(bounds),
    width: bounds.width,
    height: bounds.height,
  } as any);
  return group;
}

function verticalTextTop(height: number, fontSize: number, align: DiscountExtension['verticalAlign']): number {
  if (align === 'middle') return Math.max(0, (height - fontSize * 1.2) / 2);
  if (align === 'bottom') return Math.max(0, height - fontSize * 1.2 - 2);
  return 2;
}

function loadFabricImage(src: string): Promise<fabric.FabricImage> {
  return fabric.FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
}

function addImagePlaceholder(
  objects: fabric.Object[],
  bounds: VisualBounds,
  title: string,
  subtitle: string
): void {
  const top = Math.max(2, bounds.height / 2 - 14);
  objects.push(new fabric.Textbox(title, {
    left: 4,
    top,
    width: Math.max(1, bounds.width - 8),
    fontFamily: 'AlibabaPuHuiTi',
    fontSize: 10,
    fontWeight: 'bold',
    fill: '#000000',
    textAlign: 'center',
    selectable: false,
    evented: false,
  }));
  objects.push(new fabric.Textbox(subtitle, {
    left: 4,
    top: top + 13,
    width: Math.max(1, bounds.width - 8),
    fontFamily: 'AlibabaPuHuiTi',
    fontSize: 8,
    fill: '#000000',
    textAlign: 'center',
    selectable: false,
    evented: false,
  }));
}

function fitImage(image: fabric.FabricImage, bounds: VisualBounds, fitMode: ImageExtension['fitMode']): void {
  const iw = image.width || 1;
  const ih = image.height || 1;
  const sx = bounds.width / iw;
  const sy = bounds.height / ih;
  const scale = fitMode === 'fill' ? 1 : fitMode === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  image.set({
    left: fitMode === 'fill' ? 0 : (bounds.width - iw * scale) / 2,
    top: fitMode === 'fill' ? 0 : (bounds.height - ih * scale) / 2,
    scaleX: fitMode === 'fill' ? sx : scale,
    scaleY: fitMode === 'fill' ? sy : scale,
    selectable: false,
    evented: false,
  });
}

function createBarcodeImage(
  pattern: number[],
  width: number,
  height: number,
  ext: BarcodeExtension
): fabric.FabricImage {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = ext.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = ext.foregroundColor;

  const totalModules = pattern.reduce((sum, n) => sum + n, 0);
  let cursor = 0;
  pattern.forEach((moduleCount, index) => {
    const next = cursor + moduleCount;
    if (index % 2 === 0) {
      const start = Math.floor((cursor / totalModules) * canvas.width);
      const end = Math.ceil((next / totalModules) * canvas.width);
      ctx.fillRect(start, 0, Math.max(1, end - start), canvas.height);
    }
    cursor = next;
  });

  return new fabric.FabricImage(canvas, {
    left: 0,
    top: 0,
    selectable: false,
    evented: false,
  });
}

function sanitizeCode128(value: string): string {
  return value.replace(/[^\x20-\x7f]/g, '').slice(0, 80);
}

function encodeCode128B(value: string): number[] {
  const codes = [104, ...Array.from(value, (ch) => ch.charCodeAt(0) - 32)];
  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) checksum += codes[i] * i;
  codes.push(checksum % 103, 106);
  return codes.flatMap((code) => CODE128_PATTERNS[code].split('').map(Number));
}
