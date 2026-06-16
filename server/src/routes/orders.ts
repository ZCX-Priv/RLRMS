import { Router } from 'express'
import { all, get, run } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'
import { formatDateTime } from '../utils/format.js'
import { createOrderSchema } from '../validators/index.js'

export const ordersRouter = Router()

// Generate order number
function generateOrderNo(): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `RL${dateStr}${random}`
}

// Get all orders (for user)
ordersRouter.get('/', (req, res) => {
  try {
    const { phone } = req.query
    let query = `
      SELECT o.*, t.name as table_name, t.table_no
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
    `
    const params: (string | number | null)[] = []
    
    if (phone) {
      query += ' WHERE o.contact_phone = ?'
      params.push(phone as string)
    }
    
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
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0)
    
    // Insert order
    run(`
      INSERT INTO orders (id, order_no, table_id, dining_time, contact_name, contact_phone, total_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [orderId, orderNo, table_id || null, dining_time, contact_name, contact_phone, totalAmount])
    
    // Insert order items
    for (const item of items) {
      run(`
        INSERT INTO order_items (id, order_id, dish_id, dish_name, quantity, unit_price, subtotal, spec)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [uuidv4(), orderId, item.dish_id, item.dish_name, item.quantity, item.unit_price, item.subtotal, item.spec || null])
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

// Cancel order
ordersRouter.post('/:id/cancel', (req, res) => {
  try {
    const { id } = req.params
    
    const order = get<{ id: string; status: string; table_id: string | null; created_at: string }>('SELECT * FROM orders WHERE id = ?', [id])
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' })
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