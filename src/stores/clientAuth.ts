import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api'

interface ClientUser {
  id: string
  phone: string
}

export const useClientAuthStore = defineStore('clientAuth', () => {
  const user = ref<ClientUser | null>(null)
  const isInitialized = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  /** 手机号后四位 */
  const phoneLast4 = computed(() => {
    if (!user.value?.phone) return ''
    return user.value.phone.slice(-4)
  })

  /** 显示名称 */
  const displayName = computed(() => {
    if (!user.value?.phone) return ''
    return `用户${user.value.phone.slice(-4)}`
  })

  /**
   * 设置客户端用户
   */
  function setUser(newUser: ClientUser | null) {
    user.value = newUser
  }

  /**
   * 尝试恢复登录状态（通过验证 cookie）
   */
  async function tryRestore(): Promise<boolean> {
    if (isInitialized.value) {
      return isAuthenticated.value
    }
    try {
      const res = await api.clientVerifyToken()
      user.value = {
        id: res.data.userId,
        phone: res.data.phone,
      }
      isInitialized.value = true
      return true
    } catch {
      isInitialized.value = true
      return false
    }
  }

  /**
   * 客户端登出
   */
  async function logout() {
    try {
      await api.clientLogout()
    } catch {
      // ignore
    }
    user.value = null
  }

  /**
   * 清除本地状态（不请求后端）
   */
  function clearSession() {
    user.value = null
  }

  return {
    user,
    isAuthenticated,
    isInitialized,
    phoneLast4,
    displayName,
    setUser,
    tryRestore,
    logout,
    clearSession,
  }
})
