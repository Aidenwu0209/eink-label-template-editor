import { describe, expect, it } from 'vitest';
import { extractPriceTagFromOcr } from '../fieldExtraction';
import { normalizeOcrItems } from '../normalize';

function item(text: string, left: number, top: number, width: number, height: number, score = 0.92) {
  return {
    text,
    score,
    box: { left, top, width, height },
  };
}

describe('price tag OCR field extraction', () => {
  it('extracts product, price, original price, spec, promo and codes', () => {
    const items = normalizeOcrItems([
      item('鲜选超市', 10, 8, 60, 16),
      item('有机纯牛奶', 12, 28, 118, 22),
      item('300ml x 12盒', 12, 53, 92, 14),
      item('促销价 ¥12.90', 12, 70, 112, 28),
      item('原价 18.90元', 142, 84, 76, 14),
      item('8.8折', 190, 42, 48, 18),
      item('SKU1001', 18, 108, 88, 12),
      item('https://example.com/item/1001', 126, 108, 150, 12),
    ]);

    const result = extractPriceTagFromOcr(items, 'browser-local', {}, { width: 296, height: 128 });

    expect(result.fields.productName).toBe('有机纯牛奶');
    expect(result.fields.price).toBe(12.9);
    expect(result.fields.originalPrice).toBe(18.9);
    expect(result.fields.spec).toBe('300ml x 12盒');
    expect(result.fields.discount).toBe(8.8);
    expect(result.fields.brand).toBe('鲜选超市');
    expect(result.codes.barcodeContent).toBe('SKU1001');
    expect(result.codes.qrContent).toContain('example.com');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('recognizes member price separately from main price', () => {
    const items = normalizeOcrItems([
      item('蓝莓酸奶', 10, 12, 104, 20),
      item('会员价 ¥9.90', 10, 44, 100, 28),
      item('零售价 12.90', 128, 72, 80, 14),
    ]);

    const result = extractPriceTagFromOcr(items, 'paddle-api');

    expect(result.fields.productName).toBe('蓝莓酸奶');
    expect(result.fields.memberPrice).toBe(9.9);
    expect(result.fields.price).toBe(12.9);
  });

  it('keeps leftover useful text as custom fields', () => {
    const items = normalizeOcrItems([
      item('进口香蕉', 10, 12, 80, 18),
      item('¥5.98', 10, 40, 70, 28),
      item('冷藏保存', 10, 80, 64, 14),
    ]);

    const result = extractPriceTagFromOcr(items, 'browser-local');

    expect(result.fields.productName).toBe('进口香蕉');
    expect(result.fields.price).toBe(5.98);
    expect(result.fields.description).toBe('冷藏保存');
  });
});
