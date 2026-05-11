<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BootConfig } from '@/boot/types';
import { recognizePriceTag } from '@/ocr/providers';
import type { OcrLineItem, OcrLineRole, OcrProviderMode, RecognizedPriceTag } from '@/ocr/types';
import type { SmartTemplateKind } from '@/ocr/templatePlanner';

const OCR_API_STORAGE_KEY = 'eink-label-template-editor.ocrApi.v1';

const FIELD_DEFS = [
  { key: 'productName', labelKey: 'fields.productName', type: 'text' },
  { key: 'brand', labelKey: 'fields.brand', type: 'text' },
  { key: 'price', labelKey: 'ocr.rolePrice', type: 'number' },
  { key: 'memberPrice', labelKey: 'fields.memberPrice', type: 'number' },
  { key: 'originalPrice', labelKey: 'fields.originalPrice', type: 'number' },
  { key: 'discount', labelKey: 'fields.discount', type: 'text' },
  { key: 'spec', labelKey: 'fields.spec', type: 'text' },
  { key: 'description', labelKey: 'fields.description', type: 'text' },
  { key: 'origin', labelKey: 'fields.origin', type: 'text' },
  { key: 'promoText', labelKey: 'fields.promoText', type: 'text' },
  { key: 'barcodeContent', labelKey: 'fields.barcodeContent', type: 'text' },
  { key: 'qrContent', labelKey: 'fields.qrContent', type: 'text' },
] as const;

const LINE_ROLE_OPTIONS: Array<{ value: OcrLineRole; labelKey: string }> = [
  { value: 'productName', labelKey: 'ocr.roleProductName' },
  { value: 'brand', labelKey: 'ocr.roleBrand' },
  { value: 'price', labelKey: 'ocr.rolePrice' },
  { value: 'memberPrice', labelKey: 'ocr.roleMemberPrice' },
  { value: 'originalPrice', labelKey: 'ocr.roleOriginalPrice' },
  { value: 'discount', labelKey: 'ocr.roleDiscount' },
  { value: 'spec', labelKey: 'ocr.roleSpec' },
  { value: 'description', labelKey: 'ocr.roleDescription' },
  { value: 'origin', labelKey: 'ocr.roleOrigin' },
  { value: 'promoText', labelKey: 'ocr.rolePromoText' },
  { value: 'barcodeContent', labelKey: 'ocr.roleBarcodeContent' },
  { value: 'qrContent', labelKey: 'ocr.roleQrContent' },
  { value: 'customText', labelKey: 'ocr.roleCustomText' },
] as const;

const PRICE_ROLES = new Set<OcrLineRole>(['price', 'memberPrice', 'originalPrice']);
type PriceLineRole = 'price' | 'memberPrice' | 'originalPrice';
type FieldLineRole = Exclude<OcrLineRole, 'barcodeContent' | 'qrContent' | 'customText'>;

const props = defineProps<{
  open: boolean;
  config: BootConfig;
  hasExistingObjects: boolean;
}>();

const { t } = useI18n();

const emit = defineEmits<{
  close: [];
  apply: [payload: { recognized: RecognizedPriceTag; templateKind: SmartTemplateKind }];
}>();

const fileInputRef = ref<HTMLInputElement>();
const selectedFile = ref<File | null>(null);
const previewUrl = ref('');
const providerMode = ref<OcrProviderMode>('auto');
const templateKind = ref<SmartTemplateKind>('restore');
const apiEndpoint = ref('');
const isRecognizing = ref(false);
const errorMessage = ref('');
const recognized = ref<RecognizedPriceTag | null>(null);
const editableValues = ref<Record<string, string>>({});
const editableLineItems = ref<OcrLineItem[]>([]);
const activeLineId = ref<string | null>(null);

const fieldRows = computed(() => {
  const known = FIELD_DEFS.map((field) => ({
    ...field,
    label: t(field.labelKey),
    value: editableValues.value[field.key] ?? '',
  }));
  const knownKeys = new Set(FIELD_DEFS.map((field) => field.key));
  const custom = Object.entries(editableValues.value)
    .filter(([key, value]) => !knownKeys.has(key as any) && value)
    .map(([key, value]) => ({ key, label: t('ocr.customField', { key }), type: 'text' as const, value }));
  return [...known, ...custom];
});

const recognitionSummary = computed(() => {
  if (!recognized.value) return t('ocr.waiting');
  const percent = Math.round(recognized.value.confidence * 100);
  const included = editableLineItems.value.filter((line) => line.includeInTemplate !== false).length;
  return t('ocr.summary', {
    provider: recognized.value.provider,
    rows: editableLineItems.value.length,
    included,
    confidence: percent,
  });
});

const overlayItems = computed(() => editableLineItems.value);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    apiEndpoint.value = props.config.ocrApi
      ?? localStorage.getItem(OCR_API_STORAGE_KEY)
      ?? '/ocr/price-tag';
  },
  { immediate: true }
);

function closeDialog(): void {
  emit('close');
}

function triggerFilePicker(): void {
  fileInputRef.value?.click();
}

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  errorMessage.value = '';
  recognized.value = null;
  editableValues.value = {};
  editableLineItems.value = [];
  activeLineId.value = null;

  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  selectedFile.value = null;

  if (!file) return;
  if (!file.type.startsWith('image/')) {
    errorMessage.value = t('ocr.selectImageFile');
    input.value = '';
    return;
  }

  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
}

async function runRecognition(): Promise<void> {
  const file = selectedFile.value;
  if (!file) {
    errorMessage.value = t('ocr.uploadFirst');
    return;
  }

  errorMessage.value = '';
  isRecognizing.value = true;
  try {
    if (providerMode.value !== 'browser-local') {
      localStorage.setItem(OCR_API_STORAGE_KEY, apiEndpoint.value.trim());
    }
    const result = await recognizePriceTag(file, {
      mode: providerMode.value,
      apiEndpoint: apiEndpoint.value.trim() || undefined,
      config: props.config,
    });
    recognized.value = result;
    editableValues.value = valuesFromRecognized(result);
    editableLineItems.value = cloneLineItems(result);
    activeLineId.value = editableLineItems.value[0]?.id ?? null;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err);
  } finally {
    isRecognizing.value = false;
  }
}

function valuesFromRecognized(result: RecognizedPriceTag): Record<string, string> {
  const values: Record<string, string> = {};
  const merged = {
    ...result.fields,
    ...result.codes,
    ...(result.customFields ?? {}),
  };

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === '') continue;
    values[key] = String(value);
  }

  return values;
}

function updateField(key: string, event: Event): void {
  editableValues.value = {
    ...editableValues.value,
    [key]: (event.target as HTMLInputElement).value,
  };
}

function cloneLineItems(result: RecognizedPriceTag): OcrLineItem[] {
  if (result.lineItems?.length) {
    return result.lineItems.map((line) => ({
      ...line,
      warnings: [...line.warnings],
    }));
  }

  return result.rawItems.map((item, index) => ({
    ...item,
    role: 'customText',
    fieldKey: `ocrText${index + 1}`,
    includeInTemplate: true,
    warnings: [t('ocr.historicalLineWarning')],
  }));
}

function setActiveLine(id: string): void {
  activeLineId.value = id;
}

function updateLineText(id: string, event: Event): void {
  const text = (event.target as HTMLInputElement).value;
  editableLineItems.value = editableLineItems.value.map((line) => {
    if (line.id !== id) return line;
    const next = { ...line, text };
    syncLineToField(next);
    return next;
  });
}

function updateLineRole(id: string, event: Event): void {
  const role = (event.target as HTMLSelectElement).value as OcrLineRole;
  editableLineItems.value = editableLineItems.value.map((line, index) => {
    if (line.id !== id) return line;
    const next = {
      ...line,
      role,
      fieldKey: defaultFieldKeyForRole(role, index),
    };
    syncLineToField(next);
    return next;
  });
}

function updateLineInclude(id: string, event: Event): void {
  const includeInTemplate = (event.target as HTMLInputElement).checked;
  editableLineItems.value = editableLineItems.value.map((line) =>
    line.id === id ? { ...line, includeInTemplate } : line
  );
}

function syncLineToField(line: OcrLineItem): void {
  const value = line.text.trim();
  const fieldKey = line.fieldKey;
  if (!fieldKey || !value) return;
  if (isPriceLineRole(line.role) || line.role === 'discount') {
    const numeric = parseNumeric(value);
    editableValues.value = {
      ...editableValues.value,
      [fieldKey]: numeric == null ? value : String(numeric),
    };
    return;
  }

  if (line.role === 'barcodeContent' || line.role === 'qrContent' || line.role === 'customText' || isFieldLineRole(line.role)) {
    editableValues.value = {
      ...editableValues.value,
      [fieldKey]: value,
    };
  }
}

function defaultFieldKeyForRole(role: OcrLineRole, index: number): string | null {
  return role === 'customText' ? `ocrText${index + 1}` : role;
}

function lineRoleLabel(role: OcrLineRole): string {
  const option = LINE_ROLE_OPTIONS.find((item) => item.value === role);
  return option ? t(option.labelKey) : role;
}

function isPriceLineRole(role: OcrLineRole): role is PriceLineRole {
  return PRICE_ROLES.has(role);
}

function isFieldLineRole(role: OcrLineRole): role is FieldLineRole {
  return role !== 'barcodeContent' && role !== 'qrContent' && role !== 'customText';
}

function parseNumeric(value: string): number | null {
  const match = value.replace(/,/g, '.').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

function applyTemplate(): void {
  const base = recognized.value;
  if (!base) return;
  if (props.hasExistingObjects && !window.confirm(t('ocr.confirmReplace'))) {
    return;
  }

  emit('apply', {
    recognized: buildRecognizedFromEditable(base),
    templateKind: templateKind.value,
  });
}

function buildRecognizedFromEditable(base: RecognizedPriceTag): RecognizedPriceTag {
  const nextFields: RecognizedPriceTag['fields'] = {};
  const nextCodes: RecognizedPriceTag['codes'] = {};
  const nextCustom: Record<string, string> = {};
  const knownKeys = new Set(FIELD_DEFS.map((field) => field.key));

  for (const [key, rawValue] of Object.entries(editableValues.value)) {
    const value = rawValue.trim();
    if (!value) continue;
    if (key === 'barcodeContent' || key === 'qrContent') {
      nextCodes[key] = value;
    } else if (['price', 'originalPrice', 'memberPrice'].includes(key)) {
      const numeric = Number(value);
      nextFields[key] = Number.isFinite(numeric) ? numeric : value;
    } else if (key === 'discount') {
      const numeric = Number(value);
      nextFields.discount = Number.isFinite(numeric) ? numeric : value;
    } else if (knownKeys.has(key as any)) {
      nextFields[key] = value;
    } else {
      nextFields[key] = value;
      nextCustom[key] = value;
    }
  }

  const nextLineItems = editableLineItems.value.map((line, index) => {
    const text = line.text.trim();
    const fieldKey = line.fieldKey ?? defaultFieldKeyForRole(line.role, index);
    const next = {
      ...line,
      text,
      fieldKey,
      warnings: [...line.warnings],
    };

    if (!text) return next;

    if (line.role === 'barcodeContent') {
      nextCodes.barcodeContent = text;
    } else if (line.role === 'qrContent') {
      nextCodes.qrContent = text;
    } else if (isPriceLineRole(line.role)) {
      const numeric = parseNumeric(text);
      if (numeric != null && nextFields[line.role] == null) {
        nextFields[line.role] = numeric;
      }
    } else if (line.role === 'discount') {
      const numeric = parseNumeric(text);
      if (nextFields.discount == null) {
        nextFields.discount = numeric ?? text;
      }
    } else if (line.role === 'customText' && fieldKey) {
      nextFields[fieldKey] = text;
      nextCustom[fieldKey] = text;
    } else if (isFieldLineRole(line.role) && nextFields[line.role] == null) {
      nextFields[line.role] = text;
    }

    return next;
  });

  return {
    ...base,
    fields: nextFields,
    codes: nextCodes,
    customFields: nextCustom,
    rawItems: nextLineItems,
    lineItems: nextLineItems,
  };
}

function overlayBoxStyle(item: OcrLineItem) {
  const image = recognized.value?.image;
  if (!image) return {};
  return {
    left: `${(item.box.left / image.width) * 100}%`,
    top: `${(item.box.top / image.height) * 100}%`,
    width: `${(item.box.width / image.width) * 100}%`,
    height: `${(item.box.height / image.height) * 100}%`,
  };
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="ocr-backdrop" role="dialog" aria-modal="true" :aria-label="t('ocr.dialogLabel')">
      <section class="ocr-dialog">
        <header class="ocr-header">
          <div>
            <span class="ocr-kicker">PaddleOCR</span>
            <h2>{{ t('ocr.title') }}</h2>
          </div>
          <button class="icon-btn" type="button" :title="t('common.close')" @click="closeDialog">×</button>
        </header>

        <div class="ocr-body">
          <aside class="ocr-left">
            <div class="upload-panel">
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                hidden
                @change="handleFileChange"
              />
              <button class="upload-btn" type="button" @click="triggerFilePicker">
                {{ selectedFile ? t('ocr.replaceImage') : t('ocr.upload') }}
              </button>
              <span v-if="selectedFile" class="file-name">{{ selectedFile.name }}</span>
            </div>

            <div class="preview-frame">
              <div v-if="previewUrl" class="preview-raster">
                <img :src="previewUrl" :alt="t('ocr.previewAlt')" />
                <div v-if="overlayItems.length" class="ocr-overlay">
                  <span
                    v-for="item in overlayItems"
                    :key="item.id"
                    class="ocr-box"
                    :class="{ active: activeLineId === item.id, muted: item.includeInTemplate === false }"
                    :style="overlayBoxStyle(item)"
                    :title="`${item.text} · ${Math.round(item.score * 100)}%`"
                    role="button"
                    tabindex="0"
                    @click="setActiveLine(item.id)"
                    @mouseenter="setActiveLine(item.id)"
                    @focus="setActiveLine(item.id)"
                  ></span>
                </div>
              </div>
              <div v-if="!previewUrl" class="preview-empty">{{ t('ocr.emptyPreview') }}</div>
            </div>
          </aside>

          <section class="ocr-right">
            <div class="settings-grid">
              <label class="setting-field">
                <span>{{ t('ocr.provider') }}</span>
                <select v-model="providerMode">
                  <option value="auto">{{ t('ocr.providerAuto') }}</option>
                  <option value="browser-local">{{ t('ocr.providerLocal') }}</option>
                  <option value="paddle-api">{{ t('ocr.providerApi') }}</option>
                </select>
              </label>

              <label class="setting-field">
                <span>{{ t('ocr.apiEndpoint') }}</span>
                <input
                  v-model="apiEndpoint"
                  type="text"
                  placeholder="/ocr/price-tag"
                  :disabled="providerMode === 'browser-local'"
                />
              </label>

              <label class="setting-field">
                <span>{{ t('ocr.templateKind') }}</span>
                <select v-model="templateKind">
                  <option value="restore">{{ t('ocr.templateRestore') }}</option>
                  <option value="auto">{{ t('ocr.templateAuto') }}</option>
                  <option value="standard">{{ t('ocr.templateStandard') }}</option>
                  <option value="promotion">{{ t('ocr.templatePromotion') }}</option>
                  <option value="member">{{ t('ocr.templateMember') }}</option>
                  <option value="barcode">{{ t('ocr.templateBarcode') }}</option>
                  <option value="qr">{{ t('ocr.templateQr') }}</option>
                </select>
              </label>
            </div>

            <div class="run-row">
              <button class="primary-btn" type="button" :disabled="isRecognizing || !selectedFile" @click="runRecognition">
                {{ isRecognizing ? t('ocr.recognizing') : t('ocr.start') }}
              </button>
              <span class="recognition-summary">{{ recognitionSummary }}</span>
            </div>

            <div v-if="errorMessage" class="ocr-error">{{ errorMessage }}</div>
            <div v-if="recognized?.warnings.length" class="ocr-warnings">
              <div v-for="warning in recognized.warnings" :key="warning">{{ warning }}</div>
            </div>

            <div class="field-table">
              <div class="field-row field-head">
                <span>{{ t('ocr.field') }}</span>
                <span>{{ t('ocr.recognizedValue') }}</span>
              </div>
              <label v-for="row in fieldRows" :key="row.key" class="field-row">
                <span>{{ row.label }}</span>
                <input
                  :type="row.type === 'number' ? 'number' : 'text'"
                  :step="row.type === 'number' ? '0.01' : undefined"
                  :value="row.value"
                  @input="updateField(row.key, $event)"
                />
              </label>
            </div>

            <div v-if="editableLineItems.length" class="line-table">
              <div class="line-head">
                <span>{{ t('ocr.details') }}</span>
                <span>{{ t('ocr.detailsCount', { count: editableLineItems.length }) }}</span>
              </div>
              <div class="line-grid line-grid-head">
                <span>{{ t('ocr.include') }}</span>
                <span>{{ t('ocr.box') }}</span>
                <span>{{ t('ocr.role') }}</span>
                <span>{{ t('ocr.text') }}</span>
                <span>{{ t('ocr.confidence') }}</span>
              </div>
              <label
                v-for="(line, index) in editableLineItems"
                :key="line.id"
                class="line-grid line-row"
                :class="{ active: activeLineId === line.id, muted: line.includeInTemplate === false }"
                @mouseenter="setActiveLine(line.id)"
                @focusin="setActiveLine(line.id)"
              >
                <input
                  type="checkbox"
                  :checked="line.includeInTemplate !== false"
                  @change="updateLineInclude(line.id, $event)"
                />
                <button class="line-index" type="button" @click="setActiveLine(line.id)">
                  #{{ index + 1 }}
                </button>
                <select :value="line.role" @change="updateLineRole(line.id, $event)">
                  <option v-for="option in LINE_ROLE_OPTIONS" :key="option.value" :value="option.value">
                    {{ t(option.labelKey) }}
                  </option>
                </select>
                <input
                  type="text"
                  :value="line.text"
                  :title="line.warnings.join('；') || lineRoleLabel(line.role)"
                  @input="updateLineText(line.id, $event)"
                />
                <span class="line-score" :title="line.warnings.join('；')">
                  {{ Math.round(line.score * 100) }}%
                </span>
              </label>
            </div>
          </section>
        </div>

        <footer class="ocr-footer">
          <button class="ghost-btn" type="button" @click="closeDialog">{{ t('common.cancel') }}</button>
          <button class="primary-btn" type="button" :disabled="!recognized" @click="applyTemplate">{{ t('ocr.apply') }}</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.ocr-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at 20% 12%, rgba(216, 183, 96, 0.13), transparent 32%),
    radial-gradient(circle at 82% 18%, rgba(141, 188, 246, 0.075), transparent 30%),
    rgba(3, 4, 6, 0.78);
  backdrop-filter: blur(16px);
}

.ocr-dialog {
  width: min(1060px, 96vw);
  max-height: min(780px, 94vh);
  display: flex;
  flex-direction: column;
  color: var(--text-main);
  background:
    radial-gradient(circle at 16% 0%, rgba(216, 183, 96, 0.08), transparent 36%),
    linear-gradient(180deg, rgba(33, 36, 43, 0.98), rgba(15, 17, 21, 0.98));
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  box-shadow: var(--shadow-float);
  overflow: hidden;
}

.ocr-header,
.ocr-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  background: linear-gradient(180deg, rgba(39, 42, 49, 0.96), rgba(22, 24, 29, 0.98));
  border-bottom: 1px solid var(--line-faint);
}

.ocr-footer {
  justify-content: flex-end;
  border-top: 1px solid var(--line-faint);
  border-bottom: 0;
}

.ocr-kicker {
  display: block;
  color: var(--accent-strong);
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.08em;
}

.ocr-header h2 {
  margin: 2px 0 0;
  font-size: 18px;
  line-height: 1.2;
}

.icon-btn,
.ghost-btn,
.primary-btn,
.upload-btn {
  min-width: 0;
  white-space: nowrap;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
  transition: color 0.16s, background 0.16s, border-color 0.16s, transform 0.16s;
}

.icon-btn {
  width: 34px;
  height: 34px;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.065);
  font-size: 22px;
  line-height: 1;
}

.ocr-body {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 42%) minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
  overflow: hidden;
}

.ocr-left,
.ocr-right {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upload-panel,
.settings-grid,
.run-row,
.field-table,
.line-table,
.ocr-warnings,
.ocr-error {
  background: rgba(7, 8, 10, 0.34);
  border: 1px solid var(--line-faint);
  border-radius: 12px;
}

.upload-panel {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
  padding: 10px;
}

.upload-btn,
.primary-btn {
  padding: 9px 13px;
  color: var(--accent-ink);
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
  border-color: rgba(241, 217, 137, 0.74);
  box-shadow: var(--shadow-accent);
}

.ghost-btn {
  padding: 9px 13px;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.065);
}

.icon-btn:hover,
.ghost-btn:hover,
.primary-btn:hover,
.upload-btn:hover {
  border-color: var(--accent-line);
  transform: translateY(-1px);
}

.primary-btn:disabled {
  opacity: 0.46;
  cursor: not-allowed;
}

.file-name {
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-frame {
  position: relative;
  min-height: 360px;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(7, 8, 10, 0.62);
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  overflow: hidden;
}

.preview-raster {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  display: inline-flex;
}

.preview-raster img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.ocr-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ocr-box {
  position: absolute;
  border: 2px solid rgba(216, 183, 96, 0.92);
  background: rgba(216, 183, 96, 0.08);
  pointer-events: auto;
  cursor: pointer;
}

.ocr-box.active {
  border-color: #ffffff;
  background: rgba(216, 183, 96, 0.22);
  box-shadow: 0 0 0 2px rgba(216, 183, 96, 0.42);
}

.ocr-box.muted {
  border-style: dashed;
  opacity: 0.45;
}

.preview-empty {
  color: var(--text-faint);
  font-size: 13px;
  font-weight: 800;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

.setting-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.setting-field span,
.field-row > span {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 850;
}

.setting-field select,
.setting-field input,
.field-row input,
.line-row input[type='text'],
.line-row select {
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 9px;
  color: var(--text-strong);
  background: rgba(7, 8, 10, 0.46);
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  font: inherit;
  font-size: 12px;
}

.setting-field select:focus,
.setting-field input:focus,
.field-row input:focus,
.line-row input[type='text']:focus,
.line-row select:focus {
  outline: none;
  border-color: var(--accent-line);
  box-shadow: var(--focus-ring);
}

.setting-field:first-child {
  grid-column: 1 / -1;
}

.run-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px;
}

.recognition-summary {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 750;
}

.ocr-error,
.ocr-warnings {
  padding: 9px 11px;
  font-size: 12px;
  line-height: 1.45;
}

.ocr-error {
  color: #ffd2ca;
  border-color: rgba(255, 134, 111, 0.38);
  background: rgba(255, 134, 111, 0.1);
}

.ocr-warnings {
  color: #ffe8b4;
  border-color: rgba(216, 183, 96, 0.34);
  background: rgba(216, 183, 96, 0.1);
}

.field-table {
  min-height: 0;
  overflow-y: auto;
}

.field-row {
  display: grid;
  grid-template-columns: minmax(92px, 34%) minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line-faint);
}

.field-row:last-child {
  border-bottom: 0;
}

.field-head {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgba(27, 30, 36, 0.98);
}

.line-table {
  min-height: 150px;
  overflow-y: auto;
}

.line-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 850;
  border-bottom: 1px solid var(--line-faint);
}

.line-head span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.line-head span:first-child {
  color: var(--text-main);
}

.line-grid {
  display: grid;
  grid-template-columns: 42px 42px minmax(78px, 94px) minmax(0, 1fr) 54px;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--line-faint);
}

.line-grid:last-child {
  border-bottom: 0;
}

.line-grid-head {
  position: sticky;
  top: 0;
  z-index: 2;
  color: var(--text-muted);
  background: rgba(27, 30, 36, 0.98);
  font-size: 11px;
  font-weight: 850;
}

.line-grid-head span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.line-row {
  transition: background 0.14s, opacity 0.14s;
}

.line-row.active {
  background: rgba(216, 183, 96, 0.12);
}

.line-row.muted {
  opacity: 0.58;
}

.line-row input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--accent-strong);
}

.line-index {
  height: 28px;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.065);
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 850;
}

.line-score {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 850;
  text-align: right;
}

@media (max-width: 860px) {
  .ocr-dialog {
    max-height: 96vh;
  }

  .ocr-body {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .preview-frame {
    min-height: 260px;
  }

  .line-grid {
    grid-template-columns: 38px 38px 78px minmax(120px, 1fr) 46px;
  }
}
</style>
