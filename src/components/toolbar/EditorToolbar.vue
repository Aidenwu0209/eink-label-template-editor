<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SnippetKind, StarterTemplateKind, ToolKind } from '@/stores/editorStore';

type AssetTab = 'my' | 'common' | 'templates';

type ToolCard = {
  kind: ToolKind;
  group: 'data' | 'base';
  mark: string;
  title: string;
  description: string;
  badge?: string;
};

type SnippetCard = {
  kind: SnippetKind;
  mark: string;
  title: string;
  description: string;
  badge?: string;
};

type TemplateCard = {
  kind: StarterTemplateKind;
  mark: string;
  title: string;
  description: string;
};

const props = withDefaults(defineProps<{
  recentTools?: ToolKind[];
  currencySymbol?: string;
}>(), {
  recentTools: () => [],
  currencySymbol: '¥',
});

const emit = defineEmits<{
  'add-tool': [kind: ToolKind];
  'add-snippet': [kind: SnippetKind];
  'tool-drag-start': [kind: ToolKind, event: DragEvent];
  'snippet-drag-start': [kind: SnippetKind, event: DragEvent];
  'apply-starter-template': [kind: StarterTemplateKind];
}>();

const activeAssetTab = ref<AssetTab>('my');
const { t } = useI18n();

const toolCardDefs: Array<Omit<ToolCard, 'title' | 'description'> & { titleKey: string; descriptionKey: string }> = [
  {
    kind: 'CUSTOM_DATA_TEXT',
    group: 'data',
    mark: '{}',
    titleKey: 'toolbar.tools.CUSTOM_DATA_TEXT.title',
    descriptionKey: 'toolbar.tools.CUSTOM_DATA_TEXT.description',
    badge: 'custom',
  },
  {
    kind: 'PRICE',
    group: 'data',
    mark: '',
    titleKey: 'toolbar.tools.PRICE.title',
    descriptionKey: 'toolbar.tools.PRICE.description',
    badge: 'price',
  },
  {
    kind: 'DISCOUNT',
    group: 'data',
    mark: '%',
    titleKey: 'toolbar.tools.DISCOUNT.title',
    descriptionKey: 'toolbar.tools.DISCOUNT.description',
    badge: 'discount',
  },
  {
    kind: 'IMAGE_DYNAMIC',
    group: 'data',
    mark: 'D',
    titleKey: 'toolbar.tools.IMAGE_DYNAMIC.title',
    descriptionKey: 'toolbar.tools.IMAGE_DYNAMIC.description',
    badge: 'imageUrl',
  },
  {
    kind: 'QRCODE',
    group: 'data',
    mark: 'QR',
    titleKey: 'toolbar.tools.QRCODE.title',
    descriptionKey: 'toolbar.tools.QRCODE.description',
    badge: 'qrContent',
  },
  {
    kind: 'BARCODE',
    group: 'data',
    mark: 'BAR',
    titleKey: 'toolbar.tools.BARCODE.title',
    descriptionKey: 'toolbar.tools.BARCODE.description',
    badge: 'barcodeContent',
  },
  {
    kind: 'RECT',
    group: 'base',
    mark: '□',
    titleKey: 'toolbar.tools.RECT.title',
    descriptionKey: 'toolbar.tools.RECT.description',
  },
  {
    kind: 'LINE',
    group: 'base',
    mark: '/',
    titleKey: 'toolbar.tools.LINE.title',
    descriptionKey: 'toolbar.tools.LINE.description',
  },
  {
    kind: 'TEXT',
    group: 'base',
    mark: 'T',
    titleKey: 'toolbar.tools.TEXT.title',
    descriptionKey: 'toolbar.tools.TEXT.description',
  },
  {
    kind: 'IMAGE_STATIC',
    group: 'base',
    mark: 'IMG',
    titleKey: 'toolbar.tools.IMAGE_STATIC.title',
    descriptionKey: 'toolbar.tools.IMAGE_STATIC.description',
  },
];

const snippetCardDefs: Array<Omit<SnippetCard, 'mark' | 'title' | 'description'> & { markKey: string; titleKey: string; descriptionKey: string }> = [
  {
    kind: 'PRODUCT_TITLE',
    markKey: 'toolbar.snippets.PRODUCT_TITLE.mark',
    titleKey: 'toolbar.snippets.PRODUCT_TITLE.title',
    descriptionKey: 'toolbar.snippets.PRODUCT_TITLE.description',
    badge: 'productName',
  },
  {
    kind: 'SPEC_TEXT',
    markKey: 'toolbar.snippets.SPEC_TEXT.mark',
    titleKey: 'toolbar.snippets.SPEC_TEXT.title',
    descriptionKey: 'toolbar.snippets.SPEC_TEXT.description',
    badge: 'spec',
  },
  {
    kind: 'PROMO_TEXT',
    markKey: 'toolbar.snippets.PROMO_TEXT.mark',
    titleKey: 'toolbar.snippets.PROMO_TEXT.title',
    descriptionKey: 'toolbar.snippets.PROMO_TEXT.description',
    badge: 'promoText',
  },
  {
    kind: 'MEMBER_PRICE',
    markKey: 'toolbar.snippets.MEMBER_PRICE.mark',
    titleKey: 'toolbar.snippets.MEMBER_PRICE.title',
    descriptionKey: 'toolbar.snippets.MEMBER_PRICE.description',
    badge: 'memberPrice',
  },
  {
    kind: 'ORIGINAL_PRICE',
    markKey: 'toolbar.snippets.ORIGINAL_PRICE.mark',
    titleKey: 'toolbar.snippets.ORIGINAL_PRICE.title',
    descriptionKey: 'toolbar.snippets.ORIGINAL_PRICE.description',
    badge: 'originalPrice',
  },
  {
    kind: 'DISCOUNT_BADGE',
    markKey: 'toolbar.snippets.DISCOUNT_BADGE.mark',
    titleKey: 'toolbar.snippets.DISCOUNT_BADGE.title',
    descriptionKey: 'toolbar.snippets.DISCOUNT_BADGE.description',
    badge: 'discount',
  },
  {
    kind: 'DIVIDER_LINE',
    markKey: 'toolbar.snippets.DIVIDER_LINE.mark',
    titleKey: 'toolbar.snippets.DIVIDER_LINE.title',
    descriptionKey: 'toolbar.snippets.DIVIDER_LINE.description',
  },
];

const templateCardDefs: Array<Omit<TemplateCard, 'mark' | 'title' | 'description'> & { markKey: string; titleKey: string; descriptionKey: string }> = [
  {
    kind: 'retail',
    markKey: 'toolbar.templates.retail.mark',
    titleKey: 'toolbar.templates.retail.title',
    descriptionKey: 'toolbar.templates.retail.description',
  },
  {
    kind: 'barcode',
    markKey: 'toolbar.templates.barcode.mark',
    titleKey: 'toolbar.templates.barcode.title',
    descriptionKey: 'toolbar.templates.barcode.description',
  },
  {
    kind: 'qr',
    markKey: 'toolbar.templates.qr.mark',
    titleKey: 'toolbar.templates.qr.title',
    descriptionKey: 'toolbar.templates.qr.description',
  },
];

const toolCards = computed<ToolCard[]>(() => toolCardDefs.map((tool) => ({
  ...tool,
  mark: tool.kind === 'PRICE' ? props.currencySymbol : tool.mark,
  title: t(tool.titleKey),
  description: t(tool.descriptionKey),
})));

const snippetCards = computed<SnippetCard[]>(() => snippetCardDefs.map((snippet) => ({
  ...snippet,
  mark: t(snippet.markKey),
  title: t(snippet.titleKey),
  description: t(snippet.descriptionKey),
})));

const templateCards = computed<TemplateCard[]>(() => templateCardDefs.map((template) => ({
  ...template,
  mark: t(template.markKey),
  title: t(template.titleKey),
  description: t(template.descriptionKey),
})));

const toolByKind = computed(() => new Map(toolCards.value.map((tool) => [tool.kind, tool])));

const dataToolCards = computed(() => toolCards.value.filter((tool) => tool.group === 'data'));
const baseToolCards = computed(() => toolCards.value.filter((tool) => tool.group === 'base'));

const recentToolCards = computed(() => {
  return props.recentTools
    .map((kind) => toolByKind.value.get(kind))
    .filter((tool): tool is ToolCard => Boolean(tool))
    .slice(0, 4);
});

function addTool(kind: ToolKind): void {
  emit('add-tool', kind);
}

function addSnippet(kind: SnippetKind): void {
  emit('add-snippet', kind);
}

function dragTool(kind: ToolKind, event: DragEvent): void {
  emit('tool-drag-start', kind, event);
}

function dragSnippet(kind: SnippetKind, event: DragEvent): void {
  emit('snippet-drag-start', kind, event);
}
</script>

<template>
  <div class="toolbar-actions">
    <div class="toolbox-intro">
      <span>{{ t('toolbar.addElements') }}</span>
      <small>{{ t('toolbar.addHint') }}</small>
    </div>

    <div class="asset-tabs" :aria-label="t('toolbar.assetTabs')">
      <button
        :class="{ active: activeAssetTab === 'my' }"
        type="button"
        @click="activeAssetTab = 'my'"
      >
        {{ t('toolbar.myElements') }}
      </button>
      <button
        :class="{ active: activeAssetTab === 'common' }"
        type="button"
        @click="activeAssetTab = 'common'"
      >
        {{ t('toolbar.commonSnippets') }}
      </button>
      <button
        :class="{ active: activeAssetTab === 'templates' }"
        type="button"
        @click="activeAssetTab = 'templates'"
      >
        {{ t('toolbar.fixedTemplates') }}
      </button>
    </div>

    <section v-if="recentToolCards.length" class="toolbar-section">
      <div class="toolbar-section-title">
        <span>{{ t('toolbar.recent') }}</span>
        <small>{{ t('toolbar.dragToPlace') }}</small>
      </div>
      <div class="recent-grid">
        <button
          v-for="tool in recentToolCards"
          :key="tool.kind"
          class="recent-tool"
          type="button"
          draggable="true"
          :title="t('toolbar.addTitle', { title: tool.title })"
          @click="addTool(tool.kind)"
          @dragstart="dragTool(tool.kind, $event)"
        >
          <span>{{ tool.mark }}</span>
          <b>{{ tool.title }}</b>
        </button>
      </div>
    </section>

    <section class="toolbar-section">
      <div class="toolbar-section-title">
        <span>
          {{ activeAssetTab === 'my' ? t('toolbar.sectionMy') : activeAssetTab === 'common' ? t('toolbar.sectionCommon') : t('toolbar.sectionTemplates') }}
        </span>
        <small>{{ activeAssetTab === 'templates' ? t('toolbar.clickReplace') : t('toolbar.clickOrDrag') }}</small>
      </div>

      <template v-if="activeAssetTab === 'my'">
        <div class="subsection-label">{{ t('toolbar.dataComponents') }}</div>
        <div class="tool-card-list">
          <button
            v-for="tool in dataToolCards"
            :key="tool.kind"
            class="tool-card"
            type="button"
            draggable="true"
            :title="t('toolbar.addTitle', { title: tool.title })"
            @click="addTool(tool.kind)"
            @dragstart="dragTool(tool.kind, $event)"
          >
            <span class="tool-mark">{{ tool.mark }}</span>
            <span class="tool-card-copy">
              <span class="tool-card-title">{{ tool.title }}</span>
              <small>{{ tool.description }}</small>
            </span>
            <span v-if="tool.badge" class="tool-badge">{{ tool.badge }}</span>
          </button>
        </div>

        <div class="subsection-label">{{ t('toolbar.basicDrawing') }}</div>
        <div class="tool-card-list compact-list">
          <button
            v-for="tool in baseToolCards"
            :key="tool.kind"
            class="tool-card compact-card"
            type="button"
            draggable="true"
            :title="t('toolbar.addTitle', { title: tool.title })"
            @click="addTool(tool.kind)"
            @dragstart="dragTool(tool.kind, $event)"
          >
            <span class="tool-mark">{{ tool.mark }}</span>
            <span class="tool-card-copy">
              <span class="tool-card-title">{{ tool.title }}</span>
              <small>{{ tool.description }}</small>
            </span>
          </button>
        </div>
      </template>

      <div v-else-if="activeAssetTab === 'common'" class="tool-card-list">
        <button
          v-for="snippet in snippetCards"
          :key="snippet.kind"
          class="tool-card snippet-card"
          type="button"
          draggable="true"
          :title="t('toolbar.addTitle', { title: snippet.title })"
          @click="addSnippet(snippet.kind)"
          @dragstart="dragSnippet(snippet.kind, $event)"
        >
          <span class="tool-mark snippet-mark">{{ snippet.mark }}</span>
          <span class="tool-card-copy">
            <span class="tool-card-title">{{ snippet.title }}</span>
            <small>{{ snippet.description }}</small>
          </span>
          <span v-if="snippet.badge" class="tool-badge">{{ snippet.badge }}</span>
        </button>
      </div>

      <div v-else class="tool-card-list">
        <button
          v-for="template in templateCards"
          :key="template.kind"
          class="tool-card template-card"
          type="button"
          :title="template.description"
          @click="emit('apply-starter-template', template.kind)"
        >
          <span class="tool-mark template-mark">{{ template.mark }}</span>
          <span class="tool-card-copy">
            <span class="tool-card-title">{{ template.title }}</span>
            <small>{{ template.description }}</small>
          </span>
        </button>
        <p class="template-hint">{{ t('toolbar.templateHint') }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.toolbar-actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  height: 100%;
  overflow-y: auto;
  padding: 0 12px 14px;
}

.toolbox-intro {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 0 0;
}

.toolbox-intro span {
  color: var(--text-strong);
  font-size: 15px;
  font-weight: 900;
}

.toolbox-intro small,
.toolbar-section-title small,
.tool-card-copy small,
.template-hint {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.asset-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding: 6px;
  background: rgba(7, 8, 10, 0.36);
  border: 1px solid var(--line-faint);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.asset-tabs button {
  min-width: 0;
  min-height: 34px;
  padding: 6px 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;
  transition: color 0.16s, background 0.16s, border-color 0.16s;
}

.asset-tabs button.active,
.asset-tabs button:hover {
  color: var(--accent-strong);
  border-color: var(--accent-line);
  background: var(--accent-soft);
}

.toolbar-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toolbar-section-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-main);
  font-size: 12px;
  font-weight: 850;
}

.toolbar-section-title span,
.toolbar-section-title small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar-section-title span {
  white-space: nowrap;
}

.recent-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.recent-tool {
  min-width: 0;
  min-height: 42px;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 7px;
  color: var(--text-main);
  background: rgba(216, 183, 96, 0.11);
  border: 1px solid rgba(216, 183, 96, 0.24);
  border-radius: 12px;
  cursor: grab;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045);
  transition: transform 0.15s, color 0.15s, border-color 0.15s, background 0.15s;
}

.recent-tool span,
.tool-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--accent-ink);
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
  font-size: 11px;
  font-weight: 950;
}

.recent-tool span {
  width: 26px;
  height: 26px;
}

.recent-tool b {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  text-align: left;
}

.tool-card-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.compact-list {
  gap: 6px;
}

.subsection-label {
  margin-top: 2px;
  color: var(--text-faint);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.tool-card {
  position: relative;
  min-width: 0;
  min-height: 72px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  color: var(--text-main);
  background:
    radial-gradient(circle at 12% 10%, rgba(216, 183, 96, 0.15), transparent 34%),
    linear-gradient(180deg, rgba(43, 46, 53, 0.94), rgba(22, 24, 29, 0.96));
  border: 1px solid var(--line-soft);
  border-radius: 14px;
  box-shadow: var(--shadow-panel), inset 0 1px 0 rgba(255, 255, 255, 0.055);
  cursor: grab;
  text-align: left;
  transition: transform 0.15s, border-color 0.15s, background 0.15s, color 0.15s;
}

.compact-card {
  min-height: 58px;
}

.tool-card:hover,
.recent-tool:hover {
  transform: translateY(-1px);
  color: var(--text-strong);
  border-color: var(--accent-line);
}

.tool-card:active,
.recent-tool:active {
  cursor: grabbing;
}

.tool-mark {
  width: 38px;
  height: 38px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
}

.tool-card-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tool-card-title {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 900;
  line-height: 1.2;
}

.tool-card-copy small {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tool-badge {
  justify-self: end;
  max-width: 82px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 3px 6px;
  color: var(--accent-ink);
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
  border-radius: 999px;
  font-size: 9px;
  font-weight: 900;
}

.template-card .tool-card-copy small {
  -webkit-line-clamp: 3;
}

.template-card {
  cursor: pointer;
}

.snippet-card {
  background:
    radial-gradient(circle at 12% 10%, rgba(141, 188, 246, 0.15), transparent 34%),
    linear-gradient(180deg, rgba(39, 47, 58, 0.94), rgba(21, 24, 30, 0.96));
}

.snippet-mark {
  background: linear-gradient(180deg, #b9d8ff, var(--blue-accent));
}

.template-mark {
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
}

.template-hint {
  margin: 0;
  padding: 8px 10px;
  background: rgba(7, 8, 10, 0.34);
  border: 1px solid var(--line-faint);
  border-radius: 10px;
}
</style>
