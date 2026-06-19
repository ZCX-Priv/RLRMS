# 调试工具侧边栏与标题优化计划

## 摘要
优化管理后台侧边栏「调试工具」折叠菜单的选中/悬浮样式，使其在展开时父项保持红色高亮、子项不再使用红色高亮，避免视觉粘连。同时让 `DebugView.vue` 页面顶部的 `h1` 标题根据当前子路由动态显示，并移除图标。

## 当前状态分析

### 侧边栏菜单（`src/admin/views/LayoutView.vue`）
- 调试工具作为可折叠的 `nav-group` 存在，子项为「SQL 查询」(`/admin/debug/sql`) 和「API 调试」(`/admin/debug/api`)。
- 父项与子项共用 `.nav-item-active` 类，active 时均为红色背景（`background-color: var(--color-primary)`）。
- 当父项展开且某个子项被选中时，父项（红色）与子项（红色）直接上下相连，视觉上连成一片，显得拥挤。
- `.nav-sub-item:hover` 当前仅改变文字颜色，没有独立背景样式。

### 调试页面标题（`src/admin/views/DebugView.vue`）
- 当前标题固定为：`<Wrench :size="22" /> 调试工具`。
- 路由 `src/router/index.ts` 中已为 `/admin/debug`、`/admin/debug/sql`、`/admin/debug/api` 分别配置 `meta.title`（调试工具 / SQL 查询 / API 调试）。
- `DebugToolsPanel.vue` 内部已通过 `useRoute()` 根据 `route.path` 切换 SQL/API 面板。

## 变更方案

### 1. 调整 `src/admin/views/LayoutView.vue`

#### 目标
- 父项「调试工具」active 时保持红色高亮不变。
- 子项 active 时不再使用红色背景，改用「透明背景 + 主色文字 + 左侧主色竖线」的次级高亮样式。
- 子项 hover 时仅使用半透明背景（`var(--color-bg-tertiary)`）或透明，绝不出现红色。

#### 具体修改
- 在 `<style scoped>` 中为 `.nav-sub-item` 增加独立的 active 样式，避免继承 `.nav-item-active` 的红色背景。
- 使用更具体的选择器覆盖 `.nav-sub-item.nav-item-active`：
  - 背景：透明（或 `var(--color-bg-tertiary)` 极浅背景）。
  - 文字颜色：`var(--color-primary)`。
  - 左侧加 2px 主色竖线作为选中指示（使用 `border-left` 或 `box-shadow`）。
- 调整 `.nav-sub-item` 的 `padding-left`，为左侧竖线留出视觉空间。
- 保持 `.nav-sub-item:hover` 为透明/浅色背景，不使用红色。

### 2. 调整 `src/admin/views/DebugView.vue`

#### 目标
- `h1` 标题根据当前路由的 `meta.title` 动态显示。
- 移除标题中的 `Wrench` 图标。
- 在 SQL/API 子路由下分别显示「SQL 查询」、「API 调试」，在 `/admin/debug` 根路径显示「调试工具」。

#### 具体修改
- `<script setup>` 中引入 `useRoute`。
- 新增计算属性 `pageTitle`，返回 `(route.meta.title as string) || '调试工具'`。
- 模板中 `<h1 class="page-title">{{ pageTitle }}</h1>`，移除 `<Wrench>` 图标引入和标签。
- 移除 `import { Wrench }`。
- `.page-title` 样式可保留，由于不再包含图标，原有 `display: flex; gap` 不影响纯文字显示。

### 3. 不修改的内容
- `src/router/index.ts` 中的调试路由配置已足够，无需新增或调整。
- `DebugToolsPanel.vue` 内部 SQL/API 切换逻辑已基于路由工作，无需改动。
- 不添加新的组件或文件。

## 假设与决策

- 用户希望子项 active 样式与父项红色高亮区分开，而不是完全移除父项高亮。
- 子项 active 样式采用「透明/浅色背景 + 主色文字 + 左侧竖线」，这是常见的次级导航设计，与现有设计系统兼容。
- 标题文字直接复用路由 `meta.title`，避免在组件中硬编码映射关系。

## 验证步骤

1. 启动开发服务器，进入 `/admin/debug/sql`：
   - 侧边栏「调试工具」父项为红色高亮。
   - 「SQL 查询」子项为透明背景 + 主色文字 + 左侧竖线，不与父项红色相连。
   - 页面顶部 `h1` 显示「SQL 查询」，无图标。
2. 切换到 `/admin/debug/api`：
   - 「API 调试」子项变为上述次级高亮样式。
   - 页面顶部 `h1` 显示「API 调试」，无图标。
3. 切换到 `/admin/debug`：
   - 页面顶部 `h1` 显示「调试工具」。
   - 侧边栏父项保持红色高亮，无子项被选中。
4. 鼠标悬浮在子项上，确认背景不是红色。
