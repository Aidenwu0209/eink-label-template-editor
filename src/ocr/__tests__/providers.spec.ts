import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOcrRequestOptions, checkLocalOcrHealth, recognizePreparedPriceTag, resolveProviderMode, resolveRecognitionEndpoint } from '../providers';
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

const preparedImage = {
  blob: new Blob(['image'], { type: 'image/png' }),
  width: 296,
  height: 128,
};

function okOcrResponse(items: unknown[]) {
  return new Response(JSON.stringify({
    image: { width: 296, height: 128 },
    items,
    provider: 'test',
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function okHealthResponse(ready: boolean) {
  return new Response(JSON.stringify({
    ready,
    modelRoot: '/repo/runtime/ocr-models',
    selectedEngine: 'pp-ocrv5',
    engines: {
      'pp-ocrv5': {
        engine: 'pp-ocrv5',
        label: 'paddleocr-text-recognition',
        ready,
        checks: [],
      },
      'paddleocr-vl': {
        engine: 'paddleocr-vl',
        label: 'paddleocr-doc-parsing',
        ready: false,
        checks: [],
      },
    },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function rawItem(text: string, score: number, left: number, top: number, width: number, height: number) {
  return {
    text,
    score,
    box: { left, top, width, height },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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

describe('OCR provider runtime branches', () => {
  it('checks the local OCR model health endpoint for the selected engine', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okHealthResponse(false));

    const health = await checkLocalOcrHealth('local-v5', { fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/ocr/health?engine=pp-ocrv5');
    expect(health.selectedEngine).toBe('pp-ocrv5');
    expect(health.ready).toBe(false);
  });

  it('maps VL provider modes to the local doc-parsing health check', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okHealthResponse(false));

    await checkLocalOcrHealth('paddle-api-vl', { fetch: fetchMock });

    expect(String(fetchMock.mock.calls[0][0])).toBe('/ocr/health?engine=paddleocr-vl');
  });

  it('explains local OCR health proxy failures as setup problems', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('Bad Gateway', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'content-type': 'text/plain' },
    }));

    await expect(checkLocalOcrHealth('local-v5', { fetch: fetchMock })).rejects.toThrow(/ocr:local|8000|OCR 服务/i);
  });

  it('surfaces local model loading failures with the service detail', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      detail: 'PP-OCRv5 model files are missing at runtime/ocr-models/pp-ocrv5/det',
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/json' },
    }));

    await expect(recognizePreparedPriceTag(preparedImage, {}, {
      ...providerOptions,
      mode: 'local-v5',
    }, { fetch: fetchMock })).rejects.toThrow('runtime/ocr-models/pp-ocrv5/det');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/ocr/price-tag');
  });

  it('explains local OCR service proxy failures as setup problems', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('Bad Gateway', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'content-type': 'text/plain' },
    }));

    await expect(recognizePreparedPriceTag(preparedImage, {}, {
      ...providerOptions,
      mode: 'local-v5',
    }, { fetch: fetchMock })).rejects.toThrow(/ocr:local|8000|OCR 服务/i);
  });

  it('explains local OCR network failures as setup problems', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(recognizePreparedPriceTag(preparedImage, {}, {
      ...providerOptions,
      mode: 'local-vl',
    }, { fetch: fetchMock })).rejects.toThrow(/ocr:local|8000|OCR 服务/i);
  });

  it('times out stalled API requests with a clear OCR timeout error', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }));

    const promise = recognizePreparedPriceTag(preparedImage, {}, {
      ...providerOptions,
      mode: 'paddle-api-v5',
      requestTimeoutMs: 10,
    }, { fetch: fetchMock });
    const assertion = expect(promise).rejects.toThrow(/超时|timed out/i);

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lets callers cancel an in-flight OCR request', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }));

    const promise = recognizePreparedPriceTag(preparedImage, {}, {
      ...providerOptions,
      mode: 'local-vl',
      signal: controller.signal,
    }, { fetch: fetchMock });
    const assertion = expect(promise).rejects.toThrow(/取消|cancel/i);
    controller.abort();

    await assertion;
  });

  it('falls back from auto local OCR to configured API when the local result is weak', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(okOcrResponse([
        rawItem('uncertain text', 0.22, 12, 12, 80, 16),
      ]))
      .mockResolvedValueOnce(okOcrResponse([
        rawItem('鲜选超市', 0.96, 10, 8, 60, 16),
        rawItem('有机牛奶', 0.96, 12, 28, 92, 20),
        rawItem('¥12.90', 0.98, 12, 58, 90, 32),
      ]));

    const result = await recognizePreparedPriceTag(preparedImage, {}, {
      ...providerOptions,
      mode: 'auto',
    }, { fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/ocr/price-tag');
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://ocr.example.com/price-tag');
    expect(result.provider).toBe('fallback-api');
    expect(result.fields.price).toBe(12.9);
    expect(result.warnings.some((warning) => warning.includes('API'))).toBe(true);
  });

  it('keeps the local auto result and explains the API fallback failure', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(okOcrResponse([
        rawItem('uncertain text', 0.22, 12, 12, 80, 16),
      ]))
      .mockRejectedValueOnce(new Error('remote OCR is down'));

    const result = await recognizePreparedPriceTag(preparedImage, {}, {
      ...providerOptions,
      mode: 'auto',
    }, { fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.provider).toBe('auto');
    expect(result.rawItems).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('remote OCR is down');
  });
});
