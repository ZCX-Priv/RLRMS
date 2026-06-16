import { Router } from 'express'
import { all, get } from '../db/index.js'

export const tablesRouter = Router()

// Get all tables
tablesRouter.get('/', (req, res) => {
  try {
    const tables = all('SELECT * FROM tables ORDER BY table_no')
    res.json({ success: true, data: tables })
  } catch (error) {
    console.error('Error fetching tables:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch tables' })
  }
})

// Get available tables
tablesRouter.get('/available', (req, res) => {
  try {
    const tables = all(`
      SELECT * FROM tables 
      WHERE status = 'available' 
      ORDER BY table_no
    `)
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