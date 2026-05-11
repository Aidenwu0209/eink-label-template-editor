<script setup lang="ts">
import { computed, ref } from 'vue';
import type { StarterTemplateKind, ToolKind } from '@/stores/editorStore';

type AssetTab = 'my' | 'public' | 'templates';

type ToolCard = {
  kind: ToolKind;
  tab: Exclude<AssetTab, 'templates'>;
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
  'tool-drag-start': [kind: ToolKind, event: DragEvent];
  'apply-starter-template': [kind: StarterTemplateKind];
}>();

const activeAssetTab = ref<AssetTab>('my');

const toolCards: ToolCard[] = [
  {
    kind: 'PRICE',
    tab: 'my',
    mark: '¥',
    title: '价格',
    description: '金额展示，支持货币符号和小数样式。',
    badge: 'price',
  },
  {
    kind: 'DISCOUNT',
    tab: 'my',
    mark: '%',
    title: '折扣',
    description: '促销折扣块，默认居中展示。',
    badge: 'discount',
  },
  {
    kind: 'IMAGE_DYNAMIC',
    tab: 'my',
    mark: 'D',
    title: '图片字段',
    description: '绑定图片地址，随数据动态替换。',
    badge: 'imageUrl',
  },
  {
    kind: 'QRCODE',
    tab: 'my',
    mark: 'QR',
    title: '二维码',
    description: '绑定二维码内容，适合详情页链接。',
    badge: 'qrContent',
  },
  {
    kind: 'BARCODE',
    tab: 'my',
    mark: 'BAR',
    title: '条形码',
    description: 'CODE128 条码，适合 SKU 或追踪码。',
    badge: 'barcodeContent',
  },
  {
    kind: 'RECT',
    tab: 'public',
    mark: '□',
    title: '矩形框',
    description: '绘制背景块、边框或分区容器。',
  },
  {
    kind: 'LINE',
    tab: 'public',
    mark: '/',
    title: '直线',
    description: '绘制分割线、引导线或下划线。',
  },
  {
    kind: 'TEXT',
    tab: 'public',
    mark: 'T',
    title: '文本',
    description: '固定文本，也可在属性中绑定字段。',
  },
  {
    kind: 'IMAGE_STATIC',
    tab: 'public',
    mark: 'IMG',
    title: '上传图片',
    description: '手动上传或填写图片 URL。',
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

const currentTools = computed(() => {
  if (activeAssetTab.value === 'templates') return [];
  return toolCards.filter((tool) => tool.tab === activeAssetTab.value);
});

const recentToolCards = computed(() => {
  return props.recentTools
    .map((kind) => toolByKind.value.get(kind))
    .filter((tool): tool is ToolCard => Boolean(tool))
    .slice(0, 4);
});

function addTool(kind: ToolKind): void {
  emit('add-tool', kind);
}

function dragTool(kind: ToolKind, event: DragEvent): void {
  emit('tool-drag-start', kind, event);
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
        :class="{ active: activeAssetTab === 'public' }"
        type="button"
        @click="activeAssetTab = 'public'"
      >
        公共元素
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
          {{ activeAssetTab === 'my' ? '数据绑定组件' : activeAssetTab === 'public' ? '基础绘制组件' : '一键套用版式' }}
        </span>
        <small>{{ activeAssetTab === 'templates' ? '点击即替换当前画布' : '支持点击和拖放' }}</small>
      </div>

      <div v-if="activeAssetTab !== 'templates'" class="tool-card-list">
        <button
          v-for="tool in currentTools"
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
        <p class="template-hint">套用固定模板会先清空当前画布。</p>
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
  color: #f4ecd9;
  font-size: 15px;
  font-weight: 900;
}

.toolbox-intro small,
.toolbar-section-title small,
.tool-card-copy small,
.template-hint {
  color: #9c9488;
  font-size: 11px;
  line-height: 1.45;
}

.asset-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
}

.asset-tabs button {
  min-width: 0;
  min-height: 34px;
  padding: 6px 5px;
  color: #aaa297;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;
}

.asset-tabs button.active,
.asset-tabs button:hover {
  color: #fff2ba;
  border-color: rgba(240, 211, 91, 0.44);
  background: rgba(240, 211, 91, 0.14);
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
  color: #d8d0c3;
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
  color: #eee5d7;
  background: rgba(240, 211, 91, 0.1);
  border: 1px solid rgba(240, 211, 91, 0.22);
  border-radius: 12px;
  cursor: grab;
}

.recent-tool span,
.tool-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #17130a;
  background: #f0d35b;
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

.tool-card {
  position: relative;
  min-width: 0;
  min-height: 72px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px;
  color: #ddd5ca;
  background:
    radial-gradient(circle at 12% 10%, rgba(240, 211, 91, 0.18), transparent 34%),
    linear-gradient(180deg, rgba(62, 63, 63, 0.96), rgba(34, 35, 36, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 10px 24px rgba(0, 0, 0, 0.16);
  cursor: grab;
  text-align: left;
  transition: transform 0.15s, border-color 0.15s, background 0.15s, color 0.15s;
}

.tool-card:hover,
.recent-tool:hover {
  transform: translateY(-1px);
  color: #fff7df;
  border-color: rgba(240, 211, 91, 0.42);
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
  color: #f3eadc;
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
  color: #17130a;
  background: #d0b44b;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 900;
}

.template-card {
  cursor: pointer;
}

.template-mark {
  background: #efd754;
}

.template-hint {
  margin: 0;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
}
</style>
