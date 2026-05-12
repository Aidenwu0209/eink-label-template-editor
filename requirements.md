**电子价签模板编辑器第一版 MVP 需求可以正式冻结**。

下面整理成一份可用于后续拆用户故事、写 PRD、写 OpenSpec、给研发评审的**需求冻结版**。

---

# 电子价签模板编辑器 MVP 需求冻结版
## 一、产品定位
本项目开发一个面向**电子价签 ESL** 场景的轻量级可视化模板编辑器。

编辑器由外部业务系统集成使用，主要负责：

1. 根据外部传入的 Screen Profile 创建固定尺寸画布；
2. 支持电子价签模板可视化编辑；
3. 支持商品字段、二维码、条形码、动态图片等动态数据绑定；
4. 保存时生成并输出：
    - Full JSON；
    - Static PNG Base64；
    - Dynamic Metadata；
5. 支持预览电子墨水屏最终显示效果。

编辑器自身**不负责后端模板管理**，不维护用户、权限、版本、Profile 和数据库。

---

# 二、第一版明确不做的内容
第一版不做：

| 模块 | 是否排除 |
| --- | --- |
| 用户体系 | 不做 |
| 权限管理 | 不做 |
| Screen Profile 后端管理 | 不做 |
| 模板版本管理 | 不做 |
| 模板发布审批 | 不做 |
| 模板数据库持久化 | 不做 |
| 设备推送 | 不做 |
| 电子价签厂商协议 | 不做 |
| 多字体管理 | 不做 |
| 多条形码格式 | 不做 |
| 复杂路径、阴影、滤镜、渐变 | 不做 |
| 任意 Fabric JSON 后端完整复刻 | 不做 |


---

# 三、整体架构确认
```plain
外部业务系统
   │
   │ 1. 传入初始化数据
   │    - mode
   │    - Screen Profile
   │    - Full JSON
   │    - Static + Dynamic
   │    - previewData
   ▼
电子价签模板编辑器
Vue 3 + Fabric.js
   │
   │ 2. 用户编辑模板
   ▼
编辑器生成模板结果
   ├── Full JSON
   ├── Static PNG Base64
   └── Dynamic Metadata
   │
   │ 3. onSave 回调优先
   │ 4. 兼容 saveApi 配置
   ▼
外部业务系统保存模板
```

---

# 四、Screen Profile 规则
## 1. Profile 来源
Screen Profile **完全由外部 API 传入**。

编辑器不提供 Profile 管理功能。

---

## 2. 支持的屏幕类型
| 色彩模式 | 颜色数量 | 颜色 |
| --- | --- | --- |
| BW | 2 色 | 黑、白 |
| BWR | 3 色 | 黑、白、红 |
| BWRY | 4 色 | 黑、白、红、黄 |
| E6 | 7 色 | 黑、白、红、绿、蓝、黄、橙 |


---

## 3. Profile 示例
```json
{
  "profileId": "profile_296_128_bwr",
  "name": "2.9寸黑白红电子价签",
  "width": 296,
  "height": 128,
  "colorMode": "BWR",
  "palette": [
    {
      "name": "white",
      "value": "#FFFFFF"
    },
    {
      "name": "black",
      "value": "#000000"
    },
    {
      "name": "red",
      "value": "#FF0000"
    }
  ]
}
```

---

## 4. Profile 对编辑器的约束
编辑器必须根据 Profile 控制：

| Profile 信息 | 编辑器行为 |
| --- | --- |
| width | 设置画布宽度 |
| height | 设置画布高度 |
| colorMode | 设置电子墨水屏颜色模式 |
| palette | 限制拾色器颜色 |
| palette | 限制文本、线条、背景、价格、折扣颜色 |
| palette | 限制最终 Static PNG 颜色 |
| palette | 控制预览时颜色量化目标 |


---

# 五、编辑器 MVP 组件范围
## 1. 基础组件
| 组件 | 类型 | 说明 |
| --- | --- | --- |
| 矩形 | RECT | 背景块、标签块、边框 |
| 直线 | LINE | 分割线、装饰线 |
| 文本 | TEXT | 固定文本或动态文本 |
| 图片 | IMAGE | 静态图片或动态图片 |


---

## 2. 电子价签业务组件
| 组件 | 类型 | 说明 |
| --- | --- | --- |
| 产品价格 | PRICE | 独立复合组件 |
| 产品折扣 | DISCOUNT | 折扣标签或折扣文本 |
| 二维码 | QRCODE | 固定绑定 `qrContent` |
| 条形码 | BARCODE | 固定绑定 `barcodeContent` |


---

# 六、字段规则冻结
## 1. 系统固有字段
第一版系统固有字段如下：

| 字段 ID | 类型 | 说明 |
| --- | --- | --- |
| productName | TEXT | 产品名称 |
| price | NUMBER | 产品价格 |
| discount | NUMBER | 产品折扣 |
| description | TEXT | 产品描述 |
| imageUrl | TEXT | 动态图片地址 |
| qrContent | TEXT | 二维码内容 |
| barcodeContent | TEXT | 条形码内容 |


---

## 2. 二维码字段
二维码字段固定为：

```plain
qrContent
```

二维码组件只绑定该字段。

---

## 3. 条形码字段
条形码字段固定为：

```plain
barcodeContent
```

---

## 4. 条形码类型
第一版条形码只支持：

```plain
CODE128
```

不支持 EAN-13、UPC-A、QR 混用、DataMatrix 等其他格式。

---

## 5. 自定义字段
第一版自定义字段规则：

| 规则 | 说明 |
| --- | --- |
| 数据类型 | 只支持文本 |
| 字段 ID | 用户自己填写 |
| 固定 ID | 不需要 custom1、custom2 这种固定名称 |
| 重名校验 | 不能和系统固有字段重名 |
| 模板内校验 | 同一模板内不能重复 |


---

## 6. 自定义字段 ID 校验规则
建议字段 ID 满足：

```plain
1. 不能为空
2. 只能包含英文字母、数字、下划线
3. 必须以英文字母开头
4. 不能和系统固有字段重名
5. 同一个模板内不能重复
```

合法示例：

```plain
brand
originPrice
memberPrice
unit
spec
promotionText
```

不合法示例：

```plain
价格
product-name
123abc
price
qrContent
barcodeContent
```

---

# 七、文本超长规则冻结
第一版文本超长支持三种模式：

| overflow | 说明 |
| --- | --- |
| clip | 超出区域直接裁剪 |
| ellipsis | 超出区域显示省略号 |
| wrap | 自动换行 |


默认值：

```plain
ellipsis
```

TEXT 组件建议结构：

```json
{
  "id": "text_product_name_001",
  "type": "TEXT",
  "fieldId": "productName",
  "x": 10,
  "y": 10,
  "width": 180,
  "height": 36,
  "fontFamily": "Noto Sans SC Variable",
  "fontSize": 16,
  "fontWeight": "normal",
  "color": "#000000",
  "align": "left",
  "verticalAlign": "top",
  "overflow": "ellipsis",
  "lineClamp": 1,
  "defaultValue": "示例商品名称"
}
```

---

# 八、字体规则冻结
第一版字体只支持：

```plain
阿里巴巴普惠体
```

建议内部统一标识为：

```plain
Noto Sans SC Variable
```

规则：

| 项目 | 规则 |
| --- | --- |
| 字体选择器 | 第一版不提供多字体选择 |
| 文本组件 | 使用阿里巴巴普惠体 |
| 价格组件 | 使用阿里巴巴普惠体 |
| 折扣组件 | 使用阿里巴巴普惠体 |
| 条形码文字 | 如显示，也使用阿里巴巴普惠体 |
| 字重 | 第一版支持 normal / bold 即可 |


---

# 九、图片组件规则冻结
图片组件支持两种模式。

---

## 1. 静态图片
用于：

+ Logo；
+ 固定图标；
+ 固定促销图；
+ 固定装饰图。

保存时进入：

```plain
Static PNG
```

也就是静态图片会被合成到底图里。

---

## 2. 动态图片
动态图片只支持字段：

```plain
imageUrl
```

用于：

+ 商品图；
+ 动态品牌图；
+ 外部业务系统传入的图片。

动态图片 Metadata 示例：

```json
{
  "id": "product_image_001",
  "type": "IMAGE",
  "mode": "dynamic",
  "fieldId": "imageUrl",
  "x": 200,
  "y": 20,
  "width": 80,
  "height": 80,
  "fit": "contain",
  "backgroundColor": "#FFFFFF"
}
```

建议第一版支持：

| fit | 说明 |
| --- | --- |
| contain | 等比缩放，完整显示 |
| cover | 等比裁剪，铺满区域 |
| fill | 拉伸填充 |


默认：

```plain
contain
```

---

# 十、价格组件规则冻结
产品价格必须作为独立的 `PRICE` 复合组件处理，不建议当作普通文本处理。

原因是电子价签价格通常需要：

+ 货币符号；
+ 整数大字；
+ 小数小字；
+ 小数上浮；
+ 不同子样式；
+ 数字格式化；
+ 千分位；
+ 小数位控制。

你之前上传的价格设计说明也指出，价格在零售视觉中通常需要整数部分放大、小数部分缩小并上浮，普通文本很难用单一坐标处理，因此应作为 Composite Widget 设计。

PRICE 组件建议结构：

```json
{
  "id": "price_001",
  "type": "PRICE",
  "fieldId": "price",
  "x": 20,
  "y": 50,
  "width": 180,
  "height": 60,
  "config": {
    "currencySymbol": "¥",
    "decimalPlaces": 2,
    "thousandSeparator": ",",
    "decimalSeparator": ".",
    "showCurrency": true
  },
  "style": {
    "currency": {
      "fontFamily": "Noto Sans SC Variable",
      "fontSize": 18,
      "fontWeight": "bold",
      "color": "#000000",
      "offsetY": 0
    },
    "integer": {
      "fontFamily": "Noto Sans SC Variable",
      "fontSize": 48,
      "fontWeight": "bold",
      "color": "#000000"
    },
    "decimal": {
      "fontFamily": "Noto Sans SC Variable",
      "fontSize": 22,
      "fontWeight": "bold",
      "color": "#000000",
      "offsetY": -12
    }
  },
  "defaultValue": "9.90"
}
```

---

# 十一、折扣组件规则冻结
产品折扣作为 `DISCOUNT` 组件处理。

第一版支持：

+ 绑定 `discount` 字段；
+ 设置格式；
+ 设置背景色；
+ 设置文字色；
+ 设置字号；
+ 设置加粗；
+ 水平居中；
+ 垂直居中。

示例：

```json
{
  "id": "discount_001",
  "type": "DISCOUNT",
  "fieldId": "discount",
  "x": 10,
  "y": 10,
  "width": 64,
  "height": 28,
  "format": "{value}折",
  "shape": "rect",
  "backgroundColor": "#FF0000",
  "textColor": "#FFFFFF",
  "fontFamily": "Noto Sans SC Variable",
  "fontSize": 14,
  "fontWeight": "bold",
  "align": "center",
  "verticalAlign": "middle",
  "defaultValue": "8.8"
}
```

---

# 十二、二维码组件规则冻结
二维码组件固定绑定：

```plain
qrContent
```

示例：

```json
{
  "id": "qrcode_001",
  "type": "QRCODE",
  "fieldId": "qrContent",
  "x": 230,
  "y": 20,
  "width": 48,
  "height": 48,
  "errorCorrection": "M",
  "margin": 1,
  "foregroundColor": "#000000",
  "backgroundColor": "#FFFFFF"
}
```

---

# 十三、条形码组件规则冻结
条形码组件固定绑定：

```plain
barcodeContent
```

第一版只支持：

```plain
CODE128
```

示例：

```json
{
  "id": "barcode_001",
  "type": "BARCODE",
  "fieldId": "barcodeContent",
  "x": 20,
  "y": 100,
  "width": 180,
  "height": 28,
  "format": "CODE128",
  "showText": false,
  "foregroundColor": "#000000",
  "backgroundColor": "#FFFFFF"
}
```

---

# 十四、保存规则冻结
## 1. 保存职责
编辑器只负责生成模板数据并传出。

不负责：

+ 入库；
+ 模板版本；
+ 模板状态；
+ 保存失败重试策略之外的业务逻辑。

---

## 2. 保存方式
第一版支持两种保存方式：

| 方式 | 优先级 | 说明 |
| --- | --- | --- |
| onSave 回调 | 高 | 推荐方式，适合组件集成 |
| saveApi 配置 | 低 | 兼容方式，编辑器直接调用 API |


---

## 3. onSave 方式
宿主系统传入：

```plain
onSave(templatePayload) {
  // 外部业务系统自行保存
}
```

编辑器点击保存后调用：

```plain
props.onSave(payload)
```

---

## 4. saveApi 方式
宿主系统传入：

```json
{
  "saveApi": "/api/template/save"
}
```

编辑器保存时直接请求：

```http
POST /api/template/save
```

---

## 5. Static PNG 输出格式
Static PNG 使用：

```plain
base64
```

---

# 十五、保存 Payload 结构冻结建议
```json
{
  "templateId": "template_001",
  "templateName": "电子价签模板",
  "profile": {
    "profileId": "profile_296_128_bwr",
    "name": "2.9寸黑白红电子价签",
    "width": 296,
    "height": 128,
    "colorMode": "BWR",
    "palette": [
      {
        "name": "white",
        "value": "#FFFFFF"
      },
      {
        "name": "black",
        "value": "#000000"
      },
      {
        "name": "red",
        "value": "#FF0000"
      }
    ]
  },
  "fullJson": {
    "fabricVersion": "6.x",
    "canvas": {}
  },
  "staticDynamic": {
    "staticImage": {
      "type": "base64",
      "format": "png",
      "data": "data:image/png;base64,..."
    },
    "dynamicMetadata": {
      "fontFamily": "Noto Sans SC Variable",
      "reservedFields": [
        "productName",
        "price",
        "discount",
        "description",
        "imageUrl",
        "qrContent",
        "barcodeContent"
      ],
      "widgets": [
        {
          "id": "text_product_name_001",
          "type": "TEXT",
          "fieldId": "productName",
          "x": 10,
          "y": 10,
          "width": 180,
          "height": 36,
          "fontSize": 16,
          "fontWeight": "normal",
          "color": "#000000",
          "overflow": "ellipsis",
          "defaultValue": "示例商品名称"
        },
        {
          "id": "price_001",
          "type": "PRICE",
          "fieldId": "price",
          "x": 20,
          "y": 50,
          "width": 180,
          "height": 60,
          "defaultValue": "9.90"
        },
        {
          "id": "discount_001",
          "type": "DISCOUNT",
          "fieldId": "discount",
          "x": 10,
          "y": 80,
          "width": 64,
          "height": 28,
          "format": "{value}折",
          "defaultValue": "8.8"
        },
        {
          "id": "product_image_001",
          "type": "IMAGE",
          "mode": "dynamic",
          "fieldId": "imageUrl",
          "x": 200,
          "y": 20,
          "width": 80,
          "height": 80,
          "fit": "contain"
        },
        {
          "id": "qrcode_001",
          "type": "QRCODE",
          "fieldId": "qrContent",
          "x": 230,
          "y": 20,
          "width": 48,
          "height": 48
        },
        {
          "id": "barcode_001",
          "type": "BARCODE",
          "fieldId": "barcodeContent",
          "x": 20,
          "y": 100,
          "width": 180,
          "height": 28,
          "format": "CODE128",
          "showText": false
        }
      ]
    }
  }
}
```

---

# 十六、初始化数据结构建议
## 1. 新建模板初始化
```json
{
  "mode": "create",
  "profile": {
    "profileId": "profile_296_128_bwr",
    "name": "2.9寸黑白红电子价签",
    "width": 296,
    "height": 128,
    "colorMode": "BWR",
    "palette": [
      {
        "name": "white",
        "value": "#FFFFFF"
      },
      {
        "name": "black",
        "value": "#000000"
      },
      {
        "name": "red",
        "value": "#FF0000"
      }
    ]
  },
  "previewData": {
    "productName": "示例商品名称",
    "price": 9.9,
    "discount": 8.8,
    "description": "示例商品描述",
    "imageUrl": "https://example.com/product.png",
    "qrContent": "https://example.com/item/1001",
    "barcodeContent": "SKU1001"
  }
}
```

---

## 2. 编辑模板初始化
```json
{
  "mode": "edit",
  "templateId": "template_001",
  "templateName": "电子价签模板",
  "profile": {},
  "fullJson": {},
  "staticDynamic": {},
  "previewData": {
    "productName": "示例商品名称",
    "price": 9.9,
    "discount": 8.8,
    "description": "示例商品描述",
    "imageUrl": "https://example.com/product.png",
    "qrContent": "https://example.com/item/1001",
    "barcodeContent": "SKU1001"
  }
}
```

---

# 十七、第一版最终冻结需求一句话
> 第一版电子价签模板编辑器是一个由外部业务系统集成的前端模板编辑模块，基于 Vue 3 + Fabric.js 实现，Screen Profile、模板数据和预览数据均由外部传入；编辑器支持 BW、BWR、BWRY、E6 电子墨水屏颜色模式，提供矩形、直线、文本、价格、折扣、静态图片、动态图片、二维码、CODE128 条形码等组件，支持商品字段和自定义文本字段绑定；保存时同时输出 Full JSON 与 Static PNG Base64 + Dynamic Metadata，并优先通过 onSave 回调交给外部系统保存，同时兼容 saveApi 配置。
>

下一步建议把这份冻结需求拆成 **Epic / Feature / User Story / 验收标准**，这样就可以进入 OpenSpec 或研发任务拆解阶段。
