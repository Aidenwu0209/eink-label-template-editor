import type { PreviewData } from '@/boot/types';

export const LOCALES = ['zh-CN', 'en', 'de', 'fr', 'es', 'ru'] as const;
export type LocaleCode = (typeof LOCALES)[number];

export const MARKETS = ['CN', 'EU'] as const;
export type MarketCode = (typeof MARKETS)[number];

export interface PriceFormatProfile {
  currencySymbol: string;
  currencyCode: string;
  showCurrency: boolean;
  decimalPlaces: number;
  thousandSeparator: string;
  decimalSeparator: string;
}

export interface MarketProfile {
  code: MarketCode;
  labelKey: string;
  dateLocale: string;
  price: PriceFormatProfile;
  discountFormatTemplate: string;
  samplePreviewData: PreviewData;
  starterText: {
    defaultTemplateName: string;
    productName: string;
    productTitle: string;
    specText: string;
    promoText: string;
    memberLabel: string;
    qrHeadline: string;
    qrDescription: string;
    barcodeFallback: string;
  };
}

export const REGIONAL_PREFERENCE_STORAGE_KEY = 'esl-editor-regional-preferences:v1';

export const MARKET_PROFILES: Record<MarketCode, MarketProfile> = {
  CN: {
    code: 'CN',
    labelKey: 'market.cn',
    dateLocale: 'zh-CN',
    price: {
      currencySymbol: '¥',
      currencyCode: 'CNY',
      showCurrency: true,
      decimalPlaces: 2,
      thousandSeparator: ',',
      decimalSeparator: '.',
    },
    discountFormatTemplate: '{value}折',
    samplePreviewData: {
      productName: '有机纯牛奶',
      price: 12.9,
      originalPrice: 18.9,
      memberPrice: 9.9,
      discount: 8.8,
      description: '冷藏保存',
      spec: '300ml x 12盒',
      brand: '鲜选超市',
      origin: '中国',
      promoText: '限时优惠',
      imageUrl: '',
      qrContent: 'https://example.cn/product/1001',
      barcodeContent: 'SKU1001',
    },
    starterText: {
      defaultTemplateName: '电子价签模板',
      productName: '商品名称',
      productTitle: '商品标题',
      specText: '规格 / 产地',
      promoText: '限时优惠',
      memberLabel: '会员价',
      qrHeadline: '扫码查看详情',
      qrDescription: '扫描二维码领取优惠',
      barcodeFallback: 'SKU1001',
    },
  },
  EU: {
    code: 'EU',
    labelKey: 'market.eu',
    dateLocale: 'de-DE',
    price: {
      currencySymbol: '€',
      currencyCode: 'EUR',
      showCurrency: true,
      decimalPlaces: 2,
      thousandSeparator: '.',
      decimalSeparator: ',',
    },
    discountFormatTemplate: '-{value}%',
    samplePreviewData: {
      productName: 'Organic Whole Milk',
      price: 2.49,
      originalPrice: 2.99,
      memberPrice: 2.19,
      discount: 15,
      description: 'Chilled item',
      spec: '1 L',
      brand: 'Fresh Market',
      origin: 'EU',
      promoText: 'Limited offer',
      imageUrl: '',
      qrContent: 'https://example.eu/product/1001',
      barcodeContent: '4006381333931',
    },
    starterText: {
      defaultTemplateName: 'ESL price label',
      productName: 'Product name',
      productTitle: 'Product title',
      specText: 'Size / origin',
      promoText: 'Limited offer',
      memberLabel: 'Member price',
      qrHeadline: 'Scan for details',
      qrDescription: 'Scan the QR code for offer details',
      barcodeFallback: '4006381333931',
    },
  },
};

export interface RegionalPreferenceInput {
  locale?: unknown;
  market?: unknown;
}

export interface RegionalPreferences {
  locale: LocaleCode;
  market: MarketCode;
  marketProfile: MarketProfile;
}

function hasLocalStorage(): boolean {
  try {
    return typeof globalThis.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function normalizeLocale(value: unknown): LocaleCode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  const lower = normalized.toLowerCase();
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('de')) return 'de';
  if (lower.startsWith('fr')) return 'fr';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('ru')) return 'ru';
  return LOCALES.includes(normalized as LocaleCode) ? normalized as LocaleCode : null;
}

export function normalizeMarket(value: unknown): MarketCode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return MARKETS.includes(normalized as MarketCode) ? normalized as MarketCode : null;
}

export function inferLocaleFromLanguage(value: string | undefined | null): LocaleCode {
  const normalized = normalizeLocale(value);
  return normalized ?? 'en';
}

export function inferMarketFromLocale(locale: LocaleCode): MarketCode {
  return locale === 'zh-CN' ? 'CN' : 'EU';
}

function getBrowserLanguage(): string | undefined {
  const navigatorLike = globalThis.navigator as Navigator | undefined;
  return navigatorLike?.languages?.[0] ?? navigatorLike?.language;
}

export function getMarketProfile(market: MarketCode): MarketProfile {
  return MARKET_PROFILES[market];
}

export function readStoredRegionalPreferences(): Partial<Pick<RegionalPreferences, 'locale' | 'market'>> {
  if (!hasLocalStorage()) return {};
  try {
    const raw = globalThis.localStorage.getItem(REGIONAL_PREFERENCE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RegionalPreferenceInput;
    return {
      locale: normalizeLocale(parsed.locale) ?? undefined,
      market: normalizeMarket(parsed.market) ?? undefined,
    };
  } catch {
    return {};
  }
}

export function writeStoredRegionalPreferences(locale: LocaleCode, market: MarketCode): void {
  if (!hasLocalStorage()) return;
  globalThis.localStorage.setItem(REGIONAL_PREFERENCE_STORAGE_KEY, JSON.stringify({ locale, market }));
}

export function resolveRegionalPreferences(input: RegionalPreferenceInput = {}): RegionalPreferences {
  const stored = readStoredRegionalPreferences();
  const payloadLocale = normalizeLocale(input.locale);
  const browserLocale = inferLocaleFromLanguage(getBrowserLanguage());
  const locale = stored.locale ?? payloadLocale ?? browserLocale;
  const market = stored.market
    ?? normalizeMarket(input.market)
    ?? inferMarketFromLocale(locale);

  return {
    locale,
    market,
    marketProfile: getMarketProfile(market),
  };
}

export function marketSamplePreviewData(market: MarketCode): PreviewData {
  return { ...getMarketProfile(market).samplePreviewData };
}

export function resolvePreviewData(previewData: PreviewData | undefined, market: MarketCode): PreviewData {
  return {
    ...marketSamplePreviewData(market),
    ...(previewData ?? {}),
  };
}
