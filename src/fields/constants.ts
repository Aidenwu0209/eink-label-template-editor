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
export const TEXT_BINDABLE_FIELDS: readonly string[] = ['productName', 'description'] as const;

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
