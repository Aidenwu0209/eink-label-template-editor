export const DEFAULT_EDITOR_FONT_FAMILY =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif';

export const FONT_FAMILY_OPTIONS = [
  {
    value: DEFAULT_EDITOR_FONT_FAMILY,
    label: '系统黑体（中英数字）',
  },
  {
    value: '"Microsoft YaHei", "PingFang SC", Arial, sans-serif',
    label: '微软雅黑 / 苹方',
  },
  {
    value: '"Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", sans-serif',
    label: '思源黑体 / Noto Sans',
  },
  {
    value: '"Songti SC", SimSun, "Noto Serif CJK SC", serif',
    label: '宋体 / Serif',
  },
  {
    value: '"Kaiti SC", KaiTi, "STKaiti", serif',
    label: '楷体',
  },
  {
    value: 'Arial, "PingFang SC", sans-serif',
    label: 'Arial 数字优先',
  },
  {
    value: 'Georgia, "Songti SC", serif',
    label: 'Georgia Serif',
  },
] as const;

export function resolveEditorFontFamily(fontFamily?: string | null): string {
  if (!fontFamily || fontFamily === 'AlibabaPuHuiTi') return DEFAULT_EDITOR_FONT_FAMILY;
  return fontFamily;
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
