## 1. 系统/方法概述
该项目未引入专用的日志框架（如 Winston、Pino 等），而是采用**原生 `console` API** 作为唯一的日志输出方式。其核心策略是通过**构建工具插件**在生产环境中静态剥离低级别日志，以平衡开发调试便利性与生产环境的性能及安全性。

- **前端**：依赖 Vite 自定义插件在构建阶段移除 `console.log/info/debug`。
- **后端**：直接使用 Node.js 原生的 `console.log` 和 `console.error` 输出到标准流（stdout/stderr）。

## 2. 关键文件与位置
- **前端构建配置**：[`vite.config.ts`](file:///c:/Users/LX/Desktop/RLRMS/vite.config.ts)
  - 定义了 `removeConsolePlugin`，在生产模式（`mode === 'production'`）下通过正则表达式替换移除代码中的 `console.log`、`console.info` 和 `console.debug`。
- **后端入口与初始化**：
  - [`server/src/index.ts`](file:///c:/Users/LX/Desktop/RLRMS/server/src/index.ts)：包含全局错误处理中间件，使用 `console.error` 记录异常堆栈。
  - [`server/src/db/init.ts`](file:///c:/Users/LX/Desktop/RLRMS/server/src/db/init.ts)：在数据库表创建、默认管理员生成及数据迁移时使用 `console.log` 输出进度信息。
- **构建脚本**：[`scripts/build-production.mjs`](file:///c:/Users/LX/Desktop/RLRMS/scripts/build-production.mjs)：使用 `console.log` 输出构建过程的提示信息。

## 3. 架构与约定
### 3.1 日志级别策略
- **INFO/DEBUG**：使用 `console.log`。主要用于开发阶段的流程追踪、数据库初始化状态确认以及构建脚本的输出。
- **ERROR**：使用 `console.error`。用于后端全局错误捕获、数据库初始化失败等严重异常的记录。
- **WARN**：保留 `console.warn`。前端的构建插件特意保留了 `warn` 和 `error`，确保生产环境仍能感知潜在问题。

### 3.2 结构化与路由
- **非结构化输出**：所有日志均为纯文本字符串，未采用 JSON 等结构化格式，也未包含 Trace ID 或 Request ID 等关联字段。
- **输出路由**：
  - 开发环境：直接输出至终端控制台。
  - 生产环境：依赖容器化部署（Docker）或进程管理器（PM2）收集标准输出流。后端在 Windows 环境下启动时会尝试执行 `chcp 65001` 以确保 UTF-8 编码支持。

## 4. 开发者规范
- **前端开发**：可以随意使用 `console.log` 进行调试，无需手动清理，构建系统会自动处理。
- **后端开发**：
  - 仅在关键生命周期节点（如服务启动、DB 初始化）或异常处理中使用 `console`。
  - 避免在高频请求路径（如 API 路由处理函数）中打印日志，以免在高并发下产生性能瓶颈。
- **敏感信息保护**：由于缺乏自动脱敏机制，严禁在日志中打印用户密码、Token 或个人隐私信息。
- **错误记录**：在后端捕获错误时，应优先使用 `console.error` 并打印 `err.stack` 以便定位问题根源。