import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigResolver } from '../ConfigResolver';
import { InitDataParser } from '../InitDataParser';
import { BootLoader } from '../BootLoader';
import { BootConfigError } from '../types';
import type { EditorInitPayload } from '../types';
import { MARKET_PROFILES, REGIONAL_PREFERENCE_STORAGE_KEY, setAppLocale } from '@/i18n';

describe('US-001: 外部初始化数据契约', () => {
  let resolver: ConfigResolver;

  beforeEach(() => {
    resolver = new ConfigResolver();
    setAppLocale('zh-CN');
    localStorage.removeItem(REGIONAL_PREFERENCE_STORAGE_KEY);
    delete (globalThis as any).__ESL_EDITOR_INIT__;
    if (typeof window !== 'undefined') {
      delete (window as any).__ESL_EDITOR_INIT__;
      window.history.replaceState(null, '', '/');
    }
  });

  // ═══ AC1: create mode 初始化 ═══

  describe('AC1: create mode 初始化', () => {
    it('接受 mode: "create" 初始化并生成有效 BootConfig', () => {
      const payload: EditorInitPayload = {
        mode: 'create',
        locale: 'zh-CN',
        market: 'CN',
        profile: { width: 296, height: 128, colorMode: 'BWR' },
        previewData: { productName: '测试商品', price: 9.9 },
      };

      const config = resolver.resolveFromPayload(payload);

      expect(config.mode).toBe('create');
      expect(config.canvas.width).toBe(296);
      expect(config.canvas.height).toBe(128);
      expect(config.screen.type).toBe('tri');
      expect(config.previewData?.productName).toBe('测试商品');
      expect(config.previewData?.price).toBe(9.9);
      expect(config.locale).toBe('zh-CN');
      expect(config.market).toBe('CN');
      expect(config.marketProfile).toBe(MARKET_PROFILES.CN);
    });
  });

  describe('Regional preferences', () => {
    it('honors locale and market from payload and merges market sample data', () => {
      const config = resolver.resolveFromPayload({
        mode: 'create',
        locale: 'de',
        market: 'EU',
        profile: { width: 296, height: 128, colorMode: 'BWR' },
        previewData: { productName: 'Bio Milch' },
      });

      expect(config.locale).toBe('de');
      expect(config.market).toBe('EU');
      expect(config.marketProfile.price.currencySymbol).toBe('€');
      expect(config.previewData?.productName).toBe('Bio Milch');
      expect(config.previewData?.barcodeContent).toBe(MARKET_PROFILES.EU.samplePreviewData.barcodeContent);
    });

    it('uses stored regional preferences before payload defaults', () => {
      localStorage.setItem(REGIONAL_PREFERENCE_STORAGE_KEY, JSON.stringify({ locale: 'fr', market: 'EU' }));

      const config = resolver.resolveFromPayload({
        mode: 'create',
        locale: 'zh-CN',
        market: 'CN',
        profile: { width: 296, height: 128, colorMode: 'BW' },
      });

      expect(config.locale).toBe('fr');
      expect(config.market).toBe('EU');
      expect(config.marketProfile.price.currencyCode).toBe('EUR');
    });
  });

  // ═══ AC2: edit mode 初始化 ═══

  describe('AC2: edit mode 初始化', () => {
    it('接受 mode: "edit" 初始化，包含 templateId、profile、fullJson、staticDynamic', () => {
      const payload: EditorInitPayload = {
        mode: 'edit',
        templateId: 'tpl-001',
        templateName: '测试模板',
        profile: { width: 400, height: 300, colorMode: 'BW' },
        fullJson: { version: '5.0', objects: [] },
        staticDynamic: { staticImage: { type: 'base64' } },
        previewData: { productName: '编辑商品' },
      };

      const config = resolver.resolveFromPayload(payload);

      expect(config.mode).toBe('edit');
      expect(config.template?.id).toBe('tpl-001');
      expect(config.templateName).toBe('测试模板');
      expect(config.template?.data).toEqual({ version: '5.0', objects: [] });
      expect(config.staticDynamic).toEqual({ staticImage: { type: 'base64' } });
    });
  });

  // ═══ AC3: mode 缺失或非法 → 初始化错误 ═══

  describe('AC3: mode 缺失或非法时显示明确错误', () => {
    it('mode 为 undefined 时抛出 BootConfigError', () => {
      const payload = {
        profile: { width: 296, height: 128, colorMode: 'BW' as const },
      } as unknown as EditorInitPayload;

      expect(() => resolver.resolveFromPayload(payload)).toThrow(BootConfigError);
      expect(() => resolver.resolveFromPayload(payload)).toThrow('mode');
    });

    it('mode 为 "invalid" 时抛出 BootConfigError', () => {
      const payload = {
        mode: 'invalid',
        profile: { width: 296, height: 128, colorMode: 'BW' },
      } as unknown as EditorInitPayload;

      expect(() => resolver.resolveFromPayload(payload)).toThrow(BootConfigError);
      expect(() => resolver.resolveFromPayload(payload)).toThrow('create');
    });
  });

  // ═══ AC4: profile.width / profile.height 验证 ═══

  describe('AC4: profile 尺寸验证', () => {
    const validProfile = { width: 296, height: 128, colorMode: 'BW' as const };

    it('width 缺失时抛出 BootConfigError', () => {
      const payload = {
        mode: 'create' as const,
        profile: { height: 128, colorMode: 'BW' as const },
      } as unknown as EditorInitPayload;

      expect(() => resolver.resolveFromPayload(payload)).toThrow(BootConfigError);
      expect(() => resolver.resolveFromPayload(payload)).toThrow('width');
    });

    it('height 缺失时抛出 BootConfigError', () => {
      const payload = {
        mode: 'create' as const,
        profile: { width: 296, colorMode: 'BW' as const },
      } as unknown as EditorInitPayload;

      expect(() => resolver.resolveFromPayload(payload)).toThrow(BootConfigError);
      expect(() => resolver.resolveFromPayload(payload)).toThrow('height');
    });

    it('width 为非数字字符串时抛出 BootConfigError', () => {
      const payload = {
        mode: 'create' as const,
        profile: { width: 'abc', height: 128, colorMode: 'BW' as const },
      } as unknown as EditorInitPayload;

      expect(() => resolver.resolveFromPayload(payload)).toThrow(BootConfigError);
      expect(() => resolver.resolveFromPayload(payload)).toThrow('数字');
    });

    it('width <= 0 时抛出 BootConfigError', () => {
      const payload = {
        mode: 'create' as const,
        profile: { width: -10, height: 128, colorMode: 'BW' as const },
      } as unknown as EditorInitPayload;

      expect(() => resolver.resolveFromPayload(payload)).toThrow(BootConfigError);
      expect(() => resolver.resolveFromPayload(payload)).toThrow('大于 0');
    });

    it('height 为 0 时抛出 BootConfigError', () => {
      const payload = {
        mode: 'create' as const,
        profile: { width: 296, height: 0, colorMode: 'BW' as const },
      } as unknown as EditorInitPayload;

      expect(() => resolver.resolveFromPayload(payload)).toThrow(BootConfigError);
    });
  });

  // ═══ AC5: 有效 create 初始化 → 编辑器工作区可用（单元测试验证逻辑链路） ═══

  describe('AC5: 有效 create 初始化 → 生成完整 BootConfig（编辑器工作区可用前提）', () => {
    it('BootLoader.resolve() 使用有效 create payload 生成 BootConfig（phase=ready）', async () => {
      const payload: EditorInitPayload = {
        mode: 'create',
        profile: { width: 296, height: 128, colorMode: 'BWR' },
        previewData: { productName: '牛奶', price: 12.5 },
      };

      // 模拟 window.__ESL_EDITOR_INIT__
      (globalThis as any).__ESL_EDITOR_INIT__ = payload;

      const bootLoader = new BootLoader();
      const config = await bootLoader.resolve();
      const state = bootLoader.getState();

      expect(state.phase).toBe('ready');
      expect(state.error).toBeUndefined();
      expect(config.mode).toBe('create');
      expect(config.canvas.width).toBe(296);
      expect(config.canvas.height).toBe(128);
      expect(config.screen.profile.palette.length).toBeGreaterThan(0);
      expect(config.previewData?.productName).toBe('牛奶');

      // 清理
      delete (globalThis as any).__ESL_EDITOR_INIT__;
    });
  });

  // ═══ AC6: 无效 profile → 初始化失败（显示错误信息） ═══

  describe('AC6: 无效 profile → 初始化失败消息', () => {
    it('BootLoader.resolve() 使用无效 profile 时进入 error 状态并显示错误', async () => {
      const payload = {
        mode: 'create',
        profile: { width: -1, height: 0, colorMode: 'BW' },
      } as EditorInitPayload;

      (globalThis as any).__ESL_EDITOR_INIT__ = payload;

      const bootLoader = new BootLoader();
      const state = bootLoader.getState();

      await expect(bootLoader.resolve()).rejects.toThrow();

      expect(state.phase).toBe('error');
      expect(state.error).toBeTruthy();
      expect(state.error).toContain('初始化失败');

      delete (globalThis as any).__ESL_EDITOR_INIT__;
    });

    it('BootLoader.resolve() 缺少 mode 时进入 error 状态', async () => {
      const payload = {
        profile: { width: 296, height: 128, colorMode: 'BW' },
      } as unknown as EditorInitPayload;

      (globalThis as any).__ESL_EDITOR_INIT__ = payload;

      const bootLoader = new BootLoader();

      await expect(bootLoader.resolve()).rejects.toThrow();

      const state = bootLoader.getState();
      expect(state.phase).toBe('error');
      expect(state.error).toContain('mode');

      delete (globalThis as any).__ESL_EDITOR_INIT__;
    });
  });

  // ═══ InitDataParser 覆盖 ═══

  describe('InitDataParser: 从多种来源解析初始化数据', () => {
    it('优先从 window.__ESL_EDITOR_INIT__ 解析', () => {
      const payload: EditorInitPayload = {
        mode: 'create',
        profile: { width: 200, height: 100, colorMode: 'BW' },
      };

      (globalThis as any).__ESL_EDITOR_INIT__ = payload;
      const result = InitDataParser.parse();

      expect(result).toEqual(payload);

      delete (globalThis as any).__ESL_EDITOR_INIT__;
    });

    it('从 URL ?init=<base64> 参数解析', () => {
      const payload: EditorInitPayload = {
        mode: 'create',
        profile: { width: 200, height: 100, colorMode: 'BW' },
      };
      const encoded = btoa(JSON.stringify(payload));

      // 模拟 URL search params
      window.history.replaceState(null, '', `/?init=${encoded}`);

      const result = InitDataParser.parse();
      expect(result).toEqual(payload);
    });

    it('无初始化数据时返回 null', () => {
      delete (globalThis as any).__ESL_EDITOR_INIT__;
      window.history.replaceState(null, '', '/');

      expect(InitDataParser.parse()).toBeNull();
    });
  });

  describe('URL 参数初始化兼容后端跳转', () => {
    it('使用普通 URL 参数初始化模板尺寸、色彩模式、名称和保存地址', () => {
      const config = resolver.resolve({
        urlParams: {
          templateId: '12',
          templateName: '门店黑白红模板',
          width: '296',
          height: '128',
          colorMode: 'BWR',
          apiBase: 'http://127.0.0.1:8080/api',
          saveApi: 'http://127.0.0.1:8080/api/template/save',
          saveExportMode: 'fabric-json',
          locale: 'zh-CN',
          market: 'CN',
        },
      });

      expect(config.mode).toBe('edit');
      expect(config.canvas.width).toBe(296);
      expect(config.canvas.height).toBe(128);
      expect(config.screen.type).toBe('tri');
      expect(config.template?.id).toBe('12');
      expect(config.templateName).toBe('门店黑白红模板');
      expect(config.api.baseUrl).toBe('http://127.0.0.1:8080/api');
      expect(config.saveApi).toBe('http://127.0.0.1:8080/api/template/save');
      expect(config.saveExportMode).toBe('fabric-json');
      expect(config.locale).toBe('zh-CN');
      expect(config.market).toBe('CN');
    });

    it('优先使用后端返回的模板 JSON，并保留 URL 中的保存地址', () => {
      const config = resolver.resolve({
        urlParams: {
          templateId: '8',
          width: '250',
          height: '122',
          colorMode: 'BW',
          saveApi: '/api/template/save',
        },
        remoteTemplate: {
          id: '8',
          name: '远端模板',
          meta: { colorMode: 'BWRY', width: 400, height: 300 },
          fabricJson: { version: '5.0', objects: [{ type: 'rect', left: 0, top: 0, width: 10, height: 10 }] },
        },
      });

      expect(config.template?.data.objects).toHaveLength(1);
      expect(config.templateName).toBe('远端模板');
      expect(config.canvas.width).toBe(250);
      expect(config.canvas.height).toBe(122);
      expect(config.screen.type).toBe('bw');
      expect(config.saveApi).toBe('/api/template/save');
    });
  });

  // ═══ colorMode 映射验证 ═══

  describe('colorMode 到 ScreenType 的映射', () => {
    it.each([
      ['BW', 'bw', 2],
      ['BWR', 'tri', 3],
      ['BWRY', 'bwry', 4],
      ['E6', 'six', 7],
    ] as const)('colorMode=%s → screenType=%s, palette 包含 %d 色',
      (colorMode, expectedType, expectedColors) => {
        const payload: EditorInitPayload = {
          mode: 'create',
          profile: { width: 296, height: 128, colorMode },
        };

        const config = resolver.resolveFromPayload(payload);
        expect(config.screen.type).toBe(expectedType);
        expect(config.screen.palette.length).toBeGreaterThanOrEqual(expectedColors);
      }
    );
  });
});
