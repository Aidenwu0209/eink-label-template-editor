<script setup lang="ts">
import { computed, ref } from 'vue';
import type * as fabric from 'fabric';
import PaletteColorPicker from '@/components/common/PaletteColorPicker.vue';
import { filterValidCustomFieldIds, PRICE_BINDABLE_FIELDS, TEXT_BINDABLE_FIELDS, type PriceBindableField } from '@/fields';
import { TEXT_OVERFLOW_MODES, IMAGE_FIT_MODES, QRCODE_ERROR_CORRECTIONS } from '@/stores/editorStore';
import type { TextExtension, TextOverflowMode, ImageExtension, ImageFitMode, PriceExtension, DiscountExtension, QrcodeExtension, QrcodeErrorCorrection, BarcodeExtension } from '@/stores/editorStore';
import type { ColorEntry } from '@/screen/types';
import type { PreviewData } from '@/boot/types';

const props = defineProps<{
  selectedObject: fabric.Object | null;
  palette: ColorEntry[];
  customFields?: string[];
  previewData?: PreviewData;
}>();

const emit = defineEmits<{
  'update-prop': [key: string, value: unknown];
  'update-preview-field': [field: string, value: unknown];
}>();

const OBJECT_TYPE_LABELS = {
  RECT: '矩形框',
  LINE: '直线',
  TEXT: '文本',
  PRICE: '价格',
  DISCOUNT: '折扣',
  IMAGE: '图片',
  QRCODE: '二维码',
  BARCODE: '条形码',
} as const;

const FIELD_LABELS: Record<string, string> = {
  productName: '商品名称',
  description: '商品描述',
  price: '价格',
  originalPrice: '原价',
  memberPrice: '会员价',
  discount: '折扣',
  spec: '规格',
  brand: '品牌',
  origin: '产地',
  promoText: '促销文案',
  imageUrl: '图片地址',
  qrContent: '二维码内容',
  barcodeContent: '条形码内容',
};

const OVERFLOW_MODE_LABELS: Record<TextOverflowMode, string> = {
  clip: '裁切超出内容',
  ellipsis: '超出显示省略号',
  wrap: '自动换行',
};

const IMAGE_FIT_MODE_LABELS: Record<ImageFitMode, string> = {
  contain: '完整显示（等比缩放）',
  cover: '填满区域（可能裁切）',
  fill: '拉伸填满',
};

const QRCODE_ERROR_CORRECTION_LABELS: Record<QrcodeErrorCorrection, string> = {
  L: 'L - 容错低，内容容量最大',
  M: 'M - 默认',
  Q: 'Q - 容错较高',
  H: 'H - 容错最高，内容容量最小',
};

function fieldOptionLabel(field: string): string {
  const label = FIELD_LABELS[field];
  return label ? `${label}（${field}）` : field;
}

const objectType = computed(() => {
  if (!props.selectedObject) return null;
  const ext = (props.selectedObject as any).extensionType;
  if (ext === 'TEXT') return 'TEXT';
  if (ext === 'PRICE') return 'PRICE';
  if (ext === 'DISCOUNT') return 'DISCOUNT';
  if (ext === 'IMAGE') return 'IMAGE';
  if (ext === 'QRCODE') return 'QRCODE';
  if (ext === 'BARCODE') return 'BARCODE';
  if (props.selectedObject.type === 'rect') return 'RECT';
  if (props.selectedObject.type === 'line') return 'LINE';
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
    props.selectedObject
    && (isRect.value || isLine.value || isText.value || isPrice.value || isDiscount.value || isImage.value || isQrcode.value || isBarcode.value)
  );
});
const objectTypeLabel = computed(() => {
  if (!objectType.value) return '';
  return OBJECT_TYPE_LABELS[objectType.value as keyof typeof OBJECT_TYPE_LABELS] ?? objectType.value;
});
const panelTitle = computed(() => hasSupportedSelection.value ? `${objectTypeLabel.value}属性` : '属性面板');

// RECT properties
const rectX = computed(() => props.selectedObject?.left ?? 0);
const rectY = computed(() => props.selectedObject?.top ?? 0);
const rectWidth = computed(() => (props.selectedObject as fabric.Rect)?.width ?? 0);
const rectHeight = computed(() => (props.selectedObject as fabric.Rect)?.height ?? 0);
const rectFill = computed(() => (props.selectedObject?.fill as string) ?? '#000000');
const rectStroke = computed(() => (props.selectedObject?.stroke as string) ?? '');
const rectStrokeWidth = computed(() => props.selectedObject?.strokeWidth ?? 0);

// LINE properties
const lineObj = computed(() => props.selectedObject as fabric.Line | null);
const lineX1 = computed(() => lineObj.value ? (lineObj.value as any).x1 ?? 0 : 0);
const lineY1 = computed(() => lineObj.value ? (lineObj.value as any).y1 ?? 0 : 0);
const lineX2 = computed(() => lineObj.value ? (lineObj.value as any).x2 ?? 0 : 0);
const lineY2 = computed(() => lineObj.value ? (lineObj.value as any).y2 ?? 0 : 0);
const lineStroke = computed(() => (props.selectedObject?.stroke as string) ?? '#000000');
const lineStrokeWidth = computed(() => props.selectedObject?.strokeWidth ?? 1);

// TEXT properties
const textObj = computed(() => props.selectedObject as fabric.Textbox | null);
const textContent = computed(() => textObj.value?.text ?? '');
const textFontSize = computed(() => textObj.value?.fontSize ?? 16);
const textFontWeight = computed(() => textObj.value?.fontWeight ?? 'normal');
const textFill = computed(() => (textObj.value?.fill as string) ?? '#000000');
const textAlign = computed(() => textObj.value?.textAlign ?? 'left');

const textExt = computed<TextExtension | null>(() => {
  if (!isText.value || !props.selectedObject) return null;
  return (props.selectedObject as any).extension as TextExtension;
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
  if (!isImage.value || !props.selectedObject) return null;
  return (props.selectedObject as any).extension as ImageExtension;
});

const imageSource = computed(() => imageExt.value?.source ?? 'static');
const imageSrc = computed(() => imageExt.value?.src ?? '');
const imageFitMode = computed<ImageFitMode>(() => imageExt.value?.fitMode ?? 'contain');
const imageBgColor = computed(() => imageExt.value?.backgroundColor ?? '#FFFFFF');
const imageWidth = computed(() => (props.selectedObject as fabric.Rect)?.width ?? 0);
const imageHeight = computed(() => (props.selectedObject as fabric.Rect)?.height ?? 0);
const imagePreviewValue = computed(() => props.previewData?.imageUrl == null ? '' : String(props.previewData.imageUrl));
const imageUploadError = ref('');
const imageLoadError = computed(() => {
  if (imageExt.value?.loadStatus !== 'error') return '';
  return imageExt.value.loadError || '图片加载失败';
});

// PRICE properties
const priceExt = computed<PriceExtension | null>(() => {
  if (!isPrice.value || !props.selectedObject) return null;
  return (props.selectedObject as any).extension as PriceExtension;
});

const priceCurrencySymbol = computed(() => priceExt.value?.currencySymbol ?? '¥');
const priceShowCurrency = computed(() => priceExt.value?.showCurrency ?? true);
const priceDecimalPlaces = computed(() => priceExt.value?.decimalPlaces ?? 2);
const priceThousandSep = computed(() => priceExt.value?.thousandSeparator ?? ',');
const priceDecimalSep = computed(() => priceExt.value?.decimalSeparator ?? '.');
const priceWidth = computed(() => (props.selectedObject as fabric.Rect)?.width ?? 0);
const priceHeight = computed(() => (props.selectedObject as fabric.Rect)?.height ?? 0);
const priceFieldBinding = computed<PriceBindableField>(() => priceExt.value?.fieldBinding ?? 'price');
const pricePreviewValue = computed(() => {
  const field = priceFieldBinding.value;
  return props.previewData?.[field] == null ? '' : String(props.previewData[field]);
});

// DISCOUNT properties
const discountExt = computed<DiscountExtension | null>(() => {
  if (!isDiscount.value || !props.selectedObject) return null;
  return (props.selectedObject as any).extension as DiscountExtension;
});

const discountFormatTemplate = computed(() => discountExt.value?.formatTemplate ?? '{value}折');
const discountBgColor = computed(() => discountExt.value?.backgroundColor ?? '#FFFFFF');
const discountTextColor = computed(() => discountExt.value?.textColor ?? '#000000');
const discountFontSize = computed(() => discountExt.value?.fontSize ?? 20);
const discountFontWeight = computed(() => discountExt.value?.fontWeight ?? 'normal');
const discountTextAlign = computed(() => discountExt.value?.textAlign ?? 'center');
const discountVerticalAlign = computed(() => discountExt.value?.verticalAlign ?? 'middle');
const discountWidth = computed(() => (props.selectedObject as fabric.Rect)?.width ?? 0);
const discountHeight = computed(() => (props.selectedObject as fabric.Rect)?.height ?? 0);
const discountPreviewValue = computed(() => props.previewData?.discount == null ? '' : String(props.previewData.discount));

// QRCODE properties
const qrcodeExt = computed<QrcodeExtension | null>(() => {
  if (!isQrcode.value || !props.selectedObject) return null;
  return (props.selectedObject as any).extension as QrcodeExtension;
});

const qrcodeErrorCorrection = computed<QrcodeErrorCorrection>(() => qrcodeExt.value?.errorCorrection ?? 'M');
const qrcodeMargin = computed(() => qrcodeExt.value?.margin ?? 1);
const qrcodeFgColor = computed(() => qrcodeExt.value?.foregroundColor ?? '#000000');
const qrcodeBgColor = computed(() => qrcodeExt.value?.backgroundColor ?? '#FFFFFF');
const qrcodeWidth = computed(() => (props.selectedObject as fabric.Rect)?.width ?? 0);
const qrcodeHeight = computed(() => (props.selectedObject as fabric.Rect)?.height ?? 0);
const qrcodeWarnings = computed(() => qrcodeExt.value?.readabilityWarnings ?? []);
const qrcodePreviewValue = computed(() => props.previewData?.qrContent == null ? '' : String(props.previewData.qrContent));

// BARCODE properties
const barcodeExt = computed<BarcodeExtension | null>(() => {
  if (!isBarcode.value || !props.selectedObject) return null;
  return (props.selectedObject as any).extension as BarcodeExtension;
});

const barcodeShowText = computed(() => barcodeExt.value?.showText ?? true);
const barcodeFgColor = computed(() => barcodeExt.value?.foregroundColor ?? '#000000');
const barcodeBgColor = computed(() => barcodeExt.value?.backgroundColor ?? '#FFFFFF');
const barcodeWidth = computed(() => (props.selectedObject as fabric.Rect)?.width ?? 0);
const barcodeHeight = computed(() => (props.selectedObject as fabric.Rect)?.height ?? 0);
const barcodeWarnings = computed(() => barcodeExt.value?.readabilityWarnings ?? []);

function updateProp(key: string, value: unknown) {
  emit('update-prop', key, value);
}

const barcodePreviewValue = computed(() => props.previewData?.barcodeContent == null ? '' : String(props.previewData.barcodeContent));

function updatePreviewField(field: string, value: unknown) {
  emit('update-preview-field', field, value);
}

function paletteHex(name: string, fallback: string): string {
  return props.palette.find((color) => color.name.toLowerCase() === name.toLowerCase())?.hex ?? fallback;
}

function applyPricePreset(kind: 'sale' | 'plain') {
  const ext = priceExt.value;
  if (!ext) return;

  if (kind === 'sale') {
    const red = paletteHex('red', '#CC0000');
    updateProp('ext.currencyStyle', { ...ext.currencyStyle, fontSize: 13, fontWeight: 'normal', color: '#000000' });
    updateProp('ext.integerStyle', { ...ext.integerStyle, fontSize: 28, fontWeight: 'bold', color: red });
    updateProp('ext.decimalStyle', { ...ext.decimalStyle, fontSize: 15, fontWeight: 'normal', color: red, offsetY: -10 });
    return;
  }

  const black = paletteHex('black', '#000000');
  updateProp('ext.currencyStyle', { ...ext.currencyStyle, fontSize: 12, fontWeight: 'normal', color: black });
  updateProp('ext.integerStyle', { ...ext.integerStyle, fontSize: 24, fontWeight: 'bold', color: black });
  updateProp('ext.decimalStyle', { ...ext.decimalStyle, fontSize: 13, fontWeight: 'normal', color: black, offsetY: -8 });
}

function handleStaticImageFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  imageUploadError.value = '';

  if (!file) return;
  if (!file.type.startsWith('image/')) {
    imageUploadError.value = '请选择图片文件';
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    updateProp('ext.src', String(reader.result ?? ''));
    input.value = '';
  };
  reader.onerror = () => {
    imageUploadError.value = reader.error?.message || '读取图片文件失败';
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
      <div class="empty-state-title">未选择对象</div>
      <p>从左侧工具箱添加元素，或点击画布上的元素后在这里调整属性。</p>
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
        <label class="prop-label">宽度</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(rectWidth)"
          @change="updateProp('width', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">高度</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(rectHeight)"
          @change="updateProp('height', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <PaletteColorPicker
        label="填充色"
        :colors="palette"
        :model-value="rectFill"
        @update:model-value="updateProp('fill', $event)"
      />
      <PaletteColorPicker
        label="描边色"
        :colors="palette"
        :model-value="rectStroke || '#000000'"
        @update:model-value="updateProp('stroke', $event)"
      />
      <div class="prop-group">
        <label class="prop-label">描边宽度</label>
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
        <label class="prop-label">起点 X</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(lineX1)"
          @change="updateProp('x1', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">起点 Y</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(lineY1)"
          @change="updateProp('y1', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">终点 X</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(lineX2)"
          @change="updateProp('x2', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="prop-group">
        <label class="prop-label">终点 Y</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(lineY2)"
          @change="updateProp('y2', +($event.target as HTMLInputElement).value)"
        />
      </div>
      <PaletteColorPicker
        label="颜色"
        :colors="palette"
        :model-value="lineStroke"
        @update:model-value="updateProp('stroke', $event)"
      />
      <div class="prop-group">
        <label class="prop-label">线宽</label>
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
        <label class="prop-label">文本内容</label>
        <input
          type="text"
          class="prop-input"
          :value="textContent"
          @change="updateProp('text', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">数据字段</label>
        <select
          class="prop-input"
          :value="textFieldBinding"
          @change="updateProp('ext.fieldBinding', ($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">无（固定文本）</option>
          <option v-for="f in bindableFields" :key="f" :value="f">{{ fieldOptionLabel(f) }}</option>
        </select>
        <div class="prop-hint">选择字段后，文本会使用预览数据中的对应值。</div>
      </div>

      <div v-if="textFieldBinding" class="prop-group prop-wide">
        <label class="prop-label">预览数据 · {{ fieldOptionLabel(textFieldBinding) }}</label>
        <input
          type="text"
          class="prop-input"
          :value="textPreviewValue"
          @change="updatePreviewField(textFieldBinding, ($event.target as HTMLInputElement).value)"
        />
        <div class="prop-hint">这里改的是预览数据，所有绑定同一字段的文本会一起刷新。</div>
      </div>

      <div class="prop-group">
        <label class="prop-label">字号</label>
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
        <label class="prop-label">字重</label>
        <select
          class="prop-input"
          :value="textFontWeight"
          @change="updateProp('fontWeight', ($event.target as HTMLSelectElement).value)"
        >
          <option value="normal">正常</option>
          <option value="bold">粗体</option>
        </select>
      </div>

      <PaletteColorPicker
        label="文字颜色"
        :colors="palette"
        :model-value="textFill"
        @update:model-value="updateProp('fill', $event)"
      />

      <div class="prop-group">
        <label class="prop-label">水平对齐</label>
        <select
          class="prop-input"
          :value="textAlign"
          @change="updateProp('textAlign', ($event.target as HTMLSelectElement).value)"
        >
          <option value="left">左对齐</option>
          <option value="center">居中</option>
          <option value="right">右对齐</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">垂直对齐</label>
        <select
          class="prop-input"
          :value="textVerticalAlign"
          @change="updateProp('ext.verticalAlign', ($event.target as HTMLSelectElement).value)"
        >
          <option value="top">顶部</option>
          <option value="middle">居中</option>
          <option value="bottom">底部</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">超长内容处理</label>
        <select
          class="prop-input"
          :value="textOverflow"
          @change="updateProp('ext.overflow', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="m in TEXT_OVERFLOW_MODES" :key="m" :value="m">{{ OVERFLOW_MODE_LABELS[m] }}</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">最多显示行数</label>
        <input
          type="number"
          class="prop-input"
          min="0"
          :value="textLineClamp"
          @change="updateProp('ext.lineClamp', +($event.target as HTMLInputElement).value)"
        />
        <div class="prop-hint">填 0 表示不限制行数。</div>
      </div>

      <div class="info-row">
        <span>字体</span>
        <b>AlibabaPuHuiTi</b>
      </div>
    </template>

    <!-- PRICE properties -->
    <template v-if="isPrice">
      <div class="prop-group prop-wide">
        <label class="prop-label">数据字段</label>
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
        <label class="prop-label">预览{{ FIELD_LABELS[priceFieldBinding] ?? '价格' }}</label>
        <input
          type="number"
          step="0.01"
          class="prop-input"
          :value="pricePreviewValue"
          @change="updatePreviewField(priceFieldBinding, ($event.target as HTMLInputElement).value)"
        />
        <div class="prop-hint">修改测试数据会刷新所有绑定该字段的价格组件。</div>
      </div>

      <div class="quick-preset-row">
        <button type="button" @click="applyPricePreset('sale')">醒目红色价</button>
        <button type="button" @click="applyPricePreset('plain')">黑色常规价</button>
      </div>

      <div class="prop-group">
        <label class="prop-label">货币符号</label>
        <input
          type="text"
          class="prop-input"
          :value="priceCurrencySymbol"
          @change="updateProp('ext.currencySymbol', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">显示货币符号</label>
        <select
          class="prop-input"
          :value="priceShowCurrency ? 'true' : 'false'"
          @change="updateProp('ext.showCurrency', ($event.target as HTMLSelectElement).value === 'true')"
        >
          <option value="true">是</option>
          <option value="false">否</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">小数位数</label>
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
        <label class="prop-label">千分位分隔符</label>
        <input
          type="text"
          class="prop-input"
          :value="priceThousandSep"
          @change="updateProp('ext.thousandSeparator', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">小数分隔符</label>
        <input
          type="text"
          class="prop-input"
          :value="priceDecimalSep"
          @change="updateProp('ext.decimalSeparator', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">宽度</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(priceWidth)"
          @change="updateProp('width', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">高度</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(priceHeight)"
          @change="updateProp('height', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="section-label">货币符号样式</div>
      <div class="prop-group">
        <label class="prop-label">字号</label>
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
        <label class="prop-label">字重</label>
        <select
          class="prop-input"
          :value="priceExt?.currencyStyle?.fontWeight ?? 'normal'"
          @change="updateProp('ext.currencyStyle', { ...priceExt?.currencyStyle, fontWeight: ($event.target as HTMLSelectElement).value })"
        >
          <option value="normal">正常</option>
          <option value="bold">粗体</option>
        </select>
      </div>
      <PaletteColorPicker
        label="颜色"
        :colors="palette"
        :model-value="priceExt?.currencyStyle?.color ?? '#000000'"
        @update:model-value="updateProp('ext.currencyStyle', { ...priceExt?.currencyStyle, color: $event })"
      />

      <div class="section-label">整数样式</div>
      <div class="prop-group">
        <label class="prop-label">字号</label>
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
        <label class="prop-label">字重</label>
        <select
          class="prop-input"
          :value="priceExt?.integerStyle?.fontWeight ?? 'bold'"
          @change="updateProp('ext.integerStyle', { ...priceExt?.integerStyle, fontWeight: ($event.target as HTMLSelectElement).value })"
        >
          <option value="normal">正常</option>
          <option value="bold">粗体</option>
        </select>
      </div>
      <PaletteColorPicker
        label="颜色"
        :colors="palette"
        :model-value="priceExt?.integerStyle?.color ?? '#000000'"
        @update:model-value="updateProp('ext.integerStyle', { ...priceExt?.integerStyle, color: $event })"
      />

      <div class="section-label">小数样式</div>
      <div class="prop-group">
        <label class="prop-label">字号</label>
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
        <label class="prop-label">字重</label>
        <select
          class="prop-input"
          :value="priceExt?.decimalStyle?.fontWeight ?? 'normal'"
          @change="updateProp('ext.decimalStyle', { ...priceExt?.decimalStyle, fontWeight: ($event.target as HTMLSelectElement).value })"
        >
          <option value="normal">正常</option>
          <option value="bold">粗体</option>
        </select>
      </div>
      <PaletteColorPicker
        label="颜色"
        :colors="palette"
        :model-value="priceExt?.decimalStyle?.color ?? '#000000'"
        @update:model-value="updateProp('ext.decimalStyle', { ...priceExt?.decimalStyle, color: $event })"
      />
      <div class="prop-group">
        <label class="prop-label">小数字符上移</label>
        <input
          type="number"
          class="prop-input"
          :value="priceExt?.decimalStyle?.offsetY ?? -12"
          @change="updateProp('ext.decimalStyle', { ...priceExt?.decimalStyle, offsetY: +($event.target as HTMLInputElement).value })"
        />
        <div class="prop-hint">负数表示向上移动，例如 -12。</div>
      </div>
    </template>

    <!-- DISCOUNT properties -->
    <template v-if="isDiscount">
      <div class="info-row">
        <span>数据字段</span>
        <b>{{ fieldOptionLabel('discount') }}</b>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">预览折扣</label>
        <input
          type="number"
          step="0.1"
          class="prop-input"
          :value="discountPreviewValue"
          @change="updatePreviewField('discount', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">显示格式</label>
        <input
          type="text"
          class="prop-input"
          :value="discountFormatTemplate"
          @change="updateProp('ext.formatTemplate', ($event.target as HTMLInputElement).value)"
        />
        <div class="prop-hint">用 {value} 表示折扣值，例如 {value}折。</div>
      </div>

      <div class="prop-group">
        <label class="prop-label">宽度</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(discountWidth)"
          @change="updateProp('width', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">高度</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(discountHeight)"
          @change="updateProp('height', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <PaletteColorPicker
        label="背景色"
        :colors="palette"
        :model-value="discountBgColor"
        @update:model-value="updateProp('ext.backgroundColor', $event)"
      />

      <PaletteColorPicker
        label="文字颜色"
        :colors="palette"
        :model-value="discountTextColor"
        @update:model-value="updateProp('ext.textColor', $event)"
      />

      <div class="prop-group">
        <label class="prop-label">字号</label>
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
        <label class="prop-label">字重</label>
        <select
          class="prop-input"
          :value="discountFontWeight"
          @change="updateProp('ext.fontWeight', ($event.target as HTMLSelectElement).value)"
        >
          <option value="normal">正常</option>
          <option value="bold">粗体</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">水平对齐</label>
        <select
          class="prop-input"
          :value="discountTextAlign"
          @change="updateProp('ext.textAlign', ($event.target as HTMLSelectElement).value)"
        >
          <option value="left">左对齐</option>
          <option value="center">居中</option>
          <option value="right">右对齐</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">垂直对齐</label>
        <select
          class="prop-input"
          :value="discountVerticalAlign"
          @change="updateProp('ext.verticalAlign', ($event.target as HTMLSelectElement).value)"
        >
          <option value="top">顶部</option>
          <option value="middle">居中</option>
          <option value="bottom">底部</option>
        </select>
      </div>
    </template>

    <!-- IMAGE properties -->
    <template v-if="isImage">
      <div class="info-row">
        <span>图片来源</span>
        <b>{{ imageSource === 'dynamic' ? '数据字段：图片地址（imageUrl）' : '手动上传 / 图片 URL' }}</b>
      </div>

      <div class="prop-group prop-wide" v-if="imageSource === 'dynamic'">
        <label class="prop-label">预览图片地址</label>
        <input
          type="text"
          class="prop-input"
          :value="imagePreviewValue"
          placeholder="https://..."
          @change="updatePreviewField('imageUrl', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group prop-wide" v-if="imageSource === 'static'">
        <label class="prop-label">图片 URL / Base64</label>
        <input
          type="text"
          class="prop-input"
          :value="imageSrc"
          placeholder="输入图片 URL 或 Base64"
          @change="updateProp('ext.src', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group prop-wide" v-if="imageSource === 'static'">
        <label class="prop-label">上传图片</label>
        <input
          type="file"
          class="prop-input"
          accept="image/*"
          @change="handleStaticImageFileChange"
        />
        <div class="prop-hint">上传后会保存为 DataURL。</div>
        <div v-if="imageUploadError" class="prop-error">{{ imageUploadError }}</div>
      </div>

      <div v-if="imageLoadError" class="prop-error">{{ imageLoadError }}</div>

      <div class="info-row" v-if="imageSource === 'dynamic'">
        <span>数据字段</span>
        <b>{{ fieldOptionLabel('imageUrl') }}</b>
      </div>

      <div class="prop-group">
        <label class="prop-label">宽度</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(imageWidth)"
          @change="updateProp('width', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">高度</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(imageHeight)"
          @change="updateProp('height', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">图片填充方式</label>
        <select
          class="prop-input"
          :value="imageFitMode"
          @change="updateProp('ext.fitMode', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="m in IMAGE_FIT_MODES" :key="m" :value="m">{{ IMAGE_FIT_MODE_LABELS[m] }}</option>
        </select>
      </div>

      <PaletteColorPicker
        label="背景色"
        :colors="palette"
        :model-value="imageBgColor"
        @update:model-value="updateProp('ext.backgroundColor', $event)"
      />
    </template>

    <!-- QRCODE properties -->
    <template v-if="isQrcode">
      <div class="info-row">
        <span>数据字段</span>
        <b>{{ fieldOptionLabel('qrContent') }}</b>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">预览二维码内容</label>
        <input
          type="text"
          class="prop-input"
          :value="qrcodePreviewValue"
          @change="updatePreviewField('qrContent', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">宽度</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(qrcodeWidth)"
          @change="updateProp('width', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">高度</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(qrcodeHeight)"
          @change="updateProp('height', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">容错等级</label>
        <select
          class="prop-input"
          :value="qrcodeErrorCorrection"
          @change="updateProp('ext.errorCorrection', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="e in QRCODE_ERROR_CORRECTIONS" :key="e" :value="e">{{ QRCODE_ERROR_CORRECTION_LABELS[e] }}</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">二维码留白</label>
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
        label="前景色"
        :colors="palette"
        :model-value="qrcodeFgColor"
        @update:model-value="updateProp('ext.foregroundColor', $event)"
      />

      <PaletteColorPicker
        label="背景色"
        :colors="palette"
        :model-value="qrcodeBgColor"
        @update:model-value="updateProp('ext.backgroundColor', $event)"
      />
    </template>

    <!-- BARCODE properties -->
    <template v-if="isBarcode">
      <div class="section-label">内容</div>
      <div class="info-row">
        <span>数据字段</span>
        <b>{{ fieldOptionLabel('barcodeContent') }}</b>
      </div>

      <div class="info-row">
        <span>条码格式</span>
        <b>CODE128</b>
      </div>

      <div class="prop-group prop-wide">
        <label class="prop-label">预览条码内容</label>
        <input
          type="text"
          class="prop-input"
          :value="barcodePreviewValue"
          @change="updatePreviewField('barcodeContent', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">显示文本</label>
        <select
          class="prop-input"
          :value="barcodeShowText ? 'true' : 'false'"
          @change="updateProp('ext.showText', ($event.target as HTMLSelectElement).value === 'true')"
        >
          <option value="true">是</option>
          <option value="false">否</option>
        </select>
      </div>

      <div class="section-label">尺寸</div>

      <div class="prop-group">
        <label class="prop-label">宽度</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(barcodeWidth)"
          @change="updateProp('width', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">高度</label>
        <input
          type="number"
          class="prop-input"
          :value="Math.round(barcodeHeight)"
          @change="updateProp('height', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="section-label">样式</div>

      <PaletteColorPicker
        label="前景色"
        :colors="palette"
        :model-value="barcodeFgColor"
        @update:model-value="updateProp('ext.foregroundColor', $event)"
      />

      <PaletteColorPicker
        label="背景色"
        :colors="palette"
        :model-value="barcodeBgColor"
        @update:model-value="updateProp('ext.backgroundColor', $event)"
      />

      <div class="section-label">可读性</div>
      <div v-if="barcodeWarnings.length" class="prop-warning">
        <div v-for="warning in barcodeWarnings" :key="warning.code">{{ warning.message }}</div>
      </div>
      <div v-else class="prop-note">当前条码尺寸和颜色未检测到明显可读性问题。</div>
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
  color: #f0e9de;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(52, 53, 53, 0.98), rgba(39, 40, 41, 0.98));
}

.panel-type-badge {
  flex: 0 0 auto;
  padding: 4px 7px;
  color: #17130a;
  background: #d0b44b;
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
  color: #9b9489;
  border: 1px dashed rgba(255, 255, 255, 0.13);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.12);
}

.empty-state-mark {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(240, 211, 91, 0.14);
  color: #f0d35b;
  font-size: 24px;
  line-height: 1;
}

.empty-state-title {
  color: #e8dfd2;
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
  color: #d8d0c3;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.quick-preset-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.quick-preset-row button {
  min-height: 30px;
  color: #ddd5ca;
  background: rgba(240, 211, 91, 0.1);
  border: 1px solid rgba(240, 211, 91, 0.25);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;
}

.quick-preset-row button:hover {
  color: #fff2ba;
  border-color: rgba(240, 211, 91, 0.5);
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
  font-size: 12px;
  color: #a69f95;
  font-weight: 750;
}

.prop-input {
  width: 100%;
  min-height: 38px;
  padding: 9px 10px;
  font-size: 13px;
  font-weight: 650;
  background: rgba(14, 15, 15, 0.72);
  color: #eee7dc;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-sizing: border-box;
}

.prop-input:focus {
  outline: none;
  border-color: rgba(240, 211, 91, 0.62);
  box-shadow: 0 0 0 3px rgba(240, 211, 91, 0.1);
}

.prop-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.info-row {
  display: grid;
  grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  color: #ece4d8;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

.info-row span {
  color: #a69f95;
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
  font-size: 11px;
  color: #9f988f;
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
  color: #ffb4a8;
  background: rgba(255, 99, 71, 0.14);
  border: 1px solid rgba(255, 99, 71, 0.35);
}

.prop-warning {
  color: #ffe1a3;
  background: rgba(232, 184, 17, 0.14);
  border: 1px solid rgba(232, 184, 17, 0.35);
}

.prop-note {
  color: #bdb4a8;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.properties-panel :deep(.palette-picker) {
  min-width: 0;
}

.properties-panel :deep(.picker-label) {
  font-size: 12px;
  font-weight: 750;
}
</style>
