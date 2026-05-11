# Eink Label Template Editor

[中文文档](./README.zh-CN.md)

Design, preview, and export templates for electronic shelf labels.

Eink Label Template Editor is a lightweight visual editor for ESL and e-ink price tag layouts. It is built for teams that already have product data, screen profiles, and backend systems, and need a focused frontend editor that can be embedded into their own workflow.

## What You Can Do

- Create fixed-size ESL canvases from external screen profiles.
- Design templates with text, rectangles, lines, images, prices, discounts, QR codes, and CODE128 barcodes.
- Bind template widgets to product data such as `productName`, `price`, `imageUrl`, `qrContent`, and `barcodeContent`.
- Preview the final result using the target e-ink color palette.
- Save a complete payload containing editable JSON, static PNG Base64, and dynamic metadata.

## Quick Start

```bash
git clone https://github.com/Aidenwu0209/eink-label-template-editor.git
cd eink-label-template-editor
npm install
npm run dev
```

Open the local URL printed by Vite, usually:

```plain
http://127.0.0.1:5173/
```

If you want to use a fixed local port:

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

Then open:

```plain
http://127.0.0.1:4173/
```

## Try It With Sample Data

The editor accepts initialization data from either `window.__ESL_EDITOR_INIT__` or a URL `?init=<base64-json>` parameter.

Generate a ready-to-open demo URL:

```bash
node - <<'NODE'
const payload = {
  mode: 'create',
  profile: {
    profileId: 'profile_296_128_bwr',
    name: '2.9 inch black-white-red ESL',
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
    productName: 'Organic Milk',
    price: 12.9,
    discount: 8.8,
    description: '300ml x 12',
    imageUrl: 'https://picsum.photos/80',
    qrContent: 'https://example.com/item/1001',
    barcodeContent: 'SKU1001',
    brand: 'Fresh Market'
  },
  saveApi: '/api/template/save'
};

const init = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
console.log(`http://127.0.0.1:5173/?init=${encodeURIComponent(init)}`);
NODE
```

Paste the generated URL into your browser. The editor will load with a 296 x 128 BWR screen profile and sample product data.

## Product Flow

```plain
Host system
  |
  | passes screen profile, template JSON, preview data
  v
Eink Label Template Editor
  |
  | visual editing + e-ink preview
  v
Save payload
  |-- Full JSON
  |-- Static PNG Base64
  |-- Dynamic Metadata
  v
Host system stores, publishes, or sends the template
```

## Core Features

| Feature | Description |
| --- | --- |
| Profile-driven canvas | Canvas size, color mode, and palette come from the external Screen Profile. |
| E-ink preview | The preview is quantized to the selected profile palette, including BW, BWR, BWRY, and E6. |
| Visual editing | Add, select, move, and configure widgets on a Fabric.js canvas. |
| Dynamic binding | Bind text, image, price, discount, QR code, and barcode widgets to product fields. |
| Palette-safe styling | Color pickers only expose colors supported by the current screen profile. |
| Save integration | Use `onSave` for embedded apps or `saveApi` for direct API posting. |
| Export-ready output | Save payload includes editable JSON, static PNG Base64, and dynamic widget metadata. |

## Supported Widgets

| Widget | Type | Dynamic binding |
| --- | --- | --- |
| Rectangle | `RECT` | Static only |
| Line | `LINE` | Static only |
| Text | `TEXT` | `productName`, `description`, custom text fields |
| Image | `IMAGE` | `imageUrl` |
| Price | `PRICE` | `price` |
| Discount | `DISCOUNT` | `discount` |
| QR code | `QRCODE` | `qrContent` |
| Barcode | `BARCODE` | `barcodeContent` |

## Screen Profile Support

| Mode | Colors |
| --- | --- |
| `BW` | Black, white |
| `BWR` | Black, white, red |
| `BWRY` | Black, white, red, yellow |
| `E6` | Black, white, red, green, blue, yellow, orange |

Example profile:

```json
{
  "profileId": "profile_296_128_bwr",
  "name": "2.9 inch black-white-red ESL",
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

## Save Payload

When the user clicks Save, the editor generates:

```json
{
  "templateId": "tpl_xxx",
  "templateName": "Eink Label Template",
  "profile": {
    "profileId": "profile_296_128_bwr",
    "name": "2.9 inch black-white-red ESL",
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

## Integration Options

### Embedded Callback

Use `onSave` when the editor is embedded in a host frontend:

```ts
window.__ESL_EDITOR_INIT__ = {
  mode: 'create',
  profile,
  previewData,
  onSave(payload) {
    console.log('save template', payload);
  }
};
```

### API Save

Use `saveApi` when the editor should post directly:

```json
{
  "saveApi": "/api/template/save"
}
```

The editor posts the generated save payload as JSON.

## What This Project Is Not

This repository intentionally focuses on the frontend editor. It does not include:

- User accounts or permissions.
- Template database persistence.
- Template versioning or approval workflows.
- ESL device push protocols.
- Vendor-specific firmware or gateway integrations.

Those responsibilities should live in the host business system.

## Development

```bash
npm install
npm run dev
```

Type check:

```bash
npx vue-tsc -b
```

Run the node-based validation suite:

```bash
npm run test:node
```

Build:

```bash
npm run build
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| App | Vue 3, TypeScript, Pinia |
| Canvas | Fabric.js |
| E-ink rendering | Palette quantization, Floyd-Steinberg dithering |
| QR generation | `qrcode` |
| Tooling | Vite |
| Tests | Node.js built-in test runner |

## Status

MVP implementation is available. The current version is suitable for local evaluation, integration experiments, and product workflow validation.

Planned next steps:

- Add polished default layout presets.
- Add import/export examples for host systems.
- Add stronger browser-level regression tests.
- Add product screenshots and hosted demo documentation.

## License

No license has been specified yet.
