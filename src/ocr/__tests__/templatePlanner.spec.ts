import { describe, expect, it } from 'vitest';
import { createPriceTagTemplatePlan, selectSmartTemplateKind } from '../templatePlanner';
import type { BootConfig } from '@/boot/types';
import type { OcrLineItem, OcrLineRole, RecognizedPriceTag } from '../types';
import { normalizeOcrItems } from '../normalize';
import { ScreenType } from '@/screen/types';

const config: BootConfig = {
  mode: 'create',
  canvas: { width: 296, height: 128 },
  screen: {
    type: ScreenType.TRI,
    profile: {
      type: ScreenType.TRI,
      displayName: 'BWR',
      defaultWidth: 296,
      defaultHeight: 128,
      dpi: 110,
      maxColors: 3,
      defaultBackground: '#FFFFFF',
      palette: [
        { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 0 },
        { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 1 },
        { name: 'Red', hex: '#CC0000', rgb: [204, 0, 0], deviceIndex: 2 },
      ],
      dithering: { algorithm: 'none', strength: 0, serpentine: false },
      supportsPartialRefresh: true,
    },
    palette: [],
  },
  previewData: {},
  api: { baseUrl: '/api' },
};

function tag(overrides: Partial<RecognizedPriceTag>): RecognizedPriceTag {
  return {
    fields: {},
    codes: {},
    rawItems: [],
    lineItems: [],
    provider: 'browser-local',
    confidence: 0.8,
    warnings: [],
    ...overrides,
  };
}

function line(
  text: string,
  role: OcrLineRole,
  fieldKey: string | null,
  left: number,
  top: number,
  width: number,
  height: number
): OcrLineItem {
  const [item] = normalizeOcrItems([
    {
      text,
      score: 0.92,
      box: { left, top, width, height },
    },
  ]);
  return {
    ...item,
    id: `${role}_${left}_${top}`,
    role,
    fieldKey,
    includeInTemplate: true,
    warnings: [],
  };
}

describe('OCR fixed template planner', () => {
  it('selects promotion template when original price or discount exists', () => {
    const recognized = tag({
      fields: {
        productName: '有机纯牛奶',
        price: 12.9,
        originalPrice: 18.9,
        discount: 8.8,
      },
    });

    expect(selectSmartTemplateKind(recognized)).toBe('promotion');

    const plan = createPriceTagTemplatePlan(config, recognized, 'auto');
    expect(plan.kind).toBe('promotion');
    expect(plan.elements.some((element) => element.type === 'PRICE' && element.fieldBinding === 'originalPrice')).toBe(true);
    expect(plan.elements.some((element) => element.type === 'DISCOUNT')).toBe(true);
  });

  it('selects member template and binds memberPrice to the main price component', () => {
    const plan = createPriceTagTemplatePlan(config, tag({
      fields: {
        productName: '蓝莓酸奶',
        memberPrice: 9.9,
        price: 12.9,
      },
    }));

    expect(plan.kind).toBe('member');
    expect(plan.elements.some((element) =>
      element.type === 'PRICE'
      && element.fieldBinding === 'memberPrice'
      && element.variant === 'main'
    )).toBe(true);
  });

  it('adds barcode and QR code elements when codes are available', () => {
    const plan = createPriceTagTemplatePlan(config, tag({
      fields: {
        productName: '进口香蕉',
        price: 5.98,
      },
      codes: {
        barcodeContent: 'SKU1001',
        qrContent: 'https://example.com/item/1001',
      },
    }), 'standard');

    expect(plan.elements.some((element) => element.type === 'BARCODE')).toBe(true);
    expect(plan.elements.some((element) => element.type === 'QRCODE')).toBe(true);
  });

  it('restores every OCR line into the generated layout by default mode choice', () => {
    const lineItems = [
      line('进口香蕉', 'productName', 'productName', 10, 12, 90, 18),
      line('¥5.98', 'price', 'price', 10, 42, 78, 34),
      line('冷藏保存', 'customText', 'ocrText1', 12, 86, 70, 14),
    ];
    const plan = createPriceTagTemplatePlan(config, tag({
      fields: {
        productName: '进口香蕉',
        price: 5.98,
        ocrText1: '冷藏保存',
      },
      rawItems: lineItems,
      lineItems,
      image: { width: 296, height: 128 },
    }), 'restore');

    const plannedIds = new Set(plan.elements.flatMap((element) => element.sourceItemIds ?? []));
    expect(plan.kind).toBe('restore');
    expect(plan.elements.some((element) => element.type === 'PRICE' && element.fieldBinding === 'price')).toBe(true);
    expect(plan.elements.some((element) => element.type === 'TEXT' && element.fallback === '冷藏保存')).toBe(true);
    expect(lineItems.every((item) => plannedIds.has(item.id))).toBe(true);
  });

  it('keeps fixed templates but appends OCR lines that were not consumed by semantic fields', () => {
    const lineItems = [
      line('鲜选超市', 'brand', 'brand', 10, 8, 60, 16),
      line('进口香蕉', 'productName', 'productName', 10, 28, 90, 20),
      line('¥5.98', 'price', 'price', 10, 56, 78, 34),
    ];
    const plan = createPriceTagTemplatePlan(config, tag({
      fields: {
        brand: '鲜选超市',
        productName: '进口香蕉',
        price: 5.98,
      },
      rawItems: lineItems,
      lineItems,
      image: { width: 296, height: 128 },
    }), 'standard');

    const plannedIds = new Set(plan.elements.flatMap((element) => element.sourceItemIds ?? []));
    expect(plan.kind).toBe('standard');
    expect(plan.elements.some((element) => element.type === 'TEXT' && element.fallback === '鲜选超市')).toBe(true);
    expect(lineItems.every((item) => plannedIds.has(item.id))).toBe(true);
  });
});
