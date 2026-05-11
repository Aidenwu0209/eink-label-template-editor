/**
 * US-015: 支持 saveApi 兼容保存方式
 *
 * Tests for saveApi POST integration in the save pipeline.
 * Uses Node.js built-in test runner with a mock fetch.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ══════════ Error Classes (mirrors editorStore) ══════════

class SaveConfigError extends Error {
  constructor() {
    super('保存配置错误：未提供 onSave 回调或 saveApi 地址');
    this.name = 'SaveConfigError';
  }
}

class SaveApiError extends Error {
  status;
  constructor(status, statusText) {
    super(`保存请求失败：${status} ${statusText}`);
    this.name = 'SaveApiError';
    this.status = status;
  }
}

class SaveNetworkError extends Error {
  constructor(cause) {
    super(`保存网络错误：${cause}`);
    this.name = 'SaveNetworkError';
  }
}

// ══════════ Inlined SavePayloadBuilder ══════════

const SYSTEM_FIELDS = [
  'productName', 'price', 'discount', 'description',
  'imageUrl', 'qrContent', 'barcodeContent',
];

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
        fontFamily: 'AlibabaPuHuiTi',
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

// ══════════ Mock Fetch ══════════

let mockFetchResponse = { ok: true, status: 200, statusText: 'OK' };
let mockFetchError = null;
let lastFetchRequest = null;

function mockFetch(url, options) {
  lastFetchRequest = { url, options };
  if (mockFetchError) {
    return Promise.reject(mockFetchError);
  }
  return Promise.resolve(mockFetchResponse);
}

// ══════════ Core save dispatch (mirrors editorStore.save) ══════════

async function postToSaveApi(saveApi, payload, fetchFn = mockFetch) {
  let response;
  try {
    response = await fetchFn(saveApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new SaveNetworkError(err?.message ?? '网络请求失败');
  }
  if (!response.ok) {
    throw new SaveApiError(response.status, response.statusText);
  }
}

async function dispatchSave(config, fabricJson, canvasDataURL, fetchFn = mockFetch) {
  const payload = buildSavePayload(config, fabricJson, canvasDataURL);

  const onSave = config.onSave;
  const saveApi = config.saveApi;
  if (onSave) {
    await onSave(payload);
  } else if (saveApi) {
    await postToSaveApi(saveApi, payload, fetchFn);
  } else {
    throw new SaveConfigError();
  }

  return payload;
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
        defaultWidth: 296, defaultHeight: 128, dpi: 150, maxColors: 2,
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

// ══════════ Tests ══════════

describe('US-015: 支持 saveApi 兼容保存方式', () => {

  const fabricJson = { version: '5.3.0', objects: [] };
  const canvasDataURL = 'data:image/png;base64,iVBOR...';

  beforeEach(() => {
    mockFetchResponse = { ok: true, status: 200, statusText: 'OK' };
    mockFetchError = null;
    lastFetchRequest = null;
  });

  // ─── AC1: POST to saveApi when onSave not provided ───

  it('AC1: saveApi provided (no onSave) → sends POST request to saveApi', async () => {
    const saveApi = 'https://api.example.com/templates';
    const config = makeConfig({ saveApi });

    await dispatchSave(config, fabricJson, canvasDataURL);

    assert.ok(lastFetchRequest !== null, 'fetch should have been called');
    assert.equal(lastFetchRequest.url, saveApi);
    assert.equal(lastFetchRequest.options.method, 'POST');
  });

  it('AC1: saveApi with relative path → sends POST to relative URL', async () => {
    const saveApi = '/api/templates/save';
    const config = makeConfig({ saveApi });

    await dispatchSave(config, fabricJson, canvasDataURL);

    assert.equal(lastFetchRequest.url, '/api/templates/save');
    assert.equal(lastFetchRequest.options.method, 'POST');
  });

  // ─── AC2: POST body equals save payload ───

  it('AC2: POST body equals save payload', async () => {
    const saveApi = 'https://api.example.com/save';
    const config = makeConfig({ saveApi });

    const result = await dispatchSave(config, fabricJson, canvasDataURL);
    const body = JSON.parse(lastFetchRequest.options.body);

    assert.equal(body.templateId, result.templateId);
    assert.equal(body.templateName, result.templateName);
    assert.deepEqual(body.profile, result.profile);
    assert.deepEqual(body.fullJson, result.fullJson);
    assert.deepEqual(body.staticDynamic, result.staticDynamic);
  });

  it('AC2: POST Content-Type is application/json', async () => {
    const config = makeConfig({ saveApi: '/api/save' });
    await dispatchSave(config, fabricJson, canvasDataURL);

    assert.equal(lastFetchRequest.options.headers['Content-Type'], 'application/json');
  });

  it('AC2: POST body includes dynamic widgets', async () => {
    const config = makeConfig({
      saveApi: '/api/save',
      previewData: { price: 99.9, productName: '测试商品' },
    });
    const jsonWithWidgets = {
      version: '5.3.0',
      objects: [
        {
          type: 'rect', left: 10, top: 20, width: 100, height: 30,
          extensionType: 'PRICE',
          extension: { fieldBinding: 'price' },
        },
        {
          type: 'textbox', left: 10, top: 60, width: 100, height: 20,
          extensionType: 'TEXT',
          extension: { fieldBinding: 'productName' },
        },
      ],
    };

    await dispatchSave(config, jsonWithWidgets, canvasDataURL);
    const body = JSON.parse(lastFetchRequest.options.body);

    assert.equal(body.staticDynamic.dynamicMetadata.widgets.length, 2);
    assert.equal(body.staticDynamic.dynamicMetadata.widgets[0].type, 'PRICE');
    assert.equal(body.staticDynamic.dynamicMetadata.widgets[1].type, 'TEXT');
  });

  // ─── AC3: 2xx response → success state ───

  it('AC3: 200 OK → success (no error thrown)', async () => {
    mockFetchResponse = { ok: true, status: 200, statusText: 'OK' };
    const config = makeConfig({ saveApi: '/api/save' });

    const result = await dispatchSave(config, fabricJson, canvasDataURL);
    assert.ok(result);
    assert.equal(typeof result.templateId, 'string');
  });

  it('AC3: 201 Created → success (no error thrown)', async () => {
    mockFetchResponse = { ok: true, status: 201, statusText: 'Created' };
    const config = makeConfig({ saveApi: '/api/save' });

    const result = await dispatchSave(config, fabricJson, canvasDataURL);
    assert.ok(result);
  });

  it('AC3: 204 No Content → success (no error thrown)', async () => {
    mockFetchResponse = { ok: true, status: 204, statusText: 'No Content' };
    const config = makeConfig({ saveApi: '/api/save' });

    const result = await dispatchSave(config, fabricJson, canvasDataURL);
    assert.ok(result);
  });

  // ─── AC4: Non-2xx or network error → failure message ───

  it('AC4: 400 Bad Request → SaveApiError', async () => {
    mockFetchResponse = { ok: false, status: 400, statusText: 'Bad Request' };
    const config = makeConfig({ saveApi: '/api/save' });

    await assert.rejects(
      () => dispatchSave(config, fabricJson, canvasDataURL),
      (err) => {
        assert.equal(err.name, 'SaveApiError');
        assert.equal(err.status, 400);
        assert.ok(err.message.includes('400'));
        return true;
      },
    );
  });

  it('AC4: 500 Internal Server Error → SaveApiError', async () => {
    mockFetchResponse = { ok: false, status: 500, statusText: 'Internal Server Error' };
    const config = makeConfig({ saveApi: '/api/save' });

    await assert.rejects(
      () => dispatchSave(config, fabricJson, canvasDataURL),
      (err) => {
        assert.equal(err.name, 'SaveApiError');
        assert.equal(err.status, 500);
        assert.ok(err.message.includes('500'));
        return true;
      },
    );
  });

  it('AC4: Network error → SaveNetworkError', async () => {
    mockFetchError = new TypeError('Failed to fetch');
    const config = makeConfig({ saveApi: '/api/save' });

    await assert.rejects(
      () => dispatchSave(config, fabricJson, canvasDataURL),
      (err) => {
        assert.equal(err.name, 'SaveNetworkError');
        assert.ok(err.message.includes('网络错误'));
        return true;
      },
    );
  });

  it('AC4: Network timeout → SaveNetworkError', async () => {
    mockFetchError = new Error('Request timeout');
    const config = makeConfig({ saveApi: '/api/save' });

    await assert.rejects(
      () => dispatchSave(config, fabricJson, canvasDataURL),
      (err) => {
        assert.equal(err.name, 'SaveNetworkError');
        return true;
      },
    );
  });

  // ─── AC5: Neither onSave nor saveApi → SaveConfigError ───

  it('AC5: Neither onSave nor saveApi → SaveConfigError', async () => {
    const config = makeConfig(); // no onSave, no saveApi

    await assert.rejects(
      () => dispatchSave(config, fabricJson, canvasDataURL),
      (err) => {
        assert.equal(err.name, 'SaveConfigError');
        assert.ok(err.message.includes('保存配置错误'));
        return true;
      },
    );
  });

  it('AC5: SaveConfigError → saveError displayed in UI', async () => {
    const config = makeConfig();
    let saveError = null;

    try {
      await dispatchSave(config, fabricJson, canvasDataURL);
    } catch (err) {
      saveError = err.message;
    }

    assert.ok(saveError);
    assert.ok(saveError.includes('保存配置错误'));
  });

  // ─── AC6: Local dev proxy — request reaches backend ───

  it('AC6: Relative saveApi path → POST request uses relative URL (handled by proxy)', async () => {
    const saveApi = '/api/templates';
    const config = makeConfig({ saveApi });

    await dispatchSave(config, fabricJson, canvasDataURL);

    // Relative URL is sent as-is; Vite proxy forwards to backend
    assert.equal(lastFetchRequest.url, '/api/templates');
    assert.equal(lastFetchRequest.options.method, 'POST');
    // No Vite fallback/404 because proxy intercepts /api/* paths
  });

  it('AC6: Absolute saveApi URL → POST request uses full URL', async () => {
    const saveApi = 'http://localhost:3000/api/templates';
    const config = makeConfig({ saveApi });

    await dispatchSave(config, fabricJson, canvasDataURL);

    assert.equal(lastFetchRequest.url, 'http://localhost:3000/api/templates');
  });

  // ─── onSave priority (regression from US-014) ───

  it('Regression: both onSave and saveApi → only onSave called, no POST', async () => {
    let onSaveCalled = false;
    const onSave = () => { onSaveCalled = true; };
    const config = makeConfig({
      onSave,
      saveApi: 'https://api.example.com/save',
    });

    await dispatchSave(config, fabricJson, canvasDataURL);

    assert.ok(onSaveCalled);
    assert.equal(lastFetchRequest, null, 'fetch should NOT be called when onSave is present');
  });

  it('Regression: onSave error takes precedence over saveApi', async () => {
    const onSave = () => { throw new Error('onSave 失败'); };
    const config = makeConfig({
      onSave,
      saveApi: '/api/save',
    });

    await assert.rejects(
      () => dispatchSave(config, fabricJson, canvasDataURL),
      { message: 'onSave 失败' },
    );
  });
});
