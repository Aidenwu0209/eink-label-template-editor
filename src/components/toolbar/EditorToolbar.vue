<script setup lang="ts">
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
}>();
</script>

<template>
  <div class="toolbar-actions">
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
</template>

<style scoped>
.toolbar-actions {
  display: flex;
  gap: 4px;
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
}

.tool-btn:hover {
  background: #3a3a3a;
  color: #fff;
}
</style>
