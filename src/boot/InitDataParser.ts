import type { EditorInitPayload } from './types';

/**
 * Parses editor initialization payload from:
 *   1. window.__ESL_EDITOR_INIT__ global variable
 *   2. URL ?init=<base64-encoded-JSON> parameter
 */
export class InitDataParser {
  static parse(): EditorInitPayload | null {
    // Priority 1: host-provided global. In tests this may live on globalThis
    // instead of window, so avoid direct window access.
    const globalInit = getGlobalInit();
    if (globalInit && typeof globalInit === 'object') {
      return globalInit as EditorInitPayload;
    }

    // Priority 2: URL base64 param
    const params = new URLSearchParams(getLocationSearch());
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

function getGlobalInit(): unknown {
  const runtime = globalThis as {
    __ESL_EDITOR_INIT__?: unknown;
    window?: { __ESL_EDITOR_INIT__?: unknown };
  };

  return runtime.window?.__ESL_EDITOR_INIT__ ?? runtime.__ESL_EDITOR_INIT__;
}

function getLocationSearch(): string {
  const runtime = globalThis as {
    location?: { search?: string };
    window?: { location?: { search?: string } };
  };

  return runtime.window?.location?.search ?? runtime.location?.search ?? '';
}

function decodeBase64Json(value: string): string {
  if (typeof atob !== 'function') {
    throw new Error('base64 decode is not available in this environment');
  }

  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (typeof TextDecoder !== 'function') {
    return String.fromCharCode(...bytes);
  }
  return new TextDecoder().decode(bytes);
}
