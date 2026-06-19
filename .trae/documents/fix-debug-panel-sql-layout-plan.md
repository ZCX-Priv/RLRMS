# 修复调试面板 SQL 区布局与滚动问题

## Summary
修复 `DebugToolsPanel.vue` 中 SQL 标签页在上次视口高度限制后出现的三个问题：
1. 左侧数据表区与右侧 SQL 区之间的竖直分割线未贯穿整个面板；
2. SQL 结果区与表数据预览区被固定 `max-height` 限制，未能填充下方空间，导致内容堆在上方；
3. 结果表格列数过多/单元格内容过长时，会撑大父容器，导致整个 `.main-content` 出现水平滚动条。

通过让 `.sql-main` 内部采用 flex 自适应布局、结果区与预览区各自独立滚动、并显式限制横向溢出，使面板既固定于视口内又合理利用空间。

## Current State Analysis
- **关键文件**：`src/admin/components/DebugToolsPanel.vue`
- **当前问题**：
  - `.sql-layout` 虽然设置了 `flex: 1; min-height: 0;`，但未显式声明 `height: 100%`；作为 `.tab-content` 的子元素，`.tab-content` 又带有 `overflow-y: auto`，可能导致左侧 `.schema-sidebar` 的 `border-right` 分割线高度依赖内容而不是容器，从而视觉上“断开”。
  - `.sql-result` 与 `.table-data-section` 当前固定 `max-height: 280px` 且 `flex-shrink: 0`，在 `.sql-main` 剩余空间较大时不会伸展，导致两个区域都挤在上方，下方留白。
  - `.sql-result` 与 `.table-data-section` 只设置了 `overflow-y: auto`，缺少 `overflow-x` 控制；内部 `.result-table-wrap` 虽然可横向滚动，但当表格总宽度超过容器时，父级 flex item 的默认 `min-width: auto` 会使其拒绝收缩，从而撑大 `.sql-main` → `.sql-layout` → `.tab-content` → `.main-content`，最终在整个页面出现水平滚动条。
  - `.result-table` 默认 `table-layout: auto`，列宽由内容决定，即使设置了 `td { max-width: 200px }`，宽表仍可能撑开容器。

## Proposed Changes

### 文件：`src/admin/components/DebugToolsPanel.vue`

#### 1. 修复竖直分割线高度
- `.sql-layout`：增加 `height: 100%;`（或 `min-height: 100%;`），确保其高度始终等于 `.tab-content` 的内容高度。
- `.schema-sidebar`：增加 `height: 100%;`，使其 `border-right` 竖直分割线从上到下贯穿。
- `.sql-main`：保持 `flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden;`。

#### 2. 让结果区与预览区自适应填充空间
- `.sql-result`：
  - 移除固定 `max-height: 280px;`
  - 改为 `flex: 1; min-height: 0; overflow: auto;`
  - 保留内边距与 `flex-shrink: 0` 的反向语义（即允许伸展并收缩到 0）。
- `.table-data-section`：
  - 同样移除固定 `max-height: 280px;`
  - 改为 `flex: 1; min-height: 0; overflow: auto;`
  - 保留 `border-top`、`margin-top`、`padding-top` 作为与上方结果区的视觉分隔。
- 这样当两个区域同时存在时，它们会平分 `.sql-main` 扣除输入区后的剩余空间；当只有一个存在时，它会占满剩余空间。

#### 3. 防止水平滚动条撑出 main
- `.sql-result` 与 `.table-data-section` 增加 `min-width: 0;`，强制 flex item 可以收缩到比内容更窄，避免被宽表格撑大。
- `.result-table-wrap` 保持 `overflow: auto`（横向+纵向内部滚动）。
- `.result-table` 增加 `table-layout: fixed; width: 100%;`，使列宽严格受容器宽度约束，而不是由内容撑开。
- `.result-table td` 保持 `white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis;`，确保单元格不换行且超出显示省略号。

#### 4. 保留宽度限制
- `.result-table-wrap` 的横向滚动保留，确保列多时可左右滚动。
- `.schema-sidebar` 宽度保持 `200px`，`flex-shrink: 0`。

## Assumptions & Decisions
- 用户描述的“中间分割线”指左侧 `.schema-sidebar` 与右侧 `.sql-main` 之间的竖直 `border-right`。通过显式 `height: 100%` 修复。
- 用户描述的“结果 div 和 div 仍然在上面”指 `.sql-result` 与 `.table-data-section` 固定高度导致无法填充下方空间。通过 `flex: 1` 让它们自适应伸展。
- 用户描述的“div 过长导致 main 水平滚动条”指结果表格横向溢出。通过 `min-width: 0` + `table-layout: fixed` + `overflow: auto` 让滚动限制在各自区域内。
- 不再为结果区/预览区保留固定 `max-height`，改为由 flex 分配空间；这与“全部固定大小为视口范围”的上层目标一致，即面板整体固定，但内部区域自适应。
- 不改动数据获取逻辑与路由。

## Verification Steps
1. 启动开发服务器，进入 `/admin/debug/sql`。
2. 选择任意表，确认左侧数据表区与右侧 SQL 区之间的竖直分割线从上到下完整显示。
3. 执行 `SELECT * FROM sqlite_master` 或选择表查看“数据预览”。
4. 确认：
   - SQL 结果区与表数据预览区共同填满 `.sql-main` 的剩余高度（各占约一半）。
   - 当某个区域数据很多时，仅在该区域内部出现纵向滚动条，不撑大整个面板。
   - 当表格列数很多或单元格内容很长时，仅在 `.result-table-wrap` 内部出现横向滚动条，`.main-content` 和页面主体不出现水平滚动条。
5. 切换到 `/admin/debug/api`，展开多个 endpoint 并发送请求，确认 API 列表与响应体仍按预期在面板内滚动，不撑出页面。
6. 调整浏览器窗口高度，确认面板高度仍随视口变化。
