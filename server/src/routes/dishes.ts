import { Router } from 'express'
import { all, get } from '../db/index.js'
import { cacheGet, cacheSet, cacheInvalidate, CACHE_KEYS } from '../utils/cache.js'

export const dishesRouter = Router()

// 导出缓存失效函数，供 admin 路由在数据变更时调用
export function invalidateDishesCache() {
  cacheInvalidate(CACHE_KEYS.DISHES_HOME)
  cacheInvalidate(CACHE_KEYS.DISHES_LIST)
  cacheInvalidate(CACHE_KEYS.CATEGORIES)
}

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
    const cacheKey = category ? `${CACHE_KEYS.DISHES_LIST}:${category}` : CACHE_KEYS.DISHES_LIST
    const cached = cacheGet(cacheKey)
    if (cached) {
      return res.json({ success: true, data: cached })
    }

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
    
    query += ' ORDER BY c.sort_order, d.sort_order, d.created_at'
    
    const dishes = all<{
      id: string
      name: string
      price: number
      image_url: string | null
      category_id: string | null
      category_name: string | null
      status: string
    }>(query, params)
    
    cacheSet(cacheKey, dishes)
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
    const cached = cacheGet(CACHE_KEYS.DISHES_HOME)
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
      tags: JSON.parse(dish.tags || '[]'),
      specs: JSON.parse(dish.specs || '[]'),
    }))

    const data = { categories, dishes }
    cacheSet(CACHE_KEYS.DISHES_HOME, data)

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
      tags: JSON.parse(dish.tags || '[]'),
      specs: JSON.parse(dish.specs || '[]'),
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
    const cached = cacheGet(CACHE_KEYS.CATEGORIES)
    if (cached) {
      return res.json({ success: true, data: cached })
    }
    const categories = all('SELECT * FROM categories ORDER BY sort_order')
    cacheSet(CACHE_KEYS.CATEGORIES, categories)
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
