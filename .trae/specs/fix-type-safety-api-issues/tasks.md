# Tasks

- [x] Task 1: 修复后端类型安全问题 (高优先级)
  - [x] SubTask 1.1: 在 `server/src/routes/admin.ts` 中定义完整的 JWT Payload 类型
  - [x] SubTask 1.2: 在 `server/src/routes/auth.ts` 中定义完整的 JWT Payload 类型
  - [x] SubTask 1.3: 为 `createDish` 添加 Zod 验证（当前缺失）
  - [x] SubTask 1.4: 为 `updateDish` 添加输入验证

- [x] Task 2: 修复前端类型安全问题 (高优先级)
  - [x] SubTask 2.1: 在 `src/client/views/OrderConfirmView.vue` 中将 `any` 改为具体组件类型
  - [x] SubTask 2.2: 在 `src/client/views/HomeView.vue` 中修复 `setSectionRef` 的参数类型
  - [x] SubTask 2.3: 在 `src/api/index.ts` 中添加结构化错误类型

- [x] Task 3: 修复空值安全问题 (高优先级)
  - [x] SubTask 3.1: 在 `src/client/views/DishDetailView.vue` 中添加 `dish.value` 空值检查
  - [x] SubTask 3.2: 在 `src/client/components/DishCard.vue` 中安全访问 `specs[0]`
  - [x] SubTask 3.3: 在 `src/client/views/DishDetailView.vue` 中安全访问 `specs[0]`

- [x] Task 4: 修复 JSON 解析安全问题 (中优先级)
  - [x] SubTask 4.1: 在 `server/src/routes/dishes.ts` 中添加安全的 JSON 解析函数
  - [x] SubTask 4.2: 在 `server/src/routes/admin.ts` 中使用安全的 JSON 解析函数

- [x] Task 5: 添加登录速率限制 (中优先级)
  - [x] SubTask 5.1: 在 `server/src/routes/auth.ts` 中实现基于 IP 的登录速率限制
  - [x] SubTask 5.2: 添加速率限制超限的错误响应

- [x] Task 6: 统一错误处理 (中优先级)
  - [x] SubTask 6.1: 在 `server/src/routes/auth.ts` 的 catch 块中记录完整错误信息
  - [x] SubTask 6.2: 在 `src/api/index.ts` 中保留 API 错误的结构化信息

- [x] Task 7: 代码清理 (低优先级)
  - [x] SubTask 7.1: 清理 `src/admin/views/OrdersView.vue` 中的注释代码

# Task Dependencies
- [Task 4] depends on [Task 1] (先修复类型再处理 JSON)
- [Task 6] depends on [Task 2] (错误处理需要错误类型)
