import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ScreenProfile } from '@/screen/types';
import type { BootConfig, EditorMode, PreviewData } from '@/boot/types';

export const useScreenStore = defineStore('screen', () => {
  const profile = ref<ScreenProfile | null>(null);
  const bootConfig = ref<BootConfig | null>(null);

  const mode = computed<EditorMode | null>(() => bootConfig.value?.mode ?? null);
  const previewData = computed<PreviewData | undefined>(() => bootConfig.value?.previewData);

  function setConfig(config: BootConfig) {
    bootConfig.value = config;
    profile.value = config.screen.profile;
  }

  function clear() {
    bootConfig.value = null;
    profile.value = null;
  }

  return { profile, bootConfig, mode, previewData, setConfig, clear };
});
