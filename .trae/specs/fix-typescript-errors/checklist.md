# Checklist

## TypeScript 配置
- [x] tsconfig.app.json 包含 baseUrl 配置
- [x] tsconfig.app.json 包含 paths 配置映射 @/* 到 src/*

## Router 文件
- [x] src/router/index.ts 无未使用变量警告

## Stores 文件
- [x] src/stores/cart.ts 所有回调参数有显式类型
- [x] src/stores/auth.ts 无类型错误
- [x] src/stores/table.ts 无类型错误

## Shared 组件
- [x] src/shared/components/Toast.vue 无未使用导入

## Client 组件
- [x] src/client/components/ClientLayout.vue 无未使用导入
- [x] src/client/components/DishCard.vue 无 undefined 类型错误
- [x] src/client/components/CartDrawer.vue 无未使用导入
- [x] src/client/components/TableSelectModal.vue 无未使用导入

## Client Views
- [x] src/client/views/HomeView.vue 无未使用导入，无 undefined 错误
- [x] src/client/views/DishDetailView.vue 无 undefined 类型错误
- [x] src/client/views/OrderConfirmView.vue 无 undefined 错误
- [x] src/client/views/OrderDetailView.vue 无未使用导入
- [x] src/client/views/SettingsView.vue 无未使用导入

## Admin Views
- [x] src/admin/views/DashboardView.vue 无未使用导入，无类型错误
- [x] src/admin/views/LayoutView.vue 无未使用导入

## 构建验证
- [x] npm run build 成功完成，无错误
- [x] npx vue-tsc --noEmit 无类型错误
