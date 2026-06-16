# 删除操作确认弹窗 Spec

## Why
当前系统中所有删除操作（删除菜品、分类、桌位、库存、清空订单、清空搜索历史、移除购物车商品等）都没有确认步骤，用户误点击会直接执行删除，可能导致数据丢失且无法恢复。需要为所有删除操作添加确认弹窗，防止误操作。

## What Changes
- 创建可复用的确认弹窗组件 `ConfirmDialog.vue`
- 为管理端所有删除操作添加确认弹窗
- 为客户端所有删除操作添加确认弹窗

## Impact
- Affected specs: 用户体验、数据安全
- Affected code:
  - `src/shared/components/ConfirmDialog.vue` (新建)
  - `src/admin/views/DishesView.vue`
  - `src/admin/views/TablesView.vue`
  - `src/admin/views/InventoryView.vue`
  - `src/admin/views/DashboardView.vue`
  - `src/client/views/SearchView.vue`
  - `src/client/views/HomeView.vue`

## ADDED Requirements

### Requirement: 删除确认弹窗组件
系统应提供一个可复用的确认弹窗组件，用于所有需要用户确认的操作。

#### Scenario: 显示确认弹窗
- **WHEN** 触发需要确认的操作
- **THEN** 显示确认弹窗，包含标题、提示信息、取消按钮和确认按钮

#### Scenario: 用户取消操作
- **WHEN** 用户点击取消按钮或点击遮罩层
- **THEN** 关闭弹窗，不执行任何操作

#### Scenario: 用户确认操作
- **WHEN** 用户点击确认按钮
- **THEN** 关闭弹窗并执行对应操作

### Requirement: 管理端删除确认
管理端所有删除操作应弹出确认弹窗。

#### Scenario: 删除菜品确认
- **WHEN** 管理员点击删除菜品按钮
- **THEN** 弹出确认弹窗，提示"确定要删除该菜品吗？"

#### Scenario: 删除分类确认
- **WHEN** 管理员点击删除分类按钮
- **THEN** 弹出确认弹窗，提示"确定要删除该分类吗？"

#### Scenario: 删除桌位确认
- **WHEN** 管理员点击删除桌位按钮
- **THEN** 弹出确认弹窗，提示"确定要删除该桌位吗？"

#### Scenario: 删除库存物料确认
- **WHEN** 管理员点击删除库存物料按钮
- **THEN** 弹出确认弹窗，提示"确定要删除该物料吗？"

#### Scenario: 清空订单确认
- **WHEN** 管理员点击清空订单按钮
- **THEN** 弹出确认弹窗，提示"确定要清空所有订单吗？此操作不可恢复！"

### Requirement: 客户端删除确认
客户端所有删除操作应弹出确认弹窗。

#### Scenario: 清空搜索历史确认
- **WHEN** 用户点击清空搜索历史按钮
- **THEN** 弹出确认弹窗，提示"确定要清空搜索历史吗？"

#### Scenario: 移除购物车商品确认
- **WHEN** 用户点击移除购物车商品按钮
- **THEN** 弹出确认弹窗，提示"确定要从购物车移除该商品吗？"
