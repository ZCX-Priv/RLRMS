# Checklist

- [x] cookie-parser 中间件已正确配置在 Express 应用中
- [x] 登录接口成功设置 httpOnly cookie，包含正确的安全属性
- [x] 登出接口成功清除认证 cookie
- [x] 认证中间件从 cookie 正确读取并验证 token
- [x] 前端 auth store 不再使用 localStorage 存储 token
- [x] 前端 API 请求不再手动添加 Authorization header
- [x] 路由守卫正确调用验证接口确认登录状态
- [x] 未登录访问 admin 路由时正确重定向到登录页
- [x] 登录成功后正确跳转到目标页面
- [x] 登出后正确跳转到登录页
- [x] Cookie 有效期为 1 天
