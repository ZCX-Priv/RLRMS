<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Home, ArrowLeft } from 'lucide-vue-next'
import ClientLayout from '@/client/components/ClientLayout.vue'

const router = useRouter()

function goHome() {
  router.push('/')
}

function goBack() {
  router.back()
}
</script>

<template>
  <ClientLayout>
    <div class="client-not-found">
      <div class="not-found-content">
        <div class="error-code">404</div>
        <h1 class="error-title">页面未找到</h1>
        <p class="error-message">抱歉，您访问的页面不存在</p>
        <div class="error-actions">
          <button class="btn btn-primary" @click="goHome">
            <Home :size="18" />
            返回首页
          </button>
          <button class="btn btn-secondary" @click="goBack">
            <ArrowLeft :size="18" />
            返回上页
          </button>
        </div>
      </div>
      <div class="lantern-decoration">
        <div class="lantern">
          <div class="lantern-top"></div>
          <div class="lantern-body"></div>
          <div class="lantern-bottom"></div>
        </div>
      </div>
    </div>
  </ClientLayout>
</template>

<style scoped>
.client-not-found {
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  position: relative;
  overflow: hidden;
}

.not-found-content {
  text-align: center;
  z-index: 1;
}

.error-code {
  font-family: var(--font-heading);
  font-size: 6rem;
  font-weight: 900;
  color: var(--color-primary);
  line-height: 1;
  text-shadow: 3px 3px 0 rgba(220, 38, 38, 0.2);
  animation: errorCodeFloat 3s ease-in-out infinite;
}

@keyframes errorCodeFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.error-title {
  font-size: 1.25rem;
  color: var(--color-text-primary);
  margin: var(--spacing-md) 0 var(--spacing-sm);
}

.error-message {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
}

.error-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: center;
  flex-wrap: wrap;
}

.lantern-decoration {
  position: absolute;
  right: -40px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.08;
  pointer-events: none;
}

.lantern {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: lanternSwing 4s ease-in-out infinite;
}

@keyframes lanternSwing {
  0%, 100% {
    transform: rotate(-5deg);
  }
  50% {
    transform: rotate(5deg);
  }
}

.lantern-top {
  width: 16px;
  height: 24px;
  background-color: var(--color-primary);
  border-radius: var(--radius-sm);
}

.lantern-body {
  width: 100px;
  height: 130px;
  background-color: var(--color-primary);
  border-radius: var(--radius-lg);
  position: relative;
}

.lantern-body::before {
  content: '';
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: 66px;
  height: 98px;
  background-color: var(--color-primary-light);
  border-radius: var(--radius-md);
}

.lantern-bottom {
  width: 24px;
  height: 32px;
  background-color: var(--color-primary);
  border-radius: var(--radius-sm);
}

@media (max-width: 480px) {
  .error-code {
    font-size: 4rem;
  }
  
  .error-title {
    font-size: 1.125rem;
  }
  
  .error-message {
    font-size: 0.8125rem;
  }
  
  .error-actions {
    flex-direction: column;
  }
  
  .error-actions .btn {
    width: 100%;
  }
}
</style>
