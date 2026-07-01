<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, provide, type Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useOrderPolling } from '@/shared/composables/useOrderPolling'
import type { Order } from '@/types'
import {
  Home,
  UtensilsCrossed,
  Armchair,
  Settings,
  LogOut,
  Menu,
  X,
  Package,
  Users,
  Code,
  Terminal,
  Send,
  ChevronRight,
  Bell
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const appStore = useAppStore()

const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)
const debugMenuExpanded = ref(false)

// ===== SSE 实时推送（全局） =====
const autoRefreshEnabled = ref(true)
const newOrderCount = ref(0)
const showNewOrderNotification = ref(false)
let eventSource: EventSource | null = null
let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null
const sseConnected = ref(false)
const SSE_RECONNECT_DELAY = 3000
let addDishResetTimer: ReturnType<typeof setTimeout> | null = null
let newOrderResetTimer: ReturnType<typeof setTimeout> | null = null
const addDishRequestCount = ref(0)

function scheduleAddDishReset() {
  if (addDishResetTimer) clearTimeout(addDishResetTimer)
  addDishResetTimer = setTimeout(() => {
    addDishRequestCount.value = 0
    addDishResetTimer = null
  }, 10000)
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
  if (newOrderResetTimer) clearTimeout(newOrderResetTimer)
  newOrderResetTimer = setTimeout(() => {
    showNewOrderNotification.value = false
    newOrderCount.value = 0
    newOrderResetTimer = null
  }, 5000)
}

function dismissNotification() {
  showNewOrderNotification.value = false
  newOrderCount.value = 0
}

function connectSSE() {
  disconnectSSE()
  const es = new EventSource('/api/admin/events', { withCredentials: true })
  eventSource = es

  es.addEventListener('connected', () => {
    sseConnected.value = true
  })

  es.addEventListener('new_order', (e: MessageEvent) => {
    try {
      const newOrder: Order = JSON.parse(e.data)
      window.dispatchEvent(new CustomEvent('sse:new_order', { detail: newOrder }))
      // 防重入：通过 recentlyNotified 与轮询互斥，先到者通知，后到者静默
      if (markNotified(newOrder.id)) {
        knownOrderIds.value.add(newOrder.id)
        orderSnapshot.value.set(newOrder.id, {
          status: newOrder.status,
          updated_at: newOrder.updated_at
        })
        handleNewOrder(1)
      }
    } catch (err) {
      console.error('SSE new_order parse error:', err)
    }
  })

  es.addEventListener('order_deleted', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as { id: string }
      window.dispatchEvent(new CustomEvent('sse:order_deleted', { detail: data }))
    } catch (err) {
      console.error('SSE order_deleted parse error:', err)
    }
  })

  es.addEventListener('order_updated', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as { id: string; status: Order['status']; type?: string; updated_at?: string }
      // 同步快照，防止轮询重复检测修改事件
      if (data.updated_at) {
        const prev = orderSnapshot.value.get(data.id)
        if (prev) {
          orderSnapshot.value.set(data.id, { status: data.status, updated_at: data.updated_at })
        }
      }
      window.dispatchEvent(new CustomEvent('sse:order_updated', { detail: data }))
      if (data.type === 'add_items' && markNotified('mod:' + data.id)) {
        addDishRequestCount.value++
        appStore.showToast(`收到${addDishRequestCount.value}条修改订单请求，请确认`, 'info')
        scheduleAddDishReset()
      }
    } catch (err) {
      console.error('SSE order_updated parse error:', err)
    }
  })

  es.onerror = () => {
    sseConnected.value = false
    es.close()
    eventSource = null
    // startPolling 已在 onMounted 中启动，此处仅作兜底保护（内部有防重复启动）
    if (autoRefreshEnabled.value && !isPolling.value) {
      startPolling()
    }
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

const knownOrderIds = ref(new Set<string>())
const orderSnapshot = ref(new Map<string, { status: string; updated_at: string }>())

// SSE 与轮询并行检测去重：先到者通知，后到者静默，10s 后自动清理
const recentlyNotified = new Set<string>()
function markNotified(key: string): boolean {
  if (recentlyNotified.has(key)) return false
  recentlyNotified.add(key)
  setTimeout(() => recentlyNotified.delete(key), 10000)
  return true
}

async function fetchOrdersForPolling() {
  try {
    const res = await api.getAdminOrders({})
    const fetchedOrders = res.data as Order[]
    window.dispatchEvent(new CustomEvent('sse:polling_orders', { detail: fetchedOrders }))

    if (knownOrderIds.value.size > 0) {
      // 检测被删除的订单（在 knownOrderIds 中但不在拉取结果中）
      const fetchedIds = new Set(fetchedOrders.map(o => o.id))
      for (const knownId of knownOrderIds.value) {
        if (!fetchedIds.has(knownId)) {
          window.dispatchEvent(new CustomEvent('sse:order_deleted', { detail: { id: knownId } }))
        }
      }

      // 1. 检测新订单 -> 通知横幅+音效（通过 markNotified 与 SSE 互斥，防止重复通知）
      const newOrders = fetchedOrders.filter(o => !knownOrderIds.value.has(o.id))
      const trulyNew = newOrders.filter(o => markNotified(o.id))
      if (trulyNew.length > 0) {
        handleNewOrder(trulyNew.length)
      }

      // 2. 检测订单修改（加菜：updated_at 变化且 pending）-> toast + 派发 sse:order_updated
      let addItemsCount = 0
      for (const order of fetchedOrders) {
        const prev = orderSnapshot.value.get(order.id)
        if (prev && prev.updated_at !== order.updated_at && order.status === 'pending' && markNotified('mod:' + order.id)) {
          addItemsCount++
          window.dispatchEvent(new CustomEvent('sse:order_updated', {
            detail: { id: order.id, status: order.status, type: 'add_items' }
          }))
        }
      }
      if (addItemsCount > 0) {
        addDishRequestCount.value += addItemsCount
        appStore.showToast(`收到${addDishRequestCount.value}条修改订单请求，请确认`, 'info')
        scheduleAddDishReset()
      }
    }

    // 更新快照
    knownOrderIds.value = new Set(fetchedOrders.map(o => o.id))
    const newSnapshot = new Map<string, { status: string; updated_at: string }>()
    for (const o of fetchedOrders) {
      newSnapshot.set(o.id, { status: o.status, updated_at: o.updated_at })
    }
    orderSnapshot.value = newSnapshot
  } catch (error) {
    console.error('Polling fetch failed:', error)
  }
}

const { isPolling, startPolling, stopPolling } = useOrderPolling(
  fetchOrdersForPolling,
  { interval: 5000 }
)

provide('autoRefreshEnabled', autoRefreshEnabled)
provide('toggleAutoRefresh', toggleAutoRefresh)

function toggleAutoRefresh() {
  autoRefreshEnabled.value = !autoRefreshEnabled.value
  if (autoRefreshEnabled.value) {
    startPolling()     // 轮询独立运行，负责扫尾
    appStore.showToast('已开启订单接收', 'success')
  } else {
    stopPolling()
    disconnectSSE()
    appStore.showToast('已关闭订单接收', 'info')
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopPolling()
  } else {
    if (autoRefreshEnabled.value) {
      connectSSE()
      startPolling()
    }
  }
}

onMounted(async () => {
  await appStore.loadTheme(true)
  await appStore.loadDevMode()
  connectSSE()
  // 轮询独立运行，与 SSE 并行，作为扫尾通道确保通知不丢失
  if (autoRefreshEnabled.value) {
    startPolling()
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  disconnectSSE()
  stopPolling()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (addDishResetTimer) { clearTimeout(addDishResetTimer); addDishResetTimer = null }
  if (newOrderResetTimer) { clearTimeout(newOrderResetTimer); newOrderResetTimer = null }
})

// 追踪导航项切换动画
const fadingItems = ref<Set<string>>(new Set())

interface NavItem {
  icon: Component
  label: string
  path: string
  children?: { icon: Component; label: string; path: string }[]
}

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { icon: Home, label: '首页', path: '/admin' },
    { icon: Armchair, label: '桌位管理', path: '/admin/tables' },
    { icon: UtensilsCrossed, label: '菜单管理', path: '/admin/dishes' },
    { icon: Package, label: '库存管理', path: '/admin/inventory' },
    { icon: Users, label: '用户管理', path: '/admin/users' },
    { icon: Settings, label: '系统设置', path: '/admin/settings' },
  ]
  if (appStore.devMode) {
    items.push({
      icon: Code,
      label: '调试工具',
      path: '/admin/debug',
      children: [
        { icon: Terminal, label: 'SQL 查询', path: '/admin/debug/sql' },
        { icon: Send, label: 'API 调试', path: '/admin/debug/api' }
      ]
    })
  }
  return items
})

// 根据当前路由自动展开/收起调试工具折叠菜单
watch(
  () => route.path,
  (newPath) => {
    debugMenuExpanded.value = newPath.startsWith('/admin/debug')
  },
  { immediate: true }
)

const currentPath = computed(() => route.path)

function isActive(path: string) {
  if (path === '/admin') {
    return currentPath.value === '/admin'
  }
  return currentPath.value.startsWith(path)
}

function handleNavigation(path: string) {
  router.push(path)
  mobileSidebarOpen.value = false
}

async function handleLogout() {
  try {
    await api.logout()
  } catch {
    // Ignore errors during logout
  }
  authStore.logout()
  router.push('/admin/login')
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function toggleMobileSidebar() {
  mobileSidebarOpen.value = !mobileSidebarOpen.value
}

function toggleDebugMenu() {
  debugMenuExpanded.value = !debugMenuExpanded.value
}

function handleDebugGroupClick(item: NavItem) {
  const firstChild = item.children?.[0]
  if (firstChild) {
    handleNavigation(firstChild.path)
  }
}

// 监听路由变化，触发淡入动画
watch(
  () => route.path,
  (newPath, oldPath) => {
    if (newPath !== oldPath) {
      fadingItems.value.add(newPath)
      setTimeout(() => {
        fadingItems.value.delete(newPath)
      }, 300)
    }
  }
)
</script>

<template>
  <div class="admin-layout">
    <!-- Mobile Header -->
    <header class="mobile-header">
      <button class="menu-btn" @click="toggleMobileSidebar">
        <Menu :size="24" />
      </button>
      <h1>红灯笼食府</h1>
      <button class="logout-btn" @click="handleLogout">
        <LogOut :size="20" />
      </button>
    </header>

    <!-- Sidebar -->
    <aside
      class="sidebar"
      :class="{ 'sidebar-collapsed': sidebarCollapsed, 'sidebar-mobile-open': mobileSidebarOpen }"
    >
      <div class="sidebar-header">
        <h2 v-if="!sidebarCollapsed">红灯笼食府</h2>
        <button class="collapse-btn" @click="toggleSidebar">
          <Menu :size="20" />
        </button>
        <button class="close-mobile-btn" @click="mobileSidebarOpen = false">
          <X :size="20" />
        </button>
      </div>

      <nav class="sidebar-nav">
        <template v-for="item in navItems" :key="item.path">
          <!-- 普通导航项 -->
          <button
            v-if="!item.children"
            class="nav-item"
            :class="{ 'nav-item-active': isActive(item.path) }"
            @click="handleNavigation(item.path)"
          >
            <Transition name="nav-fade" mode="out-in">
              <div
                :key="isActive(item.path) ? 'active' : 'inactive'"
                class="nav-icon-wrapper"
                :class="{ 'is-fading': fadingItems.has(item.path) }"
              >
                <component :is="item.icon" :size="20" />
              </div>
            </Transition>
            <Transition name="label-fade">
              <span v-if="!sidebarCollapsed" class="nav-label">{{ item.label }}</span>
            </Transition>
          </button>

          <!-- 调试工具折叠菜单 -->
          <div
            v-else
            class="nav-group"
            :class="{ 'nav-group-active': isActive(item.path) }"
          >
            <button
              class="nav-item nav-group-toggle"
              :class="{ 'nav-item-active': isActive(item.path) }"
              @click="handleDebugGroupClick(item)"
            >
              <Transition name="nav-fade" mode="out-in">
                <div
                  :key="isActive(item.path) ? 'active' : 'inactive'"
                  class="nav-icon-wrapper"
                  :class="{ 'is-fading': fadingItems.has(item.path) }"
                >
                  <component :is="item.icon" :size="20" />
                </div>
              </Transition>
              <Transition name="label-fade">
                <span v-if="!sidebarCollapsed" class="nav-label">{{ item.label }}</span>
              </Transition>
              <ChevronRight
                v-if="!sidebarCollapsed"
                :size="16"
                class="group-arrow"
                :class="{ expanded: debugMenuExpanded }"
                @click.stop="toggleDebugMenu()"
              />
            </button>
            <Transition name="expand">
              <div
                v-show="!sidebarCollapsed && debugMenuExpanded"
                class="nav-sub-items"
              >
                <button
                  v-for="child in item.children"
                  :key="child.path"
                  class="nav-item nav-sub-item"
                  :class="{ 'nav-item-active': isActive(child.path) }"
                  @click="handleNavigation(child.path)"
                >
                  <component :is="child.icon" :size="16" />
                  <span class="nav-label">{{ child.label }}</span>
                </button>
              </div>
            </Transition>
          </div>
        </template>
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" @click="handleLogout">
          <LogOut :size="20" />
          <span v-if="!sidebarCollapsed">退出登录</span>
        </button>
      </div>
    </aside>

    <!-- Mobile Overlay -->
    <div
      v-if="mobileSidebarOpen"
      class="mobile-overlay"
      @click="mobileSidebarOpen = false"
    ></div>

    <!-- Global New Order Notification -->
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

    <!-- Main Content -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background-color: var(--color-bg-primary);
}

/* Mobile Header */
.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-light);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-fixed);
}

@media (min-width: 768px) {
  .mobile-header {
    display: none;
  }
}

.mobile-header h1 {
  font-size: 1.125rem;
  font-weight: 600;
}

.menu-btn,
.mobile-header .logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
}

.menu-btn:hover,
.mobile-header .logout-btn:hover {
  background-color: var(--color-bg-tertiary);
}

/* Sidebar */
.sidebar {
  width: 240px;
  background-color: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: var(--z-fixed);
  transition: width var(--duration-normal) var(--ease-out);
}

@media (max-width: 767px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform var(--duration-normal) var(--ease-out);
  }

  .sidebar.sidebar-mobile-open {
    transform: translateX(0);
  }
}

.sidebar-collapsed {
  width: 64px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
}

.sidebar-collapsed .sidebar-header {
  justify-content: center;
}

.sidebar-header h2 {
  font-size: 1rem;
  font-weight: 600;
}

.collapse-btn,
.close-mobile-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
}

.collapse-btn:hover,
.close-mobile-btn:hover {
  background-color: var(--color-bg-tertiary);
}

@media (max-width: 767px) {
  .collapse-btn {
    display: none;
  }
}

@media (min-width: 768px) {
  .close-mobile-btn {
    display: none;
  }
}

.sidebar-nav {
  flex: 1;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.sidebar-collapsed .sidebar-nav {
  padding: var(--spacing-sm);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  width: 100%;
  text-align: left;
  position: relative;
  overflow: hidden;
}

/* 图标包装器 */
.nav-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  min-height: 20px;
  transition: transform var(--duration-fast) var(--ease-out),
              color var(--duration-normal) var(--ease-out);
  color: var(--color-text-secondary);
}

.nav-item:hover .nav-icon-wrapper {
  color: var(--color-primary);
}

.nav-item-active .nav-icon-wrapper {
  color: white;
}

/* 淡入动画 */
.nav-icon-wrapper.is-fading {
  -webkit-animation: navIconFadeIn var(--duration-fast) var(--ease-out);
  animation: navIconFadeIn var(--duration-fast) var(--ease-out);
}

@-webkit-keyframes navIconFadeIn {
  0% {
    opacity: 0;
    -webkit-transform: scale(0.8);
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    -webkit-transform: scale(1);
    transform: scale(1);
  }
}

@keyframes navIconFadeIn {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Vue Transition 图标淡入淡出 */
.nav-fade-enter-active {
  -webkit-animation: navFadeIn var(--duration-fast) var(--ease-out);
  animation: navFadeIn var(--duration-fast) var(--ease-out);
}

.nav-fade-leave-active {
  -webkit-animation: navFadeOut var(--duration-fast) var(--ease-out);
  animation: navFadeOut var(--duration-fast) var(--ease-out);
}

@-webkit-keyframes navFadeIn {
  0% {
    opacity: 0;
    -webkit-transform: scale(0.9);
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    -webkit-transform: scale(1);
    transform: scale(1);
  }
}

@keyframes navFadeIn {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@-webkit-keyframes navFadeOut {
  0% {
    opacity: 1;
    -webkit-transform: scale(1);
    transform: scale(1);
  }
  100% {
    opacity: 0;
    -webkit-transform: scale(0.9);
    transform: scale(0.9);
  }
}

@keyframes navFadeOut {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.9);
  }
}

/* 标签文字过渡 */
.nav-label {
  white-space: nowrap;
  -webkit-transition: opacity var(--duration-normal) var(--ease-out),
              color var(--duration-normal) var(--ease-out);
  transition: opacity var(--duration-normal) var(--ease-out),
              color var(--duration-normal) var(--ease-out);
}

.label-fade-enter-active,
.label-fade-leave-active {
  -webkit-transition: opacity var(--duration-fast) var(--ease-out);
  transition: opacity var(--duration-fast) var(--ease-out);
}

.label-fade-enter-from,
.label-fade-leave-to {
  opacity: 0;
}

/* 折叠状态下的图标居中动画 */
.sidebar-collapsed .nav-item {
  justify-content: center;
  padding: 0;
  gap: 0;
  border-radius: var(--radius-sm);
  width: 48px;
  height: 48px;
  margin: 0 auto;
}

.sidebar-collapsed .nav-icon-wrapper {
  -webkit-transition: transform var(--duration-normal) var(--ease-spring);
  transition: transform var(--duration-normal) var(--ease-spring);
}

.sidebar-collapsed .nav-item:hover .nav-icon-wrapper {
  -webkit-transform: scale(1.1);
  transform: scale(1.1);
}

.sidebar-collapsed .nav-item-active .nav-icon-wrapper {
  -webkit-transform: scale(1);
  transform: scale(1);
}

/* 导航项背景和颜色过渡 */
.nav-item {
  -webkit-transition: background-color var(--duration-fast) var(--ease-out),
              color var(--duration-fast) var(--ease-out);
  transition: background-color var(--duration-fast) var(--ease-out),
              color var(--duration-fast) var(--ease-out);
}

.nav-item:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.nav-item-active {
  background-color: var(--color-primary);
  color: white;
}

.nav-item-active:hover {
  background-color: var(--color-primary);
  color: white;
}

.nav-item-active:hover .nav-icon-wrapper {
  color: white;
}

/* 折叠菜单组 */
.nav-group {
  display: flex;
  flex-direction: column;
}

.nav-group-toggle {
  justify-content: space-between;
}

.nav-group-toggle .nav-label {
  flex: 1;
}

.group-arrow {
  color: var(--color-text-muted);
  transition: transform var(--duration-normal) var(--ease-out);
  flex-shrink: 0;
}

.group-arrow.expanded {
  transform: rotate(90deg);
}

.nav-sub-items {
  display: grid;
  overflow: hidden;
}

.nav-sub-item {
  position: relative;
  padding: var(--spacing-sm) var(--spacing-md);
  padding-left: calc(var(--spacing-md) + 20px + var(--spacing-md) + 10px);
  gap: var(--spacing-md);
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.nav-sub-item:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.nav-sub-item.nav-item-active {
  background-color: transparent;
  color: var(--color-primary);
}

.nav-sub-item.nav-item-active::before {
  content: '';
  position: absolute;
  left: calc(var(--spacing-md) + 20px + var(--spacing-md));
  top: 50%;
  transform: translateY(-50%);
  height: 16px;
  width: 3px;
  border-radius: 9999px;
  background-color: var(--color-primary);
}

.nav-sub-item.nav-item-active:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-primary);
}

/* 子菜单展开/收起动画 */
.expand-enter-active,
.expand-leave-active {
  transition: grid-template-rows var(--duration-normal) var(--ease-out),
              opacity var(--duration-normal) var(--ease-out);
}

.expand-enter-from,
.expand-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  grid-template-rows: 1fr;
  opacity: 1;
}

.sidebar-footer {
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
}

.sidebar-collapsed .sidebar-footer {
  padding: var(--spacing-sm);
}

.sidebar-footer .logout-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  width: 100%;
}

.sidebar-collapsed .sidebar-footer .logout-btn {
  justify-content: center;
  padding: 0;
  gap: 0;
  border-radius: var(--radius-sm);
  width: 48px;
  height: 48px;
  margin: 0 auto;
}

.sidebar-footer .logout-btn > :first-child {
  flex-shrink: 0;
  min-width: 20px;
  min-height: 20px;
}

.sidebar-footer .logout-btn:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-error);
}

/* Mobile Overlay */
.mobile-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: calc(var(--z-fixed) - 1);
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
}

@media (max-width: 767px) {
  .mobile-overlay {
    display: block;
    animation: overlayFadeIn var(--duration-normal) var(--ease-out) forwards;
  }
}

@keyframes overlayFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Main Content */
.main-content {
  flex: 1;
  min-width: 0;
  padding: var(--spacing-lg);
  margin-top: 60px;
}

@media (min-width: 768px) {
  .main-content {
    margin-left: 240px;
    margin-top: 0;
    transition: margin-left var(--duration-normal) var(--ease-out);
  }

  .sidebar-collapsed + .mobile-overlay + .main-content,
  .admin-layout:has(.sidebar-collapsed) .main-content {
    margin-left: 64px;
  }
}

/* 点击反馈 */
.nav-item:active .nav-icon-wrapper {
  transform: scale(0.95);
}

/* Mobile header logout btn */

/* New Order Toast */
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
</style>
