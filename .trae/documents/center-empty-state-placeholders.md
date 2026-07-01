# 将四个管理页面的空状态占位移动到正中间

## Summary

用户选中了桌位管理、菜单管理（DishesView）、库存管理三个页面的空状态占位 `div.empty-state`，并要求把用户管理页面的空状态占位也一并移动到页面正中间（水平 + 垂直居中）。

当前 `.empty-state` 虽然设置了 `display: flex; align-items: center; justify-content: center;`，但该 div 本身只有内容 + padding 的高度，紧贴在 `.page-header` 下方，并未在可视区域内垂直居中。需要让它填满 header 之下的剩余空间，从而把内容推到正中间。

## Current State Analysis

布局结构（四个页面一致）：

```
.admin-layout (flex, min-height:100vh)
└── .main-content (flex:1; padding: var(--spacing-lg)=24px; 移动端 margin-top:60px)
    └── .*-page (max-width:1200px)   ← 页面根容器，当前仅 block
        ├── .page-header (grid, margin-bottom: var(--spacing-xl)=32px)
        ├── .loading-state (v-if)
        ├── .empty-state (v-else-if)   ← 目标：填满剩余空间并垂直居中
        └── .*-grid / .*-list (v-else)
```

`.empty-state` 当前 CSS（四个文件完全一致）：

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;   /* 已有垂直居中，但缺高度 */
  padding: var(--spacing-3xl) var(--spacing-xl);
  text-align: center;
}
```

页面根容器当前 CSS（四个文件一致，仅类名不同）：

```css
.tables-page { /* .dishes-page / .inventory-page / .users-page */
  max-width: 1200px;
}
```

`.main-content`（LayoutView.vue）：`padding: var(--spacing-lg)`（24px），移动端 `margin-top: 60px`，桌面端 `margin-top: 0`。

## Proposed Changes

对四个文件各做两处 CSS 修改：让页面根容器成为纵向 flex 并占满可视高度，再让 `.empty-state` 用 `flex:1` 填满 header 之后的剩余空间。现有 `justify-content:center` 即可把内容垂直居中到剩余区域正中（即页面正中间）。

### 1. `src/admin/views/TablesView.vue`

**a) `.tables-page`（第 451-453 行）** 改为：

```css
.tables-page {
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 108px); /* 移动端：60px 顶栏 + 48px 上下 padding */
}

@media (min-width: 768px) {
  .tables-page {
    min-height: calc(100vh - 48px); /* 桌面端：仅上下 padding */
  }
}
```

**b) `.empty-state`（第 515-522 行）** 增加 `flex: 1;`：

```css
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3xl) var(--spacing-xl);
  text-align: center;
}
```

### 2. `src/admin/views/DishesView.vue`

**a) `.dishes-page`（第 786-788 行）** 同 TablesView 方案（类名替换为 `dishes-page`）。

**b) `.empty-state`（第 960-967 行）** 增加 `flex: 1;`。

### 3. `src/admin/views/InventoryView.vue`

**a) `.inventory-page`（第 442-444 行）** 同 TablesView 方案（类名替换为 `inventory-page`）。

**b) `.empty-state`（第 506-513 行）** 增加 `flex: 1;`。

### 4. `src/admin/views/UsersView.vue`

**a) `.users-page`（第 481-483 行）** 同 TablesView 方案（类名替换为 `users-page`）。

**b) `.empty-state`（第 546-553 行）** 增加 `flex: 1;`。

## Assumptions & Decisions

- **不抽取共享组件**：四个文件的 `.empty-state` CSS 完全重复，但用户仅要求居中，未要求重构。遵循“不过度设计”原则，只在各文件内做最小修改，不新增 `EmptyState.vue` 组件。
- **不改动模板结构**：仅修改 `<style scoped>` 中的 CSS，不触碰 `<template>` 与 `<script>`。
- **不影响列表态布局**：页面根容器改为 `display:flex; flex-direction:column` 后，`.page-header`（grid）与列表/网格容器（grid/block）作为 flex 子项仍保持全宽、自然高度，行为与原先 block 一致；`min-height` 仅保证容器至少占满可视区，内容超出时自然撑高，不会产生多余滚动条。
- **不改动 loading-state**：用户只要求空状态居中；loading 态保持原样。
- **偏移值依据**：移动端 `100vh - 108px` = 60px 顶栏 + 24px×2 padding；桌面端 `100vh - 48px` = 24px×2 padding。两值均使根容器恰好填满 `.main-content` 内容盒，不引入额外滚动条。
- **`flex:1` 的作用**：让 `.empty-state` 占据 `.page-header` 之后的全部剩余高度，配合已有 `justify-content:center` 把图标/标题/描述垂直居中到剩余区域正中，即页面正中间。

## Verification

1. `npm run build` 确认无编译错误。
2. `npm run dev` 后逐页验证：
   - 桌位管理（无桌位时）：空状态图标/标题/描述位于内容区正中间。
   - 菜单管理（无菜品时）：同上。
   - 库存管理（无库存时）：同上。
   - 用户管理（无用户时）：同上。
3. 切换到移动端窄屏（<768px）复查：空状态仍居中，且页面无多余纵向滚动条。
4. 在有数据的页面确认列表/网格布局未受影响、无回归。
