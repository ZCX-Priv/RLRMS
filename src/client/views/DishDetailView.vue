<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '@/api'
import { useCartStore } from '@/stores/cart'
import { useAppStore } from '@/stores/app'
import type { Dish } from '@/types'
import ClientLayout from '@/client/components/ClientLayout.vue'
import QuantityControl from '@/shared/components/QuantityControl.vue'

const Modal = defineAsyncComponent(() => import('@/shared/components/Modal.vue'))
import { ArrowLeft, Plus, Minus, ShoppingCart } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const cartStore = useCartStore()
const appStore = useAppStore()

const dish = ref<Dish | null>(null)
const loading = ref(true)
const showSpecModal = ref(false)
const selectedSpec = ref<string | null>(null)
const modalQuantity = ref(1)

const hasSpecs = computed(() => dish.value?.specs && dish.value.specs.length > 0)

const quantityInCart = computed(() => {
  if (!dish.value) return 0
  if (hasSpecs.value) {
    return cartStore.items
      .filter(item => item.dish.id === dish.value!.id)
      .reduce((sum, item) => sum + item.quantity, 0)
  }
  const item = cartStore.items.find(item => item.dish.id === dish.value!.id && item.spec === null)
  return item ? item.quantity : 0
})

async function fetchDish() {
  try {
    loading.value = true
    const id = route.params.id as string
    const res = await api.getDish(id)
    dish.value = res.data
  } catch (error) {
    console.error('Failed to fetch dish:', error)
    appStore.showToast('获取菜品信息失败', 'error')
  } finally {
    loading.value = false
  }
}

function handleAddToCart() {
  if (!dish.value) return
  if (hasSpecs.value && dish.value.specs[0]) {
    selectedSpec.value = dish.value.specs[0]
    modalQuantity.value = 1
    showSpecModal.value = true
  } else {
    cartStore.addItem(dish.value, 1)
    appStore.showToast('已加入购物车', 'success')
  }
}

function handleSpecConfirm() {
  if (dish.value) {
    cartStore.addItem(dish.value, modalQuantity.value, selectedSpec.value)
    appStore.showToast('已加入购物车', 'success')
    showSpecModal.value = false
  }
}

function handleUpdateQuantity(quantity: number) {
  const currentDish = dish.value
  if (!currentDish) return
  if (hasSpecs.value) {
    const totalQuantity = cartStore.items
      .filter(item => item.dish.id === currentDish.id)
      .reduce((sum, item) => sum + item.quantity, 0)
    if (quantity > totalQuantity && currentDish.specs?.[0]) {
      selectedSpec.value = currentDish.specs[0]
      modalQuantity.value = 1
      showSpecModal.value = true
    } else if (quantity === 0) {
      cartStore.items
        .filter(item => item.dish.id === currentDish.id)
        .forEach(item => cartStore.removeItem(currentDish.id, item.spec))
    }
  } else {
    cartStore.updateQuantity(currentDish.id, quantity)
  }
}

onMounted(() => {
  fetchDish()
})
</script>

<template>
  <ClientLayout>
    <div class="dish-detail-page">
      <!-- Header -->
      <header class="detail-header">
        <button class="back-btn" @click="router.back()">
          <ArrowLeft :size="20" />
        </button>
        <h1>菜品详情</h1>
      </header>

      <!-- Content -->
      <div v-if="loading" class="loading-container">
        <div class="loading-spinner"></div>
      </div>
      
      <template v-else-if="dish">
        <!-- Image -->
        <div class="dish-image">
          <img v-if="dish.image_url" :src="dish.image_url" :alt="dish.name" />
          <div v-else class="image-placeholder">
            <span>{{ dish.name.charAt(0) }}</span>
          </div>
        </div>

        <!-- Info -->
        <div class="dish-content">
          <div class="dish-header">
            <h2 class="dish-name">{{ dish.name }}</h2>
            <div class="dish-tags" v-if="dish.tags?.length">
              <span v-for="tag in dish.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>

          <div class="dish-price">{{ dish.price }}元</div>

          <div class="dish-description" v-if="dish.description">
            <h3>简介</h3>
            <p>{{ dish.description }}</p>
          </div>
        </div>

        <!-- Bottom Action -->
        <div class="bottom-action">
          <template v-if="quantityInCart === 0">
            <button class="btn btn-primary action-btn" @click="handleAddToCart">
              <ShoppingCart :size="20" />
              <span>{{ hasSpecs ? '选规格' : '加入购物车' }}</span>
            </button>
          </template>
          <template v-else>
            <div class="full-width-quantity">
              <button class="quantity-btn-full" @click="handleUpdateQuantity(quantityInCart - 1)">
                <Minus :size="20" />
              </button>
              <span class="quantity-display">{{ quantityInCart }}</span>
              <button class="quantity-btn-full" @click="handleUpdateQuantity(quantityInCart + 1)">
                <Plus :size="20" />
              </button>
            </div>
          </template>
        </div>
      </template>

      <!-- Spec Modal -->
      <Modal
        v-if="dish"
        :show="showSpecModal"
        title="选择规格"
        size="md"
        @close="showSpecModal = false"
      >
        <div class="spec-content">
          <div class="spec-section">
            <h4>规格</h4>
            <div class="spec-options">
              <button
                v-for="spec in dish.specs"
                :key="spec"
                class="spec-option"
                :class="{ 'spec-option-active': selectedSpec === spec }"
                @click="selectedSpec = spec"
              >
                {{ spec }}
              </button>
            </div>
          </div>

          <div class="spec-section">
            <h4>数量</h4>
            <QuantityControl v-model="modalQuantity" />
          </div>
        </div>

        <template #footer>
          <button class="btn btn-secondary" @click="showSpecModal = false">取消</button>
          <button class="btn btn-primary" @click="handleSpecConfirm">
            加入购物车
          </button>
        </template>
      </Modal>
    </div>
  </ClientLayout>
</template>

<style scoped>
.dish-detail-page {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
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

.dish-image {
  width: 100%;
  aspect-ratio: 1;
  max-height: 300px;
  overflow: hidden;
}

.dish-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary));
  color: white;
  font-size: 4rem;
  font-weight: 700;
}

.dish-content {
  padding: var(--spacing-lg);
  padding-bottom: 100px;
}

.dish-header {
  margin-bottom: var(--spacing-md);
}

.dish-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.dish-tags {
  display: flex;
  gap: var(--spacing-xs);
}

.tag {
  padding: 2px var(--spacing-sm);
  font-size: 0.75rem;
  background-color: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
}

.dish-price {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: var(--spacing-lg);
}

.dish-description h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.dish-description p {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.bottom-action {
  position: fixed;
  bottom: 60px;
  left: 0;
  right: 0;
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-light);
}

.action-btn {
  width: 100%;
  padding: var(--spacing-md);
  font-size: 1rem;
}

.full-width-quantity {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--spacing-sm);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
}

.quantity-btn-full {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.quantity-btn-full:hover {
  background-color: var(--color-primary);
  color: white;
  transform: scale(1.05);
}

.quantity-btn-full:active {
  transform: scale(0.95);
}

.quantity-display {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  min-width: 60px;
  text-align: center;
}

.spec-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.spec-section h4 {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.spec-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.spec-option {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.spec-option:hover {
  border-color: var(--color-primary);
}

.spec-option-active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}
</style>
