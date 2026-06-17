# 修复 `Failed to fetch data: SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON`

## 问题概述

当通过 Trae IDE 预览（端口 4000）访问前端时，所有 `/api/*` 请求返回的是 `index.html`（HTML）而非 JSON，导致前端 `response.json()` 解析失败。

## 根因分析

当前项目架构设计为 **Express + Vite 中间件模式**（通过 `npm run dev` 启动 `server/src/dev.ts`），Express 在端口 3000 同时提供 API 和前端服务。

但 **Trae IDE 预览**会独立启动一个 Vite 开发服务器（端口 4000），此 Vite 实例：
1. 不包含 Express 后端 → 无法处理 `/api/*` 请求
2. `vite.config.ts` 中**未配置 proxy** → `/api/*` 请求被 Vite 的 SPA fallback 拦截，返回 `index.html`
3. 前端 `API_BASE = '/api'` 是相对路径 → 请求发到端口 4000，而非后端 3000

**证据链：**
- `.env` 中 `PORT=3000`，但浏览器报错 URL 是 `http://localhost:4000`
- `vite.config.ts` 的 `server` 配置为空（仅有注释），无 proxy 配置
- `src/api/index.ts` 第 52 行 `await response.json()` 收到 `<!doctype html>` 后抛出 SyntaxError
- `server/src/dev.ts` 使用 `middlewareMode: true`，此模式下 `server.proxy` 不生效（仅独立 Vite 生效）

## 修改方案

### 1. 在 `vite.config.ts` 添加 proxy 配置

**文件：** [vite.config.ts](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/vite.config.ts)

**修改位置：** `server` 字段（第 39-42 行）

**原因：** 当 Vite 独立运行（Trae 预览）时，将 `/api`、`/sources`、`/health` 请求代理到 Express 后端（端口 3000）。在 `npm run dev`（中间件模式）下此配置不生效，不影响现有逻辑。

**修改内容：**
```typescript
server: {
  // 端口由 Express 统一控制（Vite 中间件模式）
  // 此配置仅在独立运行 Vite 时生效（如 Trae IDE 预览）
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
    '/sources': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
    '/health': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
},
```

### 2. 新建 `server/src/dev-server.ts` —— 独立运行 Express（无 Vite）

**文件：** `server/src/dev-server.ts`（新建）

**原因：** 当前 `server/src/index.ts` 仅在生产环境启动监听，`server/src/dev.ts` 会同时启动 Express + Vite 中间件。需要一个仅启动 Express（不挂载 Vite）的开发入口，供 Vite 独立运行时作为 proxy 目标。

**内容：**
```typescript
import 'dotenv/config'
import { createApp, initDb } from './index.js'

const PORT = process.env.PORT || 3000

const app = createApp()
const server = app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
  console.log('Database initialization in progress...')
})

initDb(server)
```

### 3. 在 `package.json` 添加 `dev:server` 脚本

**文件：** [package.json](file:///c:/Users/赵晨旭/Desktop/红灯笼食府管理系统/package.json)

**修改位置：** `scripts` 字段（第 6-14 行）

**新增脚本：**
```json
"dev:server": "tsx watch server/src/dev-server.ts"
```

## 使用方式（修复后）

**方式 A — Trae IDE 预览（推荐用于前端开发）：**
1. 终端运行 `npm run dev:server` → 启动 Express API 服务（端口 3000）
2. Trae IDE 预览自动启动 Vite（端口 4000）→ proxy 转发 API 请求到 3000

**方式 B — 完整集成开发（原有方式不变）：**
1. 运行 `npm run dev` → Express + Vite 中间件集成启动（端口 3000）
2. 浏览器访问 `http://localhost:3000`

## 假设与决策

| 决策 | 理由 |
|------|------|
| 使用 Vite proxy 而非修改 `API_BASE` 为绝对 URL | 保持同源 cookie 认证（`credentials: 'include'`），避免 CORS 问题 |
| 新建 `dev-server.ts` 而非修改 `index.ts` | 不影响现有生产环境逻辑和 `dev.ts` 集成模式，职责单一 |
| proxy 目标固定为 `localhost:3000` | 与 `.env` 中 `PORT=3000` 一致；如需修改端口，改 `.env` 即可 |
| `changeOrigin: true` | 确保 Host 头正确，避免后端因 Host 校验拒绝请求 |
| 仅代理 `/api`、`/sources`、`/health` | 这三个是后端处理的路径，其他路径由 Vite 处理（前端源码、HMR 等） |

## 验证步骤

1. **启动 API 服务：** `npm run dev:server` → 控制台应输出 `API server running on http://localhost:3000`
2. **验证 API 可达：** 浏览器访问 `http://localhost:3000/health` → 返回 JSON `{"status":"ok",...}`
3. **验证 Trae 预览：** 通过 Trae IDE 预览打开前端（端口 4000）→ 首页应正常加载菜品数据，控制台无 `SyntaxError`
4. **验证原有方式不受影响：** `npm run dev` → 访问 `http://localhost:3000` → 功能正常
5. **类型检查：** `npm run build`（含 `vue-tsc -b`）→ 无类型错误
