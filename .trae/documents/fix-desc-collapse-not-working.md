# 修复餐厅简介三行折叠未生效问题

## Summary
`SettingsView` 中餐厅简介的自动折叠功能因检测时机错误而失效。需要在 Modal 真正打开、DOM 渲染完成后再执行高度检测。

## Current State Analysis
目标文件：`src/client/views/SettingsView.vue`

- 简介区块 `.about-description` 位于一个 `Modal` 组件内部。
- `Modal` 组件（`src/shared/components/Modal.vue`）使用 `v-if="show"` 控制显隐。当 `showAboutModal = false` 时，Modal 及其内部所有 DOM（包括 `descRef` 绑定的元素）均不存在于文档中。
- `checkDescOverflow()` 仅在 `onMounted` 的 `finally` 块中调用一次。此时 `showAboutModal` 仍为 `false`，`descRef.value` 为 `null`，函数直接 `return`，`descOverflow` 保持初始值 `false`。
- 用户后续打开 Modal 时，`descRef` 对应的 DOM 才渲染出来，但没有任何逻辑再次触发 `checkDescOverflow()`，导致折叠按钮永远不会出现，`.desc-collapsed` 类也永远不会被应用。

## Proposed Changes

### 1. 导入 `watch` 并监听 Modal 打开事件
**文件**：`src/client/views/SettingsView.vue`

1. 将 `vue` 的导入从 `{ ref, onMounted, nextTick }` 改为 `{ ref, onMounted, nextTick, watch }`。
2. 在 `script setup` 中新增一个 `watch`：

```typescript
watch(showAboutModal, async (show) => {
  if (show) {
    await nextTick()
    checkDescOverflow()
  }
})
```

这样当用户点击打开"餐厅信息" Modal 后，DOM 渲染完毕即可重新计算文本高度，正确设置 `descOverflow`。

### 2. （可选）保留 onMounted 中的兜底检测
`onMounted` 中的 `checkDescOverflow()` 调用可以保留，作为 Modal 初始即为打开状态的兜底；在当前业务场景下它会被 `if (!el) return` 跳过，无副作用。

## Assumptions & Decisions
- 假设 Modal 打开后文本内容不会再动态变化（如需在 Modal 打开后实时修改简介并重新检测，可额外 watch `restaurantInfo.description`）。当前业务无此需求，暂不增加复杂度。
- 使用 `watch(showAboutModal)` 而非 Modal 的过渡动画钩子，是因为后者需要修改 Modal 组件本身；watch 方式改动最小、最直观。

## Verification Steps
1. 进入客户端设置页。
2. 点击打开"餐厅信息"（或"关于"）Modal。
3. 若餐厅简介超过三行，应默认只显示前三行，并在底部出现"展开全文"按钮。
4. 点击"展开全文"后显示完整文本，按钮变为"收起"。
5. 将简介缩短至三行以内，重新打开 Modal，确认不再出现折叠按钮