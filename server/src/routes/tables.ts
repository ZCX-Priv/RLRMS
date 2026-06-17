import { Router } from 'express'
import { all, get } from '../db/index.js'
import { getCached, setCached } from '../utils/cache.js'

export const tablesRouter = Router()

// Get all tables
tablesRouter.get('/', (req, res) => {
  try {
    // 尝试命中缓存
    const cacheKey = 'tables'
    const cached = getCached<unknown[]>(cacheKey)
    if (cached) {
      return res.json({ success: true, data: cached })
    }

    const tables = all('SELECT * FROM tables ORDER BY table_no')
    // 写入缓存，TTL 60 秒
    setCached(cacheKey, tables, 60000)
    res.json({ success: true, data: tables })
  } catch (error) {
    console.error('Error fetching tables:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch tables' })
  }
})

// Get available tables for a specific dining time
tablesRouter.get('/available-for', (req, res) => {
  try {
    const { dining_time } = req.query
    if (!dining_time || typeof dining_time !== 'string') {
      return res.status(400).json({ success: false, error: '请提供就餐时间参数' })
    }
    
    // 返回：status=available 的桌位，以及 status=reserved 但该桌位当前活跃订单的 dining_time 不等于目标时段的桌位
    const tables = all(`
      SELECT t.* FROM tables t
      WHERE t.status = 'available'
         OR (t.status = 'reserved' AND t.id NOT IN (
           SELECT o.table_id FROM orders o
           WHERE o.status IN ('pending', 'confirmed') AND o.dining_time = ?
         ))
      ORDER BY t.table_no
    `, [dining_time])
    
    res.json({ success: true, data: tables })
  } catch (error) {
    console.error('Error fetching available tables for dining time:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch available tables' })
  }
})

// Get available tables
tablesRouter.get('/available', (req, res) => {
  try {
    // 尝试命中缓存
    const cacheKey = 'tables_available'
    const cached = getCached<unknown[]>(cacheKey)
    if (cached) {
      return res.json({ success: true, data: cached })
    }

    const tables = all(`
      SELECT * FROM tables 
      WHERE status = 'available' 
      ORDER BY table_no
    `)
    // 写入缓存，TTL 60 秒
    setCached(cacheKey, tables, 60000)
    res.json({ success: true, data: tables })
  } catch (error) {
    console.error('Error fetching available tables:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch available tables' })
  }
})

// Get table by ID
tablesRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params
    const table = get('SELECT * FROM tables WHERE id = ?', [id])
    
    if (!table) {
      return res.status(404).json({ success: false, error: 'Table not found' })
    }
    
    res.json({ success: true, data: table })
  } catch (error) {
    console.error('Error fetching table:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch table' })
  }
})