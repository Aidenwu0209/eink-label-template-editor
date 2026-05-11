<script setup lang="ts">
import { ref } from 'vue';
import type { StarterTemplateKind } from '@/stores/editorStore';

const props = withDefaults(defineProps<{
  canUndo?: boolean;
  canRedo?: boolean;
  hasSelection?: boolean;
  hasClipboard?: boolean;
  isSelectionLocked?: boolean;
}>(), {
  canUndo: false,
  canRedo: false,
  hasSelection: false,
  hasClipboard: false,
  isSelectionLocked: false,
});

const emit = defineEmits<{
  'add-rect': [];
  'add-line': [];
  'add-text': [];
  'add-price': [];
  'add-discount': [];
  'add-static-image': [];
  'add-dynamic-image': [];
  'add-qrcode': [];
  'add-barcode': [];
  undo: [];
  redo: [];
  delete: [];
  copy: [];
  paste: [];
  duplicate: [];
  'bring-forward': [];
  'send-backward': [];
  'bring-front': [];
  'send-back': [];
  'align-left': [];
  'align-center': [];
  'align-right': [];
  'align-top': [];
  'align-middle': [];
  'align-bottom': [];
  'toggle-lock': [];
  'apply-starter-template': [kind: StarterTemplateKind];
}>();

const activeAssetTab = ref<'my' | 'public' | 'templates'>('my');
</script>

<template>
  <div class="toolbar-actions">
    <div class="asset-tabs" aria-label="素材分类">
      <button :class="{ active: activeAssetTab === 'my' }" @click="activeAssetTab = 'my'">我的元素</button>
      <button :class="{ active: activeAssetTab === 'public' }" @click="activeAssetTab = 'public'">公共元素</button>
      <button :class="{ active: activeAssetTab === 'templates' }" @click="activeAssetTab = 'templates'">固定模板</button>
    </div>

    <div class="toolbar-group create-group">
      <span class="toolbar-group-label">
        {{ activeAssetTab === 'my' ? '数据绑定组件' : activeAssetTab === 'public' ? '基础绘制组件' : '一键套用版式' }}
      </span>

      <template v-if="activeAssetTab === 'public'">
      <button class="tool-btn" title="添加矩形框" aria-label="添加矩形框" @click="emit('add-rect')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="10" stroke="currentColor" stroke-width="1.5" fill="none" />
        </svg>
        <span>矩形框</span>
      </button>
      <button class="tool-btn" title="添加直线" aria-label="添加直线" @click="emit('add-line')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <span>直线</span>
      </button>
      <button class="tool-btn" title="添加固定文本或绑定文本字段" aria-label="添加文本" @click="emit('add-text')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <text x="3" y="13" font-size="13" font-weight="bold" fill="currentColor" font-family="sans-serif">T</text>
        </svg>
        <span>文本</span>
      </button>
      <button class="tool-btn" title="添加图片框，可在右侧上传图片或输入 URL" aria-label="添加上传图片框" @click="emit('add-static-image')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="10" stroke="currentColor" stroke-width="1.5" fill="none" />
          <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" />
          <path d="M2 11 L6 7 L9 10 L11 8 L14 11 L14 13 L2 13 Z" fill="currentColor" opacity="0.4" />
        </svg>
        <span>上传图片</span>
      </button>
      </template>

      <template v-else-if="activeAssetTab === 'my'">
      <button class="tool-btn" title="添加价格组件，绑定 price 字段" aria-label="添加价格组件" @click="emit('add-price')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <text x="1" y="13" font-size="13" font-weight="bold" fill="currentColor" font-family="sans-serif">¥</text>
        </svg>
        <span>价格</span>
      </button>
      <button class="tool-btn" title="添加折扣组件，绑定 discount 字段" aria-label="添加折扣组件" @click="emit('add-discount')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <text x="1" y="13" font-size="11" font-weight="bold" fill="currentColor" font-family="sans-serif">%</text>
        </svg>
        <span>折扣</span>
      </button>
      <button class="tool-btn" title="添加动态图片，绑定 imageUrl 字段" aria-label="添加动态图片字段" @click="emit('add-dynamic-image')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="10" stroke="currentColor" stroke-width="1.5" fill="none" />
          <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" />
          <path d="M2 11 L6 7 L9 10 L11 8 L14 11 L14 13 L2 13 Z" fill="currentColor" opacity="0.4" />
          <circle cx="12.5" cy="3.5" r="2.5" fill="#4fc3f7" />
          <text x="11" y="4.8" font-size="4" fill="white" font-family="sans-serif">D</text>
        </svg>
        <span>图片字段</span>
      </button>
      <button class="tool-btn" title="添加二维码，绑定 qrContent 字段" aria-label="添加二维码" @click="emit('add-qrcode')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="5" height="5" stroke="currentColor" stroke-width="1.2" fill="none" />
          <rect x="2.5" y="2.5" width="2" height="2" fill="currentColor" />
          <rect x="10" y="1" width="5" height="5" stroke="currentColor" stroke-width="1.2" fill="none" />
          <rect x="11.5" y="2.5" width="2" height="2" fill="currentColor" />
          <rect x="1" y="10" width="5" height="5" stroke="currentColor" stroke-width="1.2" fill="none" />
          <rect x="2.5" y="11.5" width="2" height="2" fill="currentColor" />
          <rect x="10" y="10" width="2" height="2" fill="currentColor" />
          <rect x="13" y="13" width="2" height="2" fill="currentColor" />
        </svg>
        <span>二维码</span>
      </button>
      <button class="tool-btn" title="添加条形码，绑定 barcodeContent 字段" aria-label="添加条形码" @click="emit('add-barcode')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2" width="1.5" height="12" fill="currentColor" />
          <rect x="3.5" y="2" width="0.8" height="12" fill="currentColor" />
          <rect x="5" y="2" width="2" height="12" fill="currentColor" />
          <rect x="8" y="2" width="0.5" height="12" fill="currentColor" />
          <rect x="9.5" y="2" width="1.5" height="12" fill="currentColor" />
          <rect x="12" y="2" width="0.8" height="12" fill="currentColor" />
          <rect x="13.5" y="2" width="1.5" height="12" fill="currentColor" />
        </svg>
        <span>条形码</span>
      </button>
      </template>

      <template v-else>
      <button class="tool-btn template-btn" title="商品名称 + 价格 + 折扣 + 条码" @click="emit('apply-starter-template', 'retail')">
        <span class="template-mark">价</span>
        <span>零售价签模板</span>
      </button>
      <button class="tool-btn template-btn" title="商品名称 + 条形码 + 二维码" @click="emit('apply-starter-template', 'barcode')">
        <span class="template-mark">码</span>
        <span>条码追踪模板</span>
      </button>
      <button class="tool-btn template-btn" title="商品名称 + 二维码 + 折扣" @click="emit('apply-starter-template', 'qr')">
        <span class="template-mark">券</span>
        <span>扫码促销模板</span>
      </button>
      <p class="template-hint">套用固定模板会先清空当前画布。</p>
      </template>
    </div>

    <div class="toolbar-group utility-group">
      <span class="toolbar-group-label">编辑操作</span>
      <button class="tool-btn compact" title="撤销上一步操作 (Cmd/Ctrl+Z)" :disabled="!props.canUndo" @click="emit('undo')">撤销</button>
      <button class="tool-btn compact" title="重做刚撤销的操作 (Shift+Cmd/Ctrl+Z 或 Cmd/Ctrl+Y)" :disabled="!props.canRedo" @click="emit('redo')">重做</button>
      <button class="tool-btn compact" title="删除选中的元素 (Delete/Backspace)" :disabled="!props.hasSelection" @click="emit('delete')">删除</button>
      <button class="tool-btn compact" title="复制选中的元素 (Cmd/Ctrl+C)" :disabled="!props.hasSelection" @click="emit('copy')">复制</button>
      <button class="tool-btn compact" title="粘贴已复制的元素 (Cmd/Ctrl+V)" :disabled="!props.hasClipboard" @click="emit('paste')">粘贴</button>
      <button class="tool-btn compact" title="立即复制一份选中元素 (Cmd/Ctrl+D)" :disabled="!props.hasSelection" @click="emit('duplicate')">复制一份</button>
      <button
        :class="['tool-btn', 'compact', { active: props.isSelectionLocked }]"
        :title="props.isSelectionLocked ? '解锁选中对象' : '锁定选中对象'"
        :disabled="!props.hasSelection"
        @click="emit('toggle-lock')"
      >
        {{ props.isSelectionLocked ? '解锁' : '锁定' }}
      </button>
    </div>

    <div class="toolbar-group utility-group">
      <span class="toolbar-group-label">层级顺序</span>
      <button class="tool-btn compact" title="让选中元素向前移动一层" :disabled="!props.hasSelection" @click="emit('bring-forward')">前移一层</button>
      <button class="tool-btn compact" title="让选中元素向后移动一层" :disabled="!props.hasSelection" @click="emit('send-backward')">后移一层</button>
      <button class="tool-btn compact" title="让选中元素显示在最上层" :disabled="!props.hasSelection" @click="emit('bring-front')">置于顶层</button>
      <button class="tool-btn compact" title="让选中元素显示在最底层，仍保留在画布背景上方" :disabled="!props.hasSelection" @click="emit('send-back')">置于底层</button>
    </div>

    <div class="toolbar-group utility-group">
      <span class="toolbar-group-label">对齐位置</span>
      <button class="tool-btn compact" title="单选时对齐到画布左侧，多选时对齐到选区左侧" :disabled="!props.hasSelection" @click="emit('align-left')">左对齐</button>
      <button class="tool-btn compact" title="单选时水平居中到画布，多选时水平居中到选区" :disabled="!props.hasSelection" @click="emit('align-center')">水平居中</button>
      <button class="tool-btn compact" title="单选时对齐到画布右侧，多选时对齐到选区右侧" :disabled="!props.hasSelection" @click="emit('align-right')">右对齐</button>
      <button class="tool-btn compact" title="单选时对齐到画布顶部，多选时对齐到选区顶部" :disabled="!props.hasSelection" @click="emit('align-top')">顶部对齐</button>
      <button class="tool-btn compact" title="单选时垂直居中到画布，多选时垂直居中到选区" :disabled="!props.hasSelection" @click="emit('align-middle')">垂直居中</button>
      <button class="tool-btn compact" title="单选时对齐到画布底部，多选时对齐到选区底部" :disabled="!props.hasSelection" @click="emit('align-bottom')">底部对齐</button>
    </div>
  </div>
</template>

<style scoped>
.toolbar-actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  height: 100%;
  overflow-y: auto;
  padding: 0 7px 12px;
}

.asset-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 0 0 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.asset-tabs button {
  min-width: 0;
  min-height: 30px;
  padding: 5px 4px;
  color: #aaa297;
  background: rgba(0, 0, 0, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9px;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.asset-tabs button.active,
.asset-tabs button:hover {
  color: #fff2ba;
  border-color: rgba(240, 211, 91, 0.48);
  background: rgba(240, 211, 91, 0.14);
}

.toolbar-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 0 0 10px;
  border-right: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.create-group {
  grid-template-columns: 1fr;
}

.utility-group {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.toolbar-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.toolbar-group-label {
  grid-column: 1 / -1;
  color: #8f887d;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.tool-btn {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 7px;
  min-height: 38px;
  padding: 7px 8px;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.15;
  background: linear-gradient(180deg, rgba(65, 66, 66, 0.96), rgba(39, 40, 41, 0.96));
  color: #ddd5ca;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, background 0.15s, color 0.15s;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.tool-btn svg {
  width: 18px;
  height: 18px;
}

.template-btn {
  min-height: 48px;
}

.template-mark {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #17130a;
  background: #f0d35b;
  font-size: 12px;
  font-weight: 900;
}

.template-hint {
  margin: 0;
  color: #8f887d;
  font-size: 10px;
  line-height: 1.45;
}

.tool-btn:hover {
  transform: translateY(-1px);
  background: linear-gradient(180deg, rgba(83, 84, 83, 0.96), rgba(47, 48, 48, 0.96));
  border-color: rgba(240, 211, 91, 0.32);
  color: #fff7df;
}

.tool-btn.compact {
  justify-content: center;
  min-width: 0;
  min-height: 32px;
  padding: 6px 4px;
  font-size: 10px;
  text-align: center;
  white-space: normal;
}

.tool-btn.active {
  background: rgba(240, 211, 91, 0.15);
  border-color: rgba(240, 211, 91, 0.56);
  color: #fff2ba;
}

.tool-btn:disabled {
  opacity: 0.34;
  cursor: not-allowed;
}

.tool-btn:disabled:hover {
  transform: none;
  background: linear-gradient(180deg, rgba(65, 66, 66, 0.96), rgba(39, 40, 41, 0.96));
  border-color: rgba(255, 255, 255, 0.09);
  color: #ddd5ca;
}
</style>
