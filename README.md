<div align="center">

<a>
<img src="public/logo.png" alt="红灯笼食府管理系统" width="200" height="200" style="border:none;box-shadow:none;">
</a>

<h1 style="font-size: 3em; font-weight: bold; margin: 20px 0;">红灯笼食府管理系统</h1>

<p style="font-size: 1.2em; color: #666;">一个基于 Vue 3+Vite+TypeScript的餐饮企业管理系统</p>

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Vue](https://img.shields.io/badge/vue-3.5+-4FC08D.svg)
![Vite](https://img.shields.io/badge/vite-7.x-646CFF.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.9+-3178C6.svg)
![Node.js](https://img.shields.io/badge/node.js-18+-339933.svg)

[项目简介](#项目简介) · [技术栈](#技术栈) · [项目结构](#项目结构) · [快速开始](#快速开始) · [功能模块](#功能模块) · [API接口](#api接口)

</div>

---
## 项目简介

红灯笼食府管理系统采用前后端分离架构，包含顾客端（C端）和管理端（B端）两大模块：

- **顾客端**：到店用餐的顾客用于自助点餐，支持菜品浏览、购物车、下单、订单查询等功能
- **管理端**：餐厅管理员/服务员用于桌台管理、菜品管理、订单管理、库存管理等

## 技术栈

### 前端
| 技术 | 版本 | 说明 |
|------|------|------|
| Vue | 3.5.x | 渐进式JavaScript框架 |
| Vite | 7.x | 下一代前端构建工具 |
| TypeScript | 5.9.x | JavaScript的超集，提供类型支持 |
| Pinia | 3.x | Vue官方推荐的状态管理库 |
| Vue Router | 5.x | Vue.js官方路由 |
| Lucide Vue Next | 0.468.x | 图标库 |
| Zod | 3.x | TypeScript优先的模式声明和验证库 |

### 后端
| 技术 | 版本 | 说明 |
|------|------|------|
| Node.js | - | JavaScript运行时 |
| Express | 4.21.x | Web应用框架 |
| sql.js | 1.12.x | SQLite的JavaScript实现 |
| JWT | 9.x | JSON Web Token认证 |
| bcryptjs | 2.4.x | 密码加密 |
| QRCode | 1.5.x | 二维码生成 |
| JsBarcode | 3.12.x | 条形码生成 |
| Multer | 2.x | 文件上传中间件 |
| Zod | 3.x | 请求参数校验 |
| Sharp | 0.33.x | 图片处理（缩放、压缩、WebP转换） |
| Archiver | 7.x | 数据导出 ZIP 打包 |
| AdmZip | 0.5.x | 数据导入 ZIP 解压 |
| Cookie-parser | 1.4.x | Cookie 解析中间件 |
| Compression | 1.7.x | HTTP 响应压缩中间件 |
| Uuid | 10.x | UUID 生成 |

## 项目结构

```
red-lantern-restaurant/
├── public/                     # 静态资源
│   ├── sources/               # 上传的图片资源
│   ├── background.png         # 背景图
│   └── logo.png               # Logo
├── scripts/                   # 构建脚本
│   └── build-production.mjs   # 生产构建脚本
├── server/                    # 后端服务
│   ├── data/                  # 数据库文件
│   │   └── restaurant.db      # SQLite数据库
│   └── src/
│       ├── db/                # 数据库初始化
│       │   ├── index.ts       # 数据库连接
│       │   └── init.ts        # 数据库初始化脚本
│       ├── routes/            # API路由
│       │   ├── index.ts       # 路由聚合
│       │   ├── admin.ts       # 管理端API
│       │   ├── auth.ts        # 认证API
│       │   ├── dishes.ts      # 菜品API
│       │   ├── orders.ts      # 订单API
│       │   └── tables.ts      # 桌位API
│       ├── types/             # 类型定义
│       │   └── sql.js.d.ts    # sql.js 类型声明
│       ├── utils/             # 工具函数
│       │   ├── format.ts      # 日期时间格式化
│       │   ├── jwt.ts         # JWT密钥与签发
│       │   ├── memberNo.ts    # 会员号生成
│       │   └── sse.ts         # SSE服务端推送
│       ├── validators/        # 请求参数校验（Zod）
│       │   └── index.ts
│       ├── dev.ts             # 开发入口（集成模式：Express+Vite中间件）
│       ├── dev-server.ts      # 开发入口（分离模式：仅Express，供Vite proxy转发）
│       └── index.ts           # Express应用创建与生产入口
├── src/                       # 前端源码
│   ├── admin/                 # 管理端模块
│   │   ├── components/        # 管理端组件
│   │   │   └── DebugToolsPanel.vue  # 调试工具面板
│   │   └── views/             # 管理端页面
│   │       ├── DashboardView.vue    # 仪表盘
│   │       ├── DebugView.vue        # 调试工具
│   │       ├── DishesView.vue       # 菜单管理
│   │       ├── InventoryView.vue    # 库存管理
│   │       ├── LayoutView.vue       # 布局组件
│   │       ├── LoginView.vue        # 登录页
│   │       ├── NotFoundView.vue     # 404页面
│   │       ├── OrdersView.vue       # 订单管理
│   │       ├── SettingsView.vue     # 系统设置
│   │       ├── TablesView.vue       # 桌位管理
│   │       └── UsersView.vue        # 用户管理
│   ├── api/                   # API封装
│   │   └── index.ts           # 统一API请求封装
│   ├── client/                # 顾客端模块
│   │   ├── components/        # 顾客端组件
│   │   │   ├── CartDrawer.vue         # 购物车抽屉
│   │   │   ├── ClientLayout.vue       # 顾客端布局
│   │   │   ├── ClientLoginModal.vue   # 顾客登录弹窗
│   │   │   ├── DishCard.vue           # 菜品卡片
│   │   │   └── TableSelectModal.vue   # 选桌弹窗
│   │   └── views/             # 顾客端页面
│   │       ├── DishDetailView.vue     # 菜品详情
│   │       ├── HomeView.vue           # 首页
│   │       ├── NotFoundView.vue       # 404页面
│   │       ├── OrderConfirmView.vue   # 订单确认
│   │       ├── OrderDetailView.vue    # 订单详情
│   │       ├── OrderQRCodeView.vue    # 订单二维码
│   │       ├── OrdersView.vue         # 全部订单
│   │       ├── SearchView.vue         # 搜索页
│   │       └── SettingsView.vue       # 设置页
│   ├── router/                # 路由配置
│   │   └── index.ts           # 路由定义
│   ├── shared/                # 共享模块
│   │   ├── components/        # 共享组件
│   │   │   ├── ConfirmDialog.vue      # 确认弹窗
│   │   │   ├── Loading.vue            # 加载组件
│   │   │   ├── Modal.vue              # 弹窗组件
│   │   │   ├── QuantityControl.vue    # 数量控制组件
│   │   │   ├── Skeleton.vue           # 骨架屏组件
│   │   │   └── Toast.vue              # 提示组件
│   │   └── composables/      # 组合式函数
│   │       ├── useDragReorder.ts      # 拖拽排序
│   │       ├── useOrderPolling.ts     # 订单轮询
│   │       └── useStaggeredAnimation.ts # 交错动画
│   ├── stores/                # 状态管理（Pinia）
│   │   ├── app.ts             # 应用状态（Toast等）
│   │   ├── auth.ts            # 管理端认证状态
│   │   ├── cart.ts            # 购物车状态
│   │   ├── clientAuth.ts      # 顾客端认证状态
│   │   └── table.ts           # 桌位状态
│   ├── types/                 # 类型定义
│   │   └── index.ts           # 全局类型
│   ├── utils/                 # 前端工具
│   │   └── storage.ts         # 本地存储封装
│   ├── App.vue                # 根组件
│   ├── main.ts                # 入口文件
│   └── style.css              # 全局样式
├── .dockerignore             # Docker忽略文件
├── .env                       # 环境变量（PORT等）
├── apache.conf               # Apache反向代理配置
├── docker-compose.yml         # Docker Compose配置
├── Dockerfile                 # Docker多阶段构建
├── ecosystem.config.cjs       # PM2进程管理配置
├── index.html                 # HTML入口
├── install.bat                # Windows安装脚本
├── install.sh                 # Linux/macOS安装脚本
├── nginx.conf                 # Nginx反向代理配置
├── package.json               # 项目配置
├── start.bat / start.sh       # 启动脚本
├── stop.bat / stop.sh         # 停止脚本
├── tsconfig.json              # TypeScript配置
└── vite.config.ts             # Vite配置
```

## 快速开始

### 环境要求

- Node.js >= 18.x
- npm >= 9.x

### 安装依赖

```bash
cd red-lantern-restaurant
npm install
```

### 开发模式

项目支持两种开发模式：

**方式一：集成模式（推荐）**

同时启动前端和后端，Express 通过 Vite 中间件模式集成，统一在端口 3000 提供服务：

```bash
npm run dev
```

浏览器访问 `http://localhost:3000` 即可。

**方式二：分离模式（适用于 Trae IDE 预览等独立 Vite 场景）**

分别启动后端 API 服务和前端 Vite 服务。Vite 会通过 proxy 将 `/api`、`/sources`、`/health` 请求转发到后端：

```bash
# 终端 1：启动后端 API 服务（端口 3000）
npm run dev:server

# 终端 2：启动前端 Vite 开发服务器（端口 4000，由 Trae IDE 预览自动启动）
# 若手动启动，可执行：npx vite
```

此模式下浏览器访问 Vite 端口（如 `http://localhost:4000`），API 请求会被自动代理到 `http://localhost:3000`。

### 生产构建

```bash
# 构建前端
npm run build

# 构建后端
npm run build:server
```

### 数据库初始化

```bash
# 初始化数据库
npm run db:init
```

## 功能模块

### 顾客端功能

| 功能模块 | 说明 |
|----------|------|
| 首页 | 菜品分类浏览、添加购物车、快速点餐 |
| 菜品详情 | 查看菜品详细信息、选择规格、加入购物车 |
| 购物车 | 查看已选菜品、修改数量、删除菜品 |
| 订单确认 | 选择桌位、填写联系方式、确认下单 |
| 订单详情 | 查看订单信息、取消订单（5分钟内）、继续加菜 |
| 订单二维码 | 显示订单二维码和条形码、复制订单号 |
| 搜索 | 搜索菜品、历史记录管理 |
| 全部订单 | 查看历史订单列表（需登录） |
| 顾客登录 | 手机号+密码登录，未注册自动注册 |
| 设置 | 主题切换、名片管理 |

### 管理端功能

| 功能模块 | 说明 |
|----------|------|
| 登录 | 管理员身份认证 |
| 仪表盘 | 今日订单统计、收入统计、桌位状态概览、最近订单 |
| 桌位管理 | 添加/删除桌位、查看桌位状态、更新桌位信息 |
| 菜单管理 | 添加/编辑/删除菜品、分类管理、图片上传、拖拽排序 |
| 订单管理 | 查看所有订单、按订单号搜索、更新订单状态、筛选订单 |
| 库存管理 | 原材料库存监控、库存预警、入库/出库记录、拖拽排序 |
| 用户管理 | 管理员/顾客账号管理、创建/编辑/删除用户、重置密码 |
| 系统设置 | 店铺信息配置、数据导入导出、重置数据库、清空历史订单 |
| 调试工具 | SQL 执行与查询、数据库 Schema 浏览、API 接口调试 |
| 实时推送 | 通过 SSE 接收新订单、订单状态变更等实时事件 |

## API接口

所有接口统一返回 `{ success: boolean, data?: any, error?: string }` 格式。

### 菜品接口（公开）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/dishes | 获取菜品列表（按分类排序） |
| GET | /api/dishes/home-data | 获取首页数据（分类+菜品，聚合接口） |
| GET | /api/dishes/categories/all | 获取全部分类 |
| GET | /api/dishes/search/query | 搜索菜品（关键词查询） |
| GET | /api/dishes/:id | 获取菜品详情 |

### 桌位接口（公开）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tables | 获取全部桌位列表 |
| GET | /api/tables/available | 获取可用桌位 |
| GET | /api/tables/available-for?dining_time= | 获取指定就餐时段可用桌位 |
| GET | /api/tables/:id | 获取桌位详情 |

### 订单接口（需客户端登录）

> 以下接口均通过 `client_token` Cookie 进行客户端身份认证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/orders?phone= | 获取指定手机号的订单列表 |
| GET | /api/orders/:id | 获取订单详情 |
| POST | /api/orders | 创建订单（服务端重新验证价格） |
| POST | /api/orders/:id/cancel | 取消订单（5分钟内，需手机号验证） |

### 管理员认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 管理员登录（IP 限流：5次/15分钟） |
| POST | /api/auth/logout | 管理员登出 |
| GET | /api/auth/verify | 验证管理员 Token |
| PUT | /api/auth/password | 修改管理员密码 |

### 顾客认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/client/login | 顾客登录（手机号+密码，未注册自动注册） |
| POST | /api/auth/client/logout | 顾客登出 |
| GET | /api/auth/client/verify | 验证顾客 Token（7天有效期） |

### 管理端接口

> 以下接口均需管理员登录（`admin_token` Cookie）

**仪表盘与实时推送**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/dashboard | 获取仪表盘统计数据 |
| GET | /api/admin/events | SSE 实时事件流（新订单、订单状态变更） |

**桌位管理**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/tables | 获取桌位列表（含当前订单信息） |
| POST | /api/admin/tables | 创建桌位 |
| PUT | /api/admin/tables/:id | 更新桌位信息/状态 |
| DELETE | /api/admin/tables/:id | 删除桌位（有未完成订单时禁止） |

**菜品管理**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/dishes | 获取菜品列表 |
| POST | /api/admin/dishes | 创建菜品 |
| PUT | /api/admin/dishes/reorder | 批量调整菜品排序 |
| PUT | /api/admin/dishes/:id | 更新菜品 |
| DELETE | /api/admin/dishes/:id | 删除菜品（同步清理未使用图片） |

**分类管理**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/categories | 获取分类列表 |
| POST | /api/admin/categories | 创建分类（"其他"为系统保留） |
| PUT | /api/admin/categories/reorder | 批量调整分类排序 |
| DELETE | /api/admin/categories/:id | 删除分类（有菜品时禁止） |

**订单管理**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/orders?status=&date= | 获取订单列表（支持状态/日期筛选） |
| GET | /api/admin/orders/search?order_no= | 按订单号模糊搜索 |
| PUT | /api/admin/orders/:id/status | 更新订单状态 |

**库存管理**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/inventory | 获取库存列表 |
| POST | /api/admin/inventory | 创建库存项 |
| PUT | /api/admin/inventory/reorder | 批量调整库存排序 |
| PUT | /api/admin/inventory/:id | 更新库存数量/预警阈值 |
| DELETE | /api/admin/inventory/:id | 删除库存项 |

**用户管理**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/users | 获取用户列表 |
| POST | /api/admin/users | 创建用户 |
| PUT | /api/admin/users/:id | 更新用户（可重置密码） |
| DELETE | /api/admin/users/:id | 删除用户（禁止删除自己/最后一个管理员） |

**系统设置**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/settings | 获取系统设置 |
| PUT | /api/admin/settings | 更新系统设置 |

**图片管理**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/admin/upload | 上传图片（自动压缩为 WebP，最大 5MB） |
| DELETE | /api/admin/image | 删除图片（被菜品使用时禁止） |

**数据管理**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/export | 导出全部数据为 ZIP（含图片） |
| POST | /api/admin/import | 导入 ZIP 数据（覆盖现有数据） |
| POST | /api/admin/reset-database | 重置数据库（需 confirm: "RESET"） |
| POST | /api/admin/clear-orders | 清空已完成/已取消的订单 |

## 数据模型

### 核心实体

```
用户（User）
├── id: string
├── username: string
├── password: string (bcrypt 加密)
├── role: 'customer' | 'admin'
├── name: string | null
├── phone: string | null
└── created_at/updated_at

桌位（Table）
├── id: string
├── table_no: string
├── name: string
├── status: 'available' | 'occupied' | 'reserved'
├── capacity: number
└── created_at/updated_at

菜品（Dish）
├── id: string
├── name: string
├── price: number
├── image_url: string | null
├── category_id: string | null
├── description: string | null
├── tags: string[] (JSON)
├── specs: string[] (JSON)
├── status: 'on_sale' | 'off_sale'
├── sort_order: number
└── created_at/updated_at

订单（Order）
├── id: string
├── order_no: string (RL+日期+随机码)
├── table_id: string | null
├── dining_time: '中午' | '晚上' | null
├── contact_name: string | null
├── contact_phone: string | null
├── total_amount: number
├── status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
├── items: OrderItem[]
└── created_at/updated_at

订单项（OrderItem）
├── id: string
├── order_id: string
├── dish_id: string
├── dish_name: string
├── quantity: number
├── unit_price: number
├── subtotal: number
└── spec: string | null

分类（Category）
├── id: string
├── name: string
├── sort_order: number
└── created_at

库存（Inventory）
├── id: string
├── material_name: string
├── quantity: number
├── unit: string
├── warning_threshold: number
├── sort_order: number
└── created_at/updated_at

系统设置（Settings）
├── key: string (主键)
├── value: string
└── updated_at
```

## 默认账号

管理员默认账号：
- 用户名：`admin`
- 密码：`admin123`

首次登录后建议立即修改密码。

## 配置说明

### 前端配置

- **集成模式**（`npm run dev`）：前端与后端统一在 `http://localhost:3000` 提供服务
- **分离模式**（`npm run dev:server` + 独立 Vite）：Vite 开发服务器运行在 `http://localhost:4000`，通过 [vite.config.ts](vite.config.ts) 中的 proxy 配置将 `/api`、`/sources`、`/health` 请求转发到后端

### 后端配置

后端服务默认运行在 `http://localhost:3000`，可通过项目根目录 `.env` 文件中的 `PORT` 环境变量修改端口：

```env
PORT=3000
```

> 注意：若修改后端端口，需同步更新 `vite.config.ts` 中 proxy 的 `target` 配置。

## 部署

### 一键安装

项目提供跨平台安装脚本，自动完成依赖安装、生产构建、环境检测（PM2/Nginx/Apache/Docker）及配置引导：

```bash
# Windows
install.bat

# Linux / macOS
chmod +x install.sh
./install.sh
```

### Docker 部署

使用多阶段构建，生成精简 Alpine 镜像，内置健康检查和非 root 用户运行：

```bash
# 构建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

数据持久化通过 Docker Volume 挂载 `server/data`（数据库）、`public/sources`（上传图片）、`logs`（日志）。

### PM2 部署

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # 设置开机自启
```

### Nginx / Apache 反向代理

项目根目录提供 `nginx.conf` 和 `apache.conf` 配置模板，安装脚本会自动检测并引导配置。主要注意事项：

- 将 `server_name` 修改为实际域名或 IP
- SSE 长连接需配置代理超时（已包含在模板中）
- 配置完成后重载服务（`nginx -s reload` / `httpd -k restart`）

### 快捷启停

| 脚本 | 平台 | 说明 |
|------|------|------|
| `start.bat` / `start.sh` | Windows / Linux | 启动生产服务（自动检测 PM2） |
| `stop.bat` / `stop.sh` | Windows / Linux | 停止生产服务 |

## 安全说明

- 密码使用 bcrypt 进行加密存储
- API 使用 JWT 进行身份认证（httpOnly Cookie，防 XSS）
- 管理端路由设有导航守卫，未登录用户将被重定向到登录页
- 登录接口 IP 限流：15 分钟内最多 5 次失败尝试
- 订单创建时服务端重新验证菜品价格，防止客户端篡改金额
- 文件上传限制类型（JPEG/PNG/GIF/WebP）和大小（5MB）
- 图片处理使用 sharp 压缩为 WebP 格式，最大宽度 800px
- 数据导入时严格校验 ZIP 结构和文件路径，防止路径穿越攻击
- 危险操作（重置数据库）需二次确认（`confirm: "RESET"`）
- 删除管理员账户时禁止删除自己和最后一个管理员
- SSE 连接设有 30 秒心跳保活，断开时自动清理资源

## 开发规范

### 代码风格

- 使用 TypeScript 编写，确保类型安全（禁止使用 `any`）
- Vue组件采用 `<script setup>` 语法
- 使用 Composition API
- 后端请求参数使用 Zod 进行模式校验
- 不可变数据优先，避免直接修改状态

### 目录约定

- `views/` - 页面组件
- `components/` - 可复用组件
- `composables/` - 组合式函数（`use` 前缀）
- `stores/` - Pinia状态管理
- `api/` - API请求封装
- `types/` - TypeScript类型定义
- `utils/` - 工具函数
- `validators/` - 请求参数校验（Zod schema）

## 许可证

本项目使用MIT许可证，仅供学习和研究使用。
