/**
 * System reserved field definitions and custom field validation
 */
import { translate } from '@/i18n';

/** Reserved system field names — these cannot be used as custom field IDs */
export const SYSTEM_FIELDS = [
  'productName',
  'price',
  'originalPrice',
  'memberPrice',
  'discount',
  'description',
  'spec',
  'brand',
  'origin',
  'promoText',
  'imageUrl',
  'qrContent',
  'barcodeContent',
] as const;

export type SystemField = (typeof SYSTEM_FIELDS)[number];

/** System fields that TEXT can bind to */
export const TEXT_BINDABLE_FIELDS: readonly string[] = [
  'productName',
  'description',
  'spec',
  'brand',
  'origin',
  'promoText',
  'barcodeContent',
  'qrContent',
] as const;

/** System fields that PRICE can bind to */
export const PRICE_BINDABLE_FIELDS = ['price', 'originalPrice', 'memberPrice'] as const;
export type PriceBindableField = (typeof PRICE_BINDABLE_FIELDS)[number];

/** Custom field supports text type only */
export const CUSTOM_FIELD_TYPE = 'text' as const;

export type CustomFieldType = typeof CUSTOM_FIELD_TYPE;

/** Custom field definition */
export interface CustomField {
  id: string;
  type: CustomFieldType;
}

/** Validation error for a custom field ID */
export interface FieldValidationError {
  field: string;
  message: string;
}

// ── ID pattern: starts with letter, only letters/digits/underscores ──
const CUSTOM_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Validate a custom field ID against all rules.
 * Returns an array of errors (empty = valid).
 */
export function validateCustomFieldId(
  id: string,
  existingIds?: string[]
): FieldValidationError[] {
  const errors: FieldValidationError[] = [];

  if (!id || id.trim() === '') {
    errors.push({ field: id, message: translate('errors.customFieldEmpty') });
    return errors;
  }

  if (SYSTEM_FIELDS.includes(id as SystemField)) {
    errors.push({
      field: id,
      message: translate('errors.customFieldReserved', { id }),
    });
    return errors;
  }

  if (!CUSTOM_ID_PATTERN.test(id)) {
    if (!/^[A-Za-z]/.test(id)) {
      errors.push({
        field: id,
        message: translate('errors.customFieldStart'),
      });
    } else {
      errors.push({
        field: id,
        message: translate('errors.customFieldPattern'),
      });
    }
  }

  if (existingIds && existingIds.includes(id)) {
    errors.push({
      field: id,
      message: translate('errors.customFieldDuplicate', { id }),
    });
  }

  return errors;
}

/**
 * Convenience: returns true when the ID passes all validation rules.
 */
export function isValidCustomFieldId(
  id: string,
  existingIds?: string[]
): boolean {
  return validateCustomFieldId(id, existingIds).length === 0;
}

/**
 * Return only legal custom field IDs, preserving input order and removing duplicates.
 */
export function filterValidCustomFieldIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];

  for (const id of ids) {
    if (seen.has(id) || !isValidCustomFieldId(id)) continue;
    seen.add(id);
    valid.push(id);
  }

  return valid;
}

/**
 * Extract legal custom text fields from preview data.
 * System fields are rejected by validateCustomFieldId(), and non-string values are ignored.
 */
export function getValidCustomFieldIdsFromPreviewData(
  previewData?: Record<string, unknown> | null
): string[] {
  if (!previewData) return [];

  return filterValidCustomFieldIds(
    Object.entries(previewData)
      .filter(([, value]) => typeof value === 'string')
      .map(([id]) => id)
  );
}
