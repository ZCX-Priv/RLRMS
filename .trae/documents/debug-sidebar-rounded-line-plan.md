# 调试工具子项指示线圆角化计划

## 摘要
将 `LayoutView.vue` 中「SQL 查询 / API 调试」子项的 active 左侧指示线从生硬直条改为两端圆角的短柱/胶囊形状，使其与系统原有的圆角设计语言保持一致，视觉上更柔和。

## 当前状态分析

### 侧边栏子项样式（`src/admin/views/LayoutView.vue`）
- 子项 active 时通过 `::before` 伪元素绘制一条 2px 宽、贯穿整个按钮高度的竖直线。
- 该竖线没有圆角，在整体以 `--radius-md` 圆角为主的侧边栏中显得生硬。
- 其他导航项（`.nav-item`）active 时使用的是带 `border-radius` 的红色背景块，视觉上更柔和。

## 变更方案

### 1. 调整 `src/admin/views/LayoutView.vue`

#### 目标
- 保留子项 active 时透明背景 + 主色文字的样式。
- 保留左侧指示线位于父项文字左边缘正下方的位置。
- 将指示线从生硬的直条改为两端圆角的短柱/胶囊形状。

#### 具体修改
- 修改 `.nav-sub-item.nav-item-active::before` 的样式：
  ```css
  .nav-sub-item.nav-item-active::before {
    content: '';
    position: absolute;
    left: calc(var(--spacing-md) + 20px + var(--spacing-md));
    top: 50%;
    transform: translateY(-50%);
    height: 16px;
    width: 3px;
    border-radius: 9999px;
    background-color: var(--color-primary);
  }
  ```
- 计算说明：
  - `left` 保持与父项文字左边缘对齐（`spacing-md + 20px + spacing-md`）。
  - `top: 50%; transform: translateY(-50%)` 使短柱在按钮内垂直居中。
  - `height: 16px` 接近图标高度，不会过于夸张。
  - `border-radius: 9999px` 让两端完全圆润。

### 2. 不修改的内容
- 子项按钮尺寸保持当前恢复后的大小（图标 16px、padding `--spacing-sm`、字体 0.875rem）。
- 父项点击导航到 `/admin/debug/sql` 的逻辑保持不变。
- 箭头展开/收起逻辑保持不变。
- `DebugView.vue` 标题动态化保持不变。
- 不新增组件或文件。

## 假设与决策

- 用户希望左侧指示线保持位置不变，仅改变形态为圆角短柱。
- 圆角短柱高度取 16px、宽度取 3px，在视觉上与子项图标高度协调，且比 2px 直条更醒目。

## 验证步骤

1. 进入 `/admin/debug/sql`：
   - 「SQL 查询」子项左侧出现圆角短柱，位于父项文字左边缘正下方。
   - 短柱垂直居中，两端圆润，不是生硬直线。
2. 切换到 `/admin/debug/api`：
   - 「API 调试」子项显示同样的圆角短柱指示器。
3. 鼠标悬浮在子项上，确认背景仍为浅色，指示器保持主色。
