<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useEditorStore } from '@/stores/editorStore';
import type { EditorCore } from '@/core/EditorCore';

const props = defineProps<{
  width: number;
  height: number;
}>();

const canvasRef = ref<HTMLCanvasElement>();
const editorStore = useEditorStore();
const isRendering = ref(false);
let detachPreviewListeners: (() => void) | null = null;

function updatePreview(imageData: ImageData) {
  const ctx = canvasRef.value?.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(imageData, 0, 0);
  isRendering.value = false;
}

function bindPreviewListeners(editor: EditorCore | null) {
  detachPreviewListeners?.();
  detachPreviewListeners = null;

  if (!editor) return;

  const handleCanvasRendered = () => {
    isRendering.value = true;
  };

  editor.events.on('eink:preview-updated', updatePreview);
  editor.events.on('canvas:rendered', handleCanvasRendered);
  detachPreviewListeners = () => {
    editor.events.off('eink:preview-updated', updatePreview);
    editor.events.off('canvas:rendered', handleCanvasRendered);
  };

  // Trigger an initial render after listeners are attached so the preview
  // reflects the current canvas state even when the editor was created first.
  editor.requestRender();
}

watch(
  () => editorStore.editor,
  (editor) => {
    bindPreviewListeners(editor);
  },
  { immediate: true }
);

onUnmounted(() => {
  detachPreviewListeners?.();
  detachPreviewListeners = null;
});
</script>

<template>
  <div class="preview-canvas-wrapper">
    <div class="preview-header">
      <span class="preview-title">E-ink 预览</span>
      <span v-if="isRendering" class="preview-badge">渲染中...</span>
    </div>
    <canvas
      ref="canvasRef"
      :width="props.width"
      :height="props.height"
      class="preview-canvas"
    ></canvas>
  </div>
</template>

<style scoped>
.preview-canvas-wrapper {
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  overflow: hidden;
  background: #1a1a1a;
  display: inline-block;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #242424;
  border-bottom: 1px solid #333;
}

.preview-title {
  font-size: 12px;
  color: #aaa;
  font-weight: 500;
}

.preview-badge {
  font-size: 11px;
  color: #f0a030;
  animation: pulse 1s infinite;
}

.preview-canvas {
  display: block;
  image-rendering: pixelated;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
