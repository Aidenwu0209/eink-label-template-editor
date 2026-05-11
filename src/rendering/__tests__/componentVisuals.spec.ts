import { describe, expect, it } from 'vitest';
import {
  getBarcodeReadabilityWarnings,
  getQrcodeReadabilityWarnings,
} from '@/rendering/componentVisuals';
import type { QrcodeExtension } from '@/stores/editorStore';

const qrcodeExt: QrcodeExtension = {
  fieldBinding: 'qrContent',
  errorCorrection: 'M',
  margin: 1,
  foregroundColor: '#000000',
  backgroundColor: '#FFFFFF',
};

describe('component readability warnings', () => {
  it('warns when a QR code module would render too small', () => {
    const warnings = getQrcodeReadabilityWarnings(
      { left: 0, top: 0, width: 24, height: 24 },
      'https://example.com/product/1001',
      qrcodeExt
    );

    expect(warnings.map((warning) => warning.code)).toContain('qrcode-too-small');
  });

  it('does not warn for a sufficiently large QR code', () => {
    expect(getQrcodeReadabilityWarnings(
      { left: 0, top: 0, width: 120, height: 120 },
      'https://example.com/product/1001',
      qrcodeExt
    )).toEqual([]);
  });

  it('warns when a barcode is too narrow or content is too long', () => {
    const warnings = getBarcodeReadabilityWarnings(
      { left: 0, top: 0, width: 80, height: 42 },
      'SKU-1234567890-ABCDEFGHIJKLMNO-EXTRA'
    );

    expect(warnings.map((warning) => warning.code)).toEqual([
      'barcode-too-narrow',
      'barcode-content-too-long',
    ]);
  });
});
