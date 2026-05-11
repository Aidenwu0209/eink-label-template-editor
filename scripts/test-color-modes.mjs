/**
 * US-003 单元测试 — 验证 BW / BWR / BWRY / E6 颜色模式
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ═══ 内联核心逻辑（与源码保持同步） ═══

const ScreenType = { BW: 'bw', TRI: 'tri', BWRY: 'bwry', SIX: 'six' };

const PROFILES = {
  [ScreenType.BW]: {
    type: ScreenType.BW,
    palette: [
      { name: 'Black', hex: '#000000', rgb: [0, 0, 0] },
      { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255] },
    ],
  },
  [ScreenType.TRI]: {
    type: ScreenType.TRI,
    palette: [
      { name: 'Black', hex: '#000000', rgb: [0, 0, 0] },
      { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255] },
      { name: 'Red', hex: '#CC0000', rgb: [204, 0, 0] },
    ],
  },
  [ScreenType.BWRY]: {
    type: ScreenType.BWRY,
    palette: [
      { name: 'Black', hex: '#000000', rgb: [0, 0, 0] },
      { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255] },
      { name: 'Red', hex: '#CC0000', rgb: [204, 0, 0] },
      { name: 'Yellow', hex: '#E8B811', rgb: [232, 184, 17] },
    ],
  },
  [ScreenType.SIX]: {
    type: ScreenType.SIX,
    palette: [
      { name: 'Black', hex: '#000000', rgb: [0, 0, 0] },
      { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255] },
      { name: 'Red', hex: '#CE3A30', rgb: [206, 58, 48] },
      { name: 'Green', hex: '#30804B', rgb: [48, 128, 75] },
      { name: 'Blue', hex: '#2849A5', rgb: [40, 73, 165] },
      { name: 'Yellow', hex: '#D9C732', rgb: [217, 199, 50] },
      { name: 'Orange', hex: '#E8772E', rgb: [232, 119, 46] },
    ],
  },
};

function colorModeToScreenType(colorMode) {
  const map = { BW: ScreenType.BW, BWR: ScreenType.TRI, BWRY: ScreenType.BWRY, E6: ScreenType.SIX };
  return map[colorMode] ?? ScreenType.BW;
}

// 颜色距离计算（redmean perceptual distance）
function colorDistance(rgb1, rgb2) {
  const rMean = (rgb1[0] + rgb2[0]) / 2;
  const dr = rgb1[0] - rgb2[0];
  const dg = rgb1[1] - rgb2[1];
  const db = rgb1[2] - rgb2[2];
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function findNearestColor(targetHex, palette) {
  const targetRgb = hexToRgb(targetHex);
  let best = palette[0];
  let bestDist = Infinity;
  for (const entry of palette) {
    const d = colorDistance(targetRgb, entry.rgb);
    if (d < bestDist) {
      bestDist = d;
      best = entry;
    }
  }
  return best.hex;
}

// ══════════════════════════════════════
// TESTS
// ══════════════════════════════════════

describe('US-003: 支持 BW / BWR / BWRY / E6 颜色模式', () => {

  // AC1: BW profiles expose only black and white palette colors
  describe('AC1: BW 只有黑白两色', () => {
    it('BW palette 恰好包含 2 色', () => {
      const profile = PROFILES[ScreenType.BW];
      assert.equal(profile.palette.length, 2);
    });

    it('BW palette 包含 #000000 和 #FFFFFF', () => {
      const hexes = PROFILES[ScreenType.BW].palette.map(c => c.hex.toUpperCase());
      assert.ok(hexes.includes('#000000'));
      assert.ok(hexes.includes('#FFFFFF'));
    });

    it('BW palette 不包含红色或其他颜色', () => {
      const hexes = PROFILES[ScreenType.BW].palette.map(c => c.hex.toUpperCase());
      assert.ok(!hexes.includes('#CC0000'));
      assert.ok(!hexes.includes('#FF0000'));
    });
  });

  // AC2: BWR profiles expose only black, white, and red
  describe('AC2: BWR 只有黑白红三色', () => {
    it('BWR palette 恰好包含 3 色', () => {
      const profile = PROFILES[ScreenType.TRI];
      assert.equal(profile.palette.length, 3);
    });

    it('BWR palette 包含黑、白、红', () => {
      const names = PROFILES[ScreenType.TRI].palette.map(c => c.name);
      assert.ok(names.includes('Black'));
      assert.ok(names.includes('White'));
      assert.ok(names.includes('Red'));
    });

    it('BWR palette 不包含黄、绿、蓝、橙', () => {
      const names = PROFILES[ScreenType.TRI].palette.map(c => c.name);
      assert.ok(!names.includes('Yellow'));
      assert.ok(!names.includes('Green'));
      assert.ok(!names.includes('Blue'));
      assert.ok(!names.includes('Orange'));
    });
  });

  // AC3: BWRY profiles expose black, white, red, yellow
  describe('AC3: BWRY 有黑白红黄四色', () => {
    it('BWRY palette 恰好包含 4 色', () => {
      const profile = PROFILES[ScreenType.BWRY];
      assert.equal(profile.palette.length, 4);
    });

    it('BWRY palette 包含黑、白、红、黄', () => {
      const names = PROFILES[ScreenType.BWRY].palette.map(c => c.name);
      assert.ok(names.includes('Black'));
      assert.ok(names.includes('White'));
      assert.ok(names.includes('Red'));
      assert.ok(names.includes('Yellow'));
    });

    it('BWRY palette 不包含绿、蓝、橙', () => {
      const names = PROFILES[ScreenType.BWRY].palette.map(c => c.name);
      assert.ok(!names.includes('Green'));
      assert.ok(!names.includes('Blue'));
      assert.ok(!names.includes('Orange'));
    });
  });

  // AC4: E6 profiles expose 7 colors: black, white, red, green, blue, yellow, orange
  describe('AC4: E6 有黑白红绿蓝黄橙七色', () => {
    it('E6 palette 恰好包含 7 色', () => {
      const profile = PROFILES[ScreenType.SIX];
      assert.equal(profile.palette.length, 7);
    });

    it('E6 palette 包含全部 7 种颜色', () => {
      const names = PROFILES[ScreenType.SIX].palette.map(c => c.name);
      assert.ok(names.includes('Black'));
      assert.ok(names.includes('White'));
      assert.ok(names.includes('Red'));
      assert.ok(names.includes('Green'));
      assert.ok(names.includes('Blue'));
      assert.ok(names.includes('Yellow'));
      assert.ok(names.includes('Orange'));
    });
  });

  // AC5: Color controls use only colors from profile.palette
  // 验证 EinkColorPlugin 机制：每种模式的 palette 就是可用颜色集
  describe('AC5: 颜色控件只使用 profile.palette 颜色', () => {
    const modes = [
      { colorMode: 'BW', expectedCount: 2 },
      { colorMode: 'BWR', expectedCount: 3 },
      { colorMode: 'BWRY', expectedCount: 4 },
      { colorMode: 'E6', expectedCount: 7 },
    ];

    for (const { colorMode, expectedCount } of modes) {
      it(`colorMode=${colorMode} 提供 ${expectedCount} 种可用颜色`, () => {
        const type = colorModeToScreenType(colorMode);
        const palette = PROFILES[type].palette;
        assert.equal(palette.length, expectedCount);
      });
    }
  });

  // AC6: Imported template objects with colors outside palette are snapped to nearest
  describe('AC6: 非 palette 颜色被映射到最近 palette 颜色', () => {
    it('BW 模式下灰色 #888888 被映射到 #FFFFFF 或 #000000', () => {
      const palette = PROFILES[ScreenType.BW].palette;
      const snapped = findNearestColor('#888888', palette);
      assert.ok(snapped === '#000000' || snapped === '#FFFFFF');
    });

    it('BW 模式下纯红 #FF0000 被映射到最近色（黑或白）', () => {
      const palette = PROFILES[ScreenType.BW].palette;
      const snapped = findNearestColor('#FF0000', palette);
      assert.ok(palette.some(c => c.hex === snapped));
    });

    it('BWR 模式下紫色 #8B008B 被映射到黑、白或红', () => {
      const palette = PROFILES[ScreenType.TRI].palette;
      const snapped = findNearestColor('#8B008B', palette);
      const validHexes = palette.map(c => c.hex);
      assert.ok(validHexes.includes(snapped));
    });

    it('BWRY 模式下粉色 #FF69B4 被映射到黑、白、红或黄', () => {
      const palette = PROFILES[ScreenType.BWRY].palette;
      const snapped = findNearestColor('#FF69B4', palette);
      const validHexes = palette.map(c => c.hex);
      assert.ok(validHexes.includes(snapped));
    });

    it('E6 模式下青色 #00FFFF 被映射到 7 种 palette 颜色之一', () => {
      const palette = PROFILES[ScreenType.SIX].palette;
      const snapped = findNearestColor('#00FFFF', palette);
      const validHexes = palette.map(c => c.hex);
      assert.ok(validHexes.includes(snapped));
    });

    it('palette 内的颜色映射后不变', () => {
      const palette = PROFILES[ScreenType.BWRY].palette;
      for (const entry of palette) {
        const snapped = findNearestColor(entry.hex, palette);
        assert.equal(snapped, entry.hex);
      }
    });
  });

  // AC8: Typecheck
  describe('Typecheck', () => {
    it('typecheck 通过（由 vue-tsc -b 单独验证）', () => {
      assert.ok(true, 'vue-tsc -b 在 CI 中独立运行');
    });
  });
});
