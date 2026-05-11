import type { EditorInitPayload } from './types';

/**
 * Parses editor initialization payload from:
 *   1. window.__ESL_EDITOR_INIT__ global variable
 *   2. URL ?init=<base64-encoded-JSON> parameter
 */
export class InitDataParser {
  static parse(): EditorInitPayload | null {
    // Priority 1: window global
    const globalInit = (window as any).__ESL_EDITOR_INIT__;
    if (globalInit && typeof globalInit === 'object') {
      return globalInit as EditorInitPayload;
    }

    // Priority 2: URL base64 param
    const params = new URLSearchParams(window.location.search);
    const initParam = params.get('init');
    if (initParam) {
      try {
        const json = decodeBase64Json(initParam);
        return JSON.parse(json) as EditorInitPayload;
      } catch {
        // base64 decode failed — try raw JSON (URL-encoded)
        try {
          return JSON.parse(decodeURIComponent(initParam)) as EditorInitPayload;
        } catch {
          return null;
        }
      }
    }

    return null;
  }
}

function decodeBase64Json(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
