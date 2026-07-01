# 修复 Bug：tag-pills 夜间模式适配 + 4 个客户端页面区域滚动

## 概述

修复两个 Bug：
1. 管理端设置页"特色标签"区域的 `tag-pills` 在夜间模式下背景过亮（扎眼），且与上方输入框 `tag-add-row` 之间缺乏间距。
2. 客户端 4 个页面（订单列表、订单详情、搜索、我的）使用整页滚动，应改为区域滚动（与首页 HomeView 一致）。

---

## Bug 1：tag-pills 夜间模式 + 间距

### 问题分析

**文件**：`src\admin\views\SettingsView.vue`（第 866-920 行样式）

1. **夜间模式扎眼**：`.tag-pill` 使用 `background-color: var(--color-primary-bg, #fef2f2)`。但 `--color-primary-bg` 这个变量在 `src\style.css` 中**从未定义**（定义的是 `--color-bg-primary`，名字不同）。因此背景色始终回退到 `#fef2f2`（浅粉色），在夜间模式下非常扎眼。
2. **缺乏间距**：`.tag-pills` 没有设置 `margin-top`，与上方的 `.tag-add-row`（输入框行）紧贴。

### 修复方案

参照客户端 `SettingsView.vue` 中 `.about-tag` 的夜间模式适配模式（使用 `rgba` + `:global([data-theme="dark"])` 覆盖）。

**修改文件**：`src\admin\views\SettingsView.vue`

**改动 1** — `.tag-pills` 增加上间距（第 867-871 行）：
```css
/* Before */
.tag-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

/* After */
.tag-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
}
```

**改动 2** — `.tag-pill` 背景色改用 `rgba` 适配双主题，并增加夜间模式覆盖（第 873-882 行）：
```css
/* Before */
.tag-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 9999px;
  background-color: var(--color-primary-bg, #fef2f2);
  color: var(--color-primary);
  font-size: 0.8rem;
}

/* After */
.tag-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 9999px;
  background-color: rgba(220, 38, 38, 0.08);
  color: var(--color-primary);
  font-size: 0.8rem;
}

:global([data-theme="dark"]) .tag-pill {
  background-color: rgba(220, 38, 38, 0.15);
}
```

---

## Bug 2：4 个客户端页面改为区域滚动

### 问题分析

**涉及文件**：
- `src\client\views\OrdersView.vue` — 订单列表
- `src\client\views\OrderDetailView.vue` — 订单详情
- `src\client\views\SearchView.vue` — 搜索
- `src\client\views\SettingsView.vue` — 我的/设置

**现状**：4 个页面均使用 `min-height: 100vh` + `position: sticky` header + 整页（document）滚动。底部 nav（`position: fixed; bottom: 0`，高约 60px）浮在页面上方，各页面用 `padding-bottom` 避让。

**参照**：首页 `HomeView.vue` 已采用区域滚动模式：
```css
.home-page { min-height: 100%; }
.main-layout { display: flex; height: calc(100vh - 130px); }
.home-content { flex: 1; overflow-y: auto; height: 100%; }
```

**布局约束**：`ClientLayout.vue` 的 `.client-main` 有 `padding-bottom: 60px`（为固定 nav 留空间）。因此页面高度应为 `calc(100vh - 60px)`，这样 `.client-main` 总高度 = 页面 + padding = `calc(100vh - 60px) + 60px` = `100vh`，body 不会滚动。

### 修复方案（统一模式）

每个页面采用相同结构：
```
.xxx-page (height: calc(100vh - 60px), flex column, overflow: hidden)
  ├── header (flex-shrink: 0, 保留 sticky 无害)
  └── content (flex: 1, overflow-y: auto)
```

---

### 改动 2a：OrdersView.vue

**文件**：`src\client\views\OrdersView.vue`

**CSS 修改**（第 192-220 行）：
```css
/* Before */
.orders-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-primary);
}
.page-header {
  /* ... */
  position: sticky;
  /* ... */
}
.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-md);
}

/* After */
.orders-page {
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--color-bg-primary);
}
.page-header {
  /* ... */
  position: sticky;
  flex-shrink: 0;
  /* ... */
}
.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-md);
  overflow-y: auto;
}
```

---

### 改动 2b：OrderDetailView.vue

**文件**：`src\client\views\OrderDetailView.vue`

**问题**：内容区（status-section、info-card、items-card 等）是 `.order-detail-page` 的直接子元素（通过 `<template>` 包裹，不生成 DOM 节点），没有统一的内容容器。需要**在模板中增加一个包裹 div**。

**模板修改**（第 317-436 行）：在 header 之后、Modal 之前，用 `<div class="detail-content">` 包裹所有内容区：

```html
<!-- 在 <header class="detail-header">...</header> 之后 -->
<div class="detail-content">
  <div v-if="loading" class="loading-container">...</div>
  <template v-else-if="orderNotFound">...</template>
  <template v-else-if="order">
    <div class="status-section">...</div>
    <div class="info-card table-info-card">...</div>
    <div class="items-card">...</div>
    <div class="info-card">...</div>
    <div class="actions-section">...</div>
  </template>
</div>
<!-- Modal 保持在包裹 div 外面 -->
```

**CSS 修改**（第 466-472 行）：
```css
/* Before */
.order-detail-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-primary);
  padding-bottom: 80px;
}

/* After */
.order-detail-page {
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--color-bg-primary);
}

.detail-header {
  /* 增加 flex-shrink: 0 */
  flex-shrink: 0;
  /* 其余保留 */
}

/* 新增 */
.detail-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: var(--spacing-lg);
}
```

---

### 改动 2c：SearchView.vue

**文件**：`src\client\views\SearchView.vue`

**注意**：此页有固定定位的购物车栏 `.cart-container { position: fixed; bottom: 84px; }`，内容区需要 `padding-bottom` 避让。

**CSS 修改**（第 263-350 行）：
```css
/* Before */
.search-page {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  padding-bottom: 80px;
}
.search-header {
  /* ... */
  position: sticky;
  /* ... */
}
.search-content {
  padding: var(--spacing-md);
}

/* After */
.search-page {
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--color-bg-primary);
}
.search-header {
  /* ... */
  position: sticky;
  flex-shrink: 0;
  /* ... */
}
.search-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  padding-bottom: 100px; /* 避让固定购物车栏 */
}
```

---

### 改动 2d：SettingsView.vue（客户端）

**文件**：`src\client\views\SettingsView.vue`

**CSS 修改**（第 308-334 行）：
```css
/* Before */
.settings-page {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
}
.page-header {
  /* ... */
  position: sticky;
  /* ... */
}
.page-content {
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* After */
.settings-page {
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--color-bg-primary);
}
.page-header {
  /* ... */
  position: sticky;
  flex-shrink: 0;
  /* ... */
}
.page-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
```

---

## 假设与决策

1. **nav 高度 60px**：`ClientLayout.vue` 中 `.client-main` 的 `padding-bottom: 60px` 是既定的 nav 避让值，页面高度用 `calc(100vh - 60px)` 与之匹配。
2. **保留 `position: sticky`**：header 在区域滚动中不再需要 sticky（作为 flex 子项天然固定），但保留它无害且更安全，仅追加 `flex-shrink: 0`。
3. **OrderDetailView 需模板改动**：内容区无统一包裹元素，必须新增 `<div class="detail-content">` 才能作为滚动容器。Modal 保持在包裹外（Modal 自行处理定位）。
4. **SearchView 购物车栏**：`padding-bottom: 100px` 确保内容不被固定购物车栏遮挡（原页面用 `padding-bottom: 80px`，这里略增以适配区域滚动）。
5. **不改 ClientLayout**：避免影响 HomeView 和其他页面，仅在各页面内独立调整。
6. **tag-pill 夜间模式**：采用 `rgba(220, 38, 38, 0.08/0.15)` 而非 CSS 变量，与客户端 `.about-tag` 的适配模式一致。

## 验证步骤

1. **tag-pills 修复验证**：
   - 打开管理端设置页（`/admin/settings`），浅色模式下 tag-pill 背景为淡红色、与输入框有间距
   - 切换到深色模式，tag-pill 背景为半透明红色、不扎眼
   - 确认 tag-pill 与上方输入框之间有 `var(--spacing-sm)` 间距

2. **区域滚动验证**（4 个页面）：
   - 订单列表 `/orders`：滚动时仅内容区滚动，header 和底部 nav 固定不动；body 不滚动
   - 订单详情 `/order/:id`：内容区可滚动，返回按钮 header 固定；QR Modal 正常弹出
   - 搜索 `/search`：搜索结果区滚动，搜索框固定；购物车栏正常浮动在底部
   - 我的 `/settings`：设置卡片区域滚动，header 固定
   - 切换深色模式，确认滚动行为正常
   - 确认底部 nav 不会被内容遮挡，内容最后一项可完整滚动到可见区

3. **回归验证**：
   - 首页 `/`（HomeView）滚动行为不受影响
   - 路由切换时页面正常过渡，无白屏/闪烁
   - 移动端 viewport 下表现正常
