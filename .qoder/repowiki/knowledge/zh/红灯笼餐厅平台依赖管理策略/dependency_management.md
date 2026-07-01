## 1. 核心系统与工具
该项目采用 **Node.js (npm)** 作为唯一的包管理器，通过 `package.json` 统一管理前端（Vue 3）和后端（Express）的依赖。项目属于 Monorepo 架构，但未使用 Lerna 或 Turborepo 等复杂的多包管理工具，而是通过 Vite 中间件模式在开发期统一服务，简化了依赖拓扑。

- **包管理器**: npm (v7+，支持 lockfile v2)
- **锁文件**: `package-lock.json` 用于确保依赖版本的确定性安装。
- **运行时**: Node.js 20 (基于 Alpine 的 Docker 镜像)。

## 2. 关键文件与配置
- **`package.json`**: 
  - 定义了所有生产依赖（如 `express`, `vue`, `pinia`, `sql.js`）和开发依赖（如 `typescript`, `vite`, `tsx`）。
  - 包含构建脚本：`build:production` 调用自定义脚本 `scripts/build-production.mjs` 协调前后端构建。
- **`package-lock.json`**: 锁定依赖树，确保在不同环境（开发、CI、生产）中安装的包版本一致。
- **`Dockerfile`**: 
  - 采用多阶段构建（Multi-stage build）。
  - **Builder 阶段**: 安装所有依赖并执行完整构建。
  - **Runner 阶段**: 仅复制 `package.json` 和 `package-lock.json`，运行 `npm ci --omit=dev` 安装生产依赖，显著减小镜像体积并提高安全性。
- **`server/tsconfig.json` & `tsconfig.json`**: 配置 TypeScript 编译选项，其中 `skipLibCheck: true` 加速了包含大量类型定义的第三方库的编译过程。

## 3. 架构与约定
- **单一依赖源**: 前后端共享同一个 `node_modules` 目录。这种约定简化了本地开发环境的初始化（只需运行一次 `npm install`），但也要求开发者注意命名冲突（目前通过路径隔离解决）。
- **生产环境优化**: 
  - 在生产部署时，通过 `npm ci --omit=dev` 排除测试工具和构建工具（如 `vite`, `vue-tsc`）。
  - 使用 `cross-env` 处理跨平台的环境变量设置，确保 Windows 和 Linux/macOS 下的启动脚本兼容性。
- **数据库依赖**: 使用 `sql.js` 将 SQLite 运行在内存/文件中，避免了系统级数据库驱动的依赖，使得应用具有极高的可移植性。

## 4. 开发者规范
- **依赖安装**: 必须使用 `npm install` 更新 `package-lock.json`。禁止手动修改锁文件。
- **版本控制**: `package-lock.json` 必须提交到版本控制系统，以保证团队协作和 CI/CD 的一致性。
- **新增依赖**: 
  - 生产依赖使用 `npm install <pkg>`。
  - 开发依赖使用 `npm install -D <pkg>`。
  - 需注意区分前后端共用的依赖（如 `zod`, `uuid`）与仅单端使用的依赖，避免不必要的体积膨胀。
- **构建一致性**: 本地构建应优先使用 `npm run build:production` 脚本，以确保前后端资源按预期整合。