# 修复调试面板 SQL/API 结果溢出页面问题

## Summary

修复 `DebugToolsPanel.vue` 中 SQL 查询结果和 API 调试响应内容过多时撑大容器、超出视口的问题。通过把面板整体高度限制在视口范围内，并为 SQL 结果区、表数据预览区、API 响应区分别设置最大高度与滚动条，保证内容在面板内部滚动，不撑出页面。

## Current State Analysis

* **关键文件**：`src/admin/components/DebugToolsPanel.vue`

* **父级布局**：`src/admin/views/DebugView.vue` 未限制高度；`src/admin/views/LayoutView.vue` 的 `.main-content` 有 `padding: var(--spacing-lg)`（1.5rem），页面标题有约 1.5rem 字号 + `margin-bottom: var(--spacing-xl)`（2rem）。

* **问题点**：

  * `.tab-content` 当前仅使用固定 `max-height: 600px`，未基于视口，且当内容超过 600px 时会在面板内部滚动，但 600px 在较小屏幕上仍可能超出视口，在较大屏幕上又浪费空间。

  * `.sql-layout` / `.sql-main` 使用 flex 布局，但缺少 `min-height: 0` 与溢出控制，导致 `.sql-result` 和 `.table-data-section` 随内容增长。

  * `.result-table-wrap` 只有 `overflow-x: auto`，没有 `overflow-y` 与 `max-height`，SQL 结果行数多时会纵向撑大。

  * API 标签页的 `.api-groups` 没有整体高度限制与滚动条；`.api-response` 的 `.response-body` 虽有 `max-height: 300px; overflow-y: auto`，但展开多个 endpoint 时整体仍会撑出视口。

## Proposed Changes

### 文件：`src/admin/components/DebugToolsPanel.vue`

#### 1. 面板整体固定为视口范围

修改 `.debug-panel`：

* 设置为 `display: flex; flex-direction: column;`

* 高度与最大高度设为 `calc(100vh - 7rem)`（约扣除 `.main-content` 上下 padding 3rem + 页面标题及间距 4rem），并提供 `calc(100dvh - 7rem)` 作为动态视口回退。

* 移动端额外扣除顶部 `mobile-header` 的 60px，使用媒体查询调整为 `calc(100vh - 8.5rem)`。

#### 2. 标签内容区自适应并滚动

修改 `.tab-content`：

* 移除固定 `max-height: 600px`

* 设置 `flex: 1; min-height: 0; overflow-y: auto;`

* 使 SQL/API 两个 tab 内容都能在剩余空间内滚动。

#### 3. SQL 结果区限制高度并滚动

* `.sql-layout`：设置 `flex: 1; min-height: 0;`（不随内容撑开）。

* `.sql-main`：设置 `flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;`。

* `.sql-result`：添加 `max-height: 280px; overflow-y: auto;`（或基于视口比例的值），避免结果区无限撑高。

* `.result-table-wrap`：保留 `overflow-x: auto`，并增加 `max-height: 240px; overflow-y: auto;`，使结果表格本身可横向与纵向滚动。

* `.table-data-section`：添加 `max-height: 280px; overflow-y: auto;`，内部 `.result-table-wrap` 同样限制高度。

#### 4. API 标签页限制高度并滚动

* `.api-groups`：设置 `max-height: calc(100% - 1rem); overflow-y: auto;`，使 API 端点列表在面板内滚动。

* `.param-panel`：保持现有逻辑；确保 `.response-body` 继续限制在 `max-height: 300px; overflow-y: auto;`。

* 为 `.api-group` 设置 `min-height: 0`，防止 flex 子项在滚动容器中溢出。

#### 5. 宽度溢出处理

* `.result-table-wrap` 已具备 `overflow-x: auto;`，保留即可。

* `.result-table` 的 `td`/`th` 保持 `white-space: nowrap; max-width: 200px;` 策略，防止单元格换行撑宽。

## Assumptions & Decisions

* 采用 `100vh` 作为基准，并提供 `100dvh` 作为更现代的替代值；在桌面端两者效果一致。

* 扣除 7rem 为经验值，用于覆盖 `.main-content` 的上下 padding（3rem）与 `DebugView.vue` 页面标题及间距（约 4rem）。实现后若 visually 有偏差，可微调该值。

* 不改动路由、不改动父组件布局，仅在 `DebugToolsPanel.vue` 内部通过 CSS 限制尺寸，最小化影响范围。

* 不修改数据获取逻辑，仍保留当前 `LIMIT 50` 的表数据分页。

* SQL 结果区与表数据预览区各自设置 `max-height: 280px` 是基于"每个区域都应独立可滚动"的 UX 决策。

## Verification Steps

1. 启动开发服务器，进入 `/admin/debug/sql`。
2. 执行 `SELECT * FROM sqlite_master` 或返回大量行的查询。
3. 确认：

   * 整个调试面板没有超出视口底部；

   * SQL 结果表格在固定高度区域内垂直滚动；

   * 表格横向列多时可左右滚动；

   * 页面主体不出现滚动条（或仅面板内部滚动）。
4. 切换到 `/admin/debug/api`，展开多个 endpoint 并发送请求返回较大 JSON。
5. 确认：

   * API 响应体在固定高度内滚动；

   * 展开多个 endpoint 时整体 API 列表在面板内滚动，不撑出页面。
6. 调整浏览器窗口高度，确认面板高度随视口变化而变化。

