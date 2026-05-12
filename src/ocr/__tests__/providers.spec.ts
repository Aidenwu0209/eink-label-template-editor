import { describe, expect, it } from 'vitest';
import { buildOcrRequestOptions, resolveProviderMode, resolveRecognitionEndpoint } from '../providers';
import type { OcrProviderMode, OcrProviderOptions } from '../types';
import { ScreenType } from '@/screen/types';
import { MARKET_PROFILES } from '@/i18n/market';

const providerOptions: OcrProviderOptions = {
  mode: 'local-v5',
  apiEndpoint: 'https://ocr.example.com/price-tag',
  config: {
    mode: 'create',
    canvas: { width: 296, height: 128 },
    screen: {
      type: ScreenType.TRI,
      profile: {
        type: ScreenType.TRI,
        displayName: 'BWR',
        defaultWidth: 296,
        defaultHeight: 128,
        dpi: 110,
        maxColors: 3,
        defaultBackground: '#FFFFFF',
        palette: [],
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
  },
};

describe('OCR provider mapping', () => {
  it.each([
    ['local-v5', 'local-api', 'pp-ocrv5'],
    ['browser-local-v5', 'local-api', 'pp-ocrv5'],
    ['browser-local', 'local-api', 'pp-ocrv5'],
    ['local-vl', 'local-api', 'paddleocr-vl'],
    ['browser-local-vl', 'local-api', 'paddleocr-vl'],
    ['paddle-api-v5', 'paddle-api', 'pp-ocrv5'],
    ['paddle-api', 'paddle-api', 'pp-ocrv5'],
    ['paddle-api-vl', 'paddle-api', 'paddleocr-vl'],
    ['auto', 'auto', 'pp-ocrv5'],
  ] as Array<[OcrProviderMode, ReturnType<typeof resolveProviderMode>['runtime'], ReturnType<typeof resolveProviderMode>['engine']]>)(
    'maps %s to %s %s',
    (mode, runtime, engine) => {
      expect(resolveProviderMode(mode)).toMatchObject({ runtime, engine });
    }
  );

  it('uses the built-in local endpoint for both local engines', () => {
    expect(resolveRecognitionEndpoint(providerOptions, resolveProviderMode('local-v5'))).toBe('/ocr/price-tag');
    expect(resolveRecognitionEndpoint(providerOptions, resolveProviderMode('local-vl'))).toBe('/ocr/price-tag');
  });

  it('uses the configured endpoint for API engines', () => {
    expect(resolveRecognitionEndpoint(providerOptions, resolveProviderMode('paddle-api-v5'))).toBe('https://ocr.example.com/price-tag');
    expect(resolveRecognitionEndpoint(providerOptions, resolveProviderMode('paddle-api-vl'))).toBe('https://ocr.example.com/price-tag');
  });

  it('builds the same multipart options protocol for local and API providers', () => {
    expect(buildOcrRequestOptions(resolveProviderMode('local-v5'))).toMatchObject({
      task: 'price-tag',
      normalizeOnly: true,
      engine: 'pp-ocrv5',
      model: 'pp-ocrv5',
      providerMode: 'local-v5',
    });
    expect(buildOcrRequestOptions(resolveProviderMode('paddle-api-vl'))).toMatchObject({
      task: 'price-tag',
      normalizeOnly: true,
      engine: 'paddleocr-vl',
      model: 'paddleocr-vl',
      providerMode: 'paddle-api-vl',
    });
  });
});
