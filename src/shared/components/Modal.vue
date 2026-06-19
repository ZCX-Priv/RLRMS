<script setup lang="ts">
import { watch } from 'vue'
import { X } from 'lucide-vue-next'

interface Props {
  show: boolean
  title?: string
  closable?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  closable: true,
  size: 'md',
})

const emit = defineEmits<{
  close: []
}>()

// Prevent body scroll when modal is open
watch(() => props.show, (show) => {
  if (show) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-backdrop" @click.stop>
        <div class="modal" :class="`modal-${size}`">
          <div v-if="title || closable" class="modal-header">
            <h3 v-if="title" class="modal-title">{{ title }}</h3>
            <button v-if="closable" class="modal-close" @click="handleClose">
              <X :size="20" />
            </button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal-backdrop);
  padding: var(--spacing-md);
}

.modal {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-sm {
  width: 100%;
  max-width: 480px;
}

.modal-md {
  width: 100%;
  max-width: 640px;
}

.modal-lg {
  width: 100%;
  max-width: 800px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border-light);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.modal-close:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.modal-body {
  padding: var(--spacing-lg);
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
}

/* 背景遮罩动画 */
.modal-enter-active {
  -webkit-transition: opacity var(--duration-normal) var(--ease-out);
  transition: opacity var(--duration-normal) var(--ease-out);
}

.modal-leave-active {
  -webkit-transition: opacity var(--duration-fast) var(--ease-in);
  transition: opacity var(--duration-fast) var(--ease-in);
}

/* 内容容器动画 - 使用弹性缓动 */
.modal-enter-active .modal {
  -webkit-transition: all var(--duration-slow) var(--ease-bounce);
  transition: all var(--duration-slow) var(--ease-bounce);
}

.modal-leave-active .modal {
  -webkit-transition: all var(--duration-normal) var(--ease-out);
  transition: all var(--duration-normal) var(--ease-out);
}

/* 进入状态：背景淡入 + 内容从下方滑入 */
.modal-enter-from {
  opacity: 0;
}

.modal-enter-from .modal {
  opacity: 0;
  -webkit-transform: translateY(30px) scale(0.95);
  transform: translateY(30px) scale(0.95);
}

/* 进入完成状态 */
.modal-enter-to .modal {
  opacity: 1;
  -webkit-transform: translateY(0) scale(1);
  transform: translateY(0) scale(1);
}

/* 离开状态：背景淡出 + 内容向下滑出 */
.modal-leave-to {
  opacity: 0;
}

.modal-leave-to .modal {
  opacity: 0;
  -webkit-transform: translateY(20px) scale(0.98);
  transform: translateY(20px) scale(0.98);
}
</style>
