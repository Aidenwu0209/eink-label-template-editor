import { ScreenType } from '../types';
import type { ScreenProfile } from '../types';

export const BWRY_PROFILE: ScreenProfile = {
  type: ScreenType.BWRY,
  displayName: '四色屏 (黑白红黄)',
  palette: [
    { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
    { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
    { name: 'Red', hex: '#CC0000', rgb: [204, 0, 0], deviceIndex: 2 },
    { name: 'Yellow', hex: '#E8B811', rgb: [232, 184, 17], deviceIndex: 3 },
  ],
  maxColors: 4,
  defaultWidth: 800,
  defaultHeight: 480,
  defaultBackground: '#FFFFFF',
  dithering: { algorithm: 'floyd-steinberg', strength: 0.85, serpentine: true },
  supportsPartialRefresh: false,
  dpi: 166,
};
