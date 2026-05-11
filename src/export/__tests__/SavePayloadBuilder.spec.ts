import { describe, expect, it } from 'vitest';
import { buildSavePayload } from '../SavePayloadBuilder';
import type { BootConfig, FabricJSON } from '@/boot/types';
import { MARKET_PROFILES } from '@/i18n';
import { BWRY_PROFILE, SIX_PROFILE } from '@/screen/profiles';
import { ScreenType } from '@/screen/types';

function baseConfig(): BootConfig {
  return {
    mode: 'create',
    canvas: { width: 296, height: 128 },
    screen: {
      type: ScreenType.BWRY,
      profile: BWRY_PROFILE,
      palette: BWRY_PROFILE.palette,
    },
    previewData: { skuName: 'A-100 货架', productName: '测试商品' },
    locale: 'zh-CN',
    market: 'CN',
    marketProfile: MARKET_PROFILES.CN,
    api: { baseUrl: '/api' },
  };
}

describe('SavePayloadBuilder', () => {
  it('exports custom text field widgets for backend dynamic binding', () => {
    const config = baseConfig();
    const fabricJson: FabricJSON = {
      version: '7.0',
      objects: [
        {
          type: 'textbox',
          left: 12,
          top: 18,
          width: 90,
          height: 20,
          fontSize: 14,
          fill: '#000000',
          extensionType: 'TEXT',
          extension: {
            fieldBinding: 'skuName',
            overflow: 'ellipsis',
            lineClamp: 1,
            verticalAlign: 'top',
          },
        } as any,
      ],
    };

    const payload = buildSavePayload(config, fabricJson, 'data:image/png;base64,xxx');

    expect(payload.staticDynamic.dynamicMetadata.widgets).toEqual([
      expect.objectContaining({
        type: 'TEXT',
        fieldId: 'skuName',
        defaultValue: 'A-100 货架',
        x: 12,
        y: 18,
        width: 90,
        height: 20,
      }),
    ]);
  });

  it('uses the current runtime profile in saved payload after color mode changes', () => {
    const config = {
      ...baseConfig(),
      screen: {
        type: ScreenType.SIX,
        profile: SIX_PROFILE,
        palette: SIX_PROFILE.palette,
      },
      sourceProfile: {
        width: 296,
        height: 128,
        colorMode: 'E6' as const,
        palette: SIX_PROFILE.palette.map((color) => ({ name: color.name, value: color.hex })),
      },
    };

    const payload = buildSavePayload(config, { version: '7.0', objects: [] }, 'data:image/png;base64,xxx');

    expect(payload.profile.width).toBe(296);
    expect(payload.profile.height).toBe(128);
    expect(payload.profile.colorMode).toBe('E6');
    expect(payload.profile.palette).toHaveLength(7);
  });
});
