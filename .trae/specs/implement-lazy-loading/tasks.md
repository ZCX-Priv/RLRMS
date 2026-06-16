# Tasks

- [x] Task 1: 优化客户端视图组件的懒加载
  - [x] SubTask 1.1: HomeView.vue - 将 TableSelectModal、ConfirmDialog 改为异步组件
  - [x] SubTask 1.2: OrderConfirmView.vue - 将 TableSelectModal 改为异步组件
  - [x] SubTask 1.3: SearchView.vue - 将 ConfirmDialog 改为异步组件
  - [x] SubTask 1.4: DishDetailView.vue - 将 Modal 改为异步组件
  - [x] SubTask 1.5: OrderDetailView.vue - 将 Modal 改为异步组件
  - [x] SubTask 1.6: SettingsView.vue - 将 Modal 改为异步组件

- [x] Task 2: 优化管理端视图组件的懒加载
  - [x] SubTask 2.1: DashboardView.vue - 将 Modal、ConfirmDialog 改为异步组件
  - [x] SubTask 2.2: DishesView.vue - 将 Modal、ConfirmDialog 改为异步组件
  - [x] SubTask 2.3: TablesView.vue - 将 Modal、ConfirmDialog 改为异步组件
  - [x] SubTask 2.4: InventoryView.vue - 将 Modal、ConfirmDialog 改为异步组件
  - [x] SubTask 2.5: OrdersView.vue - 将 Modal 改为异步组件（代码已注释，无需修改）
  - [x] SubTask 2.6: SettingsView.vue - 将 Modal 改为异步组件

- [x] Task 3: 优化客户端组件的懒加载
  - [x] SubTask 3.1: DishCard.vue - 将 Modal 改为异步组件
  - [x] SubTask 3.2: CartDrawer.vue - 检查是否有可懒加载的组件（无需修改）

- [x] Task 4: 验证懒加载实现
  - [x] SubTask 4.1: 运行构建检查包大小变化
  - [x] SubTask 4.2: 测试各页面功能正常
  - [x] SubTask 4.3: 验证组件加载时无闪烁或错误

# Task Dependencies
- [Task 4] depends on [Task 1, Task 2, Task 3]
- [Task 1, Task 2, Task 3] 可以并行执行
