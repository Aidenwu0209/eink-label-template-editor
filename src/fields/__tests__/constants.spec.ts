import { describe, expect, it } from 'vitest';
import {
  filterValidCustomFieldIds,
  getValidCustomFieldIdsFromPreviewData,
  isValidCustomFieldId,
  validateCustomFieldId,
} from '@/fields';

describe('custom field validation', () => {
  it('rejects empty, malformed, and reserved custom field IDs', () => {
    expect(validateCustomFieldId('')[0]?.message).toContain('不能为空');
    expect(validateCustomFieldId('123abc')[0]?.message).toContain('必须以英文字母开头');
    expect(validateCustomFieldId('product-name')[0]?.message).toContain('只能包含英文字母');
    expect(validateCustomFieldId('price')[0]?.message).toContain('系统保留字段');
    expect(validateCustomFieldId('brand')[0]?.message).toContain('系统保留字段');
    expect(isValidCustomFieldId('brand_2')).toBe(true);
  });

  it('filters custom field IDs before they reach TEXT binding menus', () => {
    expect(filterValidCustomFieldIds([
      'brand',
      'price',
      'origin_price',
      '123bad',
      'brand',
      'product-name',
    ])).toEqual(['origin_price']);
  });

  it('extracts only legal custom string fields from preview data', () => {
    expect(getValidCustomFieldIdsFromPreviewData({
      productName: '系统字段',
      brand: 'Acme',
      origin_price: '19.90',
      score: 5,
      'bad-name': 'bad',
      qrContent: 'https://example.com',
    })).toEqual(['origin_price']);
  });
});
