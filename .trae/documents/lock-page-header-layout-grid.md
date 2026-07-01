# 锁定 page-header 布局：搜索框固定居中，编辑工具栏不换行

## 摘要

撤销上一轮"将编辑工具栏移到新行"的方案。改用 CSS Grid 三列布局锁定 `page-header`：左列（标题）、中列（搜索框，固定 280px 居中）、右列（按钮组）。无论右列是"添加"拆分按钮还是"编辑工具栏"，搜索框始终固定在页面水平中央，不被挤压，按钮组也不换行。

涉及 4 个管理页面：TablesView、DishesView、InventoryView、UsersView。改动模式完全一致。

## 当前状态分析

4 个文件的 `page-header` 结构与 CSS 完全一致（仅标题文字、占位符不同）：

**模板**（以 TablesView 为例，第 276-326 行）：
```html
<div class="page-header">
  <h1 class="page-title">桌位管理</h1>
  <div class="search-input-wrapper">...</div>
  <div v-if="!editMode" ref="actionDropdownRef" class="action-dropdown-wrapper">...</div>
</div>
<div v-if="editMode" class="edit-toolbar-row">     <!-- ← 上一轮新增的独立行 -->
  <div class="edit-toolbar">...</div>
</div>
```

**CSS**（4 个文件一致）：
```css
.page-header {
  display: flex;                    /* ← 问题根源：flex 布局下搜索框可被挤压 */
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
  gap: var(--spacing-md);
}
.search-input-wrapper {
  flex: 1;                           /* ← flex:1 允许搜索框收缩，导致被挤压 */
  max-width: 280px;
}
.edit-toolbar-row {                  /* ← 上一轮新增，需删除 */
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--spacing-xl);
}
```

**问题**：上一轮方案将编辑工具栏移到独立行，用户不满意——希望编辑工具栏留在同一行，仅锁定搜索框位置。

## 拟定改动

对 4 个文件执行完全相同的 3 处改动：

### 改动 1：模板 — 将 edit-toolbar 移回 page-header，删除 edit-toolbar-row 包裹层

**文件**：`TablesView.vue` / `DishesView.vue` / `InventoryView.vue` / `UsersView.vue`

**操作**：
1. 将 `<div v-if="editMode" class="edit-toolbar-row">` 包裹层删除
2. 将内部的 `<div class="edit-toolbar">...</div>` 移入 `<div class="page-header">` 内部，放在 `action-dropdown-wrapper` 之后
3. 将 `v-if="editMode"` 改为 `v-else`（因为 `action-dropdown-wrapper` 用了 `v-if="!editMode"`，两者互斥，共用右列）

**改动前**：
```html
      <div v-if="!editMode" ref="actionDropdownRef" class="action-dropdown-wrapper">
        ...添加按钮组...
      </div>
    </div>
    <div v-if="editMode" class="edit-toolbar-row">
      <div class="edit-toolbar">
        ...全选 / 已选 / 删除选中 / 取消...
      </div>
    </div>
```

**改动后**：
```html
      <div v-if="!editMode" ref="actionDropdownRef" class="action-dropdown-wrapper">
        ...添加按钮组...
      </div>
      <div v-else class="edit-toolbar">
        ...全选 / 已选 / 删除选中 / 取消...
      </div>
    </div>
```

**原因**：edit-toolbar 与 action-dropdown-wrapper 共用 grid 第三列（右列），互斥显示。搜索框始终在第二列（中列），不受右列内容变化影响。

### 改动 2：CSS — page-header 改为 Grid 三列布局，搜索框固定居中

**文件**：同上 4 个文件

**操作**：
1. 将 `.page-header` 从 `display: flex` 改为 `display: grid`，使用 `grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)`
2. 将 `.search-input-wrapper` 的 `flex: 1; max-width: 280px` 改为 `width: 280px; justify-self: center`
3. 为 `.page-title` 添加 `justify-self: start`
4. 为 `.action-dropdown-wrapper` 和 `.edit-toolbar` 添加 `justify-self: end; min-width: 0`
5. 为 `.edit-toolbar` 添加 `flex-wrap: wrap; justify-content: flex-end`（防止中等屏幕宽度下溢出）
6. 删除 `.edit-toolbar-row` CSS 规则（模板中已不再使用）

**改动前**：
```css
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
  gap: var(--spacing-md);
}
.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 280px;
}
.edit-toolbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}
.edit-toolbar-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--spacing-xl);
}
```

**改动后**：
```css
.page-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  margin-bottom: var(--spacing-xl);
  gap: var(--spacing-md);
}
.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 280px;
  justify-self: center;
}
.page-title {
  justify-self: start;
  /* 保留原有 font-size / font-weight */
}
.action-dropdown-wrapper {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  justify-self: end;
  min-width: 0;
}
.edit-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md);
  justify-content: flex-end;
  justify-self: end;
  min-width: 0;
}
/* .edit-toolbar-row 已删除 */
```

**关键设计决策**：
- `minmax(0, 1fr) auto minmax(0, 1fr)`：左右两列均分剩余空间，中列按内容宽度（280px）。`minmax(0, 1fr)` 而非 `1fr` 是为了允许左右列在内容超出时收缩到 0，防止 grid 溢出导致水平滚动。
- 搜索框 `width: 280px; justify-self: center`：固定宽度 + 在中列内居中。由于中列是 `auto`（= 280px），搜索框填满中列，位置始终在页面水平中央。
- `.page-title { justify-self: start }`：标题左对齐。
- `.action-dropdown-wrapper / .edit-toolbar { justify-self: end }`：按钮组右对齐。
- `.edit-toolbar { flex-wrap: wrap; justify-content: flex-end }`：在中等屏幕宽度下，如果右列空间不足，编辑工具栏内部项目可换行，但仍靠右对齐，不影响搜索框。

### 改动 3：CSS — 更新移动端媒体查询

**文件**：同上 4 个文件

4 个文件的 `@media (max-width: 640px)` 当前一致：
```css
@media (max-width: 640px) {
  .page-header {
    flex-wrap: wrap;
  }
  .search-input-wrapper {
    order: 3;
    flex-basis: 100%;
    max-width: 100%;
  }
}
```

**改动后**（适配 grid）：
```css
@media (max-width: 640px) {
  .page-header {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
  }
  .page-title {
    grid-column: 1;
    grid-row: 1;
  }
  .action-dropdown-wrapper,
  .edit-toolbar {
    grid-column: 2;
    grid-row: 1;
  }
  .search-input-wrapper {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
    justify-self: stretch;
  }
}
```

**布局效果**：移动端第一行为标题（左）+ 按钮组（右），第二行为搜索框（整行），与原有 flex 布局在移动端的表现一致。

注：DishesView 和 UsersView 的媒体查询中还包含其他规则（如 `.form-grid`、`.user-meta`），这些不受影响，保留原样。

## 假设与决策

1. **4 个文件改动完全一致**：模板结构、CSS、媒体查询均相同，仅标题文字不同。
2. **不触碰 DashboardView**：首页的 `page-header` 结构不同（没有搜索框 + 编辑模式），不在本次改动范围。
3. **不修改任何 JS 逻辑**：`editMode`、`selectedIds`、`confirmBatchDelete` 等逻辑保持不变，仅改模板结构与 CSS。
4. **保留 `ref="actionDropdownRef"`**：`handleClickOutside` 依赖此 ref，action-dropdown-wrapper 的属性不变。
5. **`v-else` 替代 `v-if="editMode"`**：因为 action-dropdown-wrapper 用了 `v-if="!editMode"`，紧随其后的 edit-toolbar 用 `v-else` 即可表达互斥关系，且保证两者占据同一个 grid 单元格（第三列）。
6. **`minmax(0, 1fr)` 而非 `1fr`**：防止右列内容（编辑工具栏）在中等屏幕宽度下撑破 grid 导致水平滚动条。

## 验证步骤

1. 运行 `npm run build`，确认 TypeScript + Vite 构建无错误。
2. 运行 `npm run dev`，逐一进入 4 个管理页面：
   - 确认默认状态下：标题在左、搜索框居中、添加按钮组在右
   - 点击添加按钮下拉箭头 → 编辑 → 进入编辑模式
   - **核心验证**：编辑工具栏出现在右侧（同一行），搜索框位置与宽度不变（仍居中、仍 280px）
   - 点击取消退出编辑模式，添加按钮组回归，搜索框位置仍不变
   - 缩小浏览器窗口至 640px 以下，确认搜索框换行到第二行整宽
