import { createI18n } from 'vue-i18n';
import { allMessages } from './messages';
import { type LocaleCode, resolveRegionalPreferences } from './market';

const initial = resolveRegionalPreferences();

export const i18n = createI18n({
  legacy: false,
  locale: initial.locale,
  fallbackLocale: 'en',
  messages: allMessages,
  missingWarn: false,
  fallbackWarn: false,
});

export function setAppLocale(locale: LocaleCode): void {
  i18n.global.locale.value = locale;
}

export function getAppLocale(): LocaleCode {
  return i18n.global.locale.value as LocaleCode;
}

export function translate(key: string, params?: Record<string, unknown>): string {
  return i18n.global.t(key, params ?? {});
}

export { allMessages };
export * from './market';
