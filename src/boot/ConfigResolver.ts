import { ScreenType } from '@/screen/types';
import type { ScreenProfile, ColorEntry } from '@/screen/types';
import { SCREEN_PROFILES } from '@/screen/profiles';
import type {
  UrlParams,
  BootConfig,
  TemplateResponse,
  RemoteScreenConfig,
  EditorInitPayload,
  EditorMode,
  ProfileConfig,
  SaveExportMode,
} from './types';
import { BootConfigError } from './types';
import { resolvePreviewData, resolveRegionalPreferences, translate } from '@/i18n';

/** Maps external colorMode to internal ScreenType */
function tryColorModeToScreenType(colorMode: string): ScreenType | null {
  const normalized = colorMode.trim().toUpperCase();
  const map: Record<string, ScreenType> = {
    BW: ScreenType.BW,
    BLACK_WHITE: ScreenType.BW,
    BWR: ScreenType.TRI,
    TRI: ScreenType.TRI,
    TRICOLOR: ScreenType.TRI,
    BWRY: ScreenType.BWRY,
    E6: ScreenType.SIX,
    SIX: ScreenType.SIX,
  };
  return map[normalized] ?? null;
}

function colorModeToScreenType(colorMode: string): ScreenType {
  return tryColorModeToScreenType(colorMode) ?? ScreenType.BW;
}

function screenTypeToColorMode(screenType: ScreenType): ProfileConfig['colorMode'] {
  const map: Record<ScreenType, ProfileConfig['colorMode']> = {
    [ScreenType.BW]: 'BW',
    [ScreenType.TRI]: 'BWR',
    [ScreenType.BWRY]: 'BWRY',
    [ScreenType.SIX]: 'E6',
  };
  return map[screenType];
}

/**
 * Merges config from three layers (URL > Template > Profile defaults)
 * and validates the final BootConfig
 */
export class ConfigResolver {
  /**
   * Resolve BootConfig from an EditorInitPayload.
   * This is the primary initialization path.
   */
  resolveFromPayload(payload: EditorInitPayload): BootConfig {
    // Validate mode
    this.validateMode(payload.mode);

    // Validate profile dimensions
    this.validateProfileDimensions(payload.profile);

    // Map colorMode → ScreenType → ScreenProfile
    const screenType = colorModeToScreenType(payload.profile.colorMode);
    const profile = this.buildProfile(screenType, payload.profile);
    const regional = resolveRegionalPreferences({
      locale: payload.locale,
      market: payload.market,
    });

    return {
      mode: payload.mode,
      canvas: {
        width: payload.profile.width,
        height: payload.profile.height,
      },
      screen: {
        type: screenType,
        profile,
        palette: profile.palette,
      },
      sourceProfile: payload.profile,
      template: payload.templateId
        ? { id: payload.templateId, data: payload.fullJson ?? { objects: [] } }
        : undefined,
      templateName: payload.templateName,
      previewData: resolvePreviewData(payload.previewData, regional.market),
      staticDynamic: payload.staticDynamic,
      ...regional,
      api: {
        baseUrl: '/api',
      },
      onSave: payload.onSave,
      saveApi: payload.saveApi,
      saveExportMode: payload.saveExportMode,
      ocrApi: payload.ocrApi,
    };
  }

  /**
   * Legacy resolve from URL params (backward compatible).
   */
  resolve(input: {
    urlParams: UrlParams;
    remoteTemplate?: TemplateResponse;
    remoteScreenConfig?: RemoteScreenConfig;
  }): BootConfig {
    const { urlParams, remoteTemplate, remoteScreenConfig } = input;

    const screenType = this.resolveScreenType(
      urlParams.colorMode,
      urlParams.screenType,
      remoteTemplate?.meta.colorMode,
      remoteTemplate?.meta.screenType,
      remoteScreenConfig?.type
    );

    const profile = this.resolveProfile(screenType, remoteScreenConfig);
    const regional = resolveRegionalPreferences({
      locale: urlParams.locale,
      market: urlParams.market,
    });

    const width = this.resolveNumber(
      urlParams.width,
      remoteTemplate?.meta.width,
      profile.defaultWidth
    );
    const height = this.resolveNumber(
      urlParams.height,
      remoteTemplate?.meta.height,
      profile.defaultHeight
    );

    this.validateDimensions(width, height, profile);

    const mode: EditorMode = urlParams.mode === 'create'
      ? 'create'
      : urlParams.templateId || remoteTemplate
        ? 'edit'
        : 'create';

    return {
      mode,
      canvas: { width, height },
      screen: {
        type: screenType,
        profile,
        palette: profile.palette,
      },
      template: remoteTemplate
        ? { id: remoteTemplate.id, data: remoteTemplate.fabricJson }
        : urlParams.templateId
          ? { id: urlParams.templateId, data: { objects: [] } }
        : undefined,
      templateName: urlParams.templateName ?? remoteTemplate?.name,
      sourceProfile: {
        profileId: urlParams.screenConfigId,
        name: profile.displayName,
        width,
        height,
        colorMode: screenTypeToColorMode(screenType),
        palette: profile.palette.map((color) => ({ name: color.name, value: color.hex })),
      },
      previewData: resolvePreviewData(undefined, regional.market),
      ...regional,
      api: {
        baseUrl: urlParams.apiBase || '/api',
      },
      saveApi: urlParams.saveApi,
      saveExportMode: this.resolveSaveExportMode(urlParams.saveExportMode),
      ocrApi: urlParams.ocrApi,
    };
  }

  // ══════════ Validation ══════════

  private validateMode(mode: unknown): asserts mode is EditorMode {
    if (!mode || (mode !== 'create' && mode !== 'edit')) {
      throw new BootConfigError(translate('errors.bootInvalidMode', { mode: mode ?? '(missing)' }));
    }
  }

  private validateProfileDimensions(profile: {
    width: unknown;
    height: unknown;
  }): void {
    const { width, height } = profile;

    if (width === undefined || width === null) {
      throw new BootConfigError(translate('errors.bootWidthRequired'));
    }
    if (height === undefined || height === null) {
      throw new BootConfigError(translate('errors.bootHeightRequired'));
    }

    const w = Number(width);
    const h = Number(height);

    if (isNaN(w) || !isFinite(w)) {
      throw new BootConfigError(translate('errors.bootWidthNumber', { value: width }));
    }
    if (isNaN(h) || !isFinite(h)) {
      throw new BootConfigError(translate('errors.bootHeightNumber', { value: height }));
    }
    if (w <= 0) {
      throw new BootConfigError(translate('errors.bootWidthPositive', { value: w }));
    }
    if (h <= 0) {
      throw new BootConfigError(translate('errors.bootHeightPositive', { value: h }));
    }
  }

  private validateDimensions(
    width: number,
    height: number,
    profile: ScreenProfile
  ): void {
    if (width <= 0 || height <= 0) {
      throw new BootConfigError(translate('errors.bootInvalidDimensions', { width, height }));
    }
    if (width > 4096 || height > 4096) {
      throw new BootConfigError(translate('errors.bootDimensionsTooLarge', { width, height }));
    }
    if (profile.palette.length < 2) {
      throw new BootConfigError(translate('errors.bootPaletteMin'));
    }
  }

  // ══════════ Profile Building ══════════

  private buildProfile(
    screenType: ScreenType,
    config: { width: number; height: number; palette?: Array<{ name: string; value: string }> }
  ): ScreenProfile {
    const base = SCREEN_PROFILES[screenType];
    if (!config.palette || config.palette.length === 0) {
      return {
        ...base,
        defaultWidth: config.width,
        defaultHeight: config.height,
      };
    }

    // Convert external palette format to internal ColorEntry
    const palette: ColorEntry[] = config.palette.map((c, i) => ({
      name: c.name,
      hex: c.value,
      rgb: hexToRgb(c.value),
      deviceIndex: i,
    }));

    return {
      ...base,
      palette,
      maxColors: palette.length,
      defaultWidth: config.width,
      defaultHeight: config.height,
    };
  }

  // ══════════ Legacy Helpers ══════════

  private resolveScreenType(...candidates: (string | undefined)[]): ScreenType {
    for (const c of candidates) {
      if (c && Object.values(ScreenType).includes(c as ScreenType)) {
        return c as ScreenType;
      }
      if (c) {
        const screenType = tryColorModeToScreenType(c);
        if (screenType) return screenType;
      }
    }
    return ScreenType.BW;
  }

  private resolveSaveExportMode(value: string | undefined): SaveExportMode | undefined {
    return value === 'fabric-json' || value === 'static-dynamic' ? value : undefined;
  }

  private resolveProfile(
    type: ScreenType,
    remote?: RemoteScreenConfig
  ): ScreenProfile {
    const base = SCREEN_PROFILES[type];
    if (!remote) return base;
    return {
      ...base,
      palette: remote.palette ?? base.palette,
      dithering: { ...base.dithering, ...remote.dithering },
      defaultWidth: remote.width ?? base.defaultWidth,
      defaultHeight: remote.height ?? base.defaultHeight,
    };
  }

  private resolveNumber(
    ...candidates: (string | number | undefined)[]
  ): number {
    for (const c of candidates) {
      const n = Number(c);
      if (!isNaN(n) && n > 0) return n;
    }
    throw new BootConfigError(translate('errors.bootDimensionResolve'));
  }
}

/** Convert hex color to RGB tuple */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}
