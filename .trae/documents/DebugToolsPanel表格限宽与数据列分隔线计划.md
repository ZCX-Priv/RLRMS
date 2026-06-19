# DebugToolsPanel 表格限宽与数据列分隔线计划

## Summary

修复 [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue) 中结果表格的两个体验问题：
1. 表格宽度仍会超出视口，导致页面整体被撑出水平滚动条。
2. 列宽拖动分割线目前只在表头（`th`）中可见，需要像标准表格一样贯穿到数据行（`td`）。

## Current State Analysis

- [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue) 中的 `ResizableResultTable` 局部组件已实现列宽拖动与省略。
- 当前表格容器 `.result-table-wrap`（第 922–930 行）已设置 `width: 100%; max-width: 100%; overflow: auto`，但 `100%` 是相对于直接父元素 `.sql-result`。
- `.sql-result`（第 901–907 行）和 `.table-data-section`（第 1003–1012 行）当前均为 `overflow: auto`，这会让它们在内部 `max-content` 表格较宽时自身被撑开，导致 `.result-table-wrap` 的 `100%` 基于一个已经过宽的父元素，从而突破视口。
- 当前列分割线仅通过表头 `th` 内的 `.col-resize-handle`（第 979–1000 行）呈现，数据单元格 `td` 之间没有任何竖向分隔线，视觉上不像完整表格。

## Proposed Changes

### 1. 限制表格容器宽度，避免撑出视口

**文件：** [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue)

**What：** 修改 `.sql-result` 与 `.table-data-section` 的 `overflow` 策略，并让 `.result-table-wrap` 在 flex 链中正确收缩，使表格滚动严格限定在容器内部。

**How：**
- 将 `.sql-result` 的 `overflow: auto` 改为 `overflow: hidden`，并补充 `display: flex; flex-direction: column;`：
  ```css
  .sql-result {
    padding: 0 10px 10px;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  ```
- 将 `.table-data-section` 的 `overflow: auto` 同样改为 `overflow: hidden`，并补充 flex 列布局：
  ```css
  .table-data-section {
    padding: 0 10px 10px;
    border-top: 1px solid var(--color-border-light);
    margin-top: 4px;
    padding-top: 8px;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  ```
- 给 `.result-table-wrap` 增加 `min-width: 0` 与 `flex: 1`，确保它在 flex 父元素中可被压缩到视口可用宽度：
  ```css
  :deep(.result-table-wrap) {
    overflow: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    max-height: 240px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    flex: 1;
  }
  ```

### 2. 让分隔线贯穿表头和数据行

**文件：** [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue)

**What：** 给所有 `th` 和 `td` 统一添加右边框作为列分隔线；将 `.col-resize-handle` 改为默认透明、hover/拖动时高亮，避免与边框重叠产生双线效果。

**How：**
- 给 `th` 与 `td` 增加右边框，并移除最后一列的边框：
  ```css
  :deep(.result-table th),
  :deep(.result-table td) {
    border-right: 1px solid var(--color-border-light);
    /* 保留既有 padding / ellipsis / box-sizing 等样式 */
  }

  :deep(.result-table th:last-child),
  :deep(.result-table td:last-child) {
    border-right: none;
  }
  ```
- 调整 `.col-resize-handle` 默认背景为透明，hover/active 时仍显示主题色，保证可拖动的交互提示不变：
  ```css
  :deep(.col-resize-handle) {
    position: absolute;
    right: 0;
    top: 0;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 2;
    background: transparent;
    transition: background 0.15s;
  }

  :deep(.col-resize-handle:hover),
  :deep(.col-resize-handle:active) {
    background: var(--color-primary);
  }
  ```

## Assumptions & Decisions

1. **作用范围：** 仅修改 [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue) 的样式，不动列宽拖动组件逻辑。
2. **宽度限制策略：** 通过切断父容器的 `overflow: auto` 来阻止 flex 链被 `max-content` 表格撑开，表格横向滚动仍由 `.result-table-wrap` 内部处理。
3. **分隔线策略：** 统一使用 `border-right` 实现列分隔线，贯穿表头和数据行；`col-resize-handle` 仅保留交互高亮，避免默认状态与边框重叠。
4. **最后一列：** 最后一列的 `th` 和 `td` 不显示右边框，避免与表格容器右侧内边框形成双边框。

## Verification Steps

1. 启动开发服务器：`npm run dev`。
2. 进入 `/admin/debug/sql` 页面，执行列数较多的查询（如 `SELECT * FROM sqlite_master WHERE type="table"`），并缩小浏览器窗口。
3. 确认表格仅在 `.result-table-wrap` 容器内横向滚动，页面整体没有水平滚动条。
4. 观察表头和数据行：列与列之间有统一的竖向分隔线，最后一列右侧没有多余的边框。
5. 将鼠标悬停在表头分隔线处，光标变为 `col-resize`；拖动时该列右侧高亮，列宽可实时调整。
6. 点击左侧表名加载表数据预览，确认第二个表格同样满足上述限宽与分隔线效果。
7. 运行构建检查：`npm run build`，确认无类型与构建错误。