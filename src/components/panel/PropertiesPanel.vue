<script setup lang="ts">
import { computed } from 'vue';
import { fabric } from 'fabric';
import PaletteColorPicker from '@/components/common/PaletteColorPicker.vue';
import { TEXT_BINDABLE_FIELDS } from '@/fields';
import { TEXT_OVERFLOW_MODES, IMAGE_FIT_MODES, QRCODE_ERROR_CORRECTIONS } from '@/stores/editorStore';
import type { TextExtension, TextOverflowMode, ImageExtension, ImageFitMode, PriceExtension, DiscountExtension, QrcodeExtension, QrcodeErrorCorrection, BarcodeExtension } from '@/stores/editorStore';
import type { ColorEntry } from '@/screen/types';

const props = defineProps<{
  selectedObject: fabric.Object | null;
  palette: ColorEntry[];
  customFields?: string[];
}>();

const emit = defineEmits<{
  'update-prop': [key: string, value: unknown];
}>();

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

const bindableFields = computed(() => {
  const custom = props.customFields ?? [];
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

function updateProp(key: string, value: unknown) {
  emit('update-prop', key, value);
}
</script>

<template>
  <aside v-if="selectedObject && (isRect || isLine || isText || isPrice || isDiscount || isImage || isQrcode || isBarcode)" class="properties-panel">
    <div class="panel-title">{{ objectType }} 属性</div>

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
      <div class="prop-group">
        <label class="prop-label">文本内容</label>
        <input
          type="text"
          class="prop-input"
          :value="textContent"
          @change="updateProp('text', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">字段绑定</label>
        <select
          class="prop-input"
          :value="textFieldBinding"
          @change="updateProp('ext.fieldBinding', ($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">无（固定文本）</option>
          <option v-for="f in bindableFields" :key="f" :value="f">{{ f }}</option>
        </select>
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
        <label class="prop-label">超长模式</label>
        <select
          class="prop-input"
          :value="textOverflow"
          @change="updateProp('ext.overflow', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="m in TEXT_OVERFLOW_MODES" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">行数限制 (0=不限)</label>
        <input
          type="number"
          class="prop-input"
          min="0"
          :value="textLineClamp"
          @change="updateProp('ext.lineClamp', +($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group">
        <label class="prop-label">字体</label>
        <input
          type="text"
          class="prop-input"
          value="AlibabaPuHuiTi"
          disabled
        />
      </div>
    </template>

    <!-- PRICE properties -->
    <template v-if="isPrice">
      <div class="prop-group">
        <label class="prop-label">绑定字段</label>
        <input type="text" class="prop-input" value="price" disabled />
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
        <label class="prop-label">上浮偏移 (offsetY)</label>
        <input
          type="number"
          class="prop-input"
          :value="priceExt?.decimalStyle?.offsetY ?? -12"
          @change="updateProp('ext.decimalStyle', { ...priceExt?.decimalStyle, offsetY: +($event.target as HTMLInputElement).value })"
        />
      </div>
    </template>

    <!-- DISCOUNT properties -->
    <template v-if="isDiscount">
      <div class="prop-group">
        <label class="prop-label">绑定字段</label>
        <input type="text" class="prop-input" value="discount" disabled />
      </div>

      <div class="prop-group">
        <label class="prop-label">格式模板</label>
        <input
          type="text"
          class="prop-input"
          :value="discountFormatTemplate"
          @change="updateProp('ext.formatTemplate', ($event.target as HTMLInputElement).value)"
        />
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
      <div class="prop-group">
        <label class="prop-label">图片类型</label>
        <input
          type="text"
          class="prop-input"
          :value="imageSource === 'dynamic' ? '动态（imageUrl）' : '静态'"
          disabled
        />
      </div>

      <div class="prop-group" v-if="imageSource === 'static'">
        <label class="prop-label">图片地址</label>
        <input
          type="text"
          class="prop-input"
          :value="imageSrc"
          placeholder="输入图片 URL 或 Base64"
          @change="updateProp('ext.src', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="prop-group" v-if="imageSource === 'dynamic'">
        <label class="prop-label">绑定字段</label>
        <input
          type="text"
          class="prop-input"
          value="imageUrl"
          disabled
        />
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
        <label class="prop-label">适配模式</label>
        <select
          class="prop-input"
          :value="imageFitMode"
          @change="updateProp('ext.fitMode', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="m in IMAGE_FIT_MODES" :key="m" :value="m">{{ m }}</option>
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
      <div class="prop-group">
        <label class="prop-label">绑定字段</label>
        <input type="text" class="prop-input" value="qrContent" disabled />
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
        <label class="prop-label">纠错等级</label>
        <select
          class="prop-input"
          :value="qrcodeErrorCorrection"
          @change="updateProp('ext.errorCorrection', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="e in QRCODE_ERROR_CORRECTIONS" :key="e" :value="e">{{ e }}</option>
        </select>
      </div>

      <div class="prop-group">
        <label class="prop-label">边距</label>
        <input
          type="number"
          class="prop-input"
          min="0"
          :value="qrcodeMargin"
          @change="updateProp('ext.margin', +($event.target as HTMLInputElement).value)"
        />
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
      <div class="prop-group">
        <label class="prop-label">绑定字段</label>
        <input type="text" class="prop-input" value="barcodeContent" disabled />
      </div>

      <div class="prop-group">
        <label class="prop-label">条码格式</label>
        <input type="text" class="prop-input" value="CODE128" disabled />
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
    </template>
  </aside>
</template>

<style scoped>
.properties-panel {
  width: 200px;
  background: #1a1a1a;
  border-left: 1px solid #2a2a2a;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  flex-shrink: 0;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #e0e0e0;
  padding-bottom: 8px;
  border-bottom: 1px solid #2a2a2a;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: #aaa;
  padding-top: 6px;
  border-top: 1px solid #2a2a2a;
}

.prop-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.prop-label {
  font-size: 11px;
  color: #888;
}

.prop-input {
  width: 100%;
  padding: 4px 8px;
  font-size: 12px;
  background: #242424;
  color: #e0e0e0;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  box-sizing: border-box;
}

.prop-input:focus {
  outline: none;
  border-color: #4fc3f7;
}

.prop-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
