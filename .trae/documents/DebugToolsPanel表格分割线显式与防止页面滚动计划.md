# DebugToolsPanel 表格分割线显式与防止页面滚动计划

## Summary

修复 [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue) 中结果表格的两个体验问题：
1. 列宽拖动分割线默认不可见，改为始终显示的显式分割线。
2. 表格列宽总和大时会把整个页面撑出水平滚动条，改为仅在表格容器内部滚动。

## Current State Analysis

- [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue) 中的 `ResizableResultTable` 局部组件已实现列宽拖动。
- 当前分割线样式（第 972–987 行）：
  - 默认 `background: transparent`，只有 hover / active 时显示颜色，用户无法直观看到分割线。
- 当前表格容器样式（第 921–926 行）：
  - `.result-table-wrap` 仅设置了 `overflow: auto`，没有限制宽度。
  - `.result-table` 设置为 `width: 100%` + `table-layout: fixed`，但 `<col>` 上绑定了固定像素宽度。
  - 当各列默认宽度（`120px`）× 列数超过容器宽度时，table 会撑开 `.result-table-wrap`，进而沿 flex 布局链撑开 `.sql-main` / `.tab-content`，导致页面级水平滚动条。
- 外层布局链：
  - `.debug-panel`：`overflow: hidden`
  - `.tab-content`：`overflow-y: auto`（缺少 `overflow-x` 控制）
  - `.sql-layout`：`display: flex`
  - `.sql-main`：`flex: 1; min-width: 0; overflow: hidden`
  - `.sql-result`：`overflow: auto; min-width: 0`
  - `.result-table-wrap`：`overflow: auto`

## Proposed Changes

### 1. 让列宽分割线始终可见

**文件：** [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue)

**What：** 修改 `.col-resize-handle` 样式，使其默认状态下即显示一条细线，hover / 拖动时变宽并高亮。

**How：**
- 将 handle 默认宽度保持 `6px`，但内部通过 `linear-gradient` 或 `border-right` 渲染一条居中的 1px 细线，使用 `var(--color-border)` 颜色。
- hover / active 时整条 6px 区域填充 `var(--color-primary)`，与当前一致。
- 保持 `cursor: col-resize`，并增加 `z-index: 2`，确保分割线位于相邻 th 的上方。

示例样式：
```css
:deep(.col-resize-handle) {
  position: absolute;
  right: 0;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 2;
  background: linear-gradient(
    to right,
    transparent 2px,
    var(--color-border) 2px,
    var(--color-border) 3px,
    transparent 3px
  );
  transition: background 0.15s;
}

:deep(.col-resize-handle:hover),
:deep(.col-resize-handle:active) {
  background: var(--color-primary);
}
```

### 2. 限制表格容器宽度，防止撑开页面

**文件：** [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue)

**What：** 调整 `.result-table-wrap` 与 `.result-table` 的宽度策略，使表格仅在 wrap 内部横向滚动，不影响外层页面。

**How：**
- 给 `.result-table-wrap` 增加：
  ```css
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  ```
- 将 `.result-table` 的宽度策略从 `width: 100%` 改为：
  ```css
  width: max-content;
  min-width: 100%;
  ```
  这样：
  - 当列宽总和小于容器时，表格占满容器（无滚动条）。
  - 当列宽总和大于容器时，表格以内容宽度为准，仅 `.result-table-wrap` 出现横向滚动条。
- 给 `.tab-content` 增加 `overflow-x: hidden` 作为兜底，防止任何意外溢出导致页面级滚动条。

### 3. 同步调整 th 的 box-sizing

**文件：** [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue)

**What：** 确保 th 宽度计算不受 padding 影响。

**How：**
- 在 `:deep(.result-table th)` 与 `:deep(.result-table td)` 中补充 `box-sizing: border-box;`。

## Assumptions & Decisions

1. **作用范围：** 仅修改 [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsProject.vue) 的样式部分，不动组件逻辑。
2. **分割线视觉：** 默认显示 1px 灰色细线，hover 时整条 6px 区域高亮，既显式又不突兀。
3. **滚动策略：** 表格宽度由内容决定，容器限定宽度并内部滚动；不改动列宽拖动逻辑或默认值。
4. **兜底方案：** 给 `.tab-content` 添加 `overflow-x: hidden`，避免未来其他内容意外撑出页面滚动条。

## Verification Steps

1. 启动开发服务器：`npm run dev`。
2. 进入 `/admin/debug/sql` 页面，执行 `SELECT * FROM sqlite_master WHERE type="table"` 等多列表查询。
3. 观察表头：列与列之间默认可见一条灰色细线；鼠标悬停时细线变为主题色宽条。
4. 拖动分割线：确认列宽可调，拖动时仍有主题色高亮。
5. 检查页面滚动：浏览器窗口缩小或查询多列时，确认仅在表格区域出现横向滚动条，页面整体没有水平滚动条。
6. 运行构建检查：`npm run build`，确认无类型与构建错误。
