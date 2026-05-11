/**
 * Screen type definitions for E-ink displays
 */

/** Screen type constants */
export const ScreenType = {
  BW: 'bw',
  TRI: 'tri',
  BWRY: 'bwry',
  SIX: 'six',
} as const;

export type ScreenType = (typeof ScreenType)[keyof typeof ScreenType];

/** Single color entry in a palette */
export interface ColorEntry {
  name: string;
  hex: string;
  rgb: [number, number, number];
  deviceIndex: number;
}

/** Dithering algorithm configuration */
export interface DitheringConfig {
  algorithm: 'floyd-steinberg' | 'ordered' | 'atkinson' | 'none';
  strength: number;
  serpentine: boolean;
  matrixSize?: 2 | 4 | 8;
}

/** Screen capability profile — immutable after boot */
export interface ScreenProfile {
  readonly type: ScreenType;
  readonly displayName: string;
  readonly palette: readonly ColorEntry[];
  readonly maxColors: number;
  readonly defaultWidth: number;
  readonly defaultHeight: number;
  readonly defaultBackground: string;
  readonly dithering: DitheringConfig;
  readonly supportsPartialRefresh: boolean;
  readonly dpi: number;
}
