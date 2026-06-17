# 红灯笼食府管理系统 - UI 优化计划

## 概述

针对用户提出的三个 UI 问题进行优化：
1. 用户头像在浅色模式下添加专门样式
2. 菜单卡片超过 3 项后收起，提供展开/收起按钮
3. 桌位选择在数量较多时支持翻页

## 当前状态分析

### 主题系统
- 通过 `data-theme` 属性切换 `light` / `dark`
- `:root` 默认为浅色模式（红灯笼主题，浅粉背景 `#FEF2F2`，深红文字）
- `[data-theme="dark"]` 为深色模式（深红背景，浅色文字）
- CSS 变量定义在 [src/style.css](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/style.css)

### 涉及文件
1. **[SettingsView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/client/views/SettingsView.vue)** - 用户头像 `profile-avatar`（第 296-306 行）
   - 当前：红色渐变背景 + 白色图标，浅色/深色模式相同
2. **[OrderConfirmView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/client/views/OrderConfirmView.vue)** - 菜单卡片 + 桌位选择
   - 菜单卡片（第 235-273 行）：显示购物车所有菜品，无收起功能
   - 桌位选择（第 212-232 行）：显示所有可用桌位，3 列网格，无翻页
3. **[OrderDetailView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/client/views/OrderDetailView.vue)** - 菜单卡片（第 250-264 行）
   - 显示订单所有菜品，无收起功能

## 提议变更

### 变更 1：用户头像浅色模式样式

**文件**：`src/client/views/SettingsView.vue`

**当前样式**（第 296-306 行）：
```css
.profile-avatar {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #cc3333));
  border-radius: 50%;
  color: white;
  flex-shrink: 0;
}
```

**修改方案**：
- 默认（浅色模式）：使用浅红背景 + 红色图标，添加柔和边框
- 深色模式（`[data-theme="dark"]`）：保持红色渐变背景 + 白色图标

**具体实现**：
```css
/* 默认浅色模式 */
.profile-avatar {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-primary);
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

/* 深色模式保持原红色渐变 */
:global([data-theme="dark"]) .profile-avatar {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #cc3333));
  border: none;
  color: white;
}
```

**原因**：浅色模式下使用浅红背景+红色图标更协调，与页面整体浅色风格一致；深色模式保持红色渐变+白色图标的强对比效果。

---

### 变更 2：菜单卡片收起/展开功能

**文件**：
- `src/client/views/OrderConfirmView.vue`
- `src/client/views/OrderDetailView.vue`

**逻辑**：
- 添加 `itemsExpanded` ref，默认 `false`
- 当项目数 > 3 时，收起状态只显示前 3 项，并显示"展开"按钮
- 展开后显示所有项目，按钮变为"收起"
- 项目数 ≤ 3 时，不显示按钮

#### OrderConfirmView.vue 修改

**Script 部分**：
- 添加 `itemsExpanded` ref
- 添加 `displayItems` 计算属性：收起时返回前 3 项，展开时返回全部
- 添加 `hasMoreItems` 计算属性：判断是否超过 3 项

**Template 部分**（第 246-268 行）：
- 将 `v-for="item in cartStore.items"` 改为 `v-for="item in displayItems"`
- 在 `items-list` 下方添加展开/收起按钮（当 `hasMoreItems` 为 true 时显示）

**新增按钮样式**：
```css
.items-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  width: 100%;
  padding: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  font-size: 0.875rem;
  color: var(--color-primary);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  transition: background-color var(--transition-fast);
}

.items-toggle:hover {
  background-color: var(--color-border-light);
}
```

#### OrderDetailView.vue 修改

**Script 部分**：
- 添加 `itemsExpanded` ref
- 添加 `displayItems` 计算属性（基于 `order.items`）
- 添加 `hasMoreItems` 计算属性

**Template 部分**（第 252-258 行）：
- 将 `v-for="item in order.items"` 改为 `v-for="item in displayItems"`
- 在 `items-list` 下方添加展开/收起按钮

**原因**：订单菜品较多时，全部展开会导致页面过长，影响浏览体验。默认显示前 3 项，用户可按需展开。

---

### 变更 3：桌位选择翻页功能

**文件**：`src/client/views/OrderConfirmView.vue`

**逻辑**：
- 添加 `tablePage` ref，默认 `1`
- 每页显示 9 个桌位（3 行 × 3 列）
- 当 `availableTables.length > 9` 时显示翻页控件
- 计算属性：
  - `totalPages`：总页数
  - `paginatedTables`：当前页的桌位列表
  - `showTablePagination`：是否显示翻页控件
- 翻页时切换 `tablePage`，并确保页码有效

**Script 部分**：
```typescript
const TABLE_PAGE_SIZE = 9
const tablePage = ref(1)

const totalPages = computed(() => 
  Math.ceil(availableTables.value.length / TABLE_PAGE_SIZE)
)

const showTablePagination = computed(() => 
  availableTables.value.length > TABLE_PAGE_SIZE
)

const paginatedTables = computed(() => {
  const start = (tablePage.value - 1) * TABLE_PAGE_SIZE
  return availableTables.value.slice(start, start + TABLE_PAGE_SIZE)
})

function changeTablePage(delta: number) {
  const newPage = tablePage.value + delta
  if (newPage >= 1 && newPage <= totalPages.value) {
    tablePage.value = newPage
  }
}
```

**监听桌位数据变化**：当 `availableTables` 变化时（如切换就餐时间），重置页码到第 1 页。

**Template 部分**（第 220-231 行）：
- 将 `v-for="table in availableTables"` 改为 `v-for="table in paginatedTables"`
- 在 `table-grid` 下方添加翻页控件（当 `showTablePagination` 为 true 时显示）

**翻页控件设计**：
```html
<div v-if="showTablePagination" class="table-pagination">
  <button 
    class="page-btn" 
    :disabled="tablePage === 1"
    @click="changeTablePage(-1)"
  >
    <ChevronLeft :size="16" />
  </button>
  <span class="page-info">{{ tablePage }} / {{ totalPages }}</span>
  <button 
    class="page-btn" 
    :disabled="tablePage === totalPages"
    @click="changeTablePage(1)"
  >
    <ChevronRight :size="16" />
  </button>
</div>
```

**新增样式**：
```css
.table-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.page-btn:hover:not(:disabled) {
  background-color: var(--color-primary);
  color: white;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  min-width: 50px;
  text-align: center;
}
```

**需要导入的图标**：`ChevronLeft`, `ChevronRight`（从 lucide-vue-next 导入，`ChevronRight` 已存在，需新增 `ChevronLeft`）

**原因**：桌位较多时（如 10+ 个），全部展示会导致页面过长，翻页可以保持界面紧凑，提升选择效率。

---

## 假设与决策

1. **浅色模式判定**：项目使用 `:root` 作为浅色模式默认值，`[data-theme="dark"]` 为深色模式。因此浅色模式样式作为默认，深色模式通过 `:global([data-theme="dark"])` 覆盖（因为 Vue scoped 样式需要 `:global` 或 `:deep` 来选择父级属性）。

2. **菜单收起阈值**：用户明确要求超过 3 项收起，前 3 项默认显示。

3. **桌位翻页参数**：用户明确要求超过 9 个时翻页，每页 9 个（3 行 × 3 列网格）。

4. **图标导入**：`OrderConfirmView.vue` 已导入 `ChevronRight`，需新增 `ChevronLeft`。菜单展开/收起按钮使用已有的 `ChevronDown`/`ChevronUp` 或 `ChevronRight`/`ChevronLeft` 图标。

5. **不变更的内容**：
   - 不修改主题系统逻辑
   - 不修改购物车/订单的数据结构
   - 不修改桌位选择的核心逻辑（仅添加分页展示层）

## 验证步骤

### 1. 类型检查
```powershell
npm run typecheck
```

### 2. Lint 检查
```powershell
npm run lint
```

### 3. 构建验证
```powershell
npm run build
```

### 4. 手动验证
- **用户头像**：
  - 切换到浅色模式，查看头像是否为浅红背景+红色图标
  - 切换到深色模式，查看头像是否为红色渐变+白色图标
  - 切换到系统模式，跟随系统主题变化
- **菜单收起**：
  - 在 OrderConfirmView 添加 4+ 个菜品，验证默认只显示 3 项
  - 点击"展开"按钮，验证显示所有菜品
  - 点击"收起"按钮，验证回到 3 项
  - 在 OrderDetailView 查看包含 4+ 菜品的订单，验证同样逻辑
  - 菜品 ≤ 3 项时，不显示展开/收起按钮
- **桌位翻页**：
  - 在 OrderConfirmView 查看桌位选择
  - 当桌位 > 9 个时，验证显示翻页控件，每页 9 个
  - 点击上一页/下一页按钮，验证页码切换
  - 第一页时上一页按钮禁用，最后一页时下一页按钮禁用
  - 切换就餐时间（中午/晚上），验证页码重置到第 1 页
  - 桌位 ≤ 9 个时，不显示翻页控件
