import { Router } from 'express'
import { all, get, run } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'
import { getCached, setCached } from '../utils/cache.js'

export const dishesRouter = Router()

function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue
  try {
    return JSON.parse(jsonString) as T
  } catch {
    console.warn('Failed to parse JSON:', jsonString)
    return defaultValue
  }
}

// Get all dishes with category filter (minimal fields for list view)
dishesRouter.get('/', (req, res) => {
  try {
    const { category } = req.query
    let query = `
      SELECT d.id, d.name, d.price, d.image_url, d.category_id, c.name as category_name, d.status
      FROM dishes d 
      LEFT JOIN categories c ON d.category_id = c.id 
      WHERE d.status = 'on_sale'
    `
    const params: (string | number | null)[] = []
    
    if (category) {
      query += ' AND c.name = ?'
      params.push(category as string)
    }
    
    query += ' ORDER BY c.sort_order, d.sort_order, d.created_at LIMIT 500'
    
    const dishes = all<{
      id: string
      name: string
      price: number
      image_url: string | null
      category_id: string | null
      category_name: string | null
      status: string
    }>(query, params)
    
    res.json({ success: true, data: dishes })
  } catch (error) {
    console.error('Error fetching dishes:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch dishes' })
  }
})

// Get home data (categories + dishes) - combined endpoint for low bandwidth
// IMPORTANT: This must be defined BEFORE /:id to avoid route conflicts
dishesRouter.get('/home-data', (req, res) => {
  try {
    // 尝试命中缓存
    const cacheKey = 'home_data'
    const cached = getCached<{ categories: unknown[]; dishes: unknown[] }>(cacheKey)
    if (cached) {
      return res.json({ success: true, data: cached })
    }

    const categories = all<{
      id: string
      name: string
      sort_order: number
    }>('SELECT id, name, sort_order FROM categories ORDER BY sort_order')

    const rawDishes = all<{
      id: string
      name: string
      price: number
      image_url: string | null
      category_id: string | null
      category_name: string | null
      status: string
      tags: string
      specs: string
    }>(`
      SELECT d.id, d.name, d.price, d.image_url, d.category_id, c.name as category_name, d.status, d.tags, d.specs
      FROM dishes d 
      LEFT JOIN categories c ON d.category_id = c.id 
      WHERE d.status = 'on_sale'
      ORDER BY c.sort_order, d.sort_order, d.created_at
    `)

    const dishes = rawDishes.map(dish => ({
      ...dish,
      tags: safeJsonParse(dish.tags, []),
      specs: safeJsonParse(dish.specs, []),
    }))

    const data = { categories, dishes }
    // 写入缓存，TTL 60 秒
    setCached(cacheKey, data, 60000)

    res.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Error fetching home data:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch home data' })
  }
})

// Search dishes (minimal fields for list view)
// IMPORTANT: This must be defined BEFORE /:id to avoid route conflicts
dishesRouter.get('/search/query', (req, res) => {
  try {
    const { q } = req.query
    if (!q || typeof q !== 'string') {
      return res.json({ success: true, data: [] })
    }
    
    const rawDishes = all<{
      id: string
      name: string
      price: number
      image_url: string | null
      category_id: string | null
      category_name: string | null
      status: string
      tags: string
      specs: string
    }>(`
      SELECT d.id, d.name, d.price, d.image_url, d.category_id, c.name as category_name, d.status, d.tags, d.specs
      FROM dishes d 
      LEFT JOIN categories c ON d.category_id = c.id 
      WHERE d.status = 'on_sale' AND d.name LIKE ?
      ORDER BY d.name
    `, [`%${q}%`])
    
    const dishes = rawDishes.map(dish => ({
      ...dish,
      tags: safeJsonParse(dish.tags, []),
      specs: safeJsonParse(dish.specs, []),
    }))
    
    res.json({ success: true, data: dishes })
  } catch (error) {
    console.error('Error searching dishes:', error)
    res.status(500).json({ success: false, error: 'Failed to search dishes' })
  }
})

// Get all categories
// IMPORTANT: This must be defined BEFORE /:id to avoid route conflicts
dishesRouter.get('/categories/all', (req, res) => {
  try {
    // 尝试命中缓存
    const cacheKey = 'categories'
    const cached = getCached<unknown[]>(cacheKey)
    if (cached) {
      return res.json({ success: true, data: cached })
    }

    const categories = all('SELECT * FROM categories ORDER BY sort_order')
    // 写入缓存，TTL 60 秒
    setCached(cacheKey, categories, 60000)
    res.json({ success: true, data: categories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch categories' })
  }
})

// Get dish by ID
// IMPORTANT: This must be defined AFTER all static routes
dishesRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params
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
    
    if (!dish) {
      return res.status(404).json({ success: false, error: 'Dish not found' })
    }
    
    res.json({
      success: true,
      data: {
        ...dish,
        tags: safeJsonParse(dish.tags, []),
        specs: safeJsonParse(dish.specs, []),
      }
    })
  } catch (error) {
    console.error('Error fetching dish:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch dish' })
  }
})
