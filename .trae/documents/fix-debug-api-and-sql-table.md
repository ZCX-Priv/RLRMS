# 补充 API 调试接口 + 修复 SQL 表格高度自适应

## 摘要

两个问题:
1. **API 调试接口缺失**:前端调试面板(`DebugToolsPanel.vue`)的 API Tab 列出了 28 个管理端端点,但后端实际有 39 个管理端端点,缺失 7 个功能性接口(3 个 reorder 排序、图片上传/删除、数据导入/导出)。需补充这些接口到调试面板。
2. **SQL 表格高度不自适应**:`.result-table-wrap` 设置了 `flex: 1`,导致表格容器撑满父容器剩余空间,即使只有 1 行数据也会出现大量空白。需移除 `flex: 1`,保留 `max-height`,实现高度自适应。

## 当前状态分析

### 问题 1:API 调试接口缺失

调试面板的 API 列表定义在 [DebugToolsPanel.vue:48-125](file:///c:/Users/LX/Desktop/RLRMS/src/admin/components/DebugToolsPanel.vue#L48-L125) 的 `apiGroups` 数组,共 8 组 28 个端点。

后端 [admin.ts](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts) 共 39 个管理端端点,缺失的 7 个功能性接口:

| 方法 | 路径 | 说明 | body 格式 | 位置 |
|------|------|------|-----------|------|
| PUT | /admin/dishes/reorder | 菜品排序 | `{"orders":[{"id":"xxx","sort_order":0}]}` | [admin.ts:433](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L433) |
| PUT | /admin/categories/reorder | 分类排序 | 同上 | [admin.ts:618](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L618) |
| PUT | /admin/inventory/reorder | 库存排序 | 同上 | [admin.ts:946](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L946) |
| POST | /admin/upload | 上传图片 | multipart/form-data (字段 image) | [admin.ts:1370](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1370) |
| DELETE | /admin/image | 删除图片 | `{"url":"/sources/xxx.webp"}` | [admin.ts:1420](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1420) |
| POST | /admin/import | 数据导入 | multipart/form-data (字段 file) | [admin.ts:1529](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1529) |
| GET | /admin/export | 数据导出 | 无(返回 ZIP) | [admin.ts:1838](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1838) |

不补充的 3 个接口:
- `GET /admin/events` — SSE 长连接,不适合手动触发
- `POST /admin/debug/query` — 已被 SQL Tab 内部使用
- `GET /admin/debug/schema` — 已被 SQL Tab 内部使用

调试器请求发送逻辑在 [DebugToolsPanel.vue:254-321](file:///c:/Users/LX/Desktop/RLRMS/src/admin/components/DebugToolsPanel.vue#L254-L321) 的 `sendApiRequest` 函数,支持 JSON body、路径参数、查询参数,响应已能处理 ZIP(返回 `[Binary ZIP data]`)。不支持 multipart/form-data 文件上传,因此文件上传接口列出但在描述中标注。

### 问题 2:SQL 表格高度不自适应

表格包裹层样式在 [DebugToolsPanel.vue:924-934](file:///c:/Users/LX/Desktop/RLRMS/src/admin/components/DebugToolsPanel.vue#L924-L934):

```css
:deep(.result-table-wrap) {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-height: 240px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  flex: 1;          /* ← 问题根因:撑满父容器剩余空间 */
}
```

父容器 `.sql-result`([DebugToolsPanel.vue:901-909](file:///c:/Users/LX/Desktop/RLRMS/src/admin/components/DebugToolsPanel.vue#L901-L909))是 `flex: 1; display: flex; flex-direction: column`,占据剩余空间。由于 `.result-table-wrap` 也设置了 `flex: 1`,它会撑满 `.sql-result` 的全部剩余高度,导致数据少时出现大量空白。

## 修改方案

### 文件:`src/admin/components/DebugToolsPanel.vue`

#### 修改 1:补充缺失的 API 端点(第 48-125 行 apiGroups 数组)

**1a. 菜品管理分组(第 66-75 行)**:在 `DELETE /admin/dishes/:id` 之前添加 reorder 接口
```typescript
{ method: 'PUT', path: '/admin/dishes/reorder', description: '菜品排序', defaultBody: '{\n  "orders": [\n    { "id": "菜品ID", "sort_order": 0 }\n  ]\n}' },
```

**1b. 分类管理分组(第 76-84 行)**:在 `DELETE /admin/categories/:id` 之前添加 reorder 接口
```typescript
{ method: 'PUT', path: '/admin/categories/reorder', description: '分类排序', defaultBody: '{\n  "orders": [\n    { "id": "分类ID", "sort_order": 0 }\n  ]\n}' },
```

**1c. 库存管理分组(第 96-105 行)**:在 `PUT /admin/inventory/:id` 之前添加 reorder 接口
```typescript
{ method: 'PUT', path: '/admin/inventory/reorder', description: '库存排序', defaultBody: '{\n  "orders": [\n    { "id": "库存ID", "sort_order": 0 }\n  ]\n}' },
```

**1d. 新增"图片管理"分组**(在库存管理分组之后,用户管理之前)
```typescript
{
  name: '图片管理',
  icon: Upload,
  endpoints: [
    { method: 'POST', path: '/admin/upload', description: '上传图片（需文件上传，调试器暂不支持直接发送）' },
    { method: 'DELETE', path: '/admin/image', description: '删除图片', defaultBody: '{\n  "url": "/sources/xxx.webp"\n}' }
  ]
},
```

**1e. 新增"数据管理"分组**(在系统设置分组之后)
```typescript
{
  name: '数据管理',
  icon: Download,
  endpoints: [
    { method: 'GET', path: '/admin/export', description: '数据导出（返回 ZIP 文件）' },
    { method: 'POST', path: '/admin/import', description: '数据导入（需文件上传，调试器暂不支持直接发送）' }
  ]
}
```

#### 修改 2:导入新图标(第 5-9 行)

在 lucide-vue-next 导入中添加 `Upload` 和 `Download` 图标:
```typescript
import {
  Table2, Play, Send, Trash2, Hash, ChevronRight, Copy, AlertCircle, CheckCircle2,
  Database, RefreshCw, LayoutDashboard, Armchair, UtensilsCrossed, FolderOpen,
  ClipboardList, Package, UserCircle, Settings, Upload, Download
} from 'lucide-vue-next'
```

#### 修改 3:移除 SQL 表格的 flex:1(第 924-934 行)

```css
:deep(.result-table-wrap) {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-height: 240px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  /* 移除 flex: 1,让表格高度根据内容自适应,最多 240px */
}
```

## 决策与假设
- **只补充管理端 API**:调试面板是管理端工具,当前只列出 `/admin/*` 端点,不补充公共/客户端 API(菜品、桌位、订单、认证等公共路由)。
- **文件上传接口列出但标注**:POST /admin/upload 和 POST /admin/import 需要 multipart/form-data,调试器当前不支持。列出这些接口让用户知晓其存在,在描述中标注"需文件上传,调试器暂不支持直接发送"。不为文件上传添加 UI 支持(避免过度工程化)。
- **GET /admin/export 可正常调试**:调试器已能处理 ZIP 响应(返回 `[Binary ZIP data]`),无需特殊处理。
- **SQL 表格移除 flex:1**:移除后表格高度根据内容自适应,最多 240px(由 max-height 限制),数据多时出现滚动条,数据少时不留空白。

## 验证步骤

1. **类型检查**:运行 `npx vue-tsc --noEmit -p tsconfig.json` 确认无类型错误
2. **API 列表验证**:
   - 启动服务,进入调试工具 API Tab
   - 确认新增"图片管理"和"数据管理"两个分组
   - 确认菜品/分类/库存管理分组中新增了 reorder 接口
   - 确认每个新增端点展开后有正确的默认 body
3. **API 调试验证**:
   - 测试 DELETE /admin/image:填入有效图片 URL,确认请求发送成功
   - 测试 GET /admin/export:确认返回 `[Binary ZIP data]`
   - 测试 PUT /admin/dishes/reorder:确认请求发送成功
4. **SQL 表格高度验证**:
   - 进入调试工具 SQL Tab
   - 执行 `SELECT * FROM categories`(数据较少),确认表格高度紧贴内容,无大量空白
   - 执行 `SELECT * FROM orders`(数据较多),确认表格高度不超过 240px,出现滚动条
   - 点击 schema 中的表预览,确认表格高度同样自适应

## 影响范围
- 修改 1 个文件:`src/admin/components/DebugToolsPanel.vue`
- 不涉及后端修改
- 不涉及数据库修改
- 不影响现有功能
