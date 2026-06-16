# Checklist

## Vite 构建优化（低带宽优化）
- [x] vite.config.ts 配置了 manualChunks 代码分割
- [x] vendor chunk 包含 vue、vue-router、pinia
- [x] 每个 JS chunk 不超过 200KB
- [x] 每个 CSS chunk 不超过 50KB
- [x] 生产构建移除 console.log
- [x] CSS 代码分割配置正确
- [x] 资源文件名使用内容哈希
- [x] 构建成功无错误

## 服务器启动优化
- [x] 服务器启动不阻塞在数据库初始化
- [x] 数据库就绪检查中间件正常工作
- [x] 数据库初始化使用批处理优化

## 服务端响应优化（低带宽优化）
- [x] compression 中间件已安装
- [x] API 响应被 gzip 压缩
- [x] 静态资源设置了 Cache-Control 缓存头
- [x] 图片资源缓存 7 天
- [x] 菜品列表 API 返回精简字段

## 资源预加载
- [x] index.html 包含 DNS 预连接
- [x] 关键资源预加载配置正确

## 图片加载优化（低带宽优化）
- [x] DishCard 图片使用懒加载
- [x] 图片加载有占位符
- [x] 图片上传时自动压缩
- [x] 图片尺寸限制为 800px 宽度
- [x] 支持 WebP 格式输出

## IndexedDB 优化
- [x] IndexedDB 初始化不阻塞应用渲染
- [x] 初始化状态正确缓存

## 首页数据合并接口
- [x] 合并接口返回分类和菜品数据
- [x] 前端正确使用合并接口

## 功能验证
- [x] 所有页面正常渲染
- [x] API 请求正常工作
- [x] 购物车功能正常
- [x] 订单流程正常
- [x] 管理后台正常
- [x] 图片上传和显示正常
- [x] 无 TypeScript 类型错误
