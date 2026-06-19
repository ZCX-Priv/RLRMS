# DebugToolsPanel 表格限宽为视口宽度计划

## Summary

修复调试页面结果表格宽度仍超出视口、导致页面出现水平滚动条的问题。根因在于外层 flex 布局链缺少 `min-width: 0`，使宽表格内容将主内容区撑出视口。

## Current State Analysis

布局链（由外到内）：

1. `.admin-layout`（[LayoutView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/views/LayoutView.vue) 第 262 行）：`display: flex`
2. `.main-content`（第 744–748 行）：`flex: 1; padding: var(--spacing-lg)` — **缺少 `min-width: 0`**
3. `.debug-page`（[DebugView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/views/DebugView.vue) 第 20–22 行）：`max-width: 1200px` — **缺少 `overflow` 控制**
4. `.debug-panel` → `.tab-content`（`overflow-x: hidden`）→ `.sql-layout`（flex）→ `.sql-main`（`min-width: 0; overflow: hidden`）→ `.sql-result`（`min-width: 0; overflow: hidden`）→ `.result-table-wrap`（`overflow: auto; min-width: 0`）→ `.result-table`（`width: max-content`）

**根因：** `.main-content` 是 `.admin-layout` 的 flex 子项，`flex: 1` 但没有 `min-width: 0`。flex 子项默认 `min-width: auto`，其值为内容的 min-content 宽度。当 `.result-table` 使用 `width: max-content` 且列数较多时，表格的固有宽度沿布局链向上传播，`.main-content` 的 `min-width: auto` 阻止其收缩到视口可用宽度以内，从而撑出页面级水平滚动条。

`.debug-page` 作为 block 元素没有 `overflow` 控制，其 min-content 宽度同样由内部宽表格决定，进一步加剧了问题。

DebugToolsPanel.vue 内部的 flex 链（`.sql-main` → `.sql-result` → `.result-table-wrap`）已正确设置 `min-width: 0`，无需修改。

## Proposed Changes

### 1. 给 `.main-content` 添加 `min-width: 0`

**文件：** [LayoutView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/views/LayoutView.vue)

**What：** 在 `.main-content` 样式中添加 `min-width: 0`，修复 flex 子项不能收缩的根因。

**Why：** 这是 flexbox 布局的标准最佳实践。缺少 `min-width: 0` 时，flex 子项的 `min-width: auto` 会取内容的固有宽度作为最小宽度，导致内容溢出视口。

**How：**
```css
.main-content {
  flex: 1;
  min-width: 0;
  padding: var(--spacing-lg);
  margin-top: 60px;
}
```

### 2. 给 `.debug-page` 添加 `overflow: hidden`

**文件：** [DebugView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/views/DebugView.vue)

**What：** 在 `.debug-page` 样式中添加 `overflow: hidden`，作为调试页面的针对性兜底。

**Why：** `overflow: hidden` 使 `.debug-page` 的 min-content 宽度变为 0，切断宽表格内容向上传播的路径；同时裁剪任何意外溢出，确保调试页面不会超出父容器宽度。

**How：**
```css
.debug-page {
  max-width: 1200px;
  overflow: hidden;
}
```

## Assumptions & Decisions

1. **作用范围：** 修改 [LayoutView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/views/LayoutView.vue) 的 `.main-content` 和 [DebugView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/views/DebugView.vue) 的 `.debug-page`，不改动 DebugToolsPanel.vue（其内部 flex 链已正确）。
2. **`min-width: 0` 影响面：** 这是 flex 布局标准实践，不会破坏其他页面——其他页面已有各自的 overflow 处理，`min-width: 0` 仅允许主内容区在需要时正确收缩。
3. **双重保障：** `.main-content` 的 `min-width: 0` 修复根因，`.debug-page` 的 `overflow: hidden` 提供页面级兜底，两者配合确保表格滚动严格限制在 `.result-table-wrap` 内部。
4. **不改动表格逻辑：** 列宽拖动、省略、容器内滚动等已有实现保持不变。

## Verification Steps

1. 启动开发服务器：`npm run dev`。
2. 进入 `/admin/debug/sql` 页面，执行多列查询（如 `SELECT * FROM sqlite_master WHERE type="table"`）。
3. 缩小浏览器窗口至较小宽度，确认页面整体没有水平滚动条。
4. 确认表格仅在 `.result-table-wrap` 容器内横向滚动。
5. 点击左侧表名加载表数据预览，确认第二个表格同样不撑出视口。
6. 运行构建检查：`npm run build`，确认无类型与构建错误。
