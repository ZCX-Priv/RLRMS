# 调试工具侧边栏二次优化计划

## 摘要
修复「调试工具」父项点击后只展开、未选中的问题，使其点击后同时展开并选中父项；同时减小子项按钮尺寸，并将子项左侧选中竖线缩进到父项文字正下方。

## 当前状态分析

### 侧边栏菜单（`src/admin/views/LayoutView.vue`）
- 折叠菜单父项按钮绑定了 `@click="handleDebugGroupClick(item)"`。
- `handleDebugGroupClick` 当前逻辑：侧边栏折叠时导航到第一个子项；未折叠时仅 `toggleDebugMenu()`，不导航。
- 因此未折叠状态下点击父项，菜单会展开/收起，但父项不会进入 active/红色高亮状态（除非当前已经在 `/admin/debug/*` 子路由）。
- 子项当前尺寸：`padding: var(--spacing-sm) var(--spacing-md)`、`font-size: 0.875rem`、图标 `size="16"`。
- 子项当前 `padding-left: calc(var(--spacing-md) + 20px + var(--spacing-md))`，左侧 2px 竖线位于父项图标右侧，尚未与父项文字左边缘对齐。

### 调试页面（`src/admin/views/DebugView.vue`、`src/admin/components/DebugToolsPanel.vue`）
- `DebugView.vue` 已根据路由 `meta.title` 动态显示页面标题，并移除了图标。
- `DebugToolsPanel.vue` 根据 `route.path` 切换 SQL/API 面板，默认将 `/admin/debug` 视为 SQL。

## 变更方案

### 1. 调整 `src/admin/views/LayoutView.vue`

#### 目标
- 点击「调试工具」父项时：展开菜单 **并且** 选中父项（通过导航到第一个子项 `/admin/debug/sql`）。
- 右侧箭头仍可单独点击用于展开/收起，点击箭头不触发导航。
- 子项按钮尺寸缩小。
- 子项左侧 active 竖线缩进到父项文字正下方。

#### 具体修改

**父项点击行为：**
- 将 `handleDebugGroupClick(item)` 的职责改为：始终导航到第一个子项路径（`item.children?.[0]?.path || item.path`）。
- 在父项按钮内部的 `ChevronRight` 箭头上增加 `@click.stop="toggleDebugMenu()"`，使箭头仅负责展开/收起，不触发父项导航。
- 保留 `watch(route.path)`：当路径以 `/admin/debug` 开头时自动展开菜单，确保进入 debug 页面后子菜单可见。

**子项尺寸缩小：**
- `.nav-sub-item` 垂直 padding 从 `var(--spacing-sm)` 改为 `var(--spacing-xs)`。
- 字体从 `0.875rem` 改为 `0.8125rem`。
- 模板中子项图标 `size` 从 `16` 改为 `14`。

**子项左侧竖线缩进：**
- 调整 `.nav-sub-item` 的 `padding-left`，使左侧 2px active 竖线正好落在父项文字左边缘正下方。
- 父项文字左边缘位置 = `var(--spacing-md) + 20px + var(--spacing-md)`（父项 padding-left + 图标宽度 + gap）。
- 因此设置 `padding-left: calc(var(--spacing-md) + 20px + var(--spacing-md) + 2px)`，让竖线对齐父项文字左边缘。

### 2. 不修改的内容
- `src/router/index.ts` 路由配置保持不变。
- `DebugView.vue` 标题逻辑保持不变。
- `DebugToolsPanel.vue` 内部切换逻辑保持不变。
- 不新增组件或文件。

## 假设与决策

- 用户希望点击「调试工具」父项即视为进入该功能分组，因此导航到第一个子项 `/admin/debug/sql` 是最自然的「选中」行为。
- 保留箭头独立展开/收起能力，避免用户无法在不离开当前页的情况下收起菜单。
- 子项竖线对齐父项文字左边缘，使用精确的计算值确保视觉对齐。

## 验证步骤

1. 从非 debug 页面点击侧边栏「调试工具」：
   - 菜单展开。
   - 父项显示红色高亮。
   - 页面跳转到 `/admin/debug/sql`，顶部 `h1` 显示「SQL 查询」。
   - 「SQL 查询」子项显示透明背景 + 主色文字 + 左侧竖线。
2. 点击「API 调试」子项：
   - 父项保持红色高亮。
   - 「API 调试」子项显示左侧竖线，位置与父项文字左边缘对齐。
   - 子项按钮明显比父项小。
3. 点击父项右侧箭头：
   - 菜单收起/展开，不触发页面跳转。
4. 鼠标悬浮在子项上，确认背景不是红色。
