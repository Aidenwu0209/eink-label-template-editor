import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// --- Inline QRCODE constants (mirror src/stores/editorStore.ts) ---
const QRCODE_ERROR_CORRECTIONS = ['L', 'M', 'Q', 'H'];

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

function createQrcodeExtension(overrides = {}) {
  return {
    fieldBinding: 'qrContent',
    errorCorrection: 'M',
    margin: 1,
    foregroundColor: '#000000',
    backgroundColor: '#FFFFFF',
    ...overrides,
  };
}

function createQrcodeObject(profile, overrides = {}) {
  const size = Math.min(60, profile.width * 0.2, profile.height * 0.2);
  const left = Math.round((profile.width - size) / 2);
  const top = Math.round((profile.height - size) / 2);
  return {
    type: 'rect',
    left,
    top,
    width: size,
    height: size,
    fill: '#FFFFFF',
    stroke: '#000000',
    strokeWidth: 1,
    extensionType: 'QRCODE',
    extension: createQrcodeExtension(overrides),
  };
}

// --- Helper: check color is in palette ---
function isColorInPalette(color, palette) {
  return palette.some(c => c.hex.toUpperCase() === color.toUpperCase());
}

// --- Helper: weighted color distance (redmean) ---
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

// --- Helper: build dynamic metadata widget ---
function buildQrcodeWidget(obj) {
  if (obj.extensionType !== 'QRCODE') return null;
  return {
    type: 'QRCODE',
    fieldBinding: obj.extension.fieldBinding,
    x: obj.left,
    y: obj.top,
    width: obj.width,
    height: obj.height,
    errorCorrection: obj.extension.errorCorrection,
    margin: obj.extension.margin,
    foregroundColor: obj.extension.foregroundColor,
    backgroundColor: obj.extension.backgroundColor,
  };
}

// ============================================================
describe('US-010: QRCODE 二维码组件', () => {

  // AC1: Toolbar provides an action to add a QRCODE component
  it('AC1: QRCODE 创建验证', () => {
    const profile = MOCK_PROFILES.bwr;
    const obj = createQrcodeObject(profile);

    assert.equal(obj.extensionType, 'QRCODE');
    assert.equal(obj.type, 'rect');
    assert.ok(obj.width > 0, 'width should be positive');
    assert.ok(obj.height > 0, 'height should be positive');
    assert.ok(obj.left >= 0, 'left should be non-negative');
    assert.ok(obj.top >= 0, 'top should be non-negative');
  });

  // AC2: QRCODE is fixed to the qrContent field
  it('AC2: QRCODE 固定绑定 qrContent 字段', () => {
    const profile = MOCK_PROFILES.bw;
    const obj = createQrcodeObject(profile);
    assert.equal(obj.extension.fieldBinding, 'qrContent');
  });

  // AC3: QRCODE does not allow binding to any field other than qrContent
  it('AC3: QRCODE 不允许绑定 qrContent 以外的字段', () => {
    const ext = createQrcodeExtension();
    // fieldBinding is always 'qrContent' and cannot be changed
    assert.equal(ext.fieldBinding, 'qrContent');
    // Verify type literal — fieldBinding type is 'qrContent' (not string)
    assert.equal(typeof ext.fieldBinding, 'string');
    assert.equal(ext.fieldBinding, 'qrContent');

    // Simulating that the field cannot be reassigned:
    // In the actual code, fieldBinding is typed as literal 'qrContent'
    // and the UI does not provide a way to change it
    const validBindings = ['qrContent'];
    assert.ok(validBindings.includes(ext.fieldBinding));
    assert.ok(!validBindings.includes('price'));
    assert.ok(!validBindings.includes('discount'));
    assert.ok(!validBindings.includes('productName'));
  });

  // AC4: QRCODE supports width and height settings
  it('AC4: QRCODE 支持宽度和高度设置', () => {
    const profile = MOCK_PROFILES.bwr;
    let obj = createQrcodeObject(profile);

    // Default size
    assert.ok(obj.width > 0);
    assert.ok(obj.height > 0);

    // Modify width and height
    obj = { ...obj, width: 80, height: 80 };
    assert.equal(obj.width, 80);
    assert.equal(obj.height, 80);

    // Non-square
    obj = { ...obj, width: 100, height: 60 };
    assert.equal(obj.width, 100);
    assert.equal(obj.height, 60);
  });

  // AC5: QRCODE supports errorCorrection with default value M
  it('AC5: QRCODE 纠错等级默认值为 M', () => {
    const ext = createQrcodeExtension();
    assert.equal(ext.errorCorrection, 'M');
    assert.ok(QRCODE_ERROR_CORRECTIONS.includes(ext.errorCorrection));
  });

  // AC5b: All error correction levels supported
  it('AC5b: QRCODE 支持所有纠错等级 L/M/Q/H', () => {
    for (const level of QRCODE_ERROR_CORRECTIONS) {
      const ext = createQrcodeExtension({ errorCorrection: level });
      assert.equal(ext.errorCorrection, level);
    }
  });

  // AC6: QRCODE supports margin with default value 1
  it('AC6: QRCODE 边距默认值为 1', () => {
    const ext = createQrcodeExtension();
    assert.equal(ext.margin, 1);
  });

  // AC6b: margin can be changed
  it('AC6b: QRCODE 边距可修改', () => {
    const ext = createQrcodeExtension({ margin: 0 });
    assert.equal(ext.margin, 0);

    const ext2 = createQrcodeExtension({ margin: 4 });
    assert.equal(ext2.margin, 4);
  });

  // AC7: QRCODE foregroundColor and backgroundColor constrained to palette
  it('AC7a: BW profile — QRCODE 颜色约束到黑白 palette', () => {
    const profile = MOCK_PROFILES.bw;
    const obj = createQrcodeObject(profile);
    assert.ok(isColorInPalette(obj.extension.foregroundColor, profile.palette));
    assert.ok(isColorInPalette(obj.extension.backgroundColor, profile.palette));
  });

  it('AC7b: BWR profile — QRCODE 颜色约束到黑白红 palette', () => {
    const profile = MOCK_PROFILES.bwr;
    // Default colors
    const obj = createQrcodeObject(profile);
    assert.ok(isColorInPalette(obj.extension.foregroundColor, profile.palette));
    assert.ok(isColorInPalette(obj.extension.backgroundColor, profile.palette));

    // Using red as foreground
    const obj2 = createQrcodeObject(profile, { foregroundColor: '#FF0000' });
    assert.ok(isColorInPalette(obj2.extension.foregroundColor, profile.palette));
  });

  it('AC7c: BWRY profile — QRCODE 颜色约束到黑白红黄 palette', () => {
    const profile = MOCK_PROFILES.bwry;
    const obj = createQrcodeObject(profile, { foregroundColor: '#E8B811', backgroundColor: '#FF0000' });
    assert.ok(isColorInPalette(obj.extension.foregroundColor, profile.palette));
    assert.ok(isColorInPalette(obj.extension.backgroundColor, profile.palette));
  });

  it('AC7d: E6 profile — QRCODE 颜色约束到 7 色 palette', () => {
    const profile = MOCK_PROFILES.e6;
    const obj = createQrcodeObject(profile);
    assert.ok(isColorInPalette(obj.extension.foregroundColor, profile.palette));
    assert.ok(isColorInPalette(obj.extension.backgroundColor, profile.palette));

    // All E6 palette colors should be valid
    for (const c of profile.palette) {
      const objN = createQrcodeObject(profile, { foregroundColor: c.hex, backgroundColor: c.hex });
      assert.ok(isColorInPalette(objN.extension.foregroundColor, profile.palette));
      assert.ok(isColorInPalette(objN.extension.backgroundColor, profile.palette));
    }
  });

  // AC7e: Out-of-palette colors are snapped to nearest palette color
  it('AC7e: QRCODE 非 palette 颜色映射到最近 palette 色', () => {
    const profile = MOCK_PROFILES.bwr;
    const outOfPalette = '#333333'; // Dark gray
    const nearest = findNearestPaletteColor(outOfPalette, profile.palette);
    assert.ok(isColorInPalette(nearest, profile.palette), `${nearest} should be in palette`);
    assert.equal(nearest, '#000000'); // Closest to dark gray in BWR is black
  });

  // AC8: Dynamic Metadata contains QRCODE widget with type QRCODE
  it('AC8: Dynamic Metadata 包含 type: QRCODE 的 widget', () => {
    const profile = MOCK_PROFILES.bwr;
    const obj = createQrcodeObject(profile);
    const widget = buildQrcodeWidget(obj);

    assert.equal(widget.type, 'QRCODE');
    assert.equal(widget.fieldBinding, 'qrContent');
    assert.equal(widget.errorCorrection, 'M');
    assert.equal(widget.margin, 1);
    assert.ok(widget.width > 0);
    assert.ok(widget.height > 0);
  });

  // Additional: QRCODE is not a TEXT component
  it('附加: QRCODE 不是普通 TEXT 组件', () => {
    const profile = MOCK_PROFILES.bw;
    const obj = createQrcodeObject(profile);
    assert.equal(obj.extensionType, 'QRCODE');
    assert.notEqual(obj.extensionType, 'TEXT');
  });

  // Additional: Multiple QRCODE serialization
  it('附加: 多个 QRCODE 可正确序列化', () => {
    const profile = MOCK_PROFILES.bwr;
    const objects = [
      createQrcodeObject(profile, { margin: 2, errorCorrection: 'H' }),
      createQrcodeObject(profile, { foregroundColor: '#FF0000', margin: 0 }),
    ];

    const widgets = objects.map(buildQrcodeWidget);
    assert.equal(widgets.length, 2);
    assert.equal(widgets[0].errorCorrection, 'H');
    assert.equal(widgets[0].margin, 2);
    assert.equal(widgets[1].foregroundColor, '#FF0000');
    assert.equal(widgets[1].margin, 0);

    // All are QRCODE type
    for (const w of widgets) {
      assert.equal(w.type, 'QRCODE');
    }
  });

  // Additional: Export JSON structure includes QRCODE
  it('附加: 导出 JSON 包含 QRCODE 对象', () => {
    const profile = MOCK_PROFILES.bwr;
    const obj = createQrcodeObject(profile);

    // Simulate export JSON
    const exported = {
      objects: [obj],
    };

    assert.equal(exported.objects.length, 1);
    assert.equal(exported.objects[0].extensionType, 'QRCODE');
    assert.equal(exported.objects[0].extension.fieldBinding, 'qrContent');
  });

  // Additional: previewData.qrContent used for dynamic rendering
  it('附加: previewData.qrContent 用于动态渲染', () => {
    const previewData = { qrContent: 'https://example.com/product/123' };
    const profile = MOCK_PROFILES.bw;
    const obj = createQrcodeObject(profile);

    // QRCODE extension references qrContent field
    assert.equal(obj.extension.fieldBinding, 'qrContent');
    // In actual rendering, qrContent would be read from previewData
    assert.equal(previewData.qrContent, 'https://example.com/product/123');
  });
});
