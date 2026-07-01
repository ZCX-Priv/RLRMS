# Express服务器配置

<cite>
**本文档引用的文件**
- [server/src/index.ts](file://server/src/index.ts)
- [server/src/dev-server.ts](file://server/src/dev-server.ts)
- [server/src/dev.ts](file://server/src/dev.ts)
- [server/src/db/index.ts](file://server/src/db/index.ts)
- [server/src/db/init.ts](file://server/src/db/init.ts)
- [server/src/routes/index.ts](file://server/src/routes/index.ts)
- [server/src/routes/auth.ts](file://server/src/routes/auth.ts)
- [server/src/routes/admin.ts](file://server/src/routes/admin.ts)
- [server/src/utils/jwt.ts](file://server/src/utils/jwt.ts)
- [package.json](file://package.json)
- [ecosystem.config.cjs](file://ecosystem.config.cjs)
- [nginx.conf](file://nginx.conf)
- [Dockerfile](file://Dockerfile)
- [scripts/build-production.mjs](file://scripts/build-production.mjs)
- [vite.config.ts](file://vite.config.ts)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介

本项目是一个基于Express.js的餐厅管理系统后端服务器，采用TypeScript编写，集成了现代化的开发工具链和生产部署方案。该服务器配置涵盖了完整的开发环境和生产环境支持，包括数据库初始化、中间件链路、安全响应头设置、健康检查端点以及SPA路由回退机制。

## 项目结构

项目采用模块化架构，主要分为以下几个核心部分：

```mermaid
graph TB
subgraph "服务器层"
A[Express应用]
B[中间件链路]
C[路由系统]
D[数据库层]
end
subgraph "开发环境"
E[Vite中间件]
F[热重载]
G[开发服务器]
end
subgraph "生产环境"
H[Nginx反向代理]
I[Docker容器化]
J[PM2进程管理]
end
subgraph "工具链"
K[TypeScript]
L[Babel/Vite]
M[Webpack打包]
end
A --> B
B --> C
C --> D
E --> A
H --> A
I --> A
J --> A
```

**图表来源**
- [server/src/index.ts:1-171](file://server/src/index.ts#L1-L171)
- [server/src/dev.ts:1-67](file://server/src/dev.ts#L1-L67)

**章节来源**
- [server/src/index.ts:1-171](file://server/src/index.ts#L1-L171)
- [package.json:1-64](file://package.json#L1-L64)

## 核心组件

### 服务器初始化配置

Express服务器采用统一的初始化流程，支持开发和生产两种模式：

```mermaid
flowchart TD
Start([服务器启动]) --> EnvCheck{检查NODE_ENV}
EnvCheck --> |production| ProdConfig[生产环境配置]
EnvCheck --> |development| DevConfig[开发环境配置]
ProdConfig --> CorsCheck{检查CORS设置}
CorsCheck --> |启用| CorsSetup[CORS中间件]
CorsCheck --> |禁用| SkipCors[跳过CORS]
DevConfig --> ViteSetup[Vite中间件]
CorsSetup --> MiddlewareChain[中间件链路]
SkipCors --> MiddlewareChain
ViteSetup --> MiddlewareChain
MiddlewareChain --> SecurityHeaders[安全响应头]
SecurityHeaders --> HealthCheck[健康检查]
HealthCheck --> StaticFiles[静态资源]
StaticFiles --> Routes[API路由]
Routes --> ErrorHandling[错误处理]
ErrorHandling --> End([服务器就绪])
```

**图表来源**
- [server/src/index.ts:33-142](file://server/src/index.ts#L33-L142)
- [server/src/dev.ts:8-66](file://server/src/dev.ts#L8-L66)

### 环境变量配置

服务器支持多种环境变量配置：

| 环境变量 | 默认值 | 用途 | 生产环境要求 |
|---------|--------|------|-------------|
| NODE_ENV | development | 环境模式 | production/development |
| PORT | 3000 | 服务器端口 | 可选，默认3000 |
| FRONTEND_URL | - | CORS前端地址 | 生产环境必需 |
| JWT_SECRET | - | JWT加密密钥 | 生产环境必需 |

**章节来源**
- [server/src/index.ts:22-24](file://server/src/index.ts#L22-L24)
- [server/src/utils/jwt.ts:20-26](file://server/src/utils/jwt.ts#L20-L26)

### 中间件链路设计

服务器采用严格的中间件执行顺序：

```mermaid
sequenceDiagram
participant Client as 客户端
participant App as Express应用
participant CORS as CORS中间件
participant Cookie as Cookie解析
participant Compression as 压缩中间件
participant Body as 请求体解析
participant Security as 安全头
participant DBCheck as 数据库检查
participant Static as 静态资源
participant API as API路由
participant ErrorHandler as 错误处理
Client->>App : HTTP请求
App->>CORS : 跨域检查
CORS->>Cookie : 解析Cookie
Cookie->>Compression : 压缩配置
Compression->>Body : 解析JSON/URL编码
Body->>Security : 设置安全头
Security->>DBCheck : 数据库就绪检查
DBCheck->>Static : 静态资源处理
Static->>API : API路由匹配
API->>ErrorHandler : 错误处理
ErrorHandler-->>Client : 响应
```

**图表来源**
- [server/src/index.ts:37-87](file://server/src/index.ts#L37-L87)

**章节来源**
- [server/src/index.ts:37-87](file://server/src/index.ts#L37-L87)

## 架构概览

系统采用分层架构设计，各层职责明确：

```mermaid
graph TB
subgraph "表现层"
A[Web前端]
B[移动客户端]
end
subgraph "应用层"
C[Express服务器]
D[中间件层]
E[路由层]
end
subgraph "业务逻辑层"
F[认证服务]
G[订单管理]
H[菜品管理]
I[库存管理]
end
subgraph "数据访问层"
J[SQL.js数据库]
K[文件存储]
L[缓存系统]
end
A --> C
B --> C
C --> F
C --> G
C --> H
C --> I
F --> J
G --> J
H --> J
I --> J
J --> K
J --> L
```

**图表来源**
- [server/src/index.ts:87-142](file://server/src/index.ts#L87-L142)
- [server/src/routes/index.ts:1-18](file://server/src/routes/index.ts#L1-L18)

## 详细组件分析

### 数据库初始化系统

数据库采用SQL.js实现，支持自动初始化和批量操作：

```mermaid
classDiagram
class DatabaseManager {
-Database db
-string dbPath
-boolean deferSave
-setTimeout saveDebounceTimer
+initDatabase() Promise~Database~
+getDb() Database
+run(sql, params) Object
+get(sql, params) Object
+all(sql, params) Array
+beginBatch() void
+endBatch() void
+saveDatabase() void
+flushSave() void
}
class MigrationService {
+initializeDatabase() Promise~void~
+createTables() Promise~void~
+setupIndexes() Promise~void~
+createDefaultUsers() Promise~void~
+createDefaultSettings() Promise~void~
+migrateLegacyData() Promise~void~
}
class BatchOperations {
+statements Array
+beginBatch() void
+runBatch(statements) void
+endBatch() void
}
DatabaseManager --> MigrationService : 使用
MigrationService --> BatchOperations : 协调
```

**图表来源**
- [server/src/db/index.ts:101-156](file://server/src/db/index.ts#L101-L156)
- [server/src/db/init.ts:5-204](file://server/src/db/init.ts#L5-L204)

#### 数据库初始化流程

```mermaid
flowchart TD
Init([初始化开始]) --> LoadDB{检查数据库文件}
LoadDB --> |存在| LoadExisting[加载现有数据库]
LoadDB --> |不存在| CreateNew[创建新数据库]
LoadExisting --> SetupTables[创建表结构]
CreateNew --> SetupTables
SetupTables --> CreateIndexes[创建索引]
CreateIndexes --> CheckAdmin{检查管理员用户}
CheckAdmin --> |不存在| CreateAdmin[创建默认管理员]
CheckAdmin --> |存在| CheckSettings{检查系统设置}
CreateAdmin --> CheckSettings
CheckSettings --> |不存在| CreateSettings[创建默认设置]
CheckSettings --> |存在| MigrateData[数据迁移]
CreateSettings --> MigrateData
MigrateData --> BatchOps[批量操作]
BatchOps --> Complete([初始化完成])
```

**图表来源**
- [server/src/db/init.ts:5-204](file://server/src/db/init.ts#L5-L204)

**章节来源**
- [server/src/db/index.ts:1-156](file://server/src/db/index.ts#L1-L156)
- [server/src/db/init.ts:1-204](file://server/src/db/init.ts#L1-L204)

### 安全响应头策略

服务器实现了全面的安全响应头设置：

| 响应头 | 值 | 作用 | 配置位置 |
|-------|----|-----|---------|
| X-Content-Type-Options | nosniff | 防止MIME类型嗅探 | [server/src/index.ts:61](file://server/src/index.ts#L61) |
| X-Frame-Options | DENY | 防止点击劫持 | [server/src/index.ts:62](file://server/src/index.ts#L62) |
| X-XSS-Protection | 1; mode=block | XSS防护 | [server/src/index.ts:63](file://server/src/index.ts#L63) |
| Referrer-Policy | strict-origin-when-cross-origin | 引用策略 | [server/src/index.ts:64](file://server/src/index.ts#L64) |

### 认证与授权系统

采用JWT令牌配合HTTP-only Cookie的认证方案：

```mermaid
sequenceDiagram
participant Client as 客户端
participant Auth as 认证路由
participant DB as 数据库
participant JWT as JWT服务
participant Cookie as Cookie设置
Client->>Auth : POST /api/auth/login
Auth->>DB : 验证用户凭据
DB-->>Auth : 用户信息
Auth->>JWT : 生成JWT令牌
JWT-->>Auth : 加密令牌
Auth->>Cookie : 设置HTTP-only Cookie
Cookie-->>Client : 返回认证Cookie
Client-->>Auth : 后续请求携带Cookie
Auth->>JWT : 验证令牌有效性
JWT-->>Auth : 验证结果
Auth-->>Client : 授权访问
```

**图表来源**
- [server/src/routes/auth.ts:65-144](file://server/src/routes/auth.ts#L65-L144)
- [server/src/utils/jwt.ts:11-26](file://server/src/utils/jwt.ts#L11-L26)

**章节来源**
- [server/src/routes/auth.ts:1-405](file://server/src/routes/auth.ts#L1-L405)
- [server/src/utils/jwt.ts:1-27](file://server/src/utils/jwt.ts#L1-L27)

### 健康检查端点

健康检查端点提供服务器状态监控：

```mermaid
flowchart TD
HealthReq[健康检查请求] --> CheckDB{检查数据库状态}
CheckDB --> |就绪| OK[返回OK状态]
CheckDB --> |未就绪| Initializing[返回初始化状态]
OK --> Response1[{status: "ok", dbReady: true}]
Initializing --> Response2[{status: "initializing", dbReady: false}]
Response1 --> End([响应结束])
Response2 --> End
```

**图表来源**
- [server/src/index.ts:89-95](file://server/src/index.ts#L89-L95)

**章节来源**
- [server/src/index.ts:89-95](file://server/src/index.ts#L89-L95)

### 静态资源管理

服务器提供多级静态资源缓存策略：

| 路径前缀 | 缓存策略 | 用途 | 配置位置 |
|---------|---------|------|---------|
| /assets/ | 1年，immutable | 前端构建产物 | [server/src/index.ts:101](file://server/src/index.ts#L101) |
| /sources/ | 30天，immutable | 图片资源 | [server/src/index.ts:80](file://server/src/index.ts#L80) |
| 根目录 | 0天 | HTML文件 | [server/src/index.ts:107](file://server/src/index.ts#L107) |

**章节来源**
- [server/src/index.ts:80-118](file://server/src/index.ts#L80-L118)

### 开发环境配置

开发环境支持Vite中间件模式和热重载功能：

```mermaid
graph LR
subgraph "开发服务器"
A[Vite开发服务器]
B[Express应用]
C[中间件链路]
end
subgraph "开发特性"
D[热重载]
E[源码映射]
F[错误堆栈修复]
G[SPA回退]
end
A --> B
B --> C
C --> D
C --> E
C --> F
C --> G
```

**图表来源**
- [server/src/dev.ts:8-66](file://server/src/dev.ts#L8-L66)

**章节来源**
- [server/src/dev.ts:1-67](file://server/src/dev.ts#L1-L67)
- [server/src/dev-server.ts:1-13](file://server/src/dev-server.ts#L1-L13)

## 依赖关系分析

### 外部依赖关系

```mermaid
graph TB
subgraph "核心框架"
A[Express.js]
B[TypeScript]
C[Vite]
end
subgraph "中间件生态"
D[cors]
E[cookie-parser]
F[compression]
G[multer]
end
subgraph "数据库相关"
H[sql.js]
I[bcryptjs]
J[jsonwebtoken]
end
subgraph "工具库"
K[uuid]
L[sharp]
M[adm-zip]
end
A --> D
A --> E
A --> F
A --> G
H --> I
H --> J
C --> K
C --> L
C --> M
```

**图表来源**
- [package.json:16-41](file://package.json#L16-L41)

### 内部模块依赖

```mermaid
graph TD
subgraph "入口模块"
A[index.ts]
end
subgraph "数据库模块"
B[db/index.ts]
C[db/init.ts]
end
subgraph "路由模块"
D[routes/index.ts]
E[routes/auth.ts]
F[routes/admin.ts]
end
subgraph "工具模块"
G[utils/jwt.ts]
end
A --> B
A --> D
A --> G
D --> E
D --> F
B --> C
```

**图表来源**
- [server/src/index.ts:1-11](file://server/src/index.ts#L1-L11)
- [server/src/routes/index.ts:1-18](file://server/src/routes/index.ts#L1-L18)

**章节来源**
- [package.json:1-64](file://package.json#L1-L64)

## 性能考虑

### 压缩策略优化

服务器采用智能压缩过滤器，避免对SSE流的不必要压缩：

```mermaid
flowchart TD
Req[请求到达] --> CheckSSE{检查SSE响应}
CheckSSE --> |是| NoCompress[禁用压缩]
CheckSSE --> |否| CheckThreshold{检查阈值}
CheckThreshold --> |超过阈值| Compress[启用压缩]
CheckThreshold --> |低于阈值| NoCompress
CheckSSE --> |否| Compress
Compress --> Send[发送响应]
NoCompress --> Send
```

**图表来源**
- [server/src/index.ts:44-55](file://server/src/index.ts#L44-L55)

### 缓存策略

采用多级缓存机制优化静态资源性能：

| 缓存层级 | 适用场景 | 缓存时间 | 特性 |
|---------|---------|---------|------|
| CDN缓存 | 全球分发 | 30天+ | 最大化缓存命中率 |
| 反向代理缓存 | Nginx层 | 7-30天 | 减少后端负载 |
| 浏览器缓存 | 前端资源 | 1年 | 最佳用户体验 |
| 应用缓存 | 动态内容 | 临时 | 降低数据库压力 |

**章节来源**
- [nginx.conf:70-84](file://nginx.conf#L70-L84)
- [server/src/index.ts:80-118](file://server/src/index.ts#L80-L118)

## 故障排除指南

### 常见问题诊断

| 问题类型 | 症状 | 诊断方法 | 解决方案 |
|---------|------|---------|---------|
| 数据库连接失败 | 503服务不可用 | 检查/health端点 | 验证数据库初始化日志 |
| CORS错误 | 跨域请求失败 | 检查FRONTEND_URL配置 | 确认CORS源设置 |
| JWT验证失败 | 401未授权 | 检查JWT_SECRET | 验证密钥配置和格式 |
| 静态资源404 | 前端页面空白 | 检查构建产物 | 验证dist目录完整性 |

### 错误处理机制

服务器采用统一的错误处理中间件：

```mermaid
flowchart TD
Error[错误发生] --> CheckType{检查错误类型}
CheckType --> |UnauthorizedError| AuthError[认证错误处理]
CheckType --> |ValidationError| ValidError[验证错误处理]
CheckType --> |其他错误| GenericError[通用错误处理]
AuthError --> Return401[返回401状态]
ValidError --> Return400[返回400状态]
GenericError --> CheckEnv{检查环境}
CheckEnv --> |生产环境| Return500Prod[返回通用错误]
CheckEnv --> |开发环境| Return500Dev[返回详细错误]
Return401 --> End([错误处理完成])
Return400 --> End
Return500Prod --> End
Return500Dev --> End
```

**图表来源**
- [server/src/index.ts:121-139](file://server/src/index.ts#L121-L139)

**章节来源**
- [server/src/index.ts:121-139](file://server/src/index.ts#L121-L139)

## 结论

本Express服务器配置展现了现代Node.js应用的最佳实践，具有以下特点：

1. **完整的生命周期管理**：从开发到生产的无缝切换
2. **安全优先的设计**：全面的安全响应头和认证机制
3. **高性能的架构**：智能缓存和压缩策略
4. **可观测性完善**：详细的健康检查和错误处理
5. **可维护性强**：清晰的模块化结构和配置分离

该配置为餐厅管理系统提供了稳定可靠的技术基础，支持未来的功能扩展和性能优化。

## 附录

### 部署配置参考

#### Docker容器化部署

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:production

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
```

#### PM2进程管理配置

```javascript
module.exports = {
  apps: [{
    name: 'red-lantern-restaurant',
    script: 'server/dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

**章节来源**
- [Dockerfile:1-65](file://Dockerfile#L1-L65)
- [ecosystem.config.cjs:1-19](file://ecosystem.config.cjs#L1-L19)