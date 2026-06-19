# 修改设置页面标题和侧边栏 hover 效果

## 任务摘要

根据用户要求，对设置页面（SettingsView.vue）中的标题文案和图标进行调整，并修复侧边栏（LayoutView.vue）中激活导航项的 hover 效果问题。

## 当前状态分析

### SettingsView.vue（`src\admin\views\SettingsView.vue`）

1. **"开发人员模式" span**（第 352 行）：位于开发人员选项区块内的一个开关项，文案为"开发人员模式"。
2. **三个 h2 标题**（均带 `section-title` class，含 lucide 图标组件）：
   - 第 215-218 行："餐厅信息"，含 `<Store :size="18" />`
   - 第 326-329 行："数据管理"，含 `<Database :size="18" />`
   - 第 345-348 行："开发人员选项"，含 `<Code :size="18" />`

### LayoutView.vue（`src\admin\views\LayoutView.vue`）侧边栏 hover 问题分析

侧边栏导航项的激活状态为 `nav-item-active`。当前 hover 相关样式：

- 第 334-336 行：`.nav-item:hover .nav-icon-wrapper { color: var(--color-primary); }`
  - 优先级为 `0,0,3,0`（含 `:hover` 伪类）
- 第 338-340 行：`.nav-item-active .nav-icon-wrapper { color: white; }`
  - 优先级为 `0,0,2,0`

**问题根因**：由于 `.nav-item:hover .nav-icon-wrapper` 的优先级（3 个类/伪类）高于 `.nav-item-active .nav-icon-wrapper`（2 个类），当激活导航项被 hover 时，图标颜色会从白色变成 primary 色，产生视觉变化。

其他 hover 效果已正常处理：
- 背景与文字颜色：`.nav-item-active:hover`（第 495-498 行）已保持与 `.nav-item-active` 一致，无变化。
- 折叠状态图标缩放：`.sidebar-collapsed .nav-item-active .nav-icon-wrapper`（第 472-474 行，`scale(1)`）优先级与 hover 规则相同且定义在后，已覆盖 hover 的放大效果，无变化。

因此**唯一需要修复的是图标颜色**。

## 拟定修改

### 修改 1：SettingsView.vue — 修改 span 文案

**文件**：`src\admin\views\SettingsView.vue`
**位置**：第 352 行
**内容**：将 `<span>开发人员模式</span>` 改为 `<span>调试工具</span>`

### 修改 2：SettingsView.vue — 删除三个 h2 中的图标组件

**文件**：`src\admin\views\SettingsView.vue`

1. 第 215-218 行：删除 `<Store :size="18" />` 一行
2. 第 326-329 行：删除 `<Database :size="18" />` 一行
3. 第 345-348 行：删除 `<Code :size="18" />` 一行

修改后三个 h2 仅保留文本内容，例如：
```html
<h2 class="section-title">
  餐厅信息
</h2>
```

### 修改 3：LayoutView.vue — 修复激活导航项 hover 时图标变色

**文件**：`src\admin\views\LayoutView.vue`
**位置**：在第 498 行 `.nav-item-active:hover` 规则之后，新增一条规则
**内容**：
```css
.nav-item-active:hover .nav-icon-wrapper {
  color: white;
}
```

**原理**：新增规则优先级为 `0,0,4,0`（4 个类/伪类），高于 `.nav-item:hover .nav-icon-wrapper`（`0,0,3,0`），可确保激活项 hover 时图标保持白色不变。

## 假设与决策

1. **假设**：用户提到的"侧边栏选中的一条"指侧边栏中当前激活（高亮）的导航项，即带有 `nav-item-active` class 的项。
2. **决策**：仅修复图标颜色变化这一实际可见的 hover 问题，不改动已正确处理的背景、文字颜色和折叠缩放规则，遵循"最小必要改动"原则。
3. **决策**：删除 h2 图标后不调整相关 import（如 `Store`、`Database`、`Code` 组件），因为这些图标组件在文件其他位置仍有使用（例如第 351 行的 `<Code :size="20" />` 仍在使用 Code 组件），删除 import 会导致编译错误。若删除后存在未使用的 import，将在实施时通过 lint 检查确认并清理。

## 验证步骤

1. 启动开发服务器，打开设置页面：
   - 确认"开发人员模式"开关项的文案已变为"调试工具"
   - 确认"餐厅信息"、"数据管理"、"开发人员选项"三个 h2 标题前方不再显示图标
2. 在侧边栏中点击任一导航项使其激活（高亮），然后将鼠标移到该激活项上：
   - 确认图标颜色保持白色不变
   - 确认背景色、文字颜色无变化
3. 折叠侧边栏，重复上述 hover 验证，确认激活项图标不会放大
4. 运行项目的 lint/typecheck 命令（如 `npm run lint`），确认无报错
