# 调试工具侧边栏修正计划

## 摘要
修正上一轮对 `LayoutView.vue` 的误改：恢复「SQL 查询 / API 调试」子项按钮的原始尺寸；使用 `::before` 伪元素把子项 active 竖线精确放置在父项文字左边缘正下方，避免受 border-box 影响导致错位。

## 当前状态分析

### 已修改但不符合预期的内容（`src/admin/views/LayoutView.vue`）
- 子项图标被改为 `:size="14"`。
- 子项样式改为 `padding: var(--spacing-xs) var(--spacing-md)`、`font-size: 0.8125rem`。
- 子项 `padding-left` 被改为 `calc(var(--spacing-md) + 20px + var(--spacing-md) + 2px)`，意图让左侧竖线与父项文字对齐。

### 问题根因
- `border-left` 位于元素的 border-box 最外侧，不在 `padding-left` 的最里侧。因此即使增加 `padding-left`，竖线仍然贴在子项最左边，无法真正对齐到父项文字左边缘。
- 同时用户并未要求缩小按钮，上轮的尺寸改动属于误改，需要回滚。

### 父项文字位置计算
- 父项 `.nav-item`：`padding-left: var(--spacing-md)`（1rem = 16px），图标宽度 20px，`gap: var(--spacing-md)`（16px）。
- 父项文字左边缘距离父项 margin 左边缘 = 16px + 20px + 16px = 52px。
- 子项与父项共享同一容器内边距，因此子项竖线需要距离子项 margin 左边缘 52px。

## 变更方案

### 1. 回滚并修正 `src/admin/views/LayoutView.vue`

#### 目标
- 恢复子项按钮原始尺寸。
- 使用 `::before` 伪元素绘制 active 竖线，精确控制其位置与父项文字左边缘对齐。
- 保持父项点击后选中并展开、箭头单独 toggle 的逻辑不变。

#### 具体修改

**回滚子项尺寸：**
- 模板中子项图标 `:size` 从 `14` 改回 `16`。
- `.nav-sub-item` 的 `padding` 从 `var(--spacing-xs) var(--spacing-md)` 改回 `var(--spacing-sm) var(--spacing-md)`。
- `.nav-sub-item` 的 `font-size` 从 `0.8125rem` 改回 `0.875rem`。

**修正左侧竖线位置：**
- 移除 `.nav-sub-item` 上的 `border-left: 2px solid transparent`。
- 将 `.nav-sub-item.nav-item-active` 的红色 `border-left-color` 改为通过 `::before` 伪元素实现：
  ```css
  .nav-sub-item {
    position: relative;
    padding-left: calc(var(--spacing-md) + 20px + var(--spacing-md) + 4px);
  }

  .nav-sub-item.nav-item-active::before {
    content: '';
    position: absolute;
    left: calc(var(--spacing-md) + 20px + var(--spacing-md));
    top: 0;
    bottom: 0;
    width: 2px;
    background-color: var(--color-primary);
  }
  ```
- 计算说明：
  - `::before` 左边缘 = `var(--spacing-md) + 20px + var(--spacing-md)` = 52px，与父项文字左边缘对齐。
  - 子项 content 左边缘 = 52px + 4px = 56px，留出竖线空间。

**保持 hover/active 颜色逻辑：**
- `.nav-sub-item:hover` 保持浅色背景、主文字色。
- `.nav-sub-item.nav-item-active` 保持透明背景、主色文字。
- `.nav-sub-item.nav-item-active:hover` 保持浅色背景、主色文字。

### 2. 不修改的内容
- 父项点击导航到 `/admin/debug/sql` 的逻辑保持不变。
- 箭头 `@click.stop="toggleDebugMenu()"` 保持不变。
- `DebugView.vue` 标题动态化逻辑保持不变。
- 路由配置保持不变。
- 不新增组件或文件。

## 假设与决策

- 用户所说的「左侧竖线」是指子项 active 时的左侧指示线，应精确对齐父项文字左边缘。
- 子项按钮尺寸应恢复为原始大小（图标 16px、padding `--spacing-sm`、字体 0.875rem）。
- 使用 `::before` 伪元素而非 `border-left`，因为 `border-left` 无法在不使用 margin 的情况下对齐到父项文字位置，而 margin 会撑大元素布局。

## 验证步骤

1. 启动开发服务器，从非 debug 页面点击侧边栏「调试工具」：
   - 父项红色高亮，页面跳转到 `/admin/debug/sql`。
   - 子项按钮大小与父项其他菜单项一致，没有被缩小。
   - 「SQL 查询」子项的左侧主色竖线与上方「调试工具」文字左边缘在同一垂直线上。
2. 点击「API 调试」：
   - 「API 调试」子项的左侧竖线同样与父项文字左边缘对齐。
   - 父项保持红色高亮。
3. 鼠标悬浮在子项上，确认背景是浅色而非红色。
