<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useScreenStore } from '@/stores/screenStore';
import { BootLoader } from '@/boot/BootLoader';
import { BootPhase } from '@/boot/types';

const router = useRouter();
const screenStore = useScreenStore();
const bootLoader = new BootLoader();
const state = bootLoader.getState();

const phaseLabels: Record<string, string> = {
  idle: '准备中...',
  parsing: '解析参数...',
  loading: '加载数据...',
  validating: '验证配置...',
  ready: '就绪!',
  error: '启动失败',
};

function reload() {
  globalThis.location.reload();
}

onMounted(async () => {
  try {
    const config = await bootLoader.resolve();
    screenStore.setConfig(config);
    // Short delay for visual feedback
    await new Promise((r) => setTimeout(r, 300));
    router.replace({ path: '/editor' });
  } catch (err) {
    console.error('[Boot] Failed:', err);
  }
});
</script>

<template>
  <div class="boot-screen">
    <div class="boot-container">
      <h1 class="boot-title">E-ink Template Editor</h1>
      <p class="boot-subtitle">初始化编辑器...</p>

      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{ width: state.progress + '%' }"
          :class="{ error: state.phase === 'error' }"
        ></div>
      </div>

      <p class="boot-phase">{{ phaseLabels[state.phase] || state.phase }}</p>

      <div v-if="state.error" class="boot-error">
        <p class="error-title">⚠ 启动错误</p>
        <p class="error-message">{{ state.error }}</p>
        <button class="retry-btn" @click="reload">重试</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.boot-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%);
  color: #e0e0e0;
  font-family: 'Inter', system-ui, sans-serif;
}

.boot-container {
  text-align: center;
  max-width: 400px;
  padding: 40px;
}

.boot-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  background: linear-gradient(90deg, #64b5f6, #ce93d8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.boot-subtitle {
  font-size: 14px;
  color: #888;
  margin-bottom: 32px;
}

.progress-track {
  width: 100%;
  height: 4px;
  background: #2a2a2a;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #64b5f6, #ce93d8);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-fill.error {
  background: #ef5350;
}

.boot-phase {
  font-size: 13px;
  color: #aaa;
}

.boot-error {
  margin-top: 24px;
  padding: 16px;
  background: rgba(239, 83, 80, 0.1);
  border: 1px solid rgba(239, 83, 80, 0.3);
  border-radius: 8px;
}

.error-title {
  color: #ef5350;
  font-weight: 600;
  margin-bottom: 4px;
}

.error-message {
  font-size: 13px;
  color: #ccc;
  margin-bottom: 12px;
}

.retry-btn {
  padding: 8px 24px;
  background: #ef5350;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.retry-btn:hover {
  background: #e53935;
}
</style>
