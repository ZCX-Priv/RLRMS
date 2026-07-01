import { Router } from 'express'
import { all } from '../db/index.js'
import { cacheGet, cacheSet, CACHE_KEYS } from '../utils/cache.js'

export const restaurantRouter = Router()

interface BusinessHoursEntry {
  days: number[]
  periods: { open: string; close: string }[]
}

interface RestaurantInfo {
  name: string
  phone: string
  address: string
  business_hours: BusinessHoursEntry
  description: string
  features: string[]
}

// GET /api/restaurant-info - 公开端点，无需认证
restaurantRouter.get('/', (_req, res) => {
  try {
    const cached = cacheGet<RestaurantInfo>(CACHE_KEYS.RESTAURANT_INFO)
    if (cached) {
      return res.json({ success: true, data: cached })
    }

    const settings = all<{ key: string; value: string }>('SELECT key, value FROM settings')
    const settingsMap: Record<string, string> = {}
    for (const s of settings) {
      settingsMap[s.key] = s.value
    }

    const featuresRaw = settingsMap.restaurant_features || ''
    const features = featuresRaw
      ? featuresRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    const bhRaw = settingsMap.business_hours || '{}'
    let business_hours: BusinessHoursEntry = { days: [1, 2, 3, 4, 5, 6, 7], periods: [] }
    try {
      const parsed = JSON.parse(bhRaw)
      if (Array.isArray(parsed)) {
        // 旧格式：[{ days, open, close }, ...] 迁移为新格式
        const allDays = new Set<number>()
        const periods: { open: string; close: string }[] = []
        for (const entry of parsed) {
          if (Array.isArray(entry.days)) {
            for (const d of entry.days) allDays.add(d)
          }
          if (entry.open || entry.close) {
            periods.push({ open: entry.open || '', close: entry.close || '' })
          }
        }
        business_hours = {
          days: allDays.size > 0 ? Array.from(allDays).sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6, 7],
          periods: periods.length > 0 ? periods : [{ open: '10:00', close: '22:00' }],
        }
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.periods)) {
        // 新格式：{ days, periods }
        business_hours = {
          days: Array.isArray(parsed.days) ? parsed.days : [1, 2, 3, 4, 5, 6, 7],
          periods: parsed.periods,
        }
      }
    } catch {
      // 降级为默认值
      business_hours = { days: [1, 2, 3, 4, 5, 6, 7], periods: [{ open: '10:00', close: '22:00' }] }
    }

    const data: RestaurantInfo = {
      name: settingsMap.restaurant_name || '红灯笼食府',
      phone: settingsMap.restaurant_phone || '',
      address: settingsMap.restaurant_address || '',
      business_hours,
      description: settingsMap.restaurant_description || '',
      features,
    }

    cacheSet(CACHE_KEYS.RESTAURANT_INFO, data, 60_000) // 60s TTL
    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching restaurant info:', error)
    res.status(500).json({ success: false, error: '获取餐厅信息失败' })
  }
})
