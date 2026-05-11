import type { ColorEntry } from '@/screen/types';

/**
 * Weighted Euclidean distance (redmean approximation)
 * More perceptually accurate than simple RGB distance
 */
export function weightedColorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rMean) / 256) * db * db
  );
}

/** Find the nearest color in a palette */
export function findNearestColor(
  r: number, g: number, b: number,
  palette: readonly ColorEntry[]
): { entry: ColorEntry; index: number } {
  let minDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i].rgb;
    const d = weightedColorDistance(r, g, b, pr, pg, pb);
    if (d < minDist) {
      minDist = d;
      bestIdx = i;
    }
  }
  return { entry: palette[bestIdx], index: bestIdx };
}

/** Clamp a value to [min, max] */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Convert hex color to RGB tuple */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}
