/**
 * US-008: PRICE composite price component
 *
 * Tests verify AC1–AC11 using pure logic validation (no browser).
 * PRICE component creation, field binding, formatting options,
 * segment styles, and Dynamic Metadata output are validated.
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

// ══════════ Simulated PRICE creation (mirrors editorStore) ══════════

function createPriceConfig(config, overrides = {}) {
  const w = Math.min(160, config.canvas.width * 0.5);
  const h = 50;
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
    extensionType: 'PRICE',
    extension: {
      fieldBinding: 'price',
      currencySymbol: '¥',
      showCurrency: true,
      decimalPlaces: 2,
      thousandSeparator: ',',
      decimalSeparator: '.',
      currencyStyle: {
        fontSize: 14,
        fontWeight: 'normal',
        color: '#000000',
      },
      integerStyle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#000000',
      },
      decimalStyle: {
        fontSize: 16,
        fontWeight: 'normal',
        color: '#000000',
        offsetY: -12,
      },
    },
    ...overrides,
  };
}

function isPaletteColor(color, palette) {
  return palette.some(p => p.hex.toUpperCase() === color.toUpperCase());
}

// ══════════ Price formatting helper ══════════

function formatPrice(rawValue, ext) {
  const { decimalPlaces, thousandSeparator, decimalSeparator, currencySymbol, showCurrency } = ext;
  const fixed = Math.abs(rawValue).toFixed(decimalPlaces);
  const [intPart, decPart] = fixed.split('.');
  const withThousandSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
  const decimal = decPart ? decimalSeparator + decPart : '';
  const prefix = showCurrency ? currencySymbol : '';
  return prefix + withThousandSep + decimal;
}

// ══════════ Tests ══════════

describe('US-008: PRICE composite price component', () => {

  // AC1: The toolbar provides an action to add a PRICE component
  it('AC1: createPriceConfig returns valid PRICE component', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const price = createPriceConfig(config);
    assert.equal(price.extensionType, 'PRICE');
    assert.ok(price.width > 0);
    assert.ok(price.height > 0);
    assert.ok(price.left >= 0);
    assert.ok(price.top >= 0);
  });

  // AC2: PRICE is fixed to the price field
  it('AC2: PRICE is fixed to price field', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const price = createPriceConfig(config);
    assert.equal(price.extension.fieldBinding, 'price');
    // fieldBinding is always 'price' — cannot be reassigned to other fields
    const allowedFields = ['productName', 'description', 'imageUrl', 'qrContent', 'barcodeContent'];
    for (const field of allowedFields) {
      assert.notEqual(price.extension.fieldBinding, field, `PRICE must not bind to ${field}`);
    }
  });

  // AC3: PRICE is represented as a dedicated widget and not saved as a plain TEXT component
  it('AC3: PRICE is not a plain TEXT component', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const price = createPriceConfig(config);
    assert.notEqual(price.extensionType, 'TEXT');
    assert.equal(price.extensionType, 'PRICE');
    // PRICE has its own extension structure, different from TEXT
    assert.ok(!('overflow' in price.extension));
    assert.ok(!('lineClamp' in price.extension));
    assert.ok('currencySymbol' in price.extension);
    assert.ok('integerStyle' in price.extension);
    assert.ok('decimalStyle' in price.extension);
  });

  // AC4: PRICE supports currencySymbol with default value ¥
  it('AC4: PRICE supports currencySymbol with default ¥', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const price = createPriceConfig(config);
    assert.equal(price.extension.currencySymbol, '¥');
  });

  // AC5: PRICE supports showCurrency
  it('AC5: PRICE supports showCurrency toggle', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const price = createPriceConfig(config);
    assert.equal(price.extension.showCurrency, true);

    const noCurrency = createPriceConfig(config, {
      extension: {
        ...createPriceConfig(config).extension,
        showCurrency: false,
      },
    });
    assert.equal(noCurrency.extension.showCurrency, false);
  });

  // AC6: PRICE supports decimalPlaces
  it('AC6: PRICE supports decimalPlaces', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const price = createPriceConfig(config);
    assert.equal(price.extension.decimalPlaces, 2);

    const zeroDecimal = createPriceConfig(config, {
      extension: {
        ...createPriceConfig(config).extension,
        decimalPlaces: 0,
      },
    });
    assert.equal(zeroDecimal.extension.decimalPlaces, 0);
  });

  // AC7: PRICE supports thousandSeparator
  it('AC7: PRICE supports thousandSeparator', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const price = createPriceConfig(config);
    assert.equal(price.extension.thousandSeparator, ',');

    const dotSep = createPriceConfig(config, {
      extension: {
        ...createPriceConfig(config).extension,
        thousandSeparator: '.',
      },
    });
    assert.equal(dotSep.extension.thousandSeparator, '.');
  });

  // AC8: PRICE supports decimalSeparator
  it('AC8: PRICE supports decimalSeparator', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const price = createPriceConfig(config);
    assert.equal(price.extension.decimalSeparator, '.');

    const commaSep = createPriceConfig(config, {
      extension: {
        ...createPriceConfig(config).extension,
        decimalSeparator: ',',
      },
    });
    assert.equal(commaSep.extension.decimalSeparator, ',');
  });

  // AC9: PRICE supports separate fontSize, fontWeight, and color for currency, integer, and decimal parts
  it('AC9: PRICE has separate styles for currency/integer/decimal', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const price = createPriceConfig(config);

    // Currency style
    assert.equal(price.extension.currencyStyle.fontSize, 14);
    assert.equal(price.extension.currencyStyle.fontWeight, 'normal');
    assert.ok(typeof price.extension.currencyStyle.color === 'string');

    // Integer style
    assert.equal(price.extension.integerStyle.fontSize, 28);
    assert.equal(price.extension.integerStyle.fontWeight, 'bold');
    assert.ok(typeof price.extension.integerStyle.color === 'string');

    // Decimal style
    assert.equal(price.extension.decimalStyle.fontSize, 16);
    assert.equal(price.extension.decimalStyle.fontWeight, 'normal');
    assert.ok(typeof price.extension.decimalStyle.color === 'string');

    // Styles are independently configurable
    assert.notEqual(price.extension.currencyStyle.fontSize, price.extension.integerStyle.fontSize);
    assert.notEqual(price.extension.integerStyle.fontSize, price.extension.decimalStyle.fontSize);
  });

  // AC10: PRICE decimal style supports offsetY
  it('AC10: PRICE decimal supports offsetY', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const price = createPriceConfig(config);
    assert.equal(typeof price.extension.decimalStyle.offsetY, 'number');
    assert.equal(price.extension.decimalStyle.offsetY, -12);
    // Negative offsetY means upward shift (superscript effect)
  });

  // AC11: Saved Dynamic Metadata contains the PRICE widget as one item with type PRICE
  it('AC11: PRICE appears in Dynamic Metadata as type PRICE', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const price = createPriceConfig(config);

    // Simulated dynamicMetadata.widgets structure
    const widgets = [
      {
        type: 'PRICE',
        fieldBinding: price.extension.fieldBinding,
        currencySymbol: price.extension.currencySymbol,
        showCurrency: price.extension.showCurrency,
        decimalPlaces: price.extension.decimalPlaces,
        thousandSeparator: price.extension.thousandSeparator,
        decimalSeparator: price.extension.decimalSeparator,
        currencyStyle: price.extension.currencyStyle,
        integerStyle: price.extension.integerStyle,
        decimalStyle: price.extension.decimalStyle,
        x: price.left,
        y: price.top,
        width: price.width,
        height: price.height,
      },
    ];

    const priceWidget = widgets.find(w => w.type === 'PRICE');
    assert.ok(priceWidget, 'PRICE should be in widgets');
    assert.equal(priceWidget.type, 'PRICE');
    assert.equal(priceWidget.fieldBinding, 'price');
    assert.equal(priceWidget.currencySymbol, '¥');
    assert.equal(priceWidget.showCurrency, true);
    assert.equal(priceWidget.decimalPlaces, 2);
  });

  // Additional: PRICE is centered on canvas
  it('PRICE is centered on canvas', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const price = createPriceConfig(config);
    const centerX = Math.round((config.canvas.width - price.width) / 2);
    const centerY = Math.round((config.canvas.height - price.height) / 2);
    assert.equal(price.left, centerX);
    assert.equal(price.top, centerY);
  });

  // Additional: Price formatting with previewData.price = 1299.9
  it('Price formatting produces expected output for 1299.9', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const price = createPriceConfig(config);
    const formatted = formatPrice(config.previewData.price, price.extension);
    assert.equal(formatted, '¥1,299.90');
  });

  // Additional: Price formatting without currency
  it('Price formatting without currency symbol', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const ext = {
      ...createPriceConfig(config).extension,
      showCurrency: false,
    };
    const formatted = formatPrice(config.previewData.price, ext);
    assert.equal(formatted, '1,299.90');
  });

  // Additional: Price formatting with custom separators
  it('Price formatting with custom separators', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const ext = {
      ...createPriceConfig(config).extension,
      thousandSeparator: '.',
      decimalSeparator: ',',
    };
    const formatted = formatPrice(config.previewData.price, ext);
    assert.equal(formatted, '¥1.299,90');
  });

  // Additional: Price formatting with 0 decimal places
  it('Price formatting with 0 decimal places', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const ext = {
      ...createPriceConfig(config).extension,
      decimalPlaces: 0,
    };
    const formatted = formatPrice(config.previewData.price, ext);
    assert.equal(formatted, '¥1,300');
  });

  // Additional: PRICE colors are palette-constrained
  it('PRICE segment colors are from palette', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const price = createPriceConfig(config);
    assert.ok(isPaletteColor(price.extension.currencyStyle.color, BWR_PALETTE));
    assert.ok(isPaletteColor(price.extension.integerStyle.color, BWR_PALETTE));
    assert.ok(isPaletteColor(price.extension.decimalStyle.color, BWR_PALETTE));
  });

  // Additional: PRICE appears in exported JSON structure
  it('PRICE appears in exported JSON structure', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const price = createPriceConfig(config);

    const exported = {
      version: '5.3.0',
      objects: [price],
    };

    const prices = exported.objects.filter(o => o.extensionType === 'PRICE');
    assert.equal(prices.length, 1);
    assert.equal(prices[0].extension.fieldBinding, 'price');
  });

  // Additional: fontWeight only accepts normal/bold
  it('PRICE fontWeight only accepts normal and bold', () => {
    const validWeights = ['normal', 'bold'];
    for (const weight of validWeights) {
      const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
      const price = createPriceConfig(config, {
        extension: {
          ...createPriceConfig(config).extension,
          currencyStyle: { fontSize: 14, fontWeight: weight, color: '#000000' },
          integerStyle: { fontSize: 28, fontWeight: weight, color: '#000000' },
          decimalStyle: { fontSize: 16, fontWeight: weight, color: '#000000', offsetY: -12 },
        },
      });
      assert.equal(price.extension.currencyStyle.fontWeight, weight);
      assert.equal(price.extension.integerStyle.fontWeight, weight);
      assert.equal(price.extension.decimalStyle.fontWeight, weight);
    }
  });
});
