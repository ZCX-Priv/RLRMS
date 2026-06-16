<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useClientAuthStore } from '@/stores/clientAuth'
import { clear as clearIndexedDB } from '@/utils/storage'
import ClientLayout from '@/client/components/ClientLayout.vue'
import Modal from '@/shared/components/Modal.vue'
import { Sun, Moon, ChevronRight, Info, Trash2, CircleUser, LogOut } from 'lucide-vue-next'

const router = useRouter()
const appStore = useAppStore()
const clientAuthStore = useClientAuthStore()

const showAboutModal = ref(false)
const showClearModal = ref(false)

function handleThemeChange(theme: 'light' | 'dark') {
  appStore.setTheme(theme)
}

async function clearCache() {
  await clearIndexedDB()
  sessionStorage.clear()
  appStore.showToast('缓存已清除', 'success')
  showClearModal.value = false
}

async function handleLogout() {
  await clientAuthStore.logout()
  appStore.showToast('已退出登录', 'success')
  router.push('/')
}
</script>

<template>
  <ClientLayout>
    <div class="settings-page">
      <!-- Header -->
      <header class="page-header">
        <h1>设置</h1>
      </header>

      <!-- Content -->
      <div class="page-content">
        <!-- Personal Card -->
        <div class="profile-card">
          <div class="profile-info">
            <div class="profile-avatar">
              <CircleUser :size="40" />
            </div>
            <div class="profile-text">
              <span class="profile-name">{{ clientAuthStore.displayName }}</span>
              <span class="profile-phone">{{ clientAuthStore.user?.phone }}</span>
            </div>
          </div>
          <button class="logout-btn" @click="handleLogout">
            <LogOut :size="16" />
            退出登录
          </button>
        </div>

        <!-- Theme -->
        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-icon">
              <Sun v-if="appStore.theme === 'light'" :size="20" />
              <Moon v-else :size="20" />
            </div>
            <span class="setting-label">主题</span>
            <div class="theme-options">
              <button
                class="theme-btn"
                :class="{ 'theme-btn-active': appStore.theme === 'light' }"
                @click="handleThemeChange('light')"
              >
                浅色
              </button>
              <button
                class="theme-btn"
                :class="{ 'theme-btn-active': appStore.theme === 'dark' }"
                @click="handleThemeChange('dark')"
              >
                深色
              </button>
            </div>
          </div>
        </div>

        <!-- About -->
        <div class="settings-card">
          <div class="setting-item clickable" @click="showAboutModal = true">
            <div class="setting-icon">
              <Info :size="20" />
            </div>
            <span class="setting-label">关于</span>
            <ChevronRight :size="20" class="setting-arrow" />
          </div>
        </div>

        <!-- Clear Cache -->
        <div class="settings-card">
          <div class="setting-item clickable" @click="showClearModal = true">
            <div class="setting-icon">
              <Trash2 :size="20" />
            </div>
            <span class="setting-label">清除缓存</span>
            <ChevronRight :size="20" class="setting-arrow" />
          </div>
        </div>
      </div>

      <!-- About Modal -->
      <Modal
        :show="showAboutModal"
        title="关于"
        size="sm"
        @close="showAboutModal = false"
      >
        <div class="about-content">
          <h2 class="app-name">红灯笼食府</h2>
          <p class="app-version">版本 1.0.0</p>
          <p class="app-desc">
            红灯笼食府点餐 & 库存管理系统，为您提供便捷的点餐体验和高效的管理服务。
          </p>
        </div>
      </Modal>

      <!-- Clear Cache Modal -->
      <Modal
        :show="showClearModal"
        title="清除缓存"
        size="sm"
        @close="showClearModal = false"
      >
        <p class="confirm-text">确定要清除所有缓存吗？此操作不可恢复。</p>
        <template #footer>
          <button class="btn btn-secondary" @click="showClearModal = false">取消</button>
          <button class="btn btn-primary" @click="clearCache">确定</button>
        </template>
      </Modal>
    </div>
  </ClientLayout>
</template>

<style scoped>
.settings-page {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-bg-secondary);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
}

.page-header h1 {
  font-size: 1.125rem;
  font-weight: 600;
}

.page-content {
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.settings-card {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}

.setting-item.clickable {
  cursor: pointer;
}

.setting-item.clickable:hover {
  background-color: var(--color-bg-tertiary);
}

.setting-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  color: var(--color-primary);
}

.setting-label {
  flex: 1;
  font-size: 1rem;
}

.setting-arrow {
  color: var(--color-text-muted);
}

.theme-options {
  display: flex;
  gap: var(--spacing-sm);
}

.theme-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.theme-btn:hover {
  border-color: var(--color-primary);
}

.theme-btn-active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.about-content {
  text-align: center;
  padding: var(--spacing-md);
}

.app-name {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  margin-bottom: var(--spacing-sm);
}

.app-version {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-md);
}

.app-desc {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.confirm-text {
  text-align: center;
  color: var(--color-text-secondary);
}

.profile-card {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.profile-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.profile-avatar {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #cc3333));
  border-radius: 50%;
  color: white;
  flex-shrink: 0;
}

.profile-text {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.profile-name {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.profile-phone {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  width: 100%;
  padding: var(--spacing-sm);
  font-size: 0.875rem;
  color: var(--color-error);
  background-color: rgba(220, 38, 38, 0.08);
  border-radius: var(--radius-md);
  transition: background-color var(--transition-fast);
}

.logout-btn:hover {
  background-color: rgba(220, 38, 38, 0.15);
}
</style>
