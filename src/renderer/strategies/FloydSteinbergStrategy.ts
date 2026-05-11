import type { ColorEntry, DitheringConfig } from '@/screen/types';
import type { RenderStrategy } from '../types';
import { findNearestColor, clamp } from '../colorUtils';

/**
 * Floyd-Steinberg error-diffusion dithering
 * Distributes quantization error to neighboring pixels:
 *        *   7/16
 * 3/16  5/16  1/16
 */
export class FloydSteinbergStrategy implements RenderStrategy {
  readonly name = 'floyd-steinberg';

  process(
    source: ImageData,
    palette: readonly ColorEntry[],
    config: DitheringConfig
  ): ImageData {
    const { width, height } = source;
    const output = new ImageData(width, height);
    const work = new Float32Array(source.data.length);
    for (let i = 0; i < source.data.length; i++) work[i] = source.data[i];

    for (let y = 0; y < height; y++) {
      const leftToRight = !config.serpentine || y % 2 === 0;
      const xStart = leftToRight ? 0 : width - 1;
      const xEnd = leftToRight ? width : -1;
      const xStep = leftToRight ? 1 : -1;

      for (let x = xStart; x !== xEnd; x += xStep) {
        const idx = (y * width + x) * 4;
        const r = clamp(work[idx], 0, 255);
        const g = clamp(work[idx + 1], 0, 255);
        const b = clamp(work[idx + 2], 0, 255);

        const { entry } = findNearestColor(r, g, b, palette);
        output.data[idx] = entry.rgb[0];
        output.data[idx + 1] = entry.rgb[1];
        output.data[idx + 2] = entry.rgb[2];
        output.data[idx + 3] = 255;

        const s = config.strength;
        const er = (r - entry.rgb[0]) * s;
        const eg = (g - entry.rgb[1]) * s;
        const eb = (b - entry.rgb[2]) * s;

        this.spread(work, width, height, x + xStep, y, er, eg, eb, 7 / 16);
        this.spread(work, width, height, x - xStep, y + 1, er, eg, eb, 3 / 16);
        this.spread(work, width, height, x, y + 1, er, eg, eb, 5 / 16);
        this.spread(work, width, height, x + xStep, y + 1, er, eg, eb, 1 / 16);
      }
    }
    return output;
  }

  processToBuffer(
    source: ImageData,
    palette: readonly ColorEntry[],
    config: DitheringConfig
  ): Uint8Array {
    const dithered = this.process(source, palette, config);
    const len = dithered.width * dithered.height;
    const buf = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const idx = i * 4;
      const { index } = findNearestColor(
        dithered.data[idx],
        dithered.data[idx + 1],
        dithered.data[idx + 2],
        palette
      );
      buf[i] = palette[index].deviceIndex;
    }
    return buf;
  }

  private spread(
    data: Float32Array,
    w: number,
    h: number,
    x: number,
    y: number,
    er: number,
    eg: number,
    eb: number,
    factor: number
  ): void {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = (y * w + x) * 4;
    data[idx] += er * factor;
    data[idx + 1] += eg * factor;
    data[idx + 2] += eb * factor;
  }
}
