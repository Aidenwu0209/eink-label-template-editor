<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { BootConfig } from '@/boot/types';
import { recognizePriceTag } from '@/ocr/providers';
import type { OcrProviderMode, RecognizedPriceTag } from '@/ocr/types';
import type { SmartTemplateKind } from '@/ocr/templatePlanner';

const OCR_API_STORAGE_KEY = 'eink-label-template-editor.ocrApi.v1';

const FIELD_DEFS = [
  { key: 'productName', label: '商品名称', type: 'text' },
  { key: 'brand', label: '品牌', type: 'text' },
  { key: 'price', label: '主价格', type: 'number' },
  { key: 'memberPrice', label: '会员价', type: 'number' },
  { key: 'originalPrice', label: '原价', type: 'number' },
  { key: 'discount', label: '折扣', type: 'text' },
  { key: 'spec', label: '规格', type: 'text' },
  { key: 'description', label: '描述', type: 'text' },
  { key: 'origin', label: '产地', type: 'text' },
  { key: 'promoText', label: '促销文案', type: 'text' },
  { key: 'barcodeContent', label: '条码内容', type: 'text' },
  { key: 'qrContent', label: '二维码内容', type: 'text' },
] as const;

const props = defineProps<{
  open: boolean;
  config: BootConfig;
  hasExistingObjects: boolean;
}>();

const emit = defineEmits<{
  close: [];
  apply: [payload: { recognized: RecognizedPriceTag; templateKind: SmartTemplateKind }];
}>();

const fileInputRef = ref<HTMLInputElement>();
const selectedFile = ref<File | null>(null);
const previewUrl = ref('');
const providerMode = ref<OcrProviderMode>('auto');
const templateKind = ref<SmartTemplateKind>('auto');
const apiEndpoint = ref('');
const isRecognizing = ref(false);
const errorMessage = ref('');
const recognized = ref<RecognizedPriceTag | null>(null);
const editableValues = ref<Record<string, string>>({});

const fieldRows = computed(() => {
  const known = FIELD_DEFS.map((field) => ({
    ...field,
    value: editableValues.value[field.key] ?? '',
  }));
  const knownKeys = new Set(FIELD_DEFS.map((field) => field.key));
  const custom = Object.entries(editableValues.value)
    .filter(([key, value]) => !knownKeys.has(key as any) && value)
    .map(([key, value]) => ({ key, label: `自定义字段 ${key}`, type: 'text' as const, value }));
  return [...known, ...custom];
});

const recognitionSummary = computed(() => {
  if (!recognized.value) return '等待识别';
  const percent = Math.round(recognized.value.confidence * 100);
  return `${recognized.value.provider} · ${recognized.value.rawItems.length} 行 · ${percent}%`;
});

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

  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  selectedFile.value = null;

  if (!file) return;
  if (!file.type.startsWith('image/')) {
    errorMessage.value = '请选择价签图片文件。';
    input.value = '';
    return;
  }

  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
}

async function runRecognition(): Promise<void> {
  const file = selectedFile.value;
  if (!file) {
    errorMessage.value = '请先上传价签图片。';
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

function applyTemplate(): void {
  const base = recognized.value;
  if (!base) return;
  if (props.hasExistingObjects && !window.confirm('生成智能模板会替换当前画布内容，是否继续？')) {
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

  return {
    ...base,
    fields: nextFields,
    codes: nextCodes,
    customFields: nextCustom,
  };
}

function overlayBoxStyle(item: RecognizedPriceTag['rawItems'][number]) {
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
    <div v-if="open" class="ocr-backdrop" role="dialog" aria-modal="true" aria-label="智能导入价签">
      <section class="ocr-dialog">
        <header class="ocr-header">
          <div>
            <span class="ocr-kicker">PaddleOCR</span>
            <h2>智能导入价签</h2>
          </div>
          <button class="icon-btn" type="button" title="关闭" @click="closeDialog">×</button>
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
                {{ selectedFile ? '更换价签图片' : '上传价签图片' }}
              </button>
              <span v-if="selectedFile" class="file-name">{{ selectedFile.name }}</span>
            </div>

            <div class="preview-frame">
              <div v-if="previewUrl" class="preview-raster">
                <img :src="previewUrl" alt="价签图片预览" />
                <div v-if="recognized?.rawItems.length" class="ocr-overlay">
                  <span
                    v-for="item in recognized.rawItems"
                    :key="item.id"
                    class="ocr-box"
                    :style="overlayBoxStyle(item)"
                    :title="`${item.text} · ${Math.round(item.score * 100)}%`"
                  ></span>
                </div>
              </div>
              <div v-if="!previewUrl" class="preview-empty">未选择图片</div>
            </div>
          </aside>

          <section class="ocr-right">
            <div class="settings-grid">
              <label class="setting-field">
                <span>识别方式</span>
                <select v-model="providerMode">
                  <option value="auto">自动：本地优先，必要时 API 兜底</option>
                  <option value="browser-local">本地 PaddleOCR.js</option>
                  <option value="paddle-api">PaddleOCR API</option>
                </select>
              </label>

              <label class="setting-field">
                <span>API 地址</span>
                <input
                  v-model="apiEndpoint"
                  type="text"
                  placeholder="/ocr/price-tag"
                  :disabled="providerMode === 'browser-local'"
                />
              </label>

              <label class="setting-field">
                <span>生成模板</span>
                <select v-model="templateKind">
                  <option value="auto">自动选择</option>
                  <option value="standard">普通价签</option>
                  <option value="promotion">促销价签</option>
                  <option value="member">会员价签</option>
                  <option value="barcode">带条码</option>
                  <option value="qr">带二维码</option>
                </select>
              </label>
            </div>

            <div class="run-row">
              <button class="primary-btn" type="button" :disabled="isRecognizing || !selectedFile" @click="runRecognition">
                {{ isRecognizing ? '识别中...' : '开始识别' }}
              </button>
              <span class="recognition-summary">{{ recognitionSummary }}</span>
            </div>

            <div v-if="errorMessage" class="ocr-error">{{ errorMessage }}</div>
            <div v-if="recognized?.warnings.length" class="ocr-warnings">
              <div v-for="warning in recognized.warnings" :key="warning">{{ warning }}</div>
            </div>

            <div class="field-table">
              <div class="field-row field-head">
                <span>字段</span>
                <span>识别值</span>
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
          </section>
        </div>

        <footer class="ocr-footer">
          <button class="ghost-btn" type="button" @click="closeDialog">取消</button>
          <button class="primary-btn" type="button" :disabled="!recognized" @click="applyTemplate">生成可编辑模板</button>
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
.ocr-warnings,
.ocr-error {
  background: rgba(7, 8, 10, 0.34);
  border: 1px solid var(--line-faint);
  border-radius: 12px;
}

.upload-panel {
  display: flex;
  align-items: center;
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
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 850;
}

.setting-field select,
.setting-field input,
.field-row input {
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
.field-row input:focus {
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
  gap: 10px;
  padding: 10px;
}

.recognition-summary {
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
  grid-template-columns: 112px minmax(0, 1fr);
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
}
</style>
