import { ScreenType } from '../types';
import type { ScreenProfile } from '../types';
import { BW_PROFILE } from './bw';
import { TRI_PROFILE } from './tricolor';
import { BWRY_PROFILE } from './bwry';
import { SIX_PROFILE } from './sixcolor';

export const SCREEN_PROFILES: Record<ScreenType, ScreenProfile> = {
  [ScreenType.BW]: BW_PROFILE,
  [ScreenType.TRI]: TRI_PROFILE,
  [ScreenType.BWRY]: BWRY_PROFILE,
  [ScreenType.SIX]: SIX_PROFILE,
};

export { BW_PROFILE, TRI_PROFILE, BWRY_PROFILE, SIX_PROFILE };
