## 1. 核心系统与策略

红灯笼餐厅平台采用**轻量级、代码驱动**的配置管理方案，主要依赖以下机制：
- **环境变量注入**：使用 `dotenv` 库在应用启动时加载根目录下的 `.env` 文件。
- **环境感知逻辑**：通过 `process.env.NODE_ENV` 区分开发（Development）与生产（Production）环境，动态调整中间件行为、CORS 策略及密钥生成方式。
- **数据库即配置**：业务层面的运行时配置（如餐厅名称、营业时间）存储在 SQLite 数据库的 `settings` 表中，而非外部配置文件。
- **构建脚本编排**：通过自定义 Node.js 脚本 (`scripts/build-production.mjs`) 协调前后端构建产物与静态资源的同步。

## 2. 关键配置文件与路径

| 文件路径 | 作用描述 |
| :--- | :--- |
| `.env` | 基础环境变量入口，目前仅定义 `PORT=3000`。 |
| `server/src/index.ts` | 后端配置中枢，负责读取 `NODE_ENV`、`PORT` 并初始化 Express 中间件。 |
| `vite.config.ts` | 前端构建配置，包含代理设置（Proxy）、代码分割（Code Splitting）及生产环境 Console 移除插件。 |
| `ecosystem.config.cjs` | PM2 进程管理配置，定义生产环境的内存限制、日志路径及自动重启策略。 |
| `server/src/utils/jwt.ts` | 密钥管理模块，实现开发环境基于机器指纹派生固定密钥，生产环境支持 `JWT_SECRET` 环境变量。 |
| `server/src/db/init.ts` | 数据库初始化逻辑，负责创建 `settings` 表并填充默认业务配置。 |
| `scripts/build-production.mjs` | 生产构建编排脚本，处理前后端编译及资源目录合并。 |

## 3. 架构设计与约定

### 3.1 环境变量分层
系统不依赖复杂的配置层级，而是通过代码逻辑直接映射环境变量：
- **端口配置**：优先读取 `process.env.PORT`，默认为 `3000`。
- **安全密钥**：
  - **开发模式**：利用 `hostname` 和 `username` 生成 SHA256 哈希作为 `JWT_SECRET`，确保 `tsx watch` 重启后 Token 依然有效。
  - **生产模式**：优先读取 `process.env.JWT_SECRET`；若未设置，则每次启动生成随机密钥（并输出警告），强调生产环境必须显式配置该变量以保证会话持久性。

### 3.2 前后端协同配置
- **开发期**：Vite 配置了 `/api`、`/sources` 等路径的代理，将请求转发至 `localhost:3000`，实现单端口开发体验。
- **生产期**：Express 服务器同时承担 API 服务和静态文件托管职责。`createApp` 函数根据 `isProduction` 标志决定是否启用 CORS 以及是否挂载 `dist` 目录下的前端资源。

### 3.3 业务配置持久化
为了简化部署，系统将易变的业务参数（如餐厅电话、地址）抽象为数据库记录。`initializeDatabase` 会在首次启动或表不存在时自动插入默认值，后续通过 API 接口进行读写。

## 4. 开发者规范与建议

1. **敏感信息管理**：严禁在代码中硬编码 `JWT_SECRET` 或数据库路径。生产部署时，务必在服务器环境中设置 `JWT_SECRET` 环境变量。
2. **环境标识使用**：所有环境相关的逻辑分支必须统一使用 `process.env.NODE_ENV === 'production'` 进行判断，保持行为一致性。
3. **配置扩展原则**：
   - 若需增加服务器级配置（如超时时间、上传限制），应在 `.env` 中添加并在 `server/src/index.ts` 中读取。
   - 若需增加业务级配置（如折扣率、打印设置），应修改 `server/src/db/init.ts` 中的 `defaultSettings` 数组，并通过 `settings` 表进行管理。
4. **构建与部署**：执行 `npm run build:production` 时，脚本会自动处理资源合并。部署时需确保 `public/sources` 和 `server/data` 目录权限正确，以支持图片上传和数据库写入。