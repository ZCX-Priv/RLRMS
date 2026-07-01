# 修复登录后跳转失效 Bug

## 问题描述

如果第一次登录失败，第二次登录时第一次点击登录按钮会弹出"登录成功"toast，但不进入管理首页，需要再点一次才能进入。

## 根因分析

**Bug 触发链路：登录失败的 401 误触发全局 `auth:expired` 事件，污染了 redirect query 参数。**

### 故障时序

**第一次登录（失败）：**
1. 用户在 `/admin/login` 输入错误密码，点击登录
2. [LoginView.vue:30](file:///c:/Users/LX/Desktop/RLRMS/src/admin/views/LoginView.vue#L30) 调用 `api.login()`
3. 后端 [auth.ts:95](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/auth.ts#L95) 返回 HTTP 401
4. API 层 [api/index.ts:95-103](file:///c:/Users/LX/Desktop/RLRMS/src/api/index.ts#L95-L103) 的 401 处理器被触发（因为 `api.login()` 未设置 `skip401Handler: true`）
5. 401 处理器派发 `auth:expired` 事件，`detail.redirect = window.location.pathname = '/admin/login'`
6. [App.vue:25-32](file:///c:/Users/LX/Desktop/RLRMS/src/App.vue#L25-L32) 的 `handleAuthExpired` 执行 `router.push({ path: '/admin/login', query: { redirect: '/admin/login' } })`
7. URL 被污染为 `/admin/login?redirect=/admin/login`

**第二次登录，第一次点击（成功但不跳转）：**
1. `api.login()` 成功，显示"登录成功"toast
2. [LoginView.vue:35-36](file:///c:/Users/LX/Desktop/RLRMS/src/admin/views/LoginView.vue#L35-L36) 读取 `route.query.redirect` = `'/admin/login'`（被污染的值）
3. `router.push('/admin/login')` —— 跳转回登录页自身，停留在原页面

**第二次登录，第二次点击（成功且跳转）：**
1. 此时 URL 为 `/admin/login`（query 已被上一次 push 清除）
2. `route.query.redirect` 为 `undefined`
3. `router.push(undefined || '/admin')` —— 成功进入管理首页

## 修复方案

**核心修复：为 `api.login()` 添加 `skip401Handler: true`。**

登录接口的 401 表示"用户名或密码错误"，并非"会话过期"，不应触发全局登出与跳转逻辑。`skip401Handler` 选项已在 [api/index.ts:51](file:///c:/Users/LX/Desktop/RLRMS/src/api/index.ts#L51) 定义并在 [api/index.ts:95](file:///c:/Users/LX/Desktop/RLRMS/src/api/index.ts#L95) 检查，只需在 login 方法中启用即可。

### 修改文件

**[src/api/index.ts](file:///c:/Users/LX/Desktop/RLRMS/src/api/index.ts#L254-L259)（第 254-259 行）**

修改前：
```ts
async login(username: string, password: string) {
  return request<{ success: boolean; data: AuthResponse }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
},
```

修改后：
```ts
async login(username: string, password: string) {
  return request<{ success: boolean; data: AuthResponse }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
    skip401Handler: true,
  })
},
```

### 为什么只改这一处

- 此修改从源头切断了"登录失败 → 派发 auth:expired → 污染 redirect"的错误链路
- 登录失败后，401 不再触发全局处理器，[LoginView.vue:38](file:///c:/Users/LX/Desktop/RLRMS/src/admin/views/LoginView.vue#L38) 的 catch 块正常显示"用户名或密码错误"，URL 保持 `/admin/login` 不被污染
- 下次登录成功时 `route.query.redirect` 为 `undefined`，`router.push('/admin')` 正常跳转
- 不改动 LoginView、App.vue、路由守卫，保持改动最小化

## 验证步骤

1. 启动前后端服务
2. 访问 `/admin/login`，输入错误密码（如 admin / wrong），点击登录 —— 应显示"用户名或密码错误"，URL 保持 `/admin/login`（无 query 参数）
3. 输入正确密码（admin / admin123），点击登录 —— 应显示"登录成功"toast 并**立即**进入 `/admin` 管理首页（只需点击一次）
4. 运行 `npm run build` 确认无编译错误
