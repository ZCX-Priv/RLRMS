# 调试工具子项指示线间距微调计划

## 摘要
增大 `LayoutView.vue` 中「SQL 查询 / API 调试」子项 active 圆角短柱与右侧图标之间的间距，避免两者贴得太近。

## 当前状态分析

### 侧边栏子项样式（`src/admin/views/LayoutView.vue`）
- 子项 `padding-left: calc(var(--spacing-md) + 20px + var(--spacing-md) + 4px)`。
- 圆角短柱 `::before` 的 `left` 为 `calc(var(--spacing-md) + 20px + var(--spacing-md))`，宽度 3px。
- 子项图标左边缘 = padding-left = `spacing-md + 20px + spacing-md + 4px`。
- 因此短柱右边缘到图标左边缘的间距 ≈ 4px - 3px = 1px，视觉上几乎贴在一起。

## 变更方案

### 1. 调整 `src/admin/views/LayoutView.vue`

#### 目标
- 保持圆角短柱位置不变（仍对齐父项文字左边缘）。
- 增加子项 content 左内边距，使图标与短柱之间留出更舒适的空间。

#### 具体修改
- 将 `.nav-sub-item` 的 `padding-left` 从：
  ```css
  padding-left: calc(var(--spacing-md) + 20px + var(--spacing-md) + 4px);
  ```
  改为：
  ```css
  padding-left: calc(var(--spacing-md) + 20px + var(--spacing-md) + 10px);
  ```
- 这样短柱右边缘到图标左边缘的间距 ≈ 10px - 3px = 7px，视觉上更舒展。

### 2. 不修改的内容
- 圆角短柱的 `left`、`height`、`width`、`border-radius`、`background-color` 保持不变。
- 子项按钮其他尺寸保持不变。
- 父项点击逻辑、箭头 toggle、`DebugView.vue` 标题逻辑保持不变。
- 不新增组件或文件。

## 假设与决策

- 用户仅要求增大短柱与图标间距，不调整短柱自身大小或位置。
- 将间距从 1px 增加到 7px 是一个视觉上舒适、不会过度挤压内容的折中值。

## 验证步骤

1. 进入 `/admin/debug/sql`：
   - 「SQL 查询」子项左侧圆角短柱与右侧 Terminal 图标之间有明显空隙，不再紧贴。
2. 切换到 `/admin/debug/api`：
   - 「API 调试」子项同样保持合适的短柱-图标间距。
