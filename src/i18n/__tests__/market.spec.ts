import { beforeEach, describe, expect, it } from 'vitest';
import {
  LOCALES,
  MARKET_PROFILES,
  REGIONAL_PREFERENCE_STORAGE_KEY,
  allMessages,
  inferLocaleFromLanguage,
  resolveRegionalPreferences,
  setAppLocale,
  writeStoredRegionalPreferences,
} from '@/i18n';

describe('regional i18n and market profiles', () => {
  beforeEach(() => {
    localStorage.removeItem(REGIONAL_PREFERENCE_STORAGE_KEY);
    setAppLocale('zh-CN');
  });

  it('resolves locale and market from payload', () => {
    const resolved = resolveRegionalPreferences({ locale: 'de-DE', market: 'EU' });

    expect(resolved.locale).toBe('de');
    expect(resolved.market).toBe('EU');
    expect(resolved.marketProfile.price.currencySymbol).toBe('€');
  });

  it('uses stored regional preferences before payload defaults', () => {
    writeStoredRegionalPreferences('fr', 'EU');

    const resolved = resolveRegionalPreferences({ locale: 'zh-CN', market: 'CN' });

    expect(resolved.locale).toBe('fr');
    expect(resolved.market).toBe('EU');
  });

  it('infers supported locales from browser language strings', () => {
    expect(inferLocaleFromLanguage('zh-Hans-CN')).toBe('zh-CN');
    expect(inferLocaleFromLanguage('de-DE')).toBe('de');
    expect(inferLocaleFromLanguage('fr-FR')).toBe('fr');
    expect(inferLocaleFromLanguage('es-ES')).toBe('es');
    expect(inferLocaleFromLanguage('ru-RU')).toBe('ru');
    expect(inferLocaleFromLanguage('en-GB')).toBe('en');
    expect(inferLocaleFromLanguage('ja-JP')).toBe('en');
  });

  it('defines distinct CN and EU price defaults and starter samples', () => {
    expect(MARKET_PROFILES.CN.price.currencyCode).toBe('CNY');
    expect(MARKET_PROFILES.CN.price.currencySymbol).toBe('¥');
    expect(MARKET_PROFILES.EU.price.currencyCode).toBe('EUR');
    expect(MARKET_PROFILES.EU.price.currencySymbol).toBe('€');
    expect(MARKET_PROFILES.CN.samplePreviewData.productName).not.toBe(MARKET_PROFILES.EU.samplePreviewData.productName);
  });

  it('covers field labels, object labels, and error copy in every locale', () => {
    for (const locale of LOCALES) {
      const pack = allMessages[locale];
      expect(pack.fields.productName).toBeTruthy();
      expect(pack.fields.price).toBeTruthy();
      expect(pack.objects.PRICE).toBeTruthy();
      expect(pack.objects.QRCODE).toBeTruthy();
      expect(pack.starter.productName).toBeTruthy();
      expect(pack.market.samplePrice).toBeTruthy();
      expect(pack.ocr.localInitTimeout).toBeTruthy();
      expect(pack.ocr.localPredictTimeout).toBeTruthy();
      expect(pack.ocr.apiTimeout).toBeTruthy();
      expect(pack.errors.saveConfig).toBeTruthy();
      expect(pack.errors.customFieldEmpty).toBeTruthy();
    }
  });

  it('keeps language selector labels in each language native name', () => {
    const expected = {
      'zh-CN': '中文',
      en: 'English',
      de: 'Deutsch',
      fr: 'Français',
      es: 'Español',
      ru: 'Русский',
    };

    for (const locale of LOCALES) {
      expect(allMessages[locale].locale).toEqual(expected);
    }
  });

  it('localizes major UI groups instead of falling back to English for European languages', () => {
    const english = allMessages.en;

    for (const locale of ['de', 'fr', 'es', 'ru'] as const) {
      const pack = allMessages[locale];
      expect(pack.editor.onboardingEU).not.toBe(english.editor.onboardingEU);
      expect(pack.toolbar.addElements).not.toBe(english.toolbar.addElements);
      expect(pack.toolbar.tools.PRICE.title).not.toBe(english.toolbar.tools.PRICE.title);
      expect(pack.properties.emptyTitle).not.toBe(english.properties.emptyTitle);
      expect(pack.ocr.start).not.toBe(english.ocr.start);
      expect(pack.ocr.localInitTimeout).not.toBe(english.ocr.localInitTimeout);
      expect(pack.errors.saveConfig).not.toBe(english.errors.saveConfig);
      expect(pack.starter.productName).not.toBe(english.starter.productName);
    }
  });
});
