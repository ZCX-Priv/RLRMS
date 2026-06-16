# Tasks

- [x] Task 1: 后端添加 cookie-parser 依赖和配置
  - [x] SubTask 1.1: 安装 cookie-parser 包及类型定义
  - [x] SubTask 1.2: 在 server/src/index.ts 中配置 cookie-parser 中间件

- [x] Task 2: 修改后端登录接口设置 httpOnly cookie
  - [x] SubTask 2.1: 修改 server/src/routes/auth.ts 登录接口，设置 httpOnly cookie
  - [x] SubTask 2.2: 添加登出接口清除 cookie

- [x] Task 3: 修改后端认证中间件读取 cookie
  - [x] SubTask 3.1: 修改 server/src/routes/admin.ts 中的 requireAuth 中间件，从 cookie 读取 token

- [x] Task 4: 修改前端认证逻辑
  - [x] SubTask 4.1: 修改 src/stores/auth.ts，移除 localStorage 存储
  - [x] SubTask 4.2: 修改 src/api/index.ts，移除 Authorization header 设置
  - [x] SubTask 4.3: 修改 src/router/index.ts 路由守卫，调用验证接口确认登录状态
  - [x] SubTask 4.4: 修改 LoginView.vue 登录成功后处理逻辑

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2, Task 3]
