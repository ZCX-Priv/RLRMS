# 计划：管理页面下拉按钮 + 编辑/清空模式 + 图标一致性

## 概述

为四个管理页面（桌位管理、菜单管理、库存管理、用户管理）做以下改造：
1. **图标一致性**：让空状态图标与导航图标保持一致（3 处修改）。
2. **拆分下拉按钮**：把"添加XXX"按钮改为带下拉菜单的拆分按钮（参考 DashboardView 的 `clear-main-btn` + `clear-toggle-btn`），下拉菜单含「编辑」「清空」两个选项。
3. **编辑模式**：进入编辑模式后，每个条目出现圆形复选按钮，可多选并批量删除（删除前有确认 Modal）。
4. **清空**：点击「清空」先弹确认 Modal，确认后清空全部条目。

---

## 当前状态分析

### 四个管理页面（结构高度一致）
| 页面 | 文件 | 数据源 ref | 列表渲染 | 拖拽 | 单项删除 API |
|------|------|-----------|----------|------|--------------|
| 桌位管理 | `src/admin/views/TablesView.vue` | `tables` | `.tables-grid` → `.table-card`（卡片网格） | 无 | `api.deleteTable(id)` |
| 菜单管理 | `src/admin/views/DishesView.vue` | `dishes` | `draggable` → `.dish-item`（列表） | 有（handle `.drag-handle-dish`） | `api.deleteDish(id)` |
| 库存管理 | `src/admin/views/InventoryView.vue` | `inventory` | `draggable` → `.inventory-item`（列表） | 有（handle `.drag-handle-inventory`） | `api.deleteInventoryItem(id)` |
| 用户管理 | `src/admin/views/UsersView.vue` | `users` | `v-for` → `.user-item`（列表） | 无 | `api.deleteUser(id)` |

- 四个页面 page-header 结构一致：`h1.page-title` + `.search-input-wrapper` + 添加按钮。
- 已有 `ConfirmDialog`（`src/shared/components/ConfirmDialog.vue`）和 `Modal`（`src/shared/components/Modal.vue`）异步加载。
- **无批量删除/清空 API**，需用 `Promise.all` 调用单项删除接口。
- **用户管理特殊**：`username === 'admin'` 的主管理员不可删除（模板中 `v-if="user.username !== 'admin'"` 才显示操作按钮），编辑/清空时需保护该用户。

### 下拉按钮参考（DashboardView.vue）
- 结构：`.clear-dropdown-wrapper`（`position:relative; display:inline-flex`）内含 主按钮 + `.clear-divider` + 切换按钮 + `.clear-dropdown-menu`。
- 主按钮 `clear-main-btn`：右侧圆角为 0；切换按钮 `clear-toggle-btn`：左侧圆角为 0。
- 点击外部关闭：`document.addEventListener('click', handleClickOutside)` + ref 包裹判断。

### 图标现状
| 页面 | 导航图标（LayoutView.vue 第 313-316 行） | 空状态图标 |
|------|------------------------------------------|------------|
| 桌位管理 | `Armchair` | `Armchair`（已一致，不改） |
| 菜单管理 | `UtensilsCrossed` | `ChefHat`（DishesView 第 395 行）→ **改为 `UtensilsCrossed`** |
| 库存管理 | `Package` | `PackageOpen`（InventoryView 第 160 行）→ **改为 `Package`** |
| 用户管理 | `UserCircle`（LayoutView 第 316 行）→ **改为 `Users`** | `Users`（UsersView 第 190 行） |

---

## 提议改动

### Part A：图标一致性（3 处）

1. **`src/admin/views/DishesView.vue`**
   - 第 10 行 import：`ChefHat` → `UtensilsCrossed`（`UtensilsCrossed` 已在 import 中？否，需确认。当前 import 第 10 行无 `UtensilsCrossed`，需添加并移除 `ChefHat`）。
   - 第 395 行模板：`<ChefHat :size="64" />` → `<UtensilsCrossed :size="64" />`。

2. **`src/admin/views/InventoryView.vue`**
   - 第 10 行 import：`PackageOpen` → `Package`。
   - 第 160 行模板：`<PackageOpen :size="64" />` → `<Package :size="64" />`。

3. **`src/admin/views/LayoutView.vue`**
   - 第 316 行 navItems：`{ icon: UserCircle, ... }` → `{ icon: Users, ... }`。
   - import 调整：移除 `UserCircle`，添加 `Users`（确认 `Users` 未被其他地方使用；LayoutView 当前 import 第 11-18 行含 `UserCircle`，需改为 `Users`）。

### Part B：拆分下拉按钮（4 个页面，统一模式）

把现有添加按钮：
```html
<button class="btn btn-primary" @click="openAddModal">
  <Plus :size="18" /> 添加XXX
</button>
```
替换为拆分按钮（btn-primary 配色，区别于参考的 btn-danger）：
```html
<div ref="actionDropdownRef" class="action-dropdown-wrapper">
  <button class="btn btn-primary action-main-btn" @click="openAddModal">
    <Plus :size="18" /> 添加XXX
  </button>
  <span class="action-divider"></span>
  <button class="btn btn-primary action-toggle-btn" @click="showActionDropdown = !showActionDropdown">
    <ChevronDown :size="14" />
  </button>
  <div v-if="showActionDropdown" class="action-dropdown-menu">
    <button class="action-dropdown-item" @click="enterEditMode">
      <Edit :size="14" /> 编辑
    </button>
    <button class="action-dropdown-item action-dropdown-danger" @click="requestClearAll">
      <Trash2 :size="14" /> 清空
    </button>
  </div>
</div>
```

**新增 script 状态（4 页面通用）：**
```ts
import { ChevronDown, Check } from 'lucide-vue-next'  // 各页面按需补充
const actionDropdownRef = ref<HTMLElement | null>(null)
const showActionDropdown = ref(false)
const editMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const showClearConfirm = ref(false)
const showBatchDeleteConfirm = ref(false)

function handleClickOutside(e: MouseEvent) {
  if (showActionDropdown.value && actionDropdownRef.value &&
      !actionDropdownRef.value.contains(e.target as Node)) {
    showActionDropdown.value = false
  }
}
function enterEditMode() {
  showActionDropdown.value = false
  editMode.value = true
  selectedIds.value.clear()
}
function exitEditMode() {
  editMode.value = false
  selectedIds.value.clear()
}
function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}
function requestClearAll() {
  showActionDropdown.value = false
  showClearConfirm.value = true
}
```
- `onMounted` 增加 `document.addEventListener('click', handleClickOutside)`，`onUnmounted` 移除。

**编辑模式工具栏**：当 `editMode` 为 true 时，page-header 的按钮区替换为工具栏：
```html
<div v-if="editMode" class="edit-toolbar">
  <label class="select-all-checkbox" @click="toggleSelectAll">
    <span class="item-checkbox" :class="{ checked: isAllSelected }"><Check :size="14" /></span>
    全选
  </label>
  <span class="selected-count">已选 {{ selectedIds.size }} 项</span>
  <button class="btn btn-danger btn-sm" :disabled="selectedIds.size === 0" @click="showBatchDeleteConfirm = true">
    <Trash2 :size="14" /> 删除选中
  </button>
  <button class="btn btn-secondary btn-sm" @click="exitEditMode">取消</button>
</div>
<div v-else ref="actionDropdownRef" class="action-dropdown-wrapper"> ...拆分按钮... </div>
```

### Part C：编辑模式 - 圆形复选按钮（4 个页面）

每个条目在合适位置插入圆形复选按钮（仅 `editMode` 时显示）：

**圆形复选按钮样式（4 页面统一）：**
```css
.item-checkbox {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
  transition: all var(--transition-fast);
  color: transparent;
}
.item-checkbox.checked {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}
```

**各页面复选按钮位置：**
- **TablesView**：`.table-card` 内顶部左侧（在 `.table-status` 之前或卡片内容开头）。
- **DishesView**：`.dish-item` 内最左侧（在 `.drag-handle-dish` 之前）；编辑模式下禁用拖拽（`draggable` 的 `:disabled="editMode || !!searchQuery"`）。
- **InventoryView**：`.inventory-item` 内最左侧（在 `.drag-handle-inventory` 之前）；编辑模式下禁用拖拽。
- **UsersView**：`.user-item` 内最左侧（在 `.user-info` 之前）；主管理员（`username === 'admin'`）不显示复选按钮、不可选。

**批量删除逻辑（4 页面通用）：**
```ts
async function confirmBatchDelete() {
  const ids = [...selectedIds.value]
  try {
    await Promise.all(ids.map(id => api.deleteXxx(id)))  // 各页面对应 API
    appStore.showToast(`已删除 ${ids.length} 项`, 'success')
  } catch (e) {
    appStore.showToast('部分删除失败', 'error')
  } finally {
    showBatchDeleteConfirm.value = false
    exitEditMode()
    fetchData()  // 重新拉取
  }
}
```

### Part D：清空逻辑（4 个页面）

```ts
async function confirmClearAll() {
  try {
    // 用户管理：保留主管理员
    const ids = xxx.value
      .filter(item => !(page === 'users' && item.username === 'admin'))
      .map(item => item.id)
    await Promise.all(ids.map(id => api.deleteXxx(id)))
    appStore.showToast('已清空', 'success')
  } catch (e) {
    appStore.showToast('清空失败', 'error')
  } finally {
    showClearConfirm.value = false
    fetchData()
  }
}
```

**新增 ConfirmDialog（4 页面各加 2 个）：**
```html
<!-- 批量删除确认 -->
<ConfirmDialog
  :show="showBatchDeleteConfirm"
  :message="`确定要删除选中的 ${selectedIds.size} 项吗？`"
  @confirm="confirmBatchDelete"
  @cancel="showBatchDeleteConfirm = false"
/>
<!-- 清空确认 -->
<ConfirmDialog
  :show="showClearConfirm"
  message="确定要清空全部数据吗？此操作不可恢复。"
  @confirm="confirmClearAll"
  @cancel="showClearConfirm = false"
/>
```

---

## 各文件具体改动清单

### 1. `src/admin/views/LayoutView.vue`
- import：`UserCircle` → `Users`。
- navItems 第 316 行：`icon: UserCircle` → `icon: Users`。

### 2. `src/admin/views/TablesView.vue`
- import：添加 `ChevronDown, Check`；移除未用的（`ChefHat` 本就未用，无）。
- 添加状态：`actionDropdownRef/showActionDropdown/editMode/selectedIds/showClearConfirm/showBatchDeleteConfirm` + 相关方法 + `handleClickOutside` + `toggleSelectAll/isAllSelected` computed。
- 模板：page-header 按钮区改为 `v-if editMode` 工具栏 / `v-else` 拆分按钮。
- `.table-card` 内添加圆形复选按钮（`v-if="editMode"`）。
- 添加两个 ConfirmDialog。
- 样式：添加 `.action-dropdown-*`、`.edit-toolbar`、`.item-checkbox`、`.select-all-checkbox` 等。

### 3. `src/admin/views/DishesView.vue`
- import：`ChefHat` → `UtensilsCrossed`；添加 `ChevronDown, Check`。
- 空状态图标第 395 行：`ChefHat` → `UtensilsCrossed`。
- 同 TablesView 的状态/方法/模板/ConfirmDialog 改造。
- `draggable` 第 409 行 `:disabled` 增加 `editMode`。
- `.dish-item` 内添加圆形复选按钮。
- 样式同上。

### 4. `src/admin/views/InventoryView.vue`
- import：`PackageOpen` → `Package`；添加 `ChevronDown, Check`。
- 空状态图标第 160 行：`PackageOpen` → `Package`。
- 同上改造；`draggable` `:disabled` 增加 `editMode`。
- `.inventory-item` 内添加圆形复选按钮。

### 5. `src/admin/views/UsersView.vue`
- import：添加 `ChevronDown, Check`。
- 同上改造。
- `.user-item` 内添加圆形复选按钮，主管理员不显示。
- `toggleSelectAll`/`isAllSelected` computed 需排除主管理员。
- `confirmClearAll` 需保留主管理员。

---

## 假设与决策

1. **无批量删除 API** → 用 `Promise.all` 并发调用单项删除接口；失败时 toast 提示并重新拉取保证数据一致。
2. **拆分按钮配色用 `btn-primary`**（红色主题色），区别于参考的 `btn-danger`，因为主操作是"添加"。
3. **编辑模式下禁用拖拽**（Dishes/Inventory），避免拖拽与选择冲突。
4. **用户管理保护主管理员**：编辑模式下主管理员不显示复选按钮；清空时保留主管理员。
5. **全选功能**：编辑工具栏含全选复选框（排除不可选项），属批量删除的标准必要 UX。
6. **下拉菜单样式**复用 DashboardView 的 `.clear-dropdown-*` 模式，重命名为 `.action-dropdown-*`，菜单项「编辑」用默认文字色、「清空」用 danger 色。
7. **编辑模式退出**：点击"取消"或完成批量删除后自动退出并清空选择。
8. **图标改动仅涉及用户指定的 3 处**（菜单/库存空状态、用户管理导航），桌位管理已一致不动。

---

## 验证步骤

1. `npm run dev` 启动开发服务器，逐页验证：
2. **图标**：菜单管理空状态显示 `UtensilsCrossed`；库存管理显示 `Package`；用户管理导航显示 `Users` 图标。
3. **拆分按钮**：主按钮点击仍打开添加 Modal；点击下拉箭头展开菜单；点击外部关闭。
4. **编辑模式**：点「编辑」进入，每条目出现圆形复选按钮；可单选/全选；工具栏显示已选数量。
5. **批量删除**：选若干项 → 点"删除选中" → 弹确认 Modal → 确认后删除并退出编辑模式。
6. **清空**：点「清空」→ 弹确认 Modal → 确认后清空（用户管理保留主管理员）。
7. **拖拽**：编辑模式下 Dishes/Inventory 不可拖拽，退出后恢复。
8. **主管理员保护**：用户管理编辑模式下主管理员无复选按钮；清空后主管理员仍在。
9. TypeScript 编译无报错（`npm run build`）。
