<script setup lang="ts">
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
}>();
</script>

<template>
  <div class="toolbar-actions">
    <div class="toolbar-group">
      <button class="tool-btn" title="矩形" @click="emit('add-rect')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="10" stroke="currentColor" stroke-width="1.5" fill="none" />
        </svg>
        <span>矩形</span>
      </button>
      <button class="tool-btn" title="直线" @click="emit('add-line')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <span>直线</span>
      </button>
      <button class="tool-btn" title="文本" @click="emit('add-text')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <text x="3" y="13" font-size="13" font-weight="bold" fill="currentColor" font-family="sans-serif">T</text>
        </svg>
        <span>文本</span>
      </button>
      <button class="tool-btn" title="价格" @click="emit('add-price')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <text x="1" y="13" font-size="13" font-weight="bold" fill="currentColor" font-family="sans-serif">¥</text>
        </svg>
        <span>价格</span>
      </button>
      <button class="tool-btn" title="折扣" @click="emit('add-discount')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <text x="1" y="13" font-size="11" font-weight="bold" fill="currentColor" font-family="sans-serif">%</text>
        </svg>
        <span>折扣</span>
      </button>
      <button class="tool-btn" title="静态图片" @click="emit('add-static-image')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="10" stroke="currentColor" stroke-width="1.5" fill="none" />
          <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" />
          <path d="M2 11 L6 7 L9 10 L11 8 L14 11 L14 13 L2 13 Z" fill="currentColor" opacity="0.4" />
        </svg>
        <span>静态图</span>
      </button>
      <button class="tool-btn" title="动态图片" @click="emit('add-dynamic-image')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="10" stroke="currentColor" stroke-width="1.5" fill="none" />
          <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" />
          <path d="M2 11 L6 7 L9 10 L11 8 L14 11 L14 13 L2 13 Z" fill="currentColor" opacity="0.4" />
          <circle cx="12.5" cy="3.5" r="2.5" fill="#4fc3f7" />
          <text x="11" y="4.8" font-size="4" fill="white" font-family="sans-serif">D</text>
        </svg>
        <span>动态图</span>
      </button>
      <button class="tool-btn" title="二维码" @click="emit('add-qrcode')">
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
      <button class="tool-btn" title="条形码" @click="emit('add-barcode')">
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
    </div>

    <div class="toolbar-group">
      <button class="tool-btn compact" title="撤销 (Cmd/Ctrl+Z)" :disabled="!props.canUndo" @click="emit('undo')">撤</button>
      <button class="tool-btn compact" title="重做 (Shift+Cmd/Ctrl+Z 或 Cmd/Ctrl+Y)" :disabled="!props.canRedo" @click="emit('redo')">重</button>
      <button class="tool-btn compact" title="删除 (Delete/Backspace)" :disabled="!props.hasSelection" @click="emit('delete')">删</button>
      <button class="tool-btn compact" title="复制 (Cmd/Ctrl+C)" :disabled="!props.hasSelection" @click="emit('copy')">复制</button>
      <button class="tool-btn compact" title="粘贴 (Cmd/Ctrl+V)" :disabled="!props.hasClipboard" @click="emit('paste')">粘贴</button>
      <button class="tool-btn compact" title="复制一份 (Cmd/Ctrl+D)" :disabled="!props.hasSelection" @click="emit('duplicate')">副本</button>
      <button
        :class="['tool-btn', 'compact', { active: props.isSelectionLocked }]"
        :title="props.isSelectionLocked ? '解锁选中对象' : '锁定选中对象'"
        :disabled="!props.hasSelection"
        @click="emit('toggle-lock')"
      >
        {{ props.isSelectionLocked ? '解锁' : '锁定' }}
      </button>
    </div>

    <div class="toolbar-group">
      <button class="tool-btn compact" title="上移一层" :disabled="!props.hasSelection" @click="emit('bring-forward')">上移</button>
      <button class="tool-btn compact" title="下移一层" :disabled="!props.hasSelection" @click="emit('send-backward')">下移</button>
      <button class="tool-btn compact" title="置顶" :disabled="!props.hasSelection" @click="emit('bring-front')">置顶</button>
      <button class="tool-btn compact" title="置底" :disabled="!props.hasSelection" @click="emit('send-back')">置底</button>
    </div>

    <div class="toolbar-group">
      <button class="tool-btn compact" title="左对齐" :disabled="!props.hasSelection" @click="emit('align-left')">左</button>
      <button class="tool-btn compact" title="水平居中对齐" :disabled="!props.hasSelection" @click="emit('align-center')">水平中</button>
      <button class="tool-btn compact" title="右对齐" :disabled="!props.hasSelection" @click="emit('align-right')">右</button>
      <button class="tool-btn compact" title="顶对齐" :disabled="!props.hasSelection" @click="emit('align-top')">顶</button>
      <button class="tool-btn compact" title="垂直居中对齐" :disabled="!props.hasSelection" @click="emit('align-middle')">垂直中</button>
      <button class="tool-btn compact" title="底对齐" :disabled="!props.hasSelection" @click="emit('align-bottom')">底</button>
    </div>
  </div>
</template>

<style scoped>
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  overflow-x: auto;
  padding-bottom: 2px;
}

.toolbar-group {
  display: flex;
  gap: 4px;
  padding-right: 8px;
  border-right: 1px solid #333;
  flex-shrink: 0;
}

.toolbar-group:last-child {
  border-right: none;
  padding-right: 0;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  background: #2a2a2a;
  color: #ccc;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.tool-btn:hover {
  background: #3a3a3a;
  color: #fff;
}

.tool-btn.compact {
  justify-content: center;
  min-width: 28px;
  padding: 4px 8px;
}

.tool-btn.active {
  background: #34424d;
  border-color: #567184;
  color: #fff;
}

.tool-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.tool-btn:disabled:hover {
  background: #2a2a2a;
  color: #ccc;
}
</style>
