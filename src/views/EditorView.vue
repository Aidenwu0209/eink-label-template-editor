<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useScreenStore } from '@/stores/screenStore';
import { useEditorStore } from '@/stores/editorStore';
import FabricCanvas from '@/components/canvas/FabricCanvas.vue';
import PreviewCanvas from '@/components/canvas/PreviewCanvas.vue';
import EditorToolbar from '@/components/toolbar/EditorToolbar.vue';
import PropertiesPanel from '@/components/panel/PropertiesPanel.vue';
import { SYSTEM_FIELDS } from '@/fields';

const screenStore = useScreenStore();
const editorStore = useEditorStore();
const config = screenStore.bootConfig!;
const fabricCanvasRef = ref<InstanceType<typeof FabricCanvas>>();

const screenInfo = computed(() => {
  const p = config.screen.profile;
  const modeLabel = config.mode === 'edit' ? '编辑' : '新建';
  return `${modeLabel} | ${config.canvas.width}×${config.canvas.height} | ${p.palette.length} 色`;
});

const palette = computed(() => editorStore.getPalette());
const customFields = computed(() => {
  const data = config.previewData ?? {};
  return Object.keys(data).filter(
    (key) => !SYSTEM_FIELDS.includes(key as any) && typeof data[key] === 'string'
  );
});

const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null);

async function handleSave() {
  try {
    saveMessage.value = null;
    const payload = await editorStore.save();
    saveMessage.value = { type: 'success', text: `保存成功：${payload.templateId}` };
    setTimeout(() => { saveMessage.value = null; }, 3000);
  } catch (err: any) {
    saveMessage.value = { type: 'error', text: `保存失败：${err.message ?? '未知错误'}` };
  }
}

onMounted(async () => {
  const canvasEl = (fabricCanvasRef.value as any)?.canvasElement as HTMLCanvasElement;
  if (!canvasEl) {
    console.error('[EditorView] Canvas element not found');
    return;
  }

  editorStore.initEditor(canvasEl, config);

  if (config.template) {
    await editorStore.editor!.loadTemplate(config.template.data);
  }
});

const canvasScale = computed(() => {
  const availWidth = (window.innerWidth * 0.38) - 32;
  const availHeight = window.innerHeight - 140;
  const scaleX = availWidth / config.canvas.width;
  const scaleY = availHeight / config.canvas.height;
  return Math.min(scaleX, scaleY, 1);
});

const scaledContainerStyle = computed(() => ({
  width: config.canvas.width * canvasScale.value + 'px',
  height: config.canvas.height * canvasScale.value + 'px',
}));

const canvasTransformStyle = computed(() => ({
  transform: `scale(${canvasScale.value})`,
  transformOrigin: 'top left',
}));

onUnmounted(() => {
  editorStore.dispose();
});
</script>

<template>
  <div class="editor-layout">
    <!-- Toolbar -->
    <header class="editor-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">E-ink Template Editor</span>
      </div>
      <div class="toolbar-center">
        <EditorToolbar
          @add-rect="editorStore.addRect()"
          @add-line="editorStore.addLine()"
          @add-text="editorStore.addText()"
          @add-price="editorStore.addPrice()"
          @add-discount="editorStore.addDiscount()"
          @add-static-image="editorStore.addStaticImage()"
          @add-dynamic-image="editorStore.addDynamicImage()"
          @add-qrcode="editorStore.addQrcode()"
          @add-barcode="editorStore.addBarcode()"
        />
      </div>
      <div class="toolbar-right">
        <span class="screen-info">{{ screenInfo }}</span>
        <button class="toolbar-btn primary" :disabled="editorStore.isSaving" @click="handleSave">
          {{ editorStore.isSaving ? '保存中...' : '保存' }}
        </button>
      </div>
    </header>

    <!-- Main workspace -->
    <main class="editor-workspace">
      <div class="canvas-panel edit-panel">
        <div class="panel-header">编辑画布</div>
        <div class="canvas-container" :style="scaledContainerStyle">
          <div :style="canvasTransformStyle">
            <FabricCanvas
              ref="fabricCanvasRef"
              :width="config.canvas.width"
              :height="config.canvas.height"
            />
          </div>
        </div>
      </div>

      <div class="canvas-panel preview-panel">
        <div class="preview-scaled" :style="scaledContainerStyle">
          <div :style="canvasTransformStyle">
            <PreviewCanvas
              :width="config.canvas.width"
              :height="config.canvas.height"
            />
          </div>
        </div>
      </div>

      <!-- Properties Panel -->
      <PropertiesPanel
        :selected-object="editorStore.selectedObject"
        :palette="palette"
        :custom-fields="customFields"
        @update-prop="editorStore.updateObjectProp"
      />
    </main>

    <!-- Status bar -->
    <footer class="editor-statusbar">
      <span>{{ config.screen.type.toUpperCase() }}</span>
      <span>{{ config.canvas.width }} × {{ config.canvas.height }} px</span>
      <span>{{ config.screen.profile.dpi }} DPI</span>
      <span v-if="saveMessage" :class="['save-message', saveMessage.type]">
        {{ saveMessage.text }}
      </span>
    </footer>
  </div>
</template>

<style scoped>
.editor-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #111;
  color: #e0e0e0;
  font-family: 'Inter', system-ui, sans-serif;
}

/* Toolbar */
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
  flex-shrink: 0;
}

.toolbar-title {
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(90deg, #64b5f6, #ce93d8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.screen-info {
  font-size: 12px;
  color: #888;
  padding: 4px 12px;
  background: #242424;
  border-radius: 4px;
}

.toolbar-btn {
  padding: 6px 16px;
  font-size: 12px;
  background: #2a2a2a;
  color: #ccc;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: #3a3a3a;
  color: #fff;
}

.toolbar-btn.primary {
  background: linear-gradient(135deg, #1565c0, #7b1fa2);
  border: none;
  color: white;
}

.toolbar-btn.primary:hover {
  opacity: 0.9;
}

/* Workspace */
.editor-workspace {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
  justify-content: center;
  align-items: stretch;
}

.canvas-panel {
  display: flex;
  flex-direction: column;
  max-width: 38%;
  max-height: 100%;
}

.panel-header {
  font-size: 12px;
  color: #888;
  padding: 6px 12px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  flex-shrink: 0;
}

.canvas-container {
  overflow: hidden;
  border: 1px solid #2a2a2a;
  border-radius: 0 0 4px 4px;
  background: #1a1a1a;
}

.canvas-container :deep(.canvas-container) {
  transform-origin: top left;
}

/* Status bar */
.editor-statusbar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 28px;
  padding: 0 16px;
  background: #1a1a1a;
  border-top: 1px solid #2a2a2a;
  font-size: 11px;
  color: #666;
  flex-shrink: 0;
}

.save-message {
  margin-left: auto;
  font-weight: 600;
}
.save-message.success {
  color: #4caf50;
}
.save-message.error {
  color: #f44336;
}
</style>
