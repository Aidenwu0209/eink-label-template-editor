import { describe, expect, it } from 'vitest';
import { EinkColorPlugin } from '../EinkColorPlugin';
import { ScreenType } from '@/screen/types';
import type { BootConfig } from '@/boot/types';
import { MARKET_PROFILES } from '@/i18n/market';

const config: BootConfig = {
  mode: 'create',
  canvas: { width: 296, height: 128 },
  screen: {
    type: ScreenType.BW,
    profile: {
      type: ScreenType.BW,
      displayName: 'BW',
      defaultWidth: 296,
      defaultHeight: 128,
      dpi: 110,
      maxColors: 2,
      defaultBackground: '#FFFFFF',
      palette: [
        { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
        { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
      ],
      dithering: { algorithm: 'none', strength: 0, serpentine: false },
      supportsPartialRefresh: true,
    },
    palette: [],
  },
  previewData: {},
  locale: 'zh-CN',
  market: 'CN',
  marketProfile: MARKET_PROFILES.CN,
  api: { baseUrl: '/api' },
};

function createPlugin(): EinkColorPlugin {
  return new EinkColorPlugin({
    config,
    canvas: { on: () => undefined, off: () => undefined },
    editor: {},
    eventBus: {},
  } as any);
}

describe('EinkColorPlugin transparent paint handling', () => {
  it('does not snap transparent helper fills to the first palette color', () => {
    const plugin = createPlugin();

    expect(plugin.snapColorToPalette('transparent')).toBe('transparent');
    expect(plugin.snapColorToPalette('rgba(255,255,255,0)')).toBe('rgba(255,255,255,0)');
  });

  it('leaves unsupported CSS color strings unchanged instead of forcing black', () => {
    const plugin = createPlugin();

    expect(plugin.snapColorToPalette('rgba(255,255,255,0.5)')).toBe('rgba(255,255,255,0.5)');
  });
});
