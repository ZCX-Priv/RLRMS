<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Home, ArrowLeft, AlertTriangle } from 'lucide-vue-next'

const router = useRouter()

function goDashboard() {
  router.push('/admin')
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="admin-not-found">
    <div class="not-found-card">
      <div class="error-icon">
        <AlertTriangle :size="48" />
      </div>
      <div class="error-code">404</div>
      <h1 class="error-title">页面未找到</h1>
      <p class="error-message">您访问的管理页面不存在或已被移除</p>
      <div class="error-actions">
        <button class="btn btn-primary" @click="goDashboard">
          <Home :size="18" />
          返回控制台
        </button>
        <button class="btn btn-secondary" @click="goBack">
          <ArrowLeft :size="18" />
          返回上页
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 120px);
  padding: var(--spacing-lg);
}

.not-found-card {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-2xl);
  text-align: center;
  max-width: 400px;
  width: 100%;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border-light);
}

.error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background-color: rgba(220, 38, 38, 0.1);
  border-radius: 50%;
  color: var(--color-primary);
  margin-bottom: var(--spacing-lg);
  animation: iconPulse 2s ease-in-out infinite;
}

@keyframes iconPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

.error-code {
  font-family: var(--font-heading);
  font-size: 3rem;
  font-weight: 900;
  color: var(--color-primary);
  line-height: 1;
  margin-bottom: var(--spacing-sm);
}

.error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.error-message {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xl);
}

.error-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 480px) {
  .not-found-card {
    padding: var(--spacing-lg);
  }
  
  .error-code {
    font-size: 2.5rem;
  }
  
  .error-actions {
    flex-direction: column;
  }
  
  .error-actions .btn {
    width: 100%;
  }
}
</style>
