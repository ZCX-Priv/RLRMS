# 红灯笼食府管理系统 - 全量性能问题修复计划

## 概述

本计划针对项目所有 CRITICAL + HIGH + MEDIUM 级别性能问题进行系统性修复，目标是**快速、安全**地提升前后端性能。修复策略遵循"最小改动、最大收益、零功能回归"原则。

## 当前状态分析

经过对前后端代码的全面审查，共发现 **40+ 个性能问题**，分布如下：

| 层级 | CRITICAL | HIGH | MEDIUM | 合计 |
|------|----------|------|--------|------|
| 后端 | 4 | 5 | 7 | 16 |
| 前端 | 1 | 9 | 10 | 20 |

**最严重的 3 个问题**：
1. `server/src/db/index.ts` 第80行：每次 `run()` 都全量导出数据库 + 同步写盘，阻塞事件循环
2. `server/src/db/init.ts`：完全没有数据库索引，所有查询全表扫描
3. `src/admin/views/DashboardView.vue` 第356行：SSE `onerror` 中 `sseConnected.value = true` 是 BUG，导致轮询降级机制失效

## 用户决策

- **数据库方案**：防抖保存（保留 sql.js，引入 500ms 防抖 + 定时保存）
- **虚拟滚动**：引入 vue-virtual-scroller
- **修复范围**：全部修复（CRITICAL + HIGH + MEDIUM，跳过 LOW）

## 假设与决策

1. **不迁移 better-sqlite3**：用户选择防抖保存方案，避免数据库层重写风险
2. **不引入 SWR 库**：使用轻量自实现的内存缓存 + inflight 去重，避免新增依赖
3. **虚拟滚动仅用于大数据量列表**：菜品列表（管理端）、订单列表（管理端）
4. **保持 API 兼容**：所有 API 响应格式不变，仅优化内部实现
5. **索引添加使用 `CREATE INDEX IF NOT EXISTS`**：确保幂等，不影响现有数据

---

## 修复计划（按优先级分组）

### 阶段 1：后端 CRITICAL 修复（数据库层）

#### 1.1 数据库防抖保存
**文件**：`server/src/db/index.ts`
**问题**：第80行 `saveDatabase()` 每次 `run()` 都全量导出 + 同步写盘
**方案**：
- 引入防抖机制：500ms 内多次写操作只保存一次
- 启动定时保存：每 30 秒检查是否有未保存变更
- 进程退出时强制保存（`process.on('SIGINT'/'SIGTERM')`）
- 保留 `beginBatch/endBatch` 语义，但内部改用防抖

**具体改动**：
```typescript
// 新增防抖变量
let saveTimer: ReturnType<typeof setTimeout> | null = null
let isDirty = false
const SAVE_DEBOUNCE_MS = 500
const SAVE_INTERVAL_MS = 30000

function scheduleSave(): void {
  isDirty = true
  if (deferSave) return // 批量操作期间不保存
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    flushSave()
  }, SAVE_DEBOUNCE_MS)
}

function flushSave(): void {
  if (!isDirty || !db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(dbPath, buffer)
  isDirty = false
}

// run() 中：saveDatabase() → scheduleSave()
// 新增 startAutoSave() 在服务器启动时调用
```

#### 1.2 添加数据库索引
**文件**：`server/src/db/init.ts`
**问题**：所有表无二级索引，查询全表扫描
**方案**：在 `endBatch()` 前添加所有必要索引（使用 `CREATE INDEX IF NOT EXISTS`）

**新增索引清单**：
```sql
-- orders 表
CREATE INDEX IF NOT EXISTS idx_orders_contact_phone ON orders(contact_phone);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- order_items 表
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_dish_id ON order_items(dish_id);

-- dishes 表
CREATE INDEX IF NOT EXISTS idx_dishes_category_id ON dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_dishes_status ON dishes(status);
CREATE INDEX IF NOT EXISTS idx_dishes_name ON dishes(name);

-- users 表
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- tables 表
CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status);
```

#### 1.3 创建订单 N+1 查询修复
**文件**：`server/src/routes/orders.ts` 第231-262行
**问题**：循环内对每个菜品单独查询
**方案**：改为批量 `WHERE id IN (...)` 查询，用 Map 分组

**改动**：
```typescript
// 替换 for 循环内的单条查询
const dishIds = items.map(item => item.dish_id)
const placeholders = dishIds.map(() => '?').join(',')
const dishes = all<{ id: string; name: string; price: number; status: string }>(
  `SELECT id, name, price, status FROM dishes WHERE id IN (${placeholders})`,
  dishIds
)
const dishMap = new Map(dishes.map(d => [d.id, d]))

for (const item of items) {
  const dish = dishMap.get(item.dish_id)
  if (!dish) { /* 错误处理 */ }
  if (dish.status !== 'on_sale') { /* 错误处理 */ }
  // ... 计算价格
}
```

#### 1.4 桌位管理相关子查询修复
**文件**：`server/src/routes/admin.ts` 第212-219行
**问题**：每行桌位执行一次子查询
**方案**：改为 LEFT JOIN

**改动**：
```sql
SELECT t.*, o.order_no as current_order
FROM tables t
LEFT JOIN orders o ON o.table_id = t.id AND o.status = 'pending'
ORDER BY t.table_no
```
注意：如果一个桌位有多个 pending 订单会返回多行，需用 `GROUP BY` 或子查询限制。实际业务中一个桌位只有一个 pending 订单（创建订单时已校验），所以 LEFT JOIN 安全。

---

### 阶段 2：后端 HIGH 修复（缓存与并发）

#### 2.1 内存缓存工具
**文件**：新建 `server/src/utils/cache.ts`
**方案**：实现简单的 TTL 缓存，支持手动失效

```typescript
interface CacheEntry<T> { data: T; expireAt: number }
const cache = new Map<string, CacheEntry<unknown>>()

export function getCached<T>(key: string): T | undefined { /* ... */ }
export function setCached<T>(key: string, data: T, ttlMs: number): void { /* ... */ }
export function invalidateCache(key: string): void { /* ... */ }
export function invalidatePattern(prefix: string): void { /* ... */ }
```

#### 2.2 静态数据缓存
**文件**：`server/src/routes/dishes.ts`、`server/src/routes/tables.ts`、`server/src/routes/admin.ts`
**方案**：为以下端点添加缓存（TTL 60s），写操作时失效：
- `GET /api/dishes/categories/all` → cache key `categories`
- `GET /api/dishes/home-data` → cache key `home_data`
- `GET /api/tables` → cache key `tables`
- `GET /api/tables/available` → cache key `tables_available`
- `GET /admin/categories` → cache key `admin_categories`
- `GET /admin/settings` → cache key `admin_settings`

**失效时机**：菜品/分类/桌位/设置的增删改操作后调用 `invalidatePattern`

#### 2.3 同步文件操作改异步
**文件**：`server/src/routes/admin.ts`
**问题行**：第76、1119、1216、1259、1554行 `unlinkSync`/`writeFileSync`
**方案**：改为 `unlink`/`writeFile`（异步），使用 `fs/promises`

#### 2.4 预处理语句复用
**文件**：`server/src/db/index.ts`
**问题**：第90、106行每次查询都 `prepare` + `free`
**方案**：缓存预处理语句

```typescript
const stmtCache = new Map<string, ReturnType<Database['prepare']>>()

function getStmt(sql: string) {
  let stmt = stmtCache.get(sql)
  if (!stmt) {
    stmt = getDb().prepare(sql)
    stmtCache.set(sql, stmt)
  }
  stmt.reset()
  return stmt
}
```
注意：sql.js 的 prepare 返回的 Statement 需要正确 reset，且不能跨数据库实例复用。在 `initDatabase` 时清空缓存。

#### 2.5 SSE 实现优化
**文件**：`server/src/utils/sse.ts`、`server/src/routes/admin.ts` 第133-161行
**问题**：无连接数限制、广播时数组复制、背压问题
**方案**：
- 添加最大连接数限制（如 100）
- 广播时直接遍历 `clients`，不复制数组（用索引遍历避免迭代中修改问题）
- 添加 `res.write` 返回 false 时的背压处理（记录警告，不阻塞其他客户端）

#### 2.6 客户端认证缓存
**文件**：`server/src/routes/orders.ts` 第33-36行
**问题**：每次请求都查库验证用户存在
**方案**：缓存用户存在性（TTL 60s），用户删除时失效

```typescript
// 使用 getCached/setCached
const cacheKey = `user_exists:${decoded.userId}`
let userExists = getCached<boolean>(cacheKey)
if (userExists === undefined) {
  const user = get<{ id: string }>('SELECT id FROM users WHERE id = ? AND role = ?', [decoded.userId, 'customer'])
  userExists = !!user
  setCached(cacheKey, userExists, 60000)
}
if (!userExists) { /* 401 */ }
```

---

### 阶段 3：后端 MEDIUM 修复

#### 3.1 添加 LIMIT
**文件**：`server/src/routes/dishes.ts`、`server/src/routes/admin.ts`
**改动**：
- `GET /api/dishes` 添加 `LIMIT 500`
- `GET /admin/dishes` 添加 `LIMIT 500`
- `GET /admin/orders` 添加 `LIMIT 200`（支持分页参数）
- `GET /admin/inventory` 添加 `LIMIT 500`
- `GET /admin/users` 添加 `LIMIT 200`

#### 3.2 避免 SELECT *
**文件**：多个路由文件
**方案**：将 `SELECT *` 替换为具体字段列表，特别是只需要部分字段的查询

**重点修复**：
- `admin.ts:233` `SELECT * FROM tables WHERE id = ?` → `SELECT id FROM tables WHERE id = ?`
- `admin.ts:529` `SELECT * FROM categories` → `SELECT id, name, sort_order FROM categories`
- `admin.ts:777` `SELECT * FROM orders WHERE id = ?` → 明确字段

#### 3.3 数据导出 O(n*m) 优化
**文件**：`server/src/routes/admin.ts` 第1657-1660行
**方案**：用 Map 分组（参考 `orders.ts:113-121` 的实现）

```typescript
const itemsByOrder = new Map<string, typeof orderItems>()
for (const item of orderItems) {
  const list = itemsByOrder.get(item.order_id)
  if (list) list.push(item)
  else itemsByOrder.set(item.order_id, [item])
}
const ordersWithItems = orders.map(order => ({
  ...order,
  items: itemsByOrder.get(order.id) || []
}))
```

#### 3.4 JSON 解析使用 safeJsonParse
**文件**：`server/src/routes/dishes.ts` 第81-85行、第127-131行
**方案**：使用已定义的 `safeJsonParse` 函数

#### 3.5 中间件顺序调整
**文件**：`server/src/index.ts`
**方案**：将静态文件中间件移到 `dbReady` 检查之前，确保数据库初始化期间静态资源可访问

#### 3.6 批量操作复用预处理语句
**文件**：`server/src/routes/admin.ts` 第425-428、600-603、853-856行
**方案**：在批量循环外 `prepare` 一次，循环内 `bind` + `step` + `reset`

#### 3.7 订单号生成优化
**文件**：`server/src/routes/orders.ts` 第53-58行
**方案**：增加随机数范围 + 加入时间戳

```typescript
function generateOrderNo(): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = now.getTime().toString().slice(-6) // 毫秒时间戳后6位
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `RL${dateStr}${timeStr}${random}`
}
```

---

### 阶段 4：前端 CRITICAL/HIGH 修复

#### 4.1 修复 SSE 连接状态 BUG
**文件**：`src/admin/views/DashboardView.vue` 第356行
**问题**：`sseConnected.value = true` 应为 `false`
**方案**：改为 `sseConnected.value = false`

#### 4.2 DishesView 图片懒加载
**文件**：`src/admin/views/DishesView.vue` 第418行
**方案**：参考 `DishCard.vue` 的实现，添加 `loading="lazy"`、`decoding="async"`、占位符、错误处理

#### 4.3 模板内 filter 优化
**文件**：`src/admin/views/DishesView.vue` 第376行
**问题**：`{{ dishes.filter(d => d.category_id === cat.id).length }}` O(N×M) 复杂度
**方案**：改为 computed 预计算

```typescript
const dishCountByCategory = computed(() => {
  const map = new Map<string, number>()
  for (const dish of dishes.value) {
    const catId = dish.category_id || 'uncategorized'
    map.set(catId, (map.get(catId) || 0) + 1)
  }
  return map
})
// 模板：{{ dishCountByCategory.get(cat.id) || 0 }}
```

#### 4.4 API 请求缓存与去重
**文件**：`src/api/index.ts`
**方案**：实现 inflight 请求去重 + 短期缓存

```typescript
const inflightRequests = new Map<string, Promise<unknown>>()
const responseCache = new Map<string, { data: unknown; expireAt: number }>()

async function cachedRequest<T>(endpoint: string, options: RequestOptions = {}, ttl = 5000): Promise<T> {
  const cacheKey = `${options.method || 'GET'}:${endpoint}`
  
  // 检查缓存
  const cached = responseCache.get(cacheKey)
  if (cached && cached.expireAt > Date.now()) {
    return cached.data as T
  }
  
  // inflight 去重
  const inflight = inflightRequests.get(cacheKey)
  if (inflight) return inflight as Promise<T>
  
  const promise = request<T>(endpoint, options).then(data => {
    responseCache.set(cacheKey, { data, expireAt: Date.now() + ttl })
    inflightRequests.delete(cacheKey)
    return data
  }).catch(err => {
    inflightRequests.delete(cacheKey)
    throw err
  })
  
  inflightRequests.set(cacheKey, promise)
  return promise
}
```

**应用到**：`getCategories`、`getTables`、`getAvailableTables`、`getHomeData`、`getAdminCategories`、`getSettings`（TTL 30s）

#### 4.5 QRCode/JsBarcode 动态导入
**文件**：`src/client/views/OrderDetailView.vue` 第13-14行
**方案**：改为动态导入

```typescript
// 删除顶部静态导入
// import QRCode from 'qrcode'
// import JsBarcode from 'jsbarcode'

// 在使用处动态导入
async function showQRCode(orderId: string) {
  const QRCode = (await import('qrcode')).default
  // ...
}
```

#### 4.6 虚拟滚动
**依赖**：新增 `vue-virtual-scroller`（需 `npm install`）
**文件**：`src/admin/views/DishesView.vue`、`src/admin/views/DashboardView.vue`、`src/client/views/HomeView.vue`
**方案**：使用 `RecycleScroller` 替换长列表的 `v-for`

**注意**：仅对数据量可能超过 50 条的列表使用，小列表保持原样

#### 4.7 轮询请求去重
**文件**：`src/shared/composables/useOrderPolling.ts`
**问题**：第22-30行无请求锁，可能堆积请求
**方案**：添加 `isFetching` 标志

```typescript
let isFetching = false
pollingTimer = setInterval(async () => {
  if (shouldPoll && !shouldPoll()) return
  if (isFetching) return // 上一次请求未完成，跳过
  isFetching = true
  try {
    await fetchFunction()
  } catch (error) {
    console.error('Polling error:', error)
  } finally {
    isFetching = false
  }
}, interval)
```

#### 4.8 DishCard computed 优化
**文件**：`src/client/components/DishCard.vue` 第38-46行
**问题**：`quantityInCart` 依赖整个 `cartStore.items`
**方案**：改用 getter 减少依赖追踪

```typescript
const quantityInCart = computed(() => {
  const item = cartStore.items.find(i => i.dish_id === props.dish.id)
  return item?.quantity || 0
})
```
注意：这仍然是 O(n)，但避免了整个数组的响应式追踪。如果菜品很多，可考虑在 cart store 中维护 `Map<dishId, quantity>`。

#### 4.9 cart store 不可变性
**文件**：`src/stores/cart.ts` 第29、42、55、74-76行
**方案**：改为创建新对象/新数组

```typescript
// 第29行
const existingIndex = items.value.findIndex(i => i.dish_id === newItem.dish_id)
if (existingIndex !== -1) {
  const existingItem = items.value[existingIndex]!
  items.value = items.value.map((item, idx) =>
    idx === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
  )
} else {
  items.value = [...items.value, newItem]
}
```

#### 4.10 showToast 定时器清理
**文件**：`src/stores/app.ts` 第73-75行
**方案**：保存 timer id，连续调用时清除前一个

```typescript
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(message: string, type: ToastType = 'info') {
  toast.value = { show: true, message, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value.show = false
    toastTimer = null
  }, 3000)
}
```

---

### 阶段 5：前端 MEDIUM 修复

#### 5.1 组件懒加载
**文件**：
- `src/client/views/SettingsView.vue` 第8行
- `src/client/views/SearchView.vue` 第10行
- `src/client/components/TableSelectModal.vue` 第7行

**方案**：静态导入改为 `defineAsyncComponent`

#### 5.2 动画性能优化
**文件**：`src/client/views/HomeView.vue` 第712-737、740-766行
**问题**：`cartSlideIn`/`cartSlideOut` 使用 `max-height` 触发 layout
**方案**：改用 `transform: translateY()` + `opacity`

#### 5.3 轮询复用
**文件**：`src/client/views/OrdersView.vue` 第74-106行、`src/client/views/OrderDetailView.vue` 第74-119行
**方案**：复用 `useOrderPolling` composable，删除重复实现

#### 5.4 SSE 重连指数退避
**文件**：`src/admin/views/DashboardView.vue` 第301、364-369行
**方案**：重连延迟从固定 3s 改为指数退避（3s → 6s → 12s → 24s，上限 60s）

#### 5.5 AudioContext 单例
**文件**：`src/admin/views/DashboardView.vue` 第250-280行
**方案**：复用单例 AudioContext

```typescript
let audioContext: AudioContext | null = null
function getAudioContext() {
  if (!audioContext) audioContext = new AudioContext()
  return audioContext
}
```

#### 5.6 v-memo 优化
**文件**：`src/admin/views/DashboardView.vue` 第588-663行、`src/client/components/DishCard.vue`
**方案**：为列表项添加 `v-memo`

```vue
<div v-for="order in orders" :key="order.id" v-memo="[order.status, order.id]">
```

#### 5.7 OrderConfirmView debounce
**文件**：`src/client/views/OrderConfirmView.vue` 第106-112行
**方案**：`handleNameInput` 添加 debounce（300ms）

#### 5.8 removeConsolePlugin 改用 esbuild drop
**文件**：`vite.config.ts` 第9-25行
**方案**：删除自定义插件，改用 `esbuild.drop: ['console']`

```typescript
build: {
  // ...
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}
```

#### 5.9 DishesView specs 输入处理
**文件**：`src/admin/views/DishesView.vue` 第560行
**方案**：模板内联逻辑提取为方法

#### 5.10 fetchOrdersWithCheck await
**文件**：`src/admin/views/DashboardView.vue` 第385-392行
**方案**：`fetchDashboard(false)` 添加 await

---

## 验证步骤

### 自动化检查（强制）

1. **类型检查**：`npm run build`（包含 vue-tsc 类型检查）
2. **构建验证**：`npm run build:production`（生产构建无错误）
3. **服务器启动**：`npm run dev` 能正常启动
4. **数据库初始化**：`npm run db:init` 能正常执行（索引创建成功）

### 功能回归验证

1. **客户端流程**：
   - 首页加载 → 分类切换 → 菜品详情 → 加购 → 下单 → 订单查看
   - 订单轮询正常工作
   - 图片懒加载生效

2. **管理端流程**：
   - 登录 → Dashboard 数据加载 → SSE 连接 → 新订单推送
   - 菜品管理 CRUD → 图片上传/删除
   - 订单管理 → 状态更新
   - 数据导出/导入

3. **SSE 降级**：
   - 断开网络 → SSE 断开 → 轮询启动（验证 BUG 修复）
   - 恢复网络 → SSE 重连 → 轮询停止

### 性能验证

1. **数据库保存**：连续创建 10 个订单，观察磁盘 IO（应从 10 次降为 1-2 次）
2. **查询性能**：菜品/订单列表加载速度提升（索引生效）
3. **缓存生效**：重复访问 `/api/dishes/categories/all`，第二次应命中缓存
4. **Bundle 体积**：QRCode/JsBarcode 动态导入后，OrderDetailView chunk 减小 ~90KB

## 风险与回滚

- **数据库防抖保存**：极端情况下进程崩溃可能丢失 500ms 内的数据。通过 SIGINT/SIGTERM 钩子 + 定时保存缓解
- **索引添加**：`CREATE INDEX IF NOT EXISTS` 幂等，无风险
- **虚拟滚动**：可能影响某些 CSS 选择器（如 `:nth-child`），需测试样式
- **API 缓存**：缓存失效逻辑需仔细测试，避免脏数据

## 实施顺序

1. **阶段 1**（后端 CRITICAL）→ 阶段 2（后端 HIGH）→ 阶段 3（后端 MEDIUM）
2. **阶段 4**（前端 CRITICAL/HIGH）→ 阶段 5（前端 MEDIUM）
3. 每个阶段完成后运行构建验证
4. 全部完成后进行完整功能回归测试
