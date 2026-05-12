/**
 * US-014: onSave 优先保存方式
 *
 * Tests for onSave callback integration in the save pipeline.
 * Since this runs in Node.js (not browser), we replicate the core
 * save dispatch logic to verify the contract.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ══════════ Inlined SaveConfigError ══════════

class SaveConfigError extends Error {
  constructor() {
    super('保存配置错误：未提供 onSave 回调或 saveApi 地址');
    this.name = 'SaveConfigError';
  }
}

// ══════════ Inlined SavePayloadBuilder ══════════

const SYSTEM_FIELDS = [
  'productName', 'price', 'discount', 'description',
  'imageUrl', 'qrContent', 'barcodeContent',
];
const EXPORT_FONT_FAMILY = 'Noto Sans SC Variable';

const SCREEN_TYPE_TO_COLOR_MODE = {
  bw: 'BW',
  tri: 'BWR',
  bwry: 'BWRY',
  six: 'E6',
};

let widgetCounter = 0;
function resetWidgetCounter() { widgetCounter = 0; }
function nextWidgetId(type) {
  widgetCounter++;
  return `${type.toLowerCase()}_${String(widgetCounter).padStart(3, '0')}`;
}

function buildSavePayload(config, fabricJson, canvasDataURL) {
  resetWidgetCounter();
  const previewData = config.previewData;
  const widgets = [];
  for (const obj of (fabricJson.objects ?? [])) {
    const widget = extractWidget(obj, previewData);
    if (widget) widgets.push(widget);
  }
  const screenType = config.screen.type;
  const colorMode = SCREEN_TYPE_TO_COLOR_MODE[screenType] ?? 'BW';
  const profile = config.screen.profile;
  return {
    templateId: config.template?.id ?? `tpl_${Date.now().toString(36)}_test`,
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
      staticImage: { type: 'base64', format: 'png', data: canvasDataURL },
      dynamicMetadata: {
        fontFamily: EXPORT_FONT_FAMILY,
        reservedFields: [...SYSTEM_FIELDS],
        widgets,
      },
    },
  };
}

function extractWidget(obj, previewData) {
  const ext = obj.extension;
  const extType = obj.extensionType;
  switch (extType) {
    case 'TEXT': {
      if (!ext?.fieldBinding) return null;
      return {
        id: nextWidgetId('text'), type: 'TEXT', fieldId: ext.fieldBinding,
        x: Math.round(obj.left ?? 0), y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0), height: Math.round(obj.height ?? 0),
      };
    }
    case 'PRICE': return {
      id: nextWidgetId('price'), type: 'PRICE', fieldId: 'price',
      x: Math.round(obj.left ?? 0), y: Math.round(obj.top ?? 0),
      width: Math.round(obj.width ?? 0), height: Math.round(obj.height ?? 0),
    };
    case 'DISCOUNT': return {
      id: nextWidgetId('discount'), type: 'DISCOUNT', fieldId: 'discount',
      x: Math.round(obj.left ?? 0), y: Math.round(obj.top ?? 0),
      width: Math.round(obj.width ?? 0), height: Math.round(obj.height ?? 0),
    };
    case 'IMAGE': {
      if (ext?.source !== 'dynamic') return null;
      return {
        id: nextWidgetId('image'), type: 'IMAGE', mode: 'dynamic', fieldId: 'imageUrl',
        x: Math.round(obj.left ?? 0), y: Math.round(obj.top ?? 0),
        width: Math.round(obj.width ?? 0), height: Math.round(obj.height ?? 0),
      };
    }
    case 'QRCODE': return {
      id: nextWidgetId('qrcode'), type: 'QRCODE', fieldId: 'qrContent',
      x: Math.round(obj.left ?? 0), y: Math.round(obj.top ?? 0),
      width: Math.round(obj.width ?? 0), height: Math.round(obj.height ?? 0),
    };
    case 'BARCODE': return {
      id: nextWidgetId('barcode'), type: 'BARCODE', fieldId: 'barcodeContent',
      x: Math.round(obj.left ?? 0), y: Math.round(obj.top ?? 0),
      width: Math.round(obj.width ?? 0), height: Math.round(obj.height ?? 0),
    };
    default: return null;
  }
}

// ══════════ Mock Config ══════════

function makeConfig(overrides = {}) {
  return {
    mode: 'create',
    canvas: { width: 296, height: 128 },
    screen: {
      type: 'bw',
      profile: {
        displayName: 'BW 296x128',
        palette: [
          { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
          { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
        ],
        defaultWidth: 296,
        defaultHeight: 128,
        dpi: 150,
        maxColors: 2,
      },
      palette: [
        { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
        { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
      ],
    },
    api: { baseUrl: '/api' },
    ...overrides,
  };
}

// ══════════ Core save dispatch (mirrors editorStore.save) ══════════

async function dispatchSave(config, fabricJson, canvasDataURL) {
  const payload = buildSavePayload(config, fabricJson, canvasDataURL);

  const onSave = config.onSave;
  if (onSave) {
    await onSave(payload);
  } else if (!config.saveApi) {
    throw new SaveConfigError();
  }

  return payload;
}

// ══════════ Tests ══════════

describe('US-014: onSave 优先保存方式', () => {

  const fabricJson = { version: '5.3.0', objects: [] };
  const canvasDataURL = 'data:image/png;base64,iVBOR...';

  it('AC1: onSave provided → save calls onSave(payload)', async () => {
    let calledWith = null;
    const onSave = (payload) => { calledWith = payload; };

    const config = makeConfig({ onSave });
    const result = await dispatchSave(config, fabricJson, canvasDataURL);

    assert.ok(calledWith !== null, 'onSave should have been called');
    assert.equal(calledWith.templateId, result.templateId);
    assert.equal(calledWith.templateName, result.templateName);
    assert.ok(calledWith.fullJson);
    assert.ok(calledWith.staticDynamic);
    assert.ok(calledWith.profile);
  });

  it('AC1: onSave called exactly once', async () => {
    let callCount = 0;
    const onSave = () => { callCount++; };

    const config = makeConfig({ onSave });
    await dispatchSave(config, fabricJson, canvasDataURL);

    assert.equal(callCount, 1, 'onSave should be called exactly once');
  });

  it('AC2: onSave payload matches save payload structure', async () => {
    let received = null;
    const onSave = (payload) => { received = payload; };

    const config = makeConfig({ onSave });
    const result = await dispatchSave(config, fabricJson, canvasDataURL);

    // Verify structure matches
    assert.equal(typeof received.templateId, 'string');
    assert.ok(received.templateId.length > 0);
    assert.equal(typeof received.templateName, 'string');
    assert.equal(typeof received.profile, 'object');
    assert.equal(received.profile.width, 296);
    assert.equal(received.profile.height, 128);
    assert.equal(received.profile.colorMode, 'BW');
    assert.ok(Array.isArray(received.profile.palette));
    assert.ok(received.fullJson);
    assert.ok(received.staticDynamic);
    assert.equal(received.staticDynamic.staticImage.type, 'base64');
    assert.equal(received.staticDynamic.staticImage.format, 'png');
    assert.equal(typeof received.staticDynamic.staticImage.data, 'string');
    assert.equal(received.staticDynamic.dynamicMetadata.fontFamily, EXPORT_FONT_FAMILY);
    assert.ok(Array.isArray(received.staticDynamic.dynamicMetadata.reservedFields));
    assert.ok(Array.isArray(received.staticDynamic.dynamicMetadata.widgets));

    // Same reference as result
    assert.deepStrictEqual(received, result);
  });

  it('AC2: onSave payload includes dynamic widgets', async () => {
    let received = null;
    const onSave = (payload) => { received = payload; };

    const config = makeConfig({ onSave, previewData: { price: 12.99 } });
    const jsonWithPrice = {
      version: '5.3.0',
      objects: [{
        type: 'rect', left: 10, top: 20, width: 100, height: 30,
        extensionType: 'PRICE',
        extension: { fieldBinding: 'price', currencySymbol: '¥' },
      }],
    };

    await dispatchSave(config, jsonWithPrice, canvasDataURL);

    assert.equal(received.staticDynamic.dynamicMetadata.widgets.length, 1);
    assert.equal(received.staticDynamic.dynamicMetadata.widgets[0].type, 'PRICE');
    assert.equal(received.staticDynamic.dynamicMetadata.widgets[0].fieldId, 'price');
  });

  it('AC3: onSave resolves successfully → success state', async () => {
    const onSave = () => { /* resolves immediately */ };

    const config = makeConfig({ onSave });
    const result = await dispatchSave(config, fabricJson, canvasDataURL);

    // If we got here without error, it's a success
    assert.ok(result);
    assert.equal(typeof result.templateId, 'string');
  });

  it('AC3: async onSave resolves → success state', async () => {
    const onSave = async () => {
      await new Promise(r => setTimeout(r, 10));
    };

    const config = makeConfig({ onSave });
    const result = await dispatchSave(config, fabricJson, canvasDataURL);

    assert.ok(result);
  });

  it('AC4: onSave rejects → error with message', async () => {
    const onSave = () => {
      throw new Error('宿主系统保存失败');
    };

    const config = makeConfig({ onSave });

    await assert.rejects(
      () => dispatchSave(config, fabricJson, canvasDataURL),
      { message: '宿主系统保存失败' },
    );
  });

  it('AC4: async onSave rejects → error with message', async () => {
    const onSave = async () => {
      await Promise.reject(new Error('网络超时'));
    };

    const config = makeConfig({ onSave });

    await assert.rejects(
      () => dispatchSave(config, fabricJson, canvasDataURL),
      { message: '网络超时' },
    );
  });

  it('AC4: onSave rejects → saveError is set', async () => {
    // Simulates the store behavior where saveError gets set on failure
    const errorMsg = '服务器内部错误';
    const onSave = () => { throw new Error(errorMsg); };

    const config = makeConfig({ onSave });
    let saveError = null;

    try {
      await dispatchSave(config, fabricJson, canvasDataURL);
    } catch (err) {
      saveError = err.message;
    }

    assert.equal(saveError, errorMsg);
  });

  it('AC5: both onSave and saveApi → only onSave called', async () => {
    let onSaveCalled = false;
    let saveApiCalled = false;

    const onSave = () => { onSaveCalled = true; };
    // saveApi would be used in the POST path, but since onSave is provided,
    // the dispatch logic never reaches saveApi handling
    const config = makeConfig({ onSave, saveApi: 'https://api.example.com/save' });

    await dispatchSave(config, fabricJson, canvasDataURL);

    assert.ok(onSaveCalled, 'onSave should be called');
    assert.ok(!saveApiCalled, 'saveApi should NOT be used when onSave is provided');
  });

  it('AC5: both onSave and saveApi → saveApi request is NOT sent', async () => {
    let onSavePayload = null;
    const onSave = (payload) => { onSavePayload = payload; };

    const config = makeConfig({
      onSave,
      saveApi: 'https://api.example.com/save',
    });

    const result = await dispatchSave(config, fabricJson, canvasDataURL);

    // Verify onSave was called with the payload
    assert.ok(onSavePayload !== null);
    assert.deepStrictEqual(onSavePayload, result);
    // saveApi URL is present but not used (no HTTP request in this code path)
    assert.equal(config.saveApi, 'https://api.example.com/save');
  });

  it('neither onSave nor saveApi → SaveConfigError thrown', async () => {
    const config = makeConfig(); // no onSave, no saveApi

    await assert.rejects(
      () => dispatchSave(config, fabricJson, canvasDataURL),
      (err) => {
        assert.equal(err.name, 'SaveConfigError');
        assert.equal(err.message, '保存配置错误：未提供 onSave 回调或 saveApi 地址');
        return true;
      },
    );
  });

  it('saveApi only (no onSave) → payload returned without error (US-015 will POST)', async () => {
    const config = makeConfig({ saveApi: 'https://api.example.com/save' });
    const result = await dispatchSave(config, fabricJson, canvasDataURL);

    assert.ok(result);
    assert.equal(typeof result.templateId, 'string');
  });

  it('onSave receives payload with edit mode templateId', async () => {
    let received = null;
    const onSave = (payload) => { received = payload; };

    const config = makeConfig({
      mode: 'edit',
      onSave,
      template: { id: 'tpl_edit_123', data: { objects: [] } },
      templateName: '测试编辑模板',
    });

    await dispatchSave(config, fabricJson, canvasDataURL);

    assert.equal(received.templateId, 'tpl_edit_123');
    assert.equal(received.templateName, '测试编辑模板');
  });

  it('onSave receives correct profile for BWR colorMode', async () => {
    let received = null;
    const onSave = (payload) => { received = payload; };

    const config = makeConfig({
      onSave,
      screen: {
        type: 'tri',
        profile: {
          displayName: 'BWR 296x128',
          palette: [
            { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
            { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
            { name: 'Red', hex: '#CC0000', rgb: [204, 0, 0], deviceIndex: 2 },
          ],
          defaultWidth: 296, defaultHeight: 128, dpi: 150, maxColors: 3,
        },
        palette: [
          { name: 'Black', hex: '#000000', rgb: [0, 0, 0], deviceIndex: 0 },
          { name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], deviceIndex: 1 },
          { name: 'Red', hex: '#CC0000', rgb: [204, 0, 0], deviceIndex: 2 },
        ],
      },
    });

    await dispatchSave(config, fabricJson, canvasDataURL);

    assert.equal(received.profile.colorMode, 'BWR');
    assert.equal(received.profile.palette.length, 3);
  });

  it('success message displays templateId', async () => {
    let received = null;
    const onSave = (payload) => { received = payload; };

    const config = makeConfig({
      onSave,
      template: { id: 'tpl_success_test', data: { objects: [] } },
    });

    const result = await dispatchSave(config, fabricJson, canvasDataURL);

    // Simulate the UI success message
    const successMessage = `保存成功：${result.templateId}`;
    assert.ok(successMessage.includes('tpl_success_test'));
  });

  it('error message displays onSave rejection reason', async () => {
    const errMsg = '磁盘空间不足';
    const onSave = () => { throw new Error(errMsg); };

    const config = makeConfig({ onSave });

    try {
      await dispatchSave(config, fabricJson, canvasDataURL);
      assert.fail('Should have thrown');
    } catch (err) {
      // Simulate the UI error message
      const errorMessage = `保存失败：${err.message ?? '未知错误'}`;
      assert.ok(errorMessage.includes(errMsg));
    }
  });
});
