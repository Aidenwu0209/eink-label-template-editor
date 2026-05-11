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
  return `${modeLabel} | ${config.canvas.width}×${config.canvas.height} | ${p.displayName}`;
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
  const size = workspaceSize.value;
  const availWidth = Math.max(1, size.width - 96);
  const availHeight = Math.max(1, size.height - 96);
  const scaleX = availWidth / config.canvas.width;
  const scaleY = availHeight / config.canvas.height;
  return Math.min(scaleX, scaleY, 3);
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

const previewScale = computed(() => {
  const maxWidth = 252;
  const maxHeight = 188;
  const scaleX = maxWidth / config.canvas.width;
  const scaleY = maxHeight / (config.canvas.height + 34);
  return Math.min(scaleX, scaleY, 1);
});

const previewContainerStyle = computed(() => ({
  width: config.canvas.width * previewScale.value + 'px',
  height: (config.canvas.height + 34) * previewScale.value + 'px',
}));

const previewTransformStyle = computed(() => ({
  transform: `scale(${previewScale.value})`,
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
    <header class="editor-topbar">
      <div class="toolbar-left">
        <span class="app-badge">ESL</span>
        <div>
          <span class="toolbar-title">电子墨水模板编辑器</span>
          <span class="toolbar-subtitle">电子价签模板设计工作台</span>
        </div>
      </div>
      <div class="document-tabs">
        <span class="document-tab active">{{ config.templateName || '未命名模板' }}</span>
        <span class="screen-info">{{ screenInfo }}</span>
      </div>
      <div class="toolbar-right">
        <div class="zoom-controls" aria-label="画布缩放控制">
          <button class="toolbar-btn compact" title="将画布缩放到当前窗口可完整查看" @click="fitZoom">适应画布</button>
          <button class="toolbar-btn icon" title="缩小" @click="zoomOut">−</button>
          <span class="zoom-label">{{ zoomLabel }}</span>
          <button class="toolbar-btn icon" title="放大" @click="zoomIn">+</button>
          <button class="toolbar-btn compact" title="重置为 100%" @click="resetZoom">100%</button>
          <button
            :class="['toolbar-btn', 'compact', { active: showGrid }]"
            :title="showGrid ? '隐藏画布网格辅助线' : '显示画布网格辅助线'"
            @click="showGrid = !showGrid"
          >
            {{ showGrid ? '隐藏网格' : '显示网格' }}
          </button>
        </div>
        <button class="toolbar-btn primary" :disabled="editorStore.isSaving" @click="handleSave">
          {{ editorStore.isSaving ? '保存中...' : '保存' }}
        </button>
      </div>
    </header>

    <main class="editor-shell">
      <aside class="toolbox-panel">
        <div class="panel-caption">添加与编辑</div>
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
      </aside>

      <section class="editor-stage">
        <div class="stage-options">
          <div>
            <span class="stage-title">编辑画布</span>
            <span class="stage-meta">{{ config.canvas.width }} × {{ config.canvas.height }} px</span>
          </div>
          <span class="stage-hint">选中元素后在右侧调整属性；拖拽元素排版；预览会实时刷新</span>
        </div>

        <div ref="workspaceRef" class="stage-viewport">
          <div class="canvas-shadow" :style="scaledContainerStyle">
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
        </div>
      </section>

      <aside class="inspector-dock">
        <section class="dock-panel preview-dock">
          <div class="dock-title-row">
            <span>电子墨水屏预览</span>
            <span class="dock-kicker">实时预览</span>
          </div>
          <div class="preview-stage">
            <div class="preview-scaled" :style="previewContainerStyle">
              <div :style="previewTransformStyle">
                <PreviewCanvas
                  :width="config.canvas.width"
                  :height="config.canvas.height"
                />
              </div>
            </div>
          </div>
        </section>

        <PropertiesPanel
          :selected-object="editorStore.selectedObject"
          :palette="palette"
          :custom-fields="customFields"
          @update-prop="editorStore.updateObjectProp"
        />

        <section class="dock-panel screen-dock">
          <div class="dock-title-row">
            <span>当前屏幕色板</span>
            <span class="dock-kicker">{{ palette.length }} 色</span>
          </div>
          <div class="palette-strip">
            <span
              v-for="color in palette"
              :key="color.hex"
              class="palette-dot"
              :style="{ backgroundColor: color.hex }"
              :title="`${color.name} ${color.hex}`"
            ></span>
          </div>
        </section>
      </aside>
    </main>

    <footer class="editor-statusbar">
      <span>{{ config.screen.profile.displayName }}</span>
      <span>{{ config.canvas.width }} × {{ config.canvas.height }} px</span>
      <span>{{ config.screen.profile.dpi }} DPI</span>
      <span>Delete 删除选中元素</span>
      <span>Cmd/Ctrl + D 复制一份</span>
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
  background:
    radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.06), transparent 28%),
    linear-gradient(135deg, #1b1d20 0%, #111315 48%, #08090a 100%);
  color: #ece7df;
  font-family: var(--app-font-family);
}

.editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 58px;
  padding: 0 18px 0 14px;
  background: linear-gradient(180deg, rgba(46, 48, 49, 0.98), rgba(28, 30, 31, 0.98));
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.45), 0 10px 28px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 238px;
}

.app-badge {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #f0d35b;
  color: #151515;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.28);
}

.toolbar-title {
  display: block;
  font-size: 14px;
  font-weight: 750;
  letter-spacing: 0.01em;
  color: #fff7df;
}

.toolbar-subtitle {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: #9d9a92;
}

.document-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
  margin: 0 18px;
}

.document-tab {
  min-width: 0;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px 10px 6px 6px;
  background: rgba(255, 255, 255, 0.07);
  color: #f6f0e6;
  font-size: 12px;
  font-weight: 650;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.screen-info {
  font-size: 12px;
  color: #b8b0a2;
  padding: 7px 10px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  white-space: nowrap;
}

.toolbar-btn {
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 650;
  background: rgba(255, 255, 255, 0.08);
  color: #e8e1d6;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9px;
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
  border-color: rgba(240, 211, 91, 0.55);
  color: #fff7d1;
  background: rgba(240, 211, 91, 0.14);
}

.zoom-label {
  min-width: 42px;
  text-align: center;
  font-size: 12px;
  color: #d6cec2;
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.toolbar-btn.primary {
  background: linear-gradient(180deg, #f2d765, #cba33c);
  border-color: #f4d96b;
  color: #17130a;
  box-shadow: 0 8px 20px rgba(211, 164, 50, 0.18);
}

.toolbar-btn.primary:hover {
  opacity: 0.9;
}

.editor-shell {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.toolbox-panel {
  width: 142px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: rgba(28, 29, 30, 0.96);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset -1px 0 0 rgba(0, 0, 0, 0.32);
  overflow: hidden;
}

.panel-caption {
  padding: 12px 12px 8px;
  color: #a9a197;
  font-size: 11px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  flex-shrink: 0;
}

.editor-stage {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.stage-options {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 18px;
  color: #c9c0b3;
  background: rgba(18, 19, 20, 0.76);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.stage-title {
  margin-right: 10px;
  color: #f5ede1;
  font-size: 13px;
  font-weight: 750;
}

.stage-meta,
.stage-hint {
  font-size: 12px;
  color: #918b83;
}

.stage-viewport {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 48px;
  background-color: #252525;
  background-image:
    linear-gradient(45deg, rgba(255, 255, 255, 0.035) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.035) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.035) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.035) 75%);
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
  background-size: 24px 24px;
}

.canvas-shadow {
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
}

.canvas-container {
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.76);
  border-radius: 6px;
  background: #151515;
}

.canvas-container.show-grid {
  background-color: #181818;
  background-image:
    linear-gradient(rgba(240, 211, 91, 0.11) 1px, transparent 1px),
    linear-gradient(90deg, rgba(240, 211, 91, 0.11) 1px, transparent 1px);
  background-size: 10px 10px;
}

.inspector-dock {
  width: 300px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  gap: 10px;
  padding: 10px;
  background: rgba(26, 27, 28, 0.98);
  border-left: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: inset 1px 0 0 rgba(0, 0, 0, 0.35);
}

.dock-panel {
  background: linear-gradient(180deg, rgba(56, 57, 57, 0.92), rgba(33, 34, 35, 0.94));
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 12px;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.16);
}

.dock-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  color: #f0e9de;
  font-size: 12px;
  font-weight: 750;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.dock-kicker {
  color: #a59e94;
  font-size: 11px;
  font-weight: 650;
}

.preview-stage {
  display: flex;
  justify-content: center;
  padding: 14px 12px 16px;
  overflow: hidden;
}

.preview-scaled {
  position: relative;
  flex-shrink: 0;
}

.screen-dock {
  flex-shrink: 0;
}

.palette-strip {
  display: flex;
  gap: 8px;
  padding: 12px;
}

.palette-dot {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
}

.editor-statusbar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 28px;
  padding: 0 16px;
  background: #111213;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  color: #807b73;
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

@media (max-width: 1100px) {
  .toolbar-left {
    min-width: 190px;
  }

  .document-tabs {
    margin: 0 10px;
  }

  .stage-hint {
    display: none;
  }

  .toolbox-panel {
    width: 126px;
  }

  .inspector-dock {
    width: 272px;
  }
}

@media (max-width: 820px) {
  .toolbar-subtitle,
  .document-tabs {
    display: none;
  }

  .editor-topbar {
    padding-right: 10px;
  }

  .toolbox-panel {
    width: 112px;
  }

  .inspector-dock {
    width: 248px;
  }

  .stage-viewport {
    padding: 28px;
  }
}
</style>
