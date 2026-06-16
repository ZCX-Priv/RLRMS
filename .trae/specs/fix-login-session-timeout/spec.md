# 登录会话失效问题修复 Spec

## Why
网站在长时间操作后会出现登录失效的问题，用户在管理后台操作时突然被要求重新登录，影响用户体验和工作效率。

## What Changes
- 在 API 请求层添加全局 401 错误处理，自动跳转登录页
- 添加会话保活机制，定期验证 token 有效性
- 优化前端状态管理，确保 token 过期时正确清除用户状态
- 添加用户友好的会话过期提示

## Impact
- Affected specs: 用户认证、会话管理
- Affected code: 
  - `src/api/index.ts` - API 请求拦截器
  - `src/stores/auth.ts` - 认证状态管理
  - `src/router/index.ts` - 路由守卫
  - `src/App.vue` - 应用级别的事件处理

## 问题分析

### 问题1: API 请求没有全局 401 错误处理
**位置**: `src/api/index.ts`

当前实现中，当 API 请求返回 401 状态码时，只是简单地抛出错误：
```typescript
if (!response.ok || !data.success) {
  throw new Error(data.error || 'Request failed')
}
```

**影响**: 用户在操作过程中，如果 token 过期，API 请求会失败但用户不会收到明确提示，也不会自动跳转到登录页面。

### 问题2: 没有会话保活机制
**位置**: 无相关实现

系统没有定期验证 token 有效性的机制。用户可能长时间停留在同一页面，token 过期后前端状态仍然显示已登录，导致后续操作失败。

### 问题3: 前端状态与后端会话不同步
**位置**: `src/stores/auth.ts`

用户状态只存储在 Pinia store（内存）中，没有与 cookie 中的 token 状态同步。当 token 过期时，前端状态不会自动更新。

### 问题4: 路由守卫只在导航时验证
**位置**: `src/router/index.ts`

路由守卫只在页面导航时验证 token，如果用户长时间停留在同一页面进行操作，token 过期后不会有任何提示。

## ADDED Requirements

### Requirement: 全局 401 错误处理
系统 SHALL 在 API 请求返回 401 错误时，自动清除用户登录状态并跳转到登录页面。

#### Scenario: Token 过期时自动跳转
- **WHEN** 用户在管理后台操作时 token 过期
- **THEN** 系统自动清除登录状态，显示会话过期提示，并跳转到登录页面

#### Scenario: 保留重定向路径
- **WHEN** 用户因 token 过期被重定向到登录页
- **THEN** 登录页面保存原始请求路径，登录成功后自动跳转回原页面

### Requirement: 会话保活机制
系统 SHALL 定期验证 token 有效性，确保用户会话状态正确。

#### Scenario: 定期验证 token
- **WHEN** 用户已登录并停留在管理后台
- **THEN** 系统每 5 分钟验证一次 token 有效性

#### Scenario: Token 即将过期提醒
- **WHEN** token 即将过期（剩余时间少于 30 分钟）
- **THEN** 系统显示提示，建议用户保存工作

### Requirement: 用户友好的会话提示
系统 SHALL 在会话相关事件发生时提供清晰的用户提示。

#### Scenario: 会话过期提示
- **WHEN** 用户会话过期
- **THEN** 显示 "会话已过期，请重新登录" 的提示消息

#### Scenario: 登录成功提示
- **WHEN** 用户成功登录
- **THEN** 显示 "登录成功" 的提示消息
