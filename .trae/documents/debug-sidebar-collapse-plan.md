# 调试工具菜单自动收起计划

## 摘要
修改 `LayoutView.vue` 中监听路由的 watch 逻辑：当用户切换到非调试工具页面时，自动收起「调试工具」折叠子菜单。

## 当前状态分析

### 侧边栏菜单状态（`src/admin/views/LayoutView.vue`）
- `debugMenuExpanded` 控制「调试工具」子菜单的展开/收起。
- 当前 watch 仅在进入 `/admin/debug/*` 路由时将其设为 `true`，没有在其他路由下将其收起的逻辑。
- 因此用户点击其他导航项（如首页、桌位管理等）后，调试工具子菜单仍保持展开，占用侧边栏空间。

## 变更方案

### 1. 调整 `src/admin/views/LayoutView.vue`

#### 目标
- 进入 `/admin/debug/*` 路由时，调试工具子菜单自动展开。
- 切换到任何非 `/admin/debug/*` 路由时，调试工具子菜单自动收起。

#### 具体修改
- 将现有的 watch 逻辑：
  ```ts
  watch(
    () => route.path,
    (newPath) => {
      if (newPath.startsWith('/admin/debug')) {
        debugMenuExpanded.value = true
      }
    },
    { immediate: true }
  )
  ```
  简化为：
  ```ts
  watch(
    () => route.path,
    (newPath) => {
      debugMenuExpanded.value = newPath.startsWith('/admin/debug')
    },
    { immediate: true }
  )
  ```
- 这样 `debugMenuExpanded` 始终与当前是否处于调试路由保持同步。

### 2. 不修改的内容
- 父项点击导航到 `/admin/debug/sql` 的逻辑保持不变。
- 箭头 `@click.stop="toggleDebugMenu()"` 保持不变（仍可在当前页手动收起/展开）。
- 子项样式、圆角短柱、`DebugView.vue` 标题逻辑保持不变。
- 不新增组件或文件。

## 假设与决策

- 用户期望调试工具子菜单的展开状态严格跟随当前路由：在调试页面展开，离开调试页面收起。
- 保留箭头手动 toggle 能力，以便在调试页面内快速收起/展开而不跳转。

## 验证步骤

1. 从非 debug 页面点击「调试工具」：
   - 父项高亮，子菜单展开，页面跳转到 `/admin/debug/sql`。
2. 点击侧边栏「首页」或其他非调试项：
   - 页面跳转后，「调试工具」子菜单自动收起。
   - 父项红色高亮消失。
3. 再次点击「调试工具」：
   - 子菜单重新展开，父项恢复高亮。
