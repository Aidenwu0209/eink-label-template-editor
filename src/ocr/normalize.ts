import type { OcrBox, OcrCodeResults, OcrPoint, OcrProviderRawResult, OcrTextItem } from './types';

type RawPoint = OcrPoint | { x?: unknown; y?: unknown } | number[];

interface RawOcrItem {
  id?: unknown;
  text?: unknown;
  score?: unknown;
  confidence?: unknown;
  poly?: RawPoint[];
  box?: Partial<OcrBox> | number[];
  bbox?: Partial<OcrBox> | number[];
}

interface RawOcrResponse {
  image?: { width?: unknown; height?: unknown };
  items?: RawOcrItem[];
  result?: { items?: RawOcrItem[]; image?: { width?: unknown; height?: unknown } };
  codes?: OcrCodeResults;
  metrics?: Record<string, unknown>;
  provider?: unknown;
}

export function normalizeOcrResponse(
  raw: unknown,
  provider: OcrProviderRawResult['provider'],
  fallbackImage?: { width: number; height: number }
): OcrProviderRawResult {
  const response = (raw ?? {}) as RawOcrResponse;
  const result = response.result ?? response;
  const rawItems = Array.isArray(result.items) ? result.items : [];
  const items = normalizeOcrItems(rawItems);
  const image = normalizeImage(result.image ?? response.image, fallbackImage);

  return {
    image,
    items,
    codes: response.codes,
    metrics: response.metrics,
    provider,
  };
}

export function normalizeOcrItems(rawItems: RawOcrItem[]): OcrTextItem[] {
  return rawItems
    .map((item, index) => normalizeOcrItem(item, index))
    .filter((item): item is OcrTextItem => Boolean(item));
}

function normalizeOcrItem(item: RawOcrItem, index: number): OcrTextItem | null {
  const text = String(item.text ?? '').trim();
  if (!text) return null;

  const poly = normalizePoly(item.poly, item.box ?? item.bbox);
  const box = computeBox(poly);
  if (!box) return null;

  const score = Number(item.score ?? item.confidence ?? 0);

  return {
    id: typeof item.id === 'string' && item.id ? item.id : `ocr_${index + 1}`,
    text,
    score: Number.isFinite(score) ? score : 0,
    poly,
    box,
  };
}

function normalizePoly(poly: RawPoint[] | undefined, rawBox: RawOcrItem['box']): OcrPoint[] {
  if (Array.isArray(poly) && poly.length >= 4) {
    return poly.map(normalizePoint).filter((point): point is OcrPoint => Boolean(point));
  }

  const box = normalizeRawBox(rawBox);
  if (!box) return [];

  return [
    [box.left, box.top],
    [box.right, box.top],
    [box.right, box.bottom],
    [box.left, box.bottom],
  ];
}

function normalizePoint(point: RawPoint): OcrPoint | null {
  if (Array.isArray(point)) {
    const x = Number(point[0]);
    const y = Number(point[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  }

  const x = Number(point.x);
  const y = Number(point.y);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

function normalizeRawBox(rawBox: RawOcrItem['box']): OcrBox | null {
  if (!rawBox) return null;

  if (Array.isArray(rawBox)) {
    const [left, top, widthOrRight, heightOrBottom] = rawBox.map(Number);
    if ([left, top, widthOrRight, heightOrBottom].some((value) => !Number.isFinite(value))) return null;
    const width = widthOrRight > left ? widthOrRight - left : widthOrRight;
    const height = heightOrBottom > top ? heightOrBottom - top : heightOrBottom;
    return createBox(left, top, width, height);
  }

  const left = Number(rawBox.left ?? 0);
  const top = Number(rawBox.top ?? 0);
  const width = Number(rawBox.width ?? Math.max(0, Number(rawBox.right ?? 0) - left));
  const height = Number(rawBox.height ?? Math.max(0, Number(rawBox.bottom ?? 0) - top));
  if (![left, top, width, height].every(Number.isFinite)) return null;
  return createBox(left, top, width, height);
}

function computeBox(poly: OcrPoint[]): OcrBox | null {
  if (poly.length < 2) return null;
  const xs = poly.map(([x]) => x);
  const ys = poly.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return createBox(left, top, right - left, bottom - top);
}

function createBox(left: number, top: number, width: number, height: number): OcrBox {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const safeLeft = Math.round(left);
  const safeTop = Math.round(top);
  return {
    left: safeLeft,
    top: safeTop,
    width: safeWidth,
    height: safeHeight,
    right: safeLeft + safeWidth,
    bottom: safeTop + safeHeight,
    centerX: safeLeft + safeWidth / 2,
    centerY: safeTop + safeHeight / 2,
  };
}

function normalizeImage(
  rawImage: RawOcrResponse['image'],
  fallback?: { width: number; height: number }
): { width: number; height: number } | undefined {
  const width = Number(rawImage?.width ?? fallback?.width);
  const height = Number(rawImage?.height ?? fallback?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return fallback;
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}
