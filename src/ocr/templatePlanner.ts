import type { BootConfig } from '@/boot/types';
import type { OcrLineItem, OcrLineRole, RecognizedPriceTag } from './types';
import { translate } from '@/i18n';

export type SmartTemplateKind = 'auto' | 'restore' | 'standard' | 'promotion' | 'member' | 'barcode' | 'qr';
export type PriceTemplateField = 'price' | 'originalPrice' | 'memberPrice';

export interface TemplateBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface TemplateElementPlanBase {
  sourceItemIds?: string[];
  warnings?: string[];
}

export type TemplateElementPlan =
  | ({
      type: 'TEXT';
      bounds: TemplateBounds;
      fieldBinding: string | null;
      fallback: string;
      fontSize: number;
      fontWeight?: 'normal' | 'bold';
      fill?: string;
      textAlign?: 'left' | 'center' | 'right';
      lineClamp?: number;
    } & TemplateElementPlanBase)
  | ({
      type: 'PRICE';
      bounds: TemplateBounds;
      fieldBinding: PriceTemplateField;
      variant: 'main' | 'secondary';
    } & TemplateElementPlanBase)
  | ({
      type: 'DISCOUNT';
      bounds: TemplateBounds;
    } & TemplateElementPlanBase)
  | ({
      type: 'BARCODE';
      bounds: TemplateBounds;
      showText: boolean;
    } & TemplateElementPlanBase)
  | ({
      type: 'QRCODE';
      bounds: TemplateBounds;
    } & TemplateElementPlanBase)
  | ({
      type: 'LINE';
      bounds: TemplateBounds;
    } & TemplateElementPlanBase);

export interface PriceTagTemplatePlan {
  kind: Exclude<SmartTemplateKind, 'auto'>;
  elements: TemplateElementPlan[];
}

const PRESET_WIDTH = 296;
const PRESET_HEIGHT = 128;

export function createPriceTagTemplatePlan(
  config: BootConfig,
  tag: RecognizedPriceTag,
  preferred: SmartTemplateKind = 'auto'
): PriceTagTemplatePlan {
  const kind = preferred === 'auto' ? selectSmartTemplateKind(tag) : preferred;
  const ctx = createPlanContext(config);

  if (kind === 'restore') {
    return {
      kind,
      elements: withOptionalCodes(ctx, tag, restorePlan(ctx, tag)),
    };
  }

  const fixedElements = kind === 'member'
    ? memberPlan(ctx, tag)
    : kind === 'promotion'
      ? promotionPlan(ctx, tag)
      : kind === 'barcode'
        ? barcodePlan(ctx, tag)
        : kind === 'qr'
          ? qrPlan(ctx, tag)
          : standardPlan(ctx, tag);

  return {
    kind,
    elements: appendUnusedLineItems(ctx, tag, withOptionalCodes(ctx, tag, fixedElements)),
  };
}

export function selectSmartTemplateKind(tag: RecognizedPriceTag): Exclude<SmartTemplateKind, 'auto'> {
  if (tag.fields.memberPrice != null) return 'member';
  if (tag.fields.discount != null || tag.fields.originalPrice != null || tag.fields.promoText) return 'promotion';
  if (tag.codes.barcodeContent) return 'barcode';
  if (tag.codes.qrContent) return 'qr';
  return 'standard';
}

function restorePlan(ctx: PlanContext, tag: RecognizedPriceTag): TemplateElementPlan[] {
  return compact(
    getTemplateLineItems(tag)
      .filter((line) => line.includeInTemplate !== false)
      .map((line) => restoreLinePlan(ctx, tag, line))
  );
}

function restoreLinePlan(
  ctx: PlanContext,
  tag: RecognizedPriceTag,
  line: OcrLineItem,
  forceText = false
): TemplateElementPlan | null {
  if (!line.text.trim()) return null;
  const sourceItemIds = [line.id];
  const lineBounds = ocrLineBounds(ctx, tag, line);

  if (!forceText && isPriceRole(line.role) && tag.fields[line.role] != null) {
    return priceElement(
      lineBounds,
      line.role,
      line.role === 'price' ? 'main' : 'secondary',
      sourceItemIds,
      line.warnings
    );
  }

  if (!forceText && line.role === 'barcodeContent' && (tag.codes.barcodeContent || line.text)) {
    return barcodeElement(expandBarcodeBounds(ctx, lineBounds), true, sourceItemIds, line.warnings);
  }

  if (!forceText && line.role === 'qrContent' && (tag.codes.qrContent || line.text)) {
    return qrElement(squareBounds(ctx, lineBounds), sourceItemIds, line.warnings);
  }

  return textElement(lineBounds, {
    fieldBinding: getRestoredTextBinding(tag, line),
    fallback: line.text,
    fontSize: estimateLineFontSize(lineBounds, line.role),
    fontWeight: isEmphasisTextRole(line.role) ? 'bold' : 'normal',
    fill: line.role === 'promoText' ? ctx.accent : '#000000',
    lineClamp: lineBounds.height > 24 ? 2 : 1,
    sourceItemIds,
    warnings: line.warnings,
  });
}

function appendUnusedLineItems(
  ctx: PlanContext,
  tag: RecognizedPriceTag,
  elements: TemplateElementPlan[]
): TemplateElementPlan[] {
  const lineItems = getTemplateLineItems(tag);
  if (!lineItems.length) return elements;

  const usedIds = new Set(elements.flatMap((element) => element.sourceItemIds ?? []));
  const extraElements = compact(
    lineItems
      .filter((line) => line.includeInTemplate !== false && !usedIds.has(line.id))
      .map((line) => restoreLinePlan(ctx, tag, line, true))
  );
  return [...elements, ...extraElements];
}

function standardPlan(ctx: PlanContext, tag: RecognizedPriceTag): TemplateElementPlan[] {
  return compact([
    text(ctx, 10, 10, 174, 22, 'productName', tag.fields.productName, 15, 'bold', '#000000', 'left', sourceIdsForField(tag, 'productName')),
    tag.fields.spec
      ? text(ctx, 10, 33, 134, 16, 'spec', tag.fields.spec, 9, 'normal', '#000000', 'left', sourceIdsForField(tag, 'spec'))
      : text(ctx, 10, 33, 134, 16, 'description', tag.fields.description, 9, 'normal', '#000000', 'left', sourceIdsForField(tag, 'description')),
    price(ctx, 10, 48, 142, 46, 'price', 'main', sourceIdsForField(tag, 'price')),
  ]);
}

function promotionPlan(ctx: PlanContext, tag: RecognizedPriceTag): TemplateElementPlan[] {
  return compact([
    text(ctx, 10, 9, 176, 20, 'productName', tag.fields.productName, 14, 'bold', '#000000', 'left', sourceIdsForField(tag, 'productName')),
    price(ctx, 10, 36, 136, 48, 'price', 'main', sourceIdsForField(tag, 'price')),
    tag.fields.originalPrice != null ? price(ctx, 156, 71, 78, 19, 'originalPrice', 'secondary', sourceIdsForField(tag, 'originalPrice')) : null,
    tag.fields.discount != null ? discount(ctx, 154, 34, 74, 30, sourceIdsForField(tag, 'discount')) : null,
    text(ctx, 10, 90, 184, 16, 'promoText', tag.fields.promoText ?? tag.fields.description, 9, 'bold', '#000000', 'left', sourceIdsForField(tag, tag.fields.promoText ? 'promoText' : 'description')),
  ]);
}

function memberPlan(ctx: PlanContext, tag: RecognizedPriceTag): TemplateElementPlan[] {
  return compact([
    text(ctx, 10, 9, 176, 20, 'productName', tag.fields.productName, 14, 'bold', '#000000', 'left', sourceIdsForField(tag, 'productName')),
    text(ctx, 10, 33, 58, 15, null, translate('starter.memberLabel'), 9, 'bold', ctx.accent),
    price(ctx, 10, 47, 142, 46, 'memberPrice', 'main', sourceIdsForField(tag, 'memberPrice')),
    tag.fields.price != null ? price(ctx, 158, 72, 70, 18, 'price', 'secondary', sourceIdsForField(tag, 'price')) : null,
    text(ctx, 10, 94, 180, 15, 'promoText', tag.fields.promoText ?? tag.fields.spec, 9, 'normal', '#000000', 'left', sourceIdsForField(tag, tag.fields.promoText ? 'promoText' : 'spec')),
  ]);
}

function barcodePlan(ctx: PlanContext, tag: RecognizedPriceTag): TemplateElementPlan[] {
  return compact([
    text(ctx, 10, 9, 184, 20, 'productName', tag.fields.productName, 14, 'bold', '#000000', 'left', sourceIdsForField(tag, 'productName')),
    price(ctx, 10, 34, 128, 38, tag.fields.memberPrice != null ? 'memberPrice' : 'price', 'main', sourceIdsForField(tag, tag.fields.memberPrice != null ? 'memberPrice' : 'price')),
    text(ctx, 144, 39, 72, 14, 'spec', tag.fields.spec, 8, 'normal', '#000000', 'left', sourceIdsForField(tag, 'spec')),
    barcode(ctx, 10, 82, 206, 34, false, sourceIdsForField(tag, 'barcodeContent')),
  ]);
}

function qrPlan(ctx: PlanContext, tag: RecognizedPriceTag): TemplateElementPlan[] {
  return compact([
    qr(ctx, 10, 25, 72, 72, sourceIdsForField(tag, 'qrContent')),
    text(ctx, 94, 14, 184, 22, 'productName', tag.fields.productName, 14, 'bold', '#000000', 'left', sourceIdsForField(tag, 'productName')),
    price(ctx, 94, 43, 132, 38, tag.fields.memberPrice != null ? 'memberPrice' : 'price', 'main', sourceIdsForField(tag, tag.fields.memberPrice != null ? 'memberPrice' : 'price')),
    text(ctx, 94, 85, 184, 18, 'promoText', tag.fields.promoText ?? tag.fields.description, 9, 'normal', '#000000', 'left', sourceIdsForField(tag, tag.fields.promoText ? 'promoText' : 'description')),
  ]);
}

function withOptionalCodes(
  ctx: PlanContext,
  tag: RecognizedPriceTag,
  elements: TemplateElementPlan[]
): TemplateElementPlan[] {
  const hasBarcode = elements.some((item) => item.type === 'BARCODE');
  const hasQr = elements.some((item) => item.type === 'QRCODE');
  const next = [...elements];

  if (tag.codes.barcodeContent && !hasBarcode) {
    next.push(barcode(ctx, 10, 103, 184, 20, false, sourceIdsForField(tag, 'barcodeContent')));
  }

  if (tag.codes.qrContent && !hasQr) {
    next.push(qr(ctx, 234, 62, 50, 50, sourceIdsForField(tag, 'qrContent')));
  }

  return next;
}

interface PlanContext {
  config: BootConfig;
  accent: string;
}

function createPlanContext(config: BootConfig): PlanContext {
  return {
    config,
    accent: getAccentColor(config),
  };
}

function bounds(ctx: PlanContext, left: number, top: number, width: number, height: number): TemplateBounds {
  const widthScale = ctx.config.canvas.width / PRESET_WIDTH;
  const heightScale = ctx.config.canvas.height / PRESET_HEIGHT;
  const canvasWidth = ctx.config.canvas.width;
  const canvasHeight = ctx.config.canvas.height;
  const scaled = {
    left: Math.round(left * widthScale),
    top: Math.round(top * heightScale),
    width: Math.round(width * widthScale),
    height: Math.round(height * heightScale),
  };
  scaled.width = Math.max(1, Math.min(scaled.width, canvasWidth));
  scaled.height = Math.max(1, Math.min(scaled.height, canvasHeight));
  scaled.left = Math.max(0, Math.min(scaled.left, canvasWidth - scaled.width));
  scaled.top = Math.max(0, Math.min(scaled.top, canvasHeight - scaled.height));
  return scaled;
}

function text(
  ctx: PlanContext,
  left: number,
  top: number,
  width: number,
  height: number,
  fieldBinding: string | null,
  fallback: unknown,
  fontSize: number,
  fontWeight: 'normal' | 'bold',
  fill = '#000000',
  textAlign: 'left' | 'center' | 'right' = 'left',
  sourceItemIds: string[] = []
): TemplateElementPlan | null {
  if (fieldBinding && fallback == null) return null;
  if (!fieldBinding && fallback == null) return null;
  return {
    type: 'TEXT',
    bounds: bounds(ctx, left, top, width, height),
    fieldBinding,
    fallback: String(fallback ?? ''),
    fontSize,
    fontWeight,
    fill,
    textAlign,
    lineClamp: height > 22 ? 2 : 1,
    sourceItemIds,
  };
}

function price(
  ctx: PlanContext,
  left: number,
  top: number,
  width: number,
  height: number,
  fieldBinding: PriceTemplateField,
  variant: 'main' | 'secondary',
  sourceItemIds: string[] = []
): TemplateElementPlan {
  return {
    type: 'PRICE',
    bounds: bounds(ctx, left, top, width, height),
    fieldBinding,
    variant,
    sourceItemIds,
  };
}

function discount(
  ctx: PlanContext,
  left: number,
  top: number,
  width: number,
  height: number,
  sourceItemIds: string[] = []
): TemplateElementPlan {
  return {
    type: 'DISCOUNT',
    bounds: bounds(ctx, left, top, width, height),
    sourceItemIds,
  };
}

function barcode(
  ctx: PlanContext,
  left: number,
  top: number,
  width: number,
  height: number,
  showText: boolean,
  sourceItemIds: string[] = []
): TemplateElementPlan {
  return {
    type: 'BARCODE',
    bounds: bounds(ctx, left, top, width, height),
    showText,
    sourceItemIds,
  };
}

function qr(
  ctx: PlanContext,
  left: number,
  top: number,
  width: number,
  height: number,
  sourceItemIds: string[] = []
): TemplateElementPlan {
  return {
    type: 'QRCODE',
    bounds: bounds(ctx, left, top, width, height),
    sourceItemIds,
  };
}

function textElement(
  bounds: TemplateBounds,
  options: {
    fieldBinding: string | null;
    fallback: string;
    fontSize: number;
    fontWeight?: 'normal' | 'bold';
    fill?: string;
    textAlign?: 'left' | 'center' | 'right';
    lineClamp?: number;
    sourceItemIds?: string[];
    warnings?: string[];
  }
): TemplateElementPlan {
  return {
    type: 'TEXT',
    bounds,
    fieldBinding: options.fieldBinding,
    fallback: options.fallback,
    fontSize: options.fontSize,
    fontWeight: options.fontWeight,
    fill: options.fill,
    textAlign: options.textAlign,
    lineClamp: options.lineClamp,
    sourceItemIds: options.sourceItemIds,
    warnings: options.warnings,
  };
}

function priceElement(
  bounds: TemplateBounds,
  fieldBinding: PriceTemplateField,
  variant: 'main' | 'secondary',
  sourceItemIds: string[],
  warnings?: string[]
): TemplateElementPlan {
  return {
    type: 'PRICE',
    bounds,
    fieldBinding,
    variant,
    sourceItemIds,
    warnings,
  };
}

function barcodeElement(
  bounds: TemplateBounds,
  showText: boolean,
  sourceItemIds: string[],
  warnings?: string[]
): TemplateElementPlan {
  return {
    type: 'BARCODE',
    bounds,
    showText,
    sourceItemIds,
    warnings,
  };
}

function qrElement(bounds: TemplateBounds, sourceItemIds: string[], warnings?: string[]): TemplateElementPlan {
  return {
    type: 'QRCODE',
    bounds,
    sourceItemIds,
    warnings,
  };
}

function sourceIdsForField(tag: RecognizedPriceTag, fieldKey: string | null): string[] {
  if (!fieldKey) return [];
  return getTemplateLineItems(tag)
    .filter((line) =>
      line.includeInTemplate !== false
      && (line.fieldKey === fieldKey || line.role === fieldKey)
    )
    .map((line) => line.id);
}

function getTemplateLineItems(tag: RecognizedPriceTag): OcrLineItem[] {
  if (tag.lineItems?.length) return tag.lineItems;
  return tag.rawItems.map((item) => ({
    ...item,
    role: 'customText',
    fieldKey: null,
    includeInTemplate: true,
    warnings: [translate('ocr.historicalLineWarning')],
  }));
}

function ocrLineBounds(ctx: PlanContext, tag: RecognizedPriceTag, line: OcrLineItem): TemplateBounds {
  const source = getSourceImage(tag);
  const content = getSourceContentBounds(tag, source);
  const canvasWidth = ctx.config.canvas.width;
  const canvasHeight = ctx.config.canvas.height;
  const scale = Math.min(canvasWidth / content.width, canvasHeight / content.height);
  const offsetX = (canvasWidth - content.width * scale) / 2 - content.left * scale;
  const offsetY = (canvasHeight - content.height * scale) / 2 - content.top * scale;
  const minWidth = getMinimumLineWidth(ctx, line.role);
  const minHeight = getMinimumLineHeight(ctx, line.role);
  const width = Math.max(minWidth, line.box.width * scale);
  const height = Math.max(minHeight, line.box.height * scale);
  const centerX = offsetX + line.box.centerX * scale;
  const centerY = offsetY + line.box.centerY * scale;

  return clampBounds(ctx.config, {
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
  });
}

function getSourceImage(tag: RecognizedPriceTag): { width: number; height: number } {
  if (tag.image) return tag.image;
  const items = tag.rawItems.length ? tag.rawItems : tag.lineItems;
  return {
    width: Math.max(1, ...items.map((item) => item.box.right)),
    height: Math.max(1, ...items.map((item) => item.box.bottom)),
  };
}

function getSourceContentBounds(tag: RecognizedPriceTag, source: { width: number; height: number }): TemplateBounds {
  const items = getTemplateLineItems(tag).filter((line) => line.includeInTemplate !== false);
  if (!items.length) {
    return {
      left: 0,
      top: 0,
      width: source.width,
      height: source.height,
    };
  }

  const left = Math.max(0, Math.min(...items.map((item) => item.box.left)));
  const top = Math.max(0, Math.min(...items.map((item) => item.box.top)));
  const right = Math.min(source.width, Math.max(...items.map((item) => item.box.right)));
  const bottom = Math.min(source.height, Math.max(...items.map((item) => item.box.bottom)));
  const horizontalPadding = Math.max(4, (right - left) * 0.06);
  const verticalPadding = Math.max(3, (bottom - top) * 0.10);
  const paddedLeft = Math.max(0, left - horizontalPadding);
  const paddedTop = Math.max(0, top - verticalPadding);
  const paddedRight = Math.min(source.width, right + horizontalPadding);
  const paddedBottom = Math.min(source.height, bottom + verticalPadding);

  return {
    left: paddedLeft,
    top: paddedTop,
    width: Math.max(1, paddedRight - paddedLeft),
    height: Math.max(1, paddedBottom - paddedTop),
  };
}

function getMinimumLineWidth(ctx: PlanContext, role: OcrLineRole): number {
  const base = role === 'barcodeContent'
    ? 82
    : role === 'qrContent'
      ? 34
      : isPriceRole(role)
        ? 42
        : 10;
  return Math.min(ctx.config.canvas.width, Math.max(1, Math.round(base * getCanvasScale(ctx))));
}

function getMinimumLineHeight(ctx: PlanContext, role: OcrLineRole): number {
  const base = role === 'barcodeContent'
    ? 24
    : role === 'qrContent'
      ? 34
      : isPriceRole(role)
        ? 22
        : 9;
  return Math.min(ctx.config.canvas.height, Math.max(1, Math.round(base * getCanvasScale(ctx))));
}

function expandBarcodeBounds(ctx: PlanContext, source: TemplateBounds): TemplateBounds {
  return clampBounds(ctx.config, {
    left: source.left,
    top: source.top - source.height,
    width: Math.max(source.width, Math.round(92 * getCanvasScale(ctx))),
    height: Math.max(source.height, Math.round(26 * getCanvasScale(ctx))),
  });
}

function squareBounds(ctx: PlanContext, source: TemplateBounds): TemplateBounds {
  const size = Math.max(source.width, source.height, Math.round(34 * getCanvasScale(ctx)));
  return clampBounds(ctx.config, {
    left: source.left + source.width / 2 - size / 2,
    top: source.top + source.height / 2 - size / 2,
    width: size,
    height: size,
  });
}

function clampBounds(config: BootConfig, value: TemplateBounds): TemplateBounds {
  const canvasWidth = Math.max(1, Math.round(config.canvas.width));
  const canvasHeight = Math.max(1, Math.round(config.canvas.height));
  const width = Math.max(1, Math.min(Math.round(value.width), canvasWidth));
  const height = Math.max(1, Math.min(Math.round(value.height), canvasHeight));
  return {
    left: Math.max(0, Math.min(Math.round(value.left), canvasWidth - width)),
    top: Math.max(0, Math.min(Math.round(value.top), canvasHeight - height)),
    width,
    height,
  };
}

function estimateLineFontSize(bounds: TemplateBounds, role: OcrLineRole): number {
  const multiplier = isEmphasisTextRole(role) ? 0.82 : 0.76;
  return Math.max(7, Math.min(42, Math.round(bounds.height * multiplier)));
}

function getRestoredTextBinding(tag: RecognizedPriceTag, line: OcrLineItem): string | null {
  const fieldKey = line.fieldKey;
  if (!fieldKey || fieldKey === 'discount' || fieldKey === 'barcodeContent' || fieldKey === 'qrContent') {
    return null;
  }
  if (isPriceRole(line.role)) return null;
  if (fieldKey.startsWith('ocrText')) return fieldKey;

  const value = getFieldValue(tag, fieldKey);
  return value != null && String(value).trim() === line.text.trim() ? fieldKey : null;
}

function getFieldValue(tag: RecognizedPriceTag, fieldKey: string): unknown {
  if (fieldKey in tag.fields) return tag.fields[fieldKey];
  if (fieldKey === 'barcodeContent' || fieldKey === 'qrContent') return tag.codes[fieldKey];
  return tag.customFields?.[fieldKey];
}

function isPriceRole(role: OcrLineRole): role is PriceTemplateField {
  return role === 'price' || role === 'originalPrice' || role === 'memberPrice';
}

function isEmphasisTextRole(role: OcrLineRole): boolean {
  return role === 'productName' || role === 'brand' || role === 'promoText';
}

function getCanvasScale(ctx: PlanContext): number {
  return Math.max(0.55, Math.min(2.5, Math.min(ctx.config.canvas.width / PRESET_WIDTH, ctx.config.canvas.height / PRESET_HEIGHT)));
}

function compact<T>(items: Array<T | null>): T[] {
  return items.filter((item): item is T => Boolean(item));
}

function getAccentColor(config: BootConfig): string {
  const palette = config.screen.profile.palette;
  const red = palette.find((color) => color.name.toLowerCase() === 'red')?.hex;
  if (red) return red;
  const yellow = palette.find((color) => color.name.toLowerCase() === 'yellow')?.hex;
  if (yellow) return yellow;
  return '#000000';
}
