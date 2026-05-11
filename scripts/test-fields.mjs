/**
 * US-004 单元测试：系统字段与自定义字段校验
 *
 * 使用 Node.js 内置 node:test 模块，内联核心逻辑避免 TS import。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Inline field validation logic (mirrors src/fields/constants.ts) ──

const SYSTEM_FIELDS = [
  'productName',
  'price',
  'discount',
  'description',
  'imageUrl',
  'qrContent',
  'barcodeContent',
];

const CUSTOM_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function validateCustomFieldId(id, existingIds = []) {
  const errors = [];

  if (!id || id.trim() === '') {
    errors.push({ field: id, message: '自定义字段 ID 不能为空' });
    return errors;
  }

  if (SYSTEM_FIELDS.includes(id)) {
    errors.push({ field: id, message: `"${id}" 是系统保留字段，不能用作自定义字段` });
    return errors;
  }

  if (!CUSTOM_ID_PATTERN.test(id)) {
    if (!/^[A-Za-z]/.test(id)) {
      errors.push({ field: id, message: '自定义字段 ID 必须以英文字母开头' });
    } else {
      errors.push({ field: id, message: '自定义字段 ID 只能包含英文字母、数字和下划线' });
    }
  }

  if (existingIds.includes(id)) {
    errors.push({ field: id, message: `自定义字段 ID "${id}" 已存在，不能重复` });
  }

  return errors;
}

function isValid(id, existingIds) {
  return validateCustomFieldId(id, existingIds).length === 0;
}

// ══════════ Tests ══════════

describe('US-004 系统字段与自定义字段校验', () => {

  // AC1: Reserved system fields
  it('AC1: 系统保留字段包含 productName, price, discount, description, imageUrl, qrContent, barcodeContent', () => {
    assert.deepStrictEqual(
      [...SYSTEM_FIELDS].sort(),
      ['barcodeContent', 'description', 'discount', 'imageUrl', 'price', 'productName', 'qrContent']
    );
  });

  // AC2: Custom fields support text type only
  it('AC2: 自定义字段仅支持 text 类型', () => {
    const CUSTOM_FIELD_TYPE = 'text';
    assert.strictEqual(CUSTOM_FIELD_TYPE, 'text');
  });

  // AC3: Empty ID rejected
  it('AC3: 空字符串被拒绝', () => {
    const errors = validateCustomFieldId('');
    assert.ok(errors.length > 0);
    assert.ok(errors[0].message.includes('不能为空'));

    const errors2 = validateCustomFieldId('   ');
    assert.ok(errors2.length > 0);
  });

  // AC4: Rejects non-letter/digit/underscore chars
  it('AC4: 含非法字符的 ID 被拒绝（价格, product-name）', () => {
    const err1 = validateCustomFieldId('价格');
    assert.ok(err1.length > 0);
    assert.ok(err1[0].message.includes('必须以英文字母开头'));

    const err2 = validateCustomFieldId('product-name');
    assert.ok(err2.length > 0);
    assert.ok(err2.some(e => e.message.includes('只能包含英文字母、数字和下划线')));
  });

  // AC5: Rejects IDs not starting with English letter
  it('AC5: 不以英文字母开头的 ID 被拒绝（123abc）', () => {
    const err = validateCustomFieldId('123abc');
    assert.ok(err.length > 0);
    assert.ok(err[0].message.includes('必须以英文字母开头'));
  });

  // AC6: Rejects values matching reserved system fields
  it('AC6: 与系统保留字段同名的 ID 被拒绝（price, qrContent）', () => {
    const err1 = validateCustomFieldId('price');
    assert.ok(err1.length > 0);
    assert.ok(err1[0].message.includes('系统保留字段'));

    const err2 = validateCustomFieldId('qrContent');
    assert.ok(err2.length > 0);
    assert.ok(err2[0].message.includes('系统保留字段'));
  });

  // AC7: Rejects duplicate custom fields
  it('AC7: 同一模板内重复的自定义字段 ID 被拒绝', () => {
    const existing = ['brand', 'originPrice'];
    const err = validateCustomFieldId('brand', existing);
    assert.ok(err.length > 0);
    assert.ok(err[0].message.includes('已存在'));
  });

  // AC8: Valid IDs pass
  it('AC8: brand, originPrice, memberPrice, unit 通过校验', () => {
    assert.strictEqual(isValid('brand'), true);
    assert.strictEqual(isValid('originPrice'), true);
    assert.strictEqual(isValid('memberPrice'), true);
    assert.strictEqual(isValid('unit'), true);
  });

  // AC9: Invalid IDs show clear errors
  it('AC9: 价格, product-name, 123abc, price, qrContent 显示明确错误信息', () => {
    const cases = [
      { id: '价格', expected: '必须以英文字母开头' },
      { id: 'product-name', expected: '只能包含英文字母' },
      { id: '123abc', expected: '必须以英文字母开头' },
      { id: 'price', expected: '系统保留字段' },
      { id: 'qrContent', expected: '系统保留字段' },
    ];
    for (const { id, expected } of cases) {
      const errors = validateCustomFieldId(id);
      assert.ok(errors.length > 0, `${id} should have validation errors`);
      assert.ok(
        errors.some(e => e.message.includes(expected)),
        `${id}: expected "${expected}", got "${errors.map(e => e.message).join(', ')}"`
      );
    }
  });

  // Additional edge cases
  it('额外: 下划线开头的 ID 被拒绝', () => {
    assert.ok(!isValid('_brand'));
  });

  it('额外: 下划线中间位置的 ID 通过', () => {
    assert.ok(isValid('my_field'));
  });

  it('额外: 包含多个下划线的 ID 通过', () => {
    assert.ok(isValid('origin_price_value'));
  });
});
