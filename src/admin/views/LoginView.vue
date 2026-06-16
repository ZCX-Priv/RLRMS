<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { User, Lock, Eye, EyeOff, LogIn } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const appStore = useAppStore()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }

  try {
    loading.value = true
    error.value = ''
    
    const res = await api.login(username.value, password.value)
    authStore.setUser(res.data.user)
    
    appStore.showToast('登录成功', 'success')
    
    const redirect = route.query.redirect as string
    router.push(redirect || '/admin')
  } catch (err) {
    error.value = '用户名或密码错误'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-overlay"></div>
    <div class="login-container">
      <!-- Left Panel -->
      <div class="login-left">
        <div class="brand">
          <div class="brand-icon">
            <img src="/logo.png" alt="红灯笼食府" />
          </div>
          <h1>红灯笼食府</h1>
          <p>管理面板</p>
        </div>
      </div>

      <!-- Right Panel -->
      <div class="login-right">
        <form class="login-form" @submit.prevent="handleLogin">
          <h2>欢迎登录</h2>
          
          <div class="form-group">
            <label>
              <User :size="18" />
              用户名
            </label>
            <input
              v-model="username"
              type="text"
              placeholder="请输入用户名"
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <label>
              <Lock :size="18" />
              密码
            </label>
            <div class="password-input">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                autocomplete="current-password"
              />
              <button
                type="button"
                class="toggle-password"
                @click="showPassword = !showPassword"
              >
                <Eye v-if="!showPassword" :size="18" />
                <EyeOff v-else :size="18" />
              </button>
            </div>
          </div>

          <div v-if="error" class="error-message">{{ error }}</div>

          <button
            type="submit"
            class="btn btn-primary login-btn"
            :disabled="loading"
          >
            <LogIn :size="18" />
            {{ loading ? '登录中...' : '登录' }}
          </button>

          <p class="default-hint">
            默认账号：admin / admin123
          </p>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: url('/background.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: var(--spacing-lg);
  position: relative;
}

.login-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 0;
}

.login-container {
  display: flex;
  width: 100%;
  max-width: 900px;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.login-left {
  display: none;
  flex: 1;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  padding: var(--spacing-2xl);
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  text-align: center;
}

@media (min-width: 768px) {
  .login-left {
    display: flex;
  }
}

.brand-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  margin: 0 auto var(--spacing-lg);
  overflow: hidden;
}

.brand-icon img {
  width: 60px;
  height: 60px;
  object-fit: contain;
}

.brand h1 {
  font-family: var(--font-heading);
  font-size: 2rem;
  margin-bottom: var(--spacing-sm);
  text-align: center;
}

.brand p {
  font-size: 1.125rem;
  opacity: 0.9;
}

.login-right {
  flex: 1;
  padding: var(--spacing-2xl);
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-form {
  width: 100%;
  max-width: 320px;
}

.login-form h2 {
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

.form-group label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-secondary);
}

.form-group input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 1rem;
  transition: border-color var(--transition-fast);
}

.form-group input:focus {
  border-color: var(--color-primary);
  outline: none;
}

.password-input {
  position: relative;
}

.password-input input {
  padding-right: 44px;
}

.toggle-password {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
}

.toggle-password:hover {
  background-color: var(--color-bg-tertiary);
}

.error-message {
  padding: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  background-color: rgba(220, 38, 38, 0.1);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: var(--color-error);
  text-align: center;
}

.login-btn {
  width: 100%;
  padding: var(--spacing-md);
  font-size: 1rem;
  margin-top: var(--spacing-md);
}

.default-hint {
  margin-top: var(--spacing-lg);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-align: center;
}
</style>
