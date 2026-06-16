# 类型安全与 API 一致性修复规范

## Why
项目存在多处类型安全问题、API 响应不一致、运行时错误风险和安全隐患，需要进行系统性修复以提高代码健壮性和安全性。

## What Changes
- 修复 `any` 类型滥用，使用具体类型
- 统一 API 响应结构
- 添加空值检查和安全的数组访问
- 安全处理 JSON.parse 操作
- 添加登录速率限制
- 移除未使用代码
- 统一错误处理

## Impact
- Affected specs: 安全性、类型安全、API 一致性
- Affected code:
  - `server/src/routes/admin.ts` - 类型断言、输入验证
  - `server/src/routes/auth.ts` - 速率限制、错误处理
  - `server/src/routes/dishes.ts` - JSON.parse 安全处理
  - `server/src/routes/orders.ts` - 错误处理
  - `src/api/index.ts` - 错误类型
  - `src/client/views/DishDetailView.vue` - 空值检查
  - `src/client/views/OrderConfirmView.vue` - 类型定义
  - `src/client/views/HomeView.vue` - 类型定义
  - `src/client/components/DishCard.vue` - 数组访问安全
  - `src/admin/views/OrdersView.vue` - 移除未使用代码
  - `src/types/index.ts` - 类型定义完善

## ADDED Requirements

### Requirement: 类型安全增强
系统 SHALL 避免使用 `any` 类型，使用具体类型定义。

#### Scenario: 后端 JWT 解码类型
- **WHEN** 解码 JWT token 时
- **THEN** 应使用完整的类型定义而非部分类型断言

#### Scenario: 前端组件 Props 类型
- **WHEN** 定义组件 Props 时
- **THEN** 应使用具体类型而非 `any`

### Requirement: API 响应结构一致
系统 SHALL 提供统一的 API 响应结构。

#### Scenario: 成功响应
- **WHEN** API 请求成功
- **THEN** 响应应包含 `{ success: true, data: T }` 结构

#### Scenario: 错误响应
- **WHEN** API 请求失败
- **THEN** 响应应包含 `{ success: false, error: string }` 结构

### Requirement: 空值安全处理
系统 SHALL 安全处理可能为空的值。

#### Scenario: 组件空值检查
- **WHEN** 访问可能为空的响应式变量时
- **THEN** 应使用可选链或条件检查，避免非空断言

#### Scenario: 数组访问安全
- **WHEN** 访问数组元素时
- **THEN** 应先检查数组长度或使用可选链

### Requirement: JSON 解析安全
系统 SHALL 安全处理 JSON 解析操作。

#### Scenario: 数据库 JSON 字段解析
- **WHEN** 从数据库读取 JSON 字段时
- **THEN** 应使用 try-catch 包裹 JSON.parse，失败时使用默认值

### Requirement: 登录安全增强
系统 SHALL 防止暴力破解攻击。

#### Scenario: 登录速率限制
- **WHEN** 用户尝试登录时
- **THEN** 应限制同一 IP 的登录尝试频率

### Requirement: 错误处理一致性
系统 SHALL 提供一致的错误处理机制。

#### Scenario: 后端错误日志
- **WHEN** 捕获异常时
- **THEN** 应记录完整的错误信息

#### Scenario: 前端 API 错误
- **WHEN** API 请求失败时
- **THEN** 应返回结构化的错误信息

## MODIFIED Requirements

### Requirement: 输入验证完整性
系统 SHALL 对所有管理端输入进行验证。

- 为 `createDish` 和 `updateDish` 添加 Zod 验证

## REMOVED Requirements

### Requirement: 未使用代码
**Reason**: 代码整洁
**Migration**: 删除 `OrdersView.vue` 中被注释的未使用代码
