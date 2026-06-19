<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import { CheckCircle, XCircle, Info } from 'lucide-vue-next'
import type { Component } from 'vue'

const appStore = useAppStore()

// 根据类型返回对应图标组件
function getIcon(type: 'success' | 'error' | 'info'): Component {
  switch (type) {
    case 'success':
      return CheckCircle
    case 'error':
      return XCircle
    default:
      return Info
  }
}

// 根据类型返回对应图标颜色
function getIconColor(type: 'success' | 'error' | 'info'): string {
  switch (type) {
    case 'success':
      return 'var(--color-success)'
    case 'error':
      return 'var(--color-error)'
    default:
      return 'var(--color-info)'
  }
}
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-stack">
      <div v-for="item in appStore.toasts" :key="item.id" class="toast" :class="`toast-${item.type}`">
        <component :is="getIcon(item.type)" :size="20" :color="getIconColor(item.type)" />
        <span class="toast-message">{{ item.message }}</span>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  top: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
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

.toast-move {
  transition: transform var(--duration-normal) var(--ease-bounce);
}

@-webkit-keyframes toastEnter {
  0% {
    opacity: 0;
    -webkit-transform: translateY(-30px) scale(0.9);
    transform: translateY(-30px) scale(0.9);
  }
  100% {
    opacity: 1;
    -webkit-transform: translateY(0) scale(1);
    transform: translateY(0) scale(1);
  }
}

@keyframes toastEnter {
  0% {
    opacity: 0;
    transform: translateY(-30px) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@-webkit-keyframes toastLeave {
  0% {
    opacity: 1;
    -webkit-transform: translateY(0) scale(1);
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    -webkit-transform: translateY(-20px) scale(0.95);
    transform: translateY(-20px) scale(0.95);
  }
}

@keyframes toastLeave {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
}
</style>
