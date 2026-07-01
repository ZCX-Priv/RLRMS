# 修复批量删除订单时未清空 order_modifications 的问题

## 摘要

用户反馈"订单列表被清空了,但 order_modification 列表没有被清空"。经排查,项目中有 3 个批量删除订单的接口,其中 `POST /admin/clear-orders`(清空已完成/已取消订单)和 `POST /admin/reset-database`(重置数据库)两个接口在删除 `orders` 和 `order_items` 时,遗漏了 `DELETE FROM order_modifications`,导致订单修改记录成为孤儿数据。单订单删除接口和导入接口已正确处理,无需修改。

## 当前状态分析

### 问题根因

`order_modifications` 表通过 `order_id` 外键关联 `orders` 表([init.ts:107](file:///c:/Users/LX/Desktop/RLRMS/server/src/db/init.ts#L107)),但:
- 外键约束没有 `ON DELETE CASCADE`
- 数据库连接层未启用 `PRAGMA foreign_keys = ON`(SQLite 默认关闭外键约束)
- 因此完全依赖应用层手动 DELETE 维护数据一致性

### 受影响的接口

| 接口 | 位置 | 清空 order_items | 清空 order_modifications | 清空 orders | 状态 |
|------|------|:---:|:---:|:---:|------|
| DELETE /admin/orders/:id(单订单) | [admin.ts:880-885](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L880-L885) | 是 | 是 | 是 | 正常 |
| POST /admin/reset-database | [admin.ts:1224-1231](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1224-L1231) | 是 | **否** | 是 | **需修复** |
| POST /admin/clear-orders | [admin.ts:1327-1341](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1327-L1341) | 是 | **否** | 是 | **需修复** |
| POST /admin/import | [admin.ts:1562-1564](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1562-L1564) | 是 | 是 | 是 | 正常(上轮已修复) |

### 不受影响的接口
- `DELETE /admin/orders/:id`(单订单删除):已在 [admin.ts:883](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L883) 正确级联删除 order_modifications
- `POST /admin/import`(导入):已在 [admin.ts:1563](file:///c:/Users/LX/Desktop/RLRMS/server/src/routes/admin.ts#L1563) 正确清空(上一轮修复)
- `PUT /orders/:id`(修改订单):非删除操作,会插入新的 order_modifications 记录,无需处理

## 修改方案

### 决策与假设
- **仅做应用层修复**:在两个遗漏的接口中补充 `DELETE FROM order_modifications`。不启用 `PRAGMA foreign_keys` 或添加 `ON DELETE CASCADE`,因为前者可能影响其他表的现有行为,后者需要重建表(SQLite 不支持 ALTER 修改外键),风险与收益不匹配。
- **删除顺序**:子表先于父表。order_modifications 依赖 orders,需在 `DELETE FROM orders` 之前删除 order_modifications。
- **clear-orders 的条件匹配**:order_modifications 的删除条件必须与 orders 完全一致(按日期范围 + 状态,或全量按状态),确保只删除被清空订单对应的修改记录。

### 文件:`server/src/routes/admin.ts`

#### 修改 1:reset-database 接口(第 1224-1231 行)

在 `DELETE FROM order_items` 之后、`DELETE FROM orders` 之前,补充 `DELETE FROM order_modifications`:

```typescript
beginBatch()
run('DELETE FROM order_items')
run('DELETE FROM order_modifications')   // ← 新增
run('DELETE FROM orders')
run('DELETE FROM inventory')
run('DELETE FROM dishes')
run('DELETE FROM categories')
run('DELETE FROM tables')
endBatch()
```

#### 修改 2:clear-orders 接口 — dateRange 分支(第 1329-1337 行)

在删除 order_items 之后、删除 orders 之前,补充删除对应范围的 order_modifications:

```typescript
if (dateRange) {
  run(
    "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE status IN ('completed', 'cancelled') AND created_at >= ? AND created_at < date(?, '+1 day'))",
    [dateRange.startDate, dateRange.endDate]
  )
  // ← 新增:删除对应范围的订单修改记录
  run(
    "DELETE FROM order_modifications WHERE order_id IN (SELECT id FROM orders WHERE status IN ('completed', 'cancelled') AND created_at >= ? AND created_at < date(?, '+1 day'))",
    [dateRange.startDate, dateRange.endDate]
  )
  run(
    "DELETE FROM orders WHERE status IN ('completed', 'cancelled') AND created_at >= ? AND created_at < date(?, '+1 day')",
    [dateRange.startDate, dateRange.endDate]
  )
}
```

#### 修改 3:clear-orders 接口 — 全部分支(第 1338-1340 行)

在删除 order_items 之后、删除 orders 之前,补充删除 order_modifications:

```typescript
} else {
  run("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE status IN ('completed', 'cancelled'))")
  // ← 新增:删除所有已完成/已取消订单的修改记录
  run("DELETE FROM order_modifications WHERE order_id IN (SELECT id FROM orders WHERE status IN ('completed', 'cancelled'))")
  run("DELETE FROM orders WHERE status IN ('completed', 'cancelled')")
}
```

## 验证步骤

1. **类型检查**:运行 `npx tsc -p server/tsconfig.json --noEmit` 确认无类型错误
2. **clear-orders 验证(全量)**:
   - 准备数据:创建若干已完成/已取消订单,并对其执行修改操作以产生 order_modifications 记录
   - 调用 `POST /admin/clear-orders`(scope 为空,即全量)
   - 查询确认 orders、order_items、order_modifications 中对应记录均已清空
3. **clear-orders 验证(日期范围)**:
   - 创建跨日期的订单数据
   - 调用 `POST /admin/clear-orders` 指定某一天范围
   - 查询确认仅该日期范围内的 orders/order_items/order_modifications 被删除,其他日期的保留
4. **reset-database 验证**:
   - 调用 `POST /admin/reset-database`(confirm: 'RESET')
   - 查询确认 order_modifications 表已清空

## 影响范围
- 修改 1 个文件:`server/src/routes/admin.ts`
- 不涉及数据库结构变更
- 不涉及前端修改
- 修复后行为与单订单删除接口保持一致
