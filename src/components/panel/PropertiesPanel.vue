<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type * as fabric from 'fabric';
import PaletteColorPicker from '@/components/common/PaletteColorPicker.vue';
import { filterValidCustomFieldIds, PRICE_BINDABLE_FIELDS, TEXT_BINDABLE_FIELDS, type PriceBindableField } from '@/fields';
import { TEXT_OVERFLOW_MODES, IMAGE_FIT_MODES, QRCODE_ERROR_CORRECTIONS } from '@/stores/editorStore';
import type { TextExtension, TextOverflowMode, ImageExtension, ImageFitMode, PriceExtension, DiscountExtension, QrcodeExtension, QrcodeErrorCorrection, BarcodeExtension } from '@/stores/editorStore';
import type { ColorEntry } from '@/screen/types';
import type { PreviewData } from '@/boot/types';
import type { MarketProfile } from '@/i18n';
import {
  DEFAULT_EDITOR_FONT_FAMILY,
  FONT_FAMILY_OPTIONS,
  fontWeightFromSelect,
  fontWeightSelectValue,
  resolveEditorFontFamily,
  resolveEditorFontWeight,
} from '@/fonts';

const props = defineProps<{
  selectedObject: fabric.Object | null;
  selectionVersion?: number;
  palette: ColorEntry[];
  customFields?: string[];
  previewData?: PreviewData;
  marketProfile: MarketProfile;
}>();

const emit = defineEmits<{
  'update-prop': [key: string, value: unknown];
  'update-props-batch': [patches: Array<{ key: string; value: unknown }>];
  'update-preview-field': [field: string, value: unknown];
}>();

const selectedObject = computed(() => {
  void props.selectionVersion;
  return props.selectedObject;
});

const { t } = useI18n();

function overflowModeLabel(mode: TextOverflowMode): string {
  return t(`properties.overflow${mode[0].toUpperCase()}${mode.slice(1)}`);
}

function imageFitModeLabel(mode: ImageFitMode): string {
  return t(`properties.imageFit${mode[0].toUpperCase()}${mode.slice(1)}`);
}

function qrcodeErrorCorrectionLabel(level: QrcodeErrorCorrection): string {
  return t(`properties.qrError${level}`);
}

const CURRENCY_PRESETS = computed(() => {
  const market = props.marketProfile.price;
  return [
    {
      value: 'market-default',
      label: `${market.currencyCode} ${market.currencySymbol}12${market.decimalSeparator}90`,
      patch: { ...market },
    },
    { value: 'cny-symbol', label: '¥12.90', patch: { currencySymbol: '¥', currencyCode: 'CNY', showCurrency: true, decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.' } },
    { value: 'cny-yuan', label: '12.90元', patch: { currencySymbol: '元', currencyCode: 'CNY', showCurrency: true, decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.' } },
    { value: 'cny-code', label: 'CNY 12.90', patch: { currencySymbol: 'CNY ', currencyCode: 'CNY', showCurrency: true, decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.' } },
    { value: 'usd', label: '$12.90', patch: { currencySymbol: '$', currencyCode: 'USD', showCurrency: true, decimalPlaces: 2, thousandSeparator: ',', decimalSeparator: '.' } },
    { value: 'eur', label: '€12,90', patch: { currencySymbol: '€', currencyCode: 'EUR', showCurrency: true, decimalPlaces: 2, thousandSeparator: '.', decimalSeparator: ',' } },
    { value: 'none', label: t('common.none'), patch: { currencySymbol: '', currencyCode: '', showCurrency: false, decimalPlaces: 2, thousandSeparator: market.thousandSeparator, decimalSeparator: market.decimalSeparator } },
    { value: 'integer', label: t('properties.noDecimals'), patch: { ...market, decimalPlaces: 0 } },
  ];
});

function fieldLabel(field: string): string {
  const key = `fields.${field}`;
  const label = t(key);
  return label === key ? field : label;
}

function fieldOptionLabel(field: string): string {
  const label = fieldLabel(field);
  return label ? `${label} (${field})` : field;
}

const objectType = computed(() => {
  if (!selectedObject.value) return null;
  const ext = (selectedObject.value as any).extensionType;
  if (ext === 'TEXT') return 'TEXT';
  if (ext === 'PRICE') return 'PRICE';
  if (ext === 'DISCOUNT') return 'DISCOUNT';
  if (ext === 'IMAGE') return 'IMAGE';
  if (ext === 'QRCODE') return 'QRCODE';
  if (ext === 'BARCODE') return 'BARCODE';
  if (selectedObject.value.type === 'rect') return 'RECT';
  if (selectedObject.value.type === 'line') return 'LINE';
  return null;
});

const isRect = computed(() => objectType.value === 'RECT');
const isLine = computed(() => objectType.value === 'LINE');
const isText = computed(() => objectType.value === 'TEXT');
const isPrice = computed(() => objectType.value === 'PRICE');
const isDiscount = computed(() => objectType.value === 'DISCOUNT');
const isImage = computed(() => objectType.value === 'IMAGE');
const isQrcode = computed(() => objectType.value === 'QRCODE');
const isBarcode = computed(() => objectType.value === 'BARCODE');
const hasSupportedSelection = computed(() => {
  return Boolean(
    selectedObject.value
    && (isRect.value || isLine.value || isText.value || isPrice.value || isDiscount.value || isImage.value || isQrcode.value || isBarcode.value)
  );
});
const objectTypeLabel = computed(() => {
  if (!objectType.value) return '';
  return t(`objects.${objectType.value}`);
});
const panelTitle = computed(() => hasSupportedSelection.value ? `${objectTypeLabel.value} ${t('editor.properties')}` : t('editor.properties'));

// RECT properties
const rectX = computed(() => selectedObject.value?.left ?? 0);
const rectY = computed(() => selectedObject.value?.top ?? 0);
const rectWidth = computed(() => (selectedObject.value as fabric.Rect)?.width ?? 0);
const rectHeight = computed(() => (selectedObject.value as fabric.Rect)?.height ?? 0);
const rectFill = computed(() => (selectedObject.value?.fill as string) ?? '#000000');
const rectStroke = computed(() => (selectedObject.value?.stroke as string) ?? '');
const rectStrokeWidth = computed(() => selectedObject.value?.strokeWidth ?? 0);

// LINE properties
const lineObj = computed(() => selectedObject.value as fabric.Line | null);
const lineX1 = computed(() => lineObj.value ? (lineObj.value as any).x1 ?? 0 : 0);
const lineY1 = computed(() => lineObj.value ? (lineObj.value as any).y1 ?? 0 : 0);
const lineX2 = computed(() => lineObj.value ? (lineObj.value as any).x2 ?? 0 : 0);
const lineY2 = computed(() => lineObj.value ? (lineObj.value as any).y2 ?? 0 : 0);
const lineStroke = computed(() => (selectedObject.value?.stroke as string) ?? '#000000');
const lineStrokeWidth = computed(() => selectedObject.value?.strokeWidth ?? 1);

// TEXT properties
const textObj = computed(() => selectedObject.value as fabric.Textbox | null);
const textContent = computed(() => textObj.value?.text ?? '');
const textFontSize = computed(() => textObj.value?.fontSize ?? 16);
const textFontWeight = computed(() => fontWeightSelectValue(textObj.value?.fontWeight));
const textFill = computed(() => (textObj.value?.fill as string) ?? '#000000');
const textAlign = computed(() => textObj.value?.textAlign ?? 'left');

const textExt = computed<TextExtension | null>(() => {
  if (!isText.value || !selectedObject.value) return null;
  return (selectedObject.value as any).extension as TextExtension;
});

const textOverflow = computed<TextOverflowMode>(() => textExt.value?.overflow ?? 'ellipsis');
const textLineClamp = computed(() => textExt.value?.lineClamp ?? 0);
const textVerticalAlign = computed(() => textExt.value?.verticalAlign ?? 'top');
const textFieldBinding = computed(() => textExt.value?.fieldBinding ?? '');
const textPreviewValue = computed(() => {
  const field = textFieldBinding.value;
  if (!field) return '';
  return props.previewData?.[field] == null ? '' : String(props.previewData[field]);
});

const bindableFields = computed(() => {
  const custom = filterValidCustomFieldIds(props.customFields ?? []);
  return [...TEXT_BINDABLE_FIELDS, ...custom];
});

// IMAGE properties
const imageExt = computed<ImageExtension | null>(() => {
  if (!isImage.value || !selectedObject.value) return null;
  return (selectedObject.value as any).extension as ImageExtension;
});

const imageSource = computed(() => imageExt.value?.source ?? 'static');
const imageSrc = computed(() => imageExt.value?.src ?? '');
const imageFitMode = computed<ImageFitMode>(() => imageExt.value?.fitMode ?? 'contain');
const imageBgColor = computed(() => imageExt.value?.backgroundColor ?? '#FFFFFF');
const imageWidth = computed(() => (selectedObject.value as fabric.Rect)?.width ?? 0);
const imageHeight = computed(() => (selectedObject.value as fabric.Rect)?.height ?? 0);
const imagePreviewValue = computed(() => props.previewData?.imageUrl == null ? '' : String(props.previewData.imageUrl));
const imageUploadError = ref('');
const imageLoadError = computed(() => {
  if (imageExt.value?.loadStatus !== 'error') return '';
  return imageExt.value.loadError || t('errors.imageLoadShort');
});

// PRICE properties
const priceExt = computed<PriceExtension | null>(() => {
  if (!isPrice.value || !selectedObject.value) return null;
  return (selectedObject.value as any).extension as PriceExtension;
});

const priceCurrencySymbol = computed(() => priceExt.value?.currencySymbol ?? props.marketProfile.price.currencySymbol);
const priceFontFamily = computed(() => resolveEditorFontFamily(priceExt.value?.fontFamily));
const priceShowCurrency = computed(() => priceExt.value?.showCurrency ?? props.marketProfile.price.showCurrency);
const priceDecimalPlaces = computed(() => priceExt.value?.decimalPlaces ?? props.marketProfile.price.decimalPlaces);
const priceThousandSep = computed(() => priceExt.value?.thousandSeparator ?? props.marketProfile.price.thousandSeparator);
const priceDecimalSep = computed(() => priceExt.value?.decimalSeparator ?? props.marketProfile.price.decimalSeparator);
const priceWidth = computed(() => (selectedObject.value as fabric.Rect)?.width ?? 0);
const priceHeight = computed(() => (selectedObject.value as fabric.Rect)?.height ?? 0);
const priceFieldBinding = computed<PriceBindableField>(() => priceExt.value?.fieldBinding ?? 'price');
const pricePreviewValue = computed(() => {
  const field = priceFieldBinding.value;
  return props.previewData?.[field] == null ? '' : String(props.previewData[field]);
});
const priceFitWarnings = computed(() => priceExt.value?.renderMeta?.fitWarnings ?? []);

// DISCOUNT properties
const discountExt = computed<DiscountExtension | null>(() => {
  if (!isDiscount.value || !selectedObject.value) return null;
  return (selectedObject.value as any).extension as DiscountExtension;
});

const discountFormatTemplate = computed(() => discountExt.value?.formatTemplate ?? props.marketProfile.discountFormatTemplate);
const discountBgColor = computed(() => discountExt.value?.backgroundColor ?? '#FFFFFF');
const discountShowBackground = computed(() => {
  const ext = discountExt.value;
  if (!ext) return false;
  return ext.showBackground ?? !['transparent', '#FFFFFF', '#ffffff'].includes(ext.backgroundColor);
});
const discountTextColor = computed(() => discountExt.value?.textColor ?? '#000000');
const discountFontFamily = computed(() => resolveEditorFontFamily(discountExt.value?.fontFamily));
const discountFontSize = computed(() => discountExt.value?.fontSize ?? 20);
const discountFontWeight = computed(() => fontWeightSelectValue(discountExt.value?.fontWeight));
const discountTextAlign = computed(() => discountExt.value?.textAlign ?? 'center');
const discountVerticalAlign = computed(() => discountExt.value?.verticalAlign ?? 'middle');
const discountWidth = computed(() => (selectedObject.value as fabric.Rect)?.width ?? 0);
const discountHeight = computed(() => (selectedObject.value as fabric.Rect)?.height ?? 0);
const discountPreviewValue = computed(() => props.previewData?.discount == null ? '' : String(props.previewData.discount));
const discountFitWarnings = computed(() => discountExt.value?.renderMeta?.fitWarnings ?? []);

// QRCODE properties
const qrcodeExt = computed<QrcodeExtension | null>(() => {
  if (!isQrcode.value || !selectedObject.value) return null;
  return (selectedObject.value as any).extension as QrcodeExtension;
});

const qrcodeErrorCorrection = computed<QrcodeErrorCorrection>(() => qrcodeExt.value?.errorCorrection ?? 'M');
const qrcodeSource = computed(() => qrcodeExt.value?.source ?? 'dynamic');
const qrcodeStaticContent = computed(() => qrcodeExt.value?.content ?? '');
const qrcodeMargin = computed(() => qrcodeExt.value?.margin ?? 1);
const qrcodeFgColor = computed(() => qrcodeExt.value?.foregroundColor ?? '#000000');
const qrcodeBgColor = computed(() => qrcodeExt.value?.backgroundColor ?? '#FFFFFF');
const qrcodeWidth = computed(() => (selectedObject.value as fabric.Rect)?.width ?? 0);
const qrcodeHeight = computed(() => (selectedObject.value as fabric.Rect)?.height ?? 0);
const qrcodeWarnings = computed(() => qrcodeExt.value?.readabilityWarnings ?? []);
const qrcodePreviewValue = computed(() => props.previewData?.qrContent == null ? '' : String(props.previewData.qrContent));
const qrcodeContentValue = computed(() => qrcodeSource.value === 'static' ? qrcodeStaticContent.value : qrcodePreviewValue.value);
const qrcodeUploadError = ref('');

// BARCODE properties
const barcodeExt = computed<BarcodeExtension | null>(() => {
  if (!isBarcode.value || !selectedObject.value) return null;
  return (selectedObject.value as any).extension as BarcodeExtension;
});

const barcodeShowText = computed(() => barcodeExt.value?.showText ?? true);
const barcodeSource = computed(() => barcodeExt.value?.source ?? 'dynamic');
const barcodeStaticContent = computed(() => barcodeExt.value?.content ?? '');
const barcodeFgColor = computed(() => barcodeExt.value?.foregroundColor ?? '#000000');
const barcodeBgColor = computed(() => barcodeExt.value?.backgroundColor ?? '#FFFFFF');
const barcodeWidth = computed(() => (selectedObject.value as fabric.Rect)?.width ?? 0);
const barcodeHeight = computed(() => (selectedObject.value as fabric.Rect)?.height ?? 0);
const barcodeWarnings = computed(() => barcodeExt.value?.readabilityWarnings ?? []);
const barcodeUploadError = ref('');

function updateProp(key: string, value: unknown) {
  emit('update-prop', key, value);
}

const barcodePreviewValue = computed(() => props.previewData?.barcodeContent == null ? '' : String(props.previewData.barcodeContent));
const barcodeContentValue = computed(() => barcodeSource.value === 'static' ? barcodeStaticContent.value : barcodePreviewValue.value);
const barcodeInvalidContent = computed(() => /[^\x20-\x7f]/.test(barcodeContentValue.value));

function updatePropsBatch(patches: Array<{ key: string; value: unknown }>) {
  emit('update-props-batch', patches);
}

function updatePreviewField(field: string, value: unknown) {
  emit('update-preview-field', field, value);
}

function paletteHex(name: string, fallback: string): string {
  return props.palette.find((color) => color.name.toLowerCase() === name.toLowerCase())?.hex ?? fallback;
}

function applyPricePreset(kind: 'sale' | 'plain') {
  const ext = priceExt.value;
  if (!ext) return;

  const fontFamily = resolveEditorFontFamily(ext.fontFamily);
  const black = paletteHex('black', '#000000');
  const currencyStyle = ext.currencyStyle ?? { fontSize: 14, fontWeight: 400, color: black };
  const integerStyle = ext.integerStyle ?? { fontSize: 28, fontWeight: 800, color: black };
  const decimalStyle = ext.decimalStyle ?? { fontSize: 16, fontWeight: 400, color: black, offsetY: -10 };

  if (kind === 'sale') {
    const accent = paletteHex('red', black);
    updatePropsBatch([
      { key: 'ext.fontFamily', value: fontFamily },
      { key: 'ext.currencyStyle', value: { ...currencyStyle, fontWeight: resolveEditorFontWeight('bold'), color: black } },
      { key: 'ext.integerStyle', value: { ...integerStyle, fontWeight: resolveEditorFontWeight('bold'), color: accent } },
      { key: 'ext.decimalStyle', value: { ...decimalStyle, fontWeight: resolveEditorFontWeight('bold'), color: accent } },
    ]);
    return;
  }

  updatePropsBatch([
    { key: 'ext.fontFamily', value: fontFamily },
    { key: 'ext.currencyStyle', value: { ...currencyStyle, fontWeight: resolveEditorFontWeight('normal'), color: black } },
    { key: 'ext.integerStyle', value: { ...integerStyle, fontWeight: resolveEditorFontWeight('normal'), color: black } },
    { key: 'ext.decimalStyle', value: { ...decimalStyle, fontWeight: resolveEditorFontWeight('normal'), color: black } },
  ]);
}

function updateDiscountBackgroundMode(value: string) {
  const enabled = value === 'true';
  if (!enabled) {
    updatePropsBatch([
      { key: 'ext.showBackground', value: false },
      { key: 'ext.borderWidth', value: 0 },
    ]);
    return;
  }

  const accent = paletteHex('red', paletteHex('yellow', paletteHex('black', '#000000')));
  const nextBackground = ['transparent', '#FFFFFF', '#ffffff'].includes(discountBgColor.value)
    ? accent
    : discountBgColor.value;
  const nextTextColor = nextBackground.toLowerCase() === paletteHex('yellow', '').toLowerCase()
    ? '#000000'
    : discountTextColor.value === '#000000'
      ? '#FFFFFF'
      : discountTextColor.value;

  updatePropsBatch([
    { key: 'ext.showBackground', value: true },
    { key: 'ext.backgroundColor', value: nextBackground },
    { key: 'ext.textColor', value: nextTextColor },
  ]);
}

function applyCurrencyPreset(value: string) {
  const preset = CURRENCY_PRESETS.value.find((item) => item.value === value);
  if (!preset) return;
  updatePropsBatch([
    { key: 'ext.currencySymbol', value: preset.patch.currencySymbol },
    { key: 'ext.showCurrency', value: preset.patch.showCurrency },
    { key: 'ext.decimalPlaces', value: preset.patch.decimalPlaces },
    { key: 'ext.thousandSeparator', value: preset.patch.thousandSeparator },
    { key: 'ext.decimalSeparator', value: preset.patch.decimalSeparator },
  ]);
}

function updateQrcodeContent(value: string) {
  if (qrcodeSource.value === 'static') {
    updateProp('ext.content', value);
  } else {
    updatePreviewField('qrContent', value);
  }
}

function updateBarcodeContent(value: string) {
  if (barcodeSource.value === 'static') {
    updateProp('ext.content', value);
  } else {
    updatePreviewField('barcodeContent', value);
  }
}

function updateQrcodeSource(source: 'dynamic' | 'static') {
  if (source === 'static') {
    updatePropsBatch([
      { key: 'ext.source', value: source },
      { key: 'ext.content', value: qrcodeContentValue.value },
    ]);
    return;
  }
  updateProp('ext.source', source);
}

function updateBarcodeSource(source: 'dynamic' | 'static') {
  if (source === 'static') {
    updatePropsBatch([
      { key: 'ext.source', value: source },
      { key: 'ext.content', value: barcodeContentValue.value },
    ]);
    return;
  }
  updateProp('ext.source', source);
}

function handleTextFileChange(event: Event, updater: (value: string) => void, setError: (message: string) => void) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  setError('');
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.txt') && file.type !== 'text/plain') {
    setError(t('properties.chooseTxt'));
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    updater(String(reader.result ?? ''));
    input.value = '';
  };
  reader.onerror = () => {
    setError(reader.error?.message || t('properties.readTxtFailed'));
    input.value = '';
  };
  reader.readAsText(file);
}

function handleQrcodeTextFileChange(event: Event) {
  handleTextFileChange(event, updateQrcodeContent, (message) => { qrcodeUploadError.value = message; });
}

function handleBarcodeTextFileChange(event: Event) {
  handleTextFileChange(event, updateBarcodeContent, (message) => { barcodeUploadError.value = message; });
}

function handleStaticImageFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  imageUploadError.value = '';

  if (!file) return;
  if (!file.type.startsWith('image/')) {
    imageUploadError.value = t('properties.chooseImage');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    updateProp('ext.src', String(reader.result ?? ''));
    input.value = '';
  };
  reader.onerror = () => {
    imageUploadError.value = reader.error?.message || t('properties.readImageFailed');
    input.value = '';
  };
  reader.readAsDataURL(file);
}
</script>

<template>
  <aside class="properties-panel">
    <div class="panel-title">
      <span>{{ panelTitle }}</span>
      <span v-if="objectType" class="panel-type-badge">{{ objectType }}</span>
    </div>

    <div v-if="!hasSupportedSelection" class="empty-state">
      <div class="empty-state-mark">+</div>
      <div class="empty-state-title">{{ t('properties.emptyTitle') }}</div>
      <p>{{ t('properties.emptyHint') }}</p>
    </div>

    <template v-else>

    <!-- RECT properties -->
    <template v-if="isRect">
      <div class="prop-group">
        <label class="prop-label">X</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(rectX)"
          @change="updateProp('left', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">Y</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(rectY)"
          @change="updateProp('top', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.width') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(rectWidth)"
          @change="updateProp('width', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.height') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(rectHeight)"
          @change="updateProp('height', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <PaletteColorPicker
        :label="t('properties.fillColor')"
        :colors="palette"
        :model-value="rectFill"
        @update:model-value="updateProp('fill', $event)"
      />
      <PaletteColorPicker
        :label="t('properties.strokeColor')"
        :colors="palette"
        :model-value="rectStroke || '#000000'"
        @update:model-value="updateProp('stroke', $event)"
      />
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.strokeWidth') }}</label>
        <input
          type="number"
          class="prop-input"
          min="0"
          :value="rectStrokeWidth"
          @change="updateProp('strokeWidth', +($event.target as HTMLInputElement).value)"
        />
      </div>
    </template>

    <!-- LINE properties -->
    <template v-if="isLine">
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.startX') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(lineX1)"
          @change="updateProp('x1', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.startY') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(lineY1)"
          @change="updateProp('y1', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.endX') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(lineX2)"
          @change="updateProp('x2', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.endY') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(lineY2)"
          @change="updateProp('y2', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <PaletteColorPicker
        :label="t('properties.color')"
        :colors="palette"
        :model-value="lineStroke"
        @update:model-value="updateProp('stroke', $event)"
      />
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.lineWidth') }}</label>
        <input
          type="number"
          class="prop-input"
          min="1"
          :value="lineStrokeWidth"
          @change="updateProp('strokeWidth', +($event.target as HTMLInputElement).value)"
        />
      </div>
    </template>

    <!-- TEXT properties -->
    <template v-if="isText">
      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.textContent') }}</label>
        <input
          type="text"
          class="prop-input"
          :value="textContent"
          @change="updateProp('text', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.dataField') }}</label>
        <select
          class="prop-input"
          :value="textFieldBinding"
          @change="updateProp('ext.fieldBinding', ($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">{{ t('properties.fixedText') }}</option>
          <option v-for="f in bindableFields" :key="f" :value="f">{{ fieldOptionLabel(f) }}</option>
        </select>
        <div class="prop-hint">{{ t('properties.fieldHint') }}</div>
      </div>

      <div v-if="textFieldBinding" class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.previewDataField', { field: fieldOptionLabel(textFieldBinding) }) }}</label>
        <input
          type="text"
          class="prop-input"
          :value="textPreviewValue"
          @change="updatePreviewField(textFieldBinding, ($event.target as HTMLInputElement).value)"
        />
        <div class="prop-hint">{{ t('properties.previewDataHint') }}</div>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.fontSize') }}</label>
        <input
          type="number"
          class="prop-input"
          min="8"
          max="200"
          :value="textFontSize"
          @change="updateProp('fontSize', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.fontWeight') }}</label>
        <select
          class="prop-input"
          :value="textFontWeight"
          @change="updateProp('fontWeight', fontWeightFromSelect(($event.target as HTMLSelectElement).value))"
        >
          <option value="normal">{{ t('properties.normal') }}</option>
          <option value="bold">{{ t('properties.bold') }}</option>
        </select>
      </div>

      <PaletteColorPicker
        :label="t('properties.textColor')"
        :colors="palette"
        :model-value="textFill"
        @update:model-value="updateProp('fill', $event)"
      />

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.font') }}</label>
        <select
          class="prop-input"
          :value="resolveEditorFontFamily(textObj?.fontFamily ?? DEFAULT_EDITOR_FONT_FAMILY)"
          @change="updateProp('fontFamily', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="font in FONT_FAMILY_OPTIONS" :key="font.value" :value="font.value">
            {{ font.label }}
          </option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.horizontalAlign') }}</label>
        <select
          class="prop-input"
          :value="textAlign"
          @change="updateProp('textAlign', ($event.target as HTMLSelectElement).value)"
        >
          <option value="left">{{ t('properties.alignLeft') }}</option>
          <option value="center">{{ t('properties.alignCenter') }}</option>
          <option value="right">{{ t('properties.alignRight') }}</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.verticalAlign') }}</label>
        <select
          class="prop-input"
          :value="textVerticalAlign"
          @change="updateProp('ext.verticalAlign', ($event.target as HTMLSelectElement).value)"
        >
          <option value="top">{{ t('properties.alignTop') }}</option>
          <option value="middle">{{ t('properties.alignMiddle') }}</option>
          <option value="bottom">{{ t('properties.alignBottom') }}</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.overflowMode') }}</label>
        <select
          class="prop-input"
          :value="textOverflow"
          @change="updateProp('ext.overflow', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="m in TEXT_OVERFLOW_MODES" :key="m" :value="m">{{ overflowModeLabel(m) }}</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.lineClamp') }}</label>
        <input
          type="number"
          class="prop-input"
          min="0"
          :value="textLineClamp"
          @change="updateProp('ext.lineClamp', +($event.target as HTMLInputElement).value)"
        />
        <div class="prop-hint">{{ t('properties.lineClampHint') }}</div>
      </div>

      <div class="prop-note">{{ t('properties.fontNote') }}</div>
    </template>

    <!-- PRICE properties -->
    <template v-if="isPrice">
      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.dataField') }}</label>
        <select
          class="prop-input"
          :value="priceFieldBinding"
          @change="updateProp('ext.fieldBinding', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="field in PRICE_BINDABLE_FIELDS" :key="field" :value="field">
            {{ fieldOptionLabel(field) }}
          </option>
        </select>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.previewField', { field: fieldLabel(priceFieldBinding) }) }}</label>
        <input
          type="number"
          step="0.01"
          class="prop-input"
          :value="pricePreviewValue"
          @change="updatePreviewField(priceFieldBinding, ($event.target as HTMLInputElement).value)"
        />
        <div class="prop-hint">{{ t('properties.previewPriceHint') }}</div>
      </div>

      <div class="quick-preset-row">
        <button type="button" @click="applyPricePreset('sale')">{{ paletteHex('red', '') ? t('properties.salePriceRed') : t('properties.salePriceStrong') }}</button>
        <button type="button" @click="applyPricePreset('plain')">{{ t('properties.plainPrice') }}</button>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.font') }}</label>
        <select
          class="prop-input"
          :value="priceFontFamily"
          @change="updateProp('ext.fontFamily', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="font in FONT_FAMILY_OPTIONS" :key="font.value" :value="font.value">
            {{ font.label }}
          </option>
        </select>
      </div>

      <div v-if="priceFitWarnings.length" class="prop-warning">
        <div v-for="warning in priceFitWarnings" :key="warning.code">{{ warning.message }}</div>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.currencyPreset') }}</label>
        <select class="prop-input" value="" @change="applyCurrencyPreset(($event.target as HTMLSelectElement).value)">
          <option value="" disabled>{{ t('properties.selectCurrencyFormat') }}</option>
          <option v-for="preset in CURRENCY_PRESETS" :key="preset.value" :value="preset.value">
            {{ preset.label }}
          </option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.currencySymbol') }}</label>
        <input
          type="text"
          class="prop-input"
          :value="priceCurrencySymbol"
          @change="updateProp('ext.currencySymbol', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.showCurrency') }}</label>
        <select
          class="prop-input"
          :value="priceShowCurrency ? 'true' : 'false'"
          @change="updateProp('ext.showCurrency', ($event.target as HTMLSelectElement).value === 'true')"
        >
          <option value="true">{{ t('properties.yes') }}</option>
          <option value="false">{{ t('properties.no') }}</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.decimalPlaces') }}</label>
        <input
          type="number"
          class="prop-input"
          min="0"
          max="6"
          :value="priceDecimalPlaces"
          @change="updateProp('ext.decimalPlaces', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.thousandSeparator') }}</label>
        <input
          type="text"
          class="prop-input"
          :value="priceThousandSep"
          @change="updateProp('ext.thousandSeparator', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.decimalSeparator') }}</label>
        <input
          type="text"
          class="prop-input"
          :value="priceDecimalSep"
          @change="updateProp('ext.decimalSeparator', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.width') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(priceWidth)"
          @change="updateProp('width', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.height') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(priceHeight)"
          @change="updateProp('height', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="section-label">{{ t('properties.currencyStyle') }}</div>
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.fontSize') }}</label>
        <input
          type="number"
          class="prop-input"
          min="8"
          max="200"
          :value="priceExt?.currencyStyle?.fontSize ?? 14"
          @change="updateProp('ext.currencyStyle', { ...priceExt?.currencyStyle, fontSize: +($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.fontWeight') }}</label>
        <select
          class="prop-input"
          :value="fontWeightSelectValue(priceExt?.currencyStyle?.fontWeight)"
          @change="updateProp('ext.currencyStyle', { ...priceExt?.currencyStyle, fontWeight: fontWeightFromSelect(($event.target as HTMLSelectElement).value) })"
        >
          <option value="normal">{{ t('properties.normal') }}</option>
          <option value="bold">{{ t('properties.bold') }}</option>
        </select>
      </div>
      <PaletteColorPicker
        :label="t('properties.color')"
        :colors="palette"
        :model-value="priceExt?.currencyStyle?.color ?? '#000000'"
        @update:model-value="updateProp('ext.currencyStyle', { ...priceExt?.currencyStyle, color: $event })"
      />

      <div class="section-label">{{ t('properties.integerStyle') }}</div>
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.fontSize') }}</label>
        <input
          type="number"
          class="prop-input"
          min="8"
          max="200"
          :value="priceExt?.integerStyle?.fontSize ?? 28"
          @change="updateProp('ext.integerStyle', { ...priceExt?.integerStyle, fontSize: +($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.fontWeight') }}</label>
        <select
          class="prop-input"
          :value="fontWeightSelectValue(priceExt?.integerStyle?.fontWeight)"
          @change="updateProp('ext.integerStyle', { ...priceExt?.integerStyle, fontWeight: fontWeightFromSelect(($event.target as HTMLSelectElement).value) })"
        >
          <option value="normal">{{ t('properties.normal') }}</option>
          <option value="bold">{{ t('properties.bold') }}</option>
        </select>
      </div>
      <PaletteColorPicker
        :label="t('properties.color')"
        :colors="palette"
        :model-value="priceExt?.integerStyle?.color ?? '#000000'"
        @update:model-value="updateProp('ext.integerStyle', { ...priceExt?.integerStyle, color: $event })"
      />

      <div class="section-label">{{ t('properties.decimalStyle') }}</div>
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.fontSize') }}</label>
        <input
          type="number"
          class="prop-input"
          min="8"
          max="200"
          :value="priceExt?.decimalStyle?.fontSize ?? 16"
          @change="updateProp('ext.decimalStyle', { ...priceExt?.decimalStyle, fontSize: +($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.fontWeight') }}</label>
        <select
          class="prop-input"
          :value="fontWeightSelectValue(priceExt?.decimalStyle?.fontWeight)"
          @change="updateProp('ext.decimalStyle', { ...priceExt?.decimalStyle, fontWeight: fontWeightFromSelect(($event.target as HTMLSelectElement).value) })"
        >
          <option value="normal">{{ t('properties.normal') }}</option>
          <option value="bold">{{ t('properties.bold') }}</option>
        </select>
      </div>
      <PaletteColorPicker
        :label="t('properties.color')"
        :colors="palette"
        :model-value="priceExt?.decimalStyle?.color ?? '#000000'"
        @update:model-value="updateProp('ext.decimalStyle', { ...priceExt?.decimalStyle, color: $event })"
      />
      <div class="prop-group">
        <label class="prop-label">{{ t('properties.decimalOffset') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="priceExt?.decimalStyle?.offsetY ?? -12"
          @change="updateProp('ext.decimalStyle', { ...priceExt?.decimalStyle, offsetY: +($event.target as HTMLInputElement).value })"
        />
        <div class="prop-hint">{{ t('properties.decimalOffsetHint') }}</div>
      </div>
    </template>

    <!-- DISCOUNT properties -->
    <template v-if="isDiscount">
      <div class="info-row">
        <span>{{ t('properties.dataField') }}</span>
        <b>{{ fieldOptionLabel('discount') }}</b>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.previewDiscount') }}</label>
        <input
          type="number"
          step="0.1"
          class="prop-input"
          :value="discountPreviewValue"
          @change="updatePreviewField('discount', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.discountFormat') }}</label>
        <input
          type="text"
          class="prop-input"
          :value="discountFormatTemplate"
          @change="updateProp('ext.formatTemplate', ($event.target as HTMLInputElement).value)"
        />
        <div class="prop-hint">{{ t('properties.discountFormatHint', { value: '{value}', example: props.marketProfile.discountFormatTemplate }) }}</div>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.width') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(discountWidth)"
          @change="updateProp('width', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.height') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(discountHeight)"
          @change="updateProp('height', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <PaletteColorPicker
        :label="t('properties.backgroundColor')"
        :colors="palette"
        :model-value="discountBgColor"
        @update:model-value="updateProp('ext.backgroundColor', $event)"
      />

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.backgroundBox') }}</label>
        <select
          class="prop-input"
          :value="discountShowBackground ? 'true' : 'false'"
          @change="updateDiscountBackgroundMode(($event.target as HTMLSelectElement).value)"
        >
          <option value="false">{{ t('properties.hide') }}</option>
          <option value="true">{{ t('properties.show') }}</option>
        </select>
        <div class="prop-hint">{{ t('properties.discountBgHint') }}</div>
      </div>

      <PaletteColorPicker
        :label="t('properties.textColor')"
        :colors="palette"
        :model-value="discountTextColor"
        @update:model-value="updateProp('ext.textColor', $event)"
      />

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.font') }}</label>
        <select
          class="prop-input"
          :value="discountFontFamily"
          @change="updateProp('ext.fontFamily', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="font in FONT_FAMILY_OPTIONS" :key="font.value" :value="font.value">
            {{ font.label }}
          </option>
        </select>
      </div>

      <div v-if="discountFitWarnings.length" class="prop-warning">
        <div v-for="warning in discountFitWarnings" :key="warning.code">{{ warning.message }}</div>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.fontSize') }}</label>
        <input
          type="number"
          class="prop-input"
          min="8"
          max="200"
          :value="discountFontSize"
          @change="updateProp('ext.fontSize', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.fontWeight') }}</label>
        <select
          class="prop-input"
          :value="discountFontWeight"
          @change="updateProp('ext.fontWeight', fontWeightFromSelect(($event.target as HTMLSelectElement).value))"
        >
          <option value="normal">{{ t('properties.normal') }}</option>
          <option value="bold">{{ t('properties.bold') }}</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.horizontalAlign') }}</label>
        <select
          class="prop-input"
          :value="discountTextAlign"
          @change="updateProp('ext.textAlign', ($event.target as HTMLSelectElement).value)"
        >
          <option value="left">{{ t('properties.alignLeft') }}</option>
          <option value="center">{{ t('properties.alignCenter') }}</option>
          <option value="right">{{ t('properties.alignRight') }}</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.verticalAlign') }}</label>
        <select
          class="prop-input"
          :value="discountVerticalAlign"
          @change="updateProp('ext.verticalAlign', ($event.target as HTMLSelectElement).value)"
        >
          <option value="top">{{ t('properties.alignTop') }}</option>
          <option value="middle">{{ t('properties.alignMiddle') }}</option>
          <option value="bottom">{{ t('properties.alignBottom') }}</option>
        </select>
      </div>
    </template>

    <!-- IMAGE properties -->
    <template v-if="isImage">
      <div class="info-row">
        <span>{{ t('properties.imageSource') }}</span>
        <b>{{ imageSource === 'dynamic' ? t('properties.imageDynamicSource') : t('properties.imageStaticSource') }}</b>
      </div>

      <div class="prop-group prop-wide" v-if="imageSource === 'dynamic'">
        <label class="prop-label">{{ t('properties.previewImageUrl') }}</label>
        <input
          type="text"
          class="prop-input"
          :value="imagePreviewValue"
          placeholder="https://..."
          @change="updatePreviewField('imageUrl', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group prop-wide" v-if="imageSource === 'static'">
        <label class="prop-label">{{ t('properties.imageUrlBase64') }}</label>
        <input
          type="text"
          class="prop-input"
          :value="imageSrc"
          :placeholder="t('properties.imageUrlPlaceholder')"
          @change="updateProp('ext.src', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group prop-wide" v-if="imageSource === 'static'">
        <label class="prop-label">{{ t('properties.uploadImage') }}</label>
        <input
          type="file"
          class="prop-input"
          accept="image/*"
          @change="handleStaticImageFileChange"
        />
        <div class="prop-hint">{{ t('properties.uploadImageHint') }}</div>
        <div v-if="imageUploadError" class="prop-error">{{ imageUploadError }}</div>
      </div>

      <div v-if="imageLoadError" class="prop-error">{{ imageLoadError }}</div>

      <div class="info-row" v-if="imageSource === 'dynamic'">
        <span>{{ t('properties.dataField') }}</span>
        <b>{{ fieldOptionLabel('imageUrl') }}</b>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.width') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(imageWidth)"
          @change="updateProp('width', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.height') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(imageHeight)"
          @change="updateProp('height', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.imageFit') }}</label>
        <select
          class="prop-input"
          :value="imageFitMode"
          @change="updateProp('ext.fitMode', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="m in IMAGE_FIT_MODES" :key="m" :value="m">{{ imageFitModeLabel(m) }}</option>
        </select>
      </div>

      <PaletteColorPicker
        :label="t('properties.backgroundColor')"
        :colors="palette"
        :model-value="imageBgColor"
        @update:model-value="updateProp('ext.backgroundColor', $event)"
      />
    </template>

    <!-- QRCODE properties -->
    <template v-if="isQrcode">
      <div class="info-row">
        <span>{{ t('properties.dataField') }}</span>
        <b>{{ qrcodeSource === 'dynamic' ? fieldOptionLabel('qrContent') : t('properties.staticContent') }}</b>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.source') }}</label>
        <select
          class="prop-input"
          :value="qrcodeSource"
          @change="updateQrcodeSource(($event.target as HTMLSelectElement).value as 'dynamic' | 'static')"
        >
          <option value="dynamic">{{ t('properties.dynamicQrContent') }}</option>
          <option value="static">{{ t('properties.staticQrContentOption') }}</option>
        </select>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ qrcodeSource === 'static' ? t('properties.staticQrLabel') : t('properties.previewQrLabel') }}</label>
        <textarea
          class="prop-input prop-textarea"
          :value="qrcodeContentValue"
          @change="updateQrcodeContent(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <div class="prop-hint">
          {{ qrcodeSource === 'static' ? t('properties.qrStaticHint') : t('properties.qrDynamicHint') }}
        </div>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.uploadText') }}</label>
        <input class="prop-input" type="file" accept=".txt,text/plain" @change="handleQrcodeTextFileChange" />
        <div class="prop-hint">{{ t('properties.uploadTextHint') }}</div>
        <div v-if="qrcodeUploadError" class="prop-error">{{ qrcodeUploadError }}</div>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.width') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(qrcodeWidth)"
          @change="updateProp('width', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.height') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(qrcodeHeight)"
          @change="updateProp('height', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.errorCorrection') }}</label>
        <select
          class="prop-input"
          :value="qrcodeErrorCorrection"
          @change="updateProp('ext.errorCorrection', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="e in QRCODE_ERROR_CORRECTIONS" :key="e" :value="e">{{ qrcodeErrorCorrectionLabel(e) }}</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.qrMargin') }}</label>
        <input
          type="number"
          class="prop-input"
          min="0"
          :value="qrcodeMargin"
          @change="updateProp('ext.margin', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div v-if="qrcodeWarnings.length" class="prop-warning">
        <div v-for="warning in qrcodeWarnings" :key="warning.code">{{ warning.message }}</div>
      </div>

      <PaletteColorPicker
        :label="t('properties.foregroundColor')"
        :colors="palette"
        :model-value="qrcodeFgColor"
        @update:model-value="updateProp('ext.foregroundColor', $event)"
      />

      <PaletteColorPicker
        :label="t('properties.backgroundColor')"
        :colors="palette"
        :model-value="qrcodeBgColor"
        @update:model-value="updateProp('ext.backgroundColor', $event)"
      />
    </template>

    <!-- BARCODE properties -->
    <template v-if="isBarcode">
      <div class="section-label">{{ t('properties.content') }}</div>
      <div class="info-row">
        <span>{{ t('properties.dataField') }}</span>
        <b>{{ barcodeSource === 'dynamic' ? fieldOptionLabel('barcodeContent') : t('properties.staticContent') }}</b>
      </div>

      <div class="info-row">
        <span>{{ t('properties.barcodeFormat') }}</span>
        <b>CODE128</b>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.source') }}</label>
        <select
          class="prop-input"
          :value="barcodeSource"
          @change="updateBarcodeSource(($event.target as HTMLSelectElement).value as 'dynamic' | 'static')"
        >
          <option value="dynamic">{{ t('properties.dynamicBarcodeContent') }}</option>
          <option value="static">{{ t('properties.staticBarcodeContentOption') }}</option>
        </select>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ barcodeSource === 'static' ? t('properties.staticBarcodeLabel') : t('properties.previewBarcodeLabel') }}</label>
        <textarea
          class="prop-input prop-textarea"
          :value="barcodeContentValue"
          @change="updateBarcodeContent(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <div class="prop-hint">
          {{ barcodeSource === 'static' ? t('properties.barcodeStaticHint') : t('properties.barcodeDynamicHint') }}
        </div>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">{{ t('properties.uploadText') }}</label>
        <input class="prop-input" type="file" accept=".txt,text/plain" @change="handleBarcodeTextFileChange" />
        <div class="prop-hint">{{ t('properties.uploadTextHint') }}</div>
        <div v-if="barcodeUploadError" class="prop-error">{{ barcodeUploadError }}</div>
      </div>

      <div v-if="barcodeInvalidContent" class="prop-warning">
        {{ t('properties.barcodeInvalid') }}
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.showText') }}</label>
        <select
          class="prop-input"
          :value="barcodeShowText ? 'true' : 'false'"
          @change="updateProp('ext.showText', ($event.target as HTMLSelectElement).value === 'true')"
        >
          <option value="true">{{ t('properties.yes') }}</option>
          <option value="false">{{ t('properties.no') }}</option>
        </select>
      </div>

      <div class="section-label">{{ t('properties.size') }}</div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.width') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(barcodeWidth)"
          @change="updateProp('width', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">{{ t('properties.height') }}</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(barcodeHeight)"
          @change="updateProp('height', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="section-label">{{ t('properties.style') }}</div>

      <PaletteColorPicker
        :label="t('properties.foregroundColor')"
        :colors="palette"
        :model-value="barcodeFgColor"
        @update:model-value="updateProp('ext.foregroundColor', $event)"
      />

      <PaletteColorPicker
        :label="t('properties.backgroundColor')"
        :colors="palette"
        :model-value="barcodeBgColor"
        @update:model-value="updateProp('ext.backgroundColor', $event)"
      />

      <div class="section-label">{{ t('properties.readability') }}</div>
      <div v-if="barcodeWarnings.length" class="prop-warning">
        <div v-for="warning in barcodeWarnings" :key="warning.code">{{ warning.message }}</div>
      </div>
      <div v-else class="prop-note">{{ t('properties.barcodeReadable') }}</div>
    </template>
    </template>
  </aside>
</template>

<style scoped>
.properties-panel {
  min-height: 0;
  height: 100%;
  padding: 0 12px 14px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  align-content: start;
  gap: 12px 10px;
  overflow-y: auto;
  flex: 1 1 auto;
}

.panel-title {
  position: sticky;
  top: 0;
  z-index: 2;
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 -12px;
  padding: 12px 12px 10px;
  font-size: 15px;
  font-weight: 800;
  color: var(--text-strong);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line-faint);
  background:
    radial-gradient(circle at 14% 0%, rgba(216, 183, 96, 0.08), transparent 36%),
    linear-gradient(180deg, rgba(34, 37, 44, 0.98), rgba(23, 25, 30, 0.98));
}

.panel-type-badge {
  flex: 0 0 auto;
  padding: 4px 7px;
  color: var(--accent-ink);
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
  border-radius: 999px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.04em;
}

.empty-state {
  grid-column: 1 / -1;
  display: flex;
  min-height: 190px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 14px;
  text-align: center;
  color: var(--text-muted);
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
  background: rgba(7, 8, 10, 0.28);
}

.empty-state-mark {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 24px;
  line-height: 1;
}

.empty-state-title {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 750;
}

.empty-state p {
  font-size: 12px;
  line-height: 1.5;
}

.section-label {
  grid-column: 1 / -1;
  margin-top: 4px;
  padding: 10px 0 0;
  font-size: 12px;
  font-weight: 800;
  color: var(--text-main);
  border-top: 1px solid var(--line-faint);
}

.quick-preset-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.quick-preset-row button {
  min-height: 30px;
  color: var(--text-main);
  background: rgba(216, 183, 96, 0.1);
  border: 1px solid rgba(216, 183, 96, 0.25);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;
  transition: color 0.16s, background 0.16s, border-color 0.16s;
}

.quick-preset-row button:hover {
  color: var(--accent-strong);
  border-color: var(--accent-line);
  background: var(--accent-soft);
}

.prop-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.prop-wide,
.info-row,
.prop-note {
  grid-column: 1 / -1;
}

.prop-label {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 750;
}

.prop-input {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 9px 10px;
  font-size: 13px;
  font-weight: 650;
  background: rgba(7, 8, 10, 0.48);
  color: var(--text-strong);
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  box-sizing: border-box;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.prop-input:focus {
  outline: none;
  border-color: var(--accent-line);
  box-shadow: var(--focus-ring), inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.prop-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.prop-textarea {
  min-height: 86px;
  resize: vertical;
  line-height: 1.45;
}

.info-row {
  display: grid;
  grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  color: var(--text-main);
  background: rgba(7, 8, 10, 0.34);
  border: 1px solid var(--line-faint);
  border-radius: 10px;
}

.info-row span {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 750;
}

.info-row b {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 800;
}

.prop-hint {
  overflow-wrap: anywhere;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.45;
}

.prop-error,
.prop-warning,
.prop-note {
  grid-column: 1 / -1;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.4;
}

.prop-error {
  color: #ffd2ca;
  background: rgba(255, 134, 111, 0.13);
  border: 1px solid rgba(255, 134, 111, 0.35);
}

.prop-warning {
  color: #ffe4ad;
  background: rgba(240, 196, 107, 0.13);
  border: 1px solid rgba(240, 196, 107, 0.34);
}

.prop-note {
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid var(--line-faint);
}

.properties-panel :deep(.palette-picker) {
  min-width: 0;
}

.properties-panel :deep(.picker-label) {
  overflow-wrap: anywhere;
  font-size: 12px;
  font-weight: 750;
}
</style>
