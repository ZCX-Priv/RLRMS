<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useClientAuthStore } from '@/stores/clientAuth'
import { useAppStore } from '@/stores/app'
import Toast from '@/shared/components/Toast.vue'
import ClientLoginModal from '@/client/components/ClientLoginModal.vue'

const router = useRouter()
const authStore = useAuthStore()
const clientAuthStore = useClientAuthStore()
const appStore = useAppStore()

// Handle auth expired event (401 response)
function handleAuthExpired(event: Event) {
  const customEvent = event as CustomEvent<{ redirect: string; message: string }>
  const { redirect } = customEvent.detail
  const currentPath = redirect || window.location.pathname

  // Check if this is a client path or admin path
  const isAdminPath = currentPath.startsWith('/admin')

  if (isAdminPath) {
    // Admin path - show toast and redirect to admin login
    appStore.showToast('会话已过期，请重新登录', 'error')
    authStore.logout()
    router.push({
      path: '/admin/login',
      query: { redirect: currentPath }
    })
  } else {
    // Client path - clear client session and trigger login modal
    clientAuthStore.clearSession()
    appStore.showToast('登录已过期，请重新登录', 'error')
    window.dispatchEvent(new CustomEvent('client:require-login'))
  }
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
  <ClientLoginModal />
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