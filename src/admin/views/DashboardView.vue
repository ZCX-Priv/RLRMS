<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, defineAsyncComponent, inject, type Ref } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/app'
import type { DashboardStats, Order } from '@/types'
import Skeleton from '@/shared/components/Skeleton.vue'

const Modal = defineAsyncComponent(() => import('@/shared/components/Modal.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/shared/components/ConfirmDialog.vue'))
import { ShoppingBag, DollarSign, Clock, CheckCircle, Eye, XCircle, Trash2, Box, Search, ClipboardList, Bell, BellOff, ChevronDown, ChevronUp } from 'lucide-vue-next'

const appStore = useAppStore()

const autoRefreshEnabled = inject<Ref<boolean>>('autoRefreshEnabled', ref(true))
const toggleAutoRefresh = inject<() => void>('toggleAutoRefresh', () => {})

const stats = ref<DashboardStats | null>(null)
const orders = ref<Order[]>([])
const loading = ref(true)
const ordersLoading = ref(true)
const statsInitialized = ref(false)
const ordersInitialized = ref(false)
const selectedOrder = ref<Order | null>(null)
const showDetailModal = ref(false)

// 修改记录 diff 聚合
const modificationsDiff = computed(() => {
  if (!selectedOrder.value?.modifications?.length) return []
  const map = new Map<string, { key: string; dish_name: string; spec: string | null; quantity: number; unit_price: number; type: 'add' | 'remove' }>()
  for (const m of selectedOrder.value.modifications) {
    const key = `${m.dish_id}-${m.spec || ''}`
    const existing = map.get(key)
    const delta = existing ? existing.quantity + m.quantity_delta : m.quantity_delta
    map.set(key, { key, dish_name: m.dish_name, spec: m.spec, quantity: delta, unit_price: m.unit_price, type: delta >= 0 ? 'add' : 'remove' })
  }
  return [...map.values()].filter(d => d.quantity !== 0)
    .sort((a, b) => (a.type === 'add' ? -1 : 1) - (b.type === 'add' ? -1 : 1))
})

// 菜品增减映射，用于在菜品列表中显示 +/-n 标签
const itemDeltaMap = computed(() => {
  const map = new Map<string, { delta: number; type: 'add' | 'remove' }>()
  for (const m of modificationsDiff.value) {
    map.set(m.key, { delta: Math.abs(m.quantity), type: m.type })
  }
  return map
})
// 修改记录折叠状态
const modificationsExpanded = ref(false)

// 被完全移除的菜品（不在当前 items 中，但在 modificationsDiff 中有 remove 记录）
// 转为 OrderItem 兼容形状，便于与当前菜品列表合并显示
const removedDiffItems = computed(() => {
  if (!selectedOrder.value || !modificationsDiff.value.length) return []
  const currentItemKeys = new Set(
    selectedOrder.value.items.map(i => `${i.dish_id}-${i.spec || ''}`)
  )
  return modificationsDiff.value
    .filter(m => m.type === 'remove' && !currentItemKeys.has(m.key))
    .map(m => ({
      id: `__removed__${m.key}`,
      order_id: selectedOrder.value!.id,
      dish_id: m.key.split('-')[0],
      dish_name: m.dish_name,
      quantity: Math.abs(m.quantity),
      unit_price: m.unit_price,
      subtotal: Math.abs(m.quantity) * m.unit_price,
      spec: m.spec,
    }))
})

// 菜品明细折叠
const ITEMS_COLLAPSE_THRESHOLD = 3
const itemsExpanded = ref(false)
const displayItems = computed(() => {
  if (!selectedOrder.value) return []
  const all = [...selectedOrder.value.items, ...removedDiffItems.value]
  if (itemsExpanded.value || all.length <= ITEMS_COLLAPSE_THRESHOLD) return all
  return all.slice(0, ITEMS_COLLAPSE_THRESHOLD)
})
const hasMoreItems = computed(() => {
  const total = (selectedOrder.value?.items.length ?? 0) + removedDiffItems.value.length
  return total > ITEMS_COLLAPSE_THRESHOLD
})

const showClearConfirm = ref(false)
const showDeleteConfirm = ref(false)
const deletingOrder = ref<Order | null>(null)
const showClearDropdown = ref(false)
const clearScope = ref<'today' | 'yesterday' | 'week' | 'month' | null>(null)
const clearDropdownRef = ref<HTMLElement | null>(null)
const statusFilter = ref('')
const dateFilter = ref('today')

const clearScopeLabels: Record<string, string> = {
  today: '今日',
  yesterday: '昨日',
  week: '本周',
  month: '本月',
}

const clearScopes = [
  { value: 'today' as const, label: '清空今日' },
  { value: 'yesterday' as const, label: '清空昨日' },
  { value: 'week' as const, label: '清空本周' },
  { value: 'month' as const, label: '清空本月' },
]

// 订单查询相关
const showSearchModal = ref(false)
const searchQuery = ref('')
const searchResults = ref<Order[]>([])
const searching = ref(false)
const hasSearched = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (q) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!q.trim()) {
    resetSearch()
    return
  }
  searchTimer = setTimeout(() => {
    handleSearchOrder()
  }, 300)
})

async function handleSearchOrder() {
  const q = searchQuery.value.trim()
  if (!q) return
  try {
    searching.value = true
    hasSearched.value = true
    const res = await api.searchAdminOrders(q)
    searchResults.value = res.data
  } catch (error) {
    console.error('Failed to search orders:', error)
    appStore.showToast('查询订单失败', 'error')
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

function openSearchResult(order: Order) {
  showSearchModal.value = false
  searchQuery.value = ''
  searchResults.value = []
  hasSearched.value = false
  selectedOrder.value = order
  showDetailModal.value = true
}

function resetSearch() {
  searchQuery.value = ''
  searchResults.value = []
  hasSearched.value = false
}

const dateOptions = [
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'all', label: '全部' },
]

const statusOptions: { value: Order['status'] | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'confirmed', label: '已确认' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
]

const statusText: Record<string, string> = {
  pending: '待处理',
  confirmed: '已确认',
  completed: '已完成',
  cancelled: '已取消',
}

const statusColor: Record<string, string> = {
  pending: 'var(--color-warning)',
  confirmed: 'var(--color-info)',
  completed: 'var(--color-success)',
  cancelled: 'var(--color-error)',
}

function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateParam(): { startDate: string; endDate: string } | undefined {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (dateFilter.value === 'today') {
    const s = getLocalDateString(today)
    return { startDate: s, endDate: s }
  } else if (dateFilter.value === 'yesterday') {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const s = getLocalDateString(yesterday)
    return { startDate: s, endDate: s }
  } else if (dateFilter.value === 'week') {
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return { startDate: getLocalDateString(weekAgo), endDate: getLocalDateString(today) }
  } else if (dateFilter.value === 'month') {
    const monthAgo = new Date(today)
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    return { startDate: getLocalDateString(monthAgo), endDate: getLocalDateString(today) }
  }
  return undefined
}

function getScopeDateRange(scope: 'today' | 'yesterday' | 'week' | 'month'): { startDate: string; endDate: string } | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (scope === 'today') {
    const s = getLocalDateString(today)
    return { startDate: s, endDate: s }
  } else if (scope === 'yesterday') {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const s = getLocalDateString(yesterday)
    return { startDate: s, endDate: s }
  } else if (scope === 'week') {
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return { startDate: getLocalDateString(weekAgo), endDate: getLocalDateString(today) }
  } else if (scope === 'month') {
    const monthAgo = new Date(today)
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    return { startDate: getLocalDateString(monthAgo), endDate: getLocalDateString(today) }
  }
  return null
}

async function fetchDashboard(showLoading = true) {
  try {
    if (showLoading && !statsInitialized.value) {
      loading.value = true
    }
    const res = await api.getDashboard()
    stats.value = res.data
    statsInitialized.value = true
  } catch (error) {
    console.error('Failed to fetch dashboard:', error)
    if (showLoading) {
      appStore.showToast('获取数据失败', 'error')
    }
  } finally {
    loading.value = false
  }
}

async function fetchOrders(isPollingRefresh = false) {
  try {
    if (!isPollingRefresh && !ordersInitialized.value) {
      ordersLoading.value = true
    }
    const dateRange = getDateParam()
    const res = await api.getAdminOrders({
      status: statusFilter.value || undefined,
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
    })
    orders.value = res.data
    ordersInitialized.value = true
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    if (!isPollingRefresh && !ordersInitialized.value) {
      appStore.showToast('获取订单失败', 'error')
    }
  } finally {
    ordersLoading.value = false
  }
}

function handleClearAllOrders(scope: 'today' | 'yesterday' | 'week' | 'month' | null) {
  clearScope.value = scope
  showClearDropdown.value = false
  showClearConfirm.value = true
}

async function confirmClearAllOrders() {
  const previousOrders = [...orders.value]
  const previousStats = stats.value ? { ...stats.value } : null
  const scope = clearScope.value
  
  // 仅移除目标范围内已完成和已取消的订单，保留其他状态及非目标范围的订单
  const scopeRange = scope ? getScopeDateRange(scope) : null
  if (scopeRange) {
    orders.value = orders.value.filter(o => {
      if (o.status !== 'completed' && o.status !== 'cancelled') return true
      const orderDate = o.created_at.slice(0, 10)
      return !(orderDate >= scopeRange.startDate && orderDate <= scopeRange.endDate)
    })
  } else {
    orders.value = orders.value.filter(o => o.status !== 'completed' && o.status !== 'cancelled')
  }
  
  try {
    await api.clearAllOrders(scope ?? undefined)
    const scopeText = scope ? clearScopeLabels[scope] : ''
    appStore.showToast(`已清空${scopeText}所有订单`, 'success')
    fetchDashboard(false)
  } catch (error) {
    console.error('Failed to clear orders:', error)
    orders.value = previousOrders
    stats.value = previousStats
    appStore.showToast('清空失败', 'error')
  } finally {
    showClearConfirm.value = false
    clearScope.value = null
  }
}

function viewOrder(order: Order) {
  selectedOrder.value = order
  showDetailModal.value = true
}

async function updateOrderStatus(order: Order, status: Order['status']) {
  const index = orders.value.findIndex(o => o.id === order.id)
  const previousStatus = order.status
  
  if (index !== -1) {
    orders.value[index] = { ...orders.value[index]!, status }
  }
  
  if (selectedOrder.value?.id === order.id) {
    selectedOrder.value = { ...selectedOrder.value, status }
  }
  
  try {
    await api.updateOrderStatus(order.id, status)
    appStore.showToast('订单状态已更新', 'success')
    fetchDashboard(false)
  } catch (error) {
    console.error('Failed to update status:', error)
    if (index !== -1) {
      orders.value[index] = { ...orders.value[index]!, status: previousStatus }
    }
    if (selectedOrder.value?.id === order.id) {
      selectedOrder.value = { ...selectedOrder.value, status: previousStatus }
    }
    appStore.showToast('更新失败', 'error')
  }
}

function deleteOrder(order: Order) {
  deletingOrder.value = order
  showDeleteConfirm.value = true
}

async function confirmDeleteOrder() {
  const order = deletingOrder.value
  if (!order) return

  const index = orders.value.findIndex(o => o.id === order.id)
  const previousOrders = [...orders.value]
  const previousStats = stats.value ? { ...stats.value } : null

  // 乐观更新：立即从列表中移除
  if (index !== -1) {
    orders.value = orders.value.filter(o => o.id !== order.id)
  }

  try {
    await api.deleteOrder(order.id)
    appStore.showToast(`订单 ${order.order_no} 已删除`, 'success')
    fetchDashboard(false)
  } catch (error) {
    console.error('Failed to delete order:', error)
    orders.value = previousOrders
    stats.value = previousStats
    appStore.showToast('删除订单失败', 'error')
  } finally {
    showDeleteConfirm.value = false
    deletingOrder.value = null
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}/${month}/${day} ${hour}:${minute}`
}

// ===== SSE 事件监听 =====

function handleSSENewOrder(e: Event) {
  const newOrder = (e as CustomEvent<Order>).detail
  const dateRange = getDateParam()
  const orderDate = newOrder.created_at?.slice(0, 10)
  const matchesDate = !dateRange || (orderDate >= dateRange.startDate && orderDate <= dateRange.endDate)
  const matchesStatus = !statusFilter.value || newOrder.status === statusFilter.value

  if (matchesDate && matchesStatus) {
    orders.value.unshift(newOrder)
  } else {
    fetchOrders(true)
  }
  fetchDashboard(false)
}

function handleSSEOrderUpdated(e: Event) {
  const { id, status, type } = (e as CustomEvent<{ id: string; status: Order['status']; type?: string }>).detail
  const idx = orders.value.findIndex(o => o.id === id)
  if (idx !== -1) {
    orders.value[idx] = { ...orders.value[idx]!, status }
  }
  if (selectedOrder.value?.id === id) {
    selectedOrder.value = { ...selectedOrder.value, status }
  }
  if (type === 'add_items') {
    fetchOrders(false)
  }
  fetchDashboard(false)
}

function handleSSEPollingOrders(e: Event) {
  const allOrders = (e as CustomEvent<Order[]>).detail
  const dateRange = getDateParam()
  let filtered = allOrders
  if (dateRange) {
    filtered = filtered.filter(o => {
      const orderDate = o.created_at.slice(0, 10)
      return orderDate >= dateRange.startDate && orderDate <= dateRange.endDate
    })
  }
  if (statusFilter.value) {
    filtered = filtered.filter(o => o.status === statusFilter.value)
  }
  orders.value = filtered
  fetchDashboard(false)
}

function handleSSEOrderDeleted(e: Event) {
  const { id } = (e as CustomEvent<{ id: string }>).detail
  orders.value = orders.value.filter(o => o.id !== id)
  fetchDashboard(false)
}

onMounted(() => {
  fetchDashboard()
  fetchOrders()
  window.addEventListener('sse:new_order', handleSSENewOrder)
  window.addEventListener('sse:order_updated', handleSSEOrderUpdated)
  window.addEventListener('sse:polling_orders', handleSSEPollingOrders)
  window.addEventListener('sse:order_deleted', handleSSEOrderDeleted)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('sse:new_order', handleSSENewOrder)
  window.removeEventListener('sse:order_updated', handleSSEOrderUpdated)
  window.removeEventListener('sse:polling_orders', handleSSEPollingOrders)
  window.removeEventListener('sse:order_deleted', handleSSEOrderDeleted)
  document.removeEventListener('click', handleClickOutside)
})

function handleClickOutside(e: MouseEvent) {
  if (showClearDropdown.value && clearDropdownRef.value && !clearDropdownRef.value.contains(e.target as Node)) {
    showClearDropdown.value = false
  }
}
</script>

<template>
  <div class="dashboard-page">
    <div class="page-header">
      <h1 class="page-title">概览</h1>
      <button
        class="auto-refresh-btn"
        :class="{ 'auto-refresh-active': autoRefreshEnabled }"
        @click="toggleAutoRefresh"
        :title="autoRefreshEnabled ? '点击关闭订单接收' : '点击开启订单接收'"
      >
        <Bell v-if="autoRefreshEnabled" :size="16" />
        <BellOff v-else :size="16" />
        <span>{{ autoRefreshEnabled ? '订单接受中' : '已暂停接收' }}</span>
      </button>
    </div>

    <!-- 统计卡片骨架屏 -->
    <div v-if="loading && !statsInitialized" class="stats-grid">
      <div v-for="i in 4" :key="i" class="stat-card stat-card-skeleton">
        <Skeleton variant="circle" width="48px" height="48px" radius="12px" />
        <div class="stat-info-skeleton">
          <Skeleton variant="text" width="60px" height="28px" />
          <Skeleton variant="text" width="80px" height="14px" />
        </div>
      </div>
    </div>

    <template v-else-if="statsInitialized && stats">
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon stat-icon-primary">
            <ShoppingBag :size="24" />
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.todayOrders }}</span>
            <span class="stat-label">今日订单</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon-success">
            <DollarSign :size="24" />
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.todayRevenue.toFixed(2) }}</span>
            <span class="stat-label">今日收入(元)</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon-warning">
            <Clock :size="24" />
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.pendingOrders }}</span>
            <span class="stat-label">待处理订单</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon-info">
            <CheckCircle :size="24" />
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.availableTables }}</span>
            <span class="stat-label">可用桌位</span>
          </div>
        </div>
      </div>

      <!-- Order Management -->
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">订单列表</h2>
          <div class="filter-group">
            <button class="btn btn-secondary btn-sm" @click="showSearchModal = true">
              <Search :size="14" />
              订单查询
            </button>
            <select v-model="dateFilter" class="filter-select" @change="() => fetchOrders()">
              <option v-for="opt in dateOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <select v-model="statusFilter" class="filter-select" @change="() => fetchOrders()">
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <div ref="clearDropdownRef" class="clear-dropdown-wrapper">
              <button class="btn btn-danger clear-main-btn" @click="handleClearAllOrders(null)">
                <Trash2 :size="16" />
                清空订单
              </button>
              <span class="clear-divider"></span>
              <button class="btn btn-danger clear-toggle-btn" @click="showClearDropdown = !showClearDropdown">
                <ChevronDown :size="14" />
              </button>
              <div v-if="showClearDropdown" class="clear-dropdown-menu">
                <button
                  v-for="item in clearScopes"
                  :key="item.value"
                  class="clear-dropdown-item"
                  @click="handleClearAllOrders(item.value)"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="ordersLoading && !ordersInitialized" class="orders-list">
          <!-- 订单列表骨架屏 -->
          <div v-for="i in 3" :key="i" class="order-item order-item-skeleton">
            <div class="order-header">
              <div class="order-info">
                <Skeleton variant="text" width="120px" height="16px" />
                <Skeleton variant="rect" width="50px" height="18px" radius="999px" />
              </div>
              <Skeleton variant="text" width="100px" height="12px" />
            </div>
            <div class="order-body">
              <div class="order-meta">
                <Skeleton variant="text" width="100px" height="14px" />
                <Skeleton variant="text" width="120px" height="14px" />
              </div>
              <Skeleton variant="text" width="150px" height="14px" style="margin-bottom: 8px;" />
              <div class="order-items">
                <Skeleton variant="rect" width="80px" height="22px" radius="4px" />
                <Skeleton variant="rect" width="80px" height="22px" radius="4px" />
                <Skeleton variant="rect" width="80px" height="22px" radius="4px" />
              </div>
            </div>
            <div class="order-footer">
              <Skeleton variant="text" width="80px" height="20px" />
              <div class="order-actions">
                <Skeleton variant="rect" width="60px" height="32px" radius="6px" />
                <Skeleton variant="rect" width="60px" height="32px" radius="6px" />
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="ordersInitialized && orders.length === 0" class="empty-state">
          <div class="empty-icon">
            <ClipboardList :size="48" />
          </div>
          <h3 class="empty-title">暂无订单</h3>
          <p class="empty-description">当前筛选条件下没有订单记录</p>
        </div>

        <div v-else class="orders-list">
          <div
            v-for="order in orders"
            :key="order.id"
            class="order-item"
          >
            <div class="order-header">
              <div class="order-info">
                <span class="order-no">{{ order.order_no }}</span>
                <span
                  class="order-status"
                  :style="{ backgroundColor: statusColor[order.status] }"
                >
                  {{ statusText[order.status] }}
                </span>
              </div>
              <span class="order-time">{{ formatDate(order.created_at) }}</span>
            </div>

            <div class="order-body">
              <div class="order-meta">
                <span class="meta-item">
                  <strong>桌位：</strong>{{ order.table_name || '未指定' }}
                </span>
                <span class="meta-item">
                  <strong>就餐时间：</strong>{{ order.dining_time }}
                </span>
              </div>
              <div class="order-contact">
                <span>{{ order.contact_name }} / {{ order.contact_phone }}</span>
              </div>
              <div class="order-items">
                <span v-for="item in order.items.slice(0, 3)" :key="item.id" class="item-tag">
                  {{ item.dish_name }} x{{ item.quantity }}
                </span>
                <span v-if="order.items.length > 3" class="item-more">
                  +{{ order.items.length - 3 }}项
                </span>
              </div>
            </div>

            <div class="order-footer">
              <span class="order-amount">{{ order.total_amount.toFixed(2) }}元</span>
              <div class="order-actions">
                <button class="btn btn-sm btn-secondary" @click="viewOrder(order)">
                  <Eye :size="14" />
                  详情
                </button>
                <button
                  v-if="order.status === 'pending'"
                  class="btn btn-sm btn-primary"
                  @click="updateOrderStatus(order, 'confirmed')"
                >
                  <CheckCircle :size="14" />
                  确认
                </button>
                <button
                  v-if="order.status === 'confirmed'"
                  class="btn btn-sm btn-success"
                  @click="updateOrderStatus(order, 'completed')"
                >
                  <CheckCircle :size="14" />
                  完成
                </button>
                <button
                  v-if="order.status === 'pending'"
                  class="btn btn-sm btn-ghost"
                  @click="updateOrderStatus(order, 'cancelled')"
                >
                  <XCircle :size="14" />
                  取消
                </button>
                <button
                  class="btn btn-sm btn-ghost btn-delete"
                  @click="deleteOrder(order)"
                  title="删除订单"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Detail Modal -->
    <Modal
      v-if="selectedOrder"
      :show="showDetailModal"
      title="订单详情"
      size="md"
      @close="showDetailModal = false"
    >
      <div class="order-detail">
        <div class="detail-section">
          <h4>基本信息</h4>
          <div class="detail-row">
            <span>订单号</span>
            <span>{{ selectedOrder.order_no }}</span>
          </div>
          <div class="detail-row">
            <span>桌位</span>
            <span>{{ selectedOrder.table_name || '未指定' }}</span>
          </div>
          <div class="detail-row">
            <span>就餐时间</span>
            <span>{{ selectedOrder.dining_time }}</span>
          </div>
          <div class="detail-row">
            <span>联系人</span>
            <span>{{ selectedOrder.contact_name }}</span>
          </div>
          <div class="detail-row">
            <span>电话</span>
            <span>{{ selectedOrder.contact_phone }}</span>
          </div>
        </div>

        <div class="detail-section">
          <h4>更新状态</h4>
          <div class="status-buttons">
            <button
              v-for="opt in statusOptions.filter(o => o.value)"
              :key="opt.value"
              class="status-btn"
              :class="{ 'status-btn-active': selectedOrder.status === opt.value }"
              @click="updateOrderStatus(selectedOrder, opt.value as Order['status'])"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-header">
            <h4>菜品明细</h4>
            <button v-if="modificationsDiff.length > 0" class="mod-toggle-btn" @click="modificationsExpanded = !modificationsExpanded">
              <span>修改记录</span>
              <component :is="modificationsExpanded ? ChevronUp : ChevronDown" :size="14" />
            </button>
          </div>
          <!-- 修改记录 diff（折叠） -->
          <div v-if="modificationsExpanded && modificationsDiff.length > 0" class="diff-list">
            <div v-for="m in modificationsDiff" :key="m.key" class="diff-row" :class="m.type">
              <span class="diff-sign">{{ m.type === 'add' ? '+' : '-' }}</span>
              <span>{{ m.dish_name }}</span>
              <span v-if="m.spec">({{ m.spec }})</span>
              <span class="diff-qty">x{{ Math.abs(m.quantity) }}</span>
              <span class="diff-price">{{ (Math.abs(m.quantity) * m.unit_price).toFixed(2) }}元</span>
            </div>
          </div>
          <div
            v-for="item in displayItems"
            :key="item.id"
            class="item-row"
            :class="{ 'item-removed': item.id.startsWith('__removed__') }"
          >
            <span>{{ item.dish_name }}</span>
            <span v-if="item.spec">({{ item.spec }})</span>
            <span
              v-if="!item.id.startsWith('__removed__') && itemDeltaMap.get(`${item.dish_id}-${item.spec || ''}`)"
              class="item-delta-badge"
              :class="itemDeltaMap.get(`${item.dish_id}-${item.spec || ''}`)!.type"
            >{{ itemDeltaMap.get(`${item.dish_id}-${item.spec || ''}`)!.type === 'add' ? '+' : '-' }}{{ itemDeltaMap.get(`${item.dish_id}-${item.spec || ''}`)!.delta }}</span>
            <span v-else-if="item.id.startsWith('__removed__')" class="item-delta-badge remove">-{{ item.quantity }}</span>
            <span>x{{ item.quantity }}</span>
            <span>{{ item.subtotal }}元</span>
          </div>
          <button v-if="hasMoreItems" class="items-toggle" @click="itemsExpanded = !itemsExpanded">
            <component :is="itemsExpanded ? ChevronUp : ChevronDown" :size="14" />
            {{ itemsExpanded ? '收起' : `展开全部 (${(selectedOrder?.items.length ?? 0) + removedDiffItems.length}项)` }}
          </button>
          <div class="total-row">
            <span>总计</span>
            <span>{{ selectedOrder.total_amount.toFixed(2) }}元</span>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Delete Order Confirm Dialog -->
    <ConfirmDialog
      :show="showDeleteConfirm"
      title="删除订单"
      :message="`确定要删除订单 ${deletingOrder?.order_no ?? ''} 吗？此操作不可恢复！`"
      confirm-text="确定删除"
      cancel-text="取消"
      @confirm="confirmDeleteOrder"
      @cancel="showDeleteConfirm = false; deletingOrder = null"
    />

    <!-- Clear Orders Confirm Dialog -->
    <ConfirmDialog
      :show="showClearConfirm"
      title="清空订单"
      :message="`确定要清空${clearScope ? clearScopeLabels[clearScope] : ''}所有订单吗？此操作不可恢复！`"
      confirm-text="确定"
      cancel-text="取消"
      @confirm="confirmClearAllOrders"
      @cancel="showClearConfirm = false"
    />

    <!-- Order Search Modal -->
    <Modal
      :show="showSearchModal"
      title="订单查询"
      size="md"
      @close="showSearchModal = false; resetSearch()"
    >
      <div class="search-content">
        <div class="search-input-wrapper">
          <Search :size="16" class="search-input-icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="输入订单号（支持模糊搜索）"
            @keyup.enter="handleSearchOrder"
            autofocus
          />
        </div>

        <div v-if="searching" class="search-loading">
          <div class="loading-spinner"></div>
          <span>正在查询订单...</span>
        </div>

        <div v-else-if="hasSearched && searchResults.length === 0" class="search-empty">
          <Box :size="32" />
          <p>未找到匹配的订单</p>
        </div>

        <div v-else-if="searchResults.length > 0" class="search-results">
          <p class="search-results-count">找到 {{ searchResults.length }} 条结果</p>
          <div
            v-for="order in searchResults"
            :key="order.id"
            class="search-result-item"
            @click="openSearchResult(order)"
          >
            <div class="result-item-header">
              <span class="result-order-no">{{ order.order_no }}</span>
              <span
                class="result-status"
                :style="{ backgroundColor: statusColor[order.status] }"
              >
                {{ statusText[order.status] }}
              </span>
            </div>
            <div class="result-item-info">
              <span>{{ order.table_name || '未指定桌位' }}</span>
              <span>{{ order.contact_name }}</span>
              <span class="result-amount">{{ order.total_amount.toFixed(2) }}元</span>
            </div>
            <div class="result-item-time">{{ formatDate(order.created_at) }}</div>
          </div>
        </div>

        <div v-else class="search-hint">
          <p>请输入订单号进行查询，例如：RL20260616001</p>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.dashboard-page {
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 64px);
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
}

/* 统计卡片骨架屏样式 */
.stat-card-skeleton {
  align-items: center;
}

.stat-info-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

/* 订单骨架屏样式 */
.order-item-skeleton {
  pointer-events: none;
}

.order-item-skeleton .order-info {
  gap: var(--spacing-sm);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

@media (min-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.stat-card {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
}

.stat-icon-primary {
  background-color: rgba(220, 38, 38, 0.1);
  color: var(--color-primary);
}

.stat-icon-success {
  background-color: rgba(22, 163, 74, 0.1);
  color: var(--color-success);
}

.stat-icon-warning {
  background-color: rgba(202, 138, 4, 0.1);
  color: var(--color-warning);
}

.stat-icon-info {
  background-color: rgba(37, 99, 235, 0.1);
  color: var(--color-info);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.section-card {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  flex: 1;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
}

.filter-select {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-primary);
  font-size: 0.875rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.empty-icon {
  width: 100px;
  height: 100px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-xl);
  color: var(--color-primary);
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.empty-description {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  max-width: 280px;
}

.orders-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.order-item {
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
}

.order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.order-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.order-no {
  font-weight: 500;
}

.order-status {
  padding: 2px var(--spacing-sm);
  font-size: 0.625rem;
  border-radius: var(--radius-full);
  color: white;
}

.order-time {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.order-body {
  margin-bottom: var(--spacing-sm);
}

.order-meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: 0.875rem;
  margin-bottom: var(--spacing-xs);
}

.meta-item {
  color: var(--color-text-secondary);
}

.order-contact {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs);
}

.order-items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.item-tag {
  padding: 2px var(--spacing-sm);
  font-size: 0.75rem;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
}

.item-more {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.order-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-light);
}

.order-amount {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-primary);
}

.order-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.btn-delete {
  color: var(--color-error);
}

.btn-delete:hover {
  background-color: rgba(220, 38, 38, 0.08);
  color: var(--color-error);
}

.order-detail {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.detail-section h4 {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-secondary);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-xs) 0;
  font-size: 0.875rem;
}

.detail-row span:first-child {
  color: var(--color-text-muted);
}

/* 修改记录 diff */
.detail-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-section-header h4 {
  margin: 0;
}

.mod-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  background-color: var(--color-bg-tertiary);
  transition: all var(--transition-fast);
}

.mod-toggle-btn:hover {
  color: var(--color-primary);
  background-color: var(--color-border-light);
}

.diff-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px dashed var(--color-border-light);
}

.diff-row {
  display: flex;
  gap: var(--spacing-sm);
  padding: 2px var(--spacing-xs);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-family: monospace;
}

.diff-row.add {
  color: var(--color-success);
  background-color: rgba(46, 160, 67, 0.08);
}

.diff-row.remove {
  color: var(--color-error);
  background-color: rgba(248, 81, 73, 0.08);
}

.diff-sign {
  font-weight: 700;
  width: 14px;
}

.diff-qty {
  margin-left: var(--spacing-sm);
}

.diff-price {
  margin-left: auto;
  flex-shrink: 0;
}

.item-row {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  font-size: 0.875rem;
}

.item-row span:last-child {
  margin-left: auto;
  color: var(--color-primary);
}

.item-removed {
  opacity: 0.6;
}

.item-removed span:first-child {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.item-delta-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: var(--radius-full);
  line-height: 1.4;
}

.item-delta-badge.add {
  background-color: rgba(46, 160, 67, 0.12);
  color: var(--color-success);
}

.item-delta-badge.remove {
  background-color: rgba(248, 81, 73, 0.12);
  color: var(--color-error);
}

.items-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  width: 100%;
  padding: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  font-size: 0.875rem;
  color: var(--color-text-primary);
  transition: opacity var(--transition-fast);
}

.items-toggle:hover {
  opacity: 0.7;
}

.total-row {
  display: flex;
  justify-content: space-between;
  padding-top: var(--spacing-md);
  margin-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
  font-size: 1.125rem;
  font-weight: 700;
}

.total-row span:last-child {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-primary);
}

.status-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.status-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
}

.status-btn:hover {
  border-color: var(--color-primary);
}

.status-btn-active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

/* Staggered slide-in animation for orders */
.stagger-slide-in-enter-active {
  animation: slideInRight var(--duration-normal) var(--ease-out);
  animation-delay: var(--stagger-delay, 0ms);
}

.stagger-slide-in-leave-active {
  animation: fadeOut var(--duration-fast) var(--ease-out);
}

.stagger-slide-in-move {
  transition: transform var(--duration-normal) var(--ease-out);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
}

.auto-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-light);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.auto-refresh-btn:hover {
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.auto-refresh-btn.auto-refresh-active {
  color: white;
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.auto-refresh-btn.auto-refresh-active:hover {
  opacity: 0.9;
}

@media (max-width: 480px) {
  .auto-refresh-btn span {
    display: none;
  }

  .auto-refresh-btn {
    padding: var(--spacing-sm);
  }
}



/* 订单查询样式 */
.search-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
}

.search-input-wrapper:focus-within {
  border-color: var(--color-primary);
}

.search-input-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.9rem;
  color: var(--color-text-primary);
  outline: none;
  font-family: var(--font-body);
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.search-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl);
  color: var(--color-text-muted);
}

.search-loading .loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.search-results-count {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  padding: 0 var(--spacing-xs);
}

.search-result-item {
  padding: var(--spacing-md);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.search-result-item:hover {
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  margin: -1px;
}

.result-item-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.result-order-no {
  font-weight: 600;
  font-size: 0.9rem;
}

.result-status {
  padding: 2px var(--spacing-sm);
  font-size: 0.625rem;
  border-radius: var(--radius-full);
  color: white;
}

.result-item-info {
  display: flex;
  gap: var(--spacing-md);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.result-amount {
  color: var(--color-primary);
  font-weight: 500;
}

.result-item-time {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: var(--spacing-xs);
}

.search-hint {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

/* 清空订单下拉菜单 */
.clear-dropdown-wrapper {
  position: relative;
  display: inline-flex;
  align-items: stretch;
}

.clear-dropdown-wrapper .btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.clear-main-btn {
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.clear-toggle-btn {
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
  padding-left: var(--spacing-sm) !important;
  padding-right: var(--spacing-sm) !important;
  min-width: 36px;
}

.clear-divider {
  width: 1px;
  align-self: stretch;
  background-color: rgba(255, 255, 255, 0.3);
}

.clear-dropdown-menu {
  position: absolute;
  top: calc(100% + var(--spacing-xs));
  right: 0;
  min-width: 120px;
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 100;
  padding: var(--spacing-xs);
  display: flex;
  flex-direction: column;
}

.clear-dropdown-item {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: 0.875rem;
  color: var(--color-error);
  border-radius: var(--radius-sm);
  text-align: left;
  white-space: nowrap;
  transition: background-color var(--transition-fast);
  cursor: pointer;
}

.clear-dropdown-item:hover {
  background-color: rgba(220, 38, 38, 0.08);
}
</style>
