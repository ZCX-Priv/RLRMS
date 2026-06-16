<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import Toast from '@/shared/components/Toast.vue'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

// Handle auth expired event (401 response)
function handleAuthExpired(event: Event) {
  const customEvent = event as CustomEvent<{ redirect: string; message: string }>
  const { redirect } = customEvent.detail

  // Show toast notification
  appStore.showToast('会话已过期，请重新登录', 'error')

  // Clear auth state
  authStore.logout()

  // Redirect to login page with redirect parameter
  router.push({
    path: '/admin/login',
    query: { redirect }
  })
}

onMounted(() => {
  window.addEventListener('auth:expired', handleAuthExpired)
})

onUnmounted(() => {
  window.removeEventListener('auth:expired', handleAuthExpired)
})
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <Toast />
</template>

<style>
/* Page Transition Animations */
.page-enter-active {
  -webkit-animation: pageEnter var(--duration-normal) var(--ease-out);
  animation: pageEnter var(--duration-normal) var(--ease-out);
}

.page-leave-active {
  -webkit-animation: pageLeave var(--duration-normal) var(--ease-in-out);
  animation: pageLeave var(--duration-normal) var(--ease-in-out);
}

@-webkit-keyframes pageEnter {
  from {
    opacity: 0;
    -webkit-transform: translateY(12px);
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    -webkit-transform: translateY(0);
    transform: translateY(0);
  }
}

@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@-webkit-keyframes pageLeave {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes pageLeave {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>