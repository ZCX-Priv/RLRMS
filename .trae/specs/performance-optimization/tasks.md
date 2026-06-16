# Tasks

- [x] Task 1: 优化 Vite 构建配置（低带宽优化）
  - [x] SubTask 1.1: 配置代码分割策略（vendor chunk、common chunk，每个 chunk < 200KB）
  - [x] SubTask 1.2: 配置生产环境移除 console.log
  - [x] SubTask 1.3: 配置 CSS 代码分割和压缩
  - [x] SubTask 1.4: 配置构建分析和 chunk 大小限制警告
  - [x] SubTask 1.5: 配置资源文件名使用内容哈希

- [x] Task 2: 优化服务器启动流程
  - [x] SubTask 2.1: 实现数据库延迟初始化（非阻塞启动）
  - [x] SubTask 2.2: 添加数据库就绪状态检查中间件
  - [x] SubTask 2.3: 优化数据库初始化批处理

- [x] Task 3: 添加服务端响应优化（低带宽优化）
  - [x] SubTask 3.1: 安装 compression 中间件
  - [x] SubTask 3.2: 配置 gzip 压缩
  - [x] SubTask 3.3: 配置静态资源缓存头（Cache-Control）
  - [x] SubTask 3.4: 优化菜品列表 API 响应字段（精简返回）

- [x] Task 4: 优化资源预加载
  - [x] SubTask 4.1: 在 index.html 添加 DNS 预连接
  - [x] SubTask 4.2: 添加关键 CSS 预加载
  - [x] SubTask 4.3: 配置路由预加载策略

- [x] Task 5: 优化图片加载（低带宽优化）
  - [x] SubTask 5.1: 为 DishCard 组件添加图片懒加载
  - [x] SubTask 5.2: 添加图片加载占位符和错误处理
  - [x] SubTask 5.3: 服务端图片上传时自动压缩和尺寸限制
  - [x] SubTask 5.4: 支持 WebP 格式输出

- [x] Task 6: 优化 IndexedDB 初始化
  - [x] SubTask 6.1: 改为懒加载初始化模式
  - [x] SubTask 6.2: 添加初始化状态缓存

- [x] Task 7: 添加首页数据合并接口（低带宽优化）
  - [x] SubTask 7.1: 创建合并接口返回分类和菜品数据
  - [x] SubTask 7.2: 前端适配合并接口

- [x] Task 8: 验证性能优化效果
  - [x] SubTask 8.1: 运行构建检查包大小变化（确保 chunk < 200KB）
  - [x] SubTask 8.2: 测试服务器启动时间
  - [x] SubTask 8.3: 测试网站首次加载时间（模拟 3M 带宽）
  - [x] SubTask 8.4: 验证所有功能正常工作

# Task Dependencies
- [Task 8] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7]
- [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7] 可以并行执行
