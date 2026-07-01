<script setup lang="ts">
import { ref, onMounted, toRaw, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import { useAppStore } from '@/stores/app'
import { useCartStore } from '@/stores/cart'
import { getItem, setItem, removeItem } from '@/utils/storage'
import type { Dish } from '@/types'
import { formatPrice } from '@/utils/format'
import ClientLayout from '@/client/components/ClientLayout.vue'
import DishCard from '@/client/components/DishCard.vue'
import QuantityControl from '@/shared/components/QuantityControl.vue'
const ConfirmDialog = defineAsyncComponent(() => import('@/shared/components/ConfirmDialog.vue'))
import { ArrowLeft, Search, X, Trash2, ShoppingCart, ChevronUp, ChevronDown } from 'lucide-vue-next'

const router = useRouter()
const appStore = useAppStore()
const cartStore = useCartStore()

const searchQuery = ref('')
const searchResults = ref<Dish[]>([])
const searchHistory = ref<string[]>([])
const searching = ref(false)
const hasSearched = ref(false)
const showClearConfirm = ref(false)
const showCart = ref(false)
const showCartClearConfirm = ref(false)

const SEARCH_HISTORY_KEY = 'searchHistory'

async function loadHistory() {
  const history = await getItem<string[]>(SEARCH_HISTORY_KEY)
  if (history) {
    searchHistory.value = history
  }
}

async function saveHistory(query: string) {
  const history = searchHistory.value.filter(h => h !== query)
  history.unshift(query)
  searchHistory.value = history.slice(0, 10)
  await setItem(SEARCH_HISTORY_KEY, toRaw(searchHistory.value))
}

function clearHistory() {
  showClearConfirm.value = true
}

async function confirmClearHistory() {
  searchHistory.value = []
  await removeItem(SEARCH_HISTORY_KEY)
  showClearConfirm.value = false
}

async function removeHistoryItem(index: number) {
  searchHistory.value.splice(index, 1)
  await setItem(SEARCH_HISTORY_KEY, toRaw(searchHistory.value))
}

async function handleSearch() {
  if (!searchQuery.value.trim()) return
  
  try {
    searching.value = true
    hasSearched.value = true
    const res = await api.searchDishes(searchQuery.value.trim())
    searchResults.value = res.data
    await saveHistory(searchQuery.value.trim())
  } catch (error) {
    console.error('Search failed:', error)
    appStore.showToast('搜索失败', 'error')
  } finally {
    searching.value = false
  }
}

function useHistoryItem(query: string) {
  searchQuery.value = query
  handleSearch()
}

function handleDishClick(dish: Dish) {
  router.push(`/dish/${dish.id}`)
}

function handleConfirmOrder() {
  if (cartStore.addDishOrderId && !cartStore.hasCartChanged) {
    appStore.showToast('菜单没有变动哦~', 'info')
    return
  }
  router.push('/order/confirm')
}

function handleClearCart() {
  showCartClearConfirm.value = true
}

function confirmClearCart() {
  cartStore.clearCart()
  showCartClearConfirm.value = false
}

onMounted(() => {
  loadHistory()
})
</script>

<template>
  <ClientLayout>
    <div class="search-page">
      <!-- Search Header -->
      <header class="search-header">
        <button class="back-btn" @click="router.back()">
          <ArrowLeft :size="20" />
        </button>
        <div class="search-input-wrapper">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索点什么..."
            class="search-input"
            @keyup.enter="handleSearch"
          />
          <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
            <X :size="16" />
          </button>
        </div>
        <button class="search-btn" @click="handleSearch">
          <Search :size="20" />
        </button>
      </header>

      <!-- Content -->
      <div class="search-content">
        <!-- Search Results -->
        <template v-if="hasSearched">
          <div v-if="searching" class="loading-container">
            <div class="loading-spinner"></div>
          </div>
          
          <div v-else-if="searchResults.length === 0" class="empty-state">
            未找到相关菜品
          </div>
          
          <div v-else class="results-grid">
            <DishCard
              v-for="dish in searchResults"
              :key="dish.id"
              :dish="dish"
              @click="handleDishClick(dish)"
            />
          </div>
        </template>

        <!-- Search History -->
        <template v-else>
          <div class="history-section" v-if="searchHistory.length > 0">
            <div class="history-header">
              <h3>搜索历史</h3>
              <button class="clear-history-btn" @click="clearHistory">
                <Trash2 :size="16" />
                清空
              </button>
            </div>
            <div class="history-tags">
              <button
                v-for="(item, index) in searchHistory"
                :key="index"
                class="history-tag"
                @click="useHistoryItem(item)"
              >
                {{ item }}
                <span class="remove-tag" @click.stop="removeHistoryItem(index)">
                  <X :size="12" />
                </span>
              </button>
            </div>
          </div>
          
          <div v-else class="empty-state">
            输入关键词搜索菜品
          </div>
        </template>
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

    <!-- Clear History Confirmation Dialog -->
    <ConfirmDialog
      v-model:show="showClearConfirm"
      title="清空搜索历史"
      message="确定要清空搜索历史吗？"
      @confirm="confirmClearHistory"
    />

    <!-- Clear Cart Confirmation Dialog -->
    <ConfirmDialog
      v-model:show="showCartClearConfirm"
      title="清空购物车"
      message="确定要清空购物车吗？"
      @confirm="confirmClearCart"
    />
  </ClientLayout>
</template>

<style scoped>
.search-page {
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--color-bg-primary);
}

.search-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-md) 0;
  background-color: var(--color-bg-secondary);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--color-text-primary);
  transition: background-color var(--transition-fast);
}

.back-btn:hover {
  background-color: var(--color-bg-tertiary);
}

.search-input-wrapper {
  flex: 1;
  position: relative;
}

.search-input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-lg);
  padding-right: 32px;
  border-radius: var(--radius-full);
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-light);
  font-size: 0.875rem;
}

.search-input:focus {
  border-color: var(--color-primary);
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: var(--color-text-muted);
}

.clear-btn:hover {
  background-color: var(--color-border-light);
}

.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--color-primary);
  color: white;
  transition: background-color var(--transition-fast);
}

.search-btn:hover {
  background-color: var(--color-primary-dark);
}

.search-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  padding-bottom: 100px;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.history-section {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
}

.history-header h3 {
  font-size: 0.875rem;
  font-weight: 500;
}

.clear-history-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.clear-history-btn:hover {
  color: var(--color-error);
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.history-tag {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.history-tag:hover {
  background-color: var(--color-border-light);
}

.remove-tag {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.remove-tag:hover {
  background-color: var(--color-text-muted);
  color: white;
}

/* Cart */
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
  0% { max-height: 0; opacity: 0; -webkit-transform: translateY(20px); transform: translateY(20px); }
  100% { max-height: 40vh; opacity: 1; -webkit-transform: translateY(0); transform: translateY(0); }
}

@keyframes cartSlideIn {
  0% { max-height: 0; opacity: 0; transform: translateY(20px); }
  100% { max-height: 40vh; opacity: 1; transform: translateY(0); }
}

@-webkit-keyframes cartSlideOut {
  0% { max-height: 40vh; opacity: 1; -webkit-transform: translateY(0); transform: translateY(0); }
  100% { max-height: 0; opacity: 0; -webkit-transform: translateY(10px); transform: translateY(10px); }
}

@keyframes cartSlideOut {
  0% { max-height: 40vh; opacity: 1; transform: translateY(0); }
  100% { max-height: 0; opacity: 0; transform: translateY(10px); }
}
</style>
