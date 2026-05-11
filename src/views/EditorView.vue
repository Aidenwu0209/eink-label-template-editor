<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { useScreenStore } from '@/stores/screenStore';
import { useEditorStore, type ToolKind } from '@/stores/editorStore';
import FabricCanvas from '@/components/canvas/FabricCanvas.vue';
import PreviewCanvas from '@/components/canvas/PreviewCanvas.vue';
import EditorToolbar from '@/components/toolbar/EditorToolbar.vue';
import PropertiesPanel from '@/components/panel/PropertiesPanel.vue';
import { getValidCustomFieldIdsFromPreviewData } from '@/fields';
import type { FabricJSON } from '@/boot/types';

type LocalTemplateRecord = {
  id: string;
  name: string;
  createdAt: string;
  width: number;
  height: number;
  data: FabricJSON;
};

type InspectorTab = 'properties' | 'layers' | 'palette';

const LOCAL_TEMPLATE_STORAGE_KEY = 'eink-label-template-editor.localTemplates.v1';
const TOOLBOX_WIDTH_STORAGE_KEY = 'eink-label-template-editor.toolboxWidth.v1';
const TOOLBOX_COLLAPSED_STORAGE_KEY = 'eink-label-template-editor.toolboxCollapsed.v1';
const RECENT_TOOLS_STORAGE_KEY = 'eink-label-template-editor.recentTools.v1';
const TOOL_DRAG_MIME = 'application/x-eink-tool';
const TOOLBOX_DEFAULT_WIDTH = 220;
const TOOLBOX_COMPACT_WIDTH = 176;
const TOOLBOX_MIN_WIDTH = 96;
const TOOLBOX_MAX_WIDTH = 360;
const TOOLBOX_COLLAPSED_WIDTH = 56;
const RECENT_TOOL_LIMIT = 6;

const screenStore = useScreenStore();
const editorStore = useEditorStore();
const config = screenStore.bootConfig!;
const fabricCanvasRef = ref<InstanceType<typeof FabricCanvas>>();
const editorShellRef = ref<HTMLElement>();
const workspaceRef = ref<HTMLElement>();
const workspaceSize = ref({ width: 0, height: 0 });
const manualZoom = ref<number | null>(null);
const previewManualZoom = ref<number | null>(null);
const showGrid = ref(true);
const savedTemplates = ref<LocalTemplateRecord[]>([]);
const recentTools = ref<ToolKind[]>([]);
const templateSelectValue = ref('');
const draggedLayerId = ref<string | null>(null);
const inspectorTab = ref<InspectorTab>('properties');
const toolboxWidth = ref(TOOLBOX_DEFAULT_WIDTH);
const isToolboxCollapsed = ref(false);
const isToolboxPeekOpen = ref(false);
const isToolboxResizing = ref(false);
const isToolDropTarget = ref(false);

const screenInfo = computed(() => {
  const p = config.screen.profile;
  const modeLabel = config.mode === 'edit' ? '编辑' : '新建';
  return `${modeLabel} | ${config.canvas.width}×${config.canvas.height} | ${p.displayName}`;
});

const palette = computed(() => editorStore.getPalette());
const customFields = computed(() => {
  return getValidCustomFieldIdsFromPreviewData(config.previewData);
});
const toolboxPanelStyle = computed(() => ({
  width: `${isToolboxCollapsed.value ? TOOLBOX_COLLAPSED_WIDTH : toolboxWidth.value}px`,
  '--toolbox-expanded-width': `${toolboxWidth.value}px`,
}));
const collapsedToolShortcuts = computed(() => {
  const fallback: ToolKind[] = ['PRICE', 'DISCOUNT', 'BARCODE', 'TEXT'];
  const ordered = [...recentTools.value, ...fallback];
  return Array.from(new Set(ordered)).slice(0, 4).map((kind) => ({
    kind,
    ...TOOL_LABELS[kind],
  }));
});

const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null);
const OBJECT_TYPE_LABELS: Record<string, string> = {
  RECT: '矩形框',
  LINE: '直线',
  TEXT: '文本',
  PRICE: '价格',
  DISCOUNT: '折扣',
  IMAGE: '图片',
  QRCODE: '二维码',
  BARCODE: '条形码',
};

const TOOL_LABELS: Record<ToolKind, { label: string; mark: string }> = {
  RECT: { label: '矩形框', mark: '□' },
  LINE: { label: '直线', mark: '/' },
  TEXT: { label: '文本', mark: 'T' },
  PRICE: { label: '价格', mark: '¥' },
  DISCOUNT: { label: '折扣', mark: '%' },
  IMAGE_STATIC: { label: '上传图片', mark: 'IMG' },
  IMAGE_DYNAMIC: { label: '图片字段', mark: 'D' },
  QRCODE: { label: '二维码', mark: 'QR' },
  BARCODE: { label: '条形码', mark: 'BAR' },
};

const selectedObjectType = computed(() => {
  const obj = editorStore.selectedObject as any;
  if (!obj) return null;
  if (typeof obj.extensionType === 'string' && obj.extensionType) return obj.extensionType;
  if (obj.type === 'rect') return 'RECT';
  if (obj.type === 'line') return 'LINE';
  return String(obj.type ?? 'OBJECT').toUpperCase();
});

const selectedObjectLabel = computed(() => {
  const type = selectedObjectType.value;
  if (!type) return editorStore.hasActiveSelection ? '多个元素' : '未选择元素';
  return OBJECT_TYPE_LABELS[type] ?? type;
});

const quickFields = computed(() => {
  const obj = editorStore.selectedObject as any;
  if (!obj) return [];
  if (obj.type === 'line') {
    return [
      { key: 'x1', label: 'X1', value: Math.round(obj.x1 ?? 0) },
      { key: 'y1', label: 'Y1', value: Math.round(obj.y1 ?? 0) },
      { key: 'x2', label: 'X2', value: Math.round(obj.x2 ?? 0) },
      { key: 'y2', label: 'Y2', value: Math.round(obj.y2 ?? 0) },
    ];
  }
  return [
    { key: 'left', label: 'X', value: Math.round(obj.left ?? 0) },
    { key: 'top', label: 'Y', value: Math.round(obj.top ?? 0) },
    { key: 'width', label: 'W', value: Math.round(obj.width ?? obj.getScaledWidth?.() ?? 0) },
    { key: 'height', label: 'H', value: Math.round(obj.height ?? obj.getScaledHeight?.() ?? 0) },
  ];
});

function updateQuickNumber(key: string, event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) return;
  void editorStore.updateObjectProp(key, value);
}

function loadLocalTemplates(): void {
  try {
    const raw = localStorage.getItem(LOCAL_TEMPLATE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    savedTemplates.value = Array.isArray(parsed) ? parsed : [];
  } catch {
    savedTemplates.value = [];
  }
}

function persistLocalTemplates(): void {
  localStorage.setItem(LOCAL_TEMPLATE_STORAGE_KEY, JSON.stringify(savedTemplates.value.slice(0, 20)));
}

function clampToolboxWidth(value: number): number {
  return Math.min(TOOLBOX_MAX_WIDTH, Math.max(TOOLBOX_MIN_WIDTH, Math.round(value)));
}

function loadEditorUiPreferences(): void {
  const storedWidth = Number(localStorage.getItem(TOOLBOX_WIDTH_STORAGE_KEY));
  if (Number.isFinite(storedWidth) && storedWidth > 0) {
    toolboxWidth.value = clampToolboxWidth(storedWidth);
  } else if (window.innerWidth <= 1100) {
    toolboxWidth.value = TOOLBOX_COMPACT_WIDTH;
  }

  const storedCollapsed = localStorage.getItem(TOOLBOX_COLLAPSED_STORAGE_KEY);
  isToolboxCollapsed.value = storedCollapsed == null
    ? window.innerWidth <= 820
    : storedCollapsed === 'true';

  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_TOOLS_STORAGE_KEY) ?? '[]');
    if (Array.isArray(parsed)) {
      recentTools.value = parsed.filter((kind): kind is ToolKind => kind in TOOL_LABELS).slice(0, RECENT_TOOL_LIMIT);
    }
  } catch {
    recentTools.value = [];
  }
}

function persistToolboxWidth(): void {
  localStorage.setItem(TOOLBOX_WIDTH_STORAGE_KEY, String(toolboxWidth.value));
}

function persistToolboxCollapsed(): void {
  localStorage.setItem(TOOLBOX_COLLAPSED_STORAGE_KEY, String(isToolboxCollapsed.value));
}

function rememberTool(kind: ToolKind): void {
  recentTools.value = [kind, ...recentTools.value.filter((item) => item !== kind)].slice(0, RECENT_TOOL_LIMIT);
  localStorage.setItem(RECENT_TOOLS_STORAGE_KEY, JSON.stringify(recentTools.value));
}

function formatTemplateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function saveLocalTemplate(): Promise<void> {
  const defaultName = config.templateName || `模板 ${new Date().toLocaleString()}`;
  const name = window.prompt('保存为我的模板', defaultName)?.trim();
  if (!name) return;

  const data = await editorStore.exportCurrentTemplate();
  const record: LocalTemplateRecord = {
    id: `local_${Date.now().toString(36)}`,
    name,
    createdAt: new Date().toISOString(),
    width: config.canvas.width,
    height: config.canvas.height,
    data,
  };
  savedTemplates.value = [record, ...savedTemplates.value.filter((item) => item.name !== name)].slice(0, 20);
  persistLocalTemplates();
  saveMessage.value = { type: 'success', text: `已保存到我的模板：${name}` };
  setTimeout(() => { saveMessage.value = null; }, 2400);
}

async function applyLocalTemplateById(event: Event): Promise<void> {
  const id = (event.target as HTMLSelectElement).value;
  templateSelectValue.value = '';
  const record = savedTemplates.value.find((item) => item.id === id);
  if (!record) return;
  await editorStore.loadTemplate(record.data);
}

function deleteLocalTemplate(id: string): void {
  savedTemplates.value = savedTemplates.value.filter((item) => item.id !== id);
  persistLocalTemplates();
}

async function handleAddTool(kind: ToolKind): Promise<void> {
  await editorStore.addElement(kind);
  rememberTool(kind);
  isToolboxPeekOpen.value = false;
}

function handleToolDragStart(kind: ToolKind, event: DragEvent): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(TOOL_DRAG_MIME, JSON.stringify({ kind }));
  event.dataTransfer.setData('text/plain', kind);
  (event.currentTarget as HTMLElement | null)?.addEventListener('dragend', () => {
    isToolDropTarget.value = false;
  }, { once: true });
}

function parseDraggedTool(event: DragEvent): ToolKind | null {
  const raw = event.dataTransfer?.getData(TOOL_DRAG_MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.kind in TOOL_LABELS) return parsed.kind;
    } catch {
      return null;
    }
  }

  const fallback = event.dataTransfer?.getData('text/plain');
  return fallback && fallback in TOOL_LABELS ? fallback as ToolKind : null;
}

function hasToolDragPayload(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? []);
  return types.includes(TOOL_DRAG_MIME);
}

function getCanvasDropPosition(event: DragEvent): { left: number; top: number } | null {
  const canvasEl = (fabricCanvasRef.value as any)?.canvasElement as HTMLCanvasElement | undefined;
  if (!canvasEl) return null;
  const rect = canvasEl.getBoundingClientRect();
  return {
    left: Math.round((event.clientX - rect.left) / canvasScale.value),
    top: Math.round((event.clientY - rect.top) / canvasScale.value),
  };
}

function handleStageDragOver(event: DragEvent): void {
  if (!hasToolDragPayload(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  isToolDropTarget.value = true;
}

function handleStageDragLeave(event: DragEvent): void {
  const target = event.currentTarget as HTMLElement | null;
  const next = event.relatedTarget as Node | null;
  if (!target || !next || !target.contains(next)) {
    isToolDropTarget.value = false;
  }
}

async function handleStageDrop(event: DragEvent): Promise<void> {
  const kind = parseDraggedTool(event);
  if (!kind) {
    isToolDropTarget.value = false;
    return;
  }
  event.preventDefault();
  isToolDropTarget.value = false;
  await editorStore.addElement(kind, getCanvasDropPosition(event) ?? undefined);
  rememberTool(kind);
  isToolboxPeekOpen.value = false;
}

function setToolboxCollapsed(next: boolean): void {
  isToolboxCollapsed.value = next;
  isToolboxPeekOpen.value = false;
  persistToolboxCollapsed();
  void nextTick(updateWorkspaceSize);
}

function openToolboxPeek(): void {
  if (isToolboxCollapsed.value) isToolboxPeekOpen.value = true;
}

function closeToolboxPeek(): void {
  if (isToolboxCollapsed.value) isToolboxPeekOpen.value = false;
}

function stopToolboxResize(): void {
  if (!isToolboxResizing.value) return;
  isToolboxResizing.value = false;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
  window.removeEventListener('mousemove', handleToolboxResizeMove);
  window.removeEventListener('mouseup', stopToolboxResize);
  persistToolboxWidth();
  void nextTick(updateWorkspaceSize);
}

function handleToolboxResizeMove(event: MouseEvent): void {
  const shellLeft = editorShellRef.value?.getBoundingClientRect().left ?? 0;
  toolboxWidth.value = clampToolboxWidth(event.clientX - shellLeft);
  updateWorkspaceSize();
}

function startToolboxResize(event: MouseEvent): void {
  if (isToolboxCollapsed.value) return;
  event.preventDefault();
  isToolboxResizing.value = true;
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
  window.addEventListener('mousemove', handleToolboxResizeMove);
  window.addEventListener('mouseup', stopToolboxResize);
}

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

function setPreviewZoom(next: number) {
  previewManualZoom.value = Math.min(4, Math.max(0.35, Number(next.toFixed(2))));
}

function previewZoomIn() {
  setPreviewZoom(previewScale.value + 0.25);
}

function previewZoomOut() {
  setPreviewZoom(previewScale.value - 0.25);
}

function resetPreviewZoom() {
  setPreviewZoom(1);
}

function fitPreviewZoom() {
  previewManualZoom.value = null;
}

function handleLayerDragStart(layerId: string, event: DragEvent): void {
  draggedLayerId.value = layerId;
  event.dataTransfer?.setData('text/plain', layerId);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
}

function handleLayerDrop(targetLayerId: string, event: DragEvent): void {
  event.preventDefault();
  const sourceId = event.dataTransfer?.getData('text/plain') || draggedLayerId.value;
  draggedLayerId.value = null;
  if (!sourceId || sourceId === targetLayerId) return;
  editorStore.moveLayerTo(sourceId, targetLayerId);
}

function handleLayerDragEnd(): void {
  draggedLayerId.value = null;
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
  loadLocalTemplates();
  loadEditorUiPreferences();
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

const gridOverlayStyle = computed(() => {
  const gridSize = Math.max(4, Math.round(10 * canvasScale.value));
  return {
    backgroundSize: `${gridSize}px ${gridSize}px`,
  };
});

const previewFitScale = computed(() => {
  const maxWidth = 252;
  const maxHeight = 112;
  const scaleX = maxWidth / config.canvas.width;
  const scaleY = maxHeight / (config.canvas.height + 34);
  return Math.min(scaleX, scaleY, 1.8);
});

const previewScale = computed(() => previewManualZoom.value ?? previewFitScale.value);
const previewZoomLabel = computed(() => `${Math.round(previewScale.value * 100)}%`);

const previewContainerStyle = computed(() => ({
  width: config.canvas.width * previewScale.value + 'px',
  height: (config.canvas.height + 34) * previewScale.value + 'px',
}));

const previewTransformStyle = computed(() => ({
  transform: `scale(${previewScale.value})`,
  transformOrigin: 'top left',
}));

watch(
  () => editorStore.selectedObject,
  (selected) => {
    if (selected) inspectorTab.value = 'properties';
  }
);

onUnmounted(() => {
  window.removeEventListener('resize', updateWorkspaceSize);
  window.removeEventListener('keydown', handleEditorKeydown);
  window.removeEventListener('mousemove', handleToolboxResizeMove);
  window.removeEventListener('mouseup', stopToolboxResize);
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
      <div class="template-actions" aria-label="模板快捷切换">
        <button class="toolbar-btn compact" title="套用零售价签固定模板" @click="editorStore.applyStarterTemplate('retail')">零售价签</button>
        <button class="toolbar-btn compact" title="套用条码追踪固定模板" @click="editorStore.applyStarterTemplate('barcode')">条码模板</button>
        <select
          v-model="templateSelectValue"
          class="template-select"
          title="打开我的模板记录"
          @change="applyLocalTemplateById"
        >
          <option value="">我的模板记录</option>
          <option v-for="item in savedTemplates" :key="item.id" :value="item.id">
            {{ item.name }} · {{ formatTemplateTime(item.createdAt) }}
          </option>
        </select>
        <button class="toolbar-btn compact" title="保存当前画布到本机模板记录" @click="saveLocalTemplate">存为模板</button>
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

    <main ref="editorShellRef" class="editor-shell">
      <aside
        :class="[
          'toolbox-panel',
          { collapsed: isToolboxCollapsed, peeking: isToolboxPeekOpen, resizing: isToolboxResizing },
        ]"
        :style="toolboxPanelStyle"
        @mouseenter="openToolboxPeek"
        @mouseleave="closeToolboxPeek"
      >
        <div v-if="isToolboxCollapsed" class="toolbox-collapsed-strip" aria-label="折叠工具栏">
          <button class="collapse-toggle" type="button" title="展开工具栏" @click="setToolboxCollapsed(false)">›</button>
          <button
            v-for="tool in collapsedToolShortcuts"
            :key="tool.kind"
            class="collapsed-tool-btn"
            type="button"
            :title="`添加${tool.label}`"
            @click="handleAddTool(tool.kind)"
          >
            <span>{{ tool.mark }}</span>
          </button>
        </div>

        <div :class="['toolbox-expanded', { floating: isToolboxCollapsed }]">
          <div class="toolbox-header">
            <div>
              <span class="panel-caption">工具抽屉</span>
              <small>{{ isToolboxCollapsed ? '临时浮出' : `${toolboxWidth}px` }}</small>
            </div>
            <button
              class="toolbox-header-btn"
              type="button"
              :title="isToolboxCollapsed ? '固定展开工具栏' : '折叠工具栏'"
              @click="setToolboxCollapsed(!isToolboxCollapsed)"
            >
              {{ isToolboxCollapsed ? '固定' : '收起' }}
            </button>
          </div>
          <EditorToolbar
            :recent-tools="recentTools"
            @add-tool="handleAddTool"
            @tool-drag-start="handleToolDragStart"
            @apply-starter-template="editorStore.applyStarterTemplate"
          />
        </div>

        <button
          v-if="!isToolboxCollapsed"
          class="toolbox-resize-handle"
          type="button"
          title="拖动调整工具栏宽度"
          @mousedown="startToolboxResize"
        ></button>
      </aside>

      <section class="editor-stage">
        <div class="stage-options">
          <div class="option-context">
            <span class="stage-title">{{ selectedObjectLabel }}</span>
            <span class="stage-meta">{{ config.canvas.width }} × {{ config.canvas.height }} px</span>
          </div>

          <div v-if="editorStore.selectedObject" class="quick-fields" aria-label="选中元素快捷属性">
            <label v-for="field in quickFields" :key="field.key" class="quick-field">
              <span>{{ field.label }}</span>
              <input
                type="number"
                :value="field.value"
                @change="updateQuickNumber(field.key, $event)"
              />
            </label>
          </div>

          <div class="option-actions" aria-label="选中元素快捷操作">
            <button class="option-btn" :disabled="!editorStore.canUndo" title="撤销" @click="editorStore.undo()">撤销</button>
            <button class="option-btn" :disabled="!editorStore.canRedo" title="重做" @click="editorStore.redo()">重做</button>
            <span class="option-divider"></span>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" title="左对齐" @click="editorStore.alignSelectedHorizontal('left')">左</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" title="水平居中" @click="editorStore.alignSelectedHorizontal('center')">中</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" title="右对齐" @click="editorStore.alignSelectedHorizontal('right')">右</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" title="顶部对齐" @click="editorStore.alignSelectedVertical('top')">顶</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" title="垂直居中" @click="editorStore.alignSelectedVertical('middle')">垂中</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" title="底部对齐" @click="editorStore.alignSelectedVertical('bottom')">底</button>
            <span class="option-divider"></span>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" title="置于顶层" @click="editorStore.bringSelectedToFront()">置顶</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" title="置于底层" @click="editorStore.sendSelectedToBack()">置底</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" title="复制一份" @click="editorStore.duplicateSelected()">副本</button>
            <button
              :class="['option-btn', { active: editorStore.isActiveSelectionLocked }]"
              :disabled="!editorStore.hasActiveSelection"
              :title="editorStore.isActiveSelectionLocked ? '解锁' : '锁定'"
              @click="editorStore.toggleLockSelected()"
            >
              {{ editorStore.isActiveSelectionLocked ? '解锁' : '锁定' }}
            </button>
            <button class="option-btn danger" :disabled="!editorStore.hasActiveSelection" title="删除" @click="editorStore.deleteSelected()">删除</button>
          </div>
        </div>

        <div
          ref="workspaceRef"
          :class="['stage-viewport', { 'is-tool-drop-target': isToolDropTarget }]"
          @dragover="handleStageDragOver"
          @dragleave="handleStageDragLeave"
          @drop="handleStageDrop"
        >
          <div class="canvas-shadow" :style="scaledContainerStyle">
            <div :class="['canvas-container', { 'show-grid': showGrid }]" :style="scaledContainerStyle">
              <div :style="canvasTransformStyle">
                <FabricCanvas
                  ref="fabricCanvasRef"
                  :width="config.canvas.width"
                  :height="config.canvas.height"
                />
              </div>
              <div
                v-if="showGrid"
                class="canvas-grid-overlay"
                :style="gridOverlayStyle"
                aria-hidden="true"
              ></div>
            </div>
          </div>
        </div>
      </section>

      <aside class="inspector-dock">
        <section class="dock-panel preview-dock">
          <div class="dock-title-row">
            <span>电子墨水屏预览</span>
            <div class="preview-controls" aria-label="预览缩放控制">
              <button title="缩小预览" @click="previewZoomOut">−</button>
              <span>{{ previewZoomLabel }}</span>
              <button title="放大预览" @click="previewZoomIn">+</button>
              <button title="预览 100%" @click="resetPreviewZoom">100%</button>
              <button title="适应预览区域" @click="fitPreviewZoom">适应</button>
            </div>
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

        <section class="dock-panel inspector-main">
          <div class="inspector-tabs" role="tablist" aria-label="右侧检查器">
            <button
              :class="['inspector-tab', { active: inspectorTab === 'properties' }]"
              type="button"
              role="tab"
              :aria-selected="inspectorTab === 'properties'"
              @click="inspectorTab = 'properties'"
            >
              属性
            </button>
            <button
              :class="['inspector-tab', { active: inspectorTab === 'layers' }]"
              type="button"
              role="tab"
              :aria-selected="inspectorTab === 'layers'"
              @click="inspectorTab = 'layers'"
            >
              图层
              <span>{{ editorStore.layerEntries.length }}</span>
            </button>
            <button
              :class="['inspector-tab', { active: inspectorTab === 'palette' }]"
              type="button"
              role="tab"
              :aria-selected="inspectorTab === 'palette'"
              @click="inspectorTab = 'palette'"
            >
              色板
              <span>{{ palette.length }}</span>
            </button>
          </div>

          <div class="inspector-tab-body">
            <PropertiesPanel
              v-if="inspectorTab === 'properties'"
              :selected-object="editorStore.selectedObject"
              :palette="palette"
              :custom-fields="customFields"
              :preview-data="config.previewData"
              @update-prop="editorStore.updateObjectProp"
              @update-preview-field="editorStore.updatePreviewDataField"
            />

            <div v-else-if="inspectorTab === 'layers'" class="tab-pane">
              <div class="tab-pane-header">
                <span>图层顺序</span>
                <span>{{ editorStore.layerEntries.length }} 个对象</span>
              </div>
              <div class="layer-list">
                <button
                  v-for="layer in editorStore.layerEntries"
                  :key="layer.id"
                  :class="['layer-row', { active: layer.selected, dragging: draggedLayerId === layer.id }]"
                  :title="`选择 ${layer.label}`"
                  draggable="true"
                  @dragstart="handleLayerDragStart(layer.id, $event)"
                  @dragover.prevent
                  @drop="handleLayerDrop(layer.id, $event)"
                  @dragend="handleLayerDragEnd"
                  @click="editorStore.selectObjectById(layer.id)"
                >
                  <span class="layer-icon">{{ layer.locked ? '锁' : layer.type.slice(0, 1) }}</span>
                  <span class="layer-name">{{ layer.label }}</span>
                  <span class="layer-index">#{{ layer.index + 1 }}</span>
                </button>
                <div v-if="savedTemplates.length" class="template-records">
                  <div class="template-record-title">我的模板</div>
                  <button
                    v-for="item in savedTemplates.slice(0, 3)"
                    :key="item.id"
                    class="template-record"
                    :title="`载入 ${item.name}`"
                    @click="editorStore.loadTemplate(item.data)"
                  >
                    <span>{{ item.name }}</span>
                    <small>{{ formatTemplateTime(item.createdAt) }}</small>
                    <b title="删除记录" @click.stop="deleteLocalTemplate(item.id)">×</b>
                  </button>
                </div>
                <div v-if="!editorStore.layerEntries.length" class="layer-empty">暂无元素</div>
              </div>
            </div>

            <div v-else class="tab-pane">
              <div class="tab-pane-header">
                <span>当前屏幕色板</span>
                <span>{{ palette.length }} 色</span>
              </div>
              <div class="palette-cards">
                <div v-for="color in palette" :key="color.hex" class="palette-card">
                  <span class="palette-dot" :style="{ backgroundColor: color.hex }"></span>
                  <span class="palette-name">{{ color.name }}</span>
                  <span class="palette-hex">{{ color.hex }}</span>
                </div>
              </div>
            </div>
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
  height: 66px;
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
  min-width: 220px;
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
  margin: 0 10px;
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

.template-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 1 auto;
  min-width: 0;
  padding: 4px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.template-select {
  max-width: 150px;
  height: 28px;
  color: #e8e1d6;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 650;
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
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: rgba(28, 29, 30, 0.96);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset -1px 0 0 rgba(0, 0, 0, 0.32);
  overflow: visible;
  transition: width 0.18s ease;
  z-index: 18;
}

.toolbox-panel.resizing {
  transition: none;
}

.toolbox-collapsed-strip {
  position: relative;
  z-index: 2;
  width: 56px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  background: rgba(28, 29, 30, 0.98);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.collapse-toggle,
.collapsed-tool-btn,
.toolbox-header-btn {
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
}

.collapse-toggle {
  width: 36px;
  height: 36px;
  color: #17130a;
  background: #f0d35b;
  border-color: rgba(240, 211, 91, 0.62);
  border-radius: 12px;
  font-size: 23px;
  font-weight: 900;
}

.collapsed-tool-btn {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #eee7d8;
  background: linear-gradient(180deg, rgba(62, 63, 63, 0.98), rgba(35, 36, 37, 0.98));
  border-radius: 12px;
}

.collapsed-tool-btn span {
  font-size: 10px;
  font-weight: 950;
}

.toolbox-expanded {
  width: 100%;
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: rgba(28, 29, 30, 0.98);
  overflow: hidden;
}

.toolbox-expanded.floating {
  position: absolute;
  top: 0;
  left: 56px;
  width: var(--toolbox-expanded-width);
  min-width: 220px;
  max-width: 360px;
  border-right: 1px solid rgba(240, 211, 91, 0.24);
  box-shadow: 18px 0 42px rgba(0, 0, 0, 0.34);
  transform: translateX(-10px);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.toolbox-panel.peeking .toolbox-expanded.floating {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}

.toolbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 12px 8px;
  flex-shrink: 0;
}

.toolbox-header > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.panel-caption {
  color: #a9a197;
  font-size: 11px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.toolbox-header small {
  color: #eee2c5;
  font-size: 12px;
  font-weight: 850;
}

.toolbox-header-btn {
  flex: 0 0 auto;
  min-width: 50px;
  height: 30px;
  padding: 0 9px;
  color: #f4ecd9;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 850;
}

.toolbox-header-btn:hover,
.collapsed-tool-btn:hover,
.collapse-toggle:hover {
  color: #fff3bd;
  border-color: rgba(240, 211, 91, 0.5);
  background: rgba(240, 211, 91, 0.14);
}

.toolbox-resize-handle {
  position: absolute;
  top: 0;
  right: -5px;
  z-index: 4;
  width: 10px;
  height: 100%;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: col-resize;
}

.toolbox-resize-handle::after {
  content: '';
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 4px;
  width: 2px;
  border-radius: 999px;
  background: rgba(240, 211, 91, 0.22);
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.toolbox-resize-handle:hover::after,
.toolbox-panel.resizing .toolbox-resize-handle::after {
  opacity: 1;
  background: rgba(240, 211, 91, 0.68);
}

.editor-stage {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.stage-options {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 12px;
  color: #c9c0b3;
  background: rgba(18, 19, 20, 0.76);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  overflow: hidden;
}

.option-context {
  min-width: 142px;
  flex: 0 0 auto;
}

.stage-title {
  display: block;
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

.quick-fields {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.quick-field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #a9a197;
  font-size: 11px;
  font-weight: 750;
}

.quick-field input {
  width: 58px;
  height: 30px;
  padding: 0 6px;
  color: #f2eadf;
  background: rgba(0, 0, 0, 0.26);
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 8px;
  font: inherit;
}

.quick-field input:focus {
  outline: none;
  border-color: rgba(240, 211, 91, 0.58);
  box-shadow: 0 0 0 3px rgba(240, 211, 91, 0.09);
}

.option-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
  overflow-x: auto;
  padding-bottom: 2px;
}

.option-btn {
  flex: 0 0 auto;
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  color: #d8d0c3;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;
}

.option-btn:hover:not(:disabled),
.option-btn.active {
  color: #fff4c4;
  border-color: rgba(240, 211, 91, 0.42);
  background: rgba(240, 211, 91, 0.12);
}

.option-btn.danger:hover:not(:disabled) {
  color: #ffd5cd;
  border-color: rgba(255, 99, 71, 0.46);
  background: rgba(255, 99, 71, 0.12);
}

.option-btn:disabled {
  opacity: 0.32;
  cursor: not-allowed;
}

.option-divider {
  width: 1px;
  height: 18px;
  margin: 0 3px;
  flex: 0 0 auto;
  background: rgba(255, 255, 255, 0.1);
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

.stage-viewport.is-tool-drop-target::before {
  content: '释放以添加元素';
  position: absolute;
  top: 18px;
  left: 50%;
  z-index: 8;
  transform: translateX(-50%);
  padding: 8px 13px;
  color: #17130a;
  background: #f0d35b;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  pointer-events: none;
}

.stage-viewport.is-tool-drop-target .canvas-shadow {
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.48),
    0 0 0 2px rgba(240, 211, 91, 0.7),
    0 0 0 10px rgba(240, 211, 91, 0.1);
}

.canvas-shadow {
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
}

.canvas-container {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.76);
  border-radius: 6px;
  background: #151515;
}

.canvas-container.show-grid {
  background-color: #151515;
}

.canvas-grid-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  background-image:
    linear-gradient(rgba(31, 111, 235, 0.24) 1px, transparent 1px),
    linear-gradient(90deg, rgba(31, 111, 235, 0.24) 1px, transparent 1px);
  box-shadow: inset 0 0 0 1px rgba(31, 111, 235, 0.32);
}

.inspector-dock {
  width: 328px;
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

.preview-dock {
  flex: 0 0 auto;
  max-height: 178px;
  overflow: hidden;
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

.preview-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.preview-controls button {
  height: 24px;
  min-width: 24px;
  padding: 0 6px;
  color: #d8d0c3;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 7px;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.preview-controls span {
  min-width: 36px;
  color: #a59e94;
  font-size: 10px;
  font-weight: 800;
  text-align: center;
}

.preview-stage {
  display: flex;
  justify-content: center;
  padding: 8px 10px 10px;
  max-height: 126px;
  overflow: auto;
}

.preview-scaled {
  position: relative;
  flex-shrink: 0;
}

.inspector-main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.inspector-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.inspector-tab {
  min-width: 0;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: #b8b0a4;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.inspector-tab:hover,
.inspector-tab.active {
  color: #fff2b8;
  border-color: rgba(240, 211, 91, 0.46);
  background: rgba(240, 211, 91, 0.14);
}

.inspector-tab span {
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #17130a;
  background: #d0b44b;
  font-size: 10px;
  font-weight: 900;
}

.inspector-tab-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.tab-pane {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  color: #f0e9de;
  font-size: 13px;
  font-weight: 850;
}

.tab-pane-header span:last-child {
  color: #a59e94;
  font-size: 11px;
  font-weight: 700;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px 12px;
}

.layer-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  color: #d8d0c3;
  background: rgba(0, 0, 0, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 9px;
  cursor: pointer;
  text-align: left;
}

.layer-row:hover,
.layer-row.active {
  color: #fff5c8;
  border-color: rgba(240, 211, 91, 0.42);
  background: rgba(240, 211, 91, 0.12);
}

.layer-row.dragging {
  opacity: 0.42;
  border-style: dashed;
}

.layer-icon {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  color: #17130a;
  background: #d0b44b;
  font-size: 11px;
  font-weight: 850;
}

.layer-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
}

.layer-index {
  color: #8c857b;
  font-size: 10px;
  font-weight: 750;
}

.layer-empty {
  padding: 16px 8px;
  color: #8d867d;
  text-align: center;
  font-size: 12px;
}

.template-records {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.template-record-title {
  color: #8f887d;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.08em;
}

.template-record {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  color: #d8d0c3;
  background: rgba(0, 0, 0, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
}

.template-record span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 750;
}

.template-record small {
  color: #8c857b;
  font-size: 10px;
}

.template-record b {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #cfc6ba;
  background: rgba(255, 255, 255, 0.08);
}

.palette-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  padding: 8px 12px 14px;
  overflow-y: auto;
}

.palette-card {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  color: #e4dccf;
  background: rgba(0, 0, 0, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
}

.palette-dot {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
}

.palette-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 800;
}

.palette-hex {
  color: #9d9589;
  font-size: 11px;
  font-weight: 750;
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

  .inspector-dock {
    width: 286px;
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

  .inspector-dock {
    width: 260px;
  }

  .stage-viewport {
    padding: 28px;
  }
}
</style>
