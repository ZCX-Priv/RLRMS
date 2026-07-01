# 完成 UsersView 批量删除进度弹窗 + 编辑工具栏换行 CSS

## 摘要

接续上一轮会话的剩余工作：为 `UsersView.vue` 补齐批量删除进度弹窗的模板与 CSS，使其与其余三个管理页面（TablesView / DishesView / InventoryView）保持一致；随后运行 `npm run build` 验证全部改动可成功编译。

其余 4 个文件（DashboardView、TablesView、DishesView、InventoryView）的改动均已完成，无需再动。

## 当前状态分析

`src/admin/views/UsersView.vue` 已完成的部分：
- 状态变量 `showProgressModal / batchProgress / batchTotal`（第 36-38 行）
- `confirmBatchDelete` 已改为顺序 `for...of` 循环 + 进度更新 + 失败计数（第 215-243 行）
- `confirmClearAll` 保留 `Promise.all` 并行，且过滤掉 `admin`（第 245-257 行）
- 模板中 `edit-toolbar` 已移出 `page-header`，包在 `.edit-toolbar-row` 内（第 307-326 行）

`src/admin/views/UsersView.vue` 缺失的部分：
1. **模板**：在 Clear All Confirm Dialog 之后、`</div></template>` 之前，缺少批量删除进度 Modal
2. **CSS**：scoped 样式中只有 `.edit-toolbar`（第 780 行），缺少 `.edit-toolbar-row` 以及 `.progress-content / .progress-bar-container / .progress-bar-fill / .progress-text`

## 拟定改动

### 改动 1：在 UsersView 模板中添加进度 Modal

**文件**：`src/admin/views/UsersView.vue`

**位置**：在第 468 行 `<!-- Clear All Confirm Dialog -->` 块结束之后、第 469 行 `</div>` 之前插入。

**插入内容**（与 InventoryView 第 431-439 行完全一致的模式）：

```html
<!-- Batch Delete Progress Modal -->
<Modal :show="showProgressModal" title="正在删除" :closable="false" size="sm">
  <div class="progress-content">
    <div class="progress-bar-container">
      <div class="progress-bar-fill" :style="{ width: (batchTotal ? (batchProgress / batchTotal * 100) : 0) + '%' }"></div>
    </div>
    <p class="progress-text">正在删除 {{ batchProgress }}/{{ batchTotal }}...</p>
  </div>
</Modal>
```

**原因**：与其它三个管理页保持一致的进度反馈 UX；`:closable="false"` 防止用户在删除过程中关闭弹窗。

### 改动 2：在 UsersView scoped CSS 中添加 `.edit-toolbar-row` 与进度条样式

**文件**：`src/admin/views/UsersView.vue`

**位置**：在第 784 行 `.edit-toolbar { ... }` 块结束之后插入（即 `.select-all-checkbox` 之前）。

**插入内容**（与 InventoryView 第 751-782 行完全一致）：

```css
.edit-toolbar-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--spacing-xl);
}

.progress-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  align-items: center;
  padding: var(--spacing-sm) 0;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: var(--color-primary);
  transition: width var(--duration-fast) var(--ease-out);
}

.progress-text {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}
```

**原因**：
- `.edit-toolbar-row` 使用 `justify-content: flex-end` 让工具栏右对齐，与 `action-dropdown-wrapper` 在 `page-header` 中的右对齐位置一致，避免视觉跳动；同时作为独立行不再挤压搜索框。
- 进度条样式与其它三个页面完全一致，保证视觉统一。
- 所有 CSS 变量（`--spacing-xl`、`--color-bg-tertiary`、`--radius-full`、`--color-primary`、`--duration-fast`、`--ease-out`、`--color-text-secondary`）均已在 `src/style.css` 中定义且已被其它视图使用，无需新增。

## 假设与决策

1. **不改动其它文件**：DashboardView、TablesView、DishesView、InventoryView 已在上一轮会话完成，本次不再触碰。
2. **完全照搬 InventoryView 的模式**：模板与 CSS 一字不差地复用，避免引入不一致。
3. **不修改 `confirmClearAll`**：按用户上一轮明确要求，仅批量删除显示进度条，清空操作保持 `Promise.all` 并行。
4. **不修改主管理员保护逻辑**：`selectableUsers` 已过滤 `admin`，模板中 `v-if="editMode && user.username !== 'admin'"` 已确保主管理员不显示复选框，`confirmClearAll` 已过滤 `admin`，无需再动。

## 验证步骤

1. 运行 `npm run build`，确认 TypeScript + Vite 构建无错误。
2. （可选）运行 `npm run dev`，进入用户管理页面：
   - 点击「添加用户」拆分按钮的下拉箭头 → 选择「编辑」→ 进入编辑模式
   - 确认编辑工具栏出现在搜索框下方独立一行，搜索框宽度未被挤压
   - 勾选若干用户 → 点击「删除选中」→ 确认 → 观察进度弹窗逐条递增
   - 主管理员行不显示复选框，无法被选中
