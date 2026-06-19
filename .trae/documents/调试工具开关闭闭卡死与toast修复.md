# 调试工具开关闭闭卡死与 toast 修复

## 摘要

修复两个问题：
1. 关闭开关时没有 toast——用户期望关闭时也有 toast 反馈。
2. 开关卡死在开启位置无法关闭——根因是 `@click.prevent` 让开关视觉完全依赖 store 响应式更新，HMR 未完全生效时 `setDevMode(false)` 未触发响应式，`:checked` 不更新，浏览器原生切换又被阻止，导致卡死。

## 当前状态分析

### 问题1：关闭时没有 toast

[SettingsView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/views/SettingsView.vue#L52-L61) 第 52-61 行 `handleDevModeClick`：

```ts
function handleDevModeClick() {
  if (appStore.devMode) {
    appStore.setDevMode(false)   // 关闭时只有 setDevMode，没有 toast
  } else {
    showDevModeConfirm.value = true
  }
}
```

关闭分支只调用 `setDevMode(false)`，没有 `showToast`。用户期望关闭时也有 toast 反馈。

### 问题2：开关卡死在开启位置

[SettingsView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/views/SettingsView.vue#L366-L373) 第 366-373 行模板：

```vue
<input
  type="checkbox"
  :checked="appStore.devMode"
  @click.prevent="handleDevModeClick"
/>
```

**卡死机制**：
1. `@click.prevent` 阻止 checkbox 原生切换行为（checked 不变）
2. 开关视觉**完全依赖** `:checked="appStore.devMode"` 的响应式更新
3. 用户点击关闭 → `handleDevModeClick` 调用 `appStore.setDevMode(false)`
4. 若 HMR 未完全生效，store 实例为旧结构，`setDevMode` 可能不是函数（抛 TypeError）或操作的 `devMode` 不是响应式 ref
5. `devMode.value` 未变化 → `:checked` 不更新 → 开关保持开启 → **卡死**
6. 由于 `@click.prevent` 阻止了浏览器原生切换，没有后备机制让开关视觉变化

**核心问题**：`@click.prevent` 把开关视觉完全绑定到 store 响应式，一旦 store 有任何问题就卡死。

## 提议的改动

### 改动1：改用按需 preventDefault 的方案（SettingsView.vue）

**文件**：[src/admin/views/SettingsView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/views/SettingsView.vue)

**做什么**：
1. 模板：将 `@click.prevent="handleDevModeClick"` 改为 `@click="handleDevModeClick"`（去掉 `.prevent` 修饰符）。
2. 脚本：`handleDevModeClick` 接收事件参数 `e: Event`，按分支决定是否 `preventDefault`：
   - **关闭分支**（`appStore.devMode` 为 true）：**不** preventDefault，让浏览器原生切换 checkbox（true→false），同时调用 `setDevMode(false)` + `showToast('已禁用调试工具', 'success')`。
   - **开启分支**（`appStore.devMode` 为 false）：**调用** `e.preventDefault()` 阻止切换（开关保持关闭），弹出确认弹窗。

**为什么**：
- 关闭时不 preventDefault，让浏览器原生切换 checkbox 视觉（true→false）。即使 store 因 HMR 有问题，浏览器也会切换开关视觉，**不会卡死**。同时 `setDevMode(false)` 同步 store，`:checked` 在 nextTick 一致。
- 开启时 preventDefault，阻止浏览器切换（开关保持关闭），弹确认。确认后 `setDevMode(true)`，`:checked` 变 true，开关打开。开启时 preventDefault 不会卡死，因为确认后 store 一定被正确调用（confirmDevMode 中 setDevMode + showToast）。
- 关闭时加 toast，满足用户"关闭时也要有 toast"的期望。

**怎么做**：

模板（第 366-373 行）：
```vue
<label class="toggle-switch">
  <input
    type="checkbox"
    :checked="appStore.devMode"
    @click="handleDevModeClick"
  />
  <span class="toggle-slider"></span>
</label>
```

脚本（替换第 52-61 行）：
```ts
// 开关点击处理：关闭时直接生效（含 toast），开启时弹出确认（开关保持关闭）
function handleDevModeClick(e: Event) {
  if (appStore.devMode) {
    // 当前开启，点击则直接关闭：让浏览器正常切换，同时更新 store + toast
    appStore.setDevMode(false)
    appStore.showToast('已禁用调试工具', 'success')
  } else {
    // 当前关闭，点击则弹出确认：阻止切换，保持关闭状态
    e.preventDefault()
    showDevModeConfirm.value = true
  }
}
```

### 改动2：重启 dev server（解决 HMR 残留）

**不涉及代码修改**。上一轮 app.ts 的结构性改动（`toasts` 数组、`devMode`/`setDevMode`/`loadDevMode`）可能仍未在 store 实例中完全生效。

**操作**：停止当前 dev server，重新运行 `npm run dev`，让 store 从零初始化。

**为什么**：新方案虽然关闭时不依赖 store 响应式（浏览器原生切换作为后备），但侧边栏的实时联动仍依赖 store 响应式。重启 dev server 确保 store 实例为新版，侧边栏能正确响应 `devMode` 变化。

## 假设与决策

1. **关闭时不 preventDefault**：让浏览器原生切换 checkbox 作为视觉后备，避免 store 问题时卡死。这是解决"卡死"的核心。
2. **开启时仍 preventDefault**：保持开关在关闭状态，弹确认。开启时 preventDefault 不会卡死，因为确认后 `confirmDevMode` 一定调用 `setDevMode(true)`。
3. **关闭时 toast 类型用 success**：与开启时（"已启用调试工具" success）保持一致，表示操作成功完成。消息"已禁用调试工具"。
4. **confirmDevMode 不改**：`setDevMode(true)` 与 `showToast` 同步调用、同时生效，已满足要求。
5. **仍需重启 dev server**：新方案让关闭操作不卡死，但侧边栏实时联动仍需 store 为新版。

## 验证步骤

1. **重启 dev server**：停止当前 `npm run dev`，重新运行 `npm run dev`。
2. **登录管理后台**，进入"系统设置"页面。
3. **测试开启开关**：
   - 点击开关（关闭状态）→ 开关保持关闭 → 弹出确认框。
   - 点击"启用" → 弹窗关闭 → 显示 success toast"已启用调试工具" + 开关打开 + 侧边栏出现"调试工具"。
4. **测试关闭开关**（问题1+2修复）：
   - 点击开关（开启状态）→ **不卡死**，开关变为关闭 → 显示 success toast"已禁用调试工具" + 侧边栏"调试工具"消失。
5. **测试取消确认**：
   - 点击开关（关闭状态）→ 弹确认 → 点"取消" → 弹窗关闭，开关保持关闭。
6. **测试刷新持久化**：
   - 启用后刷新 → 开关仍开启，侧边栏仍有"调试工具"。
7. **类型检查**：运行 `npx vue-tsc -p tsconfig.app.json --noEmit` 确认无新增类型错误。

## 涉及文件清单

| 文件 | 改动类型 |
|---|---|
| [src/admin/views/SettingsView.vue](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/src/admin/views/SettingsView.vue) | 模板 `@click.prevent` 改为 `@click`；handleDevModeClick 加事件参数，关闭分支加 toast，开启分支加 preventDefault |
| 无（其他文件） | 代码逻辑正确，仅需重启 dev server |
