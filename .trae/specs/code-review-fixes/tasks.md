# Tasks

- [x] Task 1: 优化服务启动性能 (高优先级)
  - [x] SubTask 1.1: 修改 `server/src/db/init.ts`，使用异步 bcrypt.hash() 替代同步版本
  - [x] SubTask 1.2: 在 `server/src/db/index.ts` 添加延迟保存机制，减少初始化时的磁盘 I/O
  - [x] SubTask 1.3: 优化数据库初始化，合并多个 CREATE TABLE 语句为批量执行

- [x] Task 2: 优化首次页面加载性能 (高优先级)
  - [x] SubTask 2.1: 在 `index.html` 添加内联加载指示器，避免白屏
  - [x] SubTask 2.2: 替换 Google Fonts 为国内可访问的字体源（使用 bootcdn 或系统字体回退）
  - [x] SubTask 2.3: 优化字体加载策略，使用 font-display: swap

- [x] Task 3: 修复安全性问题
  - [x] SubTask 3.1: 创建环境变量配置文件 `.env.example`，定义 JWT_SECRET 等敏感配置
  - [x] SubTask 3.2: 修改 `server/src/routes/admin.ts` 和 `server/src/routes/auth.ts`，从环境变量读取 JWT_SECRET
  - [x] SubTask 3.3: 添加 dotenv 依赖并在服务器启动时加载环境变量

- [x] Task 4: 添加后端输入验证
  - [x] SubTask 4.1: 创建 `server/src/validators/` 目录，定义 Zod schema 用于验证请求参数
  - [x] SubTask 4.2: 在 `server/src/routes/orders.ts` 添加订单创建验证中间件
  - [x] SubTask 4.3: 在 `server/src/routes/admin.ts` 添加管理端请求验证中间件

- [x] Task 5: 优化数据库性能
  - [x] SubTask 5.1: 在 `server/src/db/index.ts` 添加批量写入支持 `runBatch()` 函数
  - [x] SubTask 5.2: 修改 `server/src/routes/admin.ts` 的重置数据库和清空订单接口使用事务

- [x] Task 6: 修复类型定义问题
  - [x] SubTask 6.1: 修复 `server/src/routes/admin.ts` 中 `requireAuth` 中间件的类型定义
  - [x] SubTask 6.2: 添加全局类型声明文件解决 TypeScript 类型错误

- [x] Task 7: 提取重复代码
  - [x] SubTask 7.1: 创建 `server/src/utils/format.ts`，提取 `formatDateTime` 函数
  - [x] SubTask 7.2: 更新 `server/src/routes/admin.ts` 和 `server/src/routes/orders.ts` 使用共享的格式化函数

- [x] Task 8: 优化前端请求管理
  - [x] SubTask 8.1: 在 `src/api/index.ts` 添加 AbortController 支持
  - [x] SubTask 8.2: 在 `src/shared/composables/useOrderPolling.ts` 添加页面可见性检测

- [x] Task 9: 优化错误处理
  - [x] SubTask 9.1: 在 `server/src/index.ts` 添加全局错误处理中间件
  - [x] SubTask 9.2: 在 `src/api/index.ts` 添加请求超时处理

# Task Dependencies
- [Task 3] depends on [Task 1] (先优化启动再添加配置) ✅
- [Task 5] depends on [Task 7] (批量写入需要使用共享工具) ✅
- [Task 9] depends on [Task 8] (错误处理需要请求管理支持) ✅
