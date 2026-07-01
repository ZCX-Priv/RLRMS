# 展开/收起按钮居中并添加箭头图标

## Summary
将餐厅简介的"展开全文/收起"按钮水平居中，并添加箭头图标（展开时向下箭头，收起时向上箭头）。

## Current State Analysis
目标文件：`src/client/views/SettingsView.vue`

- 按钮（L235-L241）：`display: block`，默认左对齐，无图标。
- 图标导入（L10）：已从 `lucide-vue-next` 导入 `ChevronRight` 等，但未导入 `ChevronDown` / `ChevronUp`。
- 按钮样式（L470-L478）：`display: block; padding: var(--spacing-xs) 0 0;`，无居中样式。

## Proposed Changes

### 1. 导入箭头图标
**文件**：`src/client/views/SettingsView.vue`（L10）

在 `lucide-vue-next` 导入中添加 `ChevronDown` 和 `ChevronUp`。

### 2. 按钮模板添加图标
**文件**：`src/client/views/SettingsView.vue`（L235-L241）

```html
<button
  v-if="descOverflow"
  class="desc-toggle"
  @click="descExpanded = !descExpanded"
>
  <component :is="descExpanded ? ChevronUp : ChevronDown" :size="14" />
  {{ descExpanded ? '收起' : '展开全文' }}
</button>
```

### 3. 按钮样式居中
**文件**：`src/client/views/SettingsView.vue`（L470-L478）

```css
.desc-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  margin: 0 auto;
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.8rem;
  cursor: pointer;
  padding: var(--spacing-xs) 0 0;
}
```

## Verification Steps
1. 打开设置页"餐厅信息" Modal，简介超过 3 行时按钮居中显示，带向下箭头和"展开全文"。
2. 点击展开后按钮变为向上箭头和"收起"，仍居中。
3. 运行 `npx vue-tsc -b --noEmit` 确认无类型错误。
