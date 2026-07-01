# 批量删除进度条 + 按钮尺寸调整 + 编辑栏布局修复

## Summary

针对上一轮实现的"分裂下拉按钮 + 编辑模式"功能，用户提出 4 项改进：
1. **批量删除改为逐条删除并显示进度条**（避免并发上限）
2. **首页（DashboardView）清空按钮调大**（当前 btn-sm 偏小）
3. **四个管理页的按钮保持原"添加"按钮尺寸**（不照搬首页新尺寸）
4. **编辑工具栏不应挤压搜索框**（锁定布局）

## Current State Analysis

### 按钮尺寸体系（src/style.css）
- `.btn`（常规）: `padding: 0.5rem 1.5rem`, `font-size: 1rem`
- `.btn-sm`（小号）: `padding: 0.25rem 1rem`, `font-size: 0.875rem`
- `.btn-lg`（大号）: `padding: 1rem 2rem`, `font-size: 1.125rem`

### 当前各页按钮尺寸
| 页面 | 按钮 | 当前类名 | 尺寸 |
|------|------|----------|------|
| DashboardView | 清空订单主按钮 + 切换按钮 | `btn btn-danger btn-sm` + `clear-toggle-btn`(min-width:28px) | 小号 |
| TablesView/DishesView/InventoryView/UsersView | 添加XXX主按钮 + 切换按钮 | `btn btn-primary` + `action-toggle-btn`(min-width:32px) | 常规 |

### 当前批量删除实现（4 个管理页相同模式）
```js
async function confirmBatchDelete() {
  const ids = [...selectedIds.value]
  await Promise.all(ids.map(id => api.deleteXxx(id)))  // 并行，可能触发并发上限
  // ...
}
```

### 当前编辑工具栏布局（4 个管理页相同）
```html
<div class="page-header">  <!-- flex, justify-content: space-between -->
  <h1>标题</h1>
  <div class="search-input-wrapper">...</div>  <!-- flex: 1; max-width: 280px -->
  <div v-if="editMode" class="edit-toolbar">...</div>  <!-- 宽度大于原按钮，挤压搜索框 -->
  <div v-else class="action-dropdown-wrapper">...</div>
</div>
```

## Proposed Changes

### Part A: 批量删除改为逐条删除 + 进度弹窗（4 个管理页）

**涉及文件**：
- `src/admin/views/TablesView.vue`
- `src/admin/views/DishesView.vue`
- `src/admin/views/InventoryView.vue`
- `src/admin/views/UsersView.vue`

**改动内容**（每个文件相同模式）：

1. **新增状态**：
   ```js
   const showProgressModal = ref(false)
   const batchProgress = ref(0)
   const batchTotal = ref(0)
   ```

2. **重写 `confirmBatchDelete` 函数**（逐条删除 + 进度更新）：
   ```js
   async function confirmBatchDelete() {
     const ids = [...selectedIds.value]
     if (ids.length === 0) return
     // 关闭确认框，打开进度弹窗
     showBatchDeleteConfirm.value = false
     batchTotal.value = ids.length
     batchProgress.value = 0
     showProgressModal.value = true
     let failed = 0
     try {
       for (const id of ids) {
         try {
           await api.deleteXxx(id)  // 各页用对应 API
         } catch (e) {
           console.error('Failed to delete item:', id, e)
           failed++
         }
         batchProgress.value++
       }
       if (failed === 0) {
         appStore.showToast(`已删除 ${ids.length} 项`, 'success')
       } else {
         appStore.showToast(`已删除 ${ids.length - failed} 项，失败 ${failed} 项`, 'error')
       }
     } finally {
       showProgressModal.value = false
       exitEditMode()
       fetchXxx(false)  // 各页用对应 fetch 函数
     }
   }
   ```

3. **新增进度 Modal**（复用已导入的 Modal 组件）：
   ```html
   <Modal :show="showProgressModal" title="正在删除" :closable="false" size="sm">
     <div class="progress-content">
       <div class="progress-bar-container">
         <div class="progress-bar-fill" :style="{ width: (batchTotal ? (batchProgress / batchTotal * 100) : 0) + '%' }"></div>
       </div>
       <p class="progress-text">正在删除 {{ batchProgress }}/{{ batchTotal }}...</p>
     </div>
   </Modal>
   ```

4. **新增进度条样式**（每个管理页 scoped style）：
   ```css
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

**注意**：清空操作（`confirmClearAll`）保持原样（Promise.all 并行），不显示进度条。

### Part B: 首页清空按钮调大（DashboardView.vue）

**涉及文件**：`src/admin/views/DashboardView.vue`

**改动内容**：

1. **模板：移除 `btn-sm` 类，调大图标**（第 574-581 行附近）：
   ```html
   <!-- 改前 -->
   <button class="btn btn-danger btn-sm clear-main-btn" @click="handleClearAllOrders(null)">
     <Trash2 :size="14" />
     清空订单
   </button>
   <span class="clear-divider"></span>
   <button class="btn btn-danger btn-sm clear-toggle-btn" @click="showClearDropdown = !showClearDropdown">
     <ChevronDown :size="12" />
   </button>
   <!-- 改后 -->
   <button class="btn btn-danger clear-main-btn" @click="handleClearAllOrders(null)">
     <Trash2 :size="16" />
     清空订单
   </button>
   <span class="clear-divider"></span>
   <button class="btn btn-danger clear-toggle-btn" @click="showClearDropdown = !showClearDropdown">
     <ChevronDown :size="14" />
   </button>
   ```

2. **样式：调整 `.clear-toggle-btn` 尺寸**（第 1596-1602 行附近）：
   ```css
   /* 改前 */
   .clear-toggle-btn {
     border-top-left-radius: 0 !important;
     border-bottom-left-radius: 0 !important;
     padding-left: var(--spacing-xs) !important;
     padding-right: var(--spacing-xs) !important;
     min-width: 28px;
   }
   /* 改后 */
   .clear-toggle-btn {
     border-top-left-radius: 0 !important;
     border-bottom-left-radius: 0 !important;
     padding-left: var(--spacing-sm) !important;
     padding-right: var(--spacing-sm) !important;
     min-width: 36px;
   }
   ```

**效果**：清空按钮从 btn-sm（高约 32px）变为 btn 常规尺寸（高约 40px），与同行其他组件视觉协调。

### Part C: 四个管理页按钮保持原尺寸（无需改动）

**涉及文件**：4 个管理页（不修改）

**说明**：
- 管理页的 action 按钮当前已是 `btn btn-primary`（常规尺寸），与原"添加"按钮一致
- 本轮不修改管理页按钮尺寸，仅确认不照搬首页新尺寸
- 管理页按钮继续使用 `min-width: 32px` 的 toggle 按钮

### Part D: 编辑工具栏移至新行，不挤压搜索框（4 个管理页）

**涉及文件**：
- `src/admin/views/TablesView.vue`
- `src/admin/views/DishesView.vue`
- `src/admin/views/InventoryView.vue`
- `src/admin/views/UsersView.vue`

**改动内容**（每个文件相同模式）：

1. **模板：将 `edit-toolbar` 移出 `page-header`**：
   ```html
   <!-- 改前 -->
   <div class="page-header">
     <h1 class="page-title">XXX管理</h1>
     <div class="search-input-wrapper">...</div>
     <div v-if="editMode" class="edit-toolbar">...</div>
     <div v-else ref="actionDropdownRef" class="action-dropdown-wrapper">...</div>
   </div>
   <!-- 改后 -->
   <div class="page-header">
     <h1 class="page-title">XXX管理</h1>
     <div class="search-input-wrapper">...</div>
     <div v-if="!editMode" ref="actionDropdownRef" class="action-dropdown-wrapper">...</div>
   </div>
   <div v-if="editMode" class="edit-toolbar-row">
     <div class="edit-toolbar">...</div>
   </div>
   ```

2. **样式：新增 `.edit-toolbar-row`**：
   ```css
   .edit-toolbar-row {
     display: flex;
     justify-content: flex-end;
     margin-bottom: var(--spacing-xl);
   }
   ```
   （`.edit-toolbar` 样式保持不变）

**效果**：
- 编辑模式下，page-header 只含标题 + 搜索框，搜索框不被挤压
- 编辑工具栏独占新一行，右对齐（与原按钮位置视觉一致）
- 布局稳定，不会因工具栏宽度变化而挤压其他元素

## Assumptions & Decisions

1. **进度弹窗使用 Modal 组件**：复用各页已导入的 `defineAsyncComponent(() => import('@/shared/components/Modal.vue'))`，设置 `:closable="false"` 防止删除过程中被关闭
2. **逐条删除容错**：单条删除失败时继续删除下一条，最终汇总成功/失败数量
3. **清空操作不显示进度**：按用户要求，仅批量删除显示进度条；清空保持 Promise.all 并行
4. **首页按钮调大到常规 .btn**：从 btn-sm 改为 btn（移除 btn-sm），符合"调大一点"的描述
5. **管理页按钮不改动**：已是常规 .btn，与原"添加"按钮一致
6. **编辑工具栏右对齐**：移至新行后右对齐，保持与原 action-dropdown 位置视觉协调

## Verification

1. `npm run build` 构建成功，无 TypeScript 错误
2. 各管理页批量删除：选中多项 → 点击"删除选中" → 确认 → 进度弹窗逐条递增 → 完成
3. 首页清空订单按钮视觉变大，与同行搜索按钮/筛选框高度协调
4. 各管理页进入编辑模式后，搜索框宽度不变，编辑工具栏在新行显示
5. 清空操作仍为并行，无进度弹窗
