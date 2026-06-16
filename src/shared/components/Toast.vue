<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { CheckCircle, XCircle, Info } from 'lucide-vue-next'

const appStore = useAppStore()

const iconComponent = computed(() => {
  switch (appStore.toast.type) {
    case 'success':
      return CheckCircle
    case 'error':
      return XCircle
    default:
      return Info
  }
})

const iconColor = computed(() => {
  switch (appStore.toast.type) {
    case 'success':
      return 'var(--color-success)'
    case 'error':
      return 'var(--color-error)'
    default:
      return 'var(--color-info)'
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="appStore.toast.show" class="toast-container">
        <div class="toast" :class="`toast-${appStore.toast.type}`">
          <component :is="iconComponent" :size="20" :color="iconColor" />
          <span class="toast-message">{{ appStore.toast.message }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  will-change: transform, opacity;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border-light);
  min-width: 200px;
  max-width: 400px;
}

.toast-message {
  font-size: 0.875rem;
  color: var(--color-text-primary);
}

.toast-enter-active {
  -webkit-animation: toastEnter var(--duration-normal) var(--ease-bounce);
  animation: toastEnter var(--duration-normal) var(--ease-bounce);
}

.toast-leave-active {
  -webkit-animation: toastLeave var(--duration-fast) var(--ease-in);
  animation: toastLeave var(--duration-fast) var(--ease-in);
}

@-webkit-keyframes toastEnter {
  0% {
    opacity: 0;
    -webkit-transform: translateX(-50%) translateY(-30px) scale(0.9);
    transform: translateX(-50%) translateY(-30px) scale(0.9);
  }
  100% {
    opacity: 1;
    -webkit-transform: translateX(-50%) translateY(0) scale(1);
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes toastEnter {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-30px) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@-webkit-keyframes toastLeave {
  0% {
    opacity: 1;
    -webkit-transform: translateX(-50%) translateY(0) scale(1);
    transform: translateX(-50%) translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    -webkit-transform: translateX(-50%) translateY(-20px) scale(0.95);
    transform: translateX(-50%) translateY(-20px) scale(0.95);
  }
}

@keyframes toastLeave {
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
