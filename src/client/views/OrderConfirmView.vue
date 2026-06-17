<script setup lang="ts">
import { ref, computed, onMounted, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import { getItem, setItem } from '@/utils/storage'
import { useCartStore } from '@/stores/cart'
import { useTableStore } from '@/stores/table'
import { useAppStore } from '@/stores/app'
import { useClientAuthStore } from '@/stores/clientAuth'
import type { Table } from '@/types'
import ClientLayout from '@/client/components/ClientLayout.vue'
import QuantityControl from '@/shared/components/QuantityControl.vue'

import { ArrowLeft, Trash2, Phone, User, Clock, ChefHat, FileText, Rocket, CheckCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const router = useRouter()
const cartStore = useCartStore()
const tableStore = useTableStore()
const appStore = useAppStore()
const clientAuthStore = useClientAuthStore()

const isAfterNoon = computed(() => {
  const now = new Date()
  return now.getHours() >= 13
})

const diningTime = ref<'中午' | '晚上'>('中午')
const contactName = ref('')
const contactPhone = ref('')
const submitting = ref(false)
const nameError = ref('')
const showProgressModal = ref(false)
const progressStep = ref(0)

// 菜单收起/展开状态
const ITEMS_COLLAPSE_THRESHOLD = 3
const itemsExpanded = ref(false)
const displayItems = computed(() => {
  if (itemsExpanded.value || cartStore.items.length <= ITEMS_COLLAPSE_THRESHOLD) {
    return cartStore.items
  }
  return cartStore.items.slice(0, ITEMS_COLLAPSE_THRESHOLD)
})
const hasMoreItems = computed(() => cartStore.items.length > ITEMS_COLLAPSE_THRESHOLD)

// 内联桌位选择
const availableTables = ref<Table[]>([])
const tablesLoading = ref(false)

// 桌位翻页
const TABLE_PAGE_SIZE = 9
const tablePage = ref(1)
const totalPages = computed(() => Math.ceil(availableTables.value.length / TABLE_PAGE_SIZE))
const showTablePagination = computed(() => availableTables.value.length > TABLE_PAGE_SIZE)
const paginatedTables = computed(() => {
  const start = (tablePage.value - 1) * TABLE_PAGE_SIZE
  return availableTables.value.slice(start, start + TABLE_PAGE_SIZE)
})

function changeTablePage(delta: number) {
  const newPage = tablePage.value + delta
  if (newPage >= 1 && newPage <= totalPages.value) {
    tablePage.value = newPage
  }
}

async function fetchAvailableTables() {
  try {
    tablesLoading.value = true
    const res = await api.getAvailableTablesFor(diningTime.value)
    availableTables.value = res.data
  } catch (error) {
    console.error('Failed to fetch available tables:', error)
    availableTables.value = []
  } finally {
    tablesLoading.value = false
  }
}

function handleSelectTable(table: Table) {
  tableStore.selectTable(table)
}

watch(diningTime, () => {
  tableStore.clearSelection()
  fetchAvailableTables()
})

// 桌位数据变化时重置页码
watch(availableTables, () => {
  tablePage.value = 1
})

const progressSteps = [
  { text: '正在准备订单...', icon: 'FileText' },
  { text: '订单飞向厨房...', icon: 'Rocket' },
  { text: '厨房已收到！', icon: 'CheckCircle' },
]

const progressIcons: Record<string, Component> = {
  FileText,
  Rocket,
  CheckCircle,
}

onMounted(async () => {
  if (isAfterNoon.value) {
    diningTime.value = '晚上'
  }
  // 清除残留桌位选中状态
  tableStore.clearSelection()
  // 获取可用桌位
  await fetchAvailableTables()
  // Auto-fill phone from logged-in user
  if (clientAuthStore.user?.phone) {
    contactPhone.value = clientAuthStore.user.phone
  }
  // Auto-fill contact name from IndexedDB
  const savedName = await getItem<string>('contact_name')
  if (savedName) {
    contactName.value = savedName
    validateName(savedName)
  }
})

function validateName(value: string) {
  if (value.trim() === '') {
    nameError.value = ''
    return
  }
  const nameRegex = /^[\u4e00-\u9fa5a-zA-Z\s]+$/
  if (!nameRegex.test(value)) {
    nameError.value = '称呼只能包含中文或英文'
  } else {
    nameError.value = ''
  }
}

function handleNameInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  contactName.value = value
  validateName(value)
  // Persist to IndexedDB for auto-fill next time
  setItem('contact_name', value)
}

function handlePhoneInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  contactPhone.value = value.replace(/\D/g, '')
}

const canSubmit = computed(() => {
  return (
    tableStore.isTableSelected &&
    contactName.value.trim() !== '' &&
    nameError.value === '' &&
    contactPhone.value.trim() !== '' &&
    cartStore.items.length > 0
  )
})

function handleRemoveItem(dishId: string, spec: string | null) {
  cartStore.removeItem(dishId, spec)
}

async function handleSubmit() {
  if (!canSubmit.value || submitting.value) return

  try {
    submitting.value = true
    showProgressModal.value = true
    progressStep.value = 0

    const res = await api.createOrder({
      table_id: tableStore.selectedTable?.id,
      dining_time: diningTime.value,
      contact_name: contactName.value,
      contact_phone: contactPhone.value,
      items: cartStore.getOrderItems(),
    })

    progressStep.value = 1
    await new Promise(resolve => setTimeout(resolve, 800))
    
    progressStep.value = 2
    await new Promise(resolve => setTimeout(resolve, 600))

    cartStore.clearCart()
    
    await new Promise(resolve => setTimeout(resolve, 400))
    showProgressModal.value = false
    
    router.push(`/order/${res.data.id}`)
  } catch (error) {
    console.error('Failed to create order:', error)
    showProgressModal.value = false
    appStore.showToast('下单失败，请重试', 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <ClientLayout>
    <div class="order-confirm-page">
      <!-- Header -->
      <header class="confirm-header">
        <button class="back-btn" @click="router.back()">
          <ArrowLeft :size="20" />
        </button>
        <h1>确认订单</h1>
      </header>

      <!-- Content -->
      <div class="confirm-content">
        <!-- Dining Time -->
        <div class="section-card">
          <div class="section-icon">
            <Clock :size="20" />
          </div>
          <div class="section-info">
            <span class="section-label">就餐时间</span>
            <div class="time-options">
              <button
                class="time-option"
                :class="{ 'time-option-active': diningTime === '中午', 'time-option-disabled': isAfterNoon }"
                :disabled="isAfterNoon"
                @click="!isAfterNoon && (diningTime = '中午')"
              >
                中午
              </button>
              <button
                class="time-option"
                :class="{ 'time-option-active': diningTime === '晚上' }"
                @click="diningTime = '晚上'"
              >
                晚上
              </button>
            </div>
          </div>
        </div>

        <!-- Table Selection (inline) -->
        <div class="section-card table-section">
          <div class="table-section-header">
            <span class="section-label">选择桌位</span>
            <span v-if="tablesLoading" class="tables-loading-text">加载中...</span>
          </div>
          <div v-if="availableTables.length === 0 && !tablesLoading" class="tables-empty">
            <span>该时段桌位已满，请切换其他时段</span>
          </div>
          <div v-else class="table-grid">
            <button
              v-for="table in paginatedTables"
              :key="table.id"
              class="table-item"
              :class="{ 'table-item-selected': tableStore.selectedTable?.id === table.id }"
              @click="handleSelectTable(table)"
            >
              <span class="table-name">{{ table.name }}</span>
              <span class="table-capacity">{{ table.capacity }}人</span>
            </button>
          </div>
          <div v-if="showTablePagination" class="table-pagination">
            <button
              class="page-btn"
              :disabled="tablePage === 1"
              @click="changeTablePage(-1)"
            >
              <ChevronLeft :size="16" />
            </button>
            <span class="page-info">{{ tablePage }} / {{ totalPages }}</span>
            <button
              class="page-btn"
              :disabled="tablePage === totalPages"
              @click="changeTablePage(1)"
            >
              <ChevronRight :size="16" />
            </button>
          </div>
        </div>

        <!-- Order Items -->
        <div class="section-card items-card">
          <div class="items-header">
            <span class="section-label">菜单</span>
            <span class="items-count">{{ cartStore.totalCount }}件</span>
          </div>
          <div v-if="cartStore.items.length === 0" class="empty-cart">
            <span>购物车是空的，请先添加菜品</span>
            <button class="btn btn-primary btn-sm" @click="router.push('/')">
              去点餐
            </button>
          </div>
          <div v-else class="items-list">
            <div
              v-for="item in displayItems"
              :key="`${item.dish.id}-${item.spec}`"
              class="order-item"
            >
              <div class="item-info">
                <span class="item-name">{{ item.dish.name }}</span>
                <span v-if="item.spec" class="item-spec">{{ item.spec }}</span>
              </div>
              <div class="item-right">
                <span class="item-price">{{ item.dish.price }}元</span>
                <QuantityControl
                  :model-value="item.quantity"
                  size="sm"
                  @update:model-value="(q: number) => cartStore.updateQuantity(item.dish.id, q, item.spec)"
                />
                <button class="remove-btn" @click="handleRemoveItem(item.dish.id, item.spec)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
          <button
            v-if="hasMoreItems"
            class="items-toggle"
            @click="itemsExpanded = !itemsExpanded"
          >
            <component :is="itemsExpanded ? ChevronUp : ChevronDown" :size="14" />
            {{ itemsExpanded ? '收起' : `展开全部 (${cartStore.items.length}项)` }}
          </button>
          <div class="total-section">
            <span>合计：</span>
            <span class="total-amount">{{ cartStore.totalAmount.toFixed(2) }}元</span>
          </div>
        </div>

        <!-- Contact Info -->
        <div class="section-card contact-card">
          <div class="contact-header">
            <Phone :size="20" />
            <span>联系方式</span>
          </div>
          <div class="contact-form">
            <div class="form-row" :class="{ 'form-row-error': nameError }">
              <User :size="16" class="form-icon" />
              <input
                :value="contactName"
                type="text"
                placeholder="请输入称呼"
                class="form-input"
                @input="handleNameInput"
              />
            </div>
            <span v-if="nameError" class="form-error">{{ nameError }}</span>
            <div class="form-row">
              <Phone :size="16" class="form-icon" />
              <input
                :value="contactPhone"
                type="tel"
                placeholder="请输入手机号"
                class="form-input"
                @input="handlePhoneInput"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Action -->
      <div class="bottom-action">
        <button class="btn btn-secondary" @click="router.back()">取消</button>
        <button
          class="btn btn-primary"
          :disabled="!canSubmit || submitting"
          @click="handleSubmit"
        >
          {{ submitting ? '提交中...' : '下单' }}
        </button>
      </div>

      <!-- Progress Modal -->
      <Teleport to="body">
        <Transition name="progress-modal">
          <div v-if="showProgressModal" class="progress-modal-backdrop">
            <div class="progress-modal">
              <div class="progress-icon-wrapper">
                <div class="progress-icon" :class="{ 'icon-animate': progressStep < 2 }">
                  <ChefHat :size="48" />
                </div>
                <div class="progress-particles" v-if="progressStep < 2">
                  <span v-for="i in 6" :key="i" class="particle" :style="{ '--delay': i * 0.1 + 's' }"></span>
                </div>
              </div>
              <div class="progress-content">
                <Transition name="fade-slide" mode="out-in">
                  <div :key="progressStep" class="progress-step">
                    <component :is="progressIcons[progressSteps[progressStep]!.icon]" :size="28" class="step-icon" />
                    <span class="step-text">{{ progressSteps[progressStep]!.text }}</span>
                  </div>
                </Transition>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar" :style="{ width: ((progressStep + 1) / 3 * 100) + '%' }"></div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
  </ClientLayout>
</template>

<style scoped>
.order-confirm-page {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  padding-bottom: 80px;
}

.confirm-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-bg-secondary);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
}

.back-btn {
  position: absolute;
  left: var(--spacing-lg);
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

.confirm-header h1 {
  font-size: 1.125rem;
  font-weight: 600;
}

.confirm-content {
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.section-card {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.section-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  color: var(--color-primary);
}

.section-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.section-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.section-value {
  font-size: 1rem;
  font-weight: 500;
}

.section-arrow {
  color: var(--color-text-muted);
}

.items-card {
  flex-direction: column;
  align-items: stretch;
}

.items-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-light);
}

.items-count {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.empty-cart {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl) 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.order-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
}

.item-info {
  display: flex;
  flex-direction: column;
}

.item-name {
  font-size: 0.875rem;
}

.item-spec {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.item-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.item-price {
  font-size: 0.875rem;
  color: var(--color-primary);
  min-width: 50px;
  text-align: right;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.remove-btn:hover {
  background-color: var(--color-error);
  color: white;
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
  color: var(--color-primary);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  transition: background-color var(--transition-fast);
}

.items-toggle:hover {
  background-color: var(--color-border-light);
}

.time-options {
  display: flex;
  gap: var(--spacing-sm);
}

.time-option {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.time-option:hover {
  border-color: var(--color-primary);
}

.time-option-active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.time-option-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 内联桌位选择 */
.table-section {
  flex-direction: column;
  align-items: stretch;
}

.table-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
}

.tables-loading-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.tables-empty {
  text-align: center;
  padding: var(--spacing-xl) 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.table-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
}

.table-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background-color: var(--color-bg-tertiary);
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
  cursor: pointer;
}

.table-item:hover {
  border-color: var(--color-primary);
  background-color: var(--color-bg-secondary);
}

.table-item-selected {
  border-color: var(--color-primary);
  background-color: var(--color-bg-secondary);
}

.table-name {
  font-size: 0.875rem;
  font-weight: 500;
}

.table-capacity {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.table-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.page-btn:hover:not(:disabled) {
  background-color: var(--color-primary);
  color: white;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  min-width: 50px;
  text-align: center;
}

.contact-card {
  flex-direction: column;
  align-items: stretch;
}

.contact-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
  color: var(--color-text-secondary);
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.form-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
}

.form-icon {
  color: var(--color-text-muted);
}

.form-input {
  flex: 1;
  border: none;
  background: none;
  padding: var(--spacing-xs);
  font-size: 0.875rem;
}

.form-input:focus {
  outline: none;
}

.form-row-error {
  border: 1px solid var(--color-error);
}

.form-error {
  font-size: 0.75rem;
  color: var(--color-error);
  margin-top: var(--spacing-xs);
}

.total-section {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) 0 0;
  margin-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-light);
  font-size: 1rem;
}

.total-amount {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-primary);
}

.bottom-action {
  position: fixed;
  bottom: 60px;
  left: 0;
  right: 0;
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-light);
}

.bottom-action .btn {
  flex: 1;
  padding: var(--spacing-md);
}

.progress-modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.progress-modal {
  background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-tertiary) 100%);
  border-radius: var(--radius-xl);
  padding: var(--spacing-2xl);
  width: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.progress-icon-wrapper {
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-lg);
}

.progress-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--color-primary) 0%, #ff6b6b 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 8px 30px rgba(255, 107, 107, 0.4);
}

.progress-icon.icon-animate {
  animation: iconBounce 1s ease-in-out infinite;
}

@keyframes iconBounce {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-10px) rotate(-5deg); }
  50% { transform: translateY(0) rotate(0deg); }
  75% { transform: translateY(-5px) rotate(5deg); }
}

.progress-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
  border-radius: 50%;
  animation: particleFloat 1.5s ease-in-out infinite;
  animation-delay: var(--delay);
  box-shadow: 0 0 6px rgba(255, 215, 0, 0.6);
}

.particle:nth-child(1) { top: 0; left: 50%; transform: translateX(-50%); }
.particle:nth-child(2) { top: 20%; right: 0; }
.particle:nth-child(3) { bottom: 20%; right: 0; }
.particle:nth-child(4) { bottom: 0; left: 50%; transform: translateX(-50%); }
.particle:nth-child(5) { bottom: 20%; left: 0; }
.particle:nth-child(6) { top: 20%; left: 0; }

@keyframes particleFloat {
  0%, 100% { opacity: 0.3; transform: translateY(0) scale(0.8); }
  50% { opacity: 1; transform: translateY(-8px) scale(1.2); }
}

.progress-content {
  text-align: center;
  margin-bottom: var(--spacing-lg);
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.step-icon {
  color: var(--color-primary);
}

.step-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.progress-bar-container {
  width: 100%;
  height: 6px;
  background-color: var(--color-bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary) 0%, #ff6b6b 100%);
  border-radius: 3px;
  transition: width 0.4s ease-out;
}

.progress-modal-enter-active {
  animation: modalFadeIn 0.3s ease-out;
}

.progress-modal-leave-active {
  animation: modalFadeOut 0.2s ease-in;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modalFadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease-out;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
