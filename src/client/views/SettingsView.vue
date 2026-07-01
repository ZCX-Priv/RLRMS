<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useClientAuthStore } from '@/stores/clientAuth'
import { clear as clearIndexedDB } from '@/utils/storage'
import { api } from '@/api'
import ClientLayout from '@/client/components/ClientLayout.vue'
import Modal from '@/shared/components/Modal.vue'
import { Sun, Moon, Monitor, ChevronRight, ChevronDown, ChevronUp, Info, Trash2, CircleUser, LogOut, MapPin, Phone, Clock } from 'lucide-vue-next'

const router = useRouter()
const appStore = useAppStore()
const clientAuthStore = useClientAuthStore()

const showAboutModal = ref(false)
const showClearModal = ref(false)

interface RestaurantInfo {
  name: string
  phone: string
  address: string
  business_hours: { days: number[]; periods: { open: string; close: string }[] }
  description: string
  features: string[]
}

const restaurantInfo = ref<RestaurantInfo>({
  name: '',
  phone: '',
  address: '',
  business_hours: { days: [], periods: [] },
  description: '',
  features: [],
})

const descExpanded = ref(false)
const descRef = ref<HTMLElement | null>(null)
const descOverflow = ref(false)

function checkDescOverflow() {
  const el = descRef.value
  if (!el) return
  const p = el.querySelector('p')
  if (!p) return
  const lineHeight = parseFloat(getComputedStyle(p).lineHeight) || 24
  descOverflow.value = p.scrollHeight > lineHeight * 3 + 2
}

watch(showAboutModal, async (show) => {
  if (show) {
    descExpanded.value = false
    descOverflow.value = false
    await nextTick()
    checkDescOverflow()
  }
})

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function formatDays(days: number[]): string {
  if (!days || days.length === 0) return ''
  if (days.length === 7) return '每天'
  const sorted = [...days].sort((a, b) => a - b)
  const dayName = (d: number) => DAY_NAMES[d - 1] ?? `星期${d}`
  // 检查是否连续范围
  const ranges: string[] = []
  let start = sorted[0]!
  let end = sorted[0]!
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!
    if (cur === end + 1) {
      end = cur
    } else {
      ranges.push(start === end ? dayName(start) : `${dayName(start)}至${dayName(end)}`)
      start = cur
      end = cur
    }
  }
  ranges.push(start === end ? dayName(start) : `${dayName(start)}至${dayName(end)}`)
  return ranges.join('、')
}

onMounted(async () => {
  try {
    const res = await api.getRestaurantInfo()
    restaurantInfo.value = res.data
  } catch (error) {
    console.error('Failed to fetch restaurant info:', error)
  } finally {
    await nextTick()
    checkDescOverflow()
  }
})

function handleThemeChange(theme: 'light' | 'dark' | 'system') {
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
              <Monitor v-if="appStore.theme === 'system'" :size="20" />
              <Sun v-else-if="appStore.resolvedTheme === 'light'" :size="20" />
              <Moon v-else :size="20" />
            </div>
            <span class="setting-label">主题</span>
            <div class="theme-options">
              <button
                class="theme-btn"
                :class="{ 'theme-btn-active': appStore.theme === 'system' }"
                @click="handleThemeChange('system')"
              >
                <Monitor :size="14" />
                系统
              </button>
              <button
                class="theme-btn"
                :class="{ 'theme-btn-active': appStore.theme === 'light' }"
                @click="handleThemeChange('light')"
              >
                <Sun :size="14" />
                浅色
              </button>
              <button
                class="theme-btn"
                :class="{ 'theme-btn-active': appStore.theme === 'dark' }"
                @click="handleThemeChange('dark')"
              >
                <Moon :size="14" />
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
        title="餐厅信息"
        size="md"
        @close="showAboutModal = false"
      >
        <div class="about-content">
          <!-- 品牌区域 -->
          <div class="about-hero">
            <div class="about-logo">
              <img src="/logo.png" alt="红灯笼食府" class="about-logo-img" />
            </div>
            <h2 class="about-name">{{ restaurantInfo.name || '红灯笼食府' }}</h2>
            <p class="about-slogan">传承经典 · 匠心美食</p>
            <div v-if="restaurantInfo.features && restaurantInfo.features.length" class="about-tags">
              <span
                v-for="(tag, index) in restaurantInfo.features"
                :key="index"
                class="about-tag"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- 餐厅简介 -->
          <div
            v-if="restaurantInfo.description"
            ref="descRef"
            class="about-description"
          >
            <p :class="{ 'desc-collapsed': descOverflow && !descExpanded }"><span class="about-quote">&ldquo;</span>{{ restaurantInfo.description }}<span class="about-quote">&rdquo;</span></p>
            <button
              v-if="descOverflow"
              class="desc-toggle"
              @click="descExpanded = !descExpanded"
            >
              <component :is="descExpanded ? ChevronUp : ChevronDown" :size="14" />
              {{ descExpanded ? '收起' : '展开全文' }}
            </button>
          </div>

          <!-- 信息列表 -->
          <div class="about-info-list">
            <div
              v-if="restaurantInfo.business_hours?.periods?.length"
              class="about-info-item"
            >
              <div class="about-info-icon">
                <Clock :size="16" />
              </div>
              <div class="about-info-text">
                <span class="about-info-label">{{ formatDays(restaurantInfo.business_hours.days) }}</span>
                <span
                  v-for="(period, pi) in restaurantInfo.business_hours.periods"
                  :key="pi"
                  class="about-info-value"
                >{{ period.open }} - {{ period.close }}</span>
              </div>
            </div>
            <div v-if="restaurantInfo.phone" class="about-info-item">
              <div class="about-info-icon">
                <Phone :size="16" />
              </div>
              <div class="about-info-text">
                <span class="about-info-label">联系电话</span>
                <span class="about-info-value">{{ restaurantInfo.phone }}</span>
              </div>
            </div>
            <div v-if="restaurantInfo.address" class="about-info-item">
              <div class="about-info-icon">
                <MapPin :size="16" />
              </div>
              <div class="about-info-text">
                <span class="about-info-label">地址</span>
                <span class="about-info-value">{{ restaurantInfo.address }}</span>
              </div>
            </div>
          </div>

          <!-- 底部版本信息 -->
          <div class="about-footer">
            <span>系统版本 1.0.0</span>
          </div>
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
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  flex-shrink: 0;
}

.page-header h1 {
  font-size: 1.125rem;
  font-weight: 600;
}

.page-content {
  flex: 1;
  overflow-y: auto;
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
  display: flex;
  align-items: center;
  gap: 4px;
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
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.about-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
}

.about-logo {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #cc3333));
  border-radius: 50%;
  color: white;
  margin-bottom: var(--spacing-xs);
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
  overflow: hidden;
}

.about-logo-img {
  width: 52px;
  height: 52px;
  object-fit: contain;
}

.about-name {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.about-slogan {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
  margin: 0;
}

.about-description {
  padding: var(--spacing-md);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
}

.about-description p {
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--color-text-secondary);
  margin: 0;
  white-space: pre-wrap;
  font-family: 'KaiTi', 'STKaiti', '楷体', serif;
}

.desc-collapsed {
  max-height: calc(0.875rem * 1.8 * 3);
  overflow: hidden;
}

.desc-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  margin: 0 auto;
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.8rem;
  cursor: pointer;
  padding: var(--spacing-xs) 0 0;
}

.about-quote {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
}

.about-info-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.about-info-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
}

.about-info-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary);
  border-radius: 50%;
  color: white;
  flex-shrink: 0;
}

.about-info-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.about-info-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.about-info-value {
  font-size: 0.875rem;
  color: var(--color-text-primary);
  font-weight: 500;
  word-break: break-all;
}

.about-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  justify-content: center;
  margin-top: var(--spacing-sm);
}

.about-tag {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: 0.8125rem;
  color: var(--color-primary);
  background-color: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.2);
  border-radius: var(--radius-full);
  font-weight: 500;
}

:global([data-theme="dark"]) .about-tag {
  background-color: rgba(220, 38, 38, 0.15);
  border-color: rgba(220, 38, 38, 0.3);
}

.about-footer {
  display: flex;
  justify-content: center;
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
}

.about-footer span {
  font-size: 0.75rem;
  color: var(--color-text-muted);
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
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-primary);
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

:global([data-theme="dark"]) .profile-avatar {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #cc3333));
  border: none;
  color: white;
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
