import type { OcrCodeResults } from './types';

type BrowserBarcodeFormat = 'aztec' | 'code_128' | 'code_39' | 'code_93' | 'codabar' | 'data_matrix'
  | 'ean_13' | 'ean_8' | 'itf' | 'pdf417' | 'qr_code' | 'upc_a' | 'upc_e';

interface BrowserDetectedBarcode {
  rawValue: string;
  format: BrowserBarcodeFormat;
}

interface BrowserBarcodeDetector {
  detect(image: ImageBitmap): Promise<BrowserDetectedBarcode[]>;
}

interface BrowserBarcodeDetectorConstructor {
  new (options?: { formats?: BrowserBarcodeFormat[] }): BrowserBarcodeDetector;
  getSupportedFormats?: () => Promise<BrowserBarcodeFormat[]>;
}

const PREFERRED_FORMATS: BrowserBarcodeFormat[] = [
  'qr_code',
  'code_128',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_39',
  'code_93',
  'data_matrix',
];

export async function decodeCodesFromImage(image: Blob): Promise<OcrCodeResults> {
  const ctor = (globalThis as { BarcodeDetector?: BrowserBarcodeDetectorConstructor }).BarcodeDetector;
  if (!ctor) return {};

  const supported = await ctor.getSupportedFormats?.().catch(() => PREFERRED_FORMATS) ?? PREFERRED_FORMATS;
  const formats = PREFERRED_FORMATS.filter((format) => supported.includes(format));
  if (!formats.length) return {};

  const bitmap = await createImageBitmap(image);
  try {
    const detector = new ctor({ formats });
    const detected = await detector.detect(bitmap);
    return detected.reduce<OcrCodeResults>((codes, item) => {
      if (!item.rawValue) return codes;
      if (item.format === 'qr_code') {
        codes.qrContent ??= item.rawValue;
      } else {
        codes.barcodeContent ??= item.rawValue;
      }
      return codes;
    }, {});
  } finally {
    bitmap.close();
  }
}
