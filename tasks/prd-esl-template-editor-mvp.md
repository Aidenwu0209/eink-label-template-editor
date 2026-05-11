# PRD: 电子价签模板编辑器 MVP 优化

## 1. 介绍 / 概述

本 PRD 用于将 `requirements.md` 中冻结的电子价签模板编辑器 MVP 需求拆分为可实施、可验收的研发任务。

该编辑器是一个由外部业务系统集成的前端模板编辑模块，基于 Vue 3 + Fabric.js 实现。编辑器不负责后端模板管理、用户权限、模板版本、设备推送或厂商协议，只负责根据外部传入的 Screen Profile 和模板数据完成可视化编辑、电子墨水屏预览，并在保存时输出 Full JSON、Static PNG Base64 和 Dynamic Metadata。

## 2. 目标

- 支持外部业务系统通过初始化数据创建或编辑电子价签模板。
- 支持 BW、BWR、BWRY、E6 四类电子墨水屏颜色模式。
- 支持矩形、直线、文本、图片、价格、折扣、二维码、CODE128 条形码等 MVP 组件。
- 支持系统字段和自定义文本字段绑定。
- 支持电子墨水屏最终显示效果预览。
- 保存时生成完整 Payload，并优先通过 `onSave` 回调交给外部系统保存。
- 明确第一版边界，避免引入用户体系、权限、模板数据库、版本管理、发布审批和设备推送等非 MVP 能力。

## 3. User Stories

### US-001: 支持外部初始化数据契约

**描述：** 作为外部业务系统，我想通过统一初始化数据启动编辑器，以便创建或编辑指定电子价签模板。

**Acceptance Criteria：**
- [ ] 编辑器支持 `mode: "create"` 初始化。
- [ ] 编辑器支持 `mode: "edit"` 初始化。
- [ ] 初始化数据可以包含 `profile`、`previewData`、`templateId`、`templateName`、`fullJson`、`staticDynamic`。
- [ ] 当 `mode` 缺失或不是 `create/edit` 时，页面显示明确初始化错误。
- [ ] 当 `profile.width` 或 `profile.height` 缺失、不是数字或小于等于 0 时，页面显示明确初始化错误。
- [ ] 使用 Browser 打开编辑器页面，传入合法 create 初始化数据后，页面进入编辑器而不是错误页。
- [ ] 使用 Browser 打开编辑器页面，传入非法 profile 后，页面显示初始化失败信息。
- [ ] `npm run build` 通过。

### US-002: 根据 Screen Profile 创建固定尺寸画布

**描述：** 作为模板编辑用户，我想让编辑器根据传入屏幕 Profile 创建真实尺寸画布，以便模板尺寸与电子价签设备一致。

**Acceptance Criteria：**
- [ ] 画布宽度等于 `profile.width`。
- [ ] 画布高度等于 `profile.height`。
- [ ] 创建画布后，编辑过程中不能通过 UI 或内部逻辑改变画布真实宽高。
- [ ] 状态栏或画布信息区域显示当前宽高。
- [ ] 使用 Browser 打开编辑器页面，传入 `296 x 128` Profile 后，编辑画布和预览画布都以该尺寸比例显示。
- [ ] 切换到另一个合法 Profile 初始化后，画布尺寸按新 Profile 生效。
- [ ] `npm run build` 通过。

### US-003: 支持 BW / BWR / BWRY / E6 颜色模式

**描述：** 作为模板编辑用户，我想让编辑器按照当前电子墨水屏颜色模式限制颜色，以便最终输出适合设备显示。

**Acceptance Criteria：**
- [ ] BW Profile 只允许黑、白两色。
- [ ] BWR Profile 只允许黑、白、红三色。
- [ ] BWRY Profile 只允许黑、白、红、黄四色。
- [ ] E6 Profile 只允许黑、白、红、绿、蓝、黄、橙七色。
- [ ] 文本、线条、矩形、背景、价格、折扣、二维码、条形码可选颜色均来自当前 `profile.palette`。
- [ ] 当导入模板中存在非 palette 颜色时，保存或预览前会映射到最近 palette 颜色。
- [ ] 使用 Browser 在编辑器中新增一个矩形，颜色选择器只显示当前 Profile palette 中的颜色。
- [ ] `npm run build` 通过。

### US-004: 定义系统字段与自定义字段校验

**描述：** 作为模板编辑用户，我想绑定商品字段和自定义字段，以便模板可以显示业务数据。

**Acceptance Criteria：**
- [ ] 系统字段固定包含 `productName`、`price`、`discount`、`description`、`imageUrl`、`qrContent`、`barcodeContent`。
- [ ] 自定义字段只支持文本类型。
- [ ] 自定义字段 ID 不能为空。
- [ ] 自定义字段 ID 只能包含英文字母、数字、下划线。
- [ ] 自定义字段 ID 必须以英文字母开头。
- [ ] 自定义字段 ID 不能与系统字段重名。
- [ ] 同一模板内自定义字段 ID 不能重复。
- [ ] 输入 `brand`、`originPrice`、`memberPrice`、`unit` 时校验通过。
- [ ] 输入 `价格`、`product-name`、`123abc`、`price`、`qrContent` 时显示明确错误。
- [ ] `npm run build` 通过。

### US-005: 支持 RECT 和 LINE 基础组件

**描述：** 作为模板编辑用户，我想添加矩形和直线，以便制作背景块、标签块、边框和分割线。

**Acceptance Criteria：**
- [ ] 用户可以从工具栏添加 RECT。
- [ ] 用户可以从工具栏添加 LINE。
- [ ] RECT 支持编辑位置、尺寸、填充色、描边色、描边宽度。
- [ ] LINE 支持编辑起点、终点、颜色、线宽。
- [ ] RECT 和 LINE 的颜色只能使用当前 Profile palette。
- [ ] 保存后，RECT 和 LINE 出现在 Full JSON 中。
- [ ] 保存后，RECT 和 LINE 被合成到 Static PNG Base64 中。
- [ ] 使用 Browser 添加一个矩形和一条直线，编辑画布与预览画布都能看到对应图形。
- [ ] `npm run build` 通过。

### US-006: 支持 TEXT 文本组件

**描述：** 作为模板编辑用户，我想添加固定文本或动态文本，以便展示商品名称、描述和自定义文本字段。

**Acceptance Criteria：**
- [ ] 用户可以添加 TEXT 组件。
- [ ] TEXT 可以设置为固定文本，不绑定字段。
- [ ] TEXT 可以绑定 `productName`、`description` 或自定义文本字段。
- [ ] TEXT 默认字体为 `AlibabaPuHuiTi`。
- [ ] TEXT 字重只支持 `normal` 和 `bold`。
- [ ] TEXT 支持 `clip`、`ellipsis`、`wrap` 三种超长模式。
- [ ] TEXT 默认超长模式为 `ellipsis`。
- [ ] TEXT 支持 `lineClamp`。
- [ ] TEXT 支持水平对齐和垂直对齐。
- [ ] 使用 Browser 添加一个绑定 `productName` 的 TEXT，修改 previewData 后，预览显示新的商品名称。
- [ ] `npm run build` 通过。

### US-007: 支持 IMAGE 图片组件

**描述：** 作为模板编辑用户，我想添加静态图片或动态图片，以便模板可以显示 Logo、固定图标或商品图。

**Acceptance Criteria：**
- [ ] 用户可以添加静态 IMAGE。
- [ ] 用户可以添加动态 IMAGE。
- [ ] 静态 IMAGE 保存时被合成到 Static PNG Base64。
- [ ] 动态 IMAGE 固定绑定 `imageUrl` 字段。
- [ ] 动态 IMAGE 保存时进入 `dynamicMetadata.widgets`。
- [ ] IMAGE 支持 `contain`、`cover`、`fill` 三种 fit 模式。
- [ ] IMAGE 默认 fit 为 `contain`。
- [ ] IMAGE 支持设置背景色，颜色来自当前 Profile palette。
- [ ] 使用 Browser 添加动态 IMAGE，传入 previewData.imageUrl 后，预览区域显示对应图片区域。
- [ ] `npm run build` 通过。

### US-008: 支持 PRICE 复合价格组件

**描述：** 作为模板编辑用户，我想使用独立 PRICE 组件展示商品价格，以便价格符号、整数、小数可以独立排版。

**Acceptance Criteria：**
- [ ] 用户可以添加 PRICE 组件。
- [ ] PRICE 固定绑定 `price` 字段。
- [ ] PRICE 不是普通 TEXT 组件。
- [ ] PRICE 支持货币符号配置，默认 `¥`。
- [ ] PRICE 支持是否显示货币符号。
- [ ] PRICE 支持小数位数配置。
- [ ] PRICE 支持千分位分隔符配置。
- [ ] PRICE 支持小数分隔符配置。
- [ ] PRICE 的 currency、integer、decimal 三段样式可分别设置字号、字重、颜色。
- [ ] PRICE decimal 支持 `offsetY` 上浮。
- [ ] 保存后，PRICE 以单个 `type: "PRICE"` widget 写入 Dynamic Metadata。
- [ ] 使用 Browser 添加 PRICE，previewData.price 为 `1299.9` 时，预览显示格式化价格。
- [ ] `npm run build` 通过。

### US-009: 支持 DISCOUNT 折扣组件

**描述：** 作为模板编辑用户，我想使用 DISCOUNT 组件展示商品折扣，以便快速制作促销标签。

**Acceptance Criteria：**
- [ ] 用户可以添加 DISCOUNT 组件。
- [ ] DISCOUNT 固定绑定 `discount` 字段。
- [ ] DISCOUNT 支持格式模板，例如 `{value}折`。
- [ ] DISCOUNT 支持背景色和文字色。
- [ ] DISCOUNT 支持字号和 `normal/bold` 字重。
- [ ] DISCOUNT 支持水平居中和垂直居中。
- [ ] DISCOUNT 颜色只能来自当前 Profile palette。
- [ ] 保存后，DISCOUNT 以 `type: "DISCOUNT"` widget 写入 Dynamic Metadata。
- [ ] 使用 Browser 添加 DISCOUNT，previewData.discount 为 `8.8` 时，预览显示 `8.8折`。
- [ ] `npm run build` 通过。

### US-010: 支持 QRCODE 二维码组件

**描述：** 作为模板编辑用户，我想添加二维码组件，以便电子价签可以展示商品详情或营销链接。

**Acceptance Criteria：**
- [ ] 用户可以添加 QRCODE 组件。
- [ ] QRCODE 固定绑定 `qrContent` 字段。
- [ ] QRCODE 不允许绑定其他字段。
- [ ] QRCODE 支持设置宽高。
- [ ] QRCODE 支持 error correction 配置，默认 `M`。
- [ ] QRCODE 支持 margin 配置，默认 `1`。
- [ ] QRCODE 支持前景色和背景色，颜色来自当前 Profile palette。
- [ ] 保存后，QRCODE 以 `type: "QRCODE"` widget 写入 Dynamic Metadata。
- [ ] 使用 Browser 添加 QRCODE，previewData.qrContent 为 URL 时，预览显示二维码图形。
- [ ] `npm run build` 通过。

### US-011: 支持 BARCODE 条形码组件

**描述：** 作为模板编辑用户，我想添加 CODE128 条形码组件，以便电子价签可以展示商品编码。

**Acceptance Criteria：**
- [ ] 用户可以添加 BARCODE 组件。
- [ ] BARCODE 固定绑定 `barcodeContent` 字段。
- [ ] BARCODE 不允许绑定其他字段。
- [ ] BARCODE 第一版只支持 `CODE128`。
- [ ] BARCODE 不显示 EAN-13、UPC-A、DataMatrix 等格式选项。
- [ ] BARCODE 支持 `showText` 开关。
- [ ] BARCODE 支持前景色和背景色，颜色来自当前 Profile palette。
- [ ] 保存后，BARCODE 以 `type: "BARCODE"` widget 写入 Dynamic Metadata。
- [ ] 使用 Browser 添加 BARCODE，previewData.barcodeContent 为 `SKU1001` 时，预览显示 CODE128 条形码。
- [ ] `npm run build` 通过。

### US-012: 支持电子墨水屏预览

**描述：** 作为模板编辑用户，我想实时预览电子墨水屏最终显示效果，以便确认模板在设备上的近似呈现。

**Acceptance Criteria：**
- [ ] 页面同时显示编辑画布和预览画布。
- [ ] 编辑画布发生对象新增、修改、删除后，预览画布自动更新。
- [ ] 预览结果使用当前 Profile palette 进行颜色量化。
- [ ] BW 预览结果只包含黑白两色。
- [ ] BWR 预览结果只包含黑白红三色。
- [ ] BWRY 预览结果只包含黑白红黄四色。
- [ ] E6 预览结果只包含黑白红绿蓝黄橙七色。
- [ ] 使用 Browser 修改一个对象颜色后，预览在短时间内更新为 palette 约束后的结果。
- [ ] `npm run build` 通过。

### US-013: 生成保存 Payload

**描述：** 作为外部业务系统，我想在用户保存时拿到完整模板结果，以便由宿主系统自行入库或进入后续流程。

**Acceptance Criteria：**
- [ ] 点击保存后生成 `templateId`。
- [ ] 点击保存后生成 `templateName`。
- [ ] 点击保存后生成完整 `profile`。
- [ ] 点击保存后生成 `fullJson`。
- [ ] 点击保存后生成 `staticDynamic.staticImage`。
- [ ] `staticDynamic.staticImage.type` 为 `base64`。
- [ ] `staticDynamic.staticImage.format` 为 `png`。
- [ ] `staticDynamic.staticImage.data` 以 `data:image/png;base64,` 开头。
- [ ] 点击保存后生成 `staticDynamic.dynamicMetadata`。
- [ ] `dynamicMetadata.fontFamily` 为 `AlibabaPuHuiTi`。
- [ ] `dynamicMetadata.reservedFields` 包含所有系统固有字段。
- [ ] `dynamicMetadata.widgets` 包含所有动态组件。
- [ ] 使用 Browser 在页面中添加 TEXT、PRICE、IMAGE、QRCODE 后点击保存，可以观察到 Payload 包含对应 widgets。
- [ ] `npm run build` 通过。

### US-014: 支持 onSave 优先保存方式

**描述：** 作为外部业务系统，我想通过 `onSave(payload)` 接收保存结果，以便由宿主系统处理保存逻辑。

**Acceptance Criteria：**
- [ ] 当外部传入 `onSave` 时，点击保存优先调用 `onSave(payload)`。
- [ ] `onSave` 收到的 payload 与保存 Payload 结构一致。
- [ ] `onSave` 成功 resolve 后，页面显示保存成功状态。
- [ ] `onSave` reject 或抛错后，页面显示明确保存失败信息。
- [ ] 当同时传入 `onSave` 和 `saveApi` 时，不发送 `saveApi` 请求。
- [ ] 使用 Browser 点击保存，控制台或测试桩可以观察到 `onSave` 被调用一次。
- [ ] `npm run build` 通过。

### US-015: 支持 saveApi 兼容保存方式

**描述：** 作为外部业务系统，我想在没有传入 `onSave` 时让编辑器直接请求保存接口，以便兼容简单集成场景。

**Acceptance Criteria：**
- [ ] 当未传入 `onSave` 且传入 `saveApi` 时，点击保存发送 `POST saveApi` 请求。
- [ ] 请求 body 为保存 Payload。
- [ ] 后端返回 2xx 时，页面显示保存成功状态。
- [ ] 后端返回非 2xx 或网络错误时，页面显示明确保存失败信息。
- [ ] 当未传入 `onSave` 且未传入 `saveApi` 时，点击保存显示明确配置错误。
- [ ] 在本地开发环境中，前端请求真实发送到目标接口，不是 404 或假响应。
- [ ] `npm run build` 通过。

### US-016: 完成创建到保存的闭环验证

**描述：** 作为模板编辑用户，我想完成一次从初始化、编辑、预览到保存的完整流程，以便确认 MVP 功能可以真实串联。

**Acceptance Criteria：**
- [ ] 使用 Browser 打开 create 模式编辑器。
- [ ] 传入 BWR Profile 和完整 previewData。
- [ ] 添加 RECT、TEXT、PRICE、DISCOUNT、动态 IMAGE、QRCODE、BARCODE。
- [ ] 编辑画布能看到所有新增组件。
- [ ] 预览画布能看到 palette 量化后的最终效果。
- [ ] 点击保存后生成 Full JSON。
- [ ] 点击保存后生成 Static PNG Base64。
- [ ] 点击保存后生成 Dynamic Metadata。
- [ ] Dynamic Metadata 中包含 TEXT、PRICE、DISCOUNT、IMAGE、QRCODE、BARCODE widgets。
- [ ] 页面无控制台错误。
- [ ] `npm run build` 通过。

## 4. Functional Requirements

- FR-1: 系统必须允许外部通过初始化数据传入 `mode`、`profile`、`previewData`、`fullJson`、`staticDynamic`。
- FR-2: 系统必须根据 `profile.width` 和 `profile.height` 创建固定尺寸画布。
- FR-3: 系统必须支持 BW、BWR、BWRY、E6 四种颜色模式。
- FR-4: 系统必须使用 `profile.palette` 限制所有可编辑颜色。
- FR-5: 系统必须在预览和导出时将颜色量化到当前 palette。
- FR-6: 系统必须内置 `productName`、`price`、`discount`、`description`、`imageUrl`、`qrContent`、`barcodeContent` 字段。
- FR-7: 系统必须支持用户创建文本型自定义字段。
- FR-8: 系统必须校验自定义字段 ID 的合法性和唯一性。
- FR-9: 系统必须支持 RECT、LINE、TEXT、IMAGE 基础组件。
- FR-10: 系统必须支持 PRICE、DISCOUNT、QRCODE、BARCODE 业务组件。
- FR-11: PRICE 组件必须作为复合组件处理，不能仅作为普通文本保存。
- FR-12: QRCODE 必须固定绑定 `qrContent`。
- FR-13: BARCODE 必须固定绑定 `barcodeContent`。
- FR-14: BARCODE 第一版必须只支持 CODE128。
- FR-15: 动态 IMAGE 必须固定绑定 `imageUrl`。
- FR-16: TEXT 必须支持 `clip`、`ellipsis`、`wrap` 三种超长模式。
- FR-17: 第一版字体必须统一为 `AlibabaPuHuiTi`。
- FR-18: 保存时必须输出 Full JSON。
- FR-19: 保存时必须输出 Static PNG Base64。
- FR-20: 保存时必须输出 Dynamic Metadata。
- FR-21: 保存时必须优先调用 `onSave(payload)`。
- FR-22: 未传入 `onSave` 但传入 `saveApi` 时，系统必须请求 `POST saveApi`。
- FR-23: 系统必须提供明确的初始化错误和保存错误反馈。

## 5. Non-Goals

第一版不包含以下内容：

- 用户体系。
- 权限管理。
- Screen Profile 后端管理。
- 模板版本管理。
- 模板发布审批。
- 模板数据库持久化。
- 设备推送。
- 电子价签厂商协议。
- 多字体管理。
- 多条形码格式。
- 复杂路径、阴影、滤镜、渐变。
- 任意 Fabric JSON 后端完整复刻。
- 后端模板列表、搜索、删除、复制等管理页面。
- 多语言切换。
- 团队协作编辑。

## 6. Design Considerations

- 编辑器首屏应直接进入可编辑工作台，不做营销式首页。
- 工作区建议包含工具栏、组件面板、编辑画布、属性面板、预览画布、状态栏。
- 颜色选择器只展示当前 Screen Profile palette，不提供任意颜色输入。
- 组件属性面板应按当前选中组件显示可编辑项。
- PRICE、DISCOUNT、QRCODE、BARCODE 应作为业务组件在工具栏中清晰区分。
- 错误状态应显示可读文本，避免只在控制台输出。

## 7. Technical Considerations

- 当前项目技术栈为 Vue 3、Fabric.js、Pinia、Vue Router、Vite。
- 现有 `EditorCore` 已提供 Fabric Canvas 包装和插件系统，后续应优先复用。
- 现有 E-ink 相关插件可以作为颜色约束、预览和导出的基础。
- 需要补齐 BWRY 和 E6 Profile，因为当前已有类型不完全覆盖需求中的四种模式。
- 需要建立独立 Widget Metadata 模型，避免直接依赖任意 Fabric JSON 作为业务数据源。
- 二维码和条形码生成建议封装为独立渲染模块，保持与 Fabric 对象创建逻辑解耦。
- Static PNG 生成时应明确静态层和动态层的处理边界。
- 如果动态图片、二维码、条形码在预览中需要异步渲染，保存前必须等待渲染完成。

## 8. Success Metrics

- 用户可以在 1 分钟内完成一个简单电子价签模板创建。
- 用户可以在一次保存中获得 Full JSON、Static PNG Base64 和 Dynamic Metadata。
- 保存 Payload 中动态组件字段完整率达到 100%。
- BW / BWR / BWRY / E6 预览输出颜色不超过对应 Profile palette。
- MVP 范围内所有 User Stories 的验收标准通过。
- `npm run build` 稳定通过。

## 9. Open Questions

- 初始化数据最终由 URL 参数、全局变量、组件 props，还是 postMessage 传入？
- `onSave` 在当前集成方式下如何传入：Vue prop、window callback，还是事件机制？
- Static PNG 是否应排除动态文本，还是仅排除动态图片、二维码、条形码等动态部件？
- 动态 TEXT 在 Static PNG 中是否渲染 defaultValue，还是完全只进入 Dynamic Metadata？
- PRICE / DISCOUNT 在 Static PNG 中是否作为 defaultValue 渲染，还是完全动态化？
- 自定义字段是否需要在保存 Payload 中单独输出字段定义列表？
- 二维码和条形码是否允许编辑器离线生成，还是由外部渲染系统根据 Metadata 生成？
- 阿里巴巴普惠体字体文件由项目内置，还是由宿主系统提供？
- BWRY 和 E6 的颜色值是否固定，还是完全以外部 profile.palette 为准？
