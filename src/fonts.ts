export const EMBEDDED_EDITOR_FONT_NAME = 'Noto Sans SC Variable';
export const EMBEDDED_EDITOR_FONT_FAMILY = `"${EMBEDDED_EDITOR_FONT_NAME}"`;
export const EXPORT_FONT_FAMILY = EMBEDDED_EDITOR_FONT_NAME;
export const DEFAULT_EDITOR_FONT_FAMILY =
  `${EMBEDDED_EDITOR_FONT_FAMILY}, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif`;

const LEGACY_FONT_FAMILY_ALIASES = new Set([
  'AlibabaPuHuiTi',
  '"AlibabaPuHuiTi"',
  "'AlibabaPuHuiTi'",
]);

let editorFontsLoadPromise: Promise<void> | null = null;

export const FONT_FAMILY_OPTIONS = [
  {
    value: DEFAULT_EDITOR_FONT_FAMILY,
    label: 'Noto Sans SC (embedded, recommended)',
  },
  {
    value: '"Microsoft YaHei", "PingFang SC", Arial, sans-serif',
    label: 'Microsoft YaHei / PingFang',
  },
  {
    value: '"Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", sans-serif',
    label: 'Source Han Sans / Noto Sans',
  },
  {
    value: '"Songti SC", SimSun, "Noto Serif CJK SC", serif',
    label: 'Songti / Serif',
  },
  {
    value: '"Kaiti SC", KaiTi, "STKaiti", serif',
    label: 'Kaiti / Kai',
  },
  {
    value: 'Arial, "PingFang SC", sans-serif',
    label: 'Arial numeric-first',
  },
  {
    value: 'Georgia, "Songti SC", serif',
    label: 'Georgia Serif',
  },
] as const;

export function resolveEditorFontFamily(fontFamily?: string | null): string {
  const normalized = fontFamily?.trim();
  const primaryFamily = normalized?.split(',')[0]?.trim();
  if (!normalized || LEGACY_FONT_FAMILY_ALIASES.has(normalized) || LEGACY_FONT_FAMILY_ALIASES.has(primaryFamily ?? '')) {
    return DEFAULT_EDITOR_FONT_FAMILY;
  }
  return normalized;
}

export function resolveExportFontFamily(fontFamily?: string | null): string {
  const resolved = resolveEditorFontFamily(fontFamily);
  return resolved.includes(EMBEDDED_EDITOR_FONT_NAME) ? EXPORT_FONT_FAMILY : resolved;
}

export function ensureEditorFontsLoaded(): Promise<void> {
  if (editorFontsLoadPromise) return editorFontsLoadPromise;
  if (typeof document === 'undefined' || !('fonts' in document)) {
    editorFontsLoadPromise = Promise.resolve();
    return editorFontsLoadPromise;
  }

  editorFontsLoadPromise = Promise.all([
    document.fonts.load(`400 16px ${EMBEDDED_EDITOR_FONT_FAMILY}`),
    document.fonts.load(`800 16px ${EMBEDDED_EDITOR_FONT_FAMILY}`),
    document.fonts.ready,
  ])
    .then(() => undefined)
    .catch((error) => {
      console.warn('[fonts] Failed to load embedded editor font, falling back to CSS stack.', error);
    });

  return editorFontsLoadPromise;
}

export type EditorFontWeight =
  | 'normal'
  | 'bold'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900;

export function resolveEditorFontWeight(fontWeight?: unknown): number {
  const value = String(fontWeight ?? '').toLowerCase();
  if (value === 'bold') return 800;
  if (value === 'normal' || value === '') return 400;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 400;
  return Math.min(900, Math.max(100, Math.round(numeric / 100) * 100));
}

export function fontWeightSelectValue(fontWeight?: unknown): 'normal' | 'bold' {
  return resolveEditorFontWeight(fontWeight) >= 650 ? 'bold' : 'normal';
}

export function fontWeightFromSelect(value: string): EditorFontWeight {
  return value === 'bold' ? 800 : 400;
}
