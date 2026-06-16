# 数据导入/导出功能规格

## Why
当前系统缺乏数据备份和迁移能力，用户无法方便地备份重要业务数据或在系统间迁移数据。需要提供数据导入/导出功能，让管理员能够安全地备份和恢复系统数据。

## What Changes
- 在管理后台设置页面添加"数据管理"区域
- 添加"导出数据"按钮，支持导出所有重要业务数据为 ZIP 压缩包
- 添加"导入数据"按钮，支持从 ZIP 压缩包导入数据
- 支持导出/导入的数据类型：
  - 订单列表（data/orders.json）
  - 桌位信息（data/tables.json）
  - 菜品数据（data/dishes.json，含菜品顺序）
  - 菜品图片（sources/ 目录下的图片文件）
  - 分类数据（data/categories.json，含分类顺序）
  - 库存数据（data/inventory.json，含库存顺序）
  - 系统设置（data/settings.json）

## Impact
- Affected specs: 管理后台设置页面
- Affected code:
  - `src/admin/views/SettingsView.vue` - 添加导入/导出按钮和交互逻辑
  - `src/api/index.ts` - 添加导入/导出 API 调用
  - `server/src/routes/admin.ts` - 添加导入/导出 API 端点
- 新增依赖: archiver（用于创建 ZIP 文件）、adm-zip（用于解压 ZIP 文件）

## ADDED Requirements

### Requirement: 数据导出功能
系统 SHALL 提供数据导出功能，允许管理员将系统数据导出为 ZIP 压缩包。

#### Scenario: 导出所有数据
- **WHEN** 管理员点击"导出数据"按钮
- **THEN** 系统应生成包含所有业务数据的 ZIP 压缩包并自动下载
- **AND** ZIP 压缩包应包含：
  - `data/` 目录: 包含各类型数据的 JSON 文件
    - `orders.json`: 订单列表（含订单项）
    - `tables.json`: 桌位信息
    - `dishes.json`: 菜品数据
    - `categories.json`: 分类数据
    - `inventory.json`: 库存数据
    - `settings.json`: 系统设置
    - `manifest.json`: 元数据（版本号、导出时间等）
  - `sources/` 目录: 包含所有菜品图片文件（保持原始文件名和目录结构）

#### Scenario: 导出成功提示
- **WHEN** 数据导出完成
- **THEN** 系统应显示"数据导出成功"提示

### Requirement: 数据导入功能
系统 SHALL 提供数据导入功能，允许管理员从 ZIP 压缩包恢复系统数据。

#### Scenario: 选择导入文件
- **WHEN** 管理员点击"导入数据"按钮
- **THEN** 系统应打开文件选择对话框，仅允许选择 .zip 文件

#### Scenario: 导入数据预览
- **WHEN** 管理员选择有效的 ZIP 文件
- **THEN** 系统应显示导入预览，包含：
  - 备份文件版本和导出时间
  - 各数据类型的数量统计
  - 包含的图片数量
  - 导入警告提示（将覆盖现有数据）

#### Scenario: 确认导入
- **WHEN** 管理员确认导入操作
- **THEN** 系统应：
  - 清除现有数据
  - 从 ZIP 中读取各 JSON 文件并导入对应数据
  - 将图片文件从 ZIP 解压到 public/sources 目录
  - 显示"数据导入成功"提示

#### Scenario: 导入文件格式错误
- **WHEN** 管理员选择无效的 ZIP 文件或缺少必要文件
- **THEN** 系统应显示"文件格式错误，请选择有效的数据备份文件"提示

### Requirement: 导入数据安全性
系统 SHALL 确保数据导入操作的安全性。

#### Scenario: 导入确认
- **WHEN** 管理员执行导入操作
- **THEN** 系统应显示确认对话框，明确提示"此操作将覆盖现有数据"

#### Scenario: 导入过程不可中断
- **WHEN** 数据导入正在进行
- **THEN** 系统应显示加载状态，防止用户进行其他操作

### Requirement: 导出文件格式规范
系统 SHALL 使用标准化的 ZIP 格式导出数据。

#### Scenario: 文件命名
- **WHEN** 导出数据
- **THEN** 文件名格式应为 `restaurant-backup-YYYY-MM-DD.zip`

#### Scenario: ZIP 文件结构
- **WHEN** 导出数据
- **THEN** ZIP 文件应包含以下结构：
```
restaurant-backup-YYYY-MM-DD.zip
├── data/
│   ├── manifest.json
│   ├── orders.json
│   ├── tables.json
│   ├── dishes.json
│   ├── categories.json
│   ├── inventory.json
│   └── settings.json
└── sources/
    ├── 1771213458254-991280184.webp
    ├── 1771214016048-391097419.webp
    └── ...
```

#### Scenario: manifest.json 结构
- **WHEN** 导出数据
- **THEN** manifest.json 应包含以下结构：
```json
{
  "version": "1.0",
  "exportedAt": "ISO日期时间",
  "counts": {
    "orders": 10,
    "tables": 5,
    "dishes": 20,
    "categories": 3,
    "inventory": 8,
    "images": 15
  }
}
```
