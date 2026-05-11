import { ScreenType } from '../types';
import type { ScreenProfile } from '../types';

export const TRI_PROFILE: ScreenProfile = {
  type: ScreenType.TRI,
  displayName: 'Three-color display (BWR)',
  palette: [
    { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
    { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
    { name: 'Red', hex: '#CC0000', rgb: [204, 0, 0], deviceIndex: 2 },
  ],
  maxColors: 3,
  defaultWidth: 800,
  defaultHeight: 480,
  defaultBackground: '#FFFFFF',
  dithering: { algorithm: 'floyd-steinberg', strength: 0.85, serpentine: true },
  supportsPartialRefresh: false,
  dpi: 166,
};
