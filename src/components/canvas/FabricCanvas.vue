<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  width: number;
  height: number;
}>();

const canvasRef = ref<HTMLCanvasElement>();

// Expose the raw HTMLCanvasElement (not the ref)
defineExpose({
  get canvasElement() {
    return canvasRef.value;
  },
});
</script>

<template>
  <div class="fabric-canvas-wrapper">
    <canvas
      ref="canvasRef"
      :width="props.width"
      :height="props.height"
    ></canvas>
  </div>
</template>

<style scoped>
.fabric-canvas-wrapper {
  border: 1px solid var(--line-soft);
  border-radius: 4px;
  overflow: hidden;
  background: #111316;
  display: inline-block;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
}
</style>
