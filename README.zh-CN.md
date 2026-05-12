# 电子价签模板编辑器

[English](./README.md)

用于电子价签的模板设计、预览和导出工具。

电子价签模板编辑器是一个轻量级的可视化前端编辑器，面向 ESL 电子价签和电子墨水屏价签场景。它适合已经有商品数据、屏幕规格和业务后台的团队，用来快速嵌入一套专注的模板编辑能力。

## 你可以用它做什么

- 根据外部传入的屏幕规格创建固定尺寸画布。
- 使用文本、矩形、线条、图片、价格、折扣、二维码、CODE128 条形码设计价签模板。
- 将模板组件绑定到商品字段，例如 `productName`、`price`、`imageUrl`、`qrContent`、`barcodeContent`。
- 按目标电子墨水屏色板预览最终显示效果。
- 保存完整模板结果，包括可再次编辑的 JSON、静态 PNG Base64 和动态组件元数据。

## 快速开始

```bash
git clone https://github.com/Aidenwu0209/eink-label-template-editor.git
cd eink-label-template-editor
npm install
npm run dev
```

打开 Vite 输出的本地地址，通常是：

```plain
http://127.0.0.1:5173/
```

如果希望固定端口运行：

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

然后打开：

```plain
http://127.0.0.1:4173/
```

## 用示例数据试一下

编辑器支持通过 `window.__ESL_EDITOR_INIT__` 或 URL 参数 `?init=<base64-json>` 传入初始化数据。

生成一个可以直接打开的演示 URL：

```bash
node - <<'NODE'
const payload = {
  mode: 'create',
  profile: {
    profileId: 'profile_296_128_bwr',
    name: '2.9寸黑白红电子价签',
    width: 296,
    height: 128,
    colorMode: 'BWR',
    palette: [
      { name: 'white', value: '#FFFFFF' },
      { name: 'black', value: '#000000' },
      { name: 'red', value: '#CC0000' }
    ]
  },
  previewData: {
    productName: '有机纯牛奶',
    price: 12.9,
    discount: 8.8,
    description: '300ml x 12盒',
    imageUrl: 'https://picsum.photos/80',
    qrContent: 'https://example.com/item/1001',
    barcodeContent: 'SKU1001',
    brand: '鲜选超市'
  },
  saveApi: '/api/template/save'
};

const init = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
console.log(`http://127.0.0.1:5173/?init=${encodeURIComponent(init)}`);
NODE
```

把生成的 URL 复制到浏览器。编辑器会使用 296 x 128 的黑白红屏幕规格和示例商品数据启动。

## 产品流程

```plain
宿主业务系统
  |
  | 传入屏幕规格、模板 JSON、预览数据
  v
电子价签模板编辑器
  |
  | 可视化编辑 + 电子墨水屏预览
  v
保存结果
  |-- Full JSON
  |-- Static PNG Base64
  |-- Dynamic Metadata
  v
宿主业务系统保存、发布或下发模板
```

## 核心能力

| 能力 | 说明 |
| --- | --- |
| 屏幕规格驱动 | 画布尺寸、颜色模式和可用色板都来自外部 Screen Profile。 |
| 电子墨水屏预览 | 将画布量化到目标屏幕色板，支持 BW、BWR、BWRY、E6。 |
| 可视化编辑 | 基于 Fabric.js 添加、选择、移动和配置组件。 |
| 动态数据绑定 | 支持文本、图片、价格、折扣、二维码和条形码绑定商品字段。 |
| 色板安全 | 颜色选择器只暴露当前屏幕规格支持的颜色。 |
| 保存集成 | 支持嵌入式 `onSave` 回调，也支持直接调用 `saveApi`。 |
| 可导出结果 | 保存结果包含可编辑 JSON、静态 PNG Base64 和动态组件元数据。 |

## 支持的组件

| 组件 | 类型 | 动态绑定 |
| --- | --- | --- |
| 矩形 | `RECT` | 静态 |
| 直线 | `LINE` | 静态 |
| 文本 | `TEXT` | `productName`、`description`、自定义文本字段 |
| 图片 | `IMAGE` | `imageUrl` |
| 价格 | `PRICE` | `price` |
| 折扣 | `DISCOUNT` | `discount` |
| 二维码 | `QRCODE` | `qrContent` |
| 条形码 | `BARCODE` | `barcodeContent` |

## 屏幕规格支持

| 模式 | 颜色 |
| --- | --- |
| `BW` | 黑、白 |
| `BWR` | 黑、白、红 |
| `BWRY` | 黑、白、红、黄 |
| `E6` | 黑、白、红、绿、蓝、黄、橙 |

示例 Screen Profile：

```json
{
  "profileId": "profile_296_128_bwr",
  "name": "2.9寸黑白红电子价签",
  "width": 296,
  "height": 128,
  "colorMode": "BWR",
  "palette": [
    { "name": "white", "value": "#FFFFFF" },
    { "name": "black", "value": "#000000" },
    { "name": "red", "value": "#CC0000" }
  ]
}
```

## 保存结果

用户点击保存后，编辑器会生成：

```json
{
  "templateId": "tpl_xxx",
  "templateName": "电子价签模板",
  "profile": {
    "profileId": "profile_296_128_bwr",
    "name": "2.9寸黑白红电子价签",
    "width": 296,
    "height": 128,
    "colorMode": "BWR",
    "palette": []
  },
  "fullJson": {},
  "staticDynamic": {
    "staticImage": {
      "type": "base64",
      "format": "png",
      "data": "data:image/png;base64,..."
    },
    "dynamicMetadata": {
      "fontFamily": "AlibabaPuHuiTi",
      "reservedFields": [
        "productName",
        "price",
        "discount",
        "description",
        "imageUrl",
        "qrContent",
        "barcodeContent"
      ],
      "widgets": []
    }
  }
}
```

## 集成方式

### 嵌入式回调

如果编辑器嵌入在宿主前端里，可以使用 `onSave`：

```ts
window.__ESL_EDITOR_INIT__ = {
  mode: 'create',
  profile,
  previewData,
  onSave(payload) {
    console.log('保存模板', payload);
  }
};
```

### API 保存

如果希望编辑器直接提交到接口，可以使用 `saveApi`：

```json
{
  "saveApi": "/api/template/save"
}
```

编辑器会把生成的保存结果作为 JSON 提交。

## 这个项目不做什么

这个仓库专注于前端模板编辑器，不包含：

- 用户体系和权限管理。
- 模板数据库持久化。
- 模板版本管理和发布审批。
- 电子价签设备推送协议。
- 厂商固件或网关对接。

这些能力应该由宿主业务系统负责。

## 开发

```bash
npm install
npm run dev
```

本地 OCR 智能导入：

```bash
python3 -m venv .venv-ocr
source .venv-ocr/bin/activate
pip install -r scripts/ocr-service/requirements.txt
npm run ocr:install-models
npm run ocr:local
```

智能导入里的“本地 PP-OCRv5”和“本地 PaddleOCR-VL”都会调用同机
Python OCR 服务。模型文件放在 `runtime/ocr-models/`，大模型权重通过
Git LFS 管理。

类型检查：

```bash
npx vue-tsc -b
```

运行 Node.js 验证测试：

```bash
npm run test:node
```

构建：

```bash
npm run build
```

## 技术栈

| 层 | 技术 |
| --- | --- |
| 应用 | Vue 3、TypeScript、Pinia |
| 画布 | Fabric.js |
| 电子墨水屏渲染 | 色板量化、Floyd-Steinberg 抖动 |
| 二维码生成 | `qrcode` |
| 工具链 | Vite |
| 测试 | Node.js 内置测试运行器 |

## 当前状态

MVP 已实现，当前版本适合本地体验、集成验证和产品流程验证。

后续计划：

- 增加更完整的默认布局模板。
- 补充宿主系统导入导出示例。
- 增加更强的浏览器级回归测试。
- 补充产品截图和在线演示文档。

## License

暂未指定 License。
