import { Router, type Request, type Response, type NextFunction } from 'express'
import { all, get, run, getDb, saveDatabase, beginBatch, endBatch } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import multer from 'multer'
import { resolve, extname, normalize } from 'path'
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync, createReadStream } from 'fs'
import bcrypt from 'bcryptjs'
import { formatDateTime } from '../utils/format.js'
import { createDishSchema, updateDishSchema, createTableSchema, createCategorySchema, createInventorySchema, updateInventorySchema, updateOrderStatusSchema, confirmResetSchema, createUserSchema, updateUserSchema } from '../validators/index.js'
import sharp from 'sharp'
import AdmZip from 'adm-zip'
import archiver from 'archiver'
import { addSSEClient, removeSSEClient, broadcastSSE } from '../utils/sse.js'
import { JWT_SECRET } from '../utils/jwt.js'

function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue
  try {
    return JSON.parse(jsonString) as T
  } catch {
    console.warn('Failed to parse JSON:', jsonString)
    return defaultValue
  }
}

/**
 * JWT Payload 类型定义
 * 用于类型安全的 token 解码
 */
interface JwtPayload {
  userId: string
  username: string
  role: string
}

const COOKIE_NAME = 'admin_token'

const sourcesDir = resolve(process.cwd(), 'public/sources')
if (!existsSync(sourcesDir)) {
  mkdirSync(sourcesDir, { recursive: true })
}

/**
 * 删除菜品图片（如果未被其他菜品使用）
 * @param imageUrl 图片URL，格式为 /sources/filename
 */
function deleteDishImageIfUnused(imageUrl: string | null): void {
  if (!imageUrl) {
    return
  }

  // 查询是否有其他菜品使用该图片
  const dishUsingImage = get<{ id: string }>('SELECT id FROM dishes WHERE image_url = ?', [imageUrl])
  if (dishUsingImage) {
    return
  }

  // 将URL转换为文件路径
  const filename = imageUrl.replace('/sources/', '')
  if (!filename || filename === imageUrl) {
    return
  }

  const filePath = resolve(sourcesDir, filename)

  // 安全检查：确保文件路径在sourcesDir目录下
  if (!filePath.startsWith(sourcesDir)) {
    return
  }

  // 检查文件是否存在并删除
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath)
    } catch (e) {
      console.error('Failed to delete image file:', filePath, e)
    }
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, sourcesDir)
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`
    cb(null, `${uniqueSuffix}${extname(file.originalname)}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'))
    }
  }
})

export const adminRouter = Router()

// UUID 格式验证辅助函数
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' })
    }
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' })
  }
}

// ===== SSE 实时推送 =====
adminRouter.get('/events', requireAuth, (req: Request, res: Response) => {
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // 禁用 nginx 缓冲
  res.flushHeaders()

  const client = addSSEClient(res)

  // 发送初始连接确认
  res.write(`event: connected\ndata: {"clientId":"${client.id}"}\n\n`)

  // 心跳保活，每 30 秒发送一次
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n')
    } catch {
      clearInterval(heartbeat)
      removeSSEClient(client)
    }
  }, 30000)

  // 客户端断开时清理
  req.on('close', () => {
    clearInterval(heartbeat)
    removeSSEClient(client)
  })
})

// Dashboard stats
adminRouter.get('/dashboard', requireAuth, (req, res) => {
  try {
    const todayOrders = get<{ count: number }>('SELECT COUNT(*) as count FROM orders WHERE date(created_at, \'localtime\') = date(\'now\', \'localtime\')')
    const todayRevenue = get<{ total: number }>('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE date(created_at, \'localtime\') = date(\'now\', \'localtime\') AND status = \'completed\'')
    const pendingOrders = get<{ count: number }>('SELECT COUNT(*) as count FROM orders WHERE status = \'pending\'')
    const availableTables = get<{ count: number }>('SELECT COUNT(*) as count FROM tables WHERE status = \'available\'')
    const recentOrders = all<{
      id: string
      order_no: string
      table_id: string | null
      table_name: string | null
      dining_time: string | null
      contact_name: string | null
      contact_phone: string | null
      total_amount: number
      status: string
      created_at: string
    }>(`
      SELECT o.*, t.name as table_name
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `)
    
    const formattedOrders = recentOrders.map(order => ({
      ...order,
      created_at: formatDateTime(order.created_at)
    }))
    
    res.json({
      success: true,
      data: {
        todayOrders: todayOrders?.count || 0,
        todayRevenue: todayRevenue?.total || 0,
        pendingOrders: pendingOrders?.count || 0,
        availableTables: availableTables?.count || 0,
        recentOrders: formattedOrders
      }
    })
  } catch (error) {
    console.error('Error fetching dashboard:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' })
  }
})

// ===== Table Management =====

adminRouter.get('/tables', requireAuth, (req, res) => {
  try {
    const tables = all(`
      SELECT t.*, 
        (SELECT o.order_no FROM orders o WHERE o.table_id = t.id AND o.status = 'pending' LIMIT 1) as current_order
      FROM tables t
      ORDER BY t.table_no
    `)
    res.json({ success: true, data: tables })
  } catch (error) {
    console.error('Error fetching tables:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch tables' })
  }
})

adminRouter.put('/tables/:id', requireAuth, (req, res) => {
  try {
    const id = req.params.id as string
    const { status, table_no, name, capacity } = req.body
    
    if (table_no !== undefined || name !== undefined || capacity !== undefined) {
      const existing = get<{ id: string }>('SELECT * FROM tables WHERE id = ?', [id])
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Table not found' })
      }
      
      run(`
        UPDATE tables 
        SET table_no = COALESCE(?, table_no), 
            name = COALESCE(?, name), 
            capacity = COALESCE(?, capacity),
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [table_no ?? null, name ?? null, capacity ?? null, status ?? null, id])
      
      const table = get('SELECT * FROM tables WHERE id = ?', [id])
      res.json({ success: true, data: table })
    } else {
      run('UPDATE tables SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id])
      res.json({ success: true, message: 'Table status updated' })
    }
  } catch (error) {
    console.error('Error updating table:', error)
    res.status(500).json({ success: false, error: 'Failed to update table' })
  }
})

adminRouter.post('/tables', requireAuth, (req, res) => {
  try {
    // Validate input
    const validation = createTableSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0]?.message || '参数验证失败' 
      })
    }
    
    const { table_no, name, capacity } = validation.data
    
    const existingTableNo = get<{ id: string }>('SELECT id FROM tables WHERE table_no = ?', [table_no])
    if (existingTableNo) {
      return res.status(400).json({ success: false, error: '桌位编号已存在，请使用其他编号' })
    }
    
    const existingTableName = get<{ id: string }>('SELECT id FROM tables WHERE name = ?', [name])
    if (existingTableName) {
      return res.status(400).json({ success: false, error: '桌位名称已存在，请使用其他名称' })
    }
    
    const id = uuidv4()
    run('INSERT INTO tables (id, table_no, name, capacity) VALUES (?, ?, ?, ?)', [id, table_no, name, capacity || 4])
    
    const table = get('SELECT * FROM tables WHERE id = ?', [id])
    res.status(201).json({ success: true, data: table })
  } catch (error) {
    console.error('Error creating table:', error)
    res.status(500).json({ success: false, error: 'Failed to create table' })
  }
})

adminRouter.delete('/tables/:id', requireAuth, (req, res) => {
  try {
    const id = req.params.id as string
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ success: false, error: '无效的 ID 格式' })
    }
    
    const existing = get<{ id: string }>('SELECT id FROM tables WHERE id = ?', [id])
    if (!existing) {
      return res.status(404).json({ success: false, error: '桌位不存在' })
    }
    
    // 检查是否有未完成的订单
    const activeOrder = get<{ id: string }>(
      'SELECT id FROM orders WHERE table_id = ? AND status IN (?, ?)',
      [id, 'pending', 'confirmed']
    )
    if (activeOrder) {
      return res.status(400).json({ success: false, error: '该桌位有未完成的订单，无法删除' })
    }
    
    run('DELETE FROM tables WHERE id = ?', [id])
    res.json({ success: true, message: 'Table deleted' })
  } catch (error) {
    console.error('Error deleting table:', error)
    res.status(500).json({ success: false, error: 'Failed to delete table' })
  }
})

// ===== Dish Management =====

adminRouter.get('/dishes', requireAuth, (req, res) => {
  try {
    const dishes = all<{
      id: string
      name: string
      price: number
      image_url: string | null
      category_id: string | null
      category_name: string | null
      description: string | null
      tags: string
      specs: string
      status: string
    }>(`
      SELECT d.*, c.name as category_name 
      FROM dishes d 
      LEFT JOIN categories c ON d.category_id = c.id 
      ORDER BY c.sort_order, d.sort_order, d.created_at DESC
    `)
    
    const result = dishes.map(dish => ({
      ...dish,
      tags: safeJsonParse(dish.tags, []),
      specs: safeJsonParse(dish.specs, []),
    }))
    
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('Error fetching dishes:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch dishes' })
  }
})

adminRouter.post('/dishes', requireAuth, (req, res) => {
  try {
    // Validate input
    const validation = createDishSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0]?.message || '参数验证失败' 
      })
    }
    
    const { name, price, category_id, description, tags, specs, image_url } = validation.data
    
    const existingDish = get<{ id: string }>('SELECT id FROM dishes WHERE name = ?', [name])
    if (existingDish) {
      return res.status(400).json({ success: false, error: '菜品名称已存在，请使用其他名称' })
    }
    
    const id = uuidv4()
    run(`
      INSERT INTO dishes (id, name, price, category_id, description, tags, specs, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, price, category_id || null, description || '', JSON.stringify(tags || []), JSON.stringify(specs || []), image_url || null])
    
    const dish = get<{
      id: string
      name: string
      price: number
      image_url: string | null
      category_id: string | null
      category_name: string | null
      description: string | null
      tags: string
      specs: string
      status: string
    }>(`
      SELECT d.*, c.name as category_name 
      FROM dishes d 
      LEFT JOIN categories c ON d.category_id = c.id 
      WHERE d.id = ?
    `, [id])
    
    const result = {
      ...dish,
      tags: safeJsonParse(dish?.tags, []),
      specs: safeJsonParse(dish?.specs, []),
    }
    
    res.status(201).json({ success: true, data: result })
  } catch (error) {
    console.error('Error creating dish:', error)
    res.status(500).json({ success: false, error: 'Failed to create dish' })
  }
})

// ===== Reorder Dishes (must be before /:id routes) =====

adminRouter.put('/dishes/reorder', requireAuth, (req, res) => {
  try {
    const { orders } = req.body as { orders: { id: string; sort_order: number }[] }
    
    if (!Array.isArray(orders)) {
      return res.status(400).json({ success: false, error: 'Invalid orders data' })
    }
    
    beginBatch()
    for (const item of orders) {
      run('UPDATE dishes SET sort_order = ? WHERE id = ?', [item.sort_order, item.id])
    }
    endBatch()
    
    res.json({ success: true, message: 'Dishes reordered' })
  } catch (error) {
    console.error('Error reordering dishes:', error)
    res.status(500).json({ success: false, error: 'Failed to reorder dishes' })
  }
})

adminRouter.put('/dishes/:id', requireAuth, (req, res) => {
  try {
    const id = req.params.id as string
    
    // Validate input
    const validation = updateDishSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0]?.message || '参数验证失败' 
      })
    }
    
    const { name, price, category_id, description, tags, specs, image_url, status } = validation.data
    
    // 获取菜品当前的图片URL
    const currentDish = get<{ image_url: string | null; name: string; price: number }>('SELECT image_url, name, price FROM dishes WHERE id = ?', [id])
    const oldImageUrl = currentDish?.image_url || null
    
    // 检测图片是否发生变化
    const imageChanged = oldImageUrl !== (image_url || null)
    
    run(`
      UPDATE dishes 
      SET name = ?, price = ?, category_id = ?, description = ?, tags = ?, specs = ?, image_url = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name ?? currentDish?.name ?? '', price ?? currentDish?.price ?? 0, category_id || null, description || '', JSON.stringify(tags || []), JSON.stringify(specs || []), image_url || null, status || 'on_sale', id])
    
    // 如果图片发生变化，删除旧图片（如果未被其他菜品使用）
    if (imageChanged && oldImageUrl) {
      deleteDishImageIfUnused(oldImageUrl)
    }
    
    const dish = get<{
      id: string
      name: string
      price: number
      image_url: string | null
      category_id: string | null
      category_name: string | null
      description: string | null
      tags: string
      specs: string
      status: string
    }>(`
      SELECT d.*, c.name as category_name 
      FROM dishes d 
      LEFT JOIN categories c ON d.category_id = c.id 
      WHERE d.id = ?
    `, [id])
    
    const result = {
      ...dish,
      tags: safeJsonParse(dish?.tags, []),
      specs: safeJsonParse(dish?.specs, []),
    }
    
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('Error updating dish:', error)
    res.status(500).json({ success: false, error: 'Failed to update dish' })
  }
})

adminRouter.delete('/dishes/:id', requireAuth, (req, res) => {
  try {
    const id = req.params.id as string
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ success: false, error: '无效的 ID 格式' })
    }
    
    const dish = get<{ image_url: string | null }>('SELECT image_url FROM dishes WHERE id = ?', [id])
    const imageUrl = dish?.image_url || null
    
    run('DELETE FROM dishes WHERE id = ?', [id])
    
    if (imageUrl) {
      deleteDishImageIfUnused(imageUrl)
    }
    
    res.json({ success: true, message: 'Dish deleted' })
  } catch (error) {
    console.error('Error deleting dish:', error)
    res.status(500).json({ success: false, error: 'Failed to delete dish' })
  }
})

// ===== Category Management =====

adminRouter.get('/categories', requireAuth, (req, res) => {
  try {
    const categories = all('SELECT * FROM categories ORDER BY sort_order')
    res.json({ success: true, data: categories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch categories' })
  }
})

adminRouter.post('/categories', requireAuth, (req, res) => {
  try {
    // Validate input
    const validation = createCategorySchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0]?.message || '参数验证失败' 
      })
    }
    
    const { name, sort_order } = validation.data
    
    if (name.trim() === '其他') {
      return res.status(400).json({ success: false, error: '"其他"为系统保留名称，无法使用' })
    }
    
    const existingCategory = get<{ id: string }>('SELECT id FROM categories WHERE name = ?', [name.trim()])
    if (existingCategory) {
      return res.status(400).json({ success: false, error: '该分类名称已存在' })
    }
    
    const id = uuidv4()
    run('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)', [id, name.trim(), sort_order || 0])
    
    const category = get('SELECT * FROM categories WHERE id = ?', [id])
    res.status(201).json({ success: true, data: category })
  } catch (error) {
    console.error('Error creating category:', error)
    res.status(500).json({ success: false, error: 'Failed to create category' })
  }
})

adminRouter.delete('/categories/:id', requireAuth, (req, res) => {
  try {
    const id = req.params.id as string
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ success: false, error: '无效的 ID 格式' })
    }
    
    const dishCount = get<{ count: number }>('SELECT COUNT(*) as count FROM dishes WHERE category_id = ?', [id])
    if (dishCount && dishCount.count > 0) {
      return res.status(400).json({ success: false, error: '该分类下还有菜品，无法删除' })
    }
    
    run('DELETE FROM categories WHERE id = ?', [id])
    res.json({ success: true, message: 'Category deleted' })
  } catch (error) {
    console.error('Error deleting category:', error)
    res.status(500).json({ success: false, error: 'Failed to delete category' })
  }
})

adminRouter.put('/categories/reorder', requireAuth, (req, res) => {
  try {
    const { orders } = req.body as { orders: { id: string; sort_order: number }[] }
    
    if (!Array.isArray(orders)) {
      return res.status(400).json({ success: false, error: 'Invalid orders data' })
    }
    
    beginBatch()
    for (const item of orders) {
      run('UPDATE categories SET sort_order = ? WHERE id = ?', [item.sort_order, item.id])
    }
    endBatch()
    
    res.json({ success: true, message: 'Categories reordered' })
  } catch (error) {
    console.error('Error reordering categories:', error)
    res.status(500).json({ success: false, error: 'Failed to reorder categories' })
  }
})

// ===== Order Management =====

adminRouter.get('/orders', requireAuth, (req, res) => {
  try {
    const { status, startDate, endDate } = req.query
    let query = `
      SELECT o.*, t.name as table_name, t.table_no
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE 1=1
    `
    const params: (string | number | null)[] = []

    if (status) {
      query += ' AND o.status = ?'
      params.push(status as string)
    }

    if (startDate) {
      query += ' AND date(o.created_at, \'localtime\') >= ?'
      params.push(startDate as string)
    }
    if (endDate) {
      query += ' AND date(o.created_at, \'localtime\') <= ?'
      params.push(endDate as string)
    }
    
    query += ' ORDER BY o.created_at DESC'
    
    const orders = all<{
      id: string
      order_no: string
      table_name: string | null
      table_no: string | null
      contact_name: string | null
      contact_phone: string | null
      total_amount: number
      status: string
      created_at: string
      dining_time: string | null
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

// 按订单号搜索订单（必须在 /:id 路由之前）
adminRouter.get('/orders/search', requireAuth, (req, res) => {
  try {
    const { order_no } = req.query
    if (!order_no || typeof order_no !== 'string') {
      return res.status(400).json({ success: false, error: '请输入订单号' })
    }
    
    // 支持模糊搜索
    const query = `
      SELECT o.*, t.name as table_name, t.table_no
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.order_no LIKE ?
      ORDER BY o.created_at DESC
      LIMIT 20
    `
    const searchOrders = all<{
      id: string
      order_no: string
      table_name: string | null
      table_no: string | null
      contact_name: string | null
      contact_phone: string | null
      total_amount: number
      status: string
      created_at: string
      dining_time: string | null
    }>(query, [`%${order_no}%`])
    
    if (searchOrders.length === 0) {
      return res.json({ success: true, data: [] })
    }
    
    // 批量查询订单明细
    const orderIds = searchOrders.map(o => o.id)
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
    
    const itemsByOrder = new Map<string, typeof allItems>()
    for (const item of allItems) {
      const list = itemsByOrder.get(item.order_id)
      if (list) {
        list.push(item)
      } else {
        itemsByOrder.set(item.order_id, [item])
      }
    }
    
    const result = searchOrders.map(order => ({
      ...order,
      created_at: formatDateTime(order.created_at),
      items: itemsByOrder.get(order.id) || []
    }))
    
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('Error searching orders:', error)
    res.status(500).json({ success: false, error: '搜索订单失败' })
  }
})

adminRouter.put('/orders/:id/status', requireAuth, (req, res) => {
  try {
    const id = req.params.id as string
    
    // 验证状态白名单
    const validation = updateOrderStatusSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0]?.message || '无效的订单状态'
      })
    }
    
    const { status } = validation.data
    
    const order = get<{ id: string; table_id: string | null; status: string }>('SELECT * FROM orders WHERE id = ?', [id])
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }
    
    // Update order status
    run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id])
    
    // If order is completed or cancelled, free the table
    if ((status === 'completed' || status === 'cancelled') && order.table_id) {
      run('UPDATE tables SET status = \'available\', updated_at = CURRENT_TIMESTAMP WHERE id = ?', [order.table_id])
    }
    
    // SSE 广播订单状态变更事件
    broadcastSSE('order_updated', { id, status })
    
    res.json({ success: true, message: 'Order status updated' })
  } catch (error) {
    console.error('Error updating order status:', error)
    res.status(500).json({ success: false, error: 'Failed to update order status' })
  }
})

// 删除单条订单
adminRouter.delete('/orders/:id', requireAuth, (req, res) => {
  try {
    const id = req.params.id as string

    if (!isValidUUID(id)) {
      return res.status(400).json({ success: false, error: '无效的 ID 格式' })
    }

    const order = get<{ id: string; table_id: string | null; status: string }>(
      'SELECT * FROM orders WHERE id = ?', [id]
    )

    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' })
    }

    // 删除关联的订单项和订单记录
    beginBatch()
    run('DELETE FROM order_items WHERE order_id = ?', [id])
    run('DELETE FROM orders WHERE id = ?', [id])
    endBatch()

    // 如果订单关联桌位且处于活跃状态，释放桌位
    if (order.table_id && (order.status === 'pending' || order.status === 'confirmed')) {
      run('UPDATE tables SET status = \'available\', updated_at = CURRENT_TIMESTAMP WHERE id = ?', [order.table_id])
    }

    // SSE 广播订单删除事件
    broadcastSSE('order_deleted', { id })

    res.json({ success: true, message: '订单已删除' })
  } catch (error) {
    console.error('Error deleting order:', error)
    res.status(500).json({ success: false, error: '删除订单失败' })
  }
})

// ===== Inventory Management =====

adminRouter.get('/inventory', requireAuth, (req, res) => {
  try {
    const inventory = all('SELECT * FROM inventory ORDER BY sort_order, material_name')
    res.json({ success: true, data: inventory })
  } catch (error) {
    console.error('Error fetching inventory:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch inventory' })
  }
})

adminRouter.post('/inventory', requireAuth, (req, res) => {
  try {
    // Validate input
    const validation = createInventorySchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0]?.message || '参数验证失败' 
      })
    }
    
    const { material_name, quantity, unit, warning_threshold } = validation.data
    
    const existingItem = get<{ id: string }>('SELECT id FROM inventory WHERE material_name = ?', [material_name])
    if (existingItem) {
      return res.status(400).json({ success: false, error: '物料名称已存在，请使用其他名称' })
    }
    
    const id = uuidv4()
    run('INSERT INTO inventory (id, material_name, quantity, unit, warning_threshold) VALUES (?, ?, ?, ?, ?)', [id, material_name, quantity, unit, warning_threshold || 0])
    
    const item = get('SELECT * FROM inventory WHERE id = ?', [id])
    res.status(201).json({ success: true, data: item })
  } catch (error) {
    console.error('Error creating inventory item:', error)
    res.status(500).json({ success: false, error: 'Failed to create inventory item' })
  }
})

// ===== Reorder Inventory (must be before /:id routes) =====

adminRouter.put('/inventory/reorder', requireAuth, (req, res) => {
  try {
    const { orders } = req.body as { orders: { id: string; sort_order: number }[] }
    
    if (!Array.isArray(orders)) {
      return res.status(400).json({ success: false, error: 'Invalid orders data' })
    }
    
    beginBatch()
    for (const item of orders) {
      run('UPDATE inventory SET sort_order = ? WHERE id = ?', [item.sort_order, item.id])
    }
    endBatch()
    
    res.json({ success: true, message: 'Inventory reordered' })
  } catch (error) {
    console.error('Error reordering inventory:', error)
    res.status(500).json({ success: false, error: 'Failed to reorder inventory' })
  }
})

adminRouter.put('/inventory/:id', requireAuth, (req, res) => {
  try {
    const id = req.params.id as string
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ success: false, error: '无效的 ID 格式' })
    }
    
    // 使用 zod 验证输入
    const validation = updateInventorySchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0]?.message || '参数验证失败'
      })
    }
    
    const { quantity, warning_threshold } = validation.data
    
    const existing = get<{ id: string }>('SELECT id FROM inventory WHERE id = ?', [id])
    if (!existing) {
      return res.status(404).json({ success: false, error: '库存项不存在' })
    }
    
    run('UPDATE inventory SET quantity = ?, warning_threshold = COALESCE(?, warning_threshold), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [quantity, warning_threshold ?? null, id])
    
    const item = get('SELECT * FROM inventory WHERE id = ?', [id])
    res.json({ success: true, data: item })
  } catch (error) {
    console.error('Error updating inventory:', error)
    res.status(500).json({ success: false, error: 'Failed to update inventory' })
  }
})

adminRouter.delete('/inventory/:id', requireAuth, (req, res) => {
  try {
    const id = req.params.id as string
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ success: false, error: '无效的 ID 格式' })
    }
    
    const existing = get<{ id: string }>('SELECT id FROM inventory WHERE id = ?', [id])
    if (!existing) {
      return res.status(404).json({ success: false, error: '库存项不存在' })
    }
    
    run('DELETE FROM inventory WHERE id = ?', [id])
    res.json({ success: true, message: 'Inventory item deleted' })
  } catch (error) {
    console.error('Error deleting inventory:', error)
    res.status(500).json({ success: false, error: 'Failed to delete inventory item' })
  }
})

// ===== User Management =====

adminRouter.get('/users', requireAuth, (req, res) => {
  try {
    const users = all<{
      id: string
      username: string
      role: string
      name: string | null
      phone: string | null
      created_at: string
      updated_at: string
    }>('SELECT id, username, role, name, phone, created_at, updated_at FROM users ORDER BY created_at ASC')
    res.json({ success: true, data: users })
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ success: false, error: '获取用户列表失败' })
  }
})

adminRouter.post('/users', requireAuth, async (req, res) => {
  try {
    const validation = createUserSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0]?.message || '参数验证失败'
      })
    }

    const { username, password, role, name, phone } = validation.data

    const existingUser = get<{ id: string }>('SELECT id FROM users WHERE username = ?', [username])
    if (existingUser) {
      return res.status(400).json({ success: false, error: '用户名已存在' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const id = randomBytes(16).toString('hex')
    run(
      'INSERT INTO users (id, username, password, role, name, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, hashedPassword, role, name || null, phone || null]
    )

    const user = get<{
      id: string
      username: string
      role: string
      name: string | null
      phone: string | null
      created_at: string
      updated_at: string
    }>('SELECT id, username, role, name, phone, created_at, updated_at FROM users WHERE id = ?', [id])
    res.status(201).json({ success: true, data: user })
  } catch (error) {
    console.error('Error creating user:', error)
    res.status(500).json({ success: false, error: '创建用户失败' })
  }
})

adminRouter.put('/users/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string

    const validation = updateUserSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0]?.message || '参数验证失败'
      })
    }

    const { password, role, name, phone } = validation.data

    const existing = get<{ id: string; username: string }>('SELECT id, username FROM users WHERE id = ?', [id])
    if (!existing) {
      return res.status(404).json({ success: false, error: '用户不存在' })
    }

    // 主管理员不可编辑
    if (existing.username === 'admin') {
      return res.status(400).json({ success: false, error: '主管理员不可编辑' })
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10)
      run(
        'UPDATE users SET password = ?, role = COALESCE(?, role), name = COALESCE(?, name), phone = COALESCE(?, phone), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedPassword, role ?? null, name ?? null, phone ?? null, id]
      )
    } else {
      run(
        'UPDATE users SET role = COALESCE(?, role), name = COALESCE(?, name), phone = COALESCE(?, phone), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [role ?? null, name ?? null, phone ?? null, id]
      )
    }

    const user = get<{
      id: string
      username: string
      role: string
      name: string | null
      phone: string | null
      created_at: string
      updated_at: string
    }>('SELECT id, username, role, name, phone, created_at, updated_at FROM users WHERE id = ?', [id])
    res.json({ success: true, data: user })
  } catch (error) {
    console.error('Error updating user:', error)
    res.status(500).json({ success: false, error: '更新用户失败' })
  }
})

adminRouter.delete('/users/:id', requireAuth, (req, res) => {
  try {
    const id = req.params.id as string

    const existing = get<{ id: string; role: string; username: string }>('SELECT id, role, username FROM users WHERE id = ?', [id])
    if (!existing) {
      return res.status(404).json({ success: false, error: '用户不存在' })
    }

    // 主管理员不可删除
    if (existing.username === 'admin') {
      return res.status(400).json({ success: false, error: '主管理员不可删除' })
    }

    // 获取当前操作者身份
    const token = req.cookies?.[COOKIE_NAME]
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    if (decoded.userId === id) {
      return res.status(400).json({ success: false, error: '不能删除当前登录的用户' })
    }

    // 禁止删除最后一个管理员
    if (existing.role === 'admin') {
      const adminCount = get<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin'])
      if (adminCount && adminCount.count <= 1) {
        return res.status(400).json({ success: false, error: '不能删除最后一个管理员账户' })
      }
    }

    run('DELETE FROM users WHERE id = ?', [id])
    res.json({ success: true, message: '用户已删除' })
  } catch (error) {
    console.error('Error deleting user:', error)
    res.status(500).json({ success: false, error: '删除用户失败' })
  }
})

// ===== Settings Management =====

adminRouter.get('/settings', requireAuth, (req, res) => {
  try {
    const settings = all<{ key: string; value: string }>('SELECT key, value FROM settings')
    const settingsMap: Record<string, string> = {}
    for (const s of settings) {
      settingsMap[s.key] = s.value
    }
    res.json({ success: true, data: settingsMap })
  } catch (error) {
    console.error('Error fetching settings:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch settings' })
  }
})

adminRouter.put('/settings', requireAuth, (req, res) => {
  try {
    const settings = req.body as Record<string, string>
    for (const [key, value] of Object.entries(settings)) {
      run(
        'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP',
        [key, value, value]
      )
    }
    res.json({ success: true, message: 'Settings updated' })
  } catch (error) {
    console.error('Error updating settings:', error)
    res.status(500).json({ success: false, error: 'Failed to update settings' })
  }
})

// ===== Reset Database =====

adminRouter.post('/reset-database', requireAuth, (req, res) => {
  try {
    // 二次确认机制：必须提供 confirm: 'RESET'
    const validation = confirmResetSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: '危险操作：请在请求中提供 confirm: "RESET" 以确认重置数据库'
      })
    }
    
    beginBatch()
    run('DELETE FROM order_items')
    run('DELETE FROM orders')
    run('DELETE FROM inventory')
    run('DELETE FROM dishes')
    run('DELETE FROM categories')
    run('DELETE FROM tables')
    endBatch()
    
    if (existsSync(sourcesDir)) {
      const files = readdirSync(sourcesDir)
      for (const file of files) {
        const filePath = resolve(sourcesDir, file)
        try {
          unlinkSync(filePath)
        } catch (e) {
          console.error('Failed to delete file:', filePath, e)
        }
      }
    }
    
    const defaultSettings = [
      { key: 'restaurant_name', value: '红灯笼食府' },
      { key: 'restaurant_phone', value: '' },
      { key: 'restaurant_address', value: '' },
      { key: 'business_hours', value: '11:00-21:00' },
      { key: 'notification_email', value: '' },
      { key: 'notification_phone', value: '' },
    ]
    for (const setting of defaultSettings) {
      run(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [setting.key, setting.value]
      )
    }
    
    const hashedPassword = bcrypt.hashSync('admin123', 10)
    run(
      'UPDATE users SET password = ?, name = ? WHERE role = ?',
      [hashedPassword, '管理员', 'admin']
    )
    
    res.json({ success: true, message: 'Database reset successfully' })
  } catch (error) {
    console.error('Error resetting database:', error)
    res.status(500).json({ success: false, error: 'Failed to reset database' })
  }
})

// ===== Clear Orders =====

adminRouter.post('/clear-orders', requireAuth, (req, res) => {
  try {
    beginBatch()
    run("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE status IN ('completed', 'cancelled'))")
    run("DELETE FROM orders WHERE status IN ('completed', 'cancelled')")
    endBatch()
    
    res.json({ success: true, message: '已完成和已取消的订单已清空' })
  } catch (error) {
    console.error('Error clearing orders:', error)
    res.status(500).json({ success: false, error: 'Failed to clear orders' })
  }
})

// ===== Upload Image =====

/**
 * 图片处理配置
 * - 最大宽度: 800px
 * - 质量: 80%
 * - 格式: WebP (如果支持) 否则 JPEG
 */
const IMAGE_MAX_WIDTH = 800
const IMAGE_QUALITY = 80

adminRouter.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' })
    }
    
    const inputPath = req.file.path
    const timestamp = Date.now()
    const randomSuffix = Math.round(Math.random() * 1E9)
    
    // 使用 sharp 处理图片
    const image = sharp(inputPath)
    const metadata = await image.metadata()
    
    // 计算缩放尺寸
    let width: number | undefined = undefined
    if (metadata.width && metadata.width > IMAGE_MAX_WIDTH) {
      width = IMAGE_MAX_WIDTH
    }
    
    // 生成 WebP 格式的输出文件名
    const outputFilename = `${timestamp}-${randomSuffix}.webp`
    const outputPath = resolve(sourcesDir, outputFilename)
    
    // 处理图片：缩放 + 转换为 WebP + 压缩质量
    await image
      .resize(width, undefined, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: IMAGE_QUALITY })
      .toFile(outputPath)
    
    // 删除原始上传的文件
    try {
      unlinkSync(inputPath)
    } catch (e) {
      console.error('Failed to delete original file:', inputPath, e)
    }
    
    const imageUrl = `/sources/${outputFilename}`
    res.json({ success: true, data: { url: imageUrl } })
  } catch (error) {
    console.error('Error uploading file:', error)
    res.status(500).json({ success: false, error: 'Failed to upload file' })
  }
})

// ===== Delete Image =====

adminRouter.delete('/image', requireAuth, (req, res) => {
  try {
    const { url } = req.body
    
    if (!url) {
      return res.status(400).json({ success: false, error: '图片URL不能为空' })
    }
    
    const filename = url.replace('/sources/', '')
    if (!filename || filename === url) {
      return res.status(400).json({ success: false, error: '无效的图片URL' })
    }
    
    const filePath = resolve(sourcesDir, filename)
    
    if (!filePath.startsWith(sourcesDir)) {
      return res.status(400).json({ success: false, error: '无效的文件路径' })
    }
    
    const dishUsingImage = get<{ id: string }>('SELECT id FROM dishes WHERE image_url = ?', [url])
    if (dishUsingImage) {
      return res.status(400).json({ success: false, error: '该图片正在被菜品使用，无法删除' })
    }
    
    if (!existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '图片文件不存在' })
    }
    
    unlinkSync(filePath)
    res.json({ success: true, message: '图片删除成功' })
  } catch (error) {
    console.error('Error deleting image:', error)
    res.status(500).json({ success: false, error: '删除图片失败' })
  }
})

// ===== Data Import =====

/**
 * ZIP 文件上传配置
 * - 仅接受 .zip 文件
 * - 最大文件大小: 50MB
 */
const uploadZip = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (extname(file.originalname).toLowerCase() === '.zip') {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only ZIP files are allowed.'))
    }
  }
})

/**
 * 数据导入 manifest 类型定义
 */
interface ImportManifest {
  version?: string
  exportDate?: string
  tables?: number
  dishes?: number
  categories?: number
  orders?: number
  inventory?: number
  settings?: number
}

/**
 * 订单数据类型定义
 */
interface OrderData {
  id: string
  order_no: string
  table_id: string | null
  dining_time: string | null
  contact_name: string | null
  contact_phone: string | null
  total_amount: number
  status: string
  created_at?: string
  updated_at?: string
  items?: OrderItemData[]
}

/**
 * 订单项数据类型定义
 */
interface OrderItemData {
  id: string
  order_id: string
  dish_id: string
  dish_name: string
  quantity: number
  price: number
  subtotal: number
  specs?: string
  created_at?: string
}

/**
 * POST /admin/import
 * 数据导入端点
 * 接收 ZIP 文件，验证结构，导入数据
 */
adminRouter.post('/import', requireAuth, uploadZip.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传 ZIP 文件' })
    }

    // 解压 ZIP 文件
    const zip = new AdmZip(req.file.buffer)
    const zipEntries = zip.getEntries()

    // 验证 ZIP 结构：必须包含 data/manifest.json
    const manifestEntry = zipEntries.find(entry => entry.entryName === 'data/manifest.json')
    if (!manifestEntry) {
      return res.status(400).json({ success: false, error: 'ZIP 文件结构无效，缺少 data/manifest.json' })
    }

    // 读取 manifest.json
    const manifestContent = manifestEntry.getData().toString('utf8')
    const manifest: ImportManifest = JSON.parse(manifestContent)

    // 统计导入数据
    const stats = {
      orders: 0,
      orderItems: 0,
      tables: 0,
      dishes: 0,
      categories: 0,
      inventory: 0,
      settings: 0,
      images: 0
    }

    // 开始批量操作
    beginBatch()

    try {
      // 清空现有数据（按照外键依赖顺序删除）
      run('DELETE FROM order_items')
      run('DELETE FROM orders')
      run('DELETE FROM inventory')
      run('DELETE FROM dishes')
      run('DELETE FROM categories')
      run('DELETE FROM tables')

      // 导入 categories
      const categoriesEntry = zipEntries.find(entry => entry.entryName === 'data/categories.json')
      if (categoriesEntry) {
        const categoriesContent = categoriesEntry.getData().toString('utf8')
        const categories = JSON.parse(categoriesContent)
        for (const category of categories) {
          run(
            'INSERT INTO categories (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            [category.id, category.name, category.sort_order || 0, category.created_at || null, category.updated_at || null]
          )
          stats.categories++
        }
      }

      // 导入 tables
      const tablesEntry = zipEntries.find(entry => entry.entryName === 'data/tables.json')
      if (tablesEntry) {
        const tablesContent = tablesEntry.getData().toString('utf8')
        const tables = JSON.parse(tablesContent)
        for (const table of tables) {
          run(
            'INSERT INTO tables (id, table_no, name, capacity, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [table.id, table.table_no, table.name, table.capacity || 4, table.status || 'available', table.created_at || null, table.updated_at || null]
          )
          stats.tables++
        }
      }

      // 导入 dishes
      const dishesEntry = zipEntries.find(entry => entry.entryName === 'data/dishes.json')
      if (dishesEntry) {
        const dishesContent = dishesEntry.getData().toString('utf8')
        const dishes = JSON.parse(dishesContent)
        for (const dish of dishes) {
          run(
            'INSERT INTO dishes (id, name, price, category_id, description, tags, specs, image_url, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              dish.id,
              dish.name,
              dish.price,
              dish.category_id || null,
              dish.description || '',
              JSON.stringify(dish.tags || []),
              JSON.stringify(dish.specs || []),
              dish.image_url || null,
              dish.status || 'on_sale',
              dish.sort_order || 0,
              dish.created_at || null,
              dish.updated_at || null
            ]
          )
          stats.dishes++
        }
      }

      // 导入 orders 和 order_items
      const ordersEntry = zipEntries.find(entry => entry.entryName === 'data/orders.json')
      if (ordersEntry) {
        const ordersContent = ordersEntry.getData().toString('utf8')
        const orders: OrderData[] = JSON.parse(ordersContent)
        for (const order of orders) {
          run(
            'INSERT INTO orders (id, order_no, table_id, dining_time, contact_name, contact_phone, total_amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              order.id,
              order.order_no,
              order.table_id || null,
              order.dining_time || null,
              order.contact_name || null,
              order.contact_phone || null,
              order.total_amount,
              order.status || 'pending',
              order.created_at || null,
              order.updated_at || null
            ]
          )
          stats.orders++

          // 导入订单项
          if (order.items && Array.isArray(order.items)) {
            for (const item of order.items) {
              run(
                'INSERT INTO order_items (id, order_id, dish_id, dish_name, quantity, price, subtotal, specs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                  item.id,
                  item.order_id,
                  item.dish_id,
                  item.dish_name,
                  item.quantity,
                  item.price,
                  item.subtotal,
                  item.specs || null,
                  item.created_at || null
                ]
              )
              stats.orderItems++
            }
          }
        }
      }

      // 导入 inventory
      const inventoryEntry = zipEntries.find(entry => entry.entryName === 'data/inventory.json')
      if (inventoryEntry) {
        const inventoryContent = inventoryEntry.getData().toString('utf8')
        const inventoryItems = JSON.parse(inventoryContent)
        for (const item of inventoryItems) {
          run(
            'INSERT INTO inventory (id, material_name, quantity, unit, warning_threshold, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              item.id,
              item.material_name,
              item.quantity,
              item.unit,
              item.warning_threshold || 0,
              item.sort_order || 0,
              item.created_at || null,
              item.updated_at || null
            ]
          )
          stats.inventory++
        }
      }

      // 导入 settings
      const settingsEntry = zipEntries.find(entry => entry.entryName === 'data/settings.json')
      if (settingsEntry) {
        const settingsContent = settingsEntry.getData().toString('utf8')
        const settings = JSON.parse(settingsContent)
        for (const [key, value] of Object.entries(settings)) {
          run(
            'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [key, String(value)]
          )
          stats.settings++
        }
      }

      // 结束批量操作
      endBatch()

      // 解压 sources/ 目录下的图片到 public/sources
      const sourceImages = zipEntries.filter(entry => 
        entry.entryName.startsWith('sources/') && 
        !entry.isDirectory &&
        entry.entryName !== 'sources/'
      )

      for (const imageEntry of sourceImages) {
        const rawRelativePath = imageEntry.entryName.replace('sources/', '')
        if (rawRelativePath) {
          // 标准化路径并检查路径穿越
          const normalizedPath = normalize(rawRelativePath)
          
          // 安全检查：禁止包含 .. 的路径片段
          if (normalizedPath.includes('..')) {
            console.warn('Skipping suspicious path:', rawRelativePath)
            continue
          }
          
          // 安全检查：只允许图片文件扩展名
          const ext = extname(normalizedPath).toLowerCase()
          const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
          if (!allowedImageTypes.includes(ext)) {
            console.warn('Skipping non-image file:', rawRelativePath)
            continue
          }
          
          const outputPath = resolve(sourcesDir, normalizedPath)
          
          // 安全检查：确保文件路径在 sourcesDir 目录下
          if (outputPath.startsWith(sourcesDir)) {
            const imageData = imageEntry.getData()
            writeFileSync(outputPath, imageData)
            stats.images++
          }
        }
      }

      res.json({
        success: true,
        message: '数据导入成功',
        data: {
          manifest: {
            version: manifest.version,
            exportDate: manifest.exportDate
          },
          stats
        }
      })
    } catch (importError) {
      // 如果导入过程中出错，结束批量操作并抛出错误
      endBatch()
      throw importError
    }
  } catch (error) {
    console.error('Error importing data:', error)
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '数据导入失败' 
    })
  }
})

// ===== Data Export =====

/**
 * 数据导出端点
 * 导出所有业务数据（订单、桌位、菜品、分类、库存、设置）和图片资源
 * 生成 ZIP 文件供下载
 */
adminRouter.get('/export', requireAuth, (req, res) => {
  try {
    // 1. 收集所有数据
    const orders = all<{ id: string }>('SELECT * FROM orders ORDER BY created_at DESC')
    const orderItems = all<{ order_id: string }>('SELECT * FROM order_items ORDER BY order_id, created_at')
    const tables = all('SELECT * FROM tables ORDER BY table_no')
    const dishes = all('SELECT * FROM dishes ORDER BY created_at DESC')
    const categories = all('SELECT * FROM categories ORDER BY sort_order')
    const inventory = all('SELECT * FROM inventory ORDER BY sort_order, material_name')
    const settings = all<{ key: string; value: string }>('SELECT key, value FROM settings')

    // 将设置转换为对象格式
    const settingsMap: Record<string, string> = {}
    for (const s of settings) {
      settingsMap[s.key] = s.value
    }

    // 2. 获取图片文件列表
    let imageFiles: string[] = []
    if (existsSync(sourcesDir)) {
      imageFiles = readdirSync(sourcesDir)
    }

    // 3. 创建 manifest
    const manifest = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      counts: {
        orders: orders.length,
        orderItems: orderItems.length,
        tables: tables.length,
        dishes: dishes.length,
        categories: categories.length,
        inventory: inventory.length,
        settings: settings.length,
        images: imageFiles.length
      }
    }

    // 4. 生成文件名（使用当前日期）
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0] // YYYY-MM-DD
    const filename = `restaurant-backup-${dateStr}.zip`

    // 5. 设置响应头
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`)

    // 6. 创建 archiver 实例
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高压缩级别
    })

    // 错误处理
    archive.on('error', (err) => {
      console.error('Archive error:', err)
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to create archive' })
      }
    })

    // 将 ZIP 流管道到响应
    archive.pipe(res)

    // 将订单项嵌入到订单中
    const ordersWithItems = orders.map((order: { id: string }) => {
      const items = orderItems.filter((item: { order_id: string }) => item.order_id === order.id)
      return { ...order, items }
    })

    // 7. 添加数据文件到 ZIP
    archive.append(JSON.stringify(manifest, null, 2), { name: 'data/manifest.json' })
    archive.append(JSON.stringify(ordersWithItems, null, 2), { name: 'data/orders.json' })
    archive.append(JSON.stringify(tables, null, 2), { name: 'data/tables.json' })
    archive.append(JSON.stringify(dishes, null, 2), { name: 'data/dishes.json' })
    archive.append(JSON.stringify(categories, null, 2), { name: 'data/categories.json' })
    archive.append(JSON.stringify(inventory, null, 2), { name: 'data/inventory.json' })
    archive.append(JSON.stringify(settingsMap, null, 2), { name: 'data/settings.json' })

    // 8. 添加图片文件到 ZIP
    for (const imageFile of imageFiles) {
      const imagePath = resolve(sourcesDir, imageFile)
      // 安全检查：确保文件路径在 sourcesDir 目录下
      if (imagePath.startsWith(sourcesDir) && existsSync(imagePath)) {
        archive.append(createReadStream(imagePath), { name: `sources/${imageFile}` })
      }
    }

    // 9. 完成归档
    archive.finalize()
  } catch (error) {
    console.error('Error exporting data:', error)
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to export data' })
    }
  }
})

// ===== Debug Tools =====

// 危险 SQL 关键字黑名单
const DANGEROUS_SQL = /\b(DROP\s+TABLE|DROP\s+DATABASE|ALTER\s+TABLE\s+\w+\s+DROP|ATTACH|DETACH)\b/i

adminRouter.post('/debug/query', requireAuth, (req, res) => {
  try {
    const { sql } = req.body
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ success: false, error: '请提供 SQL 语句' })
    }

    const trimmed = sql.trim()
    if (!trimmed) {
      return res.status(400).json({ success: false, error: 'SQL 语句不能为空' })
    }

    // 安全检查：禁止危险操作
    if (DANGEROUS_SQL.test(trimmed)) {
      return res.status(403).json({ success: false, error: '禁止执行危险的 SQL 操作（如 DROP TABLE）' })
    }

    const database = getDb()
    const isSelect = /^\s*(SELECT|PRAGMA|EXPLAIN)/i.test(trimmed)

    if (isSelect) {
      const stmt = database.prepare(trimmed)
      const columns: string[] = []
      const rows: Record<string, unknown>[] = []

      // 获取列名
      if (stmt.step()) {
        const firstRow = stmt.getAsObject()
        const cols = Object.keys(firstRow)
        columns.push(...cols)
        rows.push(firstRow)

        while (stmt.step()) {
          rows.push(stmt.getAsObject())
        }
      }

      stmt.free()
      res.json({ success: true, data: { columns, rows, changes: 0 } })
    } else {
      database.run(trimmed)
      const changes = database.getRowsModified()
      // 非 SELECT 操作也需要保存到文件
      saveDatabase()

      res.json({ success: true, data: { columns: [], rows: [], changes } })
    }
  } catch (error) {
    console.error('Error executing debug query:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'SQL 执行失败'
    })
  }
})

adminRouter.get('/debug/schema', requireAuth, (req, res) => {
  try {
    // 获取所有表名
    const tablesList = all<{ name: string; sql: string }>(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )

    const tables = tablesList.map(table => {
      // 获取每个表的列信息
      const columns = all<{
        cid: number
        name: string
        type: string
        notnull: number
        dflt_value: string | null
        pk: number
      }>(`PRAGMA table_info('${table.name}')`)

      // 获取外键信息
      const foreignKeys = all<{
        id: number
        seq: number
        table: string
        from: string
        to: string
      }>(`PRAGMA foreign_key_list('${table.name}')`)

      return {
        name: table.name,
        sql: table.sql,
        columns,
        foreignKeys
      }
    })

    res.json({ success: true, data: { tables } })
  } catch (error) {
    console.error('Error fetching schema:', error)
    res.status(500).json({ success: false, error: '获取 schema 失败' })
  }
})