# Cookie-Based Admin Authentication Spec

## Why
当前 admin 管理面板使用 localStorage 存储 JWT token，存在安全隐患（XSS 攻击可窃取 token）。需要改为基于 httpOnly cookie 的认证方式，提高安全性，cookie 有效期为 1 天。

## What Changes
- 后端登录接口设置 httpOnly cookie 存储 JWT token
- 后端认证中间件从 cookie 读取 token 进行验证
- 添加登出接口清除 cookie
- 前端移除 localStorage token 存储，改用 cookie 认证
- 前端路由守卫调用验证接口确认登录状态

## Impact
- Affected specs: 认证系统
- Affected code: 
  - `server/src/routes/auth.ts` - 登录接口设置 cookie
  - `server/src/routes/admin.ts` - 认证中间件读取 cookie
  - `server/src/index.ts` - 添加 cookie-parser 中间件
  - `src/stores/auth.ts` - 移除 localStorage 存储
  - `src/router/index.ts` - 路由守卫调用验证接口
  - `src/api/index.ts` - 移除 Authorization header

## ADDED Requirements

### Requirement: Cookie-Based Authentication
系统 SHALL 使用 httpOnly cookie 存储认证 token，而非 localStorage。

#### Scenario: 管理员登录成功
- **WHEN** 管理员提交正确的用户名和密码
- **THEN** 系统生成 JWT token 并设置 httpOnly cookie，有效期为 1 天
- **AND** cookie 属性包含 httpOnly、secure（生产环境）、sameSite

#### Scenario: 管理员访问受保护页面
- **WHEN** 管理员访问 admin 路由
- **THEN** 系统从 cookie 读取 token 并验证有效性
- **AND** 验证通过则允许访问，否则重定向到登录页

#### Scenario: 管理员登出
- **WHEN** 管理员点击登出按钮
- **THEN** 系统清除认证 cookie
- **AND** 重定向到登录页面

#### Scenario: Cookie 过期
- **WHEN** cookie 中的 token 过期
- **THEN** 系统返回 401 错误
- **AND** 前端重定向到登录页面

## MODIFIED Requirements

### Requirement: 登录接口
登录接口 SHALL 在响应中设置 httpOnly cookie，而非仅返回 token 字符串。

### Requirement: 认证中间件
认证中间件 SHALL 从 cookie 中读取 token，而非 Authorization header。

### Requirement: 前端认证状态
前端认证状态 SHALL 通过调用验证接口确认，而非检查 localStorage。
