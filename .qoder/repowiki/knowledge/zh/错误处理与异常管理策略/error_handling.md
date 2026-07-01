### 1. 核心系统与模式
该项目采用 **Express 全局错误中间件** 结合 **前端自定义 `ApiError` 类** 的全栈错误处理方案。后端通过 Zod 进行严格的输入验证，前端通过统一的 `request` 封装处理 HTTP 状态码与业务逻辑错误。

### 2. 后端错误处理 (Server)
- **全局错误捕获**：在 `server/src/index.ts` 中定义了 Express 错误中间件 `(err, req, res, next) => {}`。它统一拦截未处理的异常，并根据环境（生产/开发）决定是否暴露详细堆栈信息。
- **特定错误映射**：
  - `UnauthorizedError` (来自 `express-jwt`)：自动转换为 401 响应。
  - `ValidationError` (来自 Zod)：自动转换为 400 响应并返回错误消息。
  - 其他未知错误：在生产环境中返回通用的 "Internal server error"，防止敏感信息泄露。
- **路由级容错**：所有路由处理器（如 `dishes.ts`, `orders.ts`）均包裹在 `try...catch` 块中。数据库查询失败或逻辑异常会被捕获并记录到控制台，同时向前端返回标准化的 `{ success: false, error: '...' }` JSON 响应。
- **输入验证**：使用 `Zod` 定义 Schema（`server/src/validators/index.ts`）。在路由入口处调用 `.safeParse()`，若验证失败则立即返回 400 错误，阻止无效数据进入业务逻辑。
- **数据库初始化保护**：在服务器启动时，若数据库初始化失败，会通过 `process.exit(1)` 强制终止进程，防止服务在不一致状态下运行。

### 3. 前端错误处理 (Client)
- **统一请求封装**：`src/api/index.ts` 提供了 `request` 函数。它负责：
  - **超时控制**：默认 30s 超时，超时后抛出 `ApiError`。
  - **非 JSON 响应防御**：检测 `Content-Type`，若非 JSON 则抛出错误，避免解析 HTML 报错页面时产生混淆的 SyntaxError。
  - **401 自动化处理**：检测到 401 状态码时，自动触发 `auth:expired` 自定义事件，通知全局状态管理（Pinia）清除会话并引导用户重新登录。
  - **业务错误转换**：检查响应中的 `success` 字段，若为 `false` 则抛出包含服务端错误信息的 `ApiError`。
- **自定义错误类**：定义了 `ApiError extends Error`，携带 `status` 和 `data` 属性，便于组件层根据错误类型（如网络错误 vs 业务校验错误）展示不同的 UI 提示。
- **会话保活与过期**：`src/stores/auth.ts` 实现了 `startKeepAlive` 机制，定期验证 Token。若验证失败，同样触发全局过期事件，实现多标签页同步登出。

### 4. 开发者规范
- **后端**：不要在路由内部直接发送响应后继续执行；所有异步数据库操作必须包裹在 `try...catch` 中；新增接口必须在 `validators/index.ts` 中定义对应的 Zod Schema。
- **前端**：调用 `api` 方法时应使用 `try...catch` 或 `.catch()` 捕获 `ApiError`；利用 `error.status` 区分处理（如 400 显示表单错误，500 显示通用提示）；不要直接捕获原生 `Error` 而忽略 `ApiError` 的结构化信息。
- **安全**：生产环境下严禁在前端暴露后端堆栈信息；所有涉及金额或权限的操作必须在后端进行二次验证（如 `orders.ts` 中的价格重算），不能信任前端传入的数据。