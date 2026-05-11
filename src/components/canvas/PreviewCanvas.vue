<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useEditorStore } from '@/stores/editorStore';
import type { EditorCore } from '@/core/EditorCore';

const props = defineProps<{
  width: number;
  height: number;
  showHeader?: boolean;
}>();

const canvasRef = ref<HTMLCanvasElement>();
const editorStore = useEditorStore();
const isRendering = ref(false);
let detachPreviewListeners: (() => void) | null = null;
let renderingTimeout: ReturnType<typeof setTimeout> | null = null;
const RENDERING_TIMEOUT_MS = 5000;

function clearRenderingTimeout() {
  if (!renderingTimeout) return;
  clearTimeout(renderingTimeout);
  renderingTimeout = null;
}

function stopRendering() {
  clearRenderingTimeout();
  isRendering.value = false;
}

function startRendering() {
  clearRenderingTimeout();
  isRendering.value = true;
  renderingTimeout = setTimeout(() => {
    renderingTimeout = null;
    if (!isRendering.value) return;

    isRendering.value = false;
    console.warn(
      '[PreviewCanvas] E-ink preview render timed out; resetting loading state.'
    );
  }, RENDERING_TIMEOUT_MS);
}

function updatePreview(imageData: ImageData) {
  try {
    const ctx = canvasRef.value?.getContext('2d');
    if (!ctx) {
      console.warn(
        '[PreviewCanvas] Unable to draw E-ink preview: canvas is not ready.'
      );
      return;
    }
    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.warn('[PreviewCanvas] Failed to draw E-ink preview.', error);
  } finally {
    stopRendering();
  }
}

function bindPreviewListeners(editor: EditorCore | null) {
  detachPreviewListeners?.();
  detachPreviewListeners = null;
  stopRendering();

  if (!editor) return;

  const handleCanvasRendered = () => {
    startRendering();
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
  stopRendering();
});
</script>

<template>
  <div class="preview-canvas-wrapper">
    <div v-if="props.showHeader !== false" class="preview-header">
      <span class="preview-title">电子墨水预览</span>
      <span v-if="isRendering" class="preview-badge">渲染中...</span>
    </div>
    <span v-else-if="isRendering" class="preview-badge floating">渲染中...</span>
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
  position: relative;
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

.preview-badge.floating {
  position: absolute;
  top: 6px;
  right: 8px;
  z-index: 1;
  padding: 2px 5px;
  border-radius: 999px;
  background: rgba(26, 26, 26, 0.76);
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
