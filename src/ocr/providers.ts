import { decodeCodesFromImage } from './codeDecoder';
import { extractPriceTagFromOcr } from './fieldExtraction';
import { preprocessImageForOcr } from './imagePreprocess';
import { normalizeOcrResponse } from './normalize';
import type { OcrCodeResults, OcrEngine, OcrProviderMode, OcrProviderOptions, OcrProviderRawResult, RecognizedPriceTag } from './types';
import { translate } from '@/i18n';
import ortWasmJsepMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import ortWasmJsepWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';

const LOCAL_LOW_CONFIDENCE_THRESHOLD = 0.58;
const MIN_RELIABLE_ITEM_COUNT = 2;
const LOCAL_OCR_INIT_TIMEOUT_MS = 120_000;
const LOCAL_OCR_PREDICT_TIMEOUT_MS = 60_000;
const API_REQUEST_TIMEOUT_MS = 45_000;
const LOCAL_MODEL_BASE_PATH = 'paddleocr-models/';
const LOCAL_DET_MODEL_NAME = 'PP-OCRv5_mobile_det';
const LOCAL_REC_MODEL_NAME = 'PP-OCRv5_mobile_rec';
const LOCAL_DET_MODEL_FILE = 'PP-OCRv5_mobile_det_onnx.tar';
const LOCAL_REC_MODEL_FILE = 'PP-OCRv5_mobile_rec_onnx.tar';
const LOCAL_VL_ENDPOINT = '/ocr/price-tag';

type PaddleOCRModule = typeof import('@paddleocr/paddleocr-js');
type PaddleOCRInstance = Awaited<ReturnType<PaddleOCRModule['PaddleOCR']['create']>>;

let localOcrPromise: Promise<PaddleOCRInstance> | null = null;

interface ResolvedOcrProvider {
  mode: OcrProviderMode;
  runtime: 'browser-local' | 'local-api' | 'paddle-api' | 'auto';
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
    return runApiRecognition(preprocessed.blob, options, provider, decodedCodes);
  }

  if (provider.runtime === 'browser-local') {
    return runBrowserRecognition(preprocessed.blob, preprocessed, provider, decodedCodes);
  }

  const localResult = await runBrowserRecognition(preprocessed.blob, preprocessed, provider, decodedCodes);
  const shouldFallback = Boolean(options.apiEndpoint)
    && (
      localResult.confidence < LOCAL_LOW_CONFIDENCE_THRESHOLD
      || localResult.rawItems.length < MIN_RELIABLE_ITEM_COUNT
      || (localResult.fields.price == null && localResult.fields.memberPrice == null)
    );

  if (!shouldFallback) return localResult;

  try {
    const apiResult = await runApiRecognition(preprocessed.blob, options, {
      ...provider,
      runtime: 'paddle-api',
      normalizedProvider: 'fallback-api',
    }, decodedCodes);
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

async function runBrowserRecognition(
  imageBlob: Blob,
  image: { width: number; height: number },
  provider: ResolvedOcrProvider,
  decodedCodes: OcrCodeResults
): Promise<RecognizedPriceTag> {
  const ocr = await getLocalOcr();
  const [rawResult] = await withTimeout(
    ocr.predict(imageBlob, {
      textDetLimitSideLen: 960,
      textRecScoreThresh: 0.2,
    }),
    LOCAL_OCR_PREDICT_TIMEOUT_MS,
    translate('ocr.localPredictTimeout')
  );
  const normalized = normalizeOcrResponse(rawResult, provider.normalizedProvider, image);
  normalized.codes = { ...normalized.codes, ...decodedCodes };
  return resultToRecognizedTag(normalized);
}

async function runApiRecognition(
  imageBlob: Blob,
  options: OcrProviderOptions,
  provider: ResolvedOcrProvider,
  decodedCodes: OcrCodeResults = {}
): Promise<RecognizedPriceTag> {
  const endpoint = resolveRecognitionEndpoint(options, provider);
  if (!endpoint) {
    throw new Error(translate('ocr.apiNotConfigured'));
  }

  const form = new FormData();
  form.append('image', imageBlob, 'price-tag.png');
  form.append('profile', JSON.stringify(buildProfilePayload(options.config)));
  form.append('options', JSON.stringify({
    task: 'price-tag',
    normalizeOnly: true,
    engine: provider.engine,
    model: provider.engine,
    providerMode: provider.mode,
  }));

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(translate('ocr.apiRequestFailed', {
      status: response.status,
      statusText: response.statusText,
    }));
  }

  const rawResult = await response.json();
  const normalized = normalizeOcrResponse(rawResult, provider.normalizedProvider);
  normalized.codes = { ...normalized.codes, ...decodedCodes };
  return resultToRecognizedTag(normalized);
}

function resolveProviderMode(mode: OcrProviderMode): ResolvedOcrProvider {
  if (mode === 'browser-local-vl') {
    return {
      mode,
      runtime: 'local-api',
      engine: 'paddleocr-vl',
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
    runtime: mode === 'auto' ? 'auto' : 'browser-local',
    engine: 'pp-ocrv5',
    normalizedProvider: mode === 'browser-local-v5' ? 'browser-local-v5' : mode,
  };
}

function resolveRecognitionEndpoint(options: OcrProviderOptions, provider: ResolvedOcrProvider): string | undefined {
  if (provider.runtime === 'local-api') {
    return options.apiEndpoint?.trim() || LOCAL_VL_ENDPOINT;
  }
  return options.apiEndpoint?.trim() || undefined;
}

async function getLocalOcr(): Promise<PaddleOCRInstance> {
  if (!localOcrPromise) {
    localOcrPromise = withTimeout(
      import('@paddleocr/paddleocr-js')
        .then(({ PaddleOCR }) => PaddleOCR.create({
          lang: 'ch',
          ocrVersion: 'PP-OCRv5',
          textDetectionModelName: LOCAL_DET_MODEL_NAME,
          textRecognitionModelName: LOCAL_REC_MODEL_NAME,
          textDetectionModelAsset: {
            url: localAssetUrl(`${LOCAL_MODEL_BASE_PATH}${LOCAL_DET_MODEL_FILE}`),
          },
          textRecognitionModelAsset: {
            url: localAssetUrl(`${LOCAL_MODEL_BASE_PATH}${LOCAL_REC_MODEL_FILE}`),
          },
          worker: true,
          textDetectionBatchSize: 1,
          textRecognitionBatchSize: 8,
          ortOptions: {
            backend: 'wasm',
            // PaddleOCR.js narrows this type to string, but ONNX Runtime accepts explicit mjs/wasm URLs.
            wasmPaths: {
              mjs: ortWasmJsepMjsUrl,
              wasm: ortWasmJsepWasmUrl,
            } as unknown as string,
            numThreads: 1,
            simd: true,
          },
        })),
      LOCAL_OCR_INIT_TIMEOUT_MS,
      translate('ocr.localInitTimeout')
    ).catch((err) => {
      localOcrPromise = null;
      throw err;
    });
  }
  return localOcrPromise;
}

function localAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return new URL(`${normalizedBase}${path}`, window.location.href).href;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

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
