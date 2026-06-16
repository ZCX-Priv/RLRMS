<script setup lang="ts">
import { watch } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'

interface Props {
  show: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'primary'
}

const props = withDefaults(defineProps<Props>(), {
  title: '确认操作',
  confirmText: '确定',
  cancelText: '取消',
  type: 'danger',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
  'update:show': [value: boolean]
}>()

watch(() => props.show, (show) => {
  if (show) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('cancel')
  emit('update:show', false)
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    handleCancel()
  }
}

const typeClass = {
  danger: 'btn-danger',
  warning: 'btn-warning',
  primary: 'btn-primary',
}[props.type]
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="show" class="confirm-backdrop" @click="handleBackdropClick">
        <div class="confirm-dialog">
          <div class="confirm-icon" :class="`confirm-icon-${type}`">
            <AlertTriangle :size="24" />
          </div>
          <h3 class="confirm-title">{{ title }}</h3>
          <p class="confirm-message">{{ message }}</p>
          <div class="confirm-actions">
            <button class="btn btn-secondary" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button class="btn" :class="typeClass" @click="handleConfirm">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal-backdrop);
  padding: var(--spacing-md);
}

.confirm-dialog {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 320px;
  padding: var(--spacing-xl);
  text-align: center;
}

.confirm-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--spacing-md);
}

.confirm-icon-danger {
  background-color: rgba(220, 38, 38, 0.1);
  color: var(--color-error);
}

.confirm-icon-warning {
  background-color: rgba(202, 138, 4, 0.1);
  color: var(--color-warning);
}

.confirm-icon-primary {
  background-color: rgba(220, 38, 38, 0.1);
  color: var(--color-primary);
}

.confirm-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.confirm-message {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.confirm-actions .btn {
  flex: 1;
}

.btn-warning {
  background-color: var(--color-warning);
  color: white;
}

.btn-warning:hover {
  background-color: var(--color-warning-dark, #b45309);
}

.confirm-enter-active {
  -webkit-transition: opacity var(--duration-normal) var(--ease-out);
  transition: opacity var(--duration-normal) var(--ease-out);
}

.confirm-leave-active {
  -webkit-transition: opacity var(--duration-fast) var(--ease-in);
  transition: opacity var(--duration-fast) var(--ease-in);
}

.confirm-enter-active .confirm-dialog {
  -webkit-transition: all var(--duration-slow) var(--ease-bounce);
  transition: all var(--duration-slow) var(--ease-bounce);
}

.confirm-leave-active .confirm-dialog {
  -webkit-transition: all var(--duration-normal) var(--ease-out);
  transition: all var(--duration-normal) var(--ease-out);
}

.confirm-enter-from {
  opacity: 0;
}

.confirm-enter-from .confirm-dialog {
  opacity: 0;
  -webkit-transform: translateY(30px) scale(0.95);
  transform: translateY(30px) scale(0.95);
}

.confirm-enter-to .confirm-dialog {
  opacity: 1;
  -webkit-transform: translateY(0) scale(1);
  transform: translateY(0) scale(1);
}

.confirm-leave-to {
  opacity: 0;
}

.confirm-leave-to .confirm-dialog {
  opacity: 0;
  -webkit-transform: translateY(20px) scale(0.98);
  transform: translateY(20px) scale(0.98);
}
</style>
