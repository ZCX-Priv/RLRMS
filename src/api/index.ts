import type { Dish, Category, Table, Order, AuthResponse, DashboardStats, InventoryItem, AdminUser } from '@/types'

const API_BASE = '/api'

export class ApiError extends Error {
  public status: number
  public data?: unknown
  
  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

interface RequestOptions extends RequestInit {
  timeout?: number
  signal?: AbortSignal
  skip401Handler?: boolean
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeout = 30000, signal, skip401Handler, ...fetchOptions } = options
  
  const url = `${API_BASE}${endpoint}`
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  // Merge external signal and timeout signal
  const combinedSignal = signal 
    ? AbortSignal.any([signal, controller.signal]) 
    : controller.signal
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: combinedSignal,
      credentials: 'include',
    })

    const data = await response.json()

    // Handle 401 Unauthorized - trigger global auth expired event
    if (response.status === 401 && !skip401Handler) {
      const currentPath = window.location.pathname
      window.dispatchEvent(new CustomEvent('auth:expired', {
        detail: {
          redirect: currentPath,
          message: '会话已过期，请重新登录'
        }
      }))
      throw new ApiError('会话已过期，请重新登录', response.status, data)
    }

    if (!response.ok || !data.success) {
      throw new ApiError(data.error || 'Request failed', response.status, data)
    }

    return data
  } finally {
    clearTimeout(timeoutId)
  }
}

// ===== 请求缓存与去重机制 =====

/** 缓存条目结构 */
interface CacheEntry<T> {
  data: T
  expireAt: number
}

/** 进行中的请求映射：key -> Promise，用于请求去重 */
const inflightRequests = new Map<string, Promise<unknown>>()

/** 响应缓存映射：key -> CacheEntry */
const responseCache = new Map<string, CacheEntry<unknown>>()

/** 默认缓存 TTL：5 秒 */
const DEFAULT_CACHE_TTL = 5000

/**
 * 生成缓存/去重键
 * 仅对 GET 请求（无 body）启用缓存，POST/PUT/DELETE 不缓存
 */
function buildCacheKey(endpoint: string, options: RequestOptions): string | null {
  // 仅对无 body 的请求（GET 语义）启用缓存
  const method = (options.method || 'GET').toUpperCase()
  if (method !== 'GET' || options.body) {
    return null
  }
  return `${method}:${endpoint}`
}

/**
 * 带缓存与去重的请求函数
 * - 相同 endpoint 的并发请求会共享同一个 Promise（inflight 去重）
 * - 命中未过期缓存时直接返回缓存数据
 * - TTL 到期后自动失效
 * @param endpoint API 端点
 * @param options 请求选项
 * @param ttl 缓存有效期（毫秒），默认 5000ms
 */
async function cachedRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
  ttl: number = DEFAULT_CACHE_TTL
): Promise<T> {
  const cacheKey = buildCacheKey(endpoint, options)
  
  // 非 GET 请求直接走原始 request
  if (!cacheKey) {
    return request<T>(endpoint, options)
  }
  
  // 1. 检查缓存是否命中
  const cached = responseCache.get(cacheKey) as CacheEntry<T> | undefined
  if (cached && cached.expireAt > Date.now()) {
    return cached.data
  }
  
  // 2. 检查是否有进行中的相同请求（去重）
  const inflight = inflightRequests.get(cacheKey) as Promise<T> | undefined
  if (inflight) {
    return inflight
  }
  
  // 3. 发起新请求并缓存 Promise
  const promise = request<T>(endpoint, options)
    .then((data) => {
      // 请求成功，写入响应缓存
      responseCache.set(cacheKey, {
        data,
        expireAt: Date.now() + ttl,
      })
      return data
    })
    .finally(() => {
      // 无论成功失败，都从 inflight 中移除
      inflightRequests.delete(cacheKey)
    })
  
  inflightRequests.set(cacheKey, promise)
  return promise
}

/**
 * 失效指定端点的缓存（用于数据变更后主动刷新）
 * @param endpoint API 端点
 */
export function invalidateCache(endpoint: string): void {
  const cacheKey = buildCacheKey(endpoint, { method: 'GET' })
  if (cacheKey) {
    responseCache.delete(cacheKey)
  }
}

/** 失效所有缓存 */
export function clearAllCache(): void {
  responseCache.clear()
}

// Export a utility function for creating cancellable requests
export function createCancellableRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): { promise: Promise<T>; cancel: () => void } {
  const controller = new AbortController()
  return {
    promise: request<T>(endpoint, { ...options, signal: controller.signal }),
    cancel: () => controller.abort()
  }
}

export const api = {
  // Home data (combined endpoint for low bandwidth optimization)
  // 使用 30 秒缓存，首页数据相对稳定
  async getHomeData() {
    return cachedRequest<{ success: boolean; data: { categories: Category[]; dishes: Dish[] } }>(
      '/dishes/home-data',
      {},
      30000
    )
  },
  
  // Dishes
  async getDishes(category?: string) {
    const query = category ? `?category=${encodeURIComponent(category)}` : ''
    return request<{ success: boolean; data: Dish[] }>(`/dishes${query}`)
  },
  
  async getDish(id: string) {
    return request<{ success: boolean; data: Dish }>(`/dishes/${id}`)
  },
  
  async searchDishes(query: string) {
    return request<{ success: boolean; data: Dish[] }>(`/dishes/search/query?q=${encodeURIComponent(query)}`)
  },
  
  // 分类数据相对稳定，使用 30 秒缓存
  async getCategories() {
    return cachedRequest<{ success: boolean; data: Category[] }>(
      '/dishes/categories/all',
      {},
      30000
    )
  },
  
  // Tables
  // 桌位列表使用 30 秒缓存
  async getTables() {
    return cachedRequest<{ success: boolean; data: Table[] }>(
      '/tables',
      {},
      30000
    )
  },
  
  // 可用桌位使用 30 秒缓存
  async getAvailableTables() {
    return cachedRequest<{ success: boolean; data: Table[] }>(
      '/tables/available',
      {},
      30000
    )
  },

  async getAvailableTablesFor(diningTime: string) {
    return request<{ success: boolean; data: Table[] }>(`/tables/available-for?dining_time=${encodeURIComponent(diningTime)}`)
  },
  
  // Orders
  async createOrder(data: {
    table_id?: string
    dining_time: string
    contact_name: string
    contact_phone: string
    items: {
      dish_id: string
      dish_name: string
      quantity: number
      unit_price: number
      subtotal: number
      spec?: string
    }[]
  }) {
    return request<{ success: boolean; data: Order }>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  
  async getOrders(phone?: string) {
    const query = phone ? `?phone=${encodeURIComponent(phone)}` : ''
    return request<{ success: boolean; data: Order[] }>(`/orders${query}`)
  },
  
  async getOrder(id: string) {
    return request<{ success: boolean; data: Order }>(`/orders/${id}`)
  },
  
  async cancelOrder(id: string, phone: string) {
    return request<{ success: boolean; message: string }>(`/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ phone }),
    })
  },
  
  // Auth
  async login(username: string, password: string) {
    return request<{ success: boolean; data: AuthResponse }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },
  
  async verifyToken() {
    return request<{ success: boolean; data: { userId: string; username: string; role: 'customer' | 'admin' } }>('/auth/verify')
  },
  
  async logout() {
    return request<{ success: boolean; message: string }>('/auth/logout', {
      method: 'POST',
    })
  },
  
  async changePassword(oldPassword: string, newPassword: string) {
    return request<{ success: boolean; message: string }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword }),
    })
  },
  
  // Client Auth
  async clientLogin(phone: string, password: string) {
    return request<{ success: boolean; data: { user: { id: string; phone: string; role: 'customer' } } }>('/auth/client/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    })
  },
  
  async clientVerifyToken() {
    return request<{ success: boolean; data: { userId: string; phone: string; role: 'customer' } }>('/auth/client/verify', { skip401Handler: true })
  },
  
  async clientLogout() {
    return request<{ success: boolean; message: string }>('/auth/client/logout', {
      method: 'POST',
    })
  },
  
  // Admin
  async getDashboard() {
    return request<{ success: boolean; data: DashboardStats }>('/admin/dashboard')
  },
  
  async getAdminTables() {
    return request<{ success: boolean; data: (Table & { current_order?: string })[] }>('/admin/tables')
  },
  
  async updateTableStatus(id: string, status: string) {
    return request<{ success: boolean; message: string }>(`/admin/tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  },
  
  async updateTable(id: string, data: { table_no?: string; name?: string; capacity?: number }) {
    return request<{ success: boolean; data: Table }>(`/admin/tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  
  async createTable(data: { table_no: string; name: string; capacity?: number }) {
    return request<{ success: boolean; data: Table }>('/admin/tables', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  
  async deleteTable(id: string) {
    return request<{ success: boolean; message: string }>(`/admin/tables/${id}`, {
      method: 'DELETE',
    })
  },
  
  async getAdminDishes() {
    return request<{ success: boolean; data: Dish[] }>('/admin/dishes')
  },
  
  async createDish(data: Partial<Dish>) {
    return request<{ success: boolean; data: Dish }>('/admin/dishes', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  
  async updateDish(id: string, data: Partial<Dish>) {
    return request<{ success: boolean; data: Dish }>(`/admin/dishes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  
  async deleteDish(id: string) {
    return request<{ success: boolean; message: string }>(`/admin/dishes/${id}`, {
      method: 'DELETE',
    })
  },
  
  async reorderDishes(orders: { id: string; sort_order: number }[]) {
    return request<{ success: boolean; message: string }>('/admin/dishes/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orders }),
    })
  },
  
  // 管理端分类数据使用 30 秒缓存
  async getAdminCategories() {
    return cachedRequest<{ success: boolean; data: Category[] }>(
      '/admin/categories',
      {},
      30000
    )
  },
  
  async createCategory(name: string, sortOrder?: number) {
    return request<{ success: boolean; data: Category }>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name, sort_order: sortOrder }),
    })
  },
  
  async deleteCategory(id: string) {
    return request<{ success: boolean; message: string }>(`/admin/categories/${id}`, {
      method: 'DELETE',
    })
  },
  
  async reorderCategories(orders: { id: string; sort_order: number }[]) {
    return request<{ success: boolean; message: string }>('/admin/categories/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orders }),
    })
  },
  
  async getAdminOrders(filters?: { status?: string; date?: string }) {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.date) params.set('date', filters.date)
    const query = params.toString() ? `?${params.toString()}` : ''
    return request<{ success: boolean; data: Order[] }>(`/admin/orders${query}`)
  },
  
  async updateOrderStatus(id: string, status: string) {
    return request<{ success: boolean; message: string }>(`/admin/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  },
  
  async searchAdminOrders(orderNo: string) {
    return request<{ success: boolean; data: Order[] }>(`/admin/orders/search?order_no=${encodeURIComponent(orderNo)}`)
  },
  
  async getInventory() {
    return request<{ success: boolean; data: InventoryItem[] }>('/admin/inventory')
  },
  
  async createInventoryItem(data: { material_name: string; quantity: number; unit: string; warning_threshold?: number }) {
    return request<{ success: boolean; data: InventoryItem }>('/admin/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  
  async updateInventoryItem(id: string, data: { quantity: number; warning_threshold?: number }) {
    return request<{ success: boolean; data: InventoryItem }>(`/admin/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  
  async deleteInventoryItem(id: string) {
    return request<{ success: boolean; message: string }>(`/admin/inventory/${id}`, {
      method: 'DELETE',
    })
  },
  
  async reorderInventory(orders: { id: string; sort_order: number }[]) {
    return request<{ success: boolean; message: string }>('/admin/inventory/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orders }),
    })
  },
  
  // 系统设置数据相对稳定，使用 30 秒缓存
  async getSettings() {
    return cachedRequest<{ success: boolean; data: Record<string, string> }>(
      '/admin/settings',
      {},
      30000
    )
  },
  
  // User Management
  async getUsers() {
    return request<{ success: boolean; data: AdminUser[] }>('/admin/users')
  },
  
  async createUser(data: { username: string; password: string; role: 'admin' | 'customer'; name?: string; phone?: string }) {
    return request<{ success: boolean; data: AdminUser }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  
  async updateUser(id: string, data: { password?: string; role?: 'admin' | 'customer'; name?: string; phone?: string }) {
    return request<{ success: boolean; data: AdminUser }>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  
  async deleteUser(id: string) {
    return request<{ success: boolean; message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    })
  },
  
  async updateSettings(settings: Record<string, string>) {
    return request<{ success: boolean; message: string }>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  },
  
  async resetDatabase() {
    return request<{ success: boolean; message: string }>('/admin/reset-database', {
      method: 'POST',
      body: JSON.stringify({ confirm: 'RESET' }),
    })
  },
  
  async clearAllOrders() {
    return request<{ success: boolean; message: string }>('/admin/clear-orders', {
      method: 'POST',
    })
  },
  
  async uploadImage(file: File) {
    const formData = new FormData()
    formData.append('image', file)
    
    const response = await fetch(`${API_BASE}/admin/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })
    
    const data = await response.json()
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Upload failed')
    }
    
    return data as { success: boolean; data: { url: string } }
  },
  
  async deleteImage(url: string) {
    return request<{ success: boolean; message: string }>('/admin/image', {
      method: 'DELETE',
      body: JSON.stringify({ url }),
    })
  },

  /**
   * 导出系统数据为 ZIP 文件
   * @returns 成功状态
   */
  async exportData() {
    const response = await fetch(`${API_BASE}/admin/export`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: '导出失败' }))
      throw new ApiError(data.error || '导出失败', response.status, data)
    }

    // 从 Content-Disposition 获取文件名
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = 'export.zip'
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '')
        // 处理 UTF-8 编码的文件名
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/)
        if (utf8Match && utf8Match[1]) {
          filename = decodeURIComponent(utf8Match[1])
        }
      }
    }

    // 获取 Blob 数据
    const blob = await response.blob()

    // 创建下载链接并触发下载
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    return { success: true, message: '数据导出成功' }
  },

  /**
   * 导入系统数据
   * @param file - 要导入的 ZIP 文件
   * @returns 导入的数据统计
   */
  async importData(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE}/admin/import`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    const data = await response.json()

    // 处理 401 未授权错误
    if (response.status === 401) {
      const currentPath = window.location.pathname
      window.dispatchEvent(new CustomEvent('auth:expired', {
        detail: {
          redirect: currentPath,
          message: '会话已过期，请重新登录'
        }
      }))
      throw new ApiError('会话已过期，请重新登录', response.status, data)
    }

    if (!response.ok || !data.success) {
      throw new ApiError(data.error || '导入失败', response.status, data)
    }

    return data as {
      success: boolean
      data: {
        dishes: number
        categories: number
        tables: number
        orders: number
        inventory: number
        settings: number
      }
    }
  },
}