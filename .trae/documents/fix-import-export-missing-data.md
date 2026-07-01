# 修复导入导出数据缺失问题

## 摘要

当前 RLRMS 项目的导入导出功能存在数据缺失:用户列表(users)数据完全未纳入导入导出。经深入排查,还发现订单导入遗漏 `user_id` 字段、订单项导入字段名与表结构不匹配(会导致导入失败)、订单修改记录表未处理、manifest 字段名不一致等多个关联问题。本计划将一次性修复所有问题,确保导入导出覆盖全部业务数据且字段映射正确。

## 当前状态分析

### 架构概览
- 后端:`server/src/routes/admin.ts` 提供 `GET /admin/export`(导出 ZIP)和 `POST /admin/import`(导入 ZIP)
- 前端 API:`src/api/index.ts` 的 `exportData()` / `importData(file)`
- 前端 UI:`src/admin/views/SettingsView.vue` 的"数据管理"区域 + 导入预览模态框
- 数据格式:ZIP 包,内含 `data/*.json`(数据)和 `sources/`(图片)

### 已发现的问题清单

#### 问题 1【严重】users 表完全未纳入导入导出
- 数据库表 `users` 存在完整 CRUD([admin.ts:1024-1170](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1024-L1170))和前端管理页(`UsersView.vue`)
- 但导出端点([admin.ts:1781-1787](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1781-L1787))未查询 users
- 导入端点([admin.ts:1556-1562](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1556-L1562))未清空/插入 users
- manifest counts([admin.ts:1805-1814](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1805-L1814))、stats([admin.ts:1541-1550](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1541-L1550))、`ImportManifest` 接口([admin.ts:1472-1481](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1472-L1481))均未包含 users
- 前端预览([SettingsView.vue:633-659](file:///c:/Users/LX/Desktop/RLRMS/src/admin/views/SettingsView.vue#L633-L659))未显示用户统计

#### 问题 2【严重】orders 导入遗漏 user_id 字段
- `orders` 表结构含 `user_id TEXT` 字段及外键([init.ts:64-79](file:///c:/Users/LX/Desktop/RLRMS/server/src/db/init.ts#L64-L79))
- 导出用 `SELECT * FROM orders`,JSON 中**包含** user_id
- 但导入 SQL([admin.ts:1626](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1626))的列清单和 VALUES 占位符均**缺少 user_id**
- `OrderData` 接口([admin.ts:1486-1498](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1486-L1498))也缺少 user_id
- 后果:导入订单后所有订单 user_id 变为 NULL,丢失订单与用户的关联

#### 问题 3【严重】order_items 导入字段名与表结构不匹配(导入会失败)
- `order_items` 表实际字段名为 `unit_price` 和 `spec`([init.ts:82-95](file:///c:/Users/LX/Desktop/RLRMS/server/src/db/init.ts#L82-L95),订单创建处 [orders.ts:308](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/orders.ts#L308) 也用 `unit_price`/`spec`)
- 但导入 SQL([admin.ts:1646](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1646))用的是 `price` 和 `specs`(列不存在)
- `OrderItemData` 接口([admin.ts:1503-1513](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1503-L1513))也用 `price`/`specs`
- 后果:导入含订单项的订单时,SQLite 报 "no such column: price" 错误,导入失败
- 导出 JSON 字段名是 `unit_price`/`spec`(SELECT *),但导入读 `item.price`/`item.specs` 会得到 undefined

#### 问题 4【中等】order_modifications 表未处理
- `order_modifications` 表([init.ts:98-109](file:///c:/Users/LX/Desktop/RLRMS/server/src/db/init.ts#L98-L109))记录订单修改历史
- 导入时清空了 orders/order_items 但未清空 order_modifications,导入也未重建该表数据
- 后果:导入后订单修改记录与订单不匹配(悬挂外键),数据不一致

#### 问题 5【轻微】manifest 字段名不一致
- `ImportManifest` 接口用 `exportDate`([admin.ts:1474](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1474))
- 实际 manifest 对象用 `exportedAt`([admin.ts:1804](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1804))
- 前端预览读 `importPreview.exportedAt`([SettingsView.vue:630](file:///c:/Users/LX/Desktop/RLRMS/src/admin/views/SettingsView.vue#L630))
- 导入响应里 `exportDate: manifest.exportDate`([admin.ts:1752](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1752))永远为 undefined
- 后果:导入成功响应中的导出时间丢失(不影响数据,但信息缺失)

## 修改方案

### 决策与假设
- **用户密码处理**:导出时包含 `password` 字段(哈希值),导入时直接写入哈希值,保持用户原密码不变。这是数据备份/恢复的标准做法,确保恢复后用户可用原密码登录。
- **users 导入顺序**:users 表被 orders 表通过 `user_id` 外键引用,需在 orders 之前导入 users。清空顺序也需调整:先清 order_items/order_modifications/orders,再清 users。
- **order_modifications**:一并纳入导入导出,保证数据完整性。该表通过 `order_id` 关联 orders,需在 orders 之后导入。
- **字段名统一**:order_items 导入统一使用表实际字段名 `unit_price` 和 `spec`。
- **manifest 字段统一**:统一使用 `exportedAt`(与前端一致),修正 `ImportManifest` 接口和导入响应。

### 文件 1:`server/src/routes/admin.ts`

#### 1.1 修正 `ImportManifest` 接口(第 1472-1481 行)
- 将 `exportDate?: string` 改为 `exportedAt?: string`(与实际 manifest 输出和前端读取一致)
- 新增 `users?: number` 字段
- 新增 `orderModifications?: number` 字段

#### 1.2 修正 `OrderData` 接口(第 1486-1498 行)
- 新增 `user_id?: string | null` 字段

#### 1.3 修正 `OrderItemData` 接口(第 1503-1513 行)
- 将 `price: number` 改为 `unit_price: number`
- 将 `specs?: string` 改为 `spec?: string`

#### 1.4 修正导入 stats 统计对象(第 1541-1550 行)
- 新增 `users: 0`
- 新增 `orderModifications: 0`

#### 1.5 调整导入清空顺序(第 1556-1562 行)
按外键依赖顺序清空(子表先于父表):
```
DELETE FROM order_items
DELETE FROM order_modifications   ← 新增
DELETE FROM orders
DELETE FROM inventory
DELETE FROM dishes
DELETE FROM categories
DELETE FROM tables
DELETE FROM users                 ← 新增
```
注:settings 表使用 `INSERT OR REPLACE`,无需清空。

#### 1.6 新增 users 导入逻辑(在导入 categories 之前,即第 1564 行之前插入)
- 读取 `data/users.json`
- INSERT INTO users (id, username, password, role, phone, name, created_at, updated_at)
- 注意:password 直接写入导出的哈希值,保持原密码
- 累加 `stats.users`

#### 1.7 修正 orders 导入 SQL(第 1625-1639 行)
- INSERT 列清单新增 `user_id`
- VALUES 新增 `?` 占位符
- 参数列表新增 `order.user_id ?? null`

#### 1.8 修正 order_items 导入 SQL(第 1645-1658 行)
- 将 SQL 中的 `price` 改为 `unit_price`
- 将 SQL 中的 `specs` 改为 `spec`
- 参数 `item.price` 改为 `item.unit_price`
- 参数 `item.specs` 改为 `item.spec`

#### 1.9 新增 order_modifications 导入逻辑(在 orders 导入之后,即第 1663 行之后插入)
- 读取 `data/order_modifications.json`
- INSERT INTO order_modifications (id, order_id, dish_id, dish_name, quantity_delta, unit_price, spec, created_at)
- 累加 `stats.orderModifications`

#### 1.10 修正导入响应(第 1750-1754 行)
- 将 `exportDate: manifest.exportDate` 改为 `exportedAt: manifest.exportedAt`

#### 1.11 修正导出端点数据收集(第 1781-1787 行)
- 新增 `const users = all('SELECT * FROM users ORDER BY created_at ASC')`
- 新增 `const orderModifications = all('SELECT * FROM order_modifications ORDER BY order_id, created_at')`

#### 1.12 修正 manifest counts(第 1805-1814 行)
- 新增 `users: users.length`
- 新增 `orderModifications: orderModifications.length`

#### 1.13 修正导出 ZIP 文件添加(第 1849-1855 行)
- 新增 `archive.append(JSON.stringify(users, null, 2), { name: 'data/users.json' })`
- 新增 `archive.append(JSON.stringify(orderModifications, null, 2), { name: 'data/order_modifications.json' })`

#### 1.14 修正导出注释(第 1775 行)
- 更新注释,补充"用户"和"订单修改记录"

### 文件 2:`src/admin/views/SettingsView.vue`

#### 2.1 新增用户统计项(第 633-659 行的 stats-list 内)
在导入预览模态框的统计列表中,新增用户数量显示项:
```html
<div class="stat-item" v-if="importPreview.counts.users">
  <span>用户数量</span>
  <span>{{ importPreview.counts.users }}</span>
</div>
```
位置:建议放在"订单数量"之后,保持与导出顺序一致。

## 验证步骤

1. **类型检查**:运行 `npm run build`(或 tsc)确认 TypeScript 无类型错误
2. **导出验证**:
   - 启动服务,登录后台,进入"设置 > 数据管理"
   - 点击导出,下载 ZIP
   - 解压 ZIP,确认 `data/users.json` 和 `data/order_modifications.json` 存在且内容正确
   - 确认 `data/manifest.json` 的 counts 包含 `users` 和 `orderModifications`
   - 确认 `data/orders.json` 中订单对象包含 `user_id` 字段
3. **导入预览验证**:
   - 选择刚导出的 ZIP 文件
   - 确认预览模态框显示"用户数量"统计项
   - 确认导出时间显示正确(非"未知")
4. **导入验证**:
   - 在导入前记录数据库中 users、orders、order_items、order_modifications 的数据
   - 执行导入
   - 导入后查询确认:
     - users 表数据已恢复(且可用原密码登录)
     - orders 表 user_id 字段已正确填充(非 NULL)
     - order_items 表 unit_price 字段已正确填充
     - order_modifications 表数据已恢复
5. **回归验证**:确认导入后菜品、桌位、分类、库存、设置、图片均正常

## 影响范围
- 修改 2 个文件:`server/src/routes/admin.ts`、`src/admin/views/SettingsView.vue`
- 不涉及数据库结构变更(所有表已存在)
- 不涉及前端 API 层变更(`exportData`/`importData` 接口签名不变)
- 向后兼容:旧备份 ZIP(无 users.json)导入时,users 导入逻辑会因找不到 entry 而跳过,不影响其他数据导入;但旧备份导入后 users 表会被清空(因清空逻辑调整),需在导入前提示用户。考虑到此功能为数据恢复场景,此行为可接受。
