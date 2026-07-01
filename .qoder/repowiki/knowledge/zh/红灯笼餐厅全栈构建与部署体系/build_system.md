## 1. 核心构建系统
项目采用 **Node.js (npm)** 作为基础包管理与构建工具，结合 **Vite**（前端）和 **TypeScript Compiler (tsc)**（后端）实现前后端分离构建。

- **前端构建**：使用 `vue-tsc` 进行类型检查，随后通过 `vite build` 打包 Vue 3 应用。配置了精细的代码分割策略（如将图标库独立为 `vendor-icons`），并在生产模式下自动移除 `console.log` 等调试信息。
- **后端构建**：通过 `tsc -p server/tsconfig.json` 将 TypeScript 源码编译为 JavaScript 运行在 Node.js 环境中。
- **统一构建脚本**：提供 `scripts/build-production.mjs` 脚本，一键执行前后端构建并整理生产环境所需的目录结构（包括静态资源、数据库文件等）。

## 2. 容器化与编排
项目提供了完整的 **Docker** 支持，采用多阶段构建（Multi-stage Build）以优化镜像体积。

- **Dockerfile**：
  - **Builder 阶段**：基于 `node:20-alpine`，安装所有依赖并执行 `build:production`。
  - **Runner 阶段**：仅复制生产依赖和构建产物，创建非 root 用户 `appuser` 运行服务，并配置了健康检查（Healthcheck）和资源限制。
- **Docker Compose**：定义了 `red-lantern` 服务，实现了数据卷持久化（数据库、日志、图片）、环境变量注入以及自动重启策略。

## 3. 进程管理与自动化运维
针对生产环境，项目提供了多种启动与管理方案：

- **PM2 托管**：通过 `ecosystem.config.cjs` 配置，支持内存限制（500M）、自动重启及日志轮转。`start.sh` 脚本会自动检测 PM2 并优先使用其管理服务。
- **一键安装/启动脚本**：提供跨平台的 `install.sh/bat` 和 `start.sh/bat`。这些脚本不仅负责环境检查（Node.js 版本、端口占用），还集成了 **Nginx/Apache** 反向代理的自动配置功能，能根据系统类型自动生成并启用 Web 服务器配置。

## 4. 开发体验
- **Vite 中间件模式**：在开发环境下，通过 `tsx watch server/src/dev.ts` 启动一个统一的 Express 服务，利用 Vite 中间件处理前端资源，同时代理 API 请求到后端逻辑，实现了前后端联调的无缝体验。
- **热更新**：前端享受 Vite 的 HMR，后端通过 `tsx watch` 实现代码变更自动重启。

## 5. 开发者规范
- **构建命令**：开发使用 `npm run dev`，生产构建使用 `npm run build:production`。
- **环境配置**：敏感配置（如 JWT Secret、端口）应通过 `.env` 文件管理，严禁硬编码。
- **部署建议**：推荐使用 Docker Compose 进行标准化部署；若直接部署，建议使用 `install.sh` 完成初始化并配合 PM2 保证服务稳定性。