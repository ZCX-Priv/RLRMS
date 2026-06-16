<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import { useAppStore } from '@/stores/app'
import { useClientAuthStore } from '@/stores/clientAuth'
import type { Order } from '@/types'
import ClientLayout from '@/client/components/ClientLayout.vue'
import { ChevronRight } from 'lucide-vue-next'

const router = useRouter()
const appStore = useAppStore()
const clientAuthStore = useClientAuthStore()

const orders = ref<Order[]>([])
const loading = ref(true)
const initialized = ref(false)

const statusText: Record<string, string> = {
  pending: '等待商家确认',
  confirmed: '已确认',
  preparing: '制作中',
  ready: '已就绪',
  completed: '已完成',
  cancelled: '已取消',
}

const statusColor: Record<string, string> = {
  pending: 'var(--color-warning)',
  confirmed: 'var(--color-info)',
  preparing: 'var(--color-info)',
  ready: 'var(--color-success)',
  completed: 'var(--color-success)',
  cancelled: 'var(--color-error)',
}

async function fetchOrders() {
  try {
    if (!initialized.value) {
      loading.value = true
    }
    const phone = clientAuthStore.user?.phone || undefined
    const res = await api.getOrders(phone)
    orders.value = res.data
    initialized.value = true
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    appStore.showToast('获取订单列表失败', 'error')
  } finally {
    loading.value = false
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

onMounted(() => {
  fetchOrders()
})
</script>

<template>
  <ClientLayout>
    <div class="orders-page">
      <!-- Header -->
      <header class="page-header">
        <h1>全部订单</h1>
      </header>

      <!-- Content -->
      <div class="page-content">
        <div v-if="loading && !initialized" class="loading-container">
          <div class="loading-spinner"></div>
        </div>

        <div v-else-if="initialized && orders.length === 0" class="empty-state">
          暂无订单
        </div>

        <div v-else-if="initialized" class="orders-list">
          <div
            v-for="order in orders"
            :key="order.id"
            class="order-item card"
            @click="router.push(`/order/${order.id}`)"
          >
            <div class="order-main">
              <div class="order-info">
                <span class="table-name">{{ order.table_name || '未指定桌位' }}</span>
                <span class="order-time">创建时间：{{ formatDate(order.created_at) }}</span>
              </div>
              <span class="order-status" :style="{ color: statusColor[order.status] }">
                {{ statusText[order.status] }}
              </span>
            </div>
            <div class="order-footer">
              <span class="order-amount">{{ order.total_amount }}元</span>
              <ChevronRight :size="16" class="order-arrow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </ClientLayout>
</template>

<style scoped>
.orders-page {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-bg-secondary);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
}

.page-header h1 {
  font-size: 1.125rem;
  font-weight: 600;
}

.page-content {
  padding: var(--spacing-md);
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

.orders-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.order-item {
  cursor: pointer;
  padding: var(--spacing-md);
}

.order-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.order-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.table-name {
  font-weight: 500;
}

.order-time {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.order-status {
  font-size: 0.875rem;
  font-weight: 500;
}

.order-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-light);
}

.order-amount {
  font-weight: 600;
  color: var(--color-primary);
}

.order-arrow {
  color: var(--color-text-muted);
}
</style>
