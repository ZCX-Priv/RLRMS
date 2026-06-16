import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'
import { api } from '@/api'

/** JWT token 有效期（毫秒）：24小时 */
const JWT_EXPIRY_MS = 24 * 60 * 60 * 1000

/** 会话即将过期阈值（毫秒）：30分钟 */
const SESSION_EXPIRING_THRESHOLD_MS = 30 * 60 * 1000

/** 会话保活检测间隔（毫秒）：5分钟 */
const KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1000

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const sessionExpiresAt = ref<number | null>(null)

  /** 保活定时器 ID */
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null

  /**
   * 计算会话剩余时间（秒）
   * @returns 剩余秒数，如果会话不存在或已过期则返回 0
   */
  const expiresIn = computed(() => {
    if (!sessionExpiresAt.value) return 0
    const remaining = sessionExpiresAt.value - Date.now()
    return remaining > 0 ? Math.floor(remaining / 1000) : 0
  })

  /**
   * 启动会话保活定时器
   * 每 5 分钟验证一次 token 有效性
   */
  function startKeepAlive() {
    // 先清除已存在的定时器
    stopKeepAlive()

    keepAliveTimer = setInterval(async () => {
      try {
        await api.verifyToken()
      } catch {
        // 验证失败，停止保活并触发过期事件
        stopKeepAlive()
        window.dispatchEvent(new CustomEvent('auth:expired', {
          detail: {
            redirect: window.location.pathname,
            message: '会话已过期，请重新登录'
          }
        }))
      }
    }, KEEP_ALIVE_INTERVAL_MS)
  }

  /**
   * 停止会话保活定时器
   */
  function stopKeepAlive() {
    if (keepAliveTimer !== null) {
      clearInterval(keepAliveTimer)
      keepAliveTimer = null
    }
  }

  /**
   * 设置用户信息并初始化会话过期时间
   * @param newUser - 用户信息，null 表示清除会话
   */
  function setUser(newUser: User | null) {
    user.value = newUser
    isAuthenticated.value = newUser !== null

    if (newUser) {
      // 设置会话过期时间为当前时间 + 24小时
      sessionExpiresAt.value = Date.now() + JWT_EXPIRY_MS
      // 启动保活定时器
      startKeepAlive()
    } else {
      sessionExpiresAt.value = null
      // 停止保活定时器
      stopKeepAlive()
    }
  }

  /**
   * 清除会话状态
   */
  function clearSession() {
    // 停止保活定时器
    stopKeepAlive()
    user.value = null
    isAuthenticated.value = false
    sessionExpiresAt.value = null
  }

  /**
   * 用户登出，清除所有认证相关状态
   */
  function logout() {
    clearSession()
  }

  /**
   * 检查会话是否即将过期（30分钟内）
   * @returns 如果会话将在30分钟内过期返回 true
   */
  function isSessionExpiringSoon(): boolean {
    if (!sessionExpiresAt.value) return false
    const remaining = sessionExpiresAt.value - Date.now()
    return remaining > 0 && remaining < SESSION_EXPIRING_THRESHOLD_MS
  }

  return {
    user,
    isAuthenticated,
    sessionExpiresAt,
    expiresIn,
    setUser,
    logout,
    clearSession,
    isSessionExpiringSoon,
    startKeepAlive,
    stopKeepAlive,
  }
})
