import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_FONT_FAMILY,
  EMBEDDED_EDITOR_FONT_NAME,
  EXPORT_FONT_FAMILY,
  resolveEditorFontFamily,
  resolveExportFontFamily,
} from '@/fonts';

describe('editor font contract', () => {
  it('uses embedded Noto Sans SC as the default editor font', () => {
    expect(EMBEDDED_EDITOR_FONT_NAME).toBe('Noto Sans SC Variable');
    expect(DEFAULT_EDITOR_FONT_FAMILY).toContain(EMBEDDED_EDITOR_FONT_NAME);
    expect(EXPORT_FONT_FAMILY).toBe(EMBEDDED_EDITOR_FONT_NAME);
  });

  it('maps legacy AlibabaPuHuiTi templates to the embedded default font', () => {
    expect(resolveEditorFontFamily('AlibabaPuHuiTi')).toBe(DEFAULT_EDITOR_FONT_FAMILY);
    expect(resolveEditorFontFamily('"AlibabaPuHuiTi", sans-serif')).toBe(DEFAULT_EDITOR_FONT_FAMILY);
    expect(resolveExportFontFamily('AlibabaPuHuiTi')).toBe(EXPORT_FONT_FAMILY);
  });

  it('preserves explicitly selected non-default font stacks for widget metadata', () => {
    const stack = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';
    expect(resolveEditorFontFamily(stack)).toBe(stack);
    expect(resolveExportFontFamily(stack)).toBe(stack);
  });
});
