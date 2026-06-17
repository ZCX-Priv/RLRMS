<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue'
import type { Dish } from '@/types'
import { useCartStore } from '@/stores/cart'
import QuantityControl from '@/shared/components/QuantityControl.vue'

const Modal = defineAsyncComponent(() => import('@/shared/components/Modal.vue'))

interface Props {
  dish: Dish
}

const props = defineProps<Props>()

// 图片加载状态
const imageLoaded = ref(false)
const imageError = ref(false)

function handleImageLoad() {
  imageLoaded.value = true
}

function handleImageError() {
  imageError.value = true
  imageLoaded.value = true
}
const emit = defineEmits<{
  click: []
}>()

const cartStore = useCartStore()
const showSpecModal = ref(false)
const selectedSpec = ref<string>('')
const modalQuantity = ref(1)

const hasSpecs = computed(() => props.dish.specs && props.dish.specs.length > 0)

const quantityInCart = computed(() => {
  if (hasSpecs.value) {
    return cartStore.items
      .filter(item => item.dish.id === props.dish.id)
      .reduce((sum, item) => sum + item.quantity, 0)
  }
  const item = cartStore.items.find(item => item.dish.id === props.dish.id && item.spec === null)
  return item ? item.quantity : 0
})

function handleAddToCart(e: Event) {
  e.stopPropagation()
  if (hasSpecs.value && props.dish.specs[0]) {
    selectedSpec.value = props.dish.specs[0]
    modalQuantity.value = 1
    showSpecModal.value = true
  } else {
    cartStore.addItem(props.dish)
  }
}

function handleSpecConfirm() {
  cartStore.addItem(props.dish, modalQuantity.value, selectedSpec.value)
  showSpecModal.value = false
}

function handleUpdateQuantity(quantity: number) {
  if (hasSpecs.value) {
    const totalQuantity = cartStore.items
      .filter(item => item.dish.id === props.dish.id)
      .reduce((sum, item) => sum + item.quantity, 0)
    if (quantity > totalQuantity && props.dish.specs?.[0]) {
      selectedSpec.value = props.dish.specs[0]
      modalQuantity.value = 1
      showSpecModal.value = true
    } else if (quantity === 0) {
      cartStore.items
        .filter(item => item.dish.id === props.dish.id)
        .forEach(item => cartStore.removeItem(props.dish.id, item.spec))
    } else {
      cartStore.updateQuantity(props.dish.id, quantity)
    }
  } else {
    cartStore.updateQuantity(props.dish.id, quantity)
  }
}
</script>

<template>
  <div class="dish-card card card-hover" @click="emit('click')">
    <div class="dish-image">
      <!-- 图片加载占位符 -->
      <div v-if="dish.image_url && !imageLoaded" class="dish-image-loading">
        <span class="loading-spinner"></span>
      </div>
      <!-- 图片加载错误占位符 -->
      <div v-if="dish.image_url && imageError" class="dish-image-error">
        <span>{{ dish.name.charAt(0) }}</span>
      </div>
      <!-- 实际图片 -->
      <img
        v-if="dish.image_url"
        class="dish-image-img"
        :class="{ 'dish-image-loaded': imageLoaded && !imageError }"
        :src="dish.image_url"
        :alt="dish.name"
        loading="lazy"
        decoding="async"
        @load="handleImageLoad"
        @error="handleImageError"
      />
      <!-- 无图片时的占位符 -->
      <div v-if="!dish.image_url" class="dish-image-placeholder">
        <span>{{ dish.name.charAt(0) }}</span>
      </div>
      <div v-if="dish.tags?.length" class="dish-tags">
        <span v-for="tag in dish.tags.slice(0, 2)" :key="tag" class="dish-tag">
          {{ tag }}
        </span>
      </div>
    </div>
    <div class="dish-info">
      <h3 class="dish-name">{{ dish.name }}</h3>
      <div class="dish-price-row">
        <span class="dish-price">{{ dish.price }}元</span>
        <div class="quantity-wrapper" @click.stop>
          <div v-if="quantityInCart === 0" class="add-btn" @click="handleAddToCart">
            {{ hasSpecs ? '选规格' : '+' }}
          </div>
          <QuantityControl
            v-else
            :model-value="quantityInCart"
            size="sm"
            @update:model-value="handleUpdateQuantity"
          />
        </div>
      </div>
    </div>

    <!-- Spec Modal -->
    <Modal
      :show="showSpecModal"
      title="选择规格"
      size="sm"
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
          <QuantityControl v-model="modalQuantity" :min="1" />
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
</template>

<style scoped>
.dish-card {
  cursor: pointer;
  overflow: hidden;
}

.dish-image {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}

.dish-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dish-image-img {
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out), transform var(--duration-normal) var(--ease-out);
}

.dish-image-loaded {
  opacity: 1;
}

.dish-card:hover .dish-image img {
  transform: scale(1.05);
}

.dish-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary));
  color: white;
  font-size: 2rem;
  font-weight: 700;
}

.dish-image-loading {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-background-secondary, #f5f5f5);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border, #e0e0e0);
  border-top-color: var(--color-primary, #c62828);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.dish-image-error {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e0e0e0, #bdbdbd);
  color: #757575;
  font-size: 2rem;
  font-weight: 700;
}

.dish-tags {
  position: absolute;
  bottom: var(--spacing-xs);
  right: var(--spacing-xs);
  display: flex;
  gap: var(--spacing-xs);
}

.dish-tag {
  padding: 2px var(--spacing-xs);
  font-size: 0.625rem;
  background-color: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
}

.dish-info {
  padding: var(--spacing-sm);
}

.dish-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dish-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dish-price {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-primary);
}

.add-btn {
  padding: 2px 8px;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary);
  color: white;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.add-btn:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
