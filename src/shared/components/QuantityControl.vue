<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'

interface Props {
  modelValue: number
  min?: number
  max?: number
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 99,
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const canDecrement = computed(() => props.modelValue > props.min)
const canIncrement = computed(() => props.modelValue < props.max)
const animateValue = ref(false)

watch(() => props.modelValue, () => {
  animateValue.value = true
  setTimeout(() => {
    animateValue.value = false
  }, 150)
})

function decrement(e: MouseEvent) {
  if (canDecrement.value) {
    createRipple(e)
    emit('update:modelValue', props.modelValue - 1)
  }
}

function increment(e: MouseEvent) {
  if (canIncrement.value) {
    createRipple(e)
    emit('update:modelValue', props.modelValue + 1)
  }
}

function createRipple(e: MouseEvent) {
  const button = e.currentTarget as HTMLElement
  const ripple = document.createElement('span')
  const rect = button.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const x = e.clientX - rect.left - size / 2
  const y = e.clientY - rect.top - size / 2
  
  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${x}px`
  ripple.style.top = `${y}px`
  ripple.classList.add('ripple-effect')
  
  button.appendChild(ripple)
  
  setTimeout(() => ripple.remove(), 600)
}
</script>

<template>
  <div class="quantity-control" :class="`quantity-${size}`">
    <button
      class="quantity-btn"
      :class="{ 'quantity-btn-disabled': !canDecrement }"
      @click="decrement"
      :disabled="!canDecrement"
    >
      <Minus :size="size === 'sm' ? 14 : 16" />
    </button>
    <span class="quantity-value" :class="{ 'quantity-value-animate': animateValue }">
      {{ modelValue }}
    </span>
    <button
      class="quantity-btn"
      :class="{ 'quantity-btn-disabled': !canIncrement }"
      @click="increment"
      :disabled="!canIncrement"
    >
      <Plus :size="size === 'sm' ? 14 : 16" />
    </button>
  </div>
</template>

<style scoped>
.quantity-control {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  padding: 2px;
}

.quantity-sm {
  font-size: 0.75rem;
}

.quantity-md {
  font-size: 0.875rem;
}

.quantity-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
  transition: all var(--duration-fast) var(--ease-out);
  position: relative;
  overflow: hidden;
}

.quantity-btn:hover:not(:disabled) {
  background-color: var(--color-primary);
  color: white;
  transform: scale(1.1);
}

.quantity-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.ripple-effect {
  position: absolute;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.4);
  -webkit-transform: scale(0);
  transform: scale(0);
  -webkit-animation: ripple var(--duration-slow) var(--ease-out);
  animation: ripple var(--duration-slow) var(--ease-out);
  pointer-events: none;
}

@-webkit-keyframes ripple {
  to {
    -webkit-transform: scale(4);
    transform: scale(4);
    opacity: 0;
  }
}

@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

.quantity-btn-disabled {
  opacity: 0.4;
}

.quantity-value {
  min-width: 24px;
  text-align: center;
  font-weight: 500;
  -webkit-transition: transform var(--duration-fast) var(--ease-bounce);
  transition: transform var(--duration-fast) var(--ease-bounce);
}

/* 数字弹跳动画 */
.quantity-value-animate {
  -webkit-animation: numberBounce var(--duration-fast) var(--ease-bounce);
  animation: numberBounce var(--duration-fast) var(--ease-bounce);
}

@-webkit-keyframes numberBounce {
  0% {
    -webkit-transform: scale(1);
    transform: scale(1);
  }
  50% {
    -webkit-transform: scale(1.3);
    transform: scale(1.3);
  }
  100% {
    -webkit-transform: scale(1);
    transform: scale(1);
  }
}

@keyframes numberBounce {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}

.quantity-sm .quantity-btn {
  width: 20px;
  height: 20px;
}

.quantity-sm .quantity-value {
  min-width: 20px;
}
</style>
