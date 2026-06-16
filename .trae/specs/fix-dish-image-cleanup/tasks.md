# Tasks

- [x] Task 1: 修复菜品删除时图片同步删除功能
  - [x] SubTask 1.1: 在删除菜品API中，先获取菜品的image_url
  - [x] SubTask 1.2: 删除菜品数据库记录后，检查图片是否被其他菜品使用
  - [x] SubTask 1.3: 如果图片未被其他菜品使用，删除图片文件

- [x] Task 2: 修复编辑菜品时图片变更同步删除功能
  - [x] SubTask 2.1: 在更新菜品API中，先获取菜品当前的image_url
  - [x] SubTask 2.2: 比较新旧image_url，判断是否发生变化
  - [x] SubTask 2.3: 如果图片发生变化，检查旧图片是否被其他菜品使用
  - [x] SubTask 2.4: 如果旧图片未被其他菜品使用，删除旧图片文件

# Task Dependencies
- Task 2 依赖 Task 1（共享图片删除逻辑，可抽取为辅助函数）
