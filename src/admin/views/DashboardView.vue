<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/app'
import { useOrderPolling } from '@/shared/composables/useOrderPolling'
import type { DashboardStats, Order } from '@/types'
import Skeleton from '@/shared/components/Skeleton.vue'

const Modal = defineAsyncComponent(() => import('@/shared/components/Modal.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/shared/components/ConfirmDialog.vue'))
import { ShoppingBag, DollarSign, Clock, CheckCircle, Eye, XCircle, Trash2, Box, Bell, BellOff, Search } from 'lucide-vue-next'

const appStore = useAppStore()

const stats = ref<DashboardStats | null>(null)
const orders = ref<Order[]>([])
const loading = ref(true)
const ordersLoading = ref(true)
const statsInitialized = ref(false)
const ordersInitialized = ref(false)
const selectedOrder = ref<Order | null>(null)
const showDetailModal = ref(false)
const showClearConfirm = ref(false)
const statusFilter = ref('')
const dateFilter = ref('today')
const autoRefreshEnabled = ref(true)
const newOrderCount = ref(0)
const showNewOrderNotification = ref(false)

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

function getDateParam(): string | undefined {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  if (dateFilter.value === 'today') {
    return getLocalDateString(today)
  } else if (dateFilter.value === 'yesterday') {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    return getLocalDateString(yesterday)
  } else if (dateFilter.value === 'week') {
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return getLocalDateString(weekAgo)
  } else if (dateFilter.value === 'month') {
    const monthAgo = new Date(today)
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    return getLocalDateString(monthAgo)
  }
  return undefined
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
    const dateParam = getDateParam()
    const res = await api.getAdminOrders({ 
      status: statusFilter.value || undefined,
      date: dateParam
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

function handleClearAllOrders() {
  showClearConfirm.value = true
}

async function confirmClearAllOrders() {
  const previousOrders = [...orders.value]
  const previousStats = stats.value ? { ...stats.value } : null
  
  // 仅移除已完成和已取消的订单，保留其他状态订单
  orders.value = orders.value.filter(o => o.status !== 'completed' && o.status !== 'cancelled')
  
  try {
    await api.clearAllOrders()
    appStore.showToast('已完成和已取消的订单已清空', 'success')
    fetchDashboard(false)
  } catch (error) {
    console.error('Failed to clear orders:', error)
    orders.value = previousOrders
    stats.value = previousStats
    appStore.showToast('清空失败', 'error')
  } finally {
    showClearConfirm.value = false
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
    appStore.showToast('状态已更新', 'success')
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

function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    gainNode.gain.value = 0.3
    
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.15)
    
    setTimeout(() => {
      const osc2 = audioContext.createOscillator()
      const gain2 = audioContext.createGain()
      osc2.connect(gain2)
      gain2.connect(audioContext.destination)
      osc2.frequency.value = 1000
      osc2.type = 'sine'
      gain2.gain.value = 0.3
      osc2.start()
      osc2.stop(audioContext.currentTime + 0.15)
    }, 200)
  } catch (e) {
    console.log('Audio notification not supported')
  }
}

function handleNewOrder(count: number) {
  newOrderCount.value += count
  showNewOrderNotification.value = true
  playNotificationSound()
  
  setTimeout(() => {
    showNewOrderNotification.value = false
  }, 5000)
}

function dismissNotification() {
  showNewOrderNotification.value = false
  newOrderCount.value = 0
}

// ===== SSE 实时推送 =====
let eventSource: EventSource | null = null
let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null
const sseConnected = ref(false)
const SSE_RECONNECT_DELAY = 3000

function connectSSE() {
  // 清理旧的连接
  disconnectSSE()
  
  const es = new EventSource('/api/admin/events', { withCredentials: true })
  eventSource = es
  
  es.addEventListener('connected', () => {
    sseConnected.value = true
    // SSE 连接成功后停止轮询（如果正在轮询）
    if (isPolling.value) {
      stopPolling()
    }
  })
  
  // 新订单事件：增量更新
  es.addEventListener('new_order', (e: MessageEvent) => {
    try {
      const newOrder: Order = JSON.parse(e.data)
      // 如果当前没有筛选条件，直接插入到列表头部
      if (!statusFilter.value && dateFilter.value === 'today') {
        orders.value.unshift(newOrder)
        handleNewOrder(1)
        fetchDashboard(false)
      } else {
        // 有筛选条件时全量刷新
        fetchOrders(true)
        fetchDashboard(false)
      }
    } catch (err) {
      console.error('SSE new_order parse error:', err)
    }
  })
  
  // 订单状态更新事件：增量更新
  es.addEventListener('order_updated', (e: MessageEvent) => {
    try {
      const { id, status, type } = JSON.parse(e.data) as {
        id: string; status: Order['status']; type?: string
      }
      const idx = orders.value.findIndex(o => o.id === id)
      if (idx !== -1) {
        orders.value[idx] = { ...orders.value[idx]!, status }
      }
      // 同步更新选中订单的状态
      if (selectedOrder.value?.id === id) {
        selectedOrder.value = { ...selectedOrder.value, status }
      }
      // 加菜事件：弹 toast 并刷新订单列表以获取新菜品
      if (type === 'add_items') {
        appStore.showToast('收到加菜请求，请确认', 'info')
        fetchOrders(false)
      } else {
        fetchDashboard(false)
      }
    } catch (err) {
      console.error('SSE order_updated parse error:', err)
    }
  })
  
  es.onerror = () => {
    sseConnected.value = true
    es.close()
    eventSource = null
    // SSE 断开后启用轮询作为降级方案
    if (autoRefreshEnabled.value && !isPolling.value) {
      startPolling()
    }
    // 定时重连 SSE
    if (!sseReconnectTimer) {
      sseReconnectTimer = setTimeout(() => {
        sseReconnectTimer = null
        connectSSE()
      }, SSE_RECONNECT_DELAY)
    }
  }
}

function disconnectSSE() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  sseConnected.value = false
  if (sseReconnectTimer) {
    clearTimeout(sseReconnectTimer)
    sseReconnectTimer = null
  }
}

async function fetchOrdersWithCheck() {
  const previousCount = orders.value.length
  await fetchOrders(true)
  if (autoRefreshEnabled.value && orders.value.length > previousCount) {
    handleNewOrder(orders.value.length - previousCount)
    fetchDashboard()
  }
}

const { isPolling, startPolling, stopPolling } = useOrderPolling(
  fetchOrdersWithCheck,
  { interval: 5000, shouldPoll: () => !sseConnected.value }
)

function toggleAutoRefresh() {
  autoRefreshEnabled.value = !autoRefreshEnabled.value
  if (autoRefreshEnabled.value) {
    // SSE 未连接时才启动轮询
    if (!sseConnected.value) {
      startPolling()
    }
    appStore.showToast('已开启自动刷新', 'success')
  } else {
    stopPolling()
    disconnectSSE()
    appStore.showToast('已关闭自动刷新', 'info')
  }
}

watch(autoRefreshEnabled, (enabled) => {
  if (enabled) {
    if (!sseConnected.value && !isPolling.value) {
      startPolling()
    }
    // 尝试重新连接 SSE
    if (!eventSource) {
      connectSSE()
    }
  } else if (!enabled && isPolling.value) {
    stopPolling()
  }
})

onMounted(() => {
  fetchDashboard()
  fetchOrders()
  connectSSE()
})

onUnmounted(() => {
  disconnectSSE()
})
</script>

<template>
  <div class="dashboard-page">
    <div class="page-header">
      <h1 class="page-title">概览</h1>
      <button 
        class="auto-refresh-btn"
        :class="{ 'active': autoRefreshEnabled }"
        @click="toggleAutoRefresh"
        :title="autoRefreshEnabled ? '点击关闭自动刷新' : '点击开启自动刷新'"
      >
        <Bell v-if="autoRefreshEnabled" :size="18" />
        <BellOff v-else :size="18" />
        <span>{{ autoRefreshEnabled ? '订单接受中' : '已暂停' }}</span>
      </button>
    </div>

    <Teleport to="body">
      <Transition name="toast-notify">
        <div v-if="showNewOrderNotification" class="new-order-toast" @click="dismissNotification">
          <div class="notification-content">
            <Bell :size="20" class="notification-icon" />
            <span class="notification-text">有 {{ newOrderCount }} 个新订单！</span>
          </div>
          <span class="notification-hint">点击关闭</span>
        </div>
      </Transition>
    </Teleport>

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
            <button class="btn btn-danger btn-sm" @click="handleClearAllOrders">
              <Trash2 :size="14" />
              清空订单
            </button>
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
            <Box :size="48" />
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
          <h4>菜品明细</h4>
          <div
            v-for="item in selectedOrder.items"
            :key="item.id"
            class="item-row"
          >
            <span>{{ item.dish_name }}</span>
            <span v-if="item.spec">({{ item.spec }})</span>
            <span>x{{ item.quantity }}</span>
            <span>{{ item.subtotal }}元</span>
          </div>
          <div class="total-row">
            <span>总计</span>
            <span>{{ selectedOrder.total_amount.toFixed(2) }}元</span>
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
      </div>
    </Modal>

    <!-- Clear Orders Confirm Dialog -->
    <ConfirmDialog
      :show="showClearConfirm"
      title="清空订单"
      message="确定要清空所有已完成和已取消的订单吗？此操作不可恢复！"
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3xl) var(--spacing-xl);
  text-align: center;
}

.empty-icon {
  width: 100px;
  height: 100px;
  border-radius: var(--radius-xl);
  background: linear-gradient(135deg, var(--color-primary-light, rgba(220, 38, 38, 0.1)) 0%, var(--color-bg-tertiary) 100%);
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

.total-row {
  display: flex;
  justify-content: space-between;
  padding-top: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-light);
  font-weight: 600;
}

.total-row span:last-child {
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
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.auto-refresh-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.auto-refresh-btn.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.auto-refresh-btn.active:hover {
  background-color: var(--color-primary-dark, #b91c1c);
}

.new-order-toast {
  position: fixed;
  top: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-toast, 9999);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: linear-gradient(135deg, var(--color-primary) 0%, #dc2626 100%);
  color: white;
  border-radius: var(--radius-lg);
  cursor: pointer;
  animation: pulse-shadow 2s infinite;
  box-shadow: 0 4px 20px rgba(220, 38, 38, 0.3);
  will-change: transform, opacity;
}

.notification-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.notification-icon {
  animation: bell-shake 0.5s ease-in-out infinite;
}

.notification-text {
  font-weight: 600;
  font-size: 1rem;
}

.notification-hint {
  font-size: 0.75rem;
  opacity: 0.8;
}

@keyframes pulse-shadow {
  0%, 100% {
    box-shadow: 0 4px 20px rgba(220, 38, 38, 0.3);
  }
  50% {
    box-shadow: 0 4px 30px rgba(220, 38, 38, 0.5);
  }
}

@keyframes bell-shake {
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(15deg);
  }
  75% {
    transform: rotate(-15deg);
  }
}

.toast-notify-enter-active {
  animation: toastNotifyIn var(--duration-normal) var(--ease-out);
}

.toast-notify-leave-active {
  animation: toastNotifyOut var(--duration-fast) var(--ease-in);
}

@keyframes toastNotifyIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-30px) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes toastNotifyOut {
  0% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(0.95);
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
</style>
