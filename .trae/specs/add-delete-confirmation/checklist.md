# Checklist

## 组件实现
- [x] ConfirmDialog 组件已创建，支持标题、内容、取消/确认按钮
- [x] ConfirmDialog 组件支持自定义确认按钮类型（danger/warning/primary）
- [x] ConfirmDialog 组件动画效果与现有 Modal 组件一致

## 管理端确认弹窗
- [x] DishesView.vue - 删除菜品时弹出确认弹窗
- [x] DishesView.vue - 删除分类时弹出确认弹窗
- [x] TablesView.vue - 删除桌位时弹出确认弹窗
- [x] InventoryView.vue - 删除库存物料时弹出确认弹窗
- [x] DashboardView.vue - 清空订单时弹出确认弹窗

## 客户端确认弹窗
- [x] SearchView.vue - 清空搜索历史时弹出确认弹窗
- [x] HomeView.vue - 移除购物车商品时弹出确认弹窗

## 功能验证
- [x] 点击取消按钮或遮罩层时，弹窗关闭且不执行删除操作
- [x] 点击确认按钮时，弹窗关闭并执行删除操作
- [x] 所有确认弹窗提示信息清晰明确
