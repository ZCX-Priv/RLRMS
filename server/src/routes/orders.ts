import { Router, type Request, type Response, type NextFunction } from 'express'
import { all, get, run, beginBatch, endBatch } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'
import { formatDateTime } from '../utils/format.js'
import { createOrderSchema, cancelOrderSchema, updateOrderItemsSchema } from '../validators/index.js'
import { broadcastSSE } from '../utils/sse.js'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../utils/jwt.js'
import { cacheInvalidate, CACHE_KEYS } from '../utils/cache.js'

const CLIENT_COOKIE_NAME = 'client_token'

interface ClientJwtPayload {
  userId: string
  username: string
  role: string
  phone?: string
}

/**
 * 客户端身份验证中间件
 * 验证 client_token cookie，并确认用户仍存在于数据库
 */
function requireClientAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[CLIENT_COOKIE_NAME]
  if (!token) {
    return res.status(401).json({ success: false, error: '请先登录' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as ClientJwtPayload

    // 校验用户是否仍存在于数据库中
    const user = get<{ id: string }>(
      'SELECT id FROM users WHERE id = ? AND role = ?',
      [decoded.userId, 'customer']
    )
    if (!user) {
      return res.status(401).json({ success: false, error: '用户不存在或已被删除' })
    }

    // 将用户信息注入请求上下文
    ;(req as any).clientUserId = decoded.userId
    ;(req as any).clientPhone = decoded.phone || decoded.username
    next()
  } catch {
    return res.status(401).json({ success: false, error: '登录已过期，请重新登录' })
  }
}

export const ordersRouter = Router()

// Generate order number
function generateOrderNo(): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `RL${dateStr}${random}`
}

// Get all orders (for user - requires client auth)
ordersRouter.get('/', requireClientAuth, (req, res) => {
  try {
    const { phone } = req.query
    
    // 必须提供手机号参数，否则返回空数组，防止无条件查询所有订单
    if (!phone || typeof phone !== 'string') {
      return res.json({ success: true, data: [] })
    }
    
    let query = `
      SELECT o.*, t.name as table_name, t.table_no
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.contact_phone = ?
    `
    const params: (string | number | null)[] = [phone]
    
    query += ' ORDER BY o.created_at DESC'
    
    const orders = all<{
      id: string
      order_no: string
      table_id: string | null
      table_name: string | null
      table_no: string | null
      user_id: string | null
      dining_time: string | null
      contact_name: string | null
      contact_phone: string | null
      total_amount: number
      status: string
      created_at: string
    }>(query, params)
    
    // 批量查询所有订单的菜品明细，避免 N+1 查询
    if (orders.length === 0) {
      return res.json({ success: true, data: [] })
    }
    const orderIds = orders.map(o => o.id)
    const placeholders = orderIds.map(() => '?').join(',')
    const allItems = all<{
      id: string
      order_id: string
      dish_id: string
      dish_name: string
      quantity: number
      unit_price: number
      subtotal: number
      spec: string | null
    }>(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, orderIds)
    
    // 按 order_id 分组
    const itemsByOrder = new Map<string, typeof allItems>()
    for (const item of allItems) {
      const list = itemsByOrder.get(item.order_id)
      if (list) {
        list.push(item)
      } else {
        itemsByOrder.set(item.order_id, [item])
      }
    }
    
    const ordersWithItems = orders.map(order => ({
      ...order,
      created_at: formatDateTime(order.created_at),
      items: itemsByOrder.get(order.id) || []
    }))
    
    res.json({ success: true, data: ordersWithItems })
  } catch (error) {
    console.error('Error fetching orders:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch orders' })
  }
})

// 批量验证订单是否存在（清除幽灵订单）
// 注意：此接口仅做 ID 存在性校验，不涉及敏感数据，无需客户端认证
ordersRouter.post('/verify', (req, res) => {
  try {
    const { ids } = req.body as { ids: string[] }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: true, data: [] })
    }
    const placeholders = ids.map(() => '?').join(',')
    const existing = all<{ id: string }>(
      `SELECT id FROM orders WHERE id IN (${placeholders})`, ids
    )
    res.json({ success: true, data: existing.map(o => o.id) })
  } catch (error) {
    console.error('Error verifying orders:', error)
    res.status(500).json({ success: false, error: '验证失败' })
  }
})

// Get order by ID
ordersRouter.get('/:id', requireClientAuth, (req, res) => {
  try {
    const id = req.params.id as string
    const order = get<{
      id: string
      order_no: string
      table_id: string | null
      table_name: string | null
      table_no: string | null
      user_id: string | null
      dining_time: string | null
      contact_name: string | null
      contact_phone: string | null
      total_amount: number
      status: string
      created_at: string
    }>(`
      SELECT o.*, t.name as table_name, t.table_no
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `, [id])
    
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在', notFound: true })
    }
    
    const items = all('SELECT * FROM order_items WHERE order_id = ?', [id])
    const modifications = all('SELECT * FROM order_modifications WHERE order_id = ? ORDER BY created_at ASC', [id])
    
    res.json({ success: true, data: { ...order, items, modifications } })
  } catch (error) {
    console.error('Error fetching order:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch order' })
  }
})

// Create new order
ordersRouter.post('/', requireClientAuth, (req, res) => {
  try {
    // Validate input with zod schema
    const validation = createOrderSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0]?.message || '参数验证失败' 
      })
    }
    
    const { table_id, dining_time, contact_name, contact_phone, items } = validation.data
    
    // Check table availability if table_id provided
    if (table_id) {
      const table = get<{ id: string; status: string }>('SELECT * FROM tables WHERE id = ?', [table_id])
      
      if (!table) {
        return res.status(400).json({ 
          success: false, 
          error: '桌位不存在' 
        })
      }
      
      if (table.status === 'occupied') {
        return res.status(400).json({ 
          success: false, 
          error: '该桌位已被占用' 
        })
      }

      const existingOrder = get<{ id: string }>(
        'SELECT id FROM orders WHERE table_id = ? AND status = ?',
        [table_id, 'pending']
      )
      
      if (existingOrder) {
        return res.status(400).json({ 
          success: false, 
          error: '该桌位已有待处理的订单，请勿重复下单' 
        })
      }
    }
    
    const orderId = uuidv4()
    const orderNo = generateOrderNo()
    
    // 服务端批量验证菜品并计算价格，防止客户端篡改金额
    const dishIds = items.map(i => i.dish_id)
    const placeholders = dishIds.map(() => '?').join(',')
    const dishRows = all<{ id: string; name: string; price: number; status: string }>(
      `SELECT id, name, price, status FROM dishes WHERE id IN (${placeholders})`,
      dishIds
    )
    const dishMap = new Map<string, { id: string; name: string; price: number; status: string }>()
    for (const d of dishRows) {
      dishMap.set(d.id, d)
    }

    const verifiedItems: {
      dish_id: string
      dish_name: string
      quantity: number
      unit_price: number
      subtotal: number
      spec: string | null
    }[] = []
    
    for (const item of items) {
      const dish = dishMap.get(item.dish_id)
      
      if (!dish) {
        return res.status(400).json({
          success: false,
          error: `菜品不存在: ${item.dish_name}`
        })
      }
      
      if (dish.status !== 'on_sale') {
        return res.status(400).json({
          success: false,
          error: `菜品已下架: ${dish.name}`
        })
      }
      
      // 使用数据库实际价格重新计算
      const serverUnitPrice = dish.price
      const serverSubtotal = Math.round(serverUnitPrice * item.quantity * 100) / 100
      
      verifiedItems.push({
        dish_id: item.dish_id,
        dish_name: dish.name,
        quantity: item.quantity,
        unit_price: serverUnitPrice,
        subtotal: serverSubtotal,
        spec: item.spec || null
      })
    }
    
    const totalAmount = Math.round(verifiedItems.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100
    
    // 批量写入：订单 + 订单项 + 桌位状态更新
    beginBatch()
    try {
      // Insert order
      run(`
        INSERT INTO orders (id, order_no, table_id, user_id, dining_time, contact_name, contact_phone, total_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `, [orderId, orderNo, table_id || null, (req as any).clientUserId, dining_time, contact_name, contact_phone, totalAmount])
      
      // Insert order items (使用服务端验证后的价格)
      for (const item of verifiedItems) {
        run(`
          INSERT INTO order_items (id, order_id, dish_id, dish_name, quantity, unit_price, subtotal, spec)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [uuidv4(), orderId, item.dish_id, item.dish_name, item.quantity, item.unit_price, item.subtotal, item.spec])
      }
      
      // Update table status
      if (table_id) {
        run('UPDATE tables SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['reserved', table_id])
      }
    } finally {
      endBatch()
    }

    if (table_id) {
      cacheInvalidate(CACHE_KEYS.TABLES_AVAILABLE)
    }
    
    // Get the created order
    const order = get<{
      id: string
      order_no: string
      table_id: string | null
      table_name: string | null
      table_no: string | null
    }>(`
      SELECT o.*, t.name as table_name, t.table_no
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `, [orderId])
    
    const orderItems = all('SELECT * FROM order_items WHERE order_id = ?', [orderId])
    
    const createdOrder = { ...order, items: orderItems }
    
    // SSE 广播新订单事件
    broadcastSSE('new_order', createdOrder)
    
    res.status(201).json({ 
      success: true, 
      data: createdOrder
    })
  } catch (error) {
    console.error('Error creating order:', error)
    res.status(500).json({ success: false, error: 'Failed to create order' })
  }
})

// Cancel order (需要客户端登录 + 手机号验证身份)
ordersRouter.post('/:id/cancel', requireClientAuth, (req, res) => {
  try {
    const id = req.params.id as string
    
    // 验证请求体中的手机号
    const validation = cancelOrderSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0]?.message || '请提供手机号以验证身份'
      })
    }
    
    const order = get<{ id: string; status: string; table_id: string | null; created_at: string; contact_phone: string | null }>('SELECT * FROM orders WHERE id = ?', [id])
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }
    
    // 验证手机号与订单匹配
    if (order.contact_phone !== validation.data.phone) {
      return res.status(403).json({
        success: false,
        error: '手机号与订单不匹配，无法取消'
      })
    }
    
    // Check if order can be cancelled (within 5 minutes)
    const createdAt = new Date(order.created_at + 'Z')
    const now = new Date()
    const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60)
    
    if (diffMinutes > 5) {
      return res.status(400).json({ 
        success: false, 
        error: '超过5分钟，无法取消订单' 
      })
    }
    
    if (order.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: '该订单状态无法取消' 
      })
    }
    
    // Update order and table
    run('UPDATE orders SET status = \'cancelled\', updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id])
    
    if (order.table_id) {
      run('UPDATE tables SET status = \'available\', updated_at = CURRENT_TIMESTAMP WHERE id = ?', [order.table_id])
      cacheInvalidate(CACHE_KEYS.TABLES_AVAILABLE)
    }
    
    // SSE 广播订单取消事件
    broadcastSSE('order_updated', { id, status: 'cancelled' })
    
    res.json({ success: true, message: '订单已取消' })
  } catch (error) {
    console.error('Error cancelling order:', error)
    res.status(500).json({ success: false, error: 'Failed to cancel order' })
  }
})

// Update order items (修改订单)
ordersRouter.put('/:id/items', requireClientAuth, (req, res) => {
  try {
    const id = req.params.id as string
    
    // 验证请求体
    const validation = updateOrderItemsSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0]?.message || '参数验证失败'
      })
    }
    
    const { items } = validation.data
    
    // 查找原订单
    const order = get<{ id: string; status: string; contact_phone: string | null }>(
      'SELECT * FROM orders WHERE id = ?', [id]
    )
    
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' })
    }
    
    // 只有 pending 或 confirmed 状态的订单可以修改
    if (order.status !== 'pending' && order.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        error: '该订单状态无法修改'
      })
    }
    
    // 服务端批量验证菜品并计算价格
    const dishIds = items.map(i => i.dish_id)
    const dishPlaceholders = dishIds.map(() => '?').join(',')
    const dishRows = all<{ id: string; name: string; price: number; status: string }>(
      `SELECT id, name, price, status FROM dishes WHERE id IN (${dishPlaceholders})`,
      dishIds
    )
    const dishMap = new Map<string, { id: string; name: string; price: number; status: string }>()
    for (const d of dishRows) {
      dishMap.set(d.id, d)
    }

    const verifiedItems: {
      dish_id: string
      dish_name: string
      quantity: number
      unit_price: number
      subtotal: number
      spec: string | null
    }[] = []
    
    for (const item of items) {
      const dish = dishMap.get(item.dish_id)
      
      if (!dish) {
        return res.status(400).json({
          success: false,
          error: `菜品不存在: ${item.dish_name}`
        })
      }
      
      if (dish.status !== 'on_sale') {
        return res.status(400).json({
          success: false,
          error: `菜品已下架: ${dish.name}`
        })
      }
      
      const serverUnitPrice = dish.price
      const serverSubtotal = Math.round(serverUnitPrice * item.quantity * 100) / 100
      
      verifiedItems.push({
        dish_id: item.dish_id,
        dish_name: dish.name,
        quantity: item.quantity,
        unit_price: serverUnitPrice,
        subtotal: serverSubtotal,
        spec: item.spec || null
      })
    }
    
    const totalAmount = Math.round(verifiedItems.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100
    
    // 读取当前订单菜品（用于计算 diff）
    const oldItems = all<{ dish_id: string; quantity: number; unit_price: number; spec: string | null }>(
      'SELECT dish_id, quantity, unit_price, spec FROM order_items WHERE order_id = ?', [id]
    )
    
    // 计算 diff：对比初始订单与当前修改
    const oldMap = new Map<string, { quantity: number; unit_price: number }>()
    for (const item of oldItems) {
      const key = `${item.dish_id}|${item.spec || ''}`
      oldMap.set(key, { quantity: item.quantity, unit_price: item.unit_price })
    }
    
    const newMap = new Map<string, { dish_id: string; dish_name: string; quantity: number; unit_price: number; spec: string | null }>()
    for (const item of verifiedItems) {
      const key = `${item.dish_id}|${item.spec || ''}`
      newMap.set(key, item)
    }
    
    const diffRecords: { dish_id: string; dish_name: string; quantity_delta: number; unit_price: number; spec: string | null }[] = []
    
    // 新增或数量增加的菜品
    for (const [key, newItem] of newMap) {
      const oldItem = oldMap.get(key)
      const delta = oldItem ? newItem.quantity - oldItem.quantity : newItem.quantity
      if (delta !== 0) {
        diffRecords.push({
          dish_id: newItem.dish_id,
          dish_name: newItem.dish_name,
          quantity_delta: delta,
          unit_price: newItem.unit_price,
          spec: newItem.spec
        })
      }
    }
    
    // 删减或移除的菜品
    for (const [key, oldItem] of oldMap) {
      if (!newMap.has(key)) {
        const oldFullItem = oldItems.find(i => `${i.dish_id}|${i.spec || ''}` === key)
        diffRecords.push({
          dish_id: oldFullItem!.dish_id,
          dish_name: '',  // 旧记录没有 dish_name，需要从数据库获取
          quantity_delta: -oldFullItem!.quantity,
          unit_price: oldFullItem!.unit_price,
          spec: oldFullItem!.spec
        })
      }
    }
    
    // 若 diff 为空，说明菜品没有任何改动，拒绝无意义的更新
    if (diffRecords.length === 0) {
      return res.status(400).json({ success: false, error: '订单内容未发生任何变化，无需修改' })
    }
    
    // 批量写入：删除旧项 + 插入新项 + 记录 diff + 更新订单
    beginBatch()
    try {
      // 删除原订单的所有菜品项
      run('DELETE FROM order_items WHERE order_id = ?', [id])
      
      // 插入新的菜品项
      for (const item of verifiedItems) {
        run(`
          INSERT INTO order_items (id, order_id, dish_id, dish_name, quantity, unit_price, subtotal, spec)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [uuidv4(), id, item.dish_id, item.dish_name, item.quantity, item.unit_price, item.subtotal, item.spec])
      }
      
      // 写入修改记录（diff）
      for (const diff of diffRecords) {
        // 对于被移除的菜品，尝试从数据库获取菜名
        let dishName = diff.dish_name
        if (!dishName) {
          const dish = get<{ name: string }>('SELECT name FROM dishes WHERE id = ?', [diff.dish_id])
          dishName = dish?.name || '未知菜品'
        }
        run(`
          INSERT INTO order_modifications (id, order_id, dish_id, dish_name, quantity_delta, unit_price, spec)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [uuidv4(), id, diff.dish_id, dishName, diff.quantity_delta, diff.unit_price, diff.spec])
      }
      
      // 更新订单总金额，重置状态为 pending（即使原来是 confirmed 也需重新确认）
      run('UPDATE orders SET total_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [totalAmount, 'pending', id])
    } finally {
      endBatch()
    }
    
    // 获取更新后的订单
    const updatedOrder = get<{
      id: string
      order_no: string
      table_id: string | null
      table_name: string | null
      table_no: string | null
      updated_at: string
    }>(`
      SELECT o.*, t.name as table_name, t.table_no
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `, [id])
    
    const orderItems = all('SELECT * FROM order_items WHERE order_id = ?', [id])
    
    const result = { ...updatedOrder, items: orderItems }
    
    // SSE 广播订单更新事件，通知管理端重新确认
    broadcastSSE('order_updated', {
      id,
      status: 'pending',
      type: 'add_items',
      updated_at: updatedOrder?.updated_at
    })
    
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('Error updating order items:', error)
    res.status(500).json({ success: false, error: 'Failed to update order items' })
  }
})