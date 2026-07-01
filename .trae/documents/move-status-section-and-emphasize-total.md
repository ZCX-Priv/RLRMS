# 计划：移动「更新状态」section 并放大「总计」行

## 摘要

在订单详情弹窗（`DashboardView.vue`）中：
1. 把「更新状态」section 移到「菜品明细」section 的上方（即调整两个 `.detail-section` 的顺序）。
2. 把「总计」行（`.total-row`）改得更大、更醒目。

## 当前状态分析

目标文件：[src/admin/views/DashboardView.vue](file:///c:\Users\LX\Desktop\RLRMS\src\admin\views\DashboardView.vue)

`.order-detail` 容器（699-756 行）内当前有三个连续的 `.detail-section`，顺序为：
1. 基本信息（700-722 行）
2. 菜品明细（724-740 行）—— 内含 `v-for` 的 `.item-row` 和末尾的 `.total-row`（736-739 行）
3. 更新状态（742-755 行）—— 内含 `.status-buttons` 与 `v-for` 的 `.status-btn`

`.total-row` 当前样式（1131-1142 行）：
```css
.total-row {
  display: flex;
  justify-content: space-between;
  padding-top: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-light);
  font-weight: 600;
}
.total-row span:last-child {
  color: var(--color-primary);
}
```
字体继承上下文为 `0.875rem`，视觉上偏小、不够突出。

## 拟定改动

### 改动 1：调整 section 顺序（模板）

文件：`src/admin/views/DashboardView.vue`，模板区 724-755 行。

把「更新状态」section（当前 742-755 行）整体移到「菜品明细」section（当前 724-740 行）之前。调整后顺序为：
1. 基本信息
2. **更新状态**（原第三个，移到此处）
3. **菜品明细**（原第二个，下移到此）

实现方式：用 Edit 工具交换两个 `<div class="detail-section">...</div>` 块的位置，保持各自内部内容不变。仅改顺序，不改逻辑、不改类名、不改绑定。

### 改动 2：放大「总计」行（样式）

文件：`src/admin/views/DashboardView.vue`，`<style scoped>` 区 1131-1142 行。

修改 `.total-row` 及 `.total-row span:last-child`，使其更大更醒目：
- `.total-row`：
  - `font-size: 1.125rem;`（从继承的 0.875rem 提升）
  - `font-weight: 700;`（从 600 提升）
  - `padding-top: var(--spacing-md);`（从 `--spacing-sm` 提升）
  - `margin-top: var(--spacing-md);`（从 `--spacing-sm` 提升）
- `.total-row span:last-child`：
  - `font-size: 1.25rem;`（总金额数字更大）
  - `font-weight: 700;`
  - 保留 `color: var(--color-primary);`

不新增类名、不新增 DOM 节点，仅调整已有选择器的样式属性，复用项目既有的 CSS 变量（`--spacing-md`、`--color-primary` 等）。

## 假设与决策

- **假设**：用户仅要求调整这两个 section 的相对顺序，「基本信息」section 保持最顶部不动。
- **决策**：不修改 `.status-btn`、`.item-row` 等其他元素样式，避免过度设计。
- **决策**：放大「总计」行时复用既有 CSS 变量，不引入硬编码颜色/尺寸，保持与项目设计系统一致。
- **决策**：不新增任何文件，仅编辑 `DashboardView.vue` 一个文件。

## 验证步骤

1. 运行项目的前端构建/类型检查（若有 `npm run lint` 或 `npm run typecheck` 脚本，执行之），确认无语法/类型错误。
2. 在浏览器打开管理后台「概览」页，点击某条订单查看「订单详情」弹窗，确认：
   - 三个 section 顺序为：基本信息 → 更新状态 → 菜品明细。
   - 「总计」行字体明显变大、加粗，总金额数字醒目。
   - 状态按钮点击仍可正常切换订单状态（功能未受影响）。
