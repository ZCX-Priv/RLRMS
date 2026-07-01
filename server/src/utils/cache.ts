/**
 * 简单的 TTL 内存缓存
 * 用于缓存不频繁变化的查询结果（分类、菜品列表、设置等）
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL_MS = 30_000 // 30 seconds

/**
 * 获取缓存数据，如果不存在或已过期则返回 null
 */
export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data
}

/**
 * 设置缓存数据
 * @param key - 缓存键
 * @param data - 缓存数据
 * @param ttl - 过期时间（毫秒），默认 30 秒
 */
export function cacheSet<T>(key: string, data: T, ttl: number = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl } as CacheEntry<unknown>)
}

/**
 * 使指定缓存键失效
 */
export function cacheInvalidate(key: string): void {
  cache.delete(key)
}

/**
 * 使匹配前缀的所有缓存键失效
 */
export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}

/**
 * 清空所有缓存
 */
export function cacheClear(): void {
  cache.clear()
}

// 缓存键常量
export const CACHE_KEYS = {
  CATEGORIES: 'categories',
  DISHES_HOME: 'dishes:home-data',
  DISHES_LIST: 'dishes:list',
  DISHES_SEARCH_PREFIX: 'dishes:search:',
  SETTINGS: 'settings',
  RESTAURANT_INFO: 'restaurant-info',
  TABLES_AVAILABLE: 'tables:available',
  TABLES_AVAILABLE_FOR_PREFIX: 'tables:available-for:',
} as const
