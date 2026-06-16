# Tasks

- [x] Task 1: 修复 TypeScript 路径别名配置 (高优先级)
  - [x] SubTask 1.1: 在 `tsconfig.app.json` 添加 `baseUrl: "."` 配置
  - [x] SubTask 1.2: 在 `tsconfig.app.json` 添加 `paths: { "@/*": ["src/*"] }` 配置

- [x] Task 2: 修复 router 文件中的未使用变量
  - [x] SubTask 2.1: 在 `src/router/index.ts` 移除或标记未使用的 `state`, `title` 参数
  - [x] SubTask 2.2: 在 `src/router/index.ts` 使用下划线前缀标记 `to`, `from` 参数

- [x] Task 3: 修复 stores 文件中的类型问题
  - [x] SubTask 3.1: 在 `src/stores/cart.ts` 为 reduce/map/filter 回调参数添加类型注解
  - [x] SubTask 3.2: 修复 `src/stores/cart.ts` 中 `setItemsFromOrder` 方法的类型问题

- [x] Task 4: 修复 shared 组件中的未使用导入
  - [x] SubTask 4.1: 在 `src/shared/components/Toast.vue` 移除未使用的 `X` 导入

- [x] Task 5: 修复 client 组件中的问题
  - [x] SubTask 5.1: 在 `src/client/components/ClientLayout.vue` 移除未使用的 `Search`, `Settings`, `router` 导入
  - [x] SubTask 5.2: 在 `src/client/components/DishCard.vue` 修复 `specs[0]` 可能为 undefined 的问题
  - [x] SubTask 5.3: 在 `src/client/components/CartDrawer.vue` 移除未使用的 `computed` 导入
  - [x] SubTask 5.4: 在 `src/client/components/TableSelectModal.vue` 移除未使用的 `X`, `router` 导入

- [x] Task 6: 修复 client views 中的问题
  - [x] SubTask 6.1: 在 `src/client/views/HomeView.vue` 移除未使用导入，修复 undefined 检查，添加类型注解
  - [x] SubTask 6.2: 在 `src/client/views/DishDetailView.vue` 修复 `specs[0]` 可能为 undefined 的问题
  - [x] SubTask 6.3: 在 `src/client/views/OrderConfirmView.vue` 修复 undefined 检查，添加类型注解
  - [x] SubTask 6.4: 在 `src/client/views/OrderDetailView.vue` 移除未使用的 `ChevronRight` 导入
  - [x] SubTask 6.5: 在 `src/client/views/SettingsView.vue` 移除未使用的 `router` 导入

- [x] Task 7: 修复 admin views 中的问题
  - [x] SubTask 7.1: 在 `src/admin/views/DashboardView.vue` 移除未使用导入，修复类型问题
  - [x] SubTask 7.2: 在 `src/admin/views/LayoutView.vue` 移除未使用导入

- [x] Task 8: 验证构建成功
  - [x] SubTask 8.1: 运行 `npm run build` 确认无错误
  - [x] SubTask 8.2: 运行 `npx vue-tsc --noEmit` 确认类型检查通过

# Task Dependencies
- [Task 2-7] depends on [Task 1] (路径别名配置是其他修复的前提) ✅
- [Task 8] depends on [Task 1-7] (验证需要所有修复完成) ✅
