import type { UrlParams } from './types';

/**
 * Parses URL query parameters into structured UrlParams
 */
export class UrlParamParser {
  static parse(search: string): UrlParams {
    const params = new URLSearchParams(search);
    return {
      width: params.get('width') ?? undefined,
      height: params.get('height') ?? undefined,
      screenType: params.get('screenType') ?? params.get('screen') ?? undefined,
      templateId: params.get('templateId') ?? params.get('tid') ?? undefined,
      apiBase: params.get('apiBase') ?? undefined,
      screenConfigId: params.get('screenConfigId') ?? undefined,
    };
  }
}
