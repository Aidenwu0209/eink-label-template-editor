import type { BootConfig } from '@/boot/types';
import type { RecognizedPriceTag } from './types';

export type SmartTemplateKind = 'auto' | 'standard' | 'promotion' | 'member' | 'barcode' | 'qr';
export type PriceTemplateField = 'price' | 'originalPrice' | 'memberPrice';

export interface TemplateBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type TemplateElementPlan =
  | {
      type: 'TEXT';
      bounds: TemplateBounds;
      fieldBinding: string | null;
      fallback: string;
      fontSize: number;
      fontWeight?: 'normal' | 'bold';
      fill?: string;
      textAlign?: 'left' | 'center' | 'right';
      lineClamp?: number;
    }
  | {
      type: 'PRICE';
      bounds: TemplateBounds;
      fieldBinding: PriceTemplateField;
      variant: 'main' | 'secondary';
    }
  | {
      type: 'DISCOUNT';
      bounds: TemplateBounds;
    }
  | {
      type: 'BARCODE';
      bounds: TemplateBounds;
      showText: boolean;
    }
  | {
      type: 'QRCODE';
      bounds: TemplateBounds;
    }
  | {
      type: 'LINE';
      bounds: TemplateBounds;
    };

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

  const elements = kind === 'member'
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
    elements: withOptionalCodes(ctx, tag, elements),
  };
}

export function selectSmartTemplateKind(tag: RecognizedPriceTag): Exclude<SmartTemplateKind, 'auto'> {
  if (tag.fields.memberPrice != null) return 'member';
  if (tag.fields.discount != null || tag.fields.originalPrice != null || tag.fields.promoText) return 'promotion';
  if (tag.codes.barcodeContent) return 'barcode';
  if (tag.codes.qrContent) return 'qr';
  return 'standard';
}

function standardPlan(ctx: PlanContext, tag: RecognizedPriceTag): TemplateElementPlan[] {
  return compact([
    text(ctx, 10, 10, 174, 22, 'productName', tag.fields.productName, 15, 'bold'),
    tag.fields.spec
      ? text(ctx, 10, 33, 134, 16, 'spec', tag.fields.spec, 9, 'normal')
      : text(ctx, 10, 33, 134, 16, 'description', tag.fields.description, 9, 'normal'),
    price(ctx, 10, 48, 142, 46, 'price', 'main'),
  ]);
}

function promotionPlan(ctx: PlanContext, tag: RecognizedPriceTag): TemplateElementPlan[] {
  return compact([
    text(ctx, 10, 9, 176, 20, 'productName', tag.fields.productName, 14, 'bold'),
    price(ctx, 10, 36, 136, 48, 'price', 'main'),
    tag.fields.originalPrice != null ? price(ctx, 156, 71, 78, 19, 'originalPrice', 'secondary') : null,
    tag.fields.discount != null ? discount(ctx, 154, 34, 74, 30) : null,
    text(ctx, 10, 90, 184, 16, 'promoText', tag.fields.promoText ?? tag.fields.description, 9, 'bold'),
  ]);
}

function memberPlan(ctx: PlanContext, tag: RecognizedPriceTag): TemplateElementPlan[] {
  return compact([
    text(ctx, 10, 9, 176, 20, 'productName', tag.fields.productName, 14, 'bold'),
    text(ctx, 10, 33, 58, 15, null, '会员价', 9, 'bold', ctx.accent),
    price(ctx, 10, 47, 142, 46, 'memberPrice', 'main'),
    tag.fields.price != null ? price(ctx, 158, 72, 70, 18, 'price', 'secondary') : null,
    text(ctx, 10, 94, 180, 15, 'promoText', tag.fields.promoText ?? tag.fields.spec, 9, 'normal'),
  ]);
}

function barcodePlan(ctx: PlanContext, tag: RecognizedPriceTag): TemplateElementPlan[] {
  return compact([
    text(ctx, 10, 9, 184, 20, 'productName', tag.fields.productName, 14, 'bold'),
    price(ctx, 10, 34, 128, 38, tag.fields.memberPrice != null ? 'memberPrice' : 'price', 'main'),
    text(ctx, 144, 39, 72, 14, 'spec', tag.fields.spec, 8, 'normal'),
    barcode(ctx, 10, 82, 206, 34, false),
  ]);
}

function qrPlan(ctx: PlanContext, tag: RecognizedPriceTag): TemplateElementPlan[] {
  return compact([
    qr(ctx, 10, 25, 72, 72),
    text(ctx, 94, 14, 184, 22, 'productName', tag.fields.productName, 14, 'bold'),
    price(ctx, 94, 43, 132, 38, tag.fields.memberPrice != null ? 'memberPrice' : 'price', 'main'),
    text(ctx, 94, 85, 184, 18, 'promoText', tag.fields.promoText ?? tag.fields.description, 9, 'normal'),
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
    next.push(barcode(ctx, 10, 103, 184, 20, false));
  }

  if (tag.codes.qrContent && !hasQr) {
    next.push(qr(ctx, 234, 62, 50, 50));
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
  textAlign: 'left' | 'center' | 'right' = 'left'
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
  };
}

function price(
  ctx: PlanContext,
  left: number,
  top: number,
  width: number,
  height: number,
  fieldBinding: PriceTemplateField,
  variant: 'main' | 'secondary'
): TemplateElementPlan {
  return {
    type: 'PRICE',
    bounds: bounds(ctx, left, top, width, height),
    fieldBinding,
    variant,
  };
}

function discount(ctx: PlanContext, left: number, top: number, width: number, height: number): TemplateElementPlan {
  return {
    type: 'DISCOUNT',
    bounds: bounds(ctx, left, top, width, height),
  };
}

function barcode(
  ctx: PlanContext,
  left: number,
  top: number,
  width: number,
  height: number,
  showText: boolean
): TemplateElementPlan {
  return {
    type: 'BARCODE',
    bounds: bounds(ctx, left, top, width, height),
    showText,
  };
}

function qr(ctx: PlanContext, left: number, top: number, width: number, height: number): TemplateElementPlan {
  return {
    type: 'QRCODE',
    bounds: bounds(ctx, left, top, width, height),
  };
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
