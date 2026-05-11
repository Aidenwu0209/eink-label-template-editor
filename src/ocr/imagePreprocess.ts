import type { PreprocessedOcrImage } from './types';

interface PreprocessOptions {
  maxSide?: number;
  contrast?: number;
}

const DEFAULT_MAX_SIDE = 1800;
const DEFAULT_CONTRAST = 1.16;

export async function preprocessImageForOcr(
  file: Blob,
  options: PreprocessOptions = {}
): Promise<PreprocessedOcrImage> {
  const maxSide = options.maxSide ?? DEFAULT_MAX_SIDE;
  const contrast = options.contrast ?? DEFAULT_CONTRAST;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('无法创建图片预处理画布');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  if (contrast !== 1) {
    const imageData = ctx.getImageData(0, 0, width, height);
    adjustContrast(imageData.data, contrast);
    ctx.putImageData(imageData, 0, 0);
  }

  const blob = await canvasToBlob(canvas, 'image/png');
  return {
    blob,
    width,
    height,
    dataUrl: canvas.toDataURL('image/png'),
  };
}

function adjustContrast(data: Uint8ClampedArray, contrast: number): void {
  const factor = Math.max(0.2, Math.min(3, contrast));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampColor((data[i] - 128) * factor + 128);
    data[i + 1] = clampColor((data[i + 1] - 128) * factor + 128);
    data[i + 2] = clampColor((data[i + 2] - 128) * factor + 128);
  }
}

function clampColor(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('图片预处理失败'));
    }, type);
  });
}
