# Checklist

## 类型安全 (高优先级)
- [x] 后端 JWT Payload 使用完整类型定义
- [x] 前端组件移除 `any` 类型
- [x] API 错误使用结构化类型
- [x] `createDish` 添加 Zod 验证
- [x] `updateDish` 添加输入验证

## 空值安全 (高优先级)
- [x] `DishDetailView.vue` 中 `dish.value` 使用条件检查
- [x] `DishCard.vue` 中 `specs[0]` 安全访问
- [x] `DishDetailView.vue` 中 `specs[0]` 安全访问

## JSON 解析安全 (中优先级)
- [x] `dishes.ts` 中 JSON.parse 使用 try-catch
- [x] `admin.ts` 中 JSON.parse 使用 try-catch

## 安全增强 (中优先级)
- [x] 登录接口添加速率限制
- [x] 速率限制返回友好错误信息

## 错误处理 (中优先级)
- [x] 后端 catch 块记录完整错误
- [x] 前端 API 保留错误结构

## 代码清理 (低优先级)
- [x] `OrdersView.vue` 移除注释代码
