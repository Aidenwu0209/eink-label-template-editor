<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useScreenStore } from '@/stores/screenStore';
import { BootLoader } from '@/boot/BootLoader';
import { setAppLocale } from '@/i18n';

const router = useRouter();
const { t } = useI18n();
const screenStore = useScreenStore();
const bootLoader = new BootLoader();
const state = bootLoader.getState();

function reload() {
  globalThis.location.reload();
}

onMounted(async () => {
  try {
    const config = await bootLoader.resolve();
    setAppLocale(config.locale);
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
      <h1 class="boot-title">{{ t('boot.title') }}</h1>
      <p class="boot-subtitle">{{ t('boot.subtitle') }}</p>

      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{ width: state.progress + '%' }"
          :class="{ error: state.phase === 'error' }"
        ></div>
      </div>

      <p class="boot-phase">{{ t(`boot.phases.${state.phase}`) }}</p>

      <div v-if="state.error" class="boot-error">
        <p class="error-title">{{ t('boot.phases.error') }}</p>
        <p class="error-message">{{ state.error }}</p>
        <button class="retry-btn" @click="reload">{{ t('boot.retry') }}</button>
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
  background:
    radial-gradient(circle at 20% 16%, rgba(216, 183, 96, 0.12), transparent 32%),
    radial-gradient(circle at 78% 20%, rgba(141, 188, 246, 0.08), transparent 30%),
    linear-gradient(135deg, var(--app-bg) 0%, #11151c 52%, var(--app-bg-deep) 100%);
  color: var(--text-main);
  font-family: var(--app-font-family);
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
  background: linear-gradient(90deg, var(--text-strong), var(--accent-strong));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.boot-subtitle {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 32px;
}

.progress-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-strong));
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-fill.error {
  background: var(--danger);
}

.boot-phase {
  font-size: 13px;
  color: var(--text-muted);
}

.boot-error {
  margin-top: 24px;
  padding: 16px;
  background: rgba(255, 134, 111, 0.1);
  border: 1px solid rgba(255, 134, 111, 0.3);
  border-radius: 8px;
}

.error-title {
  color: var(--danger);
  font-weight: 600;
  margin-bottom: 4px;
}

.error-message {
  font-size: 13px;
  color: var(--text-main);
  margin-bottom: 12px;
}

.retry-btn {
  padding: 8px 24px;
  background: var(--danger);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.retry-btn:hover {
  filter: brightness(1.08);
}
</style>
