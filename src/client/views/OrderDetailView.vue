<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '@/api'
import { useAppStore } from '@/stores/app'
import { useCartStore } from '@/stores/cart'
import { useTableStore } from '@/stores/table'
import type { Order } from '@/types'
import ClientLayout from '@/client/components/ClientLayout.vue'

const Modal = defineAsyncComponent(() => import('@/shared/components/Modal.vue'))
import { ArrowLeft, Store, Clock, Phone, User, QrCode } from 'lucide-vue-next'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const cartStore = useCartStore()
const tableStore = useTableStore()

const order = ref<Order | null>(null)
const loading = ref(true)
const showQRModal = ref(false)
const cancelling = ref(false)
const qrCodeDataUrl = ref('')
const barcodeDataUrl = ref('')

const canCancel = computed(() => {
  if (!order.value || order.value.status !== 'pending') return false
  const createdAt = new Date(order.value.created_at + 'Z')
  const now = new Date()
  const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60)
  return diffMinutes <= 5
})

const statusText = computed(() => {
  if (!order.value) return ''
  const statusMap: Record<string, string> = {
    pending: '等待商家确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消',
  }
  return statusMap[order.value.status] || order.value.status
})

const statusColor = computed(() => {
  if (!order.value) return ''
  const colorMap: Record<string, string> = {
    pending: 'var(--color-warning)',
    confirmed: 'var(--color-info)',
    completed: 'var(--color-success)',
    cancelled: 'var(--color-error)',
  }
  return colorMap[order.value.status] || 'var(--color-text-muted)'
})

async function fetchOrder() {
  try {
    loading.value = true
    const id = route.params.id as string
    const res = await api.getOrder(id)
    order.value = res.data
  } catch (error) {
    console.error('Failed to fetch order:', error)
    appStore.showToast('获取订单信息失败', 'error')
  } finally {
    loading.value = false
  }
}

// 订单状态轮询
let pollingTimer: ReturnType<typeof setInterval> | null = null
const POLLING_INTERVAL = 3000
const ACTIVE_STATUSES = ['pending', 'confirmed']

function isOrderActive(): boolean {
  return !!order.value && ACTIVE_STATUSES.includes(order.value.status)
}

async function pollOrder() {
  if (!isOrderActive()) {
    stopPolling()
    return
  }
  try {
    const id = route.params.id as string
    const res = await api.getOrder(id)
    order.value = res.data
    // 如果状态变为非活跃，停止轮询
    if (!isOrderActive()) {
      stopPolling()
    }
  } catch (error) {
    console.error('Polling order error:', error)
  }
}

function startPolling() {
  if (pollingTimer) return
  pollingTimer = setInterval(pollOrder, POLLING_INTERVAL)
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopPolling()
  } else if (isOrderActive()) {
    pollOrder() // 先立刻拉一次
    startPolling()
  }
}

async function handleCancel() {
  if (!order.value || cancelling.value) return
  
  // 需要手机号验证身份
  if (!order.value.contact_phone) {
    appStore.showToast('订单缺少手机号信息，无法取消', 'error')
    return
  }
  
  try {
    cancelling.value = true
    await api.cancelOrder(order.value.id, order.value.contact_phone)
    appStore.showToast('订单已取消', 'success')
    fetchOrder()
  } catch (error) {
    console.error('Failed to cancel order:', error)
    appStore.showToast('取消订单失败', 'error')
  } finally {
    cancelling.value = false
  }
}

function handleAddMore() {
  cartStore.clearCart()
  tableStore.clearSelection()
  router.push('/')
}

function handleBack() {
  cartStore.clearCart()
  tableStore.clearSelection()
  router.push('/')
}

function copyOrderNo() {
  if (order.value) {
    navigator.clipboard.writeText(order.value.order_no)
    appStore.showToast('已复制订单号', 'success')
  }
}

async function generateQRCode() {
  if (order.value) {
    try {
      qrCodeDataUrl.value = await QRCode.toDataURL(order.value.order_no, {
        width: 150,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
      const canvas = document.createElement('canvas')
      JsBarcode(canvas, order.value.order_no, {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: false,
        margin: 0
      })
      barcodeDataUrl.value = canvas.toDataURL()
    } catch (error) {
      console.error('Failed to generate codes:', error)
    }
  }
}

watch(showQRModal, (newVal) => {
  if (newVal && order.value) {
    generateQRCode()
  }
})

onMounted(() => {
  fetchOrder().then(() => {
    if (isOrderActive()) {
      startPolling()
    }
  })
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <ClientLayout>
    <div class="order-detail-page">
      <!-- Header -->
      <header class="detail-header">
        <button class="back-btn" @click="handleBack">
          <ArrowLeft :size="20" />
        </button>
        <h1>订单详情</h1>
      </header>

      <!-- Content -->
      <div v-if="loading" class="loading-container">
        <div class="loading-spinner"></div>
      </div>

      <template v-else-if="order">
        <!-- Status -->
        <div class="status-section">
          <span class="status-badge" :style="{ backgroundColor: statusColor }">
            {{ statusText }}
          </span>
        </div>

        <!-- Table & Time -->
        <div class="info-card table-info-card">
          <div class="info-row">
            <Store :size="18" />
            <span>{{ order.table_name || '未指定桌位' }}</span>
          </div>
          <div class="info-row">
            <Clock :size="18" />
            <span>{{ order.dining_time }}</span>
          </div>
          <button class="qr-btn" @click="showQRModal = true">
            <QrCode :size="24" />
            <span>订单码</span>
          </button>
        </div>

        <!-- Items -->
        <div class="items-card">
          <div class="card-header">菜单</div>
          <div class="items-list">
            <div v-for="item in order.items" :key="item.id" class="item-row">
              <span class="item-name">{{ item.dish_name }}</span>
              <span v-if="item.spec" class="item-spec">({{ item.spec }})</span>
              <span class="item-qty">x{{ item.quantity }}</span>
              <span class="item-price">{{ item.subtotal }}元</span>
            </div>
          </div>
          <div class="card-total">
            <span>总计：</span>
            <span class="total-amount">{{ order.total_amount }}元</span>
          </div>
        </div>

        <!-- Contact -->
        <div class="info-card">
          <div class="card-header">联系方式</div>
          <div class="info-row">
            <Phone :size="18" />
            <span>{{ order.contact_phone }}</span>
          </div>
          <div class="info-row">
            <User :size="18" />
            <span>{{ order.contact_name }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions-section">
          <button
            v-if="canCancel"
            class="btn btn-secondary"
            :disabled="cancelling"
            @click="handleCancel"
          >
            取消订单
          </button>
          <button class="btn btn-primary" @click="handleAddMore">
            继续点菜
          </button>
        </div>
      </template>

      <!-- QR Code Modal -->
      <Modal
        :show="showQRModal"
        title="订单码"
        size="sm"
        @close="showQRModal = false"
      >
        <div class="qr-content" v-if="order">
          <div class="qr-placeholder">
            <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="订单二维码" class="qr-image" />
            <div v-else class="qr-loading">
              <div class="loading-spinner"></div>
            </div>
          </div>
          <div class="barcode-container" v-if="barcodeDataUrl">
            <img :src="barcodeDataUrl" alt="订单条形码" class="barcode-image" />
          </div>
          <div class="order-no" @click="copyOrderNo">
            <span>订单号：{{ order.order_no }}</span>
            <span class="copy-hint">点击复制</span>
          </div>
        </div>
      </Modal>
    </div>
  </ClientLayout>
</template>

<style scoped>
.order-detail-page {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  padding-bottom: 80px;
}

.detail-header {
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

.detail-header h1 {
  font-size: 1.125rem;
  font-weight: 600;
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

.status-section {
  display: flex;
  justify-content: center;
  padding: var(--spacing-xl);
}

.status-badge {
  padding: var(--spacing-md) var(--spacing-xl);
  border-radius: var(--radius-lg);
  color: white;
  font-weight: 600;
  font-size: 1.125rem;
}

.info-card {
  background-color: var(--color-bg-secondary);
  margin: var(--spacing-md);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
}

.card-header {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-light);
}

.info-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) 0;
  font-size: 0.875rem;
}

.info-row svg {
  color: var(--color-text-muted);
}

.table-info-card {
  position: relative;
}

.qr-btn {
  position: absolute;
  right: var(--spacing-md);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-lg);
  color: var(--color-primary);
  background-color: var(--color-bg-tertiary);
  transition: all var(--transition-fast);
}

.qr-btn span {
  font-size: 0.75rem;
  font-weight: 500;
}

.qr-btn:hover {
  background-color: var(--color-primary);
  color: white;
}

.items-card {
  background-color: var(--color-bg-secondary);
  margin: var(--spacing-md);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.item-row {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
}

.item-name {
  flex: 1;
}

.item-spec {
  color: var(--color-text-muted);
  margin-right: var(--spacing-sm);
}

.item-qty {
  color: var(--color-text-muted);
  margin-right: var(--spacing-md);
}

.item-price {
  color: var(--color-primary);
}

.card-total {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-md);
  margin-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-light);
  font-size: 0.875rem;
}

.total-amount {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-primary);
}

.actions-section {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
}

.actions-section .btn {
  flex: 1;
  padding: var(--spacing-md);
}

.qr-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
}

.qr-placeholder {
  padding: var(--spacing-lg);
}

.qr-image {
  width: 150px;
  height: 150px;
  border-radius: var(--radius-md);
}

.qr-loading {
  width: 150px;
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
}

.barcode-container {
  padding: var(--spacing-sm) 0;
}

.barcode-image {
  height: 50px;
}

.order-no {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.order-no span:first-child {
  font-weight: 500;
}

.copy-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
