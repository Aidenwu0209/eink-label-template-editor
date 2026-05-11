<script setup lang="ts">
import type { ColorEntry } from '@/screen/types';

defineProps<{
  colors: ColorEntry[];
  modelValue: string;
  label: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

function selectColor(hex: string) {
  emit('update:modelValue', hex);
}
</script>

<template>
  <div class="palette-picker">
    <label class="picker-label">{{ label }}</label>
    <div class="color-swatches">
      <button
        v-for="c in colors"
        :key="c.hex"
        class="swatch"
        :class="{ active: modelValue?.toLowerCase() === c.hex.toLowerCase() }"
        :style="{ backgroundColor: c.hex }"
        :title="c.name"
        @click="selectColor(c.hex)"
      />
    </div>
  </div>
</template>

<style scoped>
.palette-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.picker-label {
  font-size: 11px;
  color: #888;
}

.color-swatches {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.swatch {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.swatch:hover {
  border-color: #666;
}

.swatch.active {
  border-color: #4fc3f7;
}
</style>
