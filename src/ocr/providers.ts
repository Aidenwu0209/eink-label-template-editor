import { decodeCodesFromImage } from './codeDecoder';
import { extractPriceTagFromOcr } from './fieldExtraction';
import { preprocessImageForOcr } from './imagePreprocess';
import { normalizeOcrResponse } from './normalize';
import type { OcrCodeResults, OcrEngine, OcrProviderMode, OcrProviderOptions, OcrProviderRawResult, RecognizedPriceTag } from './types';
import { translate } from '@/i18n';

const LOCAL_LOW_CONFIDENCE_THRESHOLD = 0.58;
const MIN_RELIABLE_ITEM_COUNT = 2;
const LOCAL_REQUEST_TIMEOUT_MS = 180_000;
const API_REQUEST_TIMEOUT_MS = 90_000;
const LOCAL_OCR_ENDPOINT = '/ocr/price-tag';

export interface ResolvedOcrProvider {
  mode: OcrProviderMode;
  runtime: 'local-api' | 'paddle-api' | 'auto';
  engine: OcrEngine;
  normalizedProvider: OcrProviderRawResult['provider'];
}

export async function recognizePriceTag(
  file: File,
  options: OcrProviderOptions
): Promise<RecognizedPriceTag> {
  const preprocessed = await preprocessImageForOcr(file);
  const decodedCodes = await decodeCodesFromImage(preprocessed.blob).catch(() => ({}));
  const provider = resolveProviderMode(options.mode);

  if (provider.runtime === 'paddle-api' || provider.runtime === 'local-api') {
    return runServiceRecognition(preprocessed.blob, options, provider, decodedCodes, preprocessed);
  }

  const localProvider: ResolvedOcrProvider = {
    ...provider,
    runtime: 'local-api',
    engine: 'pp-ocrv5',
  };
  const localResult = await runServiceRecognition(preprocessed.blob, options, localProvider, decodedCodes, preprocessed);
  const shouldFallback = Boolean(options.apiEndpoint)
    && (
      localResult.confidence < LOCAL_LOW_CONFIDENCE_THRESHOLD
      || localResult.rawItems.length < MIN_RELIABLE_ITEM_COUNT
      || (localResult.fields.price == null && localResult.fields.memberPrice == null)
    );

  if (!shouldFallback) return localResult;

  try {
    const apiResult = await runServiceRecognition(preprocessed.blob, options, {
      ...provider,
      runtime: 'paddle-api',
      engine: 'pp-ocrv5',
      normalizedProvider: 'fallback-api',
    }, decodedCodes, preprocessed);
    return {
      ...apiResult,
      warnings: [
        ...apiResult.warnings,
        translate('ocr.localLowConfidenceFallback'),
      ],
    };
  } catch (err) {
    return {
      ...localResult,
      warnings: [
        ...localResult.warnings,
        translate('ocr.apiFallbackFailed', { message: err instanceof Error ? err.message : String(err) }),
      ],
    };
  }
}

async function runServiceRecognition(
  imageBlob: Blob,
  options: OcrProviderOptions,
  provider: ResolvedOcrProvider,
  decodedCodes: OcrCodeResults = {},
  fallbackImage?: { width: number; height: number }
): Promise<RecognizedPriceTag> {
  const endpoint = resolveRecognitionEndpoint(options, provider);
  if (!endpoint) {
    throw new Error(translate('ocr.apiNotConfigured'));
  }

  const form = new FormData();
  form.append('image', imageBlob, 'price-tag.png');
  form.append('profile', JSON.stringify(buildProfilePayload(options.config)));
  form.append('options', JSON.stringify(buildOcrRequestOptions(provider)));

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    body: form,
  }, provider.runtime === 'local-api' ? LOCAL_REQUEST_TIMEOUT_MS : API_REQUEST_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(translate('ocr.apiRequestFailed', {
      status: response.status,
      statusText: response.statusText,
    }));
  }

  const rawResult = await response.json();
  const normalized = normalizeOcrResponse(rawResult, provider.normalizedProvider, fallbackImage);
  normalized.codes = { ...normalized.codes, ...decodedCodes };
  return resultToRecognizedTag(normalized);
}

export function resolveProviderMode(mode: OcrProviderMode): ResolvedOcrProvider {
  if (mode === 'browser-local-vl' || mode === 'local-vl') {
    return {
      mode,
      runtime: 'local-api',
      engine: 'paddleocr-vl',
      normalizedProvider: mode,
    };
  }

  if (mode === 'browser-local' || mode === 'browser-local-v5' || mode === 'local-v5') {
    return {
      mode,
      runtime: 'local-api',
      engine: 'pp-ocrv5',
      normalizedProvider: mode,
    };
  }

  if (mode === 'paddle-api' || mode === 'paddle-api-v5') {
    return {
      mode,
      runtime: 'paddle-api',
      engine: 'pp-ocrv5',
      normalizedProvider: mode,
    };
  }

  if (mode === 'paddle-api-vl') {
    return {
      mode,
      runtime: 'paddle-api',
      engine: 'paddleocr-vl',
      normalizedProvider: mode,
    };
  }

  return {
    mode,
    runtime: 'auto',
    engine: 'pp-ocrv5',
    normalizedProvider: mode,
  };
}

export function resolveRecognitionEndpoint(options: OcrProviderOptions, provider: ResolvedOcrProvider): string | undefined {
  if (provider.runtime === 'local-api') {
    return LOCAL_OCR_ENDPOINT;
  }
  return options.apiEndpoint?.trim() || undefined;
}

export function buildOcrRequestOptions(provider: ResolvedOcrProvider): Record<string, string | boolean> {
  return {
    task: 'price-tag',
    normalizeOnly: true,
    engine: provider.engine,
    model: provider.engine,
    providerMode: provider.mode,
  };
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = API_REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(translate('ocr.apiTimeout'));
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function resultToRecognizedTag(result: OcrProviderRawResult): RecognizedPriceTag {
  return extractPriceTagFromOcr(result.items, result.provider, result.codes, result.image);
}

function buildProfilePayload(config: OcrProviderOptions['config']) {
  return {
    width: config.canvas.width,
    height: config.canvas.height,
    colorMode: config.sourceProfile?.colorMode ?? config.screen.type,
    palette: config.screen.profile.palette.map((color) => ({
      name: color.name,
      value: color.hex,
    })),
  };
}
