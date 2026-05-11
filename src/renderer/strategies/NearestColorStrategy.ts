import type { ColorEntry, DitheringConfig } from '@/screen/types';
import type { RenderStrategy } from '../types';
import { findNearestColor } from '../colorUtils';

/**
 * Nearest color quantization (no dithering)
 * Simple but produces visible banding — useful as baseline
 */
export class NearestColorStrategy implements RenderStrategy {
  readonly name = 'none';

  process(
    source: ImageData,
    palette: readonly ColorEntry[],
    _config: DitheringConfig
  ): ImageData {
    const { width, height } = source;
    const output = new ImageData(width, height);

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const { entry } = findNearestColor(
        source.data[idx],
        source.data[idx + 1],
        source.data[idx + 2],
        palette
      );
      output.data[idx] = entry.rgb[0];
      output.data[idx + 1] = entry.rgb[1];
      output.data[idx + 2] = entry.rgb[2];
      output.data[idx + 3] = 255;
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
}
