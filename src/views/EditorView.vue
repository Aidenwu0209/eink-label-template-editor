<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useScreenStore } from '@/stores/screenStore';
import { useEditorStore, type ScreenColorMode, type SnippetKind, type ToolKind } from '@/stores/editorStore';
import FabricCanvas from '@/components/canvas/FabricCanvas.vue';
import PreviewCanvas from '@/components/canvas/PreviewCanvas.vue';
import EditorToolbar from '@/components/toolbar/EditorToolbar.vue';
import PropertiesPanel from '@/components/panel/PropertiesPanel.vue';
import SmartImportDialog from '@/components/ocr/SmartImportDialog.vue';
import { getValidCustomFieldIdsFromPreviewData, validateCustomFieldId } from '@/fields';
import type { FabricJSON } from '@/boot/types';
import type { RecognizedPriceTag } from '@/ocr/types';
import type { SmartTemplateKind } from '@/ocr/templatePlanner';
import {
  LOCALES,
  MARKETS,
  getMarketProfile,
  setAppLocale,
  writeStoredRegionalPreferences,
  type LocaleCode,
  type MarketCode,
} from '@/i18n';

type LocalTemplateRecord = {
  id: string;
  name: string;
  createdAt: string;
  width: number;
  height: number;
  data: FabricJSON;
};

type InspectorTab = 'properties' | 'layers' | 'palette';
type DraggedLibraryItem =
  | { type: 'tool'; kind: ToolKind }
  | { type: 'snippet'; kind: SnippetKind }
  | { type: 'custom-field'; fieldId: string };

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
const MARKET_SAMPLE_DATE = new Date(2026, 4, 11);
const CANVAS_SIZE_PRESETS = [
  { label: '296×128', width: 296, height: 128 },
  { label: '152×60', width: 152, height: 60 },
  { label: '250×122', width: 250, height: 122 },
  { label: '400×300', width: 400, height: 300 },
  { label: '800×480', width: 800, height: 480 },
] as const;
const SCREEN_COLOR_MODES: Array<{ value: ScreenColorMode; labelKey: string }> = [
  { value: 'BW', labelKey: 'editor.screenColorBW' },
  { value: 'BWR', labelKey: 'editor.screenColorBWR' },
  { value: 'BWRY', labelKey: 'editor.screenColorBWRY' },
  { value: 'E6', labelKey: 'editor.screenColorE6' },
];

const screenStore = useScreenStore();
const editorStore = useEditorStore();
const { t } = useI18n();
const config = screenStore.bootConfig!;
const selectedLocale = ref<LocaleCode>(config.locale);
const selectedMarket = ref<MarketCode>(config.market);
const activeMarketProfile = computed(() => getMarketProfile(selectedMarket.value));
const fabricCanvasRef = ref<InstanceType<typeof FabricCanvas>>();
const editorShellRef = ref<HTMLElement>();
const workspaceRef = ref<HTMLElement>();
const workspaceSize = ref({ width: 0, height: 0 });
const viewportSize = ref({ width: 1280, height: 800 });
const manualZoom = ref<number | null>(null);
const previewManualZoom = ref<number | null>(null);
const fullscreenPreviewManualZoom = ref<number | null>(null);
const showGrid = ref(true);
const savedTemplates = ref<LocalTemplateRecord[]>([]);
const recentTools = ref<ToolKind[]>([]);
const templateSelectValue = ref('');
const canvasDraftWidth = ref(String(config.canvas.width));
const canvasDraftHeight = ref(String(config.canvas.height));
const customDataDialogOpen = ref(false);
const customDataFieldId = ref('');
const customDataLabel = ref('');
const customDataSampleValue = ref('');
const customDataError = ref('');
const customDataPosition = ref<{ left: number; top: number } | undefined>();
const draggedLayerId = ref<string | null>(null);
const inspectorTab = ref<InspectorTab>('properties');
const keepLayerTabOnNextSelection = ref(false);
const lastLayerClickId = ref<string | null>(null);
const toolboxWidth = ref(TOOLBOX_DEFAULT_WIDTH);
const isToolboxCollapsed = ref(false);
const isToolboxPeekOpen = ref(false);
const isToolboxResizing = ref(false);
const isToolDropTarget = ref(false);
const showSmartImportDialog = ref(false);
const isPreviewOverlayOpen = ref(false);
const onboardingStorageKey = computed(() => `eink-label-template-editor.onboarding.${selectedLocale.value}.${selectedMarket.value}`);
const showOnboarding = ref(localStorage.getItem(`eink-label-template-editor.onboarding.${config.locale}.${config.market}`) !== 'dismissed');
let layerClickTimer: number | null = null;

const screenDisplayName = computed(() => t(`screen.${config.screen.type}`));
const screenInfo = computed(() => {
  const modeLabel = config.mode === 'edit' ? t('editor.modeEdit') : t('editor.modeCreate');
  return `${modeLabel} | ${screenDisplayName.value}`;
});
const canvasSizeValue = computed(() => `${config.canvas.width}x${config.canvas.height}`);
const isCurrentCanvasSizePreset = computed(() => {
  return CANVAS_SIZE_PRESETS.some((preset) => (
    preset.width === config.canvas.width
    && preset.height === config.canvas.height
  ));
});
const canvasPresetValue = computed(() => isCurrentCanvasSizePreset.value ? canvasSizeValue.value : '');
const screenColorMode = computed<ScreenColorMode>(() => {
  if (config.screen.type === 'tri') return 'BWR';
  if (config.screen.type === 'bwry') return 'BWRY';
  if (config.screen.type === 'six') return 'E6';
  return 'BW';
});
const marketSummaryItems = computed(() => {
  const profile = activeMarketProfile.value;
  return [
    { label: t('market.currency'), value: `${profile.price.currencyCode} ${profile.price.currencySymbol}` },
    { label: t('market.samplePrice'), value: formatMarketSamplePrice(profile.samplePreviewData.price) },
    {
      label: t('market.sampleDate'),
      value: new Intl.DateTimeFormat(profile.dateLocale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(MARKET_SAMPLE_DATE),
    },
    {
      label: t('market.discountFormat'),
      value: profile.discountFormatTemplate.replace('{value}', String(profile.samplePreviewData.discount ?? '')),
    },
  ];
});

const palette = computed(() => editorStore.getPalette());
const customFields = computed(() => {
  editorStore.selectionVersion;
  return getValidCustomFieldIdsFromPreviewData(config.previewData);
});
const customFieldCards = computed(() => customFields.value.map((id) => ({
  id,
  sampleValue: config.previewData?.[id] == null ? '' : String(config.previewData[id]),
})));
const toolboxPanelStyle = computed(() => ({
  width: `${isToolboxCollapsed.value ? TOOLBOX_COLLAPSED_WIDTH : toolboxWidth.value}px`,
  '--toolbox-expanded-width': `${toolboxWidth.value}px`,
}));
const collapsedToolShortcuts = computed(() => {
  const fallback: ToolKind[] = ['PRICE', 'DISCOUNT', 'BARCODE', 'TEXT'];
  const ordered = [...recentTools.value, ...fallback];
  return Array.from(new Set(ordered)).slice(0, 4).map((kind) => ({
    kind,
    ...toolLabel(kind),
  }));
});

const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null);
const TOOL_MARKS: Record<ToolKind, string> = {
  RECT: '□',
  LINE: '/',
  TEXT: 'T',
  CUSTOM_DATA_TEXT: '{}',
  PRICE: '',
  DISCOUNT: '%',
  IMAGE_STATIC: 'IMG',
  IMAGE_DYNAMIC: 'D',
  QRCODE: 'QR',
  BARCODE: 'BAR',
};
const SNIPPET_MARKS: Record<SnippetKind, string> = {
  PRODUCT_TITLE: 'T',
  SPEC_TEXT: 'S',
  PROMO_TEXT: 'P',
  ORIGINAL_PRICE: 'Was',
  MEMBER_PRICE: 'VIP',
  DISCOUNT_BADGE: '%',
  DIVIDER_LINE: 'Line',
};

function toolLabel(kind: ToolKind): { label: string; mark: string } {
  return {
    label: t(`toolbar.tools.${kind}.title`),
    mark: kind === 'PRICE' ? activeMarketProfile.value.price.currencySymbol : TOOL_MARKS[kind],
  };
}

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
  if (!type) return editorStore.hasActiveSelection ? t('editor.multipleSelection') : t('editor.noSelection');
  return t(`objects.${type}`);
});

const quickFields = computed(() => {
  editorStore.selectionVersion;
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
      recentTools.value = parsed.filter((kind): kind is ToolKind => kind in TOOL_MARKS).slice(0, RECENT_TOOL_LIMIT);
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
  return new Intl.DateTimeFormat(activeMarketProfile.value.dateLocale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatMarketSamplePrice(value: unknown): string {
  const profile = activeMarketProfile.value.price;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return profile.showCurrency ? `${profile.currencySymbol}--` : '--';

  const sign = numericValue < 0 ? '-' : '';
  const [integerPart, decimalPart = ''] = Math.abs(numericValue).toFixed(profile.decimalPlaces).split('.');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, profile.thousandSeparator);
  const formattedNumber = profile.decimalPlaces > 0
    ? `${sign}${groupedInteger}${profile.decimalSeparator}${decimalPart}`
    : `${sign}${groupedInteger}`;

  return profile.showCurrency ? `${profile.currencySymbol}${formattedNumber}` : formattedNumber;
}

watch([selectedLocale, selectedMarket], ([locale, market]) => {
  setAppLocale(locale);
  writeStoredRegionalPreferences(locale, market);
  config.locale = locale;
  config.market = market;
  config.marketProfile = getMarketProfile(market);
  editorStore.applyRegionalPreferences(locale, market);
  showOnboarding.value = localStorage.getItem(onboardingStorageKey.value) !== 'dismissed';
}, { immediate: true });

function dismissOnboarding(): void {
  localStorage.setItem(onboardingStorageKey.value, 'dismissed');
  showOnboarding.value = false;
}

watch(canvasSizeValue, () => {
  canvasDraftWidth.value = String(config.canvas.width);
  canvasDraftHeight.value = String(config.canvas.height);
});

function showTransientError(message: string, timeout = 2600): void {
  saveMessage.value = { type: 'error', text: message };
  setTimeout(() => { saveMessage.value = null; }, timeout);
}

function readCanvasDraftSize(): { width: number; height: number } | null {
  const width = Number(canvasDraftWidth.value);
  const height = Number(canvasDraftHeight.value);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);
  if (roundedWidth < 16 || roundedHeight < 16 || roundedWidth > 4096 || roundedHeight > 4096) return null;
  return { width: roundedWidth, height: roundedHeight };
}

async function applyCanvasSize(width: number, height: number): Promise<void> {
  await editorStore.resizeCanvas(width, height, true);
  manualZoom.value = null;
  previewManualZoom.value = null;
  fullscreenPreviewManualZoom.value = null;
  await nextTick();
  handleWindowResize();
}

async function handleCanvasPresetChange(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  const value = select.value;
  select.value = canvasPresetValue.value;
  if (!value) return;

  const preset = CANVAS_SIZE_PRESETS.find((item) => `${item.width}x${item.height}` === value);
  if (!preset) return;
  canvasDraftWidth.value = String(preset.width);
  canvasDraftHeight.value = String(preset.height);
  await applyCanvasSize(preset.width, preset.height);
}

async function applyCanvasDraftSize(): Promise<void> {
  const parsed = readCanvasDraftSize();
  if (!parsed) {
    showTransientError(t('editor.customCanvasInvalid'));
    return;
  }
  await applyCanvasSize(parsed.width, parsed.height);
}

async function handleScreenColorModeChange(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  const value = select.value as ScreenColorMode;
  select.value = screenColorMode.value;
  await editorStore.changeScreenColorMode(value);
  manualZoom.value = null;
  previewManualZoom.value = null;
  fullscreenPreviewManualZoom.value = null;
  await nextTick();
  handleWindowResize();
}

async function saveLocalTemplate(): Promise<void> {
  const defaultName = config.templateName || t('editor.defaultTemplateName', { date: new Date().toLocaleString(activeMarketProfile.value.dateLocale) });
  const name = window.prompt(t('editor.templatePrompt'), defaultName)?.trim();
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
  saveMessage.value = { type: 'success', text: t('editor.localSaveSuccess', { name }) };
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

function nextCustomFieldId(): string {
  const existing = new Set(Object.keys(config.previewData ?? {}));
  for (let i = 1; i < 1000; i++) {
    const candidate = `customField${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `customField${Date.now().toString(36)}`;
}

function openCustomDataDialog(position?: { left: number; top: number }): void {
  customDataPosition.value = position;
  customDataFieldId.value = nextCustomFieldId();
  customDataLabel.value = '';
  customDataSampleValue.value = t('toolbar.customData.defaultSample');
  customDataError.value = '';
  customDataDialogOpen.value = true;
}

function closeCustomDataDialog(): void {
  customDataDialogOpen.value = false;
  customDataError.value = '';
  customDataPosition.value = undefined;
}

async function submitCustomDataDialog(): Promise<void> {
  const fieldId = customDataFieldId.value.trim();
  const errors = validateCustomFieldId(fieldId, customFields.value);
  if (errors.length > 0) {
    customDataError.value = errors[0].message;
    return;
  }

  try {
    editorStore.addCustomDataText({
      fieldId,
      label: customDataLabel.value.trim(),
      sampleValue: customDataSampleValue.value,
      position: customDataPosition.value,
    });
    rememberTool('CUSTOM_DATA_TEXT');
    closeCustomDataDialog();
    isToolboxPeekOpen.value = false;
    await nextTick();
  } catch (err: any) {
    customDataError.value = err?.message ?? t('editor.unknownError');
  }
}

async function addExistingCustomField(fieldId: string, position?: { left: number; top: number }): Promise<void> {
  const sampleValue = config.previewData?.[fieldId] == null ? '' : String(config.previewData[fieldId]);
  editorStore.addCustomDataText({
    fieldId,
    sampleValue,
    position,
  });
  isToolboxPeekOpen.value = false;
  await nextTick();
}

async function handleAddTool(kind: ToolKind): Promise<void> {
  if (kind === 'CUSTOM_DATA_TEXT') {
    openCustomDataDialog();
    return;
  }
  await editorStore.addElement(kind);
  rememberTool(kind);
  isToolboxPeekOpen.value = false;
}

async function handleAddSnippet(kind: SnippetKind): Promise<void> {
  await editorStore.addSnippet(kind);
  isToolboxPeekOpen.value = false;
}

function writeLibraryDragPayload(item: DraggedLibraryItem, event: DragEvent): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(TOOL_DRAG_MIME, JSON.stringify(item));
  event.dataTransfer.setData('text/plain', item.type === 'custom-field' ? item.fieldId : item.kind);
  (event.currentTarget as HTMLElement | null)?.addEventListener('dragend', () => {
    isToolDropTarget.value = false;
  }, { once: true });
}

function handleToolDragStart(kind: ToolKind, event: DragEvent): void {
  writeLibraryDragPayload({ type: 'tool', kind }, event);
}

function handleSnippetDragStart(kind: SnippetKind, event: DragEvent): void {
  writeLibraryDragPayload({ type: 'snippet', kind }, event);
}

function handleAddCustomField(fieldId: string): void {
  void addExistingCustomField(fieldId);
}

function handleCustomFieldDragStart(fieldId: string, event: DragEvent): void {
  writeLibraryDragPayload({ type: 'custom-field', fieldId }, event);
}

function parseDraggedLibraryItem(event: DragEvent): DraggedLibraryItem | null {
  const raw = event.dataTransfer?.getData(TOOL_DRAG_MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.type === 'tool' && parsed?.kind in TOOL_MARKS) {
        return { type: 'tool', kind: parsed.kind };
      }
      if (parsed?.type === 'snippet' && parsed?.kind in SNIPPET_MARKS) {
        return { type: 'snippet', kind: parsed.kind };
      }
      if (parsed?.type === 'custom-field' && typeof parsed.fieldId === 'string' && customFields.value.includes(parsed.fieldId)) {
        return { type: 'custom-field', fieldId: parsed.fieldId };
      }
    } catch {
      return null;
    }
  }

  const fallback = event.dataTransfer?.getData('text/plain');
  if (fallback && fallback in TOOL_MARKS) return { type: 'tool', kind: fallback as ToolKind };
  if (fallback && fallback in SNIPPET_MARKS) return { type: 'snippet', kind: fallback as SnippetKind };
  if (fallback && customFields.value.includes(fallback)) return { type: 'custom-field', fieldId: fallback };
  return null;
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
  const item = parseDraggedLibraryItem(event);
  if (!item) {
    isToolDropTarget.value = false;
    return;
  }
  event.preventDefault();
  isToolDropTarget.value = false;
  const position = getCanvasDropPosition(event) ?? undefined;
  if (item.type === 'tool') {
    if (item.kind === 'CUSTOM_DATA_TEXT') {
      openCustomDataDialog(position);
      return;
    }
    await editorStore.addElement(item.kind, position);
    rememberTool(item.kind);
  } else if (item.type === 'snippet') {
    await editorStore.addSnippet(item.kind, position);
  } else {
    await addExistingCustomField(item.fieldId, position);
  }
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
    saveMessage.value = { type: 'success', text: t('editor.saveSuccess', { id: payload.templateId }) };
    setTimeout(() => { saveMessage.value = null; }, 3000);
  } catch (err: any) {
    saveMessage.value = { type: 'error', text: t('editor.saveFailed', { message: err.message ?? t('editor.unknownError') }) };
  }
}

function handleSmartImportApply(payload: { recognized: RecognizedPriceTag; templateKind: SmartTemplateKind }): void {
  editorStore.applyRecognizedPriceTagTemplate(payload.recognized, payload.templateKind);
  showSmartImportDialog.value = false;
  saveMessage.value = { type: 'success', text: t('editor.smartImportSuccess') };
  setTimeout(() => { saveMessage.value = null; }, 2800);
}

function updateWorkspaceSize() {
  const el = workspaceRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  workspaceSize.value = { width: rect.width, height: rect.height };
}

function updateViewportSize() {
  viewportSize.value = { width: window.innerWidth, height: window.innerHeight };
}

function handleWindowResize() {
  updateWorkspaceSize();
  updateViewportSize();
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

function setFullscreenPreviewZoom(next: number) {
  fullscreenPreviewManualZoom.value = Math.min(8, Math.max(0.25, Number(next.toFixed(2))));
}

function fullscreenPreviewZoomIn() {
  setFullscreenPreviewZoom(fullscreenPreviewScale.value + 0.25);
}

function fullscreenPreviewZoomOut() {
  setFullscreenPreviewZoom(fullscreenPreviewScale.value - 0.25);
}

function resetFullscreenPreviewZoom() {
  setFullscreenPreviewZoom(1);
}

function fitFullscreenPreviewZoom() {
  fullscreenPreviewManualZoom.value = null;
}

function openPreviewOverlay() {
  updateViewportSize();
  isPreviewOverlayOpen.value = true;
  fitFullscreenPreviewZoom();
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

function clearLayerClickTimer(): void {
  if (layerClickTimer != null) {
    window.clearTimeout(layerClickTimer);
    layerClickTimer = null;
  }
}

function selectLayerForCanvas(layerId: string): void {
  keepLayerTabOnNextSelection.value = true;
  editorStore.selectObjectById(layerId);
  void nextTick(() => {
    keepLayerTabOnNextSelection.value = false;
  });
}

function openLayerProperties(layerId: string): void {
  clearLayerClickTimer();
  lastLayerClickId.value = null;
  keepLayerTabOnNextSelection.value = false;
  editorStore.selectObjectById(layerId);
  inspectorTab.value = 'properties';
}

function handleLayerRowClick(layerId: string): void {
  if (lastLayerClickId.value === layerId && layerClickTimer != null) {
    openLayerProperties(layerId);
    return;
  }

  lastLayerClickId.value = layerId;
  selectLayerForCanvas(layerId);
  clearLayerClickTimer();
  layerClickTimer = window.setTimeout(() => {
    layerClickTimer = null;
    lastLayerClickId.value = null;
  }, 320);
}

function isEditableKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || ['input', 'textarea', 'select'].includes(tagName);
}

function handleEditorKeydown(event: KeyboardEvent): void {
  if (isPreviewOverlayOpen.value && event.key === 'Escape') {
    event.preventDefault();
    isPreviewOverlayOpen.value = false;
    return;
  }

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
  handleWindowResize();
  window.addEventListener('resize', handleWindowResize);

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
  const maxWidth = 272;
  const maxHeight = 104;
  const scaleX = maxWidth / config.canvas.width;
  const scaleY = maxHeight / config.canvas.height;
  return Math.min(scaleX, scaleY, 1.8);
});

const previewScale = computed(() => previewManualZoom.value ?? previewFitScale.value);
const previewZoomLabel = computed(() => `${Math.round(previewScale.value * 100)}%`);

const previewContainerStyle = computed(() => ({
  width: config.canvas.width * previewScale.value + 'px',
  height: config.canvas.height * previewScale.value + 'px',
}));

const previewTransformStyle = computed(() => ({
  transform: `scale(${previewScale.value})`,
  transformOrigin: 'top left',
}));

const fullscreenPreviewFitScale = computed(() => {
  const maxWidth = Math.max(240, viewportSize.value.width - 96);
  const maxHeight = Math.max(180, viewportSize.value.height - 164);
  return Math.min(maxWidth / config.canvas.width, maxHeight / config.canvas.height, 8);
});

const fullscreenPreviewScale = computed(() => fullscreenPreviewManualZoom.value ?? fullscreenPreviewFitScale.value);
const fullscreenPreviewZoomLabel = computed(() => `${Math.round(fullscreenPreviewScale.value * 100)}%`);
const fullscreenPreviewContainerStyle = computed(() => ({
  width: config.canvas.width * fullscreenPreviewScale.value + 'px',
  height: config.canvas.height * fullscreenPreviewScale.value + 'px',
}));
const fullscreenPreviewTransformStyle = computed(() => ({
  transform: `scale(${fullscreenPreviewScale.value})`,
  transformOrigin: 'top left',
}));

watch(
  () => editorStore.selectedObject,
  (selected) => {
    if (selected && !keepLayerTabOnNextSelection.value) inspectorTab.value = 'properties';
  }
);

onUnmounted(() => {
  clearLayerClickTimer();
  window.removeEventListener('resize', handleWindowResize);
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
          <span class="toolbar-title">{{ t('editor.appTitle') }}</span>
          <span class="toolbar-subtitle">{{ t('editor.subtitle') }}</span>
        </div>
      </div>
      <div class="document-tabs">
        <span class="document-tab active">{{ config.templateName || t('editor.unnamedTemplate') }}</span>
        <span class="screen-info">{{ screenInfo }}</span>
      </div>
      <div class="template-actions" aria-label="Template shortcuts">
        <button class="toolbar-btn smart-import" :title="t('editor.smartImportTitle')" @click="showSmartImportDialog = true">{{ t('editor.smartImport') }}</button>
        <select
          class="canvas-size-select"
          :value="canvasPresetValue"
          :title="t('editor.canvasResizeTitle')"
          @change="handleCanvasPresetChange"
        >
          <option value="">{{ t('editor.canvasPreset') }}</option>
          <option
            v-if="!isCurrentCanvasSizePreset"
            :value="canvasSizeValue"
          >
            {{ t('editor.currentCanvasSize', { width: config.canvas.width, height: config.canvas.height }) }}
          </option>
          <option
            v-for="preset in CANVAS_SIZE_PRESETS"
            :key="preset.label"
            :value="`${preset.width}x${preset.height}`"
          >
            {{ preset.label }}
          </option>
        </select>
        <div class="canvas-dimension-controls" :aria-label="t('editor.customCanvasSize')">
          <label>
            <span>{{ t('editor.canvasWidth') }}</span>
            <input v-model="canvasDraftWidth" type="number" min="16" max="4096" step="1" inputmode="numeric" />
          </label>
          <span class="dimension-separator">×</span>
          <label>
            <span>{{ t('editor.canvasHeight') }}</span>
            <input v-model="canvasDraftHeight" type="number" min="16" max="4096" step="1" inputmode="numeric" />
          </label>
          <button class="toolbar-btn compact" type="button" :title="t('editor.applyCanvasSize')" @click="applyCanvasDraftSize">{{ t('common.apply') }}</button>
        </div>
        <select
          class="screen-color-select"
          :value="screenColorMode"
          :title="t('editor.screenColorTitle')"
          @change="handleScreenColorModeChange"
        >
          <option v-for="mode in SCREEN_COLOR_MODES" :key="mode.value" :value="mode.value">
            {{ t(mode.labelKey) }}
          </option>
        </select>
        <select
          v-model="templateSelectValue"
          class="template-select"
          :title="t('editor.localTemplates')"
          @change="applyLocalTemplateById"
        >
          <option value="">{{ t('editor.localTemplates') }}</option>
          <option v-for="item in savedTemplates" :key="item.id" :value="item.id">
            {{ item.name }} · {{ formatTemplateTime(item.createdAt) }}
          </option>
        </select>
        <button class="toolbar-btn compact" @click="saveLocalTemplate">{{ t('editor.saveAsTemplate') }}</button>
      </div>
      <div class="toolbar-right">
        <div class="regional-controls" aria-label="Language and market">
          <select v-model="selectedLocale" class="regional-select" :title="t('common.language')">
            <option v-for="locale in LOCALES" :key="locale" :value="locale">
              {{ t(`locale.${locale}`) }}
            </option>
          </select>
          <select v-model="selectedMarket" class="regional-select" :title="t('market.label')">
            <option v-for="market in MARKETS" :key="market" :value="market">
              {{ t(`market.${market.toLowerCase()}`) }}
            </option>
          </select>
        </div>
        <div class="zoom-controls" aria-label="Canvas zoom controls">
          <button class="toolbar-btn compact" :title="t('editor.fitCanvas')" @click="fitZoom">{{ t('editor.fitCanvas') }}</button>
          <button class="toolbar-btn icon" :title="t('editor.zoomOut')" @click="zoomOut">−</button>
          <span class="zoom-label">{{ zoomLabel }}</span>
          <button class="toolbar-btn icon" :title="t('editor.zoomIn')" @click="zoomIn">+</button>
          <button class="toolbar-btn compact" :title="t('editor.resetZoom')" @click="resetZoom">100%</button>
          <button
            :class="['toolbar-btn', 'compact', { active: showGrid }]"
            :title="showGrid ? t('editor.gridTitleHide') : t('editor.gridTitleShow')"
            @click="showGrid = !showGrid"
          >
            {{ showGrid ? t('editor.hideGrid') : t('editor.showGrid') }}
          </button>
        </div>
        <button class="toolbar-btn primary" :disabled="editorStore.isSaving" @click="handleSave">
          {{ editorStore.isSaving ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </header>

    <section v-if="showOnboarding" class="onboarding-card" role="note">
      <div>
        <span class="onboarding-kicker">{{ t(`market.${selectedMarket.toLowerCase()}`) }}</span>
        <strong>{{ t('editor.onboardingTitle') }}</strong>
        <p>{{ selectedMarket === 'CN' ? t('editor.onboardingCN') : t('editor.onboardingEU') }}</p>
        <div class="onboarding-market-summary" :aria-label="t('market.sampleLabel')">
          <span v-for="item in marketSummaryItems" :key="item.label">
            <b>{{ item.label }}</b>{{ item.value }}
          </span>
        </div>
      </div>
      <button type="button" @click="dismissOnboarding">{{ t('editor.onboardingClose') }}</button>
    </section>

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
        <div v-if="isToolboxCollapsed" class="toolbox-collapsed-strip" aria-label="Collapsed tools">
          <button class="collapse-toggle" type="button" :title="t('editor.expandToolbox')" @click="setToolboxCollapsed(false)">›</button>
          <button
            v-for="tool in collapsedToolShortcuts"
            :key="tool.kind"
            class="collapsed-tool-btn"
            type="button"
            :title="t('toolbar.addTitle', { title: tool.label })"
            @click="handleAddTool(tool.kind)"
          >
            <span>{{ tool.mark }}</span>
          </button>
        </div>

        <div :class="['toolbox-expanded', { floating: isToolboxCollapsed }]">
          <div class="toolbox-header">
            <div>
              <span class="panel-caption">{{ t('editor.toolbox') }}</span>
              <small>{{ isToolboxCollapsed ? t('editor.temporaryPeek') : `${toolboxWidth}px` }}</small>
            </div>
            <button
              class="toolbox-header-btn"
              type="button"
              :title="isToolboxCollapsed ? t('editor.pin') : t('editor.collapse')"
              @click="setToolboxCollapsed(!isToolboxCollapsed)"
            >
              {{ isToolboxCollapsed ? t('editor.pin') : t('editor.collapse') }}
            </button>
          </div>
          <EditorToolbar
            :recent-tools="recentTools"
            :currency-symbol="activeMarketProfile.price.currencySymbol"
            :custom-fields="customFieldCards"
            @add-tool="handleAddTool"
            @add-snippet="handleAddSnippet"
            @add-custom-field="handleAddCustomField"
            @tool-drag-start="handleToolDragStart"
            @snippet-drag-start="handleSnippetDragStart"
            @custom-field-drag-start="handleCustomFieldDragStart"
            @apply-starter-template="editorStore.applyStarterTemplate"
          />
        </div>

        <button
          v-if="!isToolboxCollapsed"
          class="toolbox-resize-handle"
          type="button"
          :title="t('editor.resizeToolbox')"
          @mousedown="startToolboxResize"
        ></button>
      </aside>

      <section class="editor-stage">
        <div class="stage-options">
          <div class="option-context">
            <span class="stage-title">{{ selectedObjectLabel }}</span>
            <span class="stage-meta">{{ config.canvas.width }} × {{ config.canvas.height }} px</span>
          </div>

          <div v-if="editorStore.selectedObject" class="quick-fields" :aria-label="t('editor.selectedQuickProps')">
            <label v-for="field in quickFields" :key="field.key" class="quick-field">
              <span>{{ field.label }}</span>
              <input
                type="number"
                :value="field.value"
                @change="updateQuickNumber(field.key, $event)"
              />
            </label>
          </div>

          <div class="option-actions" :aria-label="t('editor.selectedElementActions')">
            <button class="option-btn" :disabled="!editorStore.canUndo" :title="t('editor.undo')" @click="editorStore.undo()">{{ t('editor.undo') }}</button>
            <button class="option-btn" :disabled="!editorStore.canRedo" :title="t('editor.redo')" @click="editorStore.redo()">{{ t('editor.redo') }}</button>
            <span class="option-divider"></span>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" :title="t('editor.alignLeft')" @click="editorStore.alignSelectedHorizontal('left')">{{ t('editor.alignLeft') }}</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" :title="t('editor.alignCenter')" @click="editorStore.alignSelectedHorizontal('center')">{{ t('editor.alignCenter') }}</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" :title="t('editor.alignRight')" @click="editorStore.alignSelectedHorizontal('right')">{{ t('editor.alignRight') }}</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" :title="t('editor.alignTop')" @click="editorStore.alignSelectedVertical('top')">{{ t('editor.alignTop') }}</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" :title="t('editor.alignMiddle')" @click="editorStore.alignSelectedVertical('middle')">{{ t('editor.alignMiddle') }}</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" :title="t('editor.alignBottom')" @click="editorStore.alignSelectedVertical('bottom')">{{ t('editor.alignBottom') }}</button>
            <span class="option-divider"></span>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" :title="t('editor.bringFront')" @click="editorStore.bringSelectedToFront()">{{ t('editor.bringFront') }}</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" :title="t('editor.sendBack')" @click="editorStore.sendSelectedToBack()">{{ t('editor.sendBack') }}</button>
            <button class="option-btn" :disabled="!editorStore.hasActiveSelection" :title="t('editor.duplicate')" @click="editorStore.duplicateSelected()">{{ t('editor.duplicate') }}</button>
            <button
              :class="['option-btn', { active: editorStore.isActiveSelectionLocked }]"
              :disabled="!editorStore.hasActiveSelection"
              :title="editorStore.isActiveSelectionLocked ? t('editor.unlock') : t('editor.lock')"
              @click="editorStore.toggleLockSelected()"
            >
              {{ editorStore.isActiveSelectionLocked ? t('editor.unlock') : t('editor.lock') }}
            </button>
            <button class="option-btn danger" :disabled="!editorStore.hasActiveSelection" :title="t('editor.delete')" @click="editorStore.deleteSelected()">{{ t('editor.delete') }}</button>
          </div>
        </div>

        <div
          ref="workspaceRef"
          :class="['stage-viewport', { 'is-tool-drop-target': isToolDropTarget }]"
          :data-drop-label="t('editor.dropToAdd')"
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
          <div class="dock-title-row preview-title-row">
            <span class="preview-dock-title">{{ t('editor.preview') }}</span>
            <div class="preview-controls" :aria-label="t('editor.previewZoom')">
              <button :title="t('editor.zoomOut')" @click="previewZoomOut">−</button>
              <span>{{ previewZoomLabel }}</span>
              <button :title="t('editor.zoomIn')" @click="previewZoomIn">+</button>
              <button :title="t('editor.resetZoom')" @click="resetPreviewZoom">100%</button>
              <button :title="t('editor.fitPreview')" @click="fitPreviewZoom">{{ t('editor.fitPreview') }}</button>
              <button class="preview-icon-btn" :title="t('editor.fullscreen')" @click="openPreviewOverlay">⛶</button>
            </div>
          </div>
          <div class="preview-stage">
            <div class="preview-scaled" :style="previewContainerStyle">
              <div :style="previewTransformStyle">
                <PreviewCanvas
                  :width="config.canvas.width"
                  :height="config.canvas.height"
                  :show-header="false"
                />
              </div>
            </div>
          </div>
        </section>

        <section class="dock-panel inspector-main">
          <div class="inspector-tabs" role="tablist" :aria-label="t('editor.inspector')">
            <button
              :class="['inspector-tab', { active: inspectorTab === 'properties' }]"
              type="button"
              role="tab"
              :aria-selected="inspectorTab === 'properties'"
              @click="inspectorTab = 'properties'"
            >
              {{ t('editor.properties') }}
            </button>
            <button
              :class="['inspector-tab', { active: inspectorTab === 'layers' }]"
              type="button"
              role="tab"
              :aria-selected="inspectorTab === 'layers'"
              @click="inspectorTab = 'layers'"
            >
              {{ t('editor.layers') }}
              <span>{{ editorStore.layerEntries.length }}</span>
            </button>
            <button
              :class="['inspector-tab', { active: inspectorTab === 'palette' }]"
              type="button"
              role="tab"
              :aria-selected="inspectorTab === 'palette'"
              @click="inspectorTab = 'palette'"
            >
              {{ t('editor.palette') }}
              <span>{{ palette.length }}</span>
            </button>
          </div>

          <div class="inspector-tab-body">
            <PropertiesPanel
              v-if="inspectorTab === 'properties'"
              :selected-object="editorStore.selectedObject"
              :selection-version="editorStore.selectionVersion"
              :palette="palette"
              :custom-fields="customFields"
              :preview-data="config.previewData"
              :market-profile="activeMarketProfile"
              @update-prop="editorStore.updateObjectProp"
              @update-props-batch="editorStore.updateObjectPropsBatch"
              @update-preview-field="editorStore.updatePreviewDataField"
            />

            <div v-else-if="inspectorTab === 'layers'" class="tab-pane">
              <div class="tab-pane-header">
                <span>{{ t('editor.layerOrder') }}</span>
                <span>{{ t('editor.objectCount', { count: editorStore.layerEntries.length }) }}</span>
              </div>
              <div class="layer-list">
                <button
                  v-for="layer in editorStore.layerEntries"
                  :key="layer.id"
                  :class="['layer-row', { active: layer.selected, dragging: draggedLayerId === layer.id }]"
                  :title="t('editor.selectLayerTitle', { label: layer.label })"
                  draggable="true"
                  @dragstart="handleLayerDragStart(layer.id, $event)"
                  @dragover.prevent
                  @drop="handleLayerDrop(layer.id, $event)"
                  @dragend="handleLayerDragEnd"
                  @click="handleLayerRowClick(layer.id)"
                  @dblclick.stop.prevent="openLayerProperties(layer.id)"
                >
                  <span class="layer-icon">{{ layer.locked ? t('editor.lock') : layer.type.slice(0, 1) }}</span>
                  <span class="layer-name">{{ layer.label }}</span>
                  <span class="layer-index">#{{ layer.index + 1 }}</span>
                </button>
                <div v-if="savedTemplates.length" class="template-records">
                  <div class="template-record-title">{{ t('editor.myTemplates') }}</div>
                  <button
                    v-for="item in savedTemplates.slice(0, 3)"
                    :key="item.id"
                    class="template-record"
                    :title="t('editor.loadTemplateTitle', { name: item.name })"
                    @click="editorStore.loadTemplate(item.data)"
                  >
                    <span>{{ item.name }}</span>
                    <small>{{ formatTemplateTime(item.createdAt) }}</small>
                    <b :title="t('editor.delete')" @click.stop="deleteLocalTemplate(item.id)">×</b>
                  </button>
                </div>
                <div v-if="!editorStore.layerEntries.length" class="layer-empty">{{ t('editor.noElements') }}</div>
              </div>
            </div>

            <div v-else class="tab-pane">
              <div class="tab-pane-header">
                <span>{{ t('editor.palette') }}</span>
                <span>{{ t('editor.colorCount', { count: palette.length }) }}</span>
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
      <span>{{ screenDisplayName }}</span>
      <span>{{ config.canvas.width }} × {{ config.canvas.height }} px</span>
      <span>{{ config.screen.profile.dpi }} DPI</span>
      <span>{{ t('editor.deleteShortcut') }}</span>
      <span>{{ t('editor.duplicateShortcut') }}</span>
      <span v-if="saveMessage" :class="['save-message', saveMessage.type]">
        {{ saveMessage.text }}
      </span>
    </footer>

    <SmartImportDialog
      :open="showSmartImportDialog"
      :config="config"
      :has-existing-objects="editorStore.drawableObjectCount > 0"
      @close="showSmartImportDialog = false"
      @apply="handleSmartImportApply"
    />

    <Teleport to="body">
      <div
        v-if="customDataDialogOpen"
        class="custom-data-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t('toolbar.customData.dialogTitle')"
        @click.self="closeCustomDataDialog"
      >
        <form class="custom-data-dialog" @submit.prevent="submitCustomDataDialog">
          <div class="custom-data-dialog-header">
            <div>
              <span>{{ t('toolbar.customData.dialogTitle') }}</span>
              <small>{{ t('toolbar.customData.dialogHint') }}</small>
            </div>
            <button type="button" @click="closeCustomDataDialog">{{ t('common.close') }}</button>
          </div>
          <label class="custom-data-field">
            <span>{{ t('toolbar.customData.fieldId') }}</span>
            <input v-model.trim="customDataFieldId" required autocomplete="off" placeholder="skuName" />
          </label>
          <label class="custom-data-field">
            <span>{{ t('toolbar.customData.label') }}</span>
            <input v-model="customDataLabel" autocomplete="off" :placeholder="t('toolbar.customData.labelPlaceholder')" />
          </label>
          <label class="custom-data-field">
            <span>{{ t('toolbar.customData.sampleValue') }}</span>
            <textarea v-model="customDataSampleValue" rows="3" :placeholder="t('toolbar.customData.samplePlaceholder')"></textarea>
          </label>
          <p v-if="customDataError" class="custom-data-error">{{ customDataError }}</p>
          <div class="custom-data-actions">
            <button type="button" @click="closeCustomDataDialog">{{ t('common.cancel') }}</button>
            <button type="submit">{{ t('toolbar.customData.create') }}</button>
          </div>
        </form>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="isPreviewOverlayOpen"
        class="preview-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t('editor.fullscreenPreview')"
        @click.self="isPreviewOverlayOpen = false"
      >
        <div class="preview-overlay-panel">
          <div class="preview-overlay-toolbar">
            <div>
              <span class="preview-overlay-title">{{ t('editor.fullscreenPreview') }}</span>
              <small>{{ config.canvas.width }} × {{ config.canvas.height }} px</small>
            </div>
            <div class="preview-overlay-controls">
              <button @click="fullscreenPreviewZoomOut">−</button>
              <span>{{ fullscreenPreviewZoomLabel }}</span>
              <button @click="fullscreenPreviewZoomIn">+</button>
              <button @click="resetFullscreenPreviewZoom">100%</button>
              <button @click="setFullscreenPreviewZoom(2)">200%</button>
              <button @click="fitFullscreenPreviewZoom">{{ t('editor.fitPreview') }}</button>
              <button class="danger" @click="isPreviewOverlayOpen = false">{{ t('common.close') }}</button>
            </div>
          </div>
          <div class="preview-overlay-stage">
            <div class="preview-overlay-scaled" :style="fullscreenPreviewContainerStyle">
              <div :style="fullscreenPreviewTransformStyle">
                <PreviewCanvas
                  :width="config.canvas.width"
                  :height="config.canvas.height"
                  :show-header="false"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.editor-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background:
    radial-gradient(circle at 14% 10%, rgba(216, 183, 96, 0.11), transparent 30%),
    radial-gradient(circle at 82% 0%, rgba(141, 188, 246, 0.07), transparent 28%),
    linear-gradient(135deg, #15171c 0%, var(--app-bg) 48%, var(--app-bg-deep) 100%);
  color: var(--text-main);
  font-family: var(--app-font-family);
}

.editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  height: 58px;
  padding: 0 10px;
  background:
    linear-gradient(180deg, rgba(38, 40, 46, 0.96), rgba(19, 21, 26, 0.98)),
    var(--surface-panel);
  border-bottom: 1px solid var(--line-soft);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 14px 34px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(18px);
  flex-shrink: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 1 238px;
  min-width: 132px;
}

.toolbar-left > div {
  min-width: 0;
}

.app-badge {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(145deg, var(--accent-strong), var(--accent));
  color: var(--accent-ink);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  box-shadow: var(--shadow-accent), inset 0 -1px 0 rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.34);
}

.toolbar-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 750;
  letter-spacing: 0.01em;
  color: var(--text-strong);
}

.toolbar-subtitle {
  display: block;
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--text-muted);
}

.document-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 0 1 auto;
  margin: 0;
}

.document-tab {
  min-width: 0;
  max-width: clamp(92px, 10vw, 150px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 7px 10px;
  border: 1px solid var(--line-soft);
  border-radius: 10px 10px 6px 6px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04));
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 650;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
  justify-content: flex-end;
}

.template-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(46vw, 720px);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  padding: 3px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid var(--line-faint);
}

.template-select,
.canvas-size-select,
.screen-color-select {
  max-width: 128px;
  height: 30px;
  color: var(--text-main);
  background: rgba(8, 9, 11, 0.48);
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 650;
}

.canvas-size-select {
  width: 96px;
}

.screen-color-select {
  width: 116px;
}

.canvas-dimension-controls {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding-left: 3px;
  border-left: 1px solid var(--line-faint);
}

.canvas-dimension-controls label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 750;
}

.canvas-dimension-controls input {
  width: 58px;
  height: 30px;
  padding: 0 6px;
  color: var(--text-strong);
  background: rgba(8, 9, 11, 0.62);
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 800;
}

.canvas-dimension-controls input:focus,
.screen-color-select:focus,
.canvas-size-select:focus {
  outline: none;
  border-color: var(--accent-line);
  box-shadow: var(--focus-ring);
}

.dimension-separator {
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 800;
}

.regional-controls {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 4px;
  max-width: min(24vw, 244px);
  overflow: hidden;
  padding: 3px;
  border: 1px solid rgba(216, 183, 96, 0.16);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.045);
}

.regional-select {
  height: 30px;
  min-width: 70px;
  max-width: 112px;
  padding: 0 22px 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-strong);
  background: rgba(8, 9, 11, 0.64);
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 750;
}

.regional-select:focus {
  outline: none;
  border-color: var(--accent-line);
  box-shadow: var(--focus-ring);
}

.zoom-controls {
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(30vw, 376px);
  overflow-x: auto;
  overflow-y: hidden;
  gap: 4px;
  padding: 3px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid var(--line-faint);
}

.screen-info {
  max-width: 145px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--text-muted);
  padding: 6px 9px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid var(--line-faint);
  border-radius: 999px;
  white-space: nowrap;
}

.toolbar-btn {
  white-space: nowrap;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 650;
  background: rgba(255, 255, 255, 0.065);
  color: var(--text-main);
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  cursor: pointer;
  transition: color 0.2s, background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.toolbar-btn.compact {
  padding: 6px 8px;
}

.toolbar-btn.icon {
  width: 30px;
  height: 30px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}

.toolbar-btn.active {
  border-color: var(--accent-line);
  color: var(--accent-strong);
  background: var(--accent-soft);
}

.toolbar-btn.smart-import {
  padding-inline: 13px;
  color: var(--accent-ink);
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
  border-color: rgba(241, 217, 137, 0.76);
  box-shadow: var(--shadow-accent);
}

.zoom-label {
  min-width: 42px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}

.toolbar-btn:hover {
  background: var(--surface-hover);
  color: var(--text-strong);
  border-color: var(--line-strong);
  transform: translateY(-1px);
}

.toolbar-btn.primary {
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
  border-color: rgba(241, 217, 137, 0.82);
  color: var(--accent-ink);
  box-shadow: var(--shadow-accent);
}

.toolbar-btn.primary:hover {
  opacity: 0.95;
}

.onboarding-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 10px 18px;
  border-bottom: 1px solid rgba(216, 183, 96, 0.2);
  background:
    linear-gradient(90deg, rgba(216, 183, 96, 0.14), rgba(141, 188, 246, 0.07)),
    rgba(17, 19, 23, 0.92);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045);
}

.onboarding-card > div {
  min-width: 0;
}

.onboarding-card strong {
  display: block;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 850;
}

.onboarding-card p {
  margin-top: 2px;
  max-width: 880px;
  color: var(--text-main);
  font-size: 12px;
  line-height: 1.45;
}

.onboarding-market-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 7px;
}

.onboarding-market-summary span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 100%;
  padding: 4px 7px;
  color: var(--text-strong);
  background: rgba(7, 8, 10, 0.32);
  border: 1px solid var(--line-faint);
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.2;
}

.onboarding-market-summary b {
  color: var(--text-muted);
  font-weight: 850;
}

.onboarding-kicker {
  display: inline-block;
  margin-bottom: 3px;
  color: var(--accent-strong);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.onboarding-card button {
  flex: 0 0 auto;
  padding: 7px 10px;
  color: var(--accent-ink);
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
  border: 1px solid rgba(241, 217, 137, 0.74);
  border-radius: 9px;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
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
  background: var(--surface-panel);
  border-right: 1px solid var(--line-faint);
  box-shadow: inset -1px 0 0 rgba(0, 0, 0, 0.34), 12px 0 36px rgba(0, 0, 0, 0.18);
  overflow: visible;
  transition: width 0.18s ease;
  z-index: 18;
  backdrop-filter: blur(16px);
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
  background: linear-gradient(180deg, rgba(25, 27, 32, 0.98), rgba(16, 18, 22, 0.98));
  border-right: 1px solid var(--line-faint);
}

.collapse-toggle,
.collapsed-tool-btn,
.toolbox-header-btn {
  border: 1px solid var(--line-soft);
  cursor: pointer;
}

.collapse-toggle {
  width: 36px;
  height: 36px;
  color: var(--accent-ink);
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
  border-color: var(--accent-line);
  border-radius: 12px;
  font-size: 23px;
  font-weight: 900;
  box-shadow: var(--shadow-accent);
}

.collapsed-tool-btn {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-main);
  background: linear-gradient(180deg, rgba(44, 47, 54, 0.95), rgba(24, 26, 31, 0.98));
  border-radius: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
  background: var(--surface-panel);
  overflow: hidden;
}

.toolbox-expanded.floating {
  position: absolute;
  top: 0;
  left: 56px;
  width: var(--toolbox-expanded-width);
  min-width: 220px;
  max-width: 360px;
  border-right: 1px solid rgba(216, 183, 96, 0.24);
  box-shadow: 22px 0 54px rgba(0, 0, 0, 0.36);
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
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.toolbox-header small {
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 850;
}

.toolbox-header-btn {
  flex: 0 0 auto;
  min-width: 50px;
  height: 30px;
  padding: 0 9px;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.065);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 850;
}

.toolbox-header-btn:hover,
.collapsed-tool-btn:hover,
.collapse-toggle:hover {
  color: var(--accent-strong);
  border-color: var(--accent-line);
  background: var(--accent-soft);
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
  background: rgba(216, 183, 96, 0.22);
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.toolbox-resize-handle:hover::after,
.toolbox-panel.resizing .toolbox-resize-handle::after {
  opacity: 1;
  background: rgba(216, 183, 96, 0.68);
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
  color: var(--text-muted);
  background: rgba(12, 13, 16, 0.72);
  border-bottom: 1px solid var(--line-faint);
  overflow: hidden;
  backdrop-filter: blur(14px);
}

.option-context {
  min-width: 142px;
  flex: 0 0 auto;
}

.stage-title {
  display: block;
  margin-right: 10px;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 750;
}

.stage-meta,
.stage-hint {
  font-size: 12px;
  color: var(--text-faint);
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
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 750;
}

.quick-field input {
  width: 58px;
  height: 30px;
  padding: 0 6px;
  color: var(--text-strong);
  background: rgba(7, 8, 10, 0.54);
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  font: inherit;
}

.quick-field input:focus {
  outline: none;
  border-color: var(--accent-line);
  box-shadow: var(--focus-ring);
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
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;
  transition: color 0.16s, background 0.16s, border-color 0.16s;
}

.option-btn:hover:not(:disabled),
.option-btn.active {
  color: var(--accent-strong);
  border-color: var(--accent-line);
  background: var(--accent-soft);
}

.option-btn.danger:hover:not(:disabled) {
  color: #ffd9d1;
  border-color: rgba(255, 134, 111, 0.5);
  background: rgba(255, 134, 111, 0.12);
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
  background: var(--line-soft);
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
  background-color: #17191e;
  background-image:
    radial-gradient(circle at 50% 40%, rgba(216, 183, 96, 0.08), transparent 34%),
    linear-gradient(45deg, rgba(255, 255, 255, 0.028) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.028) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.028) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.028) 75%);
  background-position: center, 0 0, 0 12px, 12px -12px, -12px 0;
  background-size: auto, 24px 24px, 24px 24px, 24px 24px, 24px 24px;
}

.stage-viewport.is-tool-drop-target::before {
  content: attr(data-drop-label);
  position: absolute;
  top: 18px;
  left: 50%;
  z-index: 8;
  transform: translateX(-50%);
  padding: 8px 13px;
  color: var(--accent-ink);
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
  box-shadow: var(--shadow-accent);
  pointer-events: none;
}

.stage-viewport.is-tool-drop-target .canvas-shadow {
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.48),
    0 0 0 2px rgba(216, 183, 96, 0.72),
    0 0 0 10px rgba(216, 183, 96, 0.11);
}

.canvas-shadow {
  border-radius: 6px;
  box-shadow: 0 28px 72px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--line-strong), 0 0 0 8px rgba(255, 255, 255, 0.025);
  flex-shrink: 0;
}

.canvas-container {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.76);
  border-radius: 6px;
  background: #111316;
}

.canvas-container.show-grid {
  background-color: #111316;
}

.canvas-grid-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  background-image:
    linear-gradient(rgba(141, 188, 246, 0.22) 1px, transparent 1px),
    linear-gradient(90deg, rgba(141, 188, 246, 0.22) 1px, transparent 1px);
  box-shadow: inset 0 0 0 1px rgba(141, 188, 246, 0.3);
}

.inspector-dock {
  width: 328px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  gap: 10px;
  padding: 10px;
  background: var(--surface-panel);
  border-left: 1px solid var(--line-faint);
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.035), -12px 0 36px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(16px);
}

.dock-panel {
  background:
    radial-gradient(circle at 18% 0%, rgba(216, 183, 96, 0.08), transparent 34%),
    linear-gradient(180deg, rgba(39, 41, 48, 0.88), rgba(22, 24, 29, 0.95));
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  box-shadow: var(--shadow-panel), inset 0 1px 0 rgba(255, 255, 255, 0.055);
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
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 750;
  border-bottom: 1px solid var(--line-faint);
}

.preview-title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  padding: 8px 8px;
}

.preview-dock-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dock-kicker {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  flex: 0 0 auto;
  justify-content: flex-end;
  flex-wrap: nowrap;
  white-space: nowrap;
  overflow: visible;
}

.preview-controls button {
  flex: 0 0 auto;
  height: 22px;
  min-width: 22px;
  max-width: 54px;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 4px;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid var(--line-soft);
  border-radius: 7px;
  font-size: 9px;
  font-weight: 800;
  cursor: pointer;
}

.preview-controls .preview-icon-btn {
  width: 22px;
  min-width: 22px;
  padding: 0;
  font-size: 12px;
}

.preview-controls span {
  flex: 0 0 auto;
  min-width: 32px;
  color: var(--text-muted);
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
  border-bottom: 1px solid var(--line-faint);
}

.inspector-tab {
  min-width: 0;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--text-muted);
  background: rgba(7, 8, 10, 0.42);
  border: 1px solid var(--line-faint);
  border-radius: 9px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: color 0.16s, background 0.16s, border-color 0.16s;
}

.inspector-tab:hover,
.inspector-tab.active {
  color: var(--accent-strong);
  border-color: var(--accent-line);
  background: var(--accent-soft);
}

.inspector-tab span {
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--accent-ink);
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
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
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 850;
}

.tab-pane-header span:last-child {
  color: var(--text-muted);
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
  color: var(--text-main);
  background: rgba(7, 8, 10, 0.34);
  border: 1px solid var(--line-faint);
  border-radius: 9px;
  cursor: pointer;
  text-align: left;
  transition: color 0.16s, background 0.16s, border-color 0.16s;
}

.layer-row:hover,
.layer-row.active {
  color: var(--accent-strong);
  border-color: var(--accent-line);
  background: var(--accent-soft);
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
  color: var(--accent-ink);
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
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
  color: var(--text-faint);
  font-size: 10px;
  font-weight: 750;
}

.layer-empty {
  padding: 16px 8px;
  color: var(--text-faint);
  text-align: center;
  font-size: 12px;
}

.template-records {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--line-faint);
}

.template-record-title {
  color: var(--text-faint);
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
  color: var(--text-main);
  background: rgba(7, 8, 10, 0.3);
  border: 1px solid var(--line-faint);
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
  color: var(--text-faint);
  font-size: 10px;
}

.template-record b {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.07);
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
  color: var(--text-main);
  background: rgba(7, 8, 10, 0.32);
  border: 1px solid var(--line-faint);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.palette-dot {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 1px solid var(--line-strong);
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
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 750;
}

.editor-statusbar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 28px;
  padding: 0 16px;
  background: rgba(8, 9, 11, 0.96);
  border-top: 1px solid var(--line-faint);
  font-size: 11px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.save-message {
  margin-left: auto;
  font-weight: 600;
}
.save-message.success {
  color: var(--success);
}
.save-message.error {
  color: var(--danger);
}

.custom-data-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(4, 5, 7, 0.72);
  backdrop-filter: blur(14px);
}

.custom-data-dialog {
  width: min(430px, 100%);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  color: var(--text-main);
  background:
    radial-gradient(circle at 18% 0%, rgba(216, 183, 96, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(40, 42, 48, 0.98), rgba(17, 18, 22, 0.98));
  border: 1px solid var(--line-strong);
  border-radius: 18px;
  box-shadow: var(--shadow-float);
}

.custom-data-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.custom-data-dialog-header span {
  display: block;
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 850;
}

.custom-data-dialog-header small {
  display: block;
  margin-top: 4px;
  color: var(--text-muted);
  line-height: 1.45;
}

.custom-data-dialog button {
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  padding: 8px 12px;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.07);
  cursor: pointer;
}

.custom-data-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 750;
}

.custom-data-field input,
.custom-data-field textarea {
  width: 100%;
  box-sizing: border-box;
  color: var(--text-strong);
  background: rgba(8, 9, 11, 0.62);
  border: 1px solid var(--line-soft);
  border-radius: 11px;
  padding: 10px 11px;
  font: inherit;
  font-weight: 650;
}

.custom-data-field textarea {
  resize: vertical;
  min-height: 76px;
}

.custom-data-error {
  margin: 0;
  color: var(--danger);
  font-size: 12px;
}

.custom-data-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.custom-data-actions button[type='submit'] {
  color: var(--accent-ink);
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
  border-color: rgba(241, 217, 137, 0.76);
  font-weight: 850;
}

.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  padding: 28px;
  background:
    radial-gradient(circle at 24% 12%, rgba(216, 183, 96, 0.14), transparent 30%),
    radial-gradient(circle at 80% 14%, rgba(141, 188, 246, 0.08), transparent 28%),
    rgba(4, 5, 7, 0.88);
  backdrop-filter: blur(16px);
  box-sizing: border-box;
}

.preview-overlay-panel {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 0%, rgba(216, 183, 96, 0.08), transparent 36%),
    linear-gradient(180deg, rgba(35, 38, 45, 0.98), rgba(14, 15, 19, 0.98));
  border: 1px solid var(--line-strong);
  border-radius: 18px;
  box-shadow: var(--shadow-float);
}

.preview-overlay-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  color: var(--text-strong);
  border-bottom: 1px solid var(--line-soft);
}

.preview-overlay-title {
  display: block;
  font-size: 15px;
  font-weight: 850;
}

.preview-overlay-toolbar small {
  display: block;
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.preview-overlay-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.preview-overlay-controls button {
  min-height: 30px;
  padding: 0 10px;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.065);
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}

.preview-overlay-controls button:hover {
  color: var(--accent-strong);
  border-color: var(--accent-line);
}

.preview-overlay-controls .danger {
  color: #ffd6ce;
  border-color: rgba(255, 134, 111, 0.4);
}

.preview-overlay-controls span {
  min-width: 48px;
  color: var(--text-main);
  font-size: 12px;
  font-weight: 850;
  text-align: center;
}

.preview-overlay-stage {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 28px;
  overflow: auto;
}

.preview-overlay-scaled {
  flex-shrink: 0;
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.5);
}

@media (max-width: 1100px) {
  .toolbar-left {
    min-width: 118px;
  }

  .document-tabs {
    margin: 0;
  }

  .template-actions {
    max-width: 44vw;
  }

  .regional-controls {
    max-width: 28vw;
  }

  .zoom-controls {
    max-width: 30vw;
  }

  .screen-info {
    display: none;
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
    padding-inline: 8px;
  }

  .template-actions {
    max-width: 52vw;
  }

  .regional-controls {
    max-width: 42vw;
  }

  .zoom-controls {
    max-width: 44vw;
  }

  .inspector-dock {
    width: 260px;
  }

  .stage-viewport {
    padding: 28px;
  }
}
</style>
