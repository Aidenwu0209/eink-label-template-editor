<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useScreenStore } from '@/stores/screenStore';
import { useEditorStore } from '@/stores/editorStore';
import FabricCanvas from '@/components/canvas/FabricCanvas.vue';
import PreviewCanvas from '@/components/canvas/PreviewCanvas.vue';
import EditorToolbar from '@/components/toolbar/EditorToolbar.vue';
import PropertiesPanel from '@/components/panel/PropertiesPanel.vue';
import { getValidCustomFieldIdsFromPreviewData } from '@/fields';

const screenStore = useScreenStore();
const editorStore = useEditorStore();
const config = screenStore.bootConfig!;
const fabricCanvasRef = ref<InstanceType<typeof FabricCanvas>>();
const workspaceRef = ref<HTMLElement>();
const workspaceSize = ref({ width: 0, height: 0 });
const manualZoom = ref<number | null>(null);
const showGrid = ref(true);

const screenInfo = computed(() => {
  const p = config.screen.profile;
  const modeLabel = config.mode === 'edit' ? '编辑' : '新建';
  return `${modeLabel} | ${config.canvas.width}×${config.canvas.height} | ${p.palette.length} 色`;
});

const palette = computed(() => editorStore.getPalette());
const customFields = computed(() => {
  return getValidCustomFieldIdsFromPreviewData(config.previewData);
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

function updateWorkspaceSize() {
  const el = workspaceRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  workspaceSize.value = { width: rect.width, height: rect.height };
}

function setZoom(next: number) {
  manualZoom.value = Math.min(4, Math.max(0.1, Number(next.toFixed(2))));
}

function zoomIn() {
  setZoom(canvasScale.value + 0.1);
}

function zoomOut() {
  setZoom(canvasScale.value - 0.1);
}

function resetZoom() {
  setZoom(1);
}

function fitZoom() {
  manualZoom.value = null;
  updateWorkspaceSize();
}

function isEditableKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || ['input', 'textarea', 'select'].includes(tagName);
}

function handleEditorKeydown(event: KeyboardEvent): void {
  if (isEditableKeyTarget(event.target)) return;

  const key = event.key.toLowerCase();
  const isModifierPressed = event.metaKey || event.ctrlKey;

  if (!isModifierPressed && !event.altKey && (key === 'delete' || key === 'backspace')) {
    event.preventDefault();
    editorStore.deleteSelected();
    return;
  }

  if (!isModifierPressed) return;

  if (key === 'z' && event.shiftKey) {
    event.preventDefault();
    void editorStore.redo();
  } else if (key === 'z') {
    event.preventDefault();
    void editorStore.undo();
  } else if (key === 'y') {
    event.preventDefault();
    void editorStore.redo();
  } else if (key === 'c') {
    event.preventDefault();
    editorStore.copySelected();
  } else if (key === 'v') {
    event.preventDefault();
    void editorStore.pasteClipboard();
  } else if (key === 'd') {
    event.preventDefault();
    void editorStore.duplicateSelected();
  }
}

onMounted(async () => {
  await nextTick();
  updateWorkspaceSize();
  window.addEventListener('resize', updateWorkspaceSize);

  const canvasEl = (fabricCanvasRef.value as any)?.canvasElement as HTMLCanvasElement;
  if (!canvasEl) {
    console.error('[EditorView] Canvas element not found');
    return;
  }

  editorStore.initEditor(canvasEl, config);

  if (config.template) {
    await editorStore.loadTemplate(config.template.data);
  }

  window.addEventListener('keydown', handleEditorKeydown);
});

const fitScale = computed(() => {
  const panelCount = 2;
  const gap = 16;
  const propertiesWidth = 220;
  const horizontalPadding = 32;
  const headerHeight = 32;
  const size = workspaceSize.value;
  const availWidth = Math.max(1, (size.width - propertiesWidth - horizontalPadding - gap * panelCount) / panelCount);
  const availHeight = Math.max(1, size.height - headerHeight - 24);
  const scaleX = availWidth / config.canvas.width;
  const scaleY = availHeight / config.canvas.height;
  return Math.min(scaleX, scaleY, 1);
});

const canvasScale = computed(() => manualZoom.value ?? fitScale.value);

const zoomLabel = computed(() => `${Math.round(canvasScale.value * 100)}%`);

const scaledContainerStyle = computed(() => ({
  width: config.canvas.width * canvasScale.value + 'px',
  height: config.canvas.height * canvasScale.value + 'px',
}));

const canvasTransformStyle = computed(() => ({
  transform: `scale(${canvasScale.value})`,
  transformOrigin: 'top left',
}));

onUnmounted(() => {
  window.removeEventListener('resize', updateWorkspaceSize);
  window.removeEventListener('keydown', handleEditorKeydown);
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
          :can-undo="editorStore.canUndo"
          :can-redo="editorStore.canRedo"
          :has-selection="editorStore.hasActiveSelection"
          :has-clipboard="editorStore.hasClipboard"
          :is-selection-locked="editorStore.isActiveSelectionLocked"
          @add-rect="editorStore.addRect()"
          @add-line="editorStore.addLine()"
          @add-text="editorStore.addText()"
          @add-price="editorStore.addPrice()"
          @add-discount="editorStore.addDiscount()"
          @add-static-image="editorStore.addStaticImage()"
          @add-dynamic-image="editorStore.addDynamicImage()"
          @add-qrcode="editorStore.addQrcode()"
          @add-barcode="editorStore.addBarcode()"
          @undo="editorStore.undo()"
          @redo="editorStore.redo()"
          @delete="editorStore.deleteSelected()"
          @copy="editorStore.copySelected()"
          @paste="editorStore.pasteClipboard()"
          @duplicate="editorStore.duplicateSelected()"
          @bring-forward="editorStore.bringSelectedForward()"
          @send-backward="editorStore.sendSelectedBackward()"
          @bring-front="editorStore.bringSelectedToFront()"
          @send-back="editorStore.sendSelectedToBack()"
          @align-left="editorStore.alignSelectedHorizontal('left')"
          @align-center="editorStore.alignSelectedHorizontal('center')"
          @align-right="editorStore.alignSelectedHorizontal('right')"
          @align-top="editorStore.alignSelectedVertical('top')"
          @align-middle="editorStore.alignSelectedVertical('middle')"
          @align-bottom="editorStore.alignSelectedVertical('bottom')"
          @toggle-lock="editorStore.toggleLockSelected()"
        />
      </div>
      <div class="toolbar-right">
        <div class="zoom-controls" aria-label="画布缩放控制">
          <button class="toolbar-btn compact" title="适配窗口" @click="fitZoom">适配</button>
          <button class="toolbar-btn icon" title="缩小" @click="zoomOut">−</button>
          <span class="zoom-label">{{ zoomLabel }}</span>
          <button class="toolbar-btn icon" title="放大" @click="zoomIn">+</button>
          <button class="toolbar-btn compact" title="重置为 100%" @click="resetZoom">100%</button>
          <button
            :class="['toolbar-btn', 'compact', { active: showGrid }]"
            title="显示或隐藏网格"
            @click="showGrid = !showGrid"
          >
            网格
          </button>
        </div>
        <span class="screen-info">{{ screenInfo }}</span>
        <button class="toolbar-btn primary" :disabled="editorStore.isSaving" @click="handleSave">
          {{ editorStore.isSaving ? '保存中...' : '保存' }}
        </button>
      </div>
    </header>

    <!-- Main workspace -->
    <main ref="workspaceRef" class="editor-workspace">
      <div class="canvas-panel edit-panel">
        <div class="panel-header">编辑画布</div>
        <div :class="['canvas-container', { 'show-grid': showGrid }]" :style="scaledContainerStyle">
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

.toolbar-left,
.toolbar-right {
  flex: 0 0 auto;
}

.toolbar-center {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
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

.toolbar-btn.compact {
  padding: 5px 8px;
}

.toolbar-btn.icon {
  width: 28px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}

.toolbar-btn.active {
  border-color: #4fc3f7;
  color: #fff;
  background: #263947;
}

.zoom-label {
  min-width: 42px;
  text-align: center;
  font-size: 12px;
  color: #aaa;
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

.canvas-container.show-grid {
  background-color: #1a1a1a;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 10px 10px;
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
