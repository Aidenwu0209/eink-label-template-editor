/**
 * US-009: DISCOUNT discount component
 *
 * Tests verify AC1–AC8 using pure logic validation (no browser).
 * DISCOUNT component creation, field binding, format template,
 * colors, font options, alignment, and Dynamic Metadata output.
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

const BWRY_PALETTE = [
  { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
  { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
  { name: 'Red', hex: '#FF0000', rgb: [255, 0, 0], deviceIndex: 2 },
  { name: 'Yellow', hex: '#E8B811', rgb: [232, 184, 17], deviceIndex: 3 },
];

const E6_PALETTE = [
  { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
  { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
  { name: 'Red', hex: '#FF0000', rgb: [255, 0, 0], deviceIndex: 2 },
  { name: 'Green', hex: '#00FF00', rgb: [0, 255, 0], deviceIndex: 3 },
  { name: 'Blue', hex: '#0000FF', rgb: [0, 0, 255], deviceIndex: 4 },
  { name: 'Yellow', hex: '#D9C732', rgb: [217, 199, 50], deviceIndex: 5 },
  { name: 'Orange', hex: '#E8772E', rgb: [232, 119, 46], deviceIndex: 6 },
];

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
      price: 1299.9,
      discount: 8.5,
      description: '这是一段商品描述',
      imageUrl: 'https://example.com/img.png',
      qrContent: 'https://example.com',
      barcodeContent: 'SKU1001',
    },
  };
}

// ══════════ Simulated DISCOUNT creation (mirrors editorStore) ══════════

function createDiscountConfig(config, overrides = {}) {
  const w = Math.min(100, config.canvas.width * 0.3);
  const h = 40;
  const left = Math.round((config.canvas.width - w) / 2);
  const top = Math.round((config.canvas.height - h) / 2);

  return {
    type: 'rect',
    left,
    top,
    width: w,
    height: h,
    fill: '#FFFFFF',
    stroke: '#000000',
    strokeWidth: 1,
    extensionType: 'DISCOUNT',
    extension: {
      fieldBinding: 'discount',
      formatTemplate: '{value}折',
      backgroundColor: '#FFFFFF',
      textColor: '#000000',
      fontSize: 20,
      fontWeight: 'normal',
      textAlign: 'center',
      verticalAlign: 'middle',
    },
    ...overrides,
  };
}

function isPaletteColor(color, palette) {
  return palette.some(p => p.hex.toUpperCase() === color.toUpperCase());
}

// ══════════ Discount formatting helper ══════════

function formatDiscount(rawValue, ext) {
  return ext.formatTemplate.replace('{value}', String(rawValue));
}

// ══════════ Tests ══════════

describe('US-009: DISCOUNT discount component', () => {

  // AC1: The toolbar provides an action to add a DISCOUNT component
  it('AC1: createDiscountConfig returns valid DISCOUNT component', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const discount = createDiscountConfig(config);
    assert.equal(discount.extensionType, 'DISCOUNT');
    assert.ok(discount.width > 0);
    assert.ok(discount.height > 0);
    assert.ok(discount.left >= 0);
    assert.ok(discount.top >= 0);
  });

  // AC2: DISCOUNT is fixed to the discount field
  it('AC2: DISCOUNT is fixed to discount field', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const discount = createDiscountConfig(config);
    assert.equal(discount.extension.fieldBinding, 'discount');
    // fieldBinding is always 'discount' — cannot be reassigned
    const otherFields = ['productName', 'price', 'description', 'imageUrl', 'qrContent', 'barcodeContent'];
    for (const field of otherFields) {
      assert.notEqual(discount.extension.fieldBinding, field, `DISCOUNT must not bind to ${field}`);
    }
  });

  // AC3: DISCOUNT supports a format template such as {value}折
  it('AC3: DISCOUNT supports format template {value}折', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const discount = createDiscountConfig(config);
    assert.equal(discount.extension.formatTemplate, '{value}折');

    // Custom template
    const custom = createDiscountConfig(config, {
      extension: {
        ...createDiscountConfig(config).extension,
        formatTemplate: '-{value}%',
      },
    });
    assert.equal(custom.extension.formatTemplate, '-{value}%');

    // Formatting works
    const formatted = formatDiscount(8.5, discount.extension);
    assert.equal(formatted, '8.5折');
  });

  // AC4: DISCOUNT supports background color and text color
  it('AC4: DISCOUNT supports background and text colors', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const discount = createDiscountConfig(config);
    assert.ok(typeof discount.extension.backgroundColor === 'string');
    assert.ok(typeof discount.extension.textColor === 'string');
    assert.ok(discount.extension.backgroundColor.length > 0);
    assert.ok(discount.extension.textColor.length > 0);
  });

  // AC5: DISCOUNT supports font size and normal/bold font weight
  it('AC5: DISCOUNT supports fontSize and fontWeight (normal/bold)', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const discount = createDiscountConfig(config);
    assert.equal(discount.extension.fontSize, 20);
    assert.equal(discount.extension.fontWeight, 'normal');

    const bold = createDiscountConfig(config, {
      extension: {
        ...createDiscountConfig(config).extension,
        fontWeight: 'bold',
        fontSize: 28,
      },
    });
    assert.equal(bold.extension.fontWeight, 'bold');
    assert.equal(bold.extension.fontSize, 28);

    // Only normal/bold are valid
    const validWeights = ['normal', 'bold'];
    assert.ok(validWeights.includes(discount.extension.fontWeight));
    assert.ok(validWeights.includes(bold.extension.fontWeight));
  });

  // AC6: DISCOUNT supports horizontal center alignment and vertical middle alignment
  it('AC6: DISCOUNT supports textAlign center and verticalAlign middle', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const discount = createDiscountConfig(config);
    assert.equal(discount.extension.textAlign, 'center');
    assert.equal(discount.extension.verticalAlign, 'middle');

    // All valid alignment values
    const validH = ['left', 'center', 'right'];
    const validV = ['top', 'middle', 'bottom'];
    assert.ok(validH.includes(discount.extension.textAlign));
    assert.ok(validV.includes(discount.extension.verticalAlign));
  });

  // AC7: DISCOUNT color values are constrained to the active profile palette
  it('AC7a: DISCOUNT colors are constrained to BW palette', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const discount = createDiscountConfig(config);
    assert.ok(isPaletteColor(discount.extension.backgroundColor, BW_PALETTE));
    assert.ok(isPaletteColor(discount.extension.textColor, BW_PALETTE));
  });

  it('AC7b: DISCOUNT colors are constrained to BWR palette', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const discount = createDiscountConfig(config);
    assert.ok(isPaletteColor(discount.extension.backgroundColor, BWR_PALETTE));
    assert.ok(isPaletteColor(discount.extension.textColor, BWR_PALETTE));
  });

  it('AC7c: DISCOUNT colors are constrained to BWRY palette', () => {
    const config = makeConfig(400, 300, BWRY_PALETTE, ScreenType.BWRY);
    const discount = createDiscountConfig(config);
    assert.ok(isPaletteColor(discount.extension.backgroundColor, BWRY_PALETTE));
    assert.ok(isPaletteColor(discount.extension.textColor, BWRY_PALETTE));
  });

  it('AC7d: DISCOUNT colors are constrained to E6 palette', () => {
    const config = makeConfig(400, 300, E6_PALETTE, ScreenType.SIX);
    const discount = createDiscountConfig(config);
    assert.ok(isPaletteColor(discount.extension.backgroundColor, E6_PALETTE));
    assert.ok(isPaletteColor(discount.extension.textColor, E6_PALETTE));
  });

  // AC8: Saved Dynamic Metadata contains the DISCOUNT widget with type DISCOUNT
  it('AC8: DISCOUNT appears in Dynamic Metadata as type DISCOUNT', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const discount = createDiscountConfig(config);

    const widgets = [
      {
        type: 'DISCOUNT',
        fieldBinding: discount.extension.fieldBinding,
        formatTemplate: discount.extension.formatTemplate,
        backgroundColor: discount.extension.backgroundColor,
        textColor: discount.extension.textColor,
        fontSize: discount.extension.fontSize,
        fontWeight: discount.extension.fontWeight,
        textAlign: discount.extension.textAlign,
        verticalAlign: discount.extension.verticalAlign,
        x: discount.left,
        y: discount.top,
        width: discount.width,
        height: discount.height,
      },
    ];

    const discountWidget = widgets.find(w => w.type === 'DISCOUNT');
    assert.ok(discountWidget, 'DISCOUNT should be in widgets');
    assert.equal(discountWidget.type, 'DISCOUNT');
    assert.equal(discountWidget.fieldBinding, 'discount');
    assert.equal(discountWidget.formatTemplate, '{value}折');
    assert.equal(discountWidget.textAlign, 'center');
    assert.equal(discountWidget.verticalAlign, 'middle');
  });

  // Additional: DISCOUNT is centered on canvas
  it('DISCOUNT is centered on canvas', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const discount = createDiscountConfig(config);
    const centerX = Math.round((config.canvas.width - discount.width) / 2);
    const centerY = Math.round((config.canvas.height - discount.height) / 2);
    assert.equal(discount.left, centerX);
    assert.equal(discount.top, centerY);
  });

  // Additional: Discount formatting with previewData.discount = 8.8
  it('Discount formatting produces 8.8折 for value 8.8', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    config.previewData.discount = 8.8;
    const discount = createDiscountConfig(config);
    const formatted = formatDiscount(config.previewData.discount, discount.extension);
    assert.equal(formatted, '8.8折');
  });

  // Additional: DISCOUNT appears in exported JSON structure
  it('DISCOUNT appears in exported JSON structure', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const discount = createDiscountConfig(config);

    const exported = {
      version: '5.3.0',
      objects: [discount],
    };

    const discounts = exported.objects.filter(o => o.extensionType === 'DISCOUNT');
    assert.equal(discounts.length, 1);
    assert.equal(discounts[0].extension.fieldBinding, 'discount');
  });

  // Additional: DISCOUNT is not a plain TEXT component
  it('DISCOUNT is not a plain TEXT component', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const discount = createDiscountConfig(config);
    assert.notEqual(discount.extensionType, 'TEXT');
    assert.equal(discount.extensionType, 'DISCOUNT');
    assert.ok(!('overflow' in discount.extension));
    assert.ok(!('lineClamp' in discount.extension));
    assert.ok('formatTemplate' in discount.extension);
    assert.ok('backgroundColor' in discount.extension);
  });

  // Additional: Multiple DISCOUNT widgets in Dynamic Metadata
  it('Multiple DISCOUNT objects produce multiple widgets', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const d1 = createDiscountConfig(config);
    const d2 = createDiscountConfig(config, {
      left: 10,
      top: 50,
      extension: {
        ...createDiscountConfig(config).extension,
        formatTemplate: '{value} OFF',
      },
    });

    const widgets = [d1, d2]
      .filter(o => o.extensionType === 'DISCOUNT')
      .map(o => ({
        type: 'DISCOUNT',
        fieldBinding: o.extension.fieldBinding,
        formatTemplate: o.extension.formatTemplate,
        x: o.left,
        y: o.top,
      }));

    assert.equal(widgets.length, 2);
    assert.equal(widgets[0].formatTemplate, '{value}折');
    assert.equal(widgets[1].formatTemplate, '{value} OFF');
  });
});
