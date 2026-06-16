# Tasks

- [x] Task 1: 添加全局 401 错误处理机制
  - [x] SubTask 1.1: 在 `src/api/index.ts` 中添加 401 响应拦截器
  - [x] SubTask 1.2: 创建全局事件系统用于处理认证失败
  - [x] SubTask 1.3: 在 App.vue 中监听认证失败事件并处理跳转

- [x] Task 2: 实现会话保活机制
  - [x] SubTask 2.1: 在 auth store 中添加会话保活定时器
  - [x] SubTask 2.2: 实现定期验证 token 有效性的函数
  - [x] SubTask 2.3: 在用户登录后启动保活定时器，登出时清除

- [x] Task 3: 优化认证状态管理
  - [x] SubTask 3.1: 在 auth store 中添加会话过期时间记录
  - [x] SubTask 3.2: 添加 token 即将过期的警告机制
  - [x] SubTask 3.3: 确保登出时正确清除所有认证相关状态

- [x] Task 4: 添加用户友好的提示
  - [x] SubTask 4.1: 会话过期时显示 toast 提示
  - [x] SubTask 4.2: 确保跳转到登录页时携带 redirect 参数

# Task Dependencies
- [Task 2] depends on [Task 3] (会话保活需要先有状态管理优化)
- [Task 4] depends on [Task 1] (提示需要先有错误处理机制)
