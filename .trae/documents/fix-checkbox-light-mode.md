# 修复：白昼模式下复选框勾看不见的问题

## 问题描述

在白昼模式（light mode）下，TablesView（桌位管理）页面中每个桌位卡片上的复选框被选中时，勾（✓）是白色的，但背景色不是红色，导致白色勾在浅色背景上看不见。

用户选中了全选复选框（`label.select-all-checkbox`）作为参考——全选复选框工作正常（有红色背景），但桌位卡片内的条目复选框没有红色背景。

## 根因分析

文件：`src/admin/views/TablesView.vue`

存在 CSS 特异性（specificity）冲突：

```css
/* 第 790 行 — 特异性 (0,2,1) scoped → 设置红色背景 */
.item-checkbox.checked {
  background-color: var(--color-primary);  /* #DC2626 红色 */
  border-color: var(--color-primary);
  color: white;
}

/* 第 796 行 — 特异性 (0,2,2) scoped → 覆盖为浅色背景！ */
.table-card .item-checkbox {
  position: absolute;
  top: var(--spacing-sm);
  left: var(--spacing-sm);
  z-index: 1;
  background-color: var(--color-bg-primary);  /* 白昼模式 = #FEF2F2 几乎白色 */
}
```

在 Vue scoped 样式中，`.table-card .item-checkbox` 的特异性高于 `.item-checkbox.checked`，且声明在后面，因此覆盖了选中状态的红色背景。

- **白昼模式**：`--color-bg-primary` = `#FEF2F2`（几乎白色）→ 白色勾在几乎白色背景上 = **看不见**
- **暗黑模式**：`--color-bg-primary` = `#1A0A0A`（深色）→ 白色勾在深色背景上 = 可见（所以问题只在白昼模式出现）

## 影响范围

- **TablesView.vue**：受影响（有 `.table-card .item-checkbox` 覆盖规则）
- **UsersView.vue / InventoryView.vue / DishesView.vue**：不受影响（无类似覆盖规则，已验证）
- **全选复选框**：不受影响（不在 `.table-card` 内，位于 `.edit-toolbar` 中）

## 修改方案

### 文件：`src/admin/views/TablesView.vue`（第 796-802 行）

将 `.table-card .item-checkbox` 规则拆分为两条：
1. 保留 `position`、`top`、`left`、`z-index`（对所有复选框生效）
2. 将 `background-color` 移到 `:not(.checked)` 选择器（仅对未选中状态生效）

**修改前：**
```css
.table-card .item-checkbox {
  position: absolute;
  top: var(--spacing-sm);
  left: var(--spacing-sm);
  z-index: 1;
  background-color: var(--color-bg-primary);
}
```

**修改后：**
```css
.table-card .item-checkbox {
  position: absolute;
  top: var(--spacing-sm);
  left: var(--spacing-sm);
  z-index: 1;
}

.table-card .item-checkbox:not(.checked) {
  background-color: var(--color-bg-primary);
}
```

这样：
- 未选中状态：保持浅色背景（确保边框可见）
- 选中状态：使用 `.item-checkbox.checked` 的红色背景，白色勾可见

## 验证步骤

1. 运行 `npm run build` 确认无错误
2. 白昼模式下打开桌位管理页面，进入编辑模式：
   - 选中桌位 → 复选框应为红色背景 + 白色勾（可见）
   - 未选中桌位 → 复选框为浅色背景 + 透明勾
3. 暗黑模式下重复验证：选中状态同样为红色背景 + 白色勾
4. 验证全选复选框仍正常工作
