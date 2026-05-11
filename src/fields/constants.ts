/**
 * System reserved field definitions and custom field validation
 */

/** Reserved system field names — these cannot be used as custom field IDs */
export const SYSTEM_FIELDS = [
  'productName',
  'price',
  'discount',
  'description',
  'imageUrl',
  'qrContent',
  'barcodeContent',
] as const;

export type SystemField = (typeof SYSTEM_FIELDS)[number];

/** System fields that TEXT can bind to */
export const TEXT_BINDABLE_FIELDS: readonly string[] = ['productName', 'description', 'barcodeContent'] as const;

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
    errors.push({ field: id, message: '自定义字段 ID 不能为空' });
    return errors;
  }

  if (SYSTEM_FIELDS.includes(id as SystemField)) {
    errors.push({
      field: id,
      message: `"${id}" 是系统保留字段，不能用作自定义字段`,
    });
    return errors;
  }

  if (!CUSTOM_ID_PATTERN.test(id)) {
    if (!/^[A-Za-z]/.test(id)) {
      errors.push({
        field: id,
        message: '自定义字段 ID 必须以英文字母开头',
      });
    } else {
      errors.push({
        field: id,
        message: '自定义字段 ID 只能包含英文字母、数字和下划线',
      });
    }
  }

  if (existingIds && existingIds.includes(id)) {
    errors.push({
      field: id,
      message: `自定义字段 ID "${id}" 已存在，不能重复`,
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
