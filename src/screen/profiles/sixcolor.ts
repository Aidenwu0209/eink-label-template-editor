import { ScreenType } from '../types';
import type { ScreenProfile } from '../types';

export const SIX_PROFILE: ScreenProfile = {
  type: ScreenType.SIX,
  displayName: '六色屏 (ACeP)',
  palette: [
    { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
    { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
    { name: 'Red', hex: '#CE3A30', rgb: [206, 58, 48], deviceIndex: 2 },
    { name: 'Green', hex: '#30804B', rgb: [48, 128, 75], deviceIndex: 3 },
    { name: 'Blue', hex: '#2849A5', rgb: [40, 73, 165], deviceIndex: 4 },
    { name: 'Yellow', hex: '#D9C732', rgb: [217, 199, 50], deviceIndex: 5 },
    { name: 'Orange', hex: '#E8772E', rgb: [232, 119, 46], deviceIndex: 6 },
  ],
  maxColors: 7,
  defaultWidth: 600,
  defaultHeight: 448,
  defaultBackground: '#FFFFFF',
  dithering: { algorithm: 'floyd-steinberg', strength: 0.75, serpentine: true },
  supportsPartialRefresh: false,
  dpi: 133,
};
