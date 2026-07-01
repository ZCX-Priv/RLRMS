# 修复餐厅简介折叠：按钮缺失与截断行数错误

## Summary
将折叠类 `desc-collapsed` 从外层 div 移到内部 `<p>` 元素上，使按钮始终可见；同时修正 `max-height` 计算为纯 3 行文本高度（不含 padding），确保精确在 3 行截断。每次打开 Modal 时重置状态，保证检测干净准确。

## Current State Analysis
目标文件：`src/client/views/SettingsView.vue`

当前结构（L226-L241）：
```html
<div ref="descRef" class="about-description"
     :class="{ 'desc-collapsed': descOverflow && !descExpanded }">
  <p><span class="about-quote">"</span>{{ ... }}<span class="about-quote">"</span></p>
  <button v-if="descOverflow" class="desc-toggle" ...>...</button>
</div>
```

当前样式（L464-L467）：
```css
.desc-collapsed {
  max-height: calc(0.875rem * 1.8 * 3 + var(--spacing-md) * 2);
  overflow: hidden;
}
```

**根本原因**：
1. **按钮被隐藏**：`.desc-collapsed`（含 `overflow: hidden`）应用在外层 div 上，`<button>` 也在 div 内部。`max-height` 只计算了 3 行文本 + padding，未包含按钮高度，按钮被 `overflow: hidden` 裁切。
2. **截断行数不准**：`max-height` 在 div 上，包含了 `padding: var(--spacing-md)`（上下各 1rem = 32px），但实际行高由内部 `<p>` 的 `line-height: 1.8` 控制。div 的盒模型与 p 的行高计算混在一起，导致截断位置偏移到 4 行半。
3. **状态残留**：每次重新打开 Modal 时 `descOverflow` 和 `descExpanded` 可能保留上一次的值，导致 `<p>` 处于折叠状态时测量 `scrollHeight` 得到的是折叠后的高度而非完整高度。

## Proposed Changes

### 1. 将折叠类从 div 移到 `<p>` 元素
**文件**：`src/client/views/SettingsView.vue`（template 区域 L226-L241）

```html
<div
  v-if="restaurantInfo.description"
  ref="descRef"
  class="about-description"
>
  <p :class="{ 'desc-collapsed': descOverflow && !descExpanded }">
    <span class="about-quote">&ldquo;</span>{{ restaurantInfo.description }}<span class="about-quote">&rdquo;</span>
  </p>
  <button
    v-if="descOverflow"
    class="desc-toggle"
    @click="descExpanded = !descExpanded"
  >
    {{ descExpanded ? '收起' : '展开全文' }}
  </button>
</div>
```

**为什么**：按钮在 `<p>` 之外、div 之内，不再受 `overflow: hidden` 影响，始终可见。

### 2. 修正 `.desc-collapsed` 样式
**文件**：`src/client/views/SettingsView.vue`（style 区域 L464-L467）

```css
.desc-collapsed {
  max-height: calc(0.875rem * 1.8 * 3);
  overflow: hidden;
}
```

**为什么**：`max-height` 现在直接在 `<p>` 上，`<p>` 没有 padding，所以只需纯 3 行文本高度 `0.875rem * 1.8 * 3 = 4.725rem ≈ 75.6px`。精确在第 3 行末尾截断。

### 3. 重置状态后再检测
**文件**：`src/client/views/SettingsView.vue`（script 区域 L50-L55）

```typescript
watch(showAboutModal, async (show) => {
  if (show) {
    descExpanded.value = false
    descOverflow.value = false
    await nextTick()
    checkDescOverflow()
  }
})
```

**为什么**：先重置 `descOverflow = false`，确保 `<p>` 在测量时没有 `desc-collapsed` 类，`scrollHeight` 返回完整文本高度。`nextTick()` 后 DOM 更新完毕，再执行检测。

## Assumptions & Decisions
- `white-space: pre-wrap` 保留在 `<p>` 上，不受影响（`max-height` + `overflow: hidden` 兼容 `pre-wrap`）。
- 不使用 `-webkit-line-clamp`，因为它要求 `display: -webkit-box`，会覆盖 `white-space: pre-wrap`，导致描述中的显式换行符 `\n` 丢失。
- `checkDescOverflow()` 逻辑本身不需要修改，只需确保测量时 `<p>` 未被折叠。

## Verification Steps
1. 进入客户端设置页，打开"餐厅信息" Modal。
2. 确认简介文字精确在第 3 行末尾截断，不会出现半行。
3. 确认截断时下方有"展开全文"按钮可见。
4. 点击"展开全文"后显示完整文本，按钮变为"收起"。
5. 点击"收起"后回到 3 行截断状态。
6. 关闭 Modal 再重新打开，确认状态已重置（默认折叠、按钮为"展开全文"）。
7. 运行 `npx vue-tsc -b --noEmit` 确认无类型错误。
