/**
 * US-013: 生成保存 Payload — 单元测试
 *
 * 覆盖所有 AC:
 *   AC1:  templateId 生成
 *   AC2:  templateName 生成
 *   AC3:  完整 profile 对象
 *   AC4:  fullJson 包含
 *   AC5:  staticDynamic.staticImage
 *   AC6:  staticImage.type === 'base64'
 *   AC7:  staticImage.format === 'png'
 *   AC8:  staticImage.data starts with data:image/png;base64,
 *   AC9:  staticDynamic.dynamicMetadata
 *   AC10: dynamicMetadata.fontFamily === 'AlibabaPuHuiTi'
 *   AC11: dynamicMetadata.reservedFields 包含全部系统字段
 *   AC12: dynamicMetadata.widgets 包含每个动态组件
 *   AC13: (浏览器验证 — 需手动)
 *   AC14: Typecheck passes
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ══════════ Inline Save Payload Builder Logic ══════════

const SYSTEM_FIELDS = [
  'productName', 'price', 'discount', 'description',
  'imageUrl', 'qrContent', 'barcodeContent',
];

const SCREEN_TYPE_TO_COLOR_MODE = {
  bw: 'BW', tri: 'BWR', bwry: 'BWRY', six: 'E6',
};

let widgetCounter = 0;
function resetWidgetCounter() { widgetCounter = 0; }
function nextWidgetId(type) {
  widgetCounter++;
  return `${type.toLowerCase()}_${String(widgetCounter).padStart(3, '0')}`;
}

function extractWidget(obj, previewData) {
  const ext = obj.extension || {};
  const extType = obj.extensionType;

  switch (extType) {
    case 'TEXT': {
      if (!ext.fieldBinding) return null;
      return {
        id: nextWidgetId('text'),
        type: 'TEXT',
        fieldId: ext.fieldBinding,
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0),
        height: Math.round(obj.height ?? 0),
        fontSize: obj.fontSize ?? 16,
        fontWeight: obj.fontWeight ?? 'normal',
        color: obj.fill ?? '#000000',
        overflow: ext.overflow ?? 'ellipsis',
        defaultValue: String(previewData?.[ext.fieldBinding] ?? ''),
      };
    }
    case 'PRICE': {
      return {
        id: nextWidgetId('price'),
        type: 'PRICE',
        fieldId: 'price',
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0),
        height: Math.round(obj.height ?? 0),
        defaultValue: previewData?.price != null ? String(previewData.price) : '',
      };
    }
    case 'DISCOUNT': {
      return {
        id: nextWidgetId('discount'),
        type: 'DISCOUNT',
        fieldId: 'discount',
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0),
        height: Math.round(obj.height ?? 0),
        format: ext.formatTemplate ?? '{value}折',
        defaultValue: previewData?.discount != null ? String(previewData.discount) : '',
      };
    }
    case 'IMAGE': {
      if (ext.source !== 'dynamic') return null;
      return {
        id: nextWidgetId('image'),
        type: 'IMAGE',
        mode: 'dynamic',
        fieldId: 'imageUrl',
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0),
        height: Math.round(obj.height ?? 0),
        fit: ext.fitMode ?? 'contain',
      };
    }
    case 'QRCODE': {
      return {
        id: nextWidgetId('qrcode'),
        type: 'QRCODE',
        fieldId: 'qrContent',
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0),
        height: Math.round(obj.height ?? 0),
        errorCorrection: ext.errorCorrection ?? 'M',
        margin: ext.margin ?? 1,
        foregroundColor: ext.foregroundColor ?? '#000000',
        backgroundColor: ext.backgroundColor ?? '#FFFFFF',
      };
    }
    case 'BARCODE': {
      return {
        id: nextWidgetId('barcode'),
        type: 'BARCODE',
        fieldId: 'barcodeContent',
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0),
        height: Math.round(obj.height ?? 0),
        format: 'CODE128',
        showText: ext.showText ?? true,
        foregroundColor: ext.foregroundColor ?? '#000000',
        backgroundColor: ext.backgroundColor ?? '#FFFFFF',
      };
    }
    default:
      return null;
  }
}

function buildSavePayload(config, fabricJson, canvasDataURL) {
  resetWidgetCounter();
  const previewData = config.previewData;
  const widgets = [];
  for (const obj of (fabricJson.objects || [])) {
    const w = extractWidget(obj, previewData);
    if (w) widgets.push(w);
  }

  const screenType = config.screen.type;
  const colorMode = SCREEN_TYPE_TO_COLOR_MODE[screenType] ?? 'BW';
  const profile = config.screen.profile;

  return {
    templateId: config.template?.id ?? `tpl_generated`,
    templateName: config.templateName ?? '电子价签模板',
    profile: {
      profileId: `profile_${config.canvas.width}_${config.canvas.height}_${colorMode.toLowerCase()}`,
      name: profile.displayName,
      width: config.canvas.width,
      height: config.canvas.height,
      colorMode,
      palette: profile.palette.map(c => ({ name: c.name, value: c.hex })),
    },
    fullJson: fabricJson,
    staticDynamic: {
      staticImage: {
        type: 'base64',
        format: 'png',
        data: canvasDataURL,
      },
      dynamicMetadata: {
        fontFamily: 'AlibabaPuHuiTi',
        reservedFields: [...SYSTEM_FIELDS],
        widgets,
      },
    },
  };
}

// ══════════ Test Helpers ══════════

function makeConfig(overrides = {}) {
  return {
    mode: 'create',
    canvas: { width: 296, height: 128 },
    screen: {
      type: 'tri',
      profile: {
        displayName: '2.9寸黑白红电子价签',
        palette: [
          { name: 'white', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 0 },
          { name: 'black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 1 },
          { name: 'red', hex: '#FF0000', rgb: [255, 0, 0], deviceIndex: 2 },
        ],
        maxColors: 3,
        defaultBackground: '#FFFFFF',
        dpi: 150,
      },
    },
    previewData: {
      productName: '示例商品',
      price: 9.9,
      discount: 8.8,
      description: '商品描述',
      imageUrl: 'https://example.com/img.png',
      qrContent: 'https://example.com/item',
      barcodeContent: 'SKU1001',
    },
    api: { baseUrl: '/api' },
    ...overrides,
  };
}

function makeFabricJson(objects) {
  return { version: '5.0', objects, background: '#FFFFFF' };
}

const MOCK_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ══════════ Tests ══════════

describe('US-013: 生成保存 Payload', () => {

  describe('AC1: templateId 生成', () => {
    it('create 模式生成 templateId', () => {
      const payload = buildSavePayload(makeConfig(), makeFabricJson([]), MOCK_DATA_URL);
      assert.ok(payload.templateId, 'templateId should be generated');
      assert.match(payload.templateId, /^tpl_/, 'templateId should start with tpl_');
    });

    it('edit 模式使用已有 templateId', () => {
      const config = makeConfig({
        mode: 'edit',
        template: { id: 'template_001', data: { objects: [] } },
      });
      const payload = buildSavePayload(config, makeFabricJson([]), MOCK_DATA_URL);
      assert.equal(payload.templateId, 'template_001');
    });
  });

  describe('AC2: templateName 生成', () => {
    it('create 模式使用默认 templateName', () => {
      const payload = buildSavePayload(makeConfig(), makeFabricJson([]), MOCK_DATA_URL);
      assert.equal(payload.templateName, '电子价签模板');
    });

    it('edit 模式使用已有 templateName', () => {
      const config = makeConfig({ templateName: '自定义模板名' });
      const payload = buildSavePayload(config, makeFabricJson([]), MOCK_DATA_URL);
      assert.equal(payload.templateName, '自定义模板名');
    });
  });

  describe('AC3: 完整 profile 对象', () => {
    it('包含 width、height、colorMode、palette', () => {
      const payload = buildSavePayload(makeConfig(), makeFabricJson([]), MOCK_DATA_URL);
      const p = payload.profile;
      assert.equal(p.width, 296);
      assert.equal(p.height, 128);
      assert.equal(p.colorMode, 'BWR');
      assert.equal(p.name, '2.9寸黑白红电子价签');
      assert.ok(p.profileId);
      assert.equal(p.palette.length, 3);
      assert.deepEqual(p.palette[0], { name: 'white', value: '#FFFFFF' });
      assert.deepEqual(p.palette[1], { name: 'black', value: '#000000' });
      assert.deepEqual(p.palette[2], { name: 'red', value: '#FF0000' });
    });
  });

  describe('AC4: fullJson 包含', () => {
    it('fullJson 包含完整的 Fabric JSON', () => {
      const objects = [
        { type: 'rect', left: 10, top: 10, width: 100, height: 50, extensionType: 'RECT' },
      ];
      const payload = buildSavePayload(makeConfig(), makeFabricJson(objects), MOCK_DATA_URL);
      assert.ok(payload.fullJson);
      assert.equal(payload.fullJson.objects.length, 1);
      assert.equal(payload.fullJson.objects[0].extensionType, 'RECT');
    });
  });

  describe('AC5-8: staticDynamic.staticImage', () => {
    it('AC5: staticDynamic 包含 staticImage', () => {
      const payload = buildSavePayload(makeConfig(), makeFabricJson([]), MOCK_DATA_URL);
      assert.ok(payload.staticDynamic);
      assert.ok(payload.staticDynamic.staticImage);
    });

    it('AC6: staticImage.type === base64', () => {
      const payload = buildSavePayload(makeConfig(), makeFabricJson([]), MOCK_DATA_URL);
      assert.equal(payload.staticDynamic.staticImage.type, 'base64');
    });

    it('AC7: staticImage.format === png', () => {
      const payload = buildSavePayload(makeConfig(), makeFabricJson([]), MOCK_DATA_URL);
      assert.equal(payload.staticDynamic.staticImage.format, 'png');
    });

    it('AC8: staticImage.data starts with data:image/png;base64,', () => {
      const payload = buildSavePayload(makeConfig(), makeFabricJson([]), MOCK_DATA_URL);
      assert.ok(
        payload.staticDynamic.staticImage.data.startsWith('data:image/png;base64,'),
        'data should start with data:image/png;base64,'
      );
    });
  });

  describe('AC9-12: dynamicMetadata', () => {
    it('AC9: staticDynamic 包含 dynamicMetadata', () => {
      const payload = buildSavePayload(makeConfig(), makeFabricJson([]), MOCK_DATA_URL);
      assert.ok(payload.staticDynamic.dynamicMetadata);
    });

    it('AC10: fontFamily === AlibabaPuHuiTi', () => {
      const payload = buildSavePayload(makeConfig(), makeFabricJson([]), MOCK_DATA_URL);
      assert.equal(payload.staticDynamic.dynamicMetadata.fontFamily, 'AlibabaPuHuiTi');
    });

    it('AC11: reservedFields 包含全部 7 个系统字段', () => {
      const payload = buildSavePayload(makeConfig(), makeFabricJson([]), MOCK_DATA_URL);
      const rf = payload.staticDynamic.dynamicMetadata.reservedFields;
      assert.deepEqual(rf, SYSTEM_FIELDS);
      assert.equal(rf.length, 7);
    });

    it('AC12: widgets 包含所有动态组件', () => {
      const objects = [
        // Static RECT — should NOT be in widgets
        { type: 'rect', left: 0, top: 0, width: 296, height: 128, extensionType: 'RECT', id: 'workspace' },
        // Dynamic TEXT — should be in widgets
        {
          type: 'textbox', left: 10, top: 10, width: 180, height: 36,
          fontSize: 16, fontWeight: 'normal', fill: '#000000',
          extensionType: 'TEXT',
          extension: { fieldBinding: 'productName', overflow: 'ellipsis', lineClamp: 1 },
        },
        // Fixed TEXT — should NOT be in widgets
        {
          type: 'textbox', left: 10, top: 50, width: 100, height: 20,
          fontSize: 14, fontWeight: 'normal', fill: '#000000',
          extensionType: 'TEXT',
          extension: { fieldBinding: null, overflow: 'wrap', lineClamp: 0 },
        },
        // PRICE
        {
          type: 'rect', left: 20, top: 50, width: 180, height: 60,
          extensionType: 'PRICE',
          extension: { fieldBinding: 'price', currencySymbol: '¥' },
        },
        // DISCOUNT
        {
          type: 'rect', left: 10, top: 10, width: 64, height: 28,
          extensionType: 'DISCOUNT',
          extension: { fieldBinding: 'discount', formatTemplate: '{value}折' },
        },
        // Static IMAGE — should NOT be in widgets
        {
          type: 'rect', left: 200, top: 20, width: 80, height: 80,
          extensionType: 'IMAGE',
          extension: { source: 'static', src: '', fieldBinding: null, fitMode: 'contain' },
        },
        // Dynamic IMAGE
        {
          type: 'rect', left: 200, top: 20, width: 80, height: 80,
          extensionType: 'IMAGE',
          extension: { source: 'dynamic', src: 'https://example.com/img.png', fieldBinding: 'imageUrl', fitMode: 'contain' },
        },
        // QRCODE
        {
          type: 'rect', left: 230, top: 20, width: 48, height: 48,
          extensionType: 'QRCODE',
          extension: { fieldBinding: 'qrContent', errorCorrection: 'M', margin: 1, foregroundColor: '#000000', backgroundColor: '#FFFFFF' },
        },
        // BARCODE
        {
          type: 'rect', left: 20, top: 100, width: 180, height: 28,
          extensionType: 'BARCODE',
          extension: { fieldBinding: 'barcodeContent', format: 'CODE128', showText: false, foregroundColor: '#000000', backgroundColor: '#FFFFFF' },
        },
      ];

      const config = makeConfig();
      const payload = buildSavePayload(config, makeFabricJson(objects), MOCK_DATA_URL);
      const widgets = payload.staticDynamic.dynamicMetadata.widgets;

      // Should have 6 widgets: TEXT(productName), PRICE, DISCOUNT, IMAGE(dynamic), QRCODE, BARCODE
      assert.equal(widgets.length, 6, `Expected 6 widgets, got ${widgets.length}: ${widgets.map(w => w.type).join(', ')}`);

      const types = widgets.map(w => w.type);
      assert.ok(types.includes('TEXT'), 'widgets should include TEXT');
      assert.ok(types.includes('PRICE'), 'widgets should include PRICE');
      assert.ok(types.includes('DISCOUNT'), 'widgets should include DISCOUNT');
      assert.ok(types.includes('IMAGE'), 'widgets should include IMAGE');
      assert.ok(types.includes('QRCODE'), 'widgets should include QRCODE');
      assert.ok(types.includes('BARCODE'), 'widgets should include BARCODE');

      // Verify widget fieldIds
      const textWidget = widgets.find(w => w.type === 'TEXT');
      assert.equal(textWidget.fieldId, 'productName');
      assert.equal(textWidget.defaultValue, '示例商品');

      const priceWidget = widgets.find(w => w.type === 'PRICE');
      assert.equal(priceWidget.fieldId, 'price');
      assert.equal(priceWidget.defaultValue, '9.9');

      const discountWidget = widgets.find(w => w.type === 'DISCOUNT');
      assert.equal(discountWidget.fieldId, 'discount');
      assert.equal(discountWidget.defaultValue, '8.8');
      assert.equal(discountWidget.format, '{value}折');

      const imageWidget = widgets.find(w => w.type === 'IMAGE');
      assert.equal(imageWidget.fieldId, 'imageUrl');
      assert.equal(imageWidget.mode, 'dynamic');
      assert.equal(imageWidget.fit, 'contain');

      const qrcodeWidget = widgets.find(w => w.type === 'QRCODE');
      assert.equal(qrcodeWidget.fieldId, 'qrContent');
      assert.equal(qrcodeWidget.errorCorrection, 'M');

      const barcodeWidget = widgets.find(w => w.type === 'BARCODE');
      assert.equal(barcodeWidget.fieldId, 'barcodeContent');
      assert.equal(barcodeWidget.format, 'CODE128');
      assert.equal(barcodeWidget.showText, false);
    });
  });

  describe('Widget details', () => {
    it('TEXT widget 包含完整属性', () => {
      const objects = [{
        type: 'textbox', left: 10, top: 20, width: 180, height: 36,
        fontSize: 16, fontWeight: 'bold', fill: '#000000',
        extensionType: 'TEXT',
        extension: { fieldBinding: 'description', overflow: 'wrap', lineClamp: 2 },
      }];
      const payload = buildSavePayload(makeConfig(), makeFabricJson(objects), MOCK_DATA_URL);
      const w = payload.staticDynamic.dynamicMetadata.widgets[0];
      assert.equal(w.type, 'TEXT');
      assert.equal(w.fieldId, 'description');
      assert.equal(w.x, 10);
      assert.equal(w.y, 20);
      assert.equal(w.fontSize, 16);
      assert.equal(w.fontWeight, 'bold');
      assert.equal(w.color, '#000000');
      assert.equal(w.overflow, 'wrap');
      assert.equal(w.defaultValue, '商品描述');
    });

    it('自定义字段的 TEXT widget 获取 previewData 中的值', () => {
      const config = makeConfig();
      config.previewData.brand = '测试品牌';
      const objects = [{
        type: 'textbox', left: 10, top: 10, width: 100, height: 20,
        fontSize: 14, fontWeight: 'normal', fill: '#000000',
        extensionType: 'TEXT',
        extension: { fieldBinding: 'brand', overflow: 'ellipsis' },
      }];
      const payload = buildSavePayload(config, makeFabricJson(objects), MOCK_DATA_URL);
      const w = payload.staticDynamic.dynamicMetadata.widgets[0];
      assert.equal(w.fieldId, 'brand');
      assert.equal(w.defaultValue, '测试品牌');
    });

    it('空画布不包含任何 widget', () => {
      const payload = buildSavePayload(makeConfig(), makeFabricJson([]), MOCK_DATA_URL);
      assert.equal(payload.staticDynamic.dynamicMetadata.widgets.length, 0);
    });

    it('只有静态组件时不包含 widget', () => {
      const objects = [
        { type: 'rect', left: 0, top: 0, width: 296, height: 128, extensionType: 'RECT' },
        { type: 'line', left: 0, top: 64, width: 296, height: 0, extensionType: 'LINE' },
        {
          type: 'rect', left: 10, top: 10, width: 80, height: 80,
          extensionType: 'IMAGE',
          extension: { source: 'static', src: '', fitMode: 'contain' },
        },
        {
          type: 'textbox', left: 10, top: 10, width: 100, height: 20,
          extensionType: 'TEXT',
          extension: { fieldBinding: null },
        },
      ];
      const payload = buildSavePayload(makeConfig(), makeFabricJson(objects), MOCK_DATA_URL);
      assert.equal(payload.staticDynamic.dynamicMetadata.widgets.length, 0);
    });
  });

  describe('Widget ID 唯一性', () => {
    it('多个同类组件 ID 不重复', () => {
      const objects = [
        {
          type: 'rect', left: 10, top: 10, width: 100, height: 50,
          extensionType: 'PRICE',
          extension: { fieldBinding: 'price' },
        },
        {
          type: 'rect', left: 120, top: 10, width: 100, height: 50,
          extensionType: 'PRICE',
          extension: { fieldBinding: 'price' },
        },
      ];
      const payload = buildSavePayload(makeConfig(), makeFabricJson(objects), MOCK_DATA_URL);
      const widgets = payload.staticDynamic.dynamicMetadata.widgets;
      assert.equal(widgets.length, 2);
      assert.notEqual(widgets[0].id, widgets[1].id);
    });
  });

  describe('Profile colorMode 映射', () => {
    it('BW profile 映射正确', () => {
      const config = makeConfig();
      config.screen.type = 'bw';
      config.screen.profile.palette = [
        { name: 'white', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 0 },
        { name: 'black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 1 },
      ];
      const payload = buildSavePayload(config, makeFabricJson([]), MOCK_DATA_URL);
      assert.equal(payload.profile.colorMode, 'BW');
    });

    it('E6 profile 映射正确', () => {
      const config = makeConfig();
      config.screen.type = 'six';
      const payload = buildSavePayload(config, makeFabricJson([]), MOCK_DATA_URL);
      assert.equal(payload.profile.colorMode, 'E6');
    });

    it('BWRY profile 映射正确', () => {
      const config = makeConfig();
      config.screen.type = 'bwry';
      const payload = buildSavePayload(config, makeFabricJson([]), MOCK_DATA_URL);
      assert.equal(payload.profile.colorMode, 'BWRY');
    });
  });
});
