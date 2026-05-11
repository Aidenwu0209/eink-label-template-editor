import { ScreenType } from '../types';
import type { ScreenProfile } from '../types';

export const BW_PROFILE: ScreenProfile = {
  type: ScreenType.BW,
  displayName: '黑白屏',
  palette: [
    { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
    { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
  ],
  maxColors: 2,
  defaultWidth: 800,
  defaultHeight: 480,
  defaultBackground: '#FFFFFF',
  dithering: { algorithm: 'floyd-steinberg', strength: 1.0, serpentine: true },
  supportsPartialRefresh: true,
  dpi: 166,
};
