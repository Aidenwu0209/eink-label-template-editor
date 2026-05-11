import type { ScreenProfile } from '@/screen/types';
import type { RenderStrategy, RenderResult } from './types';
import { FloydSteinbergStrategy } from './strategies/FloydSteinbergStrategy';
import { NearestColorStrategy } from './strategies/NearestColorStrategy';

/**
 * EinkRenderer — facade for the rendering pipeline
 *
 * Pipeline: Canvas → ImageData → Color Quantization → Dithering → Output
 * Completely decoupled from Fabric.js — pure image processing
 */
export class EinkRenderer {
  private strategy: RenderStrategy;
  private profile: ScreenProfile;

  constructor(profile: ScreenProfile) {
    this.profile = profile;
    this.strategy = EinkRenderer.createStrategy(profile.dithering.algorithm);
  }

  get strategyName(): string {
    return this.strategy.name;
  }

  /** Full render: preview ImageData + device buffer */
  render(source: ImageData): RenderResult {
    const start = performance.now();

    const imageData = this.strategy.process(
      source,
      this.profile.palette,
      this.profile.dithering
    );

    const deviceBuffer = this.strategy.processToBuffer(
      source,
      this.profile.palette,
      this.profile.dithering
    );

    return {
      imageData,
      deviceBuffer,
      duration: performance.now() - start,
      strategyName: this.strategy.name,
    };
  }

  /** Preview only (skip buffer for performance) */
  renderPreview(source: ImageData): ImageData {
    return this.strategy.process(
      source,
      this.profile.palette,
      this.profile.dithering
    );
  }

  /** Device buffer only */
  renderBuffer(source: ImageData): Uint8Array {
    return this.strategy.processToBuffer(
      source,
      this.profile.palette,
      this.profile.dithering
    );
  }

  /** Switch dithering strategy at runtime */
  setStrategy(algorithm: string): void {
    this.strategy = EinkRenderer.createStrategy(algorithm);
  }

  private static createStrategy(algorithm: string): RenderStrategy {
    switch (algorithm) {
      case 'floyd-steinberg':
        return new FloydSteinbergStrategy();
      case 'none':
        return new NearestColorStrategy();
      default:
        return new FloydSteinbergStrategy();
    }
  }
}
