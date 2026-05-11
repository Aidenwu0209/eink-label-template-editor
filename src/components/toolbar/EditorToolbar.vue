<script setup lang="ts">
import { computed, ref } from 'vue';
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
}>(), {
  recentTools: () => [],
});

const emit = defineEmits<{
  'add-tool': [kind: ToolKind];
  'add-snippet': [kind: SnippetKind];
  'tool-drag-start': [kind: ToolKind, event: DragEvent];
  'snippet-drag-start': [kind: SnippetKind, event: DragEvent];
  'apply-starter-template': [kind: StarterTemplateKind];
}>();

const activeAssetTab = ref<AssetTab>('my');

const toolCards: ToolCard[] = [
  {
    kind: 'PRICE',
    group: 'data',
    mark: '¥',
    title: '价格',
    description: '金额展示，支持货币符号和小数样式。',
    badge: 'price',
  },
  {
    kind: 'DISCOUNT',
    group: 'data',
    mark: '%',
    title: '折扣',
    description: '促销折扣块，默认居中展示。',
    badge: 'discount',
  },
  {
    kind: 'IMAGE_DYNAMIC',
    group: 'data',
    mark: 'D',
    title: '图片字段',
    description: '绑定图片地址，随数据动态替换。',
    badge: 'imageUrl',
  },
  {
    kind: 'QRCODE',
    group: 'data',
    mark: 'QR',
    title: '二维码',
    description: '绑定二维码内容，适合详情页链接。',
    badge: 'qrContent',
  },
  {
    kind: 'BARCODE',
    group: 'data',
    mark: 'BAR',
    title: '条形码',
    description: 'CODE128 条码，适合 SKU 或追踪码。',
    badge: 'barcodeContent',
  },
  {
    kind: 'RECT',
    group: 'base',
    mark: '□',
    title: '矩形框',
    description: '绘制背景块、边框或分区容器。',
  },
  {
    kind: 'LINE',
    group: 'base',
    mark: '/',
    title: '直线',
    description: '绘制分割线、引导线或下划线。',
  },
  {
    kind: 'TEXT',
    group: 'base',
    mark: 'T',
    title: '文本',
    description: '固定文本，也可在属性中绑定字段。',
  },
  {
    kind: 'IMAGE_STATIC',
    group: 'base',
    mark: 'IMG',
    title: '上传图片',
    description: '手动上传或填写图片 URL。',
  },
];

const snippetCards: SnippetCard[] = [
  {
    kind: 'PRODUCT_TITLE',
    mark: '标题',
    title: '商品标题',
    description: '绑定 productName，适合价签主标题。',
    badge: 'productName',
  },
  {
    kind: 'SPEC_TEXT',
    mark: '规',
    title: '规格说明',
    description: '绑定 spec 或 description，作为副标题信息。',
    badge: 'spec',
  },
  {
    kind: 'PROMO_TEXT',
    mark: '促',
    title: '促销文案',
    description: '绑定 promoText/description，放置活动说明。',
    badge: 'promoText',
  },
  {
    kind: 'MEMBER_PRICE',
    mark: '会',
    title: '会员价',
    description: '绑定 memberPrice，生成可编辑价格组件。',
    badge: 'memberPrice',
  },
  {
    kind: 'ORIGINAL_PRICE',
    mark: '原',
    title: '原价',
    description: '绑定 originalPrice，适合作为对比价。',
    badge: 'originalPrice',
  },
  {
    kind: 'DISCOUNT_BADGE',
    mark: '折',
    title: '折扣标签',
    description: '绑定 discount，按屏幕色板自动选择配色。',
    badge: 'discount',
  },
  {
    kind: 'DIVIDER_LINE',
    mark: '线',
    title: '价签分隔线',
    description: '常用横向分隔线，用来组织信息层级。',
  },
];

const templateCards: TemplateCard[] = [
  {
    kind: 'retail',
    mark: '价',
    title: '零售价签模板',
    description: '商品名、价格、折扣和条码的常用零售版式。',
  },
  {
    kind: 'barcode',
    mark: '码',
    title: '条码追踪模板',
    description: '商品名、条形码和二维码的追踪版式。',
  },
  {
    kind: 'qr',
    mark: '券',
    title: '扫码促销模板',
    description: '二维码、折扣和说明文案的促销版式。',
  },
];

const toolByKind = computed(() => new Map(toolCards.map((tool) => [tool.kind, tool])));

const dataToolCards = computed(() => toolCards.filter((tool) => tool.group === 'data'));
const baseToolCards = computed(() => toolCards.filter((tool) => tool.group === 'base'));

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
      <span>添加元素</span>
      <small>点击添加到默认位置，或拖到画布指定位置。</small>
    </div>

    <div class="asset-tabs" aria-label="素材分类">
      <button
        :class="{ active: activeAssetTab === 'my' }"
        type="button"
        @click="activeAssetTab = 'my'"
      >
        我的元素
      </button>
      <button
        :class="{ active: activeAssetTab === 'common' }"
        type="button"
        @click="activeAssetTab = 'common'"
      >
        常用片段
      </button>
      <button
        :class="{ active: activeAssetTab === 'templates' }"
        type="button"
        @click="activeAssetTab = 'templates'"
      >
        固定模板
      </button>
    </div>

    <section v-if="recentToolCards.length" class="toolbar-section">
      <div class="toolbar-section-title">
        <span>最近使用</span>
        <small>拖放可定位</small>
      </div>
      <div class="recent-grid">
        <button
          v-for="tool in recentToolCards"
          :key="tool.kind"
          class="recent-tool"
          type="button"
          draggable="true"
          :title="`添加${tool.title}`"
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
          {{ activeAssetTab === 'my' ? '我的元素' : activeAssetTab === 'common' ? '价签常用片段' : '一键套用版式' }}
        </span>
        <small>{{ activeAssetTab === 'templates' ? '点击即替换当前画布' : '支持点击和拖放' }}</small>
      </div>

      <template v-if="activeAssetTab === 'my'">
        <div class="subsection-label">数据组件</div>
        <div class="tool-card-list">
          <button
            v-for="tool in dataToolCards"
            :key="tool.kind"
            class="tool-card"
            type="button"
            draggable="true"
            :title="`添加${tool.title}`"
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

        <div class="subsection-label">基础绘制</div>
        <div class="tool-card-list compact-list">
          <button
            v-for="tool in baseToolCards"
            :key="tool.kind"
            class="tool-card compact-card"
            type="button"
            draggable="true"
            :title="`添加${tool.title}`"
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
          :title="`添加${snippet.title}`"
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
        <p class="template-hint">模板会按当前屏幕色板自动避开大面积黑块；套用前会清空当前画布。</p>
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
  grid-template-columns: 38px minmax(0, 1fr);
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
  font-size: 12px;
}

.tool-card-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tool-card-title {
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 900;
}

.tool-badge {
  position: absolute;
  top: 8px;
  right: 9px;
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
