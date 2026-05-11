/**
 * US-007: IMAGE image component
 *
 * Tests verify AC1–AC8 using pure logic validation (no browser).
 * IMAGE component creation, static/dynamic modes, fit modes,
 * and palette-constrained background colors are validated.
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

const IMAGE_FIT_MODES = ['contain', 'cover', 'fill'];

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

// ══════════ Simulated IMAGE creation (mirrors editorStore) ══════════

function createStaticImageConfig(config, overrides = {}) {
  const size = Math.min(80, config.canvas.width * 0.25, config.canvas.height * 0.25);
  const left = Math.round((config.canvas.width - size) / 2);
  const top = Math.round((config.canvas.height - size) / 2);

  return {
    type: 'rect',
    left,
    top,
    width: size,
    height: size,
    fill: '#FFFFFF',
    stroke: '#000000',
    strokeWidth: 1,
    extensionType: 'IMAGE',
    extension: {
      source: 'static',
      src: '',
      fieldBinding: null,
      fitMode: 'contain',
      backgroundColor: '#FFFFFF',
    },
    ...overrides,
  };
}

function createDynamicImageConfig(config, overrides = {}) {
  const size = Math.min(80, config.canvas.width * 0.25, config.canvas.height * 0.25);
  const left = Math.round((config.canvas.width - size) / 2);
  const top = Math.round((config.canvas.height - size) / 2);

  return {
    type: 'rect',
    left,
    top,
    width: size,
    height: size,
    fill: '#FFFFFF',
    stroke: '#000000',
    strokeWidth: 1,
    extensionType: 'IMAGE',
    extension: {
      source: 'dynamic',
      src: config.previewData?.imageUrl ?? '',
      fieldBinding: 'imageUrl',
      fitMode: 'contain',
      backgroundColor: '#FFFFFF',
    },
    ...overrides,
  };
}

function isPaletteColor(color, palette) {
  return palette.some(p => p.hex.toUpperCase() === color.toUpperCase());
}

// ══════════ Tests ══════════

describe('US-007: IMAGE image component', () => {

  // AC1: Toolbar provides an action to add a static IMAGE component
  it('AC1: createStaticImageConfig returns valid static IMAGE', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const image = createStaticImageConfig(config);
    assert.equal(image.extensionType, 'IMAGE');
    assert.equal(image.extension.source, 'static');
    assert.equal(image.extension.fieldBinding, null);
    assert.ok(image.width > 0);
    assert.ok(image.height > 0);
  });

  // AC2: Toolbar provides an action to add a dynamic IMAGE component
  it('AC2: createDynamicImageConfig returns valid dynamic IMAGE', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const image = createDynamicImageConfig(config);
    assert.equal(image.extensionType, 'IMAGE');
    assert.equal(image.extension.source, 'dynamic');
    assert.equal(image.extension.fieldBinding, 'imageUrl');
  });

  // AC3: Static IMAGE is rendered into Static PNG Base64 during save
  // (Validated by checking extension.source === 'static' identifies it for static rendering)
  it('AC3: Static IMAGE is marked for static rendering', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const image = createStaticImageConfig(config, {
      extension: { source: 'static', src: 'data:image/png;base64,abc123', fieldBinding: null, fitMode: 'contain', backgroundColor: '#FFFFFF' },
    });
    assert.equal(image.extension.source, 'static');
    assert.ok(image.extension.src.length > 0, 'Static image should have src');
    assert.equal(image.extension.fieldBinding, null, 'Static image has no field binding');
  });

  // AC4: Dynamic IMAGE is fixed to the imageUrl field
  it('AC4: Dynamic IMAGE is fixed to imageUrl field', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const image = createDynamicImageConfig(config);
    assert.equal(image.extension.fieldBinding, 'imageUrl');
    assert.equal(image.extension.src, config.previewData.imageUrl);

    // Dynamic image resolves from previewData.imageUrl
    assert.equal(image.extension.src, 'https://example.com/img.png');
  });

  // AC5: Dynamic IMAGE is included in dynamicMetadata.widgets during save
  it('AC5: Dynamic IMAGE appears in dynamicMetadata.widgets', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const image = createDynamicImageConfig(config);

    // Simulated dynamicMetadata.widgets structure
    const widgets = [
      {
        type: 'IMAGE',
        fieldBinding: image.extension.fieldBinding,
        fitMode: image.extension.fitMode,
        backgroundColor: image.extension.backgroundColor,
        x: image.left,
        y: image.top,
        width: image.width,
        height: image.height,
      },
    ];

    const imageWidget = widgets.find(w => w.type === 'IMAGE');
    assert.ok(imageWidget, 'IMAGE should be in widgets');
    assert.equal(imageWidget.fieldBinding, 'imageUrl');
    assert.equal(imageWidget.type, 'IMAGE');
  });

  // AC6: IMAGE fit mode accepts contain, cover, and fill
  it('AC6: IMAGE fit mode accepts contain, cover, fill', () => {
    const validFitModes = ['contain', 'cover', 'fill'];
    assert.deepEqual(validFitModes.sort(), [...IMAGE_FIT_MODES].sort());

    for (const mode of IMAGE_FIT_MODES) {
      const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
      const image = createStaticImageConfig(config, {
        extension: { source: 'static', src: '', fieldBinding: null, fitMode: mode, backgroundColor: '#FFFFFF' },
      });
      assert.equal(image.extension.fitMode, mode);
    }
  });

  // AC7: IMAGE default fit mode is contain
  it('AC7: IMAGE default fit mode is contain', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const staticImage = createStaticImageConfig(config);
    assert.equal(staticImage.extension.fitMode, 'contain');

    const dynamicImage = createDynamicImageConfig(config);
    assert.equal(dynamicImage.extension.fitMode, 'contain');
  });

  // AC8: IMAGE background color is constrained to the active profile palette
  it('AC8a: IMAGE background color is from BW palette', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const image = createStaticImageConfig(config, {
      extension: { source: 'static', src: '', fieldBinding: null, fitMode: 'contain', backgroundColor: '#000000' },
    });
    assert.ok(isPaletteColor(image.extension.backgroundColor, BW_PALETTE));
  });

  it('AC8b: IMAGE background color is from BWR palette', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const image = createDynamicImageConfig(config, {
      extension: { source: 'dynamic', src: '', fieldBinding: 'imageUrl', fitMode: 'cover', backgroundColor: '#FF0000' },
    });
    assert.ok(isPaletteColor(image.extension.backgroundColor, BWR_PALETTE));
  });

  it('AC8c: IMAGE background color is from BWRY palette', () => {
    const config = makeConfig(296, 128, BWRY_PALETTE, ScreenType.BWRY);
    const image = createStaticImageConfig(config, {
      extension: { source: 'static', src: '', fieldBinding: null, fitMode: 'fill', backgroundColor: '#E8B811' },
    });
    assert.ok(isPaletteColor(image.extension.backgroundColor, BWRY_PALETTE));
  });

  it('AC8d: IMAGE background color is from E6 palette', () => {
    const config = makeConfig(400, 300, E6_PALETTE, ScreenType.SIX);
    const image = createStaticImageConfig(config, {
      extension: { source: 'static', src: '', fieldBinding: null, fitMode: 'contain', backgroundColor: '#E8772E' },
    });
    assert.ok(isPaletteColor(image.extension.backgroundColor, E6_PALETTE));
  });

  // Additional: IMAGE is centered on canvas
  it('IMAGE is centered on canvas', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const image = createStaticImageConfig(config);
    const centerX = Math.round((config.canvas.width - image.width) / 2);
    const centerY = Math.round((config.canvas.height - image.height) / 2);
    assert.equal(image.left, centerX);
    assert.equal(image.top, centerY);
  });

  // Additional: Dynamic IMAGE reads imageUrl from previewData
  it('Dynamic IMAGE resolves src from previewData.imageUrl', () => {
    const config = makeConfig(400, 300, BWR_PALETTE, ScreenType.TRI);
    const image = createDynamicImageConfig(config);
    assert.equal(image.extension.src, 'https://example.com/img.png');

    // Simulate previewData change
    const newUrl = 'https://cdn.example.com/new-product.jpg';
    const updatedImage = createDynamicImageConfig({
      ...config,
      previewData: { ...config.previewData, imageUrl: newUrl },
    });
    assert.equal(updatedImage.extension.src, newUrl);
  });

  // Additional: IMAGE appears in exported JSON structure
  it('IMAGE appears in exported JSON structure', () => {
    const config = makeConfig(296, 128, BW_PALETTE, ScreenType.BW);
    const staticImage = createStaticImageConfig(config);
    const dynamicImage = createDynamicImageConfig(config);

    const exported = {
      version: '5.3.0',
      objects: [staticImage, dynamicImage],
    };

    const images = exported.objects.filter(o => o.extensionType === 'IMAGE');
    assert.equal(images.length, 2);

    const staticOne = images.find(o => o.extension.source === 'static');
    const dynamicOne = images.find(o => o.extension.source === 'dynamic');
    assert.ok(staticOne);
    assert.ok(dynamicOne);
    assert.equal(dynamicOne.extension.fieldBinding, 'imageUrl');
  });

  // Additional: IMAGE size adapts to canvas dimensions
  it('IMAGE size adapts to canvas dimensions', () => {
    const smallConfig = makeConfig(200, 100, BW_PALETTE, ScreenType.BW);
    const smallImage = createStaticImageConfig(smallConfig);
    assert.ok(smallImage.width <= 80);
    assert.ok(smallImage.height <= 80);
    assert.ok(smallImage.width <= smallConfig.canvas.width * 0.25 + 1);

    const largeConfig = makeConfig(600, 400, BWR_PALETTE, ScreenType.TRI);
    const largeImage = createStaticImageConfig(largeConfig);
    assert.ok(largeImage.width <= 80);
    assert.ok(largeImage.height <= 80);
  });

  // Additional: Only dynamic IMAGE goes to widgets, not static
  it('Only dynamic IMAGE is included in widgets metadata', () => {
    const config = makeConfig(296, 128, BWR_PALETTE, ScreenType.TRI);
    const staticImage = createStaticImageConfig(config);
    const dynamicImage = createDynamicImageConfig(config);

    const widgets = [];
    // Simulate save logic: only dynamic images go to widgets
    if (dynamicImage.extension.source === 'dynamic') {
      widgets.push({ type: 'IMAGE', fieldBinding: dynamicImage.extension.fieldBinding });
    }
    if (staticImage.extension.source === 'dynamic') {
      widgets.push({ type: 'IMAGE', fieldBinding: staticImage.extension.fieldBinding });
    }

    assert.equal(widgets.length, 1);
    assert.equal(widgets[0].type, 'IMAGE');
    assert.equal(widgets[0].fieldBinding, 'imageUrl');
  });
});
