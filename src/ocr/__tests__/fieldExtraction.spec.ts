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
    expect(result.lineItems).toHaveLength(items.length);
    expect(result.lineItems.find((line) => line.text === '促销价 ¥12.90')?.role).toBe('price');
    expect(result.lineItems.find((line) => line.text === 'SKU1001')?.role).toBe('barcodeContent');
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

  it('handles English shelf labels without treating short item codes as prices or barcodes', () => {
    const items = normalizeOcrItems([
      item('MS ANALOG', 20, 20, 76, 16, 0.95),
      item('TIMER', 98, 20, 54, 16, 0.99),
      item('RETAIL PRICE', 20, 38, 70, 10, 1),
      item('23', 240, 22, 28, 18, 0.99),
      item('1772', 166, 145, 44, 16, 1),
      item('FAC 1 CAP 6', 230, 166, 70, 12, 0.94),
    ]);

    const result = extractPriceTagFromOcr(items, 'browser-local', {}, { width: 310, height: 204 });

    expect(result.fields.productName).toBe('MS ANALOG TIMER');
    expect(result.fields.price).toBeUndefined();
    expect(result.codes.barcodeContent).toBeUndefined();
    expect(result.lineItems.find((line) => line.text === '1772')?.role).not.toBe('price');
    expect(result.lineItems.find((line) => line.text === 'FAC 1 CAP 6')?.role).not.toBe('barcodeContent');
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
    expect(result.lineItems.map((line) => line.text)).toEqual(['进口香蕉', '¥5.98', '冷藏保存']);
  });

  it('keeps every unclassified OCR line instead of capping custom fields', () => {
    const raw = [
      item('商品A', 10, 10, 42, 14),
      item('¥9.90', 10, 30, 52, 22),
      ...Array.from({ length: 14 }, (_, index) =>
        item(`补充文本${index + 1}`, 12, 58 + index * 12, 72, 10)
      ),
    ];
    const items = normalizeOcrItems(raw);

    const result = extractPriceTagFromOcr(items, 'browser-local');

    expect(result.lineItems).toHaveLength(items.length);
    expect(Object.keys(result.customFields ?? {}).length).toBeGreaterThan(6);
    expect(result.lineItems.every((line) => line.includeInTemplate)).toBe(true);
  });
});
