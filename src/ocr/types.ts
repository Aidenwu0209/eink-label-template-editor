import type { BootConfig } from '@/boot/types';

export type OcrProviderMode =
  | 'auto'
  | 'local-v5'
  | 'local-vl'
  | 'browser-local'
  | 'paddle-api'
  | 'browser-local-v5'
  | 'browser-local-vl'
  | 'paddle-api-v5'
  | 'paddle-api-vl';

export type OcrEngine = 'pp-ocrv5' | 'paddleocr-vl';

export type OcrPoint = [number, number];

export interface OcrBox {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

export interface OcrTextItem {
  id: string;
  text: string;
  score: number;
  poly: OcrPoint[];
  box: OcrBox;
}

export type OcrLineRole =
  | 'productName'
  | 'brand'
  | 'price'
  | 'memberPrice'
  | 'originalPrice'
  | 'discount'
  | 'spec'
  | 'description'
  | 'origin'
  | 'promoText'
  | 'barcodeContent'
  | 'qrContent'
  | 'customText';

export interface OcrLineItem extends OcrTextItem {
  role: OcrLineRole;
  fieldKey: string | null;
  includeInTemplate: boolean;
  warnings: string[];
}

export interface OcrCodeResults {
  barcodeContent?: string;
  qrContent?: string;
}

export interface PriceTagFields {
  productName?: string;
  price?: number;
  originalPrice?: number;
  memberPrice?: number;
  discount?: number | string;
  description?: string;
  spec?: string;
  brand?: string;
  origin?: string;
  promoText?: string;
  [key: string]: unknown;
}

export interface RecognizedPriceTag {
  fields: PriceTagFields;
  codes: OcrCodeResults;
  rawItems: OcrTextItem[];
  lineItems: OcrLineItem[];
  provider: OcrProviderMode | 'fallback-api' | 'manual-stub';
  confidence: number;
  warnings: string[];
  image?: {
    width: number;
    height: number;
  };
  customFields?: Record<string, string>;
}

export interface OcrProviderOptions {
  mode: OcrProviderMode;
  apiEndpoint?: string;
  config: BootConfig;
  signal?: AbortSignal;
  requestTimeoutMs?: number;
}

export type LocalOcrModelStatus = 'ready' | 'missing' | 'lfs-pointer';

export interface LocalOcrModelDirectoryStatus {
  label: string;
  path: string;
  ready: boolean;
  status: LocalOcrModelStatus;
  fileCount: number;
  message: string;
}

export interface LocalOcrEngineHealth {
  engine: OcrEngine;
  label: string;
  ready: boolean;
  checks: LocalOcrModelDirectoryStatus[];
}

export interface LocalOcrHealthResponse {
  ready: boolean;
  modelRoot: string;
  selectedEngine?: OcrEngine;
  engines: Record<OcrEngine, LocalOcrEngineHealth>;
}

export interface OcrProviderRawResult {
  image?: {
    width: number;
    height: number;
  };
  items: OcrTextItem[];
  codes?: OcrCodeResults;
  metrics?: Record<string, unknown>;
  provider: OcrProviderMode | 'fallback-api';
}

export interface PreprocessedOcrImage {
  blob: Blob;
  width: number;
  height: number;
  dataUrl: string;
}
