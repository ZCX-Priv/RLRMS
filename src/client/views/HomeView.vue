<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, defineAsyncComponent, type ComponentPublicInstance } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { api } from '@/api'
import { useCartStore } from '@/stores/cart'
import { useAppStore } from '@/stores/app'
import { useClientAuthStore } from '@/stores/clientAuth'
import type { Category, Dish } from '@/types'
import { formatPrice } from '@/utils/format'
import ClientLayout from '@/client/components/ClientLayout.vue'
import DishCard from '@/client/components/DishCard.vue'
import QuantityControl from '@/shared/components/QuantityControl.vue'
import Skeleton from '@/shared/components/Skeleton.vue'

const ConfirmDialog = defineAsyncComponent(() => import('@/shared/components/ConfirmDialog.vue'))
import { Search, ShoppingCart, Trash2, ChevronUp, ChevronDown, X, Frown } from 'lucide-vue-next'

const router = useRouter()
const cartStore = useCartStore()
const appStore = useAppStore()

const categories = ref<Category[]>([])
const dishes = ref<Dish[]>([])
const selectedCategory = ref<string>('')
const loading = ref(true)
const initialized = ref(false)
const showCart = ref(false)
const showClearConfirm = ref(false)
const showTableFullModal = ref(false)
const tableFullPeriod = ref<'中午' | '晚上'>('中午')
const contentRef = ref<HTMLElement | null>(null)
const sectionRefs = ref<Record<string, Element | null>>({})

const dishesByCategory = computed(() => {
  const grouped: Record<string, Dish[]> = {}
  for (const dish of dishes.value) {
    const catName = dish.category_name || '其他'
    if (!grouped[catName]) {
      grouped[catName] = []
    }
    grouped[catName].push(dish)
  }
  return grouped
})

const sortedCategories = computed(() => {
  return [...categories.value].sort((a, b) => a.sort_order - b.sort_order)
})

const visibleCategories = computed(() => {
  const visible: { id: string; name: string }[] = []
  const groupedDishes = dishesByCategory.value
  
  for (const cat of sortedCategories.value) {
    const dishesInCat = groupedDishes[cat.name]
    if (dishesInCat && dishesInCat.length > 0) {
      visible.push(cat)
    }
  }
  
  const otherDishes = groupedDishes['其他']
  if (otherDishes && otherDishes.length > 0) {
    visible.push({ id: 'uncategorized', name: '其他' })
  }
  
  return visible
})

async function fetchData() {
  try {
    if (!initialized.value) {
      loading.value = true
    }
    const res = await api.getHomeData()
    categories.value = res.data.categories
    dishes.value = res.data.dishes
    if (!initialized.value) {
      const firstCategory = visibleCategories.value[0]
      if (firstCategory) {
        selectedCategory.value = firstCategory.name
      }
    }
    initialized.value = true
  } catch (error) {
    console.error('Failed to fetch data:', error)
    appStore.showToast('加载数据失败', 'error')
  } finally {
    loading.value = false
  }
}

const SCROLL_POS_KEY = 'home_scroll_top'
const CATEGORY_KEY = 'home_selected_category'

function handleDishClick(dish: Dish) {
  showCart.value = false
  // 保存当前滚动位置和选中分类
  if (contentRef.value) {
    sessionStorage.setItem(SCROLL_POS_KEY, String(contentRef.value.scrollTop))
  }
  sessionStorage.setItem(CATEGORY_KEY, selectedCategory.value)
  router.push(`/dish/${dish.id}`)
}

function handleConfirmOrder() {
  if (cartStore.addDishOrderId && !cartStore.hasCartChanged) {
    appStore.showToast('菜单没有变动哦~', 'info')
    return
  }
  router.push('/order/confirm')
}

function dismissTableFullModal() {
  showTableFullModal.value = false
}

function handleClearCart() {
  showClearConfirm.value = true
}

function confirmClearCart() {
  cartStore.clearCart()
  showClearConfirm.value = false
}

function scrollToCategory(categoryName: string) {
  showCart.value = false
  const section = sectionRefs.value[categoryName]
  if (section && contentRef.value) {
    const contentRect = contentRef.value.getBoundingClientRect()
    const sectionRect = section.getBoundingClientRect()
    const scrollTop = contentRef.value.scrollTop + sectionRect.top - contentRect.top - 10
    contentRef.value.scrollTo({
      top: scrollTop,
      behavior: 'smooth'
    })
    selectedCategory.value = categoryName
  }
}

function setSectionRef(el: Element | ComponentPublicInstance | null, categoryName: string) {
  if (el instanceof Element) {
    sectionRefs.value[categoryName] = el
  }
}

/** 尝试恢复滚动位置，返回是否是从其他页面返回 */
async function restoreScrollPosition(): Promise<boolean> {
  const savedPos = sessionStorage.getItem(SCROLL_POS_KEY)
  const savedCat = sessionStorage.getItem(CATEGORY_KEY)
  const isReturning = savedPos !== null || savedCat !== null
  // 清除已消费的保存数据
  sessionStorage.removeItem(SCROLL_POS_KEY)
  sessionStorage.removeItem(CATEGORY_KEY)

  if (savedCat) {
    selectedCategory.value = savedCat
  }
  if (savedPos && contentRef.value) {
    await nextTick()
    contentRef.value.scrollTop = Number(savedPos)
  }
  return isReturning
}

/** 离开首页时保存标记，用于返回时跳过桌位弹窗 */
onBeforeRouteLeave(() => {
  sessionStorage.setItem(CATEGORY_KEY, selectedCategory.value)
  if (contentRef.value) {
    sessionStorage.setItem(SCROLL_POS_KEY, String(contentRef.value.scrollTop))
  }
})

onMounted(async () => {
  await fetchData()
  
  // 恢复滚动位置（如果从详情页返回），并记录是否是返回访问
  const isReturningFromRoute = await restoreScrollPosition()
  
  // 先确保已登录
  const clientAuthStore = useClientAuthStore()
  if (!clientAuthStore.isAuthenticated) {
    const restored = await clientAuthStore.tryRestore()
    if (!restored) {
      // 触发登录弹窗，等待登录结果
      await new Promise<void>((resolve) => {
        function onSuccess() {
          window.removeEventListener('client:login-cancel', onCancel)
          resolve()
        }
        function onCancel() {
          window.removeEventListener('client:login-success', onSuccess)
          resolve()
        }
        window.addEventListener('client:login-success', onSuccess, { once: true })
        window.addEventListener('client:login-cancel', onCancel, { once: true })
        window.dispatchEvent(new CustomEvent('client:require-login'))
      })
    }
  }
  
  // 等待购物车从 IndexedDB 恢复完成，避免与 restore() 产生竞态
  if (!cartStore.restored) {
    await new Promise<void>((resolve) => {
      const unwatch = watch(() => cartStore.restored, (val) => {
        if (val) { unwatch(); resolve() }
      })
    })
  }

  // 登录完成后：检测最近订单，若为活跃状态则自动进入修改模式
  let hasActiveOrder = false
  if (clientAuthStore.isAuthenticated) {
    try {
      const phone = clientAuthStore.user?.phone || undefined
      const res = await api.getOrders(phone)
      if (res.data.length > 0) {
        // 取最近一条订单（已按 created_at DESC 排序）
        const latestOrder = res.data[0]
        if (latestOrder && (latestOrder.status === 'pending' || latestOrder.status === 'confirmed')) {
          cartStore.setItemsFromOrder(latestOrder.items)
          cartStore.addDishOrderId = latestOrder.id
          hasActiveOrder = true
        }
      }
    } catch {
      // 查询失败时不影响正常流程
    }
  }

  // 检查桌位（仅首次进入页面时检测，从其他路由返回时跳过，加菜模式下跳过）
  if (clientAuthStore.isAuthenticated && !isReturningFromRoute && !hasActiveOrder) {
    const period: '中午' | '晚上' = new Date().getHours() >= 13 ? '晚上' : '中午'
    try {
      const res = await api.getAvailableTablesFor(period)
      if (res.data.length === 0) {
        tableFullPeriod.value = period
        showTableFullModal.value = true
      }
    } catch {
      // 查询失败时不影响正常流程
    }
  }

})
</script>

<template>
  <ClientLayout>
    <div class="home-page">
      <!-- Header -->
      <header class="home-header" @click="showCart = false">
        <h1 class="logo">红灯笼食府</h1>
        <div class="header-actions">
          <button class="icon-btn" @click.stop="router.push('/search')">
            <Search :size="20" />
          </button>
        </div>
      </header>

      <!-- Main Content with Sidebar -->
      <div class="main-layout" @click="showCart = false">
        <!-- Category Sidebar -->
        <nav class="category-sidebar">
          <button
            v-for="cat in visibleCategories"
            :key="cat.id"
            class="category-item"
            :class="{ 'category-item-active': selectedCategory === cat.name }"
            @click="scrollToCategory(cat.name)"
          >
            {{ cat.name }}
          </button>
        </nav>

        <!-- Content -->
        <div class="home-content" ref="contentRef">
          <!-- 骨架屏加载状态 -->
          <div v-if="loading && !initialized" class="skeleton-container">
            <div class="dish-section">
              <Skeleton variant="text" width="80px" height="20px" class="section-skeleton" />
              <div class="dish-grid">
                <div v-for="i in 6" :key="i" class="dish-card-skeleton">
                  <Skeleton variant="rect" width="100%" height="120px" radius="8px" />
                  <div class="dish-card-content-skeleton">
                    <Skeleton variant="text" width="70%" height="16px" />
                    <Skeleton variant="text" width="40%" height="14px" />
                    <div class="dish-card-footer-skeleton">
                      <Skeleton variant="text" width="50px" height="18px" />
                      <Skeleton variant="circle" width="28px" height="28px" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <template v-else-if="initialized">
            <div
              v-for="(categoryDishes, categoryName) in dishesByCategory"
              :key="categoryName"
              :ref="(el) => setSectionRef(el, categoryName)"
              class="dish-section"
            >
              <h2 class="section-title">{{ categoryName }}</h2>
              <div class="dish-grid">
                <DishCard
                  v-for="dish in categoryDishes"
                  :key="dish.id"
                  :dish="dish"
                  @click="handleDishClick(dish)"
                />
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Bottom Cart Bar -->
      <div class="cart-container" @click.stop>
        <Transition name="cart-expand">
          <div v-if="showCart" class="cart-expanded">
            <div class="cart-expanded-header">
              <span class="cart-expanded-title">购物车</span>
              <button class="clear-cart-btn" @click="handleClearCart" v-if="cartStore.items.length > 0">
                <Trash2 :size="14" />
                清空
              </button>
            </div>
            <div class="cart-expanded-body">
              <div v-if="cartStore.items.length === 0" class="empty-cart">
                购物车为空
              </div>
              <div v-else class="cart-items">
                <div
                  v-for="item in cartStore.items"
                  :key="`${item.dish.id}-${item.spec}`"
                  class="cart-item"
                >
                  <div class="item-info">
                    <span class="item-name">{{ item.dish.name }}</span>
                    <span v-if="item.spec" class="item-spec">({{ item.spec }})</span>
                  </div>
                  <div class="item-actions">
                    <span class="item-price">{{ formatPrice(item.dish.price) }}</span>
                    <QuantityControl
                      :model-value="item.quantity"
                      size="sm"
                      @update:model-value="(q: number) => cartStore.updateQuantity(item.dish.id, q, item.spec)"
                    />
                    <button class="item-delete-btn" @click="cartStore.removeItem(item.dish.id, item.spec)">
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
        
        <div class="cart-bar">
          <div class="cart-info" @click="showCart = !showCart">
            <div class="cart-icon-wrapper">
              <ShoppingCart :size="20" />
              <span v-if="cartStore.totalCount > 0" class="cart-count">{{ cartStore.totalCount }}</span>
            </div>
            <span class="cart-amount">{{ cartStore.totalAmount.toFixed(2) }}元</span>
            <ChevronDown v-if="showCart" :size="16" class="expand-icon" />
            <ChevronUp v-else :size="16" class="expand-icon" />
          </div>
          <button class="btn btn-primary confirm-btn" :disabled="cartStore.items.length === 0" @click="handleConfirmOrder">
            {{ cartStore.addDishOrderId ? '修改订单' : '确认订单' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Table Full Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showTableFullModal" class="table-full-backdrop" @click.self="dismissTableFullModal">
          <div class="table-full-modal">
            <button class="table-full-close" @click="dismissTableFullModal">
              <X :size="18" />
            </button>
            <div class="table-full-icon">
              <Frown :size="48" />
            </div>
            <h3 class="table-full-title">非常抱歉</h3>
            <p class="table-full-text">{{ tableFullPeriod }}的桌位已满</p>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Remove Item Confirm Dialog -->
    <ConfirmDialog
      v-model:show="showClearConfirm"
      title="清空购物车"
      message="确定要清空购物车吗？"
      @confirm="confirmClearCart"
    />
  </ClientLayout>
</template>

<style scoped>
.home-page {
  min-height: 100%;
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-primary);
  color: white;
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
}

.logo {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 700;
}

.header-actions {
  position: absolute;
  right: var(--spacing-lg);
  display: flex;
  gap: var(--spacing-sm);
}

.icon-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: white;
  transition: background-color var(--transition-fast);
}

.icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.main-layout {
  display: flex;
  height: calc(100vh - 130px);
}

.category-sidebar {
  width: 80px;
  flex-shrink: 0;
  background-color: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border-light);
  padding: var(--spacing-sm) 0;
  overflow-y: auto;
  position: sticky;
  top: 0;
}

.category-item {
  display: block;
  width: 100%;
  padding: var(--spacing-md) var(--spacing-sm);
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-align: center;
  border-left: 3px solid transparent;
  transition: all var(--transition-fast);
}

.category-item:hover {
  background-color: var(--color-bg-tertiary);
}

.category-item-active {
  background-color: var(--color-bg-primary);
  color: var(--color-primary);
  border-left-color: var(--color-primary);
  font-weight: 600;
}

.home-content {
  flex: 1;
  padding: var(--spacing-lg);
  padding-bottom: 100px;
  overflow-y: auto;
  height: 100%;
}

.skeleton-container {
  padding: var(--spacing-lg);
  padding-bottom: 100px;
}

.section-skeleton {
  margin-bottom: var(--spacing-md);
}

.dish-card-skeleton {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.dish-card-content-skeleton {
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.dish-card-footer-skeleton {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--spacing-xs);
}

.dish-section {
  margin-bottom: var(--spacing-xl);
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 2px solid var(--color-primary);
  display: inline-block;
}

.dish-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.cart-container {
  position: fixed;
  bottom: 84px;
  left: var(--spacing-md);
  right: var(--spacing-md);
  z-index: var(--z-fixed);
}

.cart-container:has(.cart-expanded) {
  filter: drop-shadow(0 4px 20px rgba(0, 0, 0, 0.15));
}

.cart-expanded {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  border: 1px solid var(--color-border-light);
  border-bottom: none;
  max-height: 40vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.cart-expanded-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
}

.cart-expanded-title {
  font-weight: 600;
  font-size: 0.875rem;
}

.clear-cart-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.clear-cart-btn:hover {
  color: var(--color-error);
}

.cart-expanded-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm) var(--spacing-md);
}

.empty-cart {
  text-align: center;
  padding: var(--spacing-lg);
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.cart-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.cart-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) 0;
}

.cart-item .item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.cart-item .item-name {
  font-size: 0.875rem;
  font-weight: 500;
}

.cart-item .item-spec {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.cart-item .item-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.cart-item .item-price {
  font-size: 0.875rem;
  color: var(--color-primary);
  min-width: 50px;
  text-align: right;
}

.cart-item .item-delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.cart-item .item-delete-btn:hover {
  background-color: var(--color-error);
  color: white;
}

.cart-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-xl);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.cart-expanded + .cart-bar {
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  box-shadow: none;
  outline: 1px solid var(--color-border-light);
  outline-offset: -1px;
}

.cart-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  cursor: pointer;
  flex: 1;
}

.expand-icon {
  color: var(--color-text-muted);
}

.cart-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: var(--color-primary);
  color: white;
  border-radius: 50%;
}

.cart-count {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  font-size: 0.625rem;
  font-weight: 600;
  background-color: white;
  color: var(--color-primary);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--duration-fast) var(--ease-bounce);
}

.cart-icon-wrapper:hover .cart-count {
  transform: scale(1.1);
}

.cart-amount {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-primary);
}

.confirm-btn {
  padding: var(--spacing-sm) var(--spacing-xl);
}

/* Cart expand transition */
.cart-expand-enter-active {
  -webkit-animation: cartSlideIn var(--duration-normal) var(--ease-bounce);
  animation: cartSlideIn var(--duration-normal) var(--ease-bounce);
}

.cart-expand-leave-active {
  -webkit-animation: cartSlideOut var(--duration-fast) var(--ease-in);
  animation: cartSlideOut var(--duration-fast) var(--ease-in);
}

@-webkit-keyframes cartSlideIn {
  0% {
    max-height: 0;
    opacity: 0;
    -webkit-transform: translateY(20px);
    transform: translateY(20px);
  }
  100% {
    max-height: 40vh;
    opacity: 1;
    -webkit-transform: translateY(0);
    transform: translateY(0);
  }
}

@keyframes cartSlideIn {
  0% {
    max-height: 0;
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    max-height: 40vh;
    opacity: 1;
    transform: translateY(0);
  }
}

@-webkit-keyframes cartSlideOut {
  0% {
    max-height: 40vh;
    opacity: 1;
    -webkit-transform: translateY(0);
    transform: translateY(0);
  }
  100% {
    max-height: 0;
    opacity: 0;
    -webkit-transform: translateY(10px);
    transform: translateY(10px);
  }
}

@keyframes cartSlideOut {
  0% {
    max-height: 40vh;
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    max-height: 0;
    opacity: 0;
    transform: translateY(10px);
  }
}

/* Staggered fade-up animation for dish cards */
.stagger-fade-up-enter-active {
  -webkit-animation: slideUp var(--duration-normal) var(--ease-out);
  animation: slideUp var(--duration-normal) var(--ease-out);
  -webkit-animation-delay: var(--stagger-delay, 0ms);
  animation-delay: var(--stagger-delay, 0ms);
}

.stagger-fade-up-leave-active {
  -webkit-animation: fadeOut var(--duration-fast) var(--ease-out);
  animation: fadeOut var(--duration-fast) var(--ease-out);
}

.stagger-fade-up-move {
  -webkit-transition: transform var(--duration-normal) var(--ease-out);
  transition: transform var(--duration-normal) var(--ease-out);
}

/* Table Full Modal */
.table-full-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.table-full-modal {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-2xl) var(--spacing-xl);
  width: 300px;
  text-align: center;
  position: relative;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.table-full-close {
  position: absolute;
  top: var(--spacing-md);
  right: var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--color-text-muted);
  transition: background-color var(--transition-fast);
}

.table-full-close:hover {
  background-color: var(--color-bg-tertiary);
}

.table-full-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.table-full-text {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.table-full-icon {
  display: flex;
  justify-content: center;
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-md);
}

.modal-fade-enter-active {
  animation: modalFadeIn 0.25s ease-out;
}

.modal-fade-leave-active {
  animation: modalFadeOut 0.2s ease-in;
}

@keyframes modalFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes modalFadeOut {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.95); }
}
</style>
