# Tasks

- [x] Task 1: 安装 ZIP 处理依赖
  - [x] SubTask 1.1: 安装 archiver 包（用于创建 ZIP 文件）
  - [x] SubTask 1.2: 安装 adm-zip 包（用于解压 ZIP 文件）

- [x] Task 2: 添加后端数据导出 API
  - [x] SubTask 2.1: 在 `server/src/routes/admin.ts` 添加 `GET /admin/export` 端点
  - [x] SubTask 2.2: 实现数据收集逻辑，查询所有业务数据（订单、桌位、菜品、分类、库存、设置）
  - [x] SubTask 2.3: 创建 manifest.json，包含版本号、导出时间和数据统计
  - [x] SubTask 2.4: 使用 archiver 创建 ZIP 文件流，添加 data/ 目录下的各 JSON 文件
  - [x] SubTask 2.5: 将 public/sources 目录下的图片添加到 ZIP 的 sources/ 目录
  - [x] SubTask 2.6: 设置响应头（Content-Type、Content-Disposition），返回 ZIP 文件流

- [x] Task 3: 添加后端数据导入 API
  - [x] SubTask 3.1: 在 `server/src/routes/admin.ts` 添加 `POST /admin/import` 端点（使用 multer 处理文件上传）
  - [x] SubTask 3.2: 使用 adm-zip 解压上传的 ZIP 文件到临时目录
  - [x] SubTask 3.3: 验证 ZIP 文件结构（必须包含 data/manifest.json）
  - [x] SubTask 3.4: 读取 manifest.json 获取数据概览
  - [x] SubTask 3.5: 实现数据清除逻辑，清空现有数据表
  - [x] SubTask 3.6: 实现数据导入逻辑，批量插入各 JSON 文件中的数据
  - [x] SubTask 3.7: 将 ZIP 中的 sources/ 目录解压到 public/sources 目录

- [x] Task 4: 添加前端 API 调用
  - [x] SubTask 4.1: 在 `src/api/index.ts` 添加 `exportData()` 方法，处理 ZIP 文件下载
  - [x] SubTask 4.2: 在 `src/api/index.ts` 添加 `importData(file: File)` 方法，上传 ZIP 文件

- [x] Task 5: 更新设置页面 UI
  - [x] SubTask 5.1: 在 `SettingsView.vue` 添加"数据管理"区域
  - [x] SubTask 5.2: 添加"导出数据"按钮，点击触发导出并下载 ZIP 文件
  - [x] SubTask 5.3: 添加"导入数据"按钮，点击打开文件选择器（仅接受 .zip 文件）
  - [x] SubTask 5.4: 添加导入预览模态框，显示版本、导出时间和数据统计
  - [x] SubTask 5.5: 添加导入确认对话框，提示覆盖风险

# Task Dependencies
- Task 2 依赖 Task 1（导出需要 archiver）
- Task 3 依赖 Task 1（导入需要 adm-zip）
- Task 4 依赖 Task 2 和 Task 3（前端 API 需要后端端点）
- Task 5 依赖 Task 4（UI 需要调用前端 API）
