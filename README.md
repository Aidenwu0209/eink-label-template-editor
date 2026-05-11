# Eink Label Template Editor

A lightweight visual template editor for electronic shelf labels (ESL), built for product, retail, and IoT teams that need to design e-ink price tag templates and integrate them into their own business systems.

The editor focuses on one job: turn externally provided screen profiles, template data, and preview data into editable ESL layouts, e-ink previews, and save-ready template payloads.

## Product Highlights

| Capability | What it provides |
| --- | --- |
| Profile-driven canvas | Creates a fixed-size editing canvas from an external Screen Profile. |
| E-ink preview | Quantizes the canvas into the target e-ink color palette for realistic preview. |
| ESL widgets | Supports text, images, prices, discounts, QR codes, and CODE128 barcodes. |
| Dynamic data binding | Binds widgets to product fields such as `productName`, `price`, `imageUrl`, `qrContent`, and `barcodeContent`. |
| Palette constraints | Restricts colors to the current screen profile palette: BW, BWR, BWRY, or E6. |
| Host integration | Returns Full JSON, Static PNG Base64, and Dynamic Metadata through `onSave` or `saveApi`. |

## Why This Exists

Electronic shelf labels are small, constrained, and device-specific. A normal design canvas is not enough: every template needs to respect screen size, limited color palettes, dynamic product data, and final e-ink rendering behavior.

This project provides a focused editor that can be embedded into a larger pricing, retail, ERP, or IoT platform without taking over backend responsibilities such as user management, template storage, device pushing, or approval workflows.

## Core Workflow

```plain
Host Business System
  |
  | passes mode, Screen Profile, template JSON, previewData
  v
Eink Label Template Editor
  |
  | visual editing + e-ink preview
  v
Save Payload
  |-- Full JSON
  |-- Static PNG Base64
  |-- Dynamic Metadata
  v
Host Business System stores or publishes the template
```

## Supported Components

| Component | Type | Purpose |
| --- | --- | --- |
| Rectangle | `RECT` | Background blocks, borders, labels. |
| Line | `LINE` | Dividers and simple decoration. |
| Text | `TEXT` | Static text or product field binding. |
| Image | `IMAGE` | Static logos or dynamic product images from `imageUrl`. |
| Price | `PRICE` | Composite price widget with currency, integer, and decimal styling. |
| Discount | `DISCOUNT` | Discount badges or formatted discount text. |
| QR Code | `QRCODE` | Fixed binding to `qrContent`. |
| Barcode | `BARCODE` | CODE128 barcode fixed binding to `barcodeContent`. |

## Screen Profiles

The editor is fully driven by external Screen Profiles. It currently supports:

| Color mode | Palette |
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

## Integration Contract

The host application can initialize the editor using `window.__ESL_EDITOR_INIT__` or a URL `?init=<base64-json>` parameter.

```json
{
  "mode": "create",
  "profile": {
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
  },
  "previewData": {
    "productName": "Organic Milk",
    "price": 12.9,
    "discount": 8.8,
    "description": "300ml x 12",
    "imageUrl": "https://example.com/product.png",
    "qrContent": "https://example.com/item/1001",
    "barcodeContent": "SKU1001",
    "brand": "Fresh Market"
  },
  "saveApi": "/api/template/save"
}
```

When the user saves, the editor generates:

```json
{
  "templateId": "tpl_xxx",
  "templateName": "Eink Label Template",
  "profile": {},
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

## Quick Start

```bash
npm install
npm run dev
```

Open:

```plain
http://127.0.0.1:5173/
```

To run the validation suite:

```bash
npm run test:node
npx vue-tsc -b
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | Vue 3, TypeScript, Pinia |
| Canvas editing | Fabric.js |
| E-ink rendering | Custom palette quantization and Floyd-Steinberg dithering |
| QR code | `qrcode` |
| Build tooling | Vite |
| Tests | Node.js built-in test runner |

## Current Status

This repository contains the MVP implementation of the ESL template editor. It is designed as an embeddable frontend module, not a full template management platform.

Included in the MVP:

- External initialization contract
- Profile-driven fixed canvas
- Palette-constrained editing
- E-ink preview
- Basic and business widgets
- Dynamic field binding
- Save payload generation
- `onSave` and `saveApi` integration paths

Not included by design:

- User accounts and permissions
- Backend template persistence
- Template versioning and approval
- ESL device push protocol
- Vendor-specific firmware integration

## Repository

GitHub: [Aidenwu0209/eink-label-template-editor](https://github.com/Aidenwu0209/eink-label-template-editor)
