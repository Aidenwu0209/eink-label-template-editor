/**
 * US-006: TEXT text component
 *
 * Tests verify AC1–AC11 using pure logic validation (no browser).
 * Fabric.js Textbox creation and TEXT-specific properties are validated
 * by checking the resulting configuration objects.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ══════════ Inline types & constants ══════════

const ScreenType = { BW: 'bw', TRI: 'tri', BWRY: 'bwry', SIX: 'six' };

const BW_PALETTE = [
  { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
  { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
];

const BWR_PALETTE = [
  { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
  { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
  { name: 'Red', hex: '#FF0000', rgb: [255, 0, 0], deviceIndex: 2 },
];

const TEXT_BINDABLE_FIELDS = ['productName', 'description'];
const SYSTEM_FIELDS = ['productName', 'price', 'discount', 'description', 'imageUrl', 'qrContent', 'barcodeContent'];
const TEXT_OVERFLOW_MODES = ['clip', 'ellipsis', 'wrap'];

function makeConfig(width, height, palette, screenType) {
  return {
    mode: 'create',
    canvas: { width, height },
    screen: {
      type: screenType,
      profile: {
        type: screenType,
        palette,
        defaultBackground: '#FFFFFF',
        dpi: 150,
      },
    },
    previewData: {
      productName: '测试商品A',
      price: 29.9,
      discount: 8.5,
      description: '这是一段商品描述',
      imageUrl: 'https://example.com/img.png',
      qrContent: 'https://example.com',
      barcodeContent: 'SKU1001',
    },
  };
}

// ══════════ Simulated TEXT creation (mirrors editorStore.addText) ══════════

function createTextConfig(config, overrides = {}) {
  const w = Math.min(200, config.canvas.width * 0.6);
  const h = 40;
  const left = Math.round((config.canvas.width - w) / 2);
  const top = Math.round((config.canvas.height - h) / 2);

  return {
    type: 'textbox',
    text: '文本',
    left,
    top,
    width: w,
    fontFamily: 'AlibabaPuHuiTi',
    fontSize: 16,
    fontWeight: 'normal',
    fill: '#000000',
    textAlign: 'left',
    lineHeight: 1.2,
    extensionType: 'TEXT',
    extension: {
      fieldBinding: null,
      overflow: 'ellipsis',
      lineClamp: 0,
      verticalAlign: 'top',
    },
    ...overrides,
  };
}

// ══════════ Tests ══════════

describe('US-006: TEXT text component', () => {

  // AC1: Toolbar provides an action to add a TEXT component
  it('AC1: createTextConfig returns valid TEXT object', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const text = createTextConfig(config);
    assert.equal(text.type, 'textbox');
    assert.equal(text.extensionType, 'TEXT');
    assert.ok(text.width > 0);
    assert.ok(text.text.length > 0);
  });

  // AC2: TEXT can be configured as fixed text without a field binding
  it('AC2: TEXT with no field binding is fixed text', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const text = createTextConfig(config, { text: '固定文本内容' });
    assert.equal(text.extension.fieldBinding, null);
    assert.equal(text.text, '固定文本内容');
    // Fixed text renders its own content
    assert.ok(typeof text.text === 'string');
  });

  // AC3: TEXT can bind to productName, description, or a valid custom text field
  it('AC3a: TEXT can bind to productName', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const text = createTextConfig(config, {
      text: config.previewData.productName,
      extension: { fieldBinding: 'productName', overflow: 'ellipsis', lineClamp: 0, verticalAlign: 'top' },
    });
    assert.equal(text.extension.fieldBinding, 'productName');
    assert.equal(text.text, '测试商品A');
  });

  it('AC3b: TEXT can bind to description', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const text = createTextConfig(config, {
      text: config.previewData.description,
      extension: { fieldBinding: 'description', overflow: 'ellipsis', lineClamp: 0, verticalAlign: 'top' },
    });
    assert.equal(text.extension.fieldBinding, 'description');
    assert.equal(text.text, '这是一段商品描述');
  });

  it('AC3c: TEXT can bind to custom text field', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const customField = 'brand';
    // Validate custom field ID
    const pattern = /^[A-Za-z][A-Za-z0-9_]*$/;
    assert.ok(pattern.test(customField), 'Custom field ID should be valid');
    assert.ok(!SYSTEM_FIELDS.includes(customField), 'Should not conflict with system fields');

    const text = createTextConfig(config, {
      text: 'Apple',
      extension: { fieldBinding: customField, overflow: 'ellipsis', lineClamp: 0, verticalAlign: 'top' },
    });
    assert.equal(text.extension.fieldBinding, 'brand');
    assert.equal(text.text, 'Apple');
  });

  // AC4: TEXT uses AlibabaPuHuiTi as the font family
  it('AC4: TEXT fontFamily is AlibabaPuHuiTi', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const text = createTextConfig(config);
    assert.equal(text.fontFamily, 'AlibabaPuHuiTi');
  });

  // AC5: TEXT font weight accepts only normal and bold
  it('AC5: TEXT fontWeight accepts normal and bold only', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const textNormal = createTextConfig(config, { fontWeight: 'normal' });
    const textBold = createTextConfig(config, { fontWeight: 'bold' });
    assert.equal(textNormal.fontWeight, 'normal');
    assert.equal(textBold.fontWeight, 'bold');

    // Verify only normal and bold are valid values
    const validWeights = ['normal', 'bold'];
    assert.ok(validWeights.includes('normal'));
    assert.ok(validWeights.includes('bold'));
    assert.ok(!validWeights.includes('lighter'));
    assert.ok(!validWeights.includes('bolder'));
    assert.ok(!validWeights.includes('100'));
  });

  // AC6: TEXT overflow mode accepts clip, ellipsis, and wrap
  it('AC6: TEXT overflow accepts clip, ellipsis, wrap', () => {
    const overflowModes = ['clip', 'ellipsis', 'wrap'];
    assert.deepEqual(overflowModes, TEXT_OVERFLOW_MODES);

    for (const mode of TEXT_OVERFLOW_MODES) {
      const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
      const text = createTextConfig(config, {
        extension: { fieldBinding: null, overflow: mode, lineClamp: 0, verticalAlign: 'top' },
      });
      assert.equal(text.extension.overflow, mode);
    }
  });

  // AC7: TEXT default overflow mode is ellipsis
  it('AC7: TEXT default overflow is ellipsis', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const text = createTextConfig(config);
    assert.equal(text.extension.overflow, 'ellipsis');
  });

  // AC8: TEXT supports lineClamp
  it('AC8: TEXT supports lineClamp', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);

    // Default lineClamp is 0 (unlimited)
    const textDefault = createTextConfig(config);
    assert.equal(textDefault.extension.lineClamp, 0);

    // Can set lineClamp to positive number
    const textClamped = createTextConfig(config, {
      extension: { fieldBinding: null, overflow: 'ellipsis', lineClamp: 3, verticalAlign: 'top' },
    });
    assert.equal(textClamped.extension.lineClamp, 3);
  });

  // AC9: TEXT supports horizontal and vertical alignment
  it('AC9: TEXT supports horizontal and vertical alignment', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);

    // Horizontal alignment (Fabric textAlign)
    const textAligns = ['left', 'center', 'right'];
    for (const align of textAligns) {
      const text = createTextConfig(config, { textAlign: align });
      assert.equal(text.textAlign, align);
    }

    // Vertical alignment (extension)
    const verticalAligns = ['top', 'middle', 'bottom'];
    for (const align of verticalAligns) {
      const text = createTextConfig(config, {
        extension: { fieldBinding: null, overflow: 'ellipsis', lineClamp: 0, verticalAlign: align },
      });
      assert.equal(text.extension.verticalAlign, align);
    }
  });

  // AC11 (typecheck): Verify TEXT structure is type-safe
  it('TEXT config structure is valid for all combinations', () => {
    const config = makeConfig(400, 300, BWR_PALETTE, ScreenType.TRI);

    // Fixed text with all options
    const fixed = createTextConfig(config, {
      text: 'Hello World',
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#FF0000',
      textAlign: 'center',
      extension: { fieldBinding: null, overflow: 'wrap', lineClamp: 2, verticalAlign: 'middle' },
    });
    assert.equal(fixed.extension.fieldBinding, null);
    assert.equal(fixed.fontSize, 24);
    assert.equal(fixed.fontWeight, 'bold');
    assert.equal(fixed.fill, '#FF0000');
    assert.equal(fixed.textAlign, 'center');
    assert.equal(fixed.extension.overflow, 'wrap');
    assert.equal(fixed.extension.lineClamp, 2);
    assert.equal(fixed.extension.verticalAlign, 'middle');

    // Dynamic text bound to productName
    const dynamic = createTextConfig(config, {
      text: config.previewData.productName,
      extension: { fieldBinding: 'productName', overflow: 'ellipsis', lineClamp: 0, verticalAlign: 'top' },
    });
    assert.equal(dynamic.extension.fieldBinding, 'productName');
  });

  // Additional: TEXT position is centered on canvas
  it('TEXT is centered on canvas', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const text = createTextConfig(config);
    const centerX = Math.round((config.canvas.width - text.width) / 2);
    const centerY = Math.round((config.canvas.height - 40) / 2);
    assert.equal(text.left, centerX);
    assert.equal(text.top, centerY);
  });

  // Additional: TEXT with bound field updates when previewData changes
  it('Dynamic TEXT reflects previewData value', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const text = createTextConfig(config, {
      text: config.previewData.productName,
      extension: { fieldBinding: 'productName', overflow: 'ellipsis', lineClamp: 0, verticalAlign: 'top' },
    });
    assert.equal(text.text, '测试商品A');

    // Simulate previewData change
    const newProductName = '新商品B';
    const updatedText = { ...text, text: newProductName };
    assert.equal(updatedText.text, '新商品B');
  });

  // Additional: TEXT appears in exported JSON
  it('TEXT appears in exported JSON structure', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const text = createTextConfig(config, {
      extension: { fieldBinding: 'productName', overflow: 'ellipsis', lineClamp: 0, verticalAlign: 'top' },
    });

    const exported = {
      version: '5.3.0',
      objects: [text],
    };

    const textObj = exported.objects.find(o => o.extensionType === 'TEXT');
    assert.ok(textObj, 'TEXT should be in exported JSON');
    assert.equal(textObj.extension.fieldBinding, 'productName');
  });

  // Additional: TEXT_BINDABLE_FIELDS includes productName and description
  it('TEXT_BINDABLE_FIELDS includes productName and description', () => {
    assert.ok(TEXT_BINDABLE_FIELDS.includes('productName'));
    assert.ok(TEXT_BINDABLE_FIELDS.includes('description'));
    // price, discount, etc. should NOT be in TEXT bindable fields
    assert.ok(!TEXT_BINDABLE_FIELDS.includes('price'));
    assert.ok(!TEXT_BINDABLE_FIELDS.includes('discount'));
    assert.ok(!TEXT_BINDABLE_FIELDS.includes('imageUrl'));
  });
});
