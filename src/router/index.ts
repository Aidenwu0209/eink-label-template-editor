import { createRouter, createWebHistory } from 'vue-router';
import { useScreenStore } from '@/stores/screenStore';

const routes = [
  {
    path: '/',
    redirect: '/boot',
  },
  {
    path: '/boot',
    name: 'boot',
    component: () => import('@/views/BootView.vue'),
  },
  {
    path: '/editor',
    name: 'editor',
    component: () => import('@/views/EditorView.vue'),
    beforeEnter: (to: any, _from: any, next: any) => {
      const screenStore = useScreenStore();
      if (!screenStore.bootConfig) {
        // Not booted — redirect to boot with original query params
        next({ path: '/boot', query: to.query });
      } else {
        next();
      }
    },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
