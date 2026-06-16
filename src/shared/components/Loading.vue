<script setup lang="ts">
interface Props {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

withDefaults(defineProps<Props>(), {
  size: 'md',
  text: '加载中...',
})
</script>

<template>
  <div class="loading" :class="`loading-${size}`">
    <div class="loading-spinner">
      <div class="spinner-ring"></div>
    </div>
    <span v-if="text" class="loading-text">{{ text }}</span>
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
}

.loading-sm {
  padding: var(--spacing-sm);
}

.loading-md {
  padding: var(--spacing-lg);
}

.loading-lg {
  padding: var(--spacing-xl);
}

.loading-spinner {
  position: relative;
}

.spinner-ring {
  border-radius: 50%;
  border: 3px solid var(--color-border-light);
  border-top-color: var(--color-primary);
  animation: spin 0.8s linear infinite;
}

.loading-sm .spinner-ring {
  width: 20px;
  height: 20px;
}

.loading-md .spinner-ring {
  width: 32px;
  height: 32px;
}

.loading-lg .spinner-ring {
  width: 48px;
  height: 48px;
}

.loading-text {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
