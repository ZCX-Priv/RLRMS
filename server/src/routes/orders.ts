import { Router } from 'express'
import { all, get, run } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'
import { formatDateTime } from '../utils/format.js'
import { createOrderSchema, cancelOrderSchema } from '../validators/index.js'

export const ordersRouter = Router()

// Generate order number
function generateOrderNo(): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `RL${dateStr}${random}`
}

// Get all orders (for user - requires phone parameter)
ordersRouter.get('/', (req, res) => {
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
    
    // Get order items for each order
    const ordersWithItems = orders.map(order => {
      const items = all<{
        id: string
        order_id: string
        dish_id: string
        dish_name: string
        quantity: number
        unit_price: number
        subtotal: number
        spec: string | null
      }>('SELECT * FROM order_items WHERE order_id = ?', [order.id])
      
      return {
        ...order,
        created_at: formatDateTime(order.created_at),
        items
      }
    })
    
    res.json({ success: true, data: ordersWithItems })
  } catch (error) {
    console.error('Error fetching orders:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch orders' })
  }
})

// Get order by ID
ordersRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params
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
      return res.status(404).json({ success: false, error: 'Order not found' })
    }
    
    const items = all('SELECT * FROM order_items WHERE order_id = ?', [id])
    
    res.json({ success: true, data: { ...order, items } })
  } catch (error) {
    console.error('Error fetching order:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch order' })
  }
})

// Create new order
ordersRouter.post('/', (req, res) => {
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
    
    // 服务端重新验证菜品并计算价格，防止客户端篡改金额
    const verifiedItems: {
      dish_id: string
      dish_name: string
      quantity: number
      unit_price: number
      subtotal: number
      spec: string | null
    }[] = []
    
    for (const item of items) {
      const dish = get<{ id: string; name: string; price: number; status: string }>(
        'SELECT id, name, price, status FROM dishes WHERE id = ?', [item.dish_id]
      )
      
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
    
    // Insert order
    run(`
      INSERT INTO orders (id, order_no, table_id, dining_time, contact_name, contact_phone, total_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [orderId, orderNo, table_id || null, dining_time, contact_name, contact_phone, totalAmount])
    
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
    
    res.status(201).json({ 
      success: true, 
      data: { ...order, items: orderItems }
    })
  } catch (error) {
    console.error('Error creating order:', error)
    res.status(500).json({ success: false, error: 'Failed to create order' })
  }
})

// Cancel order (需要手机号验证身份)
ordersRouter.post('/:id/cancel', (req, res) => {
  try {
    const { id } = req.params
    
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
    }
    
    res.json({ success: true, message: '订单已取消' })
  } catch (error) {
    console.error('Error cancelling order:', error)
    res.status(500).json({ success: false, error: 'Failed to cancel order' })
  }
})