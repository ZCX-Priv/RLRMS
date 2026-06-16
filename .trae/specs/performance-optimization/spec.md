# 大规模性能优化 Spec

## Why
当前服务器启动速度慢（tsx 编译 + 数据库初始化阻塞），网站首次加载时间长（缺少构建优化、资源预加载、代码分割优化等），影响开发效率和用户体验。服务器带宽仅 3M，需要特别优化资源传输效率。

## What Changes
- 优化服务器启动流程（延迟初始化、编译缓存）
- 优化 Vite 构建配置（代码分割、压缩、预加载）
- 添加资源预加载和预连接
- 优化图片加载策略（懒加载、压缩、WebP）
- 添加服务端响应压缩
- 优化 IndexedDB 初始化
- **针对低带宽优化（3M 带宽）**
  - 更激进的代码分割（更小的 chunk）
  - API 响应精简（按需返回字段）
  - 图片尺寸优化和格式转换
  - 静态资源缓存策略
  - 请求合并和去重

## Impact
- Affected specs: 性能优化
- Affected code:
  - `vite.config.ts` - 构建配置
  - `server/src/index.ts` - 服务器启动
  - `server/src/db/init.ts` - 数据库初始化
  - `server/src/routes/*.ts` - API 响应优化
  - `index.html` - 资源预加载
  - `src/main.ts` - 应用初始化
  - `src/utils/storage.ts` - IndexedDB 初始化
  - `src/client/components/DishCard.vue` - 图片优化

## ADDED Requirements

### Requirement: 服务器启动优化
系统 SHALL 优化服务器启动流程，减少启动时间。

#### Scenario: 数据库延迟初始化
- **WHEN** 服务器启动
- **THEN** 数据库初始化不阻塞服务器监听
- **AND** 首次请求时确保数据库已就绪

#### Scenario: 开发模式热更新优化
- **WHEN** 开发模式下文件变更
- **THEN** 仅重新编译变更的模块
- **AND** 保持编译缓存

### Requirement: Vite 构建优化
系统 SHALL 优化 Vite 构建配置以减少包体积和提升加载速度。

#### Scenario: 代码分割优化
- **WHEN** 执行生产构建
- **THEN** 第三方库（vue、vue-router、pinia）被分离到独立 chunk
- **AND** 大型组件被分离到独立 chunk
- **AND** 每个 chunk 大小控制在 200KB 以内（适应 3M 带宽）

#### Scenario: 压缩优化
- **WHEN** 执行生产构建
- **THEN** CSS 和 JS 被最小化压缩
- **AND** 移除 console.log 语句（生产环境）
- **AND** 启用 gzip/brotli 压缩

#### Scenario: 预加载提示
- **WHEN** 构建完成
- **THEN** 生成模块预加载提示
- **AND** 关键路由组件被预加载

### Requirement: 资源预加载
系统 SHALL 添加关键资源预加载以加速首次渲染。

#### Scenario: DNS 预连接
- **WHEN** 用户访问页面
- **THEN** 预连接到 API 服务器
- **AND** 减少网络请求延迟

#### Scenario: 关键资源预加载
- **WHEN** HTML 文档加载
- **THEN** 预加载关键 CSS
- **AND** 预加载首页所需的 API 数据

### Requirement: 图片加载优化
系统 SHALL 优化图片加载策略，特别针对低带宽环境。

#### Scenario: 图片懒加载
- **WHEN** 页面包含多张图片
- **THEN** 仅加载视口内的图片
- **AND** 滚动时延迟加载其他图片

#### Scenario: 图片占位符
- **WHEN** 图片正在加载
- **THEN** 显示适当的占位符或骨架屏
- **AND** 避免布局偏移

#### Scenario: 图片尺寸优化
- **WHEN** 上传菜品图片
- **THEN** 自动压缩图片质量
- **AND** 限制图片最大尺寸（宽度 800px）
- **AND** 转换为 WebP 格式（如果浏览器支持）

### Requirement: 服务端响应优化
系统 SHALL 对 API 响应进行优化以适应低带宽环境。

#### Scenario: Gzip 压缩
- **WHEN** 客户端请求 API
- **THEN** 服务端返回 gzip 压缩的响应
- **AND** 减少传输数据量 60% 以上

#### Scenario: 响应字段精简
- **WHEN** 获取菜品列表
- **THEN** 仅返回必要字段（id、name、price、image_url、category_name、status）
- **AND** 详情接口返回完整信息

#### Scenario: 静态资源缓存
- **WHEN** 客户端请求静态资源
- **THEN** 设置合理的缓存头（Cache-Control）
- **AND** 图片资源缓存 7 天
- **AND** JS/CSS 资源使用内容哈希命名

### Requirement: IndexedDB 初始化优化
系统 SHALL 优化 IndexedDB 初始化过程。

#### Scenario: 异步初始化
- **WHEN** 应用启动
- **THEN** IndexedDB 初始化不阻塞应用渲染
- **AND** 首次访问时按需初始化

### Requirement: 首屏数据预取
系统 SHALL 优化首屏数据加载。

#### Scenario: 并行数据请求
- **WHEN** 首页加载
- **THEN** 分类和菜品数据并行请求
- **AND** 减少总等待时间

### Requirement: 低带宽专项优化
系统 SHALL 针对 3M 带宽环境进行专项优化。

#### Scenario: Chunk 大小控制
- **WHEN** 执行生产构建
- **THEN** 单个 JS chunk 不超过 200KB
- **AND** 单个 CSS chunk 不超过 50KB
- **AND** 首屏总资源不超过 500KB

#### Scenario: 请求合并
- **WHEN** 首页加载
- **THEN** 分类和菜品数据可合并为单一请求
- **AND** 减少网络往返次数

#### Scenario: 渐进式加载
- **WHEN** 用户浏览菜品列表
- **THEN** 先加载文字信息
- **AND** 图片延迟加载
- **AND** 优先加载视口内图片

## MODIFIED Requirements
无

## REMOVED Requirements
无
