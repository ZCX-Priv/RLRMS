/**
 * 简单的内存 TTL 缓存工具
 * 用于缓存低频变更的数据（如分类、桌位、设置等）
 */

interface CacheEntry<T> {
  data: T
  expireAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

/**
 * 获取缓存数据
 * @param key 缓存键
 * @returns 缓存数据，未命中返回 undefined
 */
export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (entry.expireAt < Date.now()) {
    cache.delete(key)
    return undefined
  }
  return entry.data as T
}

/**
 * 设置缓存数据
 * @param key 缓存键
 * @param data 缓存数据
 * @param ttlMs 存活时间（毫秒），默认 60 秒
 */
export function setCached<T>(key: string, data: T, ttlMs: number = 60000): void {
  cache.set(key, { data, expireAt: Date.now() + ttlMs })
}

/**
 * 失效指定缓存
 * @param key 缓存键
 */
export function invalidateCache(key: string): void {
  cache.delete(key)
}

/**
 * 按前缀批量失效缓存
 * @param prefix 缓存键前缀
 */
export function invalidatePattern(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}

/**
 * 清空所有缓存
 */
export function clearAllCache(): void {
  cache.clear()
}
