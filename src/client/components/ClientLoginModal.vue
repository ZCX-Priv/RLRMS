<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '@/api'
import { useClientAuthStore } from '@/stores/clientAuth'
import { useAppStore } from '@/stores/app'
import { Phone, Lock, Eye, EyeOff, LogIn } from 'lucide-vue-next'

const clientAuthStore = useClientAuthStore()
const appStore = useAppStore()

const show = ref(false)
const phone = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

let resolveLogin: ((success: boolean) => void) | null = null

function openLogin(): Promise<boolean> {
  return new Promise((resolve) => {
    resolveLogin = resolve
    phone.value = ''
    password.value = ''
    showPassword.value = false
    error.value = ''
    show.value = true
  })
}

function closeLogin(success: boolean) {
  show.value = false
  if (resolveLogin) {
    resolveLogin(success)
    resolveLogin = null
  }
  if (!success) {
    window.dispatchEvent(new CustomEvent('client:login-cancel'))
  }
}

function handlePhoneInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  phone.value = value.replace(/\D/g, '').slice(0, 11)
}

async function handleLogin() {
  error.value = ''

  if (!phone.value) {
    error.value = '请输入手机号'
    return
  }
  if (!/^1\d{10}$/.test(phone.value)) {
    error.value = '请输入正确的11位手机号'
    return
  }
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  if (password.value.length < 6) {
    error.value = '密码长度不能少于6位'
    return
  }

  try {
    loading.value = true
    const res = await api.clientLogin(phone.value, password.value)
    clientAuthStore.setUser({
      id: res.data.user.id,
      phone: res.data.user.phone,
    })
    appStore.showToast('登录成功', 'success')
    closeLogin(true)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '登录失败'
    // Extract error from ApiError
    if (err && typeof err === 'object' && 'data' in err) {
      const apiErr = err as { data?: { error?: string } }
      error.value = apiErr.data?.error || msg
    } else {
      error.value = msg
    }
  } finally {
    loading.value = false
  }
}

function handleRequireLogin(_event: Event) {
  openLogin().then((success) => {
    if (success) {
      window.dispatchEvent(new CustomEvent('client:login-success'))
    }
  })
}

onMounted(() => {
  window.addEventListener('client:require-login', handleRequireLogin)
})

onUnmounted(() => {
  window.removeEventListener('client:require-login', handleRequireLogin)
})

defineExpose({ openLogin })
</script>

<template>
  <Teleport to="body">
    <Transition name="login-modal">
      <div v-if="show" class="login-backdrop">
        <div class="login-card">
          <!-- Header -->
          <div class="login-header">
            <div class="login-brand">
              <img src="/logo.png" alt="红灯笼食府" class="login-logo" />
            </div>
            <h2 class="login-title">红灯笼食府</h2>
            <p class="login-subtitle">登录后即可点餐</p>
          </div>

          <!-- Form -->
          <form class="login-body" @submit.prevent="handleLogin">
            <div class="form-group">
              <label>
                <Phone :size="16" />
                手机号
              </label>
              <input
                :value="phone"
                type="tel"
                placeholder="请输入手机号"
                inputmode="numeric"
                autocomplete="tel"
                @input="handlePhoneInput"
              />
            </div>

            <div class="form-group">
              <label>
                <Lock :size="16" />
                密码
              </label>
              <div class="password-wrapper">
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="请输入密码（至少6位）"
                  autocomplete="current-password"
                />
                <button
                  type="button"
                  class="toggle-pwd"
                  @click="showPassword = !showPassword"
                >
                  <Eye v-if="!showPassword" :size="16" />
                  <EyeOff v-else :size="16" />
                </button>
              </div>
            </div>

            <div v-if="error" class="error-msg">{{ error }}</div>

            <button
              type="submit"
              class="btn btn-primary login-btn"
              :disabled="loading"
            >
              <LogIn :size="18" />
              {{ loading ? '登录中...' : '登录' }}
            </button>

            <p class="login-hint">未注册的手机号将自动注册并登录</p>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.login-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: var(--spacing-md);
  backdrop-filter: blur(4px);
}

.login-card {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 360px;
  overflow: hidden;
}

.login-header {
  text-align: center;
  padding: var(--spacing-xl) var(--spacing-lg) var(--spacing-md);
}

.login-brand {
  width: 60px;
  height: 60px;
  margin: 0 auto var(--spacing-md);
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--color-bg-tertiary);
}

.login-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.login-title {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.login-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.login-body {
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-xl);
}

.form-group {
  margin-bottom: var(--spacing-md);
}

.form-group label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs);
}

.form-group input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  background-color: var(--color-bg-primary);
  transition: border-color var(--transition-fast);
}

.form-group input:focus {
  border-color: var(--color-primary);
  outline: none;
}

.password-wrapper {
  position: relative;
}

.password-wrapper input {
  padding-right: 40px;
}

.toggle-pwd {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
}

.toggle-pwd:hover {
  background-color: var(--color-bg-tertiary);
}

.error-msg {
  padding: var(--spacing-xs) var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  background-color: rgba(220, 38, 38, 0.1);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  color: var(--color-error);
  text-align: center;
}

.login-btn {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: 0.9375rem;
  margin-top: var(--spacing-sm);
}

.login-hint {
  margin-top: var(--spacing-md);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-align: center;
}

/* Transition */
.login-modal-enter-active {
  transition: opacity 0.25s ease-out;
}
.login-modal-enter-active .login-card {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.login-modal-leave-active {
  transition: opacity 0.2s ease-in;
}
.login-modal-leave-active .login-card {
  transition: all 0.2s ease-in;
}

.login-modal-enter-from {
  opacity: 0;
}
.login-modal-enter-from .login-card {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.login-modal-leave-to {
  opacity: 0;
}
.login-modal-leave-to .login-card {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
