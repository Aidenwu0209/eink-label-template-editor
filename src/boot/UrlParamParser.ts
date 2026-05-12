import type { UrlParams } from './types';

/**
 * Parses URL query parameters into structured UrlParams
 */
export class UrlParamParser {
  static parse(search: string): UrlParams {
    const params = new URLSearchParams(search);
    return {
      mode: params.get('mode') ?? undefined,
      width: params.get('width') ?? undefined,
      height: params.get('height') ?? undefined,
      colorMode: params.get('colorMode') ?? params.get('color') ?? undefined,
      screenType: params.get('screenType') ?? params.get('screen') ?? undefined,
      templateId: params.get('templateId') ?? params.get('tid') ?? undefined,
      templateName: params.get('templateName') ?? params.get('name') ?? undefined,
      apiBase: params.get('apiBase') ?? undefined,
      saveApi: params.get('saveApi') ?? undefined,
      saveExportMode: params.get('saveExportMode') ?? undefined,
      ocrApi: params.get('ocrApi') ?? undefined,
      locale: params.get('locale') ?? undefined,
      market: params.get('market') ?? undefined,
      screenConfigId: params.get('screenConfigId') ?? undefined,
    };
  }
}
