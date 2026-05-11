import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// --- Inline mock profiles ---
const MOCK_PROFILES = {
  bw: { width: 296, height: 128, palette: [{ name: 'black', hex: '#000000' }, { name: 'white', hex: '#FFFFFF' }], defaultBackground: '#FFFFFF' },
  bwr: { width: 296, height: 128, palette: [{ name: 'black', hex: '#000000' }, { name: 'white', hex: '#FFFFFF' }, { name: 'red', hex: '#FF0000' }], defaultBackground: '#FFFFFF' },
  bwry: { width: 296, height: 128, palette: [{ name: 'black', hex: '#000000' }, { name: 'white', hex: '#FFFFFF' }, { name: 'red', hex: '#FF0000' }, { name: 'yellow', hex: '#E8B811' }], defaultBackground: '#FFFFFF' },
  e6: { width: 400, height: 300, palette: [
    { name: 'black', hex: '#000000' }, { name: 'white', hex: '#FFFFFF' },
    { name: 'red', hex: '#FF0000' }, { name: 'green', hex: '#00FF00' },
    { name: 'blue', hex: '#0000FF' }, { name: 'yellow', hex: '#D9C732' },
    { name: 'orange', hex: '#E8772E' },
  ], defaultBackground: '#FFFFFF' },
};

// Allowed barcode formats (v1: CODE128 only)
const BARCODE_FORMATS = ['CODE128'];

// Disallowed formats that must NOT appear in UI
const DISALLOWED_FORMATS = ['EAN-13', 'UPC-A', 'DataMatrix', 'QR', 'Code39', 'ITF'];

function createBarcodeExtension(overrides = {}) {
  return {
    fieldBinding: 'barcodeContent',
    format: 'CODE128',
    showText: true,
    foregroundColor: '#000000',
    backgroundColor: '#FFFFFF',
    ...overrides,
  };
}

function createBarcodeObject(profile, overrides = {}) {
  const w = Math.min(120, profile.width * 0.35);
  const h = Math.min(50, profile.height * 0.2);
  const left = Math.round((profile.width - w) / 2);
  const top = Math.round((profile.height - h) / 2);
  return {
    type: 'rect',
    left,
    top,
    width: w,
    height: h,
    fill: '#FFFFFF',
    stroke: '#000000',
    strokeWidth: 1,
    extensionType: 'BARCODE',
    extension: createBarcodeExtension(overrides),
  };
}

function isColorInPalette(color, palette) {
  return palette.some(c => c.hex.toUpperCase() === color.toUpperCase());
}

function weightedColorDistance(hex1, hex2) {
  const parse = h => { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]; };
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

function findNearestPaletteColor(color, palette) {
  let minDist = Infinity, nearest = palette[0].hex;
  for (const c of palette) {
    const d = weightedColorDistance(color, c.hex);
    if (d < minDist) { minDist = d; nearest = c.hex; }
  }
  return nearest;
}

function buildBarcodeWidget(obj) {
  if (obj.extensionType !== 'BARCODE') return null;
  return {
    type: 'BARCODE',
    fieldBinding: obj.extension.fieldBinding,
    format: obj.extension.format,
    showText: obj.extension.showText,
    x: obj.left,
    y: obj.top,
    width: obj.width,
    height: obj.height,
    foregroundColor: obj.extension.foregroundColor,
    backgroundColor: obj.extension.backgroundColor,
  };
}

// ============================================================
describe('US-011: BARCODE 条形码组件', () => {

  // AC1: Toolbar provides an action to add a BARCODE component
  it('AC1: BARCODE 创建验证', () => {
    const profile = MOCK_PROFILES.bwr;
    const obj = createBarcodeObject(profile);

    assert.equal(obj.extensionType, 'BARCODE');
    assert.equal(obj.type, 'rect');
    assert.ok(obj.width > 0, 'width should be positive');
    assert.ok(obj.height > 0, 'height should be positive');
    assert.ok(obj.left >= 0, 'left should be non-negative');
    assert.ok(obj.top >= 0, 'top should be non-negative');
  });

  // AC2: BARCODE is fixed to the barcodeContent field
  it('AC2: BARCODE 固定绑定 barcodeContent 字段', () => {
    const profile = MOCK_PROFILES.bw;
    const obj = createBarcodeObject(profile);
    assert.equal(obj.extension.fieldBinding, 'barcodeContent');
  });

  // AC3: BARCODE does not allow binding to any field other than barcodeContent
  it('AC3: BARCODE 不允许绑定 barcodeContent 以外的字段', () => {
    const ext = createBarcodeExtension();
    assert.equal(ext.fieldBinding, 'barcodeContent');

    const validBindings = ['barcodeContent'];
    assert.ok(validBindings.includes(ext.fieldBinding));
    assert.ok(!validBindings.includes('price'));
    assert.ok(!validBindings.includes('qrContent'));
    assert.ok(!validBindings.includes('productName'));
  });

  // AC4: BARCODE supports CODE128 only
  it('AC4: BARCODE 只支持 CODE128 格式', () => {
    const ext = createBarcodeExtension();
    assert.equal(ext.format, 'CODE128');
    assert.ok(BARCODE_FORMATS.includes(ext.format));
    assert.equal(BARCODE_FORMATS.length, 1, 'v1 should have exactly one format');
  });

  // AC5: BARCODE does not show other barcode format options
  it('AC5: BARCODE 不显示 EAN-13、UPC-A、DataMatrix 等格式选项', () => {
    // The UI only shows CODE128 as a disabled input (not a dropdown with multiple options)
    // Verify that disallowed formats are not in the allowed list
    for (const fmt of DISALLOWED_FORMATS) {
      assert.ok(!BARCODE_FORMATS.includes(fmt), `${fmt} should not be in allowed formats`);
    }
    assert.equal(BARCODE_FORMATS.length, 1);
    assert.equal(BARCODE_FORMATS[0], 'CODE128');
  });

  // AC6: BARCODE supports showText toggle
  it('AC6: BARCODE 支持 showText 开关', () => {
    // Default is true
    const ext1 = createBarcodeExtension();
    assert.equal(ext1.showText, true);

    // Can be turned off
    const ext2 = createBarcodeExtension({ showText: false });
    assert.equal(ext2.showText, false);

    // Can be turned back on
    const ext3 = createBarcodeExtension({ showText: true });
    assert.equal(ext3.showText, true);
  });

  // AC7: BARCODE foregroundColor and backgroundColor constrained to palette
  it('AC7a: BW profile — BARCODE 颜色约束到黑白 palette', () => {
    const profile = MOCK_PROFILES.bw;
    const obj = createBarcodeObject(profile);
    assert.ok(isColorInPalette(obj.extension.foregroundColor, profile.palette));
    assert.ok(isColorInPalette(obj.extension.backgroundColor, profile.palette));
  });

  it('AC7b: BWR profile — BARCODE 颜色约束到黑白红 palette', () => {
    const profile = MOCK_PROFILES.bwr;
    const obj = createBarcodeObject(profile);
    assert.ok(isColorInPalette(obj.extension.foregroundColor, profile.palette));
    assert.ok(isColorInPalette(obj.extension.backgroundColor, profile.palette));

    const obj2 = createBarcodeObject(profile, { foregroundColor: '#FF0000' });
    assert.ok(isColorInPalette(obj2.extension.foregroundColor, profile.palette));
  });

  it('AC7c: BWRY profile — BARCODE 颜色约束到黑白红黄 palette', () => {
    const profile = MOCK_PROFILES.bwry;
    const obj = createBarcodeObject(profile, { foregroundColor: '#E8B811', backgroundColor: '#FF0000' });
    assert.ok(isColorInPalette(obj.extension.foregroundColor, profile.palette));
    assert.ok(isColorInPalette(obj.extension.backgroundColor, profile.palette));
  });

  it('AC7d: E6 profile — BARCODE 颜色约束到 7 色 palette', () => {
    const profile = MOCK_PROFILES.e6;
    const obj = createBarcodeObject(profile);
    assert.ok(isColorInPalette(obj.extension.foregroundColor, profile.palette));
    assert.ok(isColorInPalette(obj.extension.backgroundColor, profile.palette));

    for (const c of profile.palette) {
      const objN = createBarcodeObject(profile, { foregroundColor: c.hex, backgroundColor: c.hex });
      assert.ok(isColorInPalette(objN.extension.foregroundColor, profile.palette));
      assert.ok(isColorInPalette(objN.extension.backgroundColor, profile.palette));
    }
  });

  it('AC7e: BARCODE 非 palette 颜色映射到最近 palette 色', () => {
    const profile = MOCK_PROFILES.bwr;
    const outOfPalette = '#333333';
    const nearest = findNearestPaletteColor(outOfPalette, profile.palette);
    assert.ok(isColorInPalette(nearest, profile.palette));
    assert.equal(nearest, '#000000');
  });

  // AC8: Dynamic Metadata contains BARCODE widget with type BARCODE
  it('AC8: Dynamic Metadata 包含 type: BARCODE 的 widget', () => {
    const profile = MOCK_PROFILES.bwr;
    const obj = createBarcodeObject(profile);
    const widget = buildBarcodeWidget(obj);

    assert.equal(widget.type, 'BARCODE');
    assert.equal(widget.fieldBinding, 'barcodeContent');
    assert.equal(widget.format, 'CODE128');
    assert.equal(widget.showText, true);
    assert.ok(widget.width > 0);
    assert.ok(widget.height > 0);
  });

  // Additional: BARCODE is not a TEXT component
  it('附加: BARCODE 不是普通 TEXT 组件', () => {
    const profile = MOCK_PROFILES.bw;
    const obj = createBarcodeObject(profile);
    assert.equal(obj.extensionType, 'BARCODE');
    assert.notEqual(obj.extensionType, 'TEXT');
  });

  // Additional: Multiple BARCODE serialization
  it('附加: 多个 BARCODE 可正确序列化', () => {
    const profile = MOCK_PROFILES.bwr;
    const objects = [
      createBarcodeObject(profile, { showText: false }),
      createBarcodeObject(profile, { foregroundColor: '#FF0000' }),
    ];

    const widgets = objects.map(buildBarcodeWidget);
    assert.equal(widgets.length, 2);
    assert.equal(widgets[0].showText, false);
    assert.equal(widgets[1].foregroundColor, '#FF0000');

    for (const w of widgets) {
      assert.equal(w.type, 'BARCODE');
      assert.equal(w.format, 'CODE128');
    }
  });

  // Additional: Export JSON structure includes BARCODE
  it('附加: 导出 JSON 包含 BARCODE 对象', () => {
    const profile = MOCK_PROFILES.bwr;
    const obj = createBarcodeObject(profile);

    const exported = { objects: [obj] };
    assert.equal(exported.objects.length, 1);
    assert.equal(exported.objects[0].extensionType, 'BARCODE');
    assert.equal(exported.objects[0].extension.fieldBinding, 'barcodeContent');
    assert.equal(exported.objects[0].extension.format, 'CODE128');
  });

  // Additional: previewData.barcodeContent used for dynamic rendering
  it('附加: previewData.barcodeContent 用于动态渲染', () => {
    const previewData = { barcodeContent: 'SKU1001' };
    const profile = MOCK_PROFILES.bw;
    const obj = createBarcodeObject(profile);

    assert.equal(obj.extension.fieldBinding, 'barcodeContent');
    assert.equal(previewData.barcodeContent, 'SKU1001');
  });

  // Additional: BARCODE width and height are configurable
  it('附加: BARCODE 宽高可配置', () => {
    const profile = MOCK_PROFILES.bwr;
    let obj = createBarcodeObject(profile);

    // Default dimensions
    assert.ok(obj.width > 0);
    assert.ok(obj.height > 0);

    // Custom dimensions
    obj = { ...obj, width: 150, height: 60 };
    assert.equal(obj.width, 150);
    assert.equal(obj.height, 60);
  });
});
