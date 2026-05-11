import type { ColorEntry, DitheringConfig } from '@/screen/types';

/** Render strategy interface — Strategy Pattern */
export interface RenderStrategy {
  readonly name: string;
  process(source: ImageData, palette: readonly ColorEntry[], config: DitheringConfig): ImageData;
  processToBuffer(source: ImageData, palette: readonly ColorEntry[], config: DitheringConfig): Uint8Array;
}

/** Full render result */
export interface RenderResult {
  imageData: ImageData;
  deviceBuffer: Uint8Array;
  duration: number;
  strategyName: string;
}
