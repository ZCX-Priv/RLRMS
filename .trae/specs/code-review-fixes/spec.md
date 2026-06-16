# 代码审查与修复规范

## Why
项目存在多处代码质量问题、安全隐患和性能问题，需要进行系统性修复以提高代码质量、安全性和运行效率。特别是服务启动慢和首次页面加载时间长的问题需要优先解决。

## What Changes
- 修复 JWT_SECRET 硬编码安全隐患
- 添加后端输入验证 (Zod)
- 优化数据库写入性能
- **优化服务启动速度** - 异步初始化、减少同步操作
- **优化首次页面加载** - 添加加载指示器、使用国内可访问字体
- 修复类型定义问题
- 提取重复代码到公共模块
- 添加请求取消和错误边界处理
- 优化轮询机制

## Impact
- Affected specs: 安全性、性能、代码质量
- Affected code: 
  - `server/src/routes/admin.ts`
  - `server/src/routes/auth.ts`
  - `server/src/routes/orders.ts`
  - `server/src/routes/dishes.ts`
  - `server/src/db/index.ts`
  - `server/src/db/init.ts`
  - `src/api/index.ts`
  - `src/shared/composables/useOrderPolling.ts`
  - `src/stores/app.ts`
  - `index.html`
  - `src/style.css`

## ADDED Requirements

### Requirement: 服务启动性能优化
系统 SHALL 快速启动服务，减少阻塞操作。

#### Scenario: 数据库初始化优化
- **WHEN** 服务器启动时
- **THEN** 数据库初始化应使用批量写入，避免多次磁盘 I/O

#### Scenario: 密码哈希优化
- **WHEN** 创建默认管理员时
- **THEN** 应使用异步 bcrypt.hash() 而非同步版本

### Requirement: 首页加载性能优化
系统 SHALL 提供快速的首次加载体验。

#### Scenario: 加载指示器
- **WHEN** 页面开始加载时
- **THEN** 应立即显示加载指示器，避免白屏

#### Scenario: 字体优化
- **WHEN** 加载字体时
- **THEN** 应使用国内可访问的字体源（如 cdnjs、bootcdn 或本地字体），确保中国用户可正常加载

### Requirement: 安全性增强
系统 SHALL 使用环境变量配置敏感信息，而非硬编码。

#### Scenario: JWT密钥配置
- **WHEN** 服务器启动时
- **THEN** JWT_SECRET 应从环境变量读取，若未配置则抛出错误

### Requirement: 输入验证
系统 SHALL 对所有 API 输入进行验证。

#### Scenario: 请求参数验证
- **WHEN** 客户端发送 API 请求
- **THEN** 服务器应使用 Zod 验证请求参数，无效请求返回 400 错误

### Requirement: 数据库性能优化
系统 SHALL 优化数据库写入频率。

#### Scenario: 批量写入
- **WHEN** 执行多个数据库写操作时
- **THEN** 应支持批量写入或延迟写入以减少磁盘 I/O

### Requirement: 类型安全
系统 SHALL 使用正确的 TypeScript 类型定义。

#### Scenario: Express 中间件类型
- **WHEN** 定义 Express 中间件时
- **THEN** 应使用 `express.Request`、`express.Response`、`express.NextFunction` 类型

### Requirement: 代码复用
系统 SHALL 提取重复代码到公共模块。

#### Scenario: 日期格式化
- **WHEN** 需要格式化日期时
- **THEN** 应使用统一的 `formatDateTime` 工具函数

### Requirement: 请求管理
系统 SHALL 支持请求取消和错误处理。

#### Scenario: 组件卸载取消请求
- **WHEN** 组件卸载时
- **THEN** 应取消进行中的 API 请求

### Requirement: 轮询优化
系统 SHALL 优化轮询机制以减少服务器压力。

#### Scenario: 智能轮询间隔
- **WHEN** 页面不可见时
- **THEN** 应暂停或降低轮询频率

## MODIFIED Requirements

### Requirement: 错误处理
系统 SHALL 提供统一的错误处理机制。

- 添加全局错误处理中间件
- 统一 API 错误响应格式
- 前端统一错误提示

## REMOVED Requirements

### Requirement: 硬编码配置
**Reason**: 安全隐患
**Migration**: 迁移到环境变量配置

### Requirement: Google Fonts
**Reason**: 中国国内无法访问
**Migration**: 使用国内 CDN 或系统字体回退
