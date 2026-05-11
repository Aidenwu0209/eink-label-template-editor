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
  gap: 6px;
  min-width: 0;
}

.picker-label {
  font-size: 12px;
  color: #a69f95;
  font-weight: 750;
}

.color-swatches {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.swatch {
  width: 30px;
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
}

.swatch:hover {
  transform: translateY(-1px);
  border-color: rgba(240, 211, 91, 0.58);
}

.swatch.active {
  border-color: #f0d35b;
  box-shadow: 0 0 0 3px rgba(240, 211, 91, 0.16), inset 0 0 0 1px rgba(0, 0, 0, 0.18);
}
</style>
