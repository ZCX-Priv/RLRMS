# SettingsView 餐厅简介样式与折叠功能优化计划

## Summary
为客户端设置页（SettingsView）中的餐厅简介 `.about-description` 区块添加楷体字体，并检查、完善现有的超过三行自动折叠功能，确保检测逻辑与视觉表现一致。

## Current State Analysis
目标文件：`src/client/views/SettingsView.vue`

- 简介区块已有折叠骨架：
  - 响应式状态：`descExpanded`、`descOverflow`、`descRef`。
  - 检测函数：`checkDescOverflow()` 在 `onMounted` 的 `finally` 中调用。
  - 折叠类：`.desc-collapsed` 通过 `max-height` 限制为三行高度。
  - 展开/收起按钮：在 `descOverflow` 为 true 时显示。
- **现有问题**：
  1. `checkDescOverflow()` 直接对 `.about-description`（div）计算 `scrollHeight` 与 `lineHeight`，而实际行高由内部的 `<p>` 控制（`line-height: 1.8`），导致检测值与视觉高度不一致，可能在某些情况下误判。
  2. 没有为简介区块配置楷体字体。

## Proposed Changes

### 1. 添加楷体样式
**文件**：`src/client/views/SettingsView.vue`（`<style>` 区域）

在 `.about-description p` 上追加 `font-family`：
```css
.about-description p {
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--color-text-secondary);
  margin: 0;
  white-space: pre-wrap;
  font-family: 'KaiTi', 'STKaiti', '楷体', serif;
}
```

### 2. 修复三行折叠检测逻辑
**文件**：`src/client/views/SettingsView.vue`（`<script setup>` 区域）

修改 `checkDescOverflow` 函数，改为测量内部 `<p>` 元素的实际高度，确保与 CSS 中的 `line-height: 1.8` 对应：
```typescript
function checkDescOverflow() {
  const el = descRef.value
  if (!el) return
  const p = el.querySelector('p')
  if (!p) return
  const lineHeight = parseFloat(getComputedStyle(p).lineHeight) || 24
  descOverflow.value = p.scrollHeight > lineHeight * 3 + 2
}
```

### 3. 校正折叠 max-height 计算（可选增强）
**文件**：`src/client/views/SettingsView.vue`（`<style>` 区域）

将 `.desc-collapsed` 的 `max-height` 从硬编码改为基于 CSS 变量或更清晰的计算，使其与 `line-height: 1.8` 保持同步：
```css
.desc-collapsed {
  max-height: calc(0.875rem * 1.8 * 3 + var(--spacing-md) * 2);
  overflow: hidden;
}
```
> 注：若 `--spacing-md` 在上下 padding 中表现正常，此计算可精确对应内部三行文本 + 容器 padding。若项目实际值不同，保持原有 `+ 1.5rem` 亦可。

## Assumptions & Decisions
- 假设项目已支持常见中文字体回退（`KaiTi` / `STKaiti` / `楷体`），如客户端设备无楷体，将回退到 `serif`。
- 假设 `desc-collapsed` 当前硬编码的 `+ 1.5rem` 与 `var(--spacing-md)` 上下 padding 等效。计划第 3 步为可选优化，若实际运行无偏差可保留原值。
- 不改动展开/收起按钮文案及交互，仅修复高度检测与字体。

## Verification Steps
1. 在浏览器打开客户端设置页（Settings）。
2. 输入超过三行的餐厅简介文本（或手动在 DOM 中追加多行文本）。
3. 确认简介字体显示为楷体。
4. 确认文本超过三行时，默认仅显示前三行，底部出现"展开全文"按钮。
5. 点击按钮后展开全部文本，按钮文案变为"收起"。
6. 将文本缩短至三行以内