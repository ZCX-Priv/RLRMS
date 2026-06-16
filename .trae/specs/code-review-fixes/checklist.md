# Checklist

## 服务启动性能 (高优先级)
- [x] bcrypt.hashSync 改为异步 bcrypt.hash()
- [x] 数据库初始化使用批量写入
- [x] 减少初始化时的磁盘 I/O 操作

## 首页加载性能 (高优先级)
- [x] index.html 添加内联加载指示器
- [x] 替换 Google Fonts 为国内可访问的字体源
- [x] 字体加载使用 font-display: swap

## 安全性
- [x] JWT_SECRET 不再硬编码，从环境变量读取
- [x] 创建了 .env.example 示例配置文件
- [x] 添加了 dotenv 依赖

## 输入验证
- [x] 创建了 Zod 验证 schema
- [x] 订单创建接口添加了输入验证
- [x] 管理端接口添加了输入验证

## 数据库性能
- [x] 实现了批量写入函数 runBatch()
- [x] 重置数据库操作使用事务
- [x] 清空订单操作使用事务

## 类型安全
- [x] requireAuth 中间件使用正确的 Express 类型
- [x] 无 TypeScript 类型错误

## 代码复用
- [x] formatDateTime 函数提取到共享模块
- [x] 所有路由使用共享的格式化函数

## 请求管理
- [x] API 请求支持 AbortController 取消
- [x] 轮询在页面隐藏时暂停

## 错误处理
- [x] 添加了全局错误处理中间件
- [x] 添加了请求超时处理
