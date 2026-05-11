import type {
  OcrCodeResults,
  OcrLineItem,
  OcrLineRole,
  OcrTextItem,
  PriceTagFields,
  RecognizedPriceTag,
} from './types';
import { translate } from '@/i18n';

const PROMO_KEYWORDS = /会员|促销|特价|优惠|满减|满.*减|立减|折|秒杀|活动|限时|买赠/;
const PRICE_KEYWORDS = /价|售价|零售价|会员价|促销价|特价|到手价|retail\s*price|sale\s*price|price|[$¥￥元]/i;
const ORIGINAL_PRICE_KEYWORDS = /原价|划线价|市场价|建议零售价/;
const MEMBER_PRICE_KEYWORDS = /会员价|会员|vip/i;
const SPEC_PATTERN = /\d+(?:[.,]\d+)?\s*(?:kg|g|mg|ml|l|L|千克|克|毫克|毫升|升|斤|两|瓶|盒|袋|包|只|件|个|片|枚|支|听|罐|条)(?:\s*[xX×*]\s*\d+)?/;
const PRICE_NUMBER_PATTERN = /(?:[¥￥]\s*)?(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:元)?/g;
const DISCOUNT_PATTERN = /(\d(?:[.,]\d)?)\s*折/;
const BARCODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{5,31}$/i;
const OCR_BARCODE_FALLBACK_PATTERN = /^\d{8,32}$/;
const URL_PATTERN = /(https?:\/\/|www\.|[a-z0-9-]+\.(?:com|cn|net|org|top|shop))/i;
const CHINESE_PATTERN = /[\u4e00-\u9fa5]/;
const NAME_TEXT_PATTERN = /[\u4e00-\u9fa5A-Za-z]/;

interface RankedPrice {
  value: number;
  item: OcrTextItem;
  score: number;
  kind: 'price' | 'originalPrice' | 'memberPrice';
}

interface LineAssignment {
  role: OcrLineRole;
  fieldKey: string | null;
  warnings: string[];
}

export function extractPriceTagFromOcr(
  rawItems: OcrTextItem[],
  provider: RecognizedPriceTag['provider'],
  codes: OcrCodeResults = {},
  image?: { width: number; height: number }
): RecognizedPriceTag {
  const items = rawItems
    .map((item) => ({ ...item, text: normalizeText(item.text) }))
    .filter((item) => item.text)
    .sort(readingOrder);
  const warnings: string[] = [];
  const usedIds = new Set<string>();
  const lineAssignments = new Map<string, LineAssignment>();
  const fields: PriceTagFields = {};

  if (!items.length) {
    warnings.push(translate('ocr.noTextWarning'));
  }

  const prices = rankPriceCandidates(items);
  const memberPrice = prices.find((candidate) => candidate.kind === 'memberPrice');
  if (memberPrice) {
    fields.memberPrice = memberPrice.value;
    usedIds.add(memberPrice.item.id);
    assignLine(lineAssignments, memberPrice.item, 'memberPrice', 'memberPrice');
  }

  const originalPrice = prices.find((candidate) => candidate.kind === 'originalPrice');
  if (originalPrice) {
    fields.originalPrice = originalPrice.value;
    usedIds.add(originalPrice.item.id);
    assignLine(lineAssignments, originalPrice.item, 'originalPrice', 'originalPrice');
  }

  const mainPrice = prices.find((candidate) => candidate.kind === 'price')
    ?? prices.find((candidate) => candidate !== memberPrice && candidate !== originalPrice);
  if (mainPrice) {
    fields.price = mainPrice.value;
    usedIds.add(mainPrice.item.id);
    assignLine(lineAssignments, mainPrice.item, 'price', 'price');
  } else if (items.length) {
    warnings.push(translate('ocr.priceUncertainWarning'));
  }

  const discountItem = items.find((item) => DISCOUNT_PATTERN.test(item.text));
  if (discountItem) {
    const match = discountItem.text.match(DISCOUNT_PATTERN);
    fields.discount = match ? Number(match[1].replace(',', '.')) : discountItem.text;
    usedIds.add(discountItem.id);
    assignLine(lineAssignments, discountItem, 'discount', 'discount');
  }

  const specItem = items.find((item) => SPEC_PATTERN.test(item.text) && !isLikelyPriceText(item.text));
  if (specItem) {
    fields.spec = specItem.text;
    usedIds.add(specItem.id);
    assignLine(lineAssignments, specItem, 'spec', 'spec');
  }

  const brandItem = findLabeledItem(items, /品牌[:：]?(.+)/);
  if (brandItem) {
    fields.brand = brandItem.value;
    usedIds.add(brandItem.item.id);
    assignLine(lineAssignments, brandItem.item, 'brand', 'brand');
  } else {
    const brandCandidate = items.find((item) =>
      item.box.top < (image?.height ?? 9999) * 0.35
      && CHINESE_PATTERN.test(item.text)
      && item.text.length <= 8
      && !isExcludedNameLine(item.text)
    );
    const hasProductLineAfterBrand = brandCandidate && items.some((item) =>
      item.id !== brandCandidate.id
      && item.box.top >= brandCandidate.box.top
      && item.box.width * item.box.height > brandCandidate.box.width * brandCandidate.box.height * 1.15
      && CHINESE_PATTERN.test(item.text)
      && item.text.length >= 2
      && !isExcludedNameLine(item.text)
    );
    if (brandCandidate && hasProductLineAfterBrand) {
      fields.brand = brandCandidate.text;
      usedIds.add(brandCandidate.id);
      assignLine(lineAssignments, brandCandidate, 'brand', 'brand');
    }
  }

  const originItem = findLabeledItem(items, /产地[:：]?(.+)/);
  if (originItem) {
    fields.origin = originItem.value;
    usedIds.add(originItem.item.id);
    assignLine(lineAssignments, originItem.item, 'origin', 'origin');
  }

  const promoItems = items.filter((item) =>
    PROMO_KEYWORDS.test(item.text)
    && !ORIGINAL_PRICE_KEYWORDS.test(item.text)
    && !MEMBER_PRICE_KEYWORDS.test(item.text)
  );
  if (promoItems.length) {
    fields.promoText = uniqueText(promoItems.map((item) => item.text)).slice(0, 2).join(' ');
    promoItems.forEach((item) => {
      usedIds.add(item.id);
      assignLine(lineAssignments, item, 'promoText', 'promoText');
    });
  }

  const productName = inferProductName(items, usedIds, image);
  if (productName) {
    fields.productName = productName.value;
    productName.items.forEach((item) => {
      usedIds.add(item.id);
      assignLine(lineAssignments, item, 'productName', 'productName');
    });
  } else if (items.length) {
    warnings.push(translate('ocr.productNameUncertainWarning'));
  }

  const description = inferDescription(items, usedIds);
  if (description) {
    fields.description = description.value;
    description.items.forEach((item) => {
      usedIds.add(item.id);
      assignLine(lineAssignments, item, 'description', 'description');
    });
  }

  const resolvedCodes = {
    ...codes,
    ...inferCodes(items, codes),
  };
  assignCodeLines(items, resolvedCodes, lineAssignments, usedIds);

  const { customFields, customFieldKeys } = collectCustomFields(items, usedIds);
  Object.assign(fields, customFields);
  const lineItems = buildLineItems(items, lineAssignments, customFieldKeys);

  const confidence = computeConfidence(items, fields, warnings);
  return {
    fields,
    codes: resolvedCodes,
    rawItems: items,
    lineItems,
    provider,
    confidence,
    warnings,
    image,
    customFields,
  };
}

function rankPriceCandidates(items: OcrTextItem[]): RankedPrice[] {
  const candidates: RankedPrice[] = [];
  const averageHeight = items.reduce((sum, item) => sum + item.box.height, 0) / Math.max(1, items.length);

  for (const item of items) {
    const normalized = item.text.replace(/,/g, '.');
    for (const match of normalized.matchAll(PRICE_NUMBER_PATTERN)) {
      const value = Number(match[1]);
      if (!Number.isFinite(value) || value <= 0) continue;
      if (SPEC_PATTERN.test(item.text) && !PRICE_KEYWORDS.test(item.text)) continue;
      if (/^\d{6,}$/.test(match[1])) continue;
      const hasPriceSignal = PRICE_KEYWORDS.test(item.text);
      const hasDecimal = /[.,]\d{1,2}/.test(match[1]);
      const isVisuallyDominant = item.box.height > averageHeight * 1.7 && item.box.width > averageHeight * 1.4;
      if (!hasPriceSignal && !hasDecimal && (!isVisuallyDominant || value >= 1000)) continue;

      let score = value;
      if (/[$¥￥元]/.test(item.text)) score += 10000;
      if (hasPriceSignal) score += 6000;
      if (hasDecimal) score += 3500;
      if (item.box.height > averageHeight * 1.35) score += 5000;
      score += item.score * 1000;

      const kind = MEMBER_PRICE_KEYWORDS.test(item.text)
        ? 'memberPrice'
        : ORIGINAL_PRICE_KEYWORDS.test(item.text)
          ? 'originalPrice'
          : 'price';
      candidates.push({ value, item, score, kind });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function inferProductName(
  items: OcrTextItem[],
  usedIds: Set<string>,
  image?: { width: number; height: number }
): { value: string; items: OcrTextItem[] } | null {
  const imageHeight = image?.height ?? Math.max(...items.map((item) => item.box.bottom), 1);
  const candidates = items
    .filter((item) =>
      !usedIds.has(item.id)
      && NAME_TEXT_PATTERN.test(item.text)
      && item.text.length >= 2
      && item.box.top <= imageHeight * 0.72
      && !isExcludedNameLine(item.text)
    )
    .sort((a, b) => {
      const areaDelta = b.box.width * b.box.height - a.box.width * a.box.height;
      if (Math.abs(areaDelta) > 8) return areaDelta;
      return a.box.top - b.box.top;
    });

  if (!candidates.length) return null;
  const primary = candidates[0];
  const joined = [
    ...candidates.filter((item) =>
      item.id === primary.id
      || (
        Math.abs(item.box.top - primary.box.top) < Math.max(10, primary.box.height * 0.75)
        && item.box.left > primary.box.left
        && item.box.left - primary.box.right < Math.max(30, primary.box.height * 2.5)
      )
    ),
  ];
  const secondLine = candidates.find((item) =>
    item.id !== primary.id
    && !joined.some((joinedItem) => joinedItem.id === item.id)
    && Math.abs(item.box.left - primary.box.left) < Math.max(18, primary.box.width * 0.25)
    && item.box.top > primary.box.top
    && item.box.top - primary.box.bottom < Math.max(18, primary.box.height * 1.5)
    && !SPEC_PATTERN.test(item.text)
  );
  if (secondLine) joined.push(secondLine);

  joined.sort(readingOrder);
  return {
    value: uniqueText(joined.map((item) => item.text)).join(' '),
    items: joined,
  };
}

function inferDescription(items: OcrTextItem[], usedIds: Set<string>): { value: string; items: OcrTextItem[] } | null {
  const candidates = items.filter((item) =>
    !usedIds.has(item.id)
    && item.text.length >= 2
    && !isLikelyPriceText(item.text)
    && !BARCODE_PATTERN.test(item.text)
  );
  if (!candidates.length) return null;
  return {
    value: uniqueText(candidates.slice(0, 3).map((item) => item.text)).join(' '),
    items: candidates.slice(0, 3),
  };
}

function inferCodes(items: OcrTextItem[], current: OcrCodeResults): OcrCodeResults {
  const codes: OcrCodeResults = {};
  if (!current.qrContent) {
    const qr = items.find((item) => URL_PATTERN.test(item.text));
    if (qr) codes.qrContent = qr.text;
  }
  if (!current.barcodeContent) {
    const barcode = items.find((item) => {
      const compactText = item.text.replace(/\s/g, '');
      return OCR_BARCODE_FALLBACK_PATTERN.test(compactText)
        || (/sku|条码|barcode/i.test(item.text) && BARCODE_PATTERN.test(compactText));
    });
    if (barcode) codes.barcodeContent = barcode.text.replace(/\s/g, '');
  }
  return codes;
}

function assignLine(
  assignments: Map<string, LineAssignment>,
  item: OcrTextItem,
  role: OcrLineRole,
  fieldKey: string | null,
  options: { force?: boolean; warning?: string } = {}
): void {
  if (!options.force && assignments.has(item.id)) return;
  assignments.set(item.id, {
    role,
    fieldKey,
    warnings: options.warning ? [options.warning] : [],
  });
}

function assignCodeLines(
  items: OcrTextItem[],
  codes: OcrCodeResults,
  assignments: Map<string, LineAssignment>,
  usedIds: Set<string>
): void {
  if (codes.qrContent) {
    const qrItem = items.find((item) => URL_PATTERN.test(item.text) || item.text === codes.qrContent);
    if (qrItem) {
      usedIds.add(qrItem.id);
      assignLine(assignments, qrItem, 'qrContent', 'qrContent', {
        warning: translate('ocr.qrLineWarning'),
      });
    }
  }

  if (codes.barcodeContent) {
    const barcodeItem = items.find((item) =>
      item.text.replace(/\s/g, '') === codes.barcodeContent
      || BARCODE_PATTERN.test(item.text.replace(/\s/g, ''))
    );
    if (barcodeItem) {
      usedIds.add(barcodeItem.id);
      assignLine(assignments, barcodeItem, 'barcodeContent', 'barcodeContent', {
        warning: translate('ocr.barcodeLineWarning'),
      });
    }
  }
}

function collectCustomFields(
  items: OcrTextItem[],
  usedIds: Set<string>
): { customFields: Record<string, string>; customFieldKeys: Map<string, string> } {
  const custom: Record<string, string> = {};
  const customFieldKeys = new Map<string, string>();
  let index = 1;
  for (const item of items) {
    if (usedIds.has(item.id)) continue;
    if (!item.text) continue;
    custom[`ocrText${index}`] = item.text;
    customFieldKeys.set(item.id, `ocrText${index}`);
    index++;
  }
  return { customFields: custom, customFieldKeys };
}

function buildLineItems(
  items: OcrTextItem[],
  assignments: Map<string, LineAssignment>,
  customFieldKeys: Map<string, string>
): OcrLineItem[] {
  return items.map((item) => {
    const assignment = assignments.get(item.id);
    const role = assignment?.role ?? 'customText';
    const fieldKey = assignment?.fieldKey ?? customFieldKeys.get(item.id) ?? null;
    const warnings = [...(assignment?.warnings ?? [])];

    if (!assignment) {
      warnings.push(translate('ocr.unclassifiedLineWarning'));
    }
    if (item.score > 0 && item.score < 0.55) {
      warnings.push(translate('ocr.lowConfidenceWarning'));
    }

    return {
      ...item,
      role,
      fieldKey,
      includeInTemplate: true,
      warnings,
    };
  });
}

function findLabeledItem(items: OcrTextItem[], pattern: RegExp): { item: OcrTextItem; value: string } | null {
  for (const item of items) {
    const match = item.text.match(pattern);
    if (!match) continue;
    return {
      item,
      value: (match[1] || item.text).trim(),
    };
  }
  return null;
}

function computeConfidence(items: OcrTextItem[], fields: PriceTagFields, warnings: string[]): number {
  const averageScore = items.reduce((sum, item) => sum + item.score, 0) / Math.max(1, items.length);
  let fieldScore = 0;
  if (fields.productName) fieldScore += 0.18;
  if (fields.price != null || fields.memberPrice != null) fieldScore += 0.22;
  if (fields.spec || fields.description) fieldScore += 0.08;
  if (fields.discount || fields.promoText) fieldScore += 0.06;
  const warningPenalty = Math.min(0.2, warnings.length * 0.05);
  return Math.max(0, Math.min(1, averageScore * 0.46 + fieldScore + 0.22 - warningPenalty));
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[￥]/g, '¥')
    .trim();
}

function isLikelyPriceText(text: string): boolean {
  return PRICE_KEYWORDS.test(text) || /[¥￥]\s*\d/.test(text);
}

function isExcludedNameLine(text: string): boolean {
  return isLikelyPriceText(text)
    || SPEC_PATTERN.test(text)
    || PROMO_KEYWORDS.test(text)
    || ORIGINAL_PRICE_KEYWORDS.test(text)
    || MEMBER_PRICE_KEYWORDS.test(text)
    || /产地|品牌|条码|编码|货号|SKU|barcode/i.test(text)
    || OCR_BARCODE_FALLBACK_PATTERN.test(text.replace(/\s/g, ''));
}

function uniqueText(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map(normalizeText)) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function readingOrder(a: OcrTextItem, b: OcrTextItem): number {
  const rowTolerance = Math.max(8, Math.min(a.box.height, b.box.height) * 0.7);
  if (Math.abs(a.box.top - b.box.top) > rowTolerance) return a.box.top - b.box.top;
  return a.box.left - b.box.left;
}
