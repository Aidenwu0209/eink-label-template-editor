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
} from './types';
import { BootConfigError } from './types';

/** Maps external colorMode to internal ScreenType */
function colorModeToScreenType(colorMode: string): ScreenType {
  const map: Record<string, ScreenType> = {
    BW: ScreenType.BW,
    BWR: ScreenType.TRI,
    BWRY: ScreenType.BWRY,
    E6: ScreenType.SIX,
  };
  return map[colorMode] ?? ScreenType.BW;
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
      previewData: payload.previewData,
      staticDynamic: payload.staticDynamic,
      api: {
        baseUrl: '/api',
      },
      onSave: payload.onSave,
      saveApi: payload.saveApi,
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
      urlParams.screenType,
      remoteTemplate?.meta.screenType,
      remoteScreenConfig?.type
    );

    const profile = this.resolveProfile(screenType, remoteScreenConfig);

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

    // Infer mode from templateId presence
    const mode: EditorMode = remoteTemplate ? 'edit' : 'create';

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
        : undefined,
      api: {
        baseUrl: urlParams.apiBase || '/api',
      },
    };
  }

  // ══════════ Validation ══════════

  private validateMode(mode: unknown): asserts mode is EditorMode {
    if (!mode || (mode !== 'create' && mode !== 'edit')) {
      throw new BootConfigError(
        `初始化失败：mode 必须为 "create" 或 "edit"，当前值为 "${mode ?? '(缺失)'}"`
      );
    }
  }

  private validateProfileDimensions(profile: {
    width: unknown;
    height: unknown;
  }): void {
    const { width, height } = profile;

    if (width === undefined || width === null) {
      throw new BootConfigError('初始化失败：profile.width 不能为空');
    }
    if (height === undefined || height === null) {
      throw new BootConfigError('初始化失败：profile.height 不能为空');
    }

    const w = Number(width);
    const h = Number(height);

    if (isNaN(w) || !isFinite(w)) {
      throw new BootConfigError(
        `初始化失败：profile.width 必须为数字，当前值为 "${width}"`
      );
    }
    if (isNaN(h) || !isFinite(h)) {
      throw new BootConfigError(
        `初始化失败：profile.height 必须为数字，当前值为 "${height}"`
      );
    }
    if (w <= 0) {
      throw new BootConfigError(
        `初始化失败：profile.width 必须大于 0，当前值为 ${w}`
      );
    }
    if (h <= 0) {
      throw new BootConfigError(
        `初始化失败：profile.height 必须大于 0，当前值为 ${h}`
      );
    }
  }

  private validateDimensions(
    width: number,
    height: number,
    profile: ScreenProfile
  ): void {
    if (width <= 0 || height <= 0) {
      throw new BootConfigError(`Invalid dimensions: ${width}x${height}`);
    }
    if (width > 4096 || height > 4096) {
      throw new BootConfigError(
        `Dimensions too large: ${width}x${height}, max 4096`
      );
    }
    if (profile.palette.length < 2) {
      throw new BootConfigError('Palette must have >= 2 colors');
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
    }
    return ScreenType.BW;
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
    throw new BootConfigError('Cannot resolve canvas dimension');
  }
}

/** Convert hex color to RGB tuple */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}
