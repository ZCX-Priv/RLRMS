# localStorage 迁移至 IndexedDB 规范

## Why
localStorage 存在存储容量限制（通常 5-10MB）且为同步操作，可能阻塞主线程。IndexedDB 提供更大的存储容量和异步 API，更适合现代 Web 应用的数据存储需求。

## What Changes
- 创建通用的 IndexedDB 存储工具/composable
- 将搜索历史从 localStorage 迁移至 IndexedDB
- 将主题设置从 localStorage 迁移至 IndexedDB
- 更新清除缓存功能以支持 IndexedDB

## Impact
- Affected code:
  - `src/stores/app.ts` - 主题存储
  - `src/client/views/SearchView.vue` - 搜索历史
  - `src/client/views/SettingsView.vue` - 清除缓存

## ADDED Requirements

### Requirement: IndexedDB 存储工具
系统应提供通用的 IndexedDB 存储工具，支持键值对存储操作。

#### Scenario: 存储数据
- **WHEN** 调用存储方法保存数据
- **THEN** 数据应被异步存储到 IndexedDB 中

#### Scenario: 读取数据
- **WHEN** 调用读取方法获取数据
- **THEN** 应返回存储的数据或默认值

#### Scenario: 删除数据
- **WHEN** 调用删除方法
- **THEN** 指定的数据应从 IndexedDB 中移除

#### Scenario: 清空所有数据
- **WHEN** 调用清空方法
- **THEN** 所有存储的数据应被清除

### Requirement: 搜索历史存储迁移
搜索历史应使用 IndexedDB 进行存储。

#### Scenario: 加载搜索历史
- **WHEN** 用户进入搜索页面
- **THEN** 应从 IndexedDB 异步加载搜索历史

#### Scenario: 保存搜索历史
- **WHEN** 用户执行搜索
- **THEN** 搜索关键词应保存到 IndexedDB

#### Scenario: 删除搜索历史
- **WHEN** 用户清空或删除单条搜索历史
- **THEN** 应更新 IndexedDB 中的数据

### Requirement: 主题设置存储迁移
主题设置应使用 IndexedDB 进行存储。

#### Scenario: 加载主题
- **WHEN** 应用初始化
- **THEN** 应从 IndexedDB 加载主题设置

#### Scenario: 保存主题
- **WHEN** 用户切换主题
- **THEN** 新主题应保存到 IndexedDB

### Requirement: 清除缓存功能更新
清除缓存功能应同时清除 IndexedDB 数据。

#### Scenario: 清除所有缓存
- **WHEN** 用户点击清除缓存
- **THEN** 应清除 IndexedDB 中的所有数据
