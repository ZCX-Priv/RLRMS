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

## 项目结构

```
red-lantern-restaurant/
├── public/                     # 静态资源
│   ├── sources/               # 上传的图片资源
│   ├── background.png         # 背景图
│   └── logo.png               # Logo
├── server/                    # 后端服务
│   ├── data/                  # 数据库文件
│   │   └── restaurant.db      # SQLite数据库
│   └── src/
│       ├── db/                # 数据库初始化
│       │   ├── index.ts       # 数据库连接
│       │   └── init.ts        # 数据库初始化脚本
│       └── routes/            # API路由
│           ├── admin.ts       # 管理端API
│           ├── auth.ts        # 认证API
│           ├── dishes.ts      # 菜品API
│           ├── orders.ts      # 订单API
│           └── tables.ts      # 桌位API
├── src/                       # 前端源码
│   ├── admin/                 # 管理端模块
│   │   └── views/             # 管理端页面
│   │       ├── DashboardView.vue    # 仪表盘
│   │       ├── DishesView.vue       # 菜单管理
│   │       ├── InventoryView.vue    # 库存管理
│   │       ├── LayoutView.vue       # 布局组件
│   │       ├── LoginView.vue        # 登录页
│   │       ├── OrdersView.vue       # 订单管理
│   │       ├── SettingsView.vue     # 系统设置
│   │       └── TablesView.vue       # 桌位管理
│   ├── api/                   # API封装
│   │   └── index.ts           # 统一API请求封装
│   ├── client/                # 顾客端模块
│   │   ├── components/        # 顾客端组件
│   │   │   ├── CartDrawer.vue       # 购物车抽屉
│   │   │   ├── ClientLayout.vue     # 顾客端布局
│   │   │   ├── DishCard.vue         # 菜品卡片
│   │   │   └── TableSelectModal.vue # 选桌弹窗
│   │   └── views/             # 顾客端页面
│   │       ├── DishDetailView.vue   # 菜品详情
│   │       ├── HomeView.vue         # 首页
│   │       ├── OrderConfirmView.vue # 订单确认
│   │       ├── OrderDetailView.vue  # 订单详情
│   │       ├── OrderQRCodeView.vue  # 订单二维码
│   │       ├── OrdersView.vue       # 全部订单
│   │       ├── SearchView.vue       # 搜索页
│   │       └── SettingsView.vue     # 设置页
│   ├── router/                # 路由配置
│   │   └── index.ts           # 路由定义
│   ├── shared/                # 共享组件
│   │   └── components/
│   │       ├── Loading.vue          # 加载组件
│   │       ├── Modal.vue            # 弹窗组件
│   │       ├── QuantityControl.vue  # 数量控制组件
│   │       └── Toast.vue            # 提示组件
│   ├── stores/                # 状态管理
│   │   ├── app.ts             # 应用状态
│   │   ├── auth.ts            # 认证状态
│   │   ├── cart.ts            # 购物车状态
│   │   └── table.ts           # 桌位状态
│   ├── types/                 # 类型定义
│   │   └── index.ts           # 全局类型
│   ├── App.vue                # 根组件
│   ├── main.ts                # 入口文件
│   └── style.css              # 全局样式
├── index.html                 # HTML入口
├── package.json               # 项目配置
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

同时启动前端开发服务器和后端API服务：

```bash
npm run dev
```

或者分别启动：

```bash
# 仅启动前端（端口3000）
npm run dev:client

# 仅启动后端（端口3001）
npm run dev:server
```

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
| 全部订单 | 查看历史订单列表 |
| 设置 | 主题切换、名片管理 |

### 管理端功能

| 功能模块 | 说明 |
|----------|------|
| 登录 | 管理员身份认证 |
| 仪表盘 | 今日订单统计、收入统计、桌位状态概览 |
| 桌位管理 | 添加/删除桌位、查看桌位状态、更新桌位信息 |
| 菜单管理 | 添加/编辑/删除菜品、分类管理、图片上传 |
| 订单管理 | 查看所有订单、更新订单状态、筛选订单 |
| 库存管理 | 原材料库存监控、库存预警、入库/出库记录 |
| 系统设置 | 店铺信息配置、数据管理 |

## API接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/dishes | 获取菜品列表 |
| GET | /api/dishes/:id | 获取菜品详情 |
| GET | /api/dishes/search/query | 搜索菜品 |
| GET | /api/dishes/categories/all | 获取分类列表 |
| GET | /api/tables | 获取桌位列表 |
| GET | /api/tables/available | 获取可用桌位 |
| POST | /api/orders | 创建订单 |
| GET | /api/orders | 获取订单列表 |
| GET | /api/orders/:id | 获取订单详情 |
| POST | /api/orders/:id/cancel | 取消订单 |

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 管理员登录 |
| GET | /api/auth/verify | 验证Token |
| PUT | /api/auth/password | 修改密码 |

### 管理端接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/dashboard | 获取仪表盘数据 |
| GET | /api/admin/tables | 获取桌位管理列表 |
| POST | /api/admin/tables | 创建桌位 |
| PUT | /api/admin/tables/:id | 更新桌位状态 |
| DELETE | /api/admin/tables/:id | 删除桌位 |
| GET | /api/admin/dishes | 获取菜品列表 |
| POST | /api/admin/dishes | 创建菜品 |
| PUT | /api/admin/dishes/:id | 更新菜品 |
| DELETE | /api/admin/dishes/:id | 删除菜品 |
| GET | /api/admin/categories | 获取分类列表 |
| POST | /api/admin/categories | 创建分类 |
| GET | /api/admin/orders | 获取订单列表 |
| PUT | /api/admin/orders/:id/status | 更新订单状态 |
| GET | /api/admin/inventory | 获取库存列表 |
| POST | /api/admin/inventory | 创建库存项 |
| PUT | /api/admin/inventory/:id | 更新库存 |
| DELETE | /api/admin/inventory/:id | 删除库存项 |
| POST | /api/admin/upload | 上传图片 |

## 数据模型

### 核心实体

```
用户（User）
├── id: string
├── username: string
├── password: string (加密)
├── role: 'customer' | 'admin'
├── name: string | null
└── phone: string | null

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
├── tags: string[]
├── specs: string[]
├── status: 'on_sale' | 'off_sale'
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
└── created_at/updated_at
```

## 默认账号

管理员默认账号：
- 用户名：`admin`
- 密码：`admin123`

首次登录后建议立即修改密码。

## 配置说明

### 前端配置

前端开发服务器默认运行在 `http://localhost:3000`，通过Vite代理将 `/api` 请求转发到后端服务。

### 后端配置

后端服务默认运行在 `http://localhost:3001`，可通过环境变量 `PORT` 修改端口。

## 安全说明

- 密码使用 bcrypt 进行加密存储
- API使用 JWT 进行身份认证
- 管理端路由设有导航守卫，未登录用户将被重定向到登录页

## 开发规范

### 代码风格

- 使用 TypeScript 编写，确保类型安全
- Vue组件采用 `<script setup>` 语法
- 使用 Composition API

### 目录约定

- `views/` - 页面组件
- `components/` - 可复用组件
- `stores/` - Pinia状态管理
- `api/` - API请求封装
- `types/` - TypeScript类型定义

## 许可证

本项目使用MIT许可证，仅供学习和研究使用。
