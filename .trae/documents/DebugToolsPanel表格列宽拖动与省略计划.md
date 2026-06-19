# DebugToolsPanel 表格列宽拖动与省略计划

## Summary

为 [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue) 中的两个结果表格（SQL 查询结果表、表数据预览表）添加列宽可左右拖动的分割线，并在列内容/列标题超出当前列宽时显示 `…` 三点省略。

## Current State Analysis

- 项目使用 Vue 3 + TypeScript + Vite，无 UI 组件库（如 Element Plus / Ant Design），表格为原生 `<table>`。
- [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue) 包含两个结构完全相同的表格：
  - SQL 执行结果表格（第 454 行）
  - 选中表的数据预览表格（第 490 行）
- 当前样式：
  - `table-layout: fixed`（已具备固定布局基础）
  - `td` 已设置 `max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
  - `th` 仅设置了 `white-space: nowrap`，没有 `overflow` 与 `text-overflow`
- 当前没有列宽拖动能力；两表格模板重复，适合提取为局部可复用组件。

## Proposed Changes

### 1. 提取可复用表格组件 `ResizableResultTable`

**文件：** [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue)

**What：** 在同一个 `<script setup>` 中定义一个局部组件 `ResizableResultTable`，接收 `columns: string[]`、`rows: Record<string, unknown>[]` 两个 props。

**Why：** 两个结果表格结构一致，提取后避免重复实现拖动逻辑与列宽状态。

**How：**
- 在 `<script setup>` 内使用 `defineProps` 定义局部组件（Vue 3 单文件组件中可直接再写一个 `script` 块或同一 `<script setup>` 内定义子组件函数）。
- 组件内部维护 `columnWidths: number[]` ref，初始化时给每列一个默认宽度（如 `120`）。
- 使用 `<colgroup>` + `<col>` 将 `columnWidths` 绑定到每列宽度。
- 表头 `th` 内渲染一个可拖动手柄：
  ```html
  <div class="col-resize-handle" @mousedown="startResize($event, index)"></div>
  ```
- 拖动逻辑：
  - `mousedown` 时记录起始鼠标 X 坐标与当前列宽度，监听 `mousemove` / `mouseup`。
  - `mousemove` 时计算 `deltaX = currentX - startX`，更新 `columnWidths[index] = max(minWidth, startWidth + deltaX)`。
  - `mouseup` 时移除全局事件监听。
  - 为提升体验，拖动时给 `document.body` 设置 `cursor: col-resize`，并阻止文本选中。
- 单元格与表头统一应用省略样式：
  ```css
  .result-table th,
  .result-table td {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  ```
- 保留原有 `table-layout: fixed` 与表格滚动容器。

### 2. 替换两个原有表格为 `ResizableResultTable`

**文件：** [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue)

**What：** 将第 453–468 行与第 489–503 行的两段 `<div class="result-table-wrap">...</div>` 替换为 `<ResizableResultTable :columns="..." :rows="..." />`。

**Why：** 统一行为，减少模板冗余。

**How：**
- SQL 结果区使用：
  ```vue
  <ResizableResultTable :columns="sqlResult.columns" :rows="sqlResult.rows" />
  ```
- 表数据预览区使用：
  ```vue
  <ResizableResultTable :columns="tableDataColumns" :rows="tableData" />
  ```

### 3. 新增列宽拖动样式

**文件：** [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue)（`<style scoped>` 区域）

**What：** 新增 `.col-resize-handle` 样式及拖动相关样式。

**How：**
- 手柄绝对定位在 `th` 右侧，宽度 `6px`，高度 `100%`，光标 `col-resize`。
- 默认半透明，hover 时加深，让用户感知可拖动。
- 保持 `th` 为 `position: relative`，确保手柄定位正确。
- 删除或覆盖 `td` 上旧的 `max-width: 200px`（列宽由 `columnWidths` 控制，避免冲突）。

## Assumptions & Decisions

1. **作用范围：** 仅处理 [DebugToolsPanel.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/components/DebugToolsPanel.vue) 中的两个 `result-table`，不改动项目其他页面。项目中仅此处存在原生 `<table>`。
2. **持久化：** 列宽不持久化到 localStorage，刷新页面后恢复默认值。若后续需要持久化，可在同一组件内再扩展。
3. **最小列宽：** 设置最小列宽（如 `60px`），防止用户拖到过窄导致表头完全不可读。
4. **响应式/移动端：** 拖动功能主要针对桌面端鼠标交互；移动端保持原有横向滚动，不额外支持触摸拖动。
5. **实现方式：** 不引入第三方表格库，使用原生 DOM 事件实现，避免增加依赖。
6. **TypeScript：** 不使用 `any`；props 类型使用 `Record<string, unknown>[]` 或更具体的行类型。

## Verification Steps

1. 启动开发服务器：`npm run dev`。
2. 进入管理后台调试工具页面（`/admin/debug/sql`）。
3. 执行任意 `SELECT` 查询，确认结果表格渲染正常。
4. 将鼠标悬停在表头列分隔线处，光标变为 `col-resize`。
5. 按住并左右拖动分割线，确认对应列宽度实时变化。
6. 将某列拖窄，确认列标题与单元格内容均出现 `…` 省略。
7. 点击左侧表名加载表数据预览，确认第二个表格同样支持拖动与省略。
8. 运行构建检查：`npm run build`（或 `vue-tsc -b`），确认无 TypeScript 类型错误。
