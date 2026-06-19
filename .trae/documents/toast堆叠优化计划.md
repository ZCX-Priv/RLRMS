# Toast 堆叠优化计划

## 一、摘要

优化 toast 通知逻辑，使多条通知能够垂直堆叠显示，而非新通知强制覆盖旧通知。同时修复当前 `setTimeout` 未清理导致的 toast 被提前关闭的潜在 Bug。

## 二、当前状态分析

### 现有实现
- **状态存储**：`src/stores/app.ts` 第 74-89 行，`toast` 为单个对象（非数组），结构为 `{ show, message, type }`。
- **显示逻辑**：`showToast(message, type)` 直接整体替换 `toast.value`，新 toast 立即覆盖旧 toast 的内容，但 `v-if` 不切换导致不触发重新进入动画，用户只看到内容突变。
- **定时器问题**：每次调用 `showToast` 都新建 `setTimeout` 但未保存 timer id，连续调用时前一个定时器仍会触发，把 `toast.value.show` 置为 false，导致后续 toast 被提前关闭。
- **组件渲染**：`src/shared/components/Toast.vue` 使用 `<Transition>` + `v-if` 渲染单条 toast，定位为 `position: fixed; top: var(--spacing-lg); left: 50%; transform: translateX(-50%)`。
- **调用方**：共 18 个文件通过 `appStore.showToast(message, type?)` 调用，API 签名统一。

### 核心问题
1. 单对象存储，无法同时存在多条 toast。
2. 定时器泄漏，连续触发关闭时机不可控。
3. 无队列/堆叠机制。

## 三、改动方案

### 决策（已与用户确认）
- 最大同时显示数量：**5 条**，超过时自动移除最早的一条。
- 堆叠位置：**保持顶部居中向下**垂直堆叠。

### 改动 1：`src/stores/app.ts`（核心逻辑改造）

**位置**：第 74-89 行的 `toast` 状态与 `showToast` 方法。

**改造内容**：
1. 将 `toast` 单对象改为 `toasts` 数组，每个元素结构为 `{ id: number, message: string, type: 'success' | 'error' | 'info' }`（移除 `show` 字段，存在与否即代表显示与否）。
2. 引入自增 `id` 计数器（模块级或 store 内 `let toastId = 0`），保证每条 toast 唯一标识。
3. `showToast(message, type)` 改为：
   - 生成新 toast 对象 `{ id: ++toastId, message, type }`，push 到 `toasts.value`。
   - 若 `toasts.value.length > 5`，移除数组头部最早的一条（`toasts.value.shift()`）。
   - 为该 toast 设置独立的 `setTimeout(() => { 从数组中移除该 id 的 toast }, 3000)`。
4. 导出 `toasts`（替换原 `toast`）与 `showToast`。

**向后兼容性**：`showToast(message, type?)` 签名完全不变，所有 18 个调用方无需任何修改。仅 `Toast.vue` 组件需要适配新的 `toasts` 数组。

### 改动 2：`src/shared/components/Toast.vue`（组件渲染改造）

**位置**：整个 `<script setup>`、`<template>`、`<style>`。

**改造内容**：

1. **script**：
   - 移除基于 `appStore.toast.type` 的单个 `iconComponent` / `iconColor` computed。
   - 改为定义一个根据 type 返回图标和颜色的辅助函数（或保留 computed 思路，在模板中通过函数调用），供 `v-for` 中每条 toast 使用。

2. **template**：
   - 外层容器改为一个固定定位的 wrapper（`position: fixed; top; left: 50%; transform: translateX(-50%)`），内部用 `<TransitionGroup name="toast" tag="div" class="toast-stack">` 渲染列表。
   - `v-for="item in appStore.toasts" :key="item.id"` 遍历，每条渲染独立的 `.toast` 元素（含图标 + 消息）。
   - 移除外层 `v-if`，改由 `v-for` 驱动（数组为空时自然不渲染）。

3. **style**：
   - `.toast-stack`：`display: flex; flex-direction: column; gap: var(--spacing-sm); align-items: center;`（垂直堆叠 + 间距）。
   - 单条 `.toast` 样式基本保留（flex 布局、背景、圆角、阴影、边框、min/max-width）。
   - 动画调整：`<TransitionGroup>` 的 `toast-enter-active` / `toast-leave-active` 需适配列表场景。由于每条 toast 现在不再需要 `translateX(-50%)`（居中由父容器 `align-items: center` + 父容器自身 `translateX(-50%)` 完成），动画 keyframes 改为仅 `translateY` + `opacity` + `scale`，移除 `translateX(-50%)`。
   - `toast-leave-active` 需配合 `position: absolute` 或保持文档流以实现平滑移除动画（TransitionGroup 推荐做法：离开项设 `position: absolute` 让后续项平滑上移，但会破坏居中。权衡后采用保持文档流 + 简单淡出，接受移除时下方 toast 瞬间上移的轻微跳动，优先保证居中正确）。

### 改动 3：`src/style.css`（GPU 加速规则适配）

**位置**：第 146-147 行的 `.toast-container, .toast` 选择器。

**改造内容**：将选择器中的 `.toast-container` 更新为新结构对应的选择器（如 `.toast-stack, .toast`），保持 GPU 加速规则不变。

## 四、假设与决策

1. **不引入 composable 封装**：用户仅要求优化堆叠逻辑，不主动重构调用方式，保持 `useAppStore().showToast()` 的现有调用模式。
2. **不新增手动关闭/hover 暂停/进度条**：超出本次需求范围，避免过度设计。
3. **不补充 `toast-success/error/info` 的背景色样式**：这是既有问题，与本次堆叠优化无关，保持现状（仅图标区分类型）。
4. **id 计数器**：使用 store 内部的 `let toastId = 0` 自增，简单可靠，无需考虑持久化。
5. **移除最早 toast 的策略**：当超过 5 条时 `shift()` 移除数组头部，被移除的 toast 会触发 leave 动画（TransitionGroup 支持）。
6. **动画居中处理**：父容器 `.toast-stack` 负责 `translateX(-50%)` 居中，子 toast 不再各自 `translateX(-50%)`，避免动画中的 transform 冲突。

## 五、验证步骤

1. **类型检查**：运行 `npm run typecheck`（或项目对应的 vue-tsc 命令），确认 `toasts` 类型变更无 TS 错误。
2. **Lint 检查**：运行 `npm run lint`，确认代码风格通过。
3. **功能手动验证**（启动 dev server 后）：
   - 单条 toast 正常显示与消失。
   - 连续快速触发多条 toast（如连续调用 3 次 `showToast`），验证它们垂直堆叠且各自独立 3 秒后消失。
   - 触发超过 5 条，验证最早的一条被移除，始终最多显示 5 条。
   - 验证前一个 toast 的定时器不再影响后一个 toast 的显示时长（修复的核心 Bug）。
4. **回归验证**：抽查 1-2 个调用方（如 `InventoryView.vue` 的成功/错误提示），确认 API 调用无需改动且行为正常。
