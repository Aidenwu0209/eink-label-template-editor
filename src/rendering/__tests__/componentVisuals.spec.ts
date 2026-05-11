import { describe, expect, it } from 'vitest';
import {
  createBarcodeVisual,
  createDiscountVisual,
  createPriceVisual,
  createQrcodeVisual,
  getBarcodeReadabilityWarnings,
  getQrcodeReadabilityWarnings,
} from '@/rendering/componentVisuals';
import { ScreenType } from '@/screen/types';
import type { BootConfig } from '@/boot/types';
import type { BarcodeExtension, DiscountExtension, PriceExtension, QrcodeExtension } from '@/stores/editorStore';
import type * as fabric from 'fabric';

const qrcodeExt: QrcodeExtension = {
  source: 'dynamic',
  fieldBinding: 'qrContent',
  content: '',
  errorCorrection: 'M',
  margin: 1,
  foregroundColor: '#000000',
  backgroundColor: '#FFFFFF',
};

const barcodeExt: BarcodeExtension = {
  source: 'dynamic',
  fieldBinding: 'barcodeContent',
  content: '',
  format: 'CODE128',
  showText: true,
  foregroundColor: '#000000',
  backgroundColor: '#FFFFFF',
};

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
  previewData: { price: 123456.78, discount: 8.8, qrContent: 'https://example.com/product/1001', barcodeContent: 'SKU1001' },
  api: { baseUrl: '/api' },
};

function getAbsoluteBounds(object: fabric.Object): { left: number; top: number; right: number; bottom: number } {
  const rect = object.getBoundingRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
  };
}

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

  it('keeps authored price and discount font sizes even when rendered content is fitted', () => {
    const priceExt: PriceExtension = {
      fieldBinding: 'price',
      fontFamily: 'AlibabaPuHuiTi',
      currencySymbol: '¥',
      showCurrency: true,
      decimalPlaces: 2,
      thousandSeparator: ',',
      decimalSeparator: '.',
      currencyStyle: { fontSize: 40, fontWeight: 'bold', color: '#000000' },
      integerStyle: { fontSize: 80, fontWeight: 'bold', color: '#000000' },
      decimalStyle: { fontSize: 48, fontWeight: 'bold', color: '#000000', offsetY: -20 },
    };
    const price = createPriceVisual(config, { left: 0, top: 0, width: 42, height: 20 }, priceExt);
    expect((price as any).extension.integerStyle.fontSize).toBe(80);
    expect((price as any).extension.renderMeta.fitWarnings).toHaveLength(1);

    const discountExt: DiscountExtension = {
      fieldBinding: 'discount',
      formatTemplate: '{value}折',
      backgroundColor: '#FFFFFF',
      textColor: '#000000',
      fontFamily: 'AlibabaPuHuiTi',
      fontSize: 42,
      fontWeight: 'bold',
      textAlign: 'center',
      verticalAlign: 'middle',
    };
    const discount = createDiscountVisual({ left: 0, top: 0, width: 38, height: 18 }, 8.8, discountExt);
    expect((discount as any).extension.fontSize).toBe(42);
    expect((discount as any).extension.renderMeta.fitWarnings).toHaveLength(1);
  });

  it('keeps QR modules inside the component bounds for long content', () => {
    const qr = createQrcodeVisual(
      { left: 0, top: 0, width: 24, height: 24 },
      'https://example.com/product/1001/with/a/very/long/path',
      qrcodeExt
    );
    const children = qr.getObjects().slice(1);
    for (const child of children) {
      const bounds = getAbsoluteBounds(child);
      expect(bounds.left).toBeGreaterThanOrEqual(-0.001);
      expect(bounds.top).toBeGreaterThanOrEqual(-0.001);
      expect(bounds.right).toBeLessThanOrEqual(24.001);
      expect(bounds.bottom).toBeLessThanOrEqual(24.001);
    }
  });

  it('renders barcodes with quiet zones instead of touching the component edge', () => {
    const barcode = createBarcodeVisual(
      { left: 0, top: 0, width: 160, height: 32 },
      'SKU1001',
      barcodeExt
    );
    const image = barcode.getObjects()[1];
    const bounds = getAbsoluteBounds(image);
    expect(bounds.left).toBeGreaterThan(0);
    expect(bounds.right).toBeLessThan(160);
  });
});
