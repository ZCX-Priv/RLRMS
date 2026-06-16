<script setup lang="ts">
import { useCartStore } from '@/stores/cart'
import { X, Trash2 } from 'lucide-vue-next'
import QuantityControl from '@/shared/components/QuantityControl.vue'

const show = defineModel<boolean>('show')
const cartStore = useCartStore()

const emit = defineEmits<{
  confirm: []
}>()

function handleClose() {
  show.value = false
}

function handleConfirm() {
  handleClose()
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="show" class="drawer" @click.stop>
        <div class="drawer-header">
          <h3>购物车</h3>
          <button class="close-btn" @click="handleClose">
            <X :size="20" />
          </button>
        </div>
        
        <div class="drawer-body">
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
                <span class="item-price">{{ item.dish.price }}元</span>
                <QuantityControl
                  :model-value="item.quantity"
                  size="sm"
                  @update:model-value="(q) => cartStore.updateQuantity(item.dish.id, q, item.spec)"
                />
                <button class="remove-btn" @click="cartStore.removeItem(item.dish.id, item.spec)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="cartStore.items.length > 0" class="drawer-footer">
          <div class="cart-total">
            <span>合计：</span>
            <span class="total-amount">{{ cartStore.totalAmount.toFixed(2) }}元</span>
          </div>
          <div class="cart-actions">
            <button class="btn btn-secondary" @click="cartStore.clearCart">
              清空
            </button>
            <button class="btn btn-primary" @click="handleConfirm">
              确认订单
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer {
  position: fixed;
  bottom: 140px;
  left: var(--spacing-md);
  right: var(--spacing-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  max-height: 50vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  z-index: var(--z-modal-backdrop);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border-light);
}

.drawer-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.empty-cart {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.cart-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.cart-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-name {
  font-size: 0.875rem;
  font-weight: 500;
}

.item-spec {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.item-actions {
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

.drawer-footer {
  padding: var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
}

.cart-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.total-amount {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-primary);
}

.cart-actions {
  display: flex;
  gap: var(--spacing-md);
}

.cart-actions .btn {
  flex: 1;
}

/* Transitions */
.drawer-enter-active {
  -webkit-animation: drawerSlideIn var(--duration-normal) var(--ease-bounce);
  animation: drawerSlideIn var(--duration-normal) var(--ease-bounce);
}

.drawer-leave-active {
  -webkit-animation: drawerSlideOut var(--duration-fast) var(--ease-in);
  animation: drawerSlideOut var(--duration-fast) var(--ease-in);
}

@-webkit-keyframes drawerSlideIn {
  0% {
    -webkit-transform: translateY(30px);
    transform: translateY(30px);
    opacity: 0;
  }
  100% {
    -webkit-transform: translateY(0);
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes drawerSlideIn {
  0% {
    transform: translateY(30px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

@-webkit-keyframes drawerSlideOut {
  0% {
    -webkit-transform: translateY(0);
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    -webkit-transform: translateY(20px);
    transform: translateY(20px);
    opacity: 0;
  }
}

@keyframes drawerSlideOut {
  0% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(20px);
    opacity: 0;
  }
}

/* Cart item animation */
.cart-item {
  -webkit-animation: itemFadeIn var(--duration-fast) var(--ease-out);
  animation: itemFadeIn var(--duration-fast) var(--ease-out);
}

@-webkit-keyframes itemFadeIn {
  from {
    opacity: 0;
    -webkit-transform: translateX(-10px);
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    -webkit-transform: translateX(0);
    transform: translateX(0);
  }
}

@keyframes itemFadeIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
