import { decodeCodesFromImage } from './codeDecoder';
import { extractPriceTagFromOcr } from './fieldExtraction';
import { preprocessImageForOcr } from './imagePreprocess';
import { normalizeOcrResponse } from './normalize';
import type { OcrCodeResults, OcrProviderOptions, OcrProviderRawResult, RecognizedPriceTag } from './types';
import { translate } from '@/i18n';

const LOCAL_LOW_CONFIDENCE_THRESHOLD = 0.58;
const MIN_RELIABLE_ITEM_COUNT = 2;

type PaddleOCRModule = typeof import('@paddleocr/paddleocr-js');
type PaddleOCRInstance = Awaited<ReturnType<PaddleOCRModule['PaddleOCR']['create']>>;

let localOcrPromise: Promise<PaddleOCRInstance> | null = null;

export async function recognizePriceTag(
  file: File,
  options: OcrProviderOptions
): Promise<RecognizedPriceTag> {
  const preprocessed = await preprocessImageForOcr(file);
  const decodedCodes = await decodeCodesFromImage(preprocessed.blob).catch(() => ({}));

  if (options.mode === 'paddle-api') {
    return runApiRecognition(preprocessed.blob, options, 'paddle-api', decodedCodes);
  }

  if (options.mode === 'browser-local') {
    return runBrowserRecognition(preprocessed.blob, preprocessed, decodedCodes);
  }

  const localResult = await runBrowserRecognition(preprocessed.blob, preprocessed, decodedCodes);
  const shouldFallback = Boolean(options.apiEndpoint)
    && (
      localResult.confidence < LOCAL_LOW_CONFIDENCE_THRESHOLD
      || localResult.rawItems.length < MIN_RELIABLE_ITEM_COUNT
      || (localResult.fields.price == null && localResult.fields.memberPrice == null)
    );

  if (!shouldFallback) return localResult;

  try {
    const apiResult = await runApiRecognition(preprocessed.blob, options, 'fallback-api', decodedCodes);
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
  decodedCodes: OcrCodeResults
): Promise<RecognizedPriceTag> {
  const ocr = await getLocalOcr();
  const [rawResult] = await ocr.predict(imageBlob, {
    textDetLimitSideLen: 960,
    textRecScoreThresh: 0.2,
  });
  const normalized = normalizeOcrResponse(rawResult, 'browser-local', image);
  normalized.codes = { ...normalized.codes, ...decodedCodes };
  return resultToRecognizedTag(normalized);
}

async function runApiRecognition(
  imageBlob: Blob,
  options: OcrProviderOptions,
  provider: OcrProviderRawResult['provider'] = 'paddle-api',
  decodedCodes: OcrCodeResults = {}
): Promise<RecognizedPriceTag> {
  if (!options.apiEndpoint) {
    throw new Error(translate('ocr.apiNotConfigured'));
  }

  const form = new FormData();
  form.append('image', imageBlob, 'price-tag.png');
  form.append('profile', JSON.stringify(buildProfilePayload(options.config)));
  form.append('options', JSON.stringify({ task: 'price-tag', normalizeOnly: true }));

  const response = await fetch(options.apiEndpoint, {
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
  const normalized = normalizeOcrResponse(rawResult, provider);
  normalized.codes = { ...normalized.codes, ...decodedCodes };
  return resultToRecognizedTag(normalized);
}

async function getLocalOcr(): Promise<PaddleOCRInstance> {
  if (!localOcrPromise) {
    localOcrPromise = import('@paddleocr/paddleocr-js')
      .then(({ PaddleOCR }) => PaddleOCR.create({
        lang: 'ch',
        ocrVersion: 'PP-OCRv5',
        worker: true,
        ortOptions: {
          backend: 'auto',
        },
      }));
  }
  return localOcrPromise;
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
