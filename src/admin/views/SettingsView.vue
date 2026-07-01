<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

const Modal = defineAsyncComponent(() => import('@/shared/components/Modal.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/shared/components/ConfirmDialog.vue'))
import { Sun, Moon, Monitor, Lock, Info, LogOut, Save, RotateCcw, AlertTriangle, Download, Upload, Code, Plus, X, Trash2 } from 'lucide-vue-next'

const authStore = useAuthStore()
const appStore = useAppStore()

const showPasswordModal = ref(false)
const showAboutModal = ref(false)
const showResetModal = ref(false)
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const changingPassword = ref(false)
const resetting = ref(false)

// 数据导入/导出相关状态
const exporting = ref(false)
const importing = ref(false)
const showImportModal = ref(false)
const importFile = ref<File | null>(null)
const importPreview = ref<any>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const businessHours = ref<{ days: number[]; periods: { open: string; close: string }[] }>({
  days: [1, 2, 3, 4, 5, 6, 7],
  periods: [],
})
const featuresList = ref<string[]>([])
const newFeature = ref('')
const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const restaurantSettings = ref({
  restaurant_name: '',
  restaurant_phone: '',
  restaurant_address: '',
  business_hours: '',
  restaurant_description: '',
  restaurant_features: '',
})
const loadingSettings = ref(false)
const savingSettings = ref(false)

// 调试工具启用确认弹窗
const showDevModeConfirm = ref(false)

onMounted(async () => {
  await appStore.loadTheme(true)
  await fetchSettings()
  // 从 IndexedDB 加载开发者模式状态（统一由 store 管理）
  await appStore.loadDevMode()
})

// 开关点击处理：关闭时直接生效（含 toast），开启时弹出确认（开关保持关闭）
function handleDevModeClick(e: Event) {
  if (appStore.devMode) {
    // 当前开启，点击则直接关闭：让浏览器正常切换，同时更新 store + toast
    appStore.setDevMode(false)
    appStore.showToast('已禁用调试工具', 'success')
  } else {
    // 当前关闭，点击则弹出确认：阻止切换，保持关闭状态
    e.preventDefault()
    showDevModeConfirm.value = true
  }
}

function confirmDevMode() {
  showDevModeConfirm.value = false
  appStore.setDevMode(true)
  appStore.showToast('已启用调试工具', 'success')
}

function cancelDevMode() {
  showDevModeConfirm.value = false
}

async function fetchSettings() {
  try {
    loadingSettings.value = true
    const res = await api.getSettings()
    const data = res.data
    restaurantSettings.value = {
      restaurant_name: data.restaurant_name || '',
      restaurant_phone: data.restaurant_phone || '',
      restaurant_address: data.restaurant_address || '',
      business_hours: data.business_hours || '',
      restaurant_description: data.restaurant_description || '',
      restaurant_features: data.restaurant_features || '',
    }
    // 解析营业时间为结构化对象（兼容旧数组格式）
    try {
      const parsed = JSON.parse(data.business_hours || '{}')
      if (Array.isArray(parsed)) {
        // 旧格式：[{ days, open, close }, ...] 迁移为新格式
        const allDays = new Set<number>()
        const periods: { open: string; close: string }[] = []
        for (const entry of parsed) {
          if (Array.isArray(entry.days)) {
            for (const d of entry.days) allDays.add(d)
          }
          if (entry.open || entry.close) {
            periods.push({ open: entry.open || '', close: entry.close || '' })
          }
        }
        businessHours.value = {
          days: allDays.size > 0 ? Array.from(allDays).sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6, 7],
          periods: periods.length > 0 ? periods : [{ open: '', close: '' }],
        }
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.periods)) {
        // 新格式：{ days, periods }
        businessHours.value = {
          days: Array.isArray(parsed.days) ? parsed.days : [1, 2, 3, 4, 5, 6, 7],
          periods: parsed.periods,
        }
      } else {
        businessHours.value = { days: [1, 2, 3, 4, 5, 6, 7], periods: [{ open: '', close: '' }] }
      }
    } catch {
      businessHours.value = { days: [1, 2, 3, 4, 5, 6, 7], periods: [{ open: '', close: '' }] }
    }
    // 解析特色标签为数组
    featuresList.value = data.restaurant_features
      ? data.restaurant_features.split(',').map((s: string) => s.trim()).filter(Boolean)
      : []
  } catch (error) {
    console.error('Failed to fetch settings:', error)
  } finally {
    loadingSettings.value = false
  }
}

async function handleSaveSettings() {
  try {
    savingSettings.value = true
    const payload = {
      ...restaurantSettings.value,
      business_hours: JSON.stringify(businessHours.value),
      restaurant_features: featuresList.value.join(','),
    }
    await api.updateSettings(payload)
    appStore.showToast('设置已保存', 'success')
  } catch (error) {
    console.error('Failed to save settings:', error)
    appStore.showToast('保存失败', 'error')
  } finally {
    savingSettings.value = false
  }
}

function addBusinessHoursEntry() {
  businessHours.value.periods.push({ open: '', close: '' })
}
function removeBusinessHoursEntry(index: number) {
  businessHours.value.periods.splice(index, 1)
}
function toggleDay(day: number) {
  const idx = businessHours.value.days.indexOf(day)
  idx >= 0 ? businessHours.value.days.splice(idx, 1) : businessHours.value.days.push(day)
}
function addFeature() {
  const tag = newFeature.value.trim()
  if (tag && !featuresList.value.includes(tag)) {
    featuresList.value.push(tag)
    newFeature.value = ''
  }
}
function removeFeature(index: number) {
  featuresList.value.splice(index, 1)
}

function handleThemeChange(theme: 'light' | 'dark' | 'system') {
  appStore.setTheme(theme)
}

async function handleChangePassword() {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    appStore.showToast('两次密码输入不一致', 'error')
    return
  }

  if (passwordForm.value.newPassword.length < 6) {
    appStore.showToast('密码至少6位', 'error')
    return
  }

  try {
    changingPassword.value = true
    await api.changePassword(passwordForm.value.oldPassword, passwordForm.value.newPassword)
    appStore.showToast('密码修改成功', 'success')
    showPasswordModal.value = false
    passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  } catch (error) {
    console.error('Failed to change password:', error)
    appStore.showToast('密码修改失败', 'error')
  } finally {
    changingPassword.value = false
  }
}

async function handleResetDatabase() {
  try {
    resetting.value = true
    await api.resetDatabase()
    appStore.showToast('数据库已重置', 'success')
    showResetModal.value = false
    handleLogout()
  } catch (error) {
    console.error('Failed to reset database:', error)
    appStore.showToast('重置失败', 'error')
  } finally {
    resetting.value = false
  }
}

function handleLogout() {
  authStore.logout()
  window.location.href = '/admin/login'
}

// 数据导出
async function handleExport() {
  try {
    exporting.value = true
    await api.exportData()
    appStore.showToast('数据导出成功', 'success')
  } catch (error) {
    console.error('Failed to export data:', error)
    appStore.showToast('导出失败', 'error')
  } finally {
    exporting.value = false
  }
}

// 触发文件选择
function triggerFileInput() {
  fileInput.value?.click()
}

// 处理文件选择
async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  importFile.value = file

  try {
    // 读取 ZIP 中的 manifest.json 显示预览
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(file)
    const manifestFile = zip.file('data/manifest.json')

    if (!manifestFile) {
      appStore.showToast('无效的备份文件', 'error')
      return
    }

    const manifestContent = await manifestFile.async('string')
    importPreview.value = JSON.parse(manifestContent)
    showImportModal.value = true
  } catch (error) {
    console.error('Failed to read backup file:', error)
    appStore.showToast('读取备份文件失败', 'error')
  }

  // 重置 input 以便可以再次选择相同文件
  target.value = ''
}

// 数据导入
async function handleImport() {
  if (!importFile.value) return

  try {
    importing.value = true
    await api.importData(importFile.value)
    appStore.showToast('数据导入成功', 'success')
    showImportModal.value = false
    importFile.value = null
    importPreview.value = null
    // 刷新页面以加载新数据
    window.location.reload()
  } catch (error) {
    console.error('Failed to import data:', error)
    appStore.showToast('导入失败', 'error')
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <h1 class="page-title">系统设置</h1>

    <div class="settings-section">
      <h2 class="section-title">
        餐厅信息
      </h2>
      <div class="settings-form">
        <div class="form-group">
          <label>餐厅名称</label>
          <input
            v-model="restaurantSettings.restaurant_name"
            type="text"
            placeholder="请输入餐厅名称"
          />
        </div>
        <div class="form-group">
          <label>联系电话</label>
          <input
            v-model="restaurantSettings.restaurant_phone"
            type="text"
            placeholder="请输入联系电话"
          />
        </div>
        <div class="form-group">
          <label>餐厅地址</label>
          <input
            v-model="restaurantSettings.restaurant_address"
            type="text"
            placeholder="请输入餐厅地址"
          />
        </div>
        <div class="form-group">
          <label>营业时间</label>
          <div class="bh-list">
            <div class="bh-days-header">
              <div class="day-checks">
                <button
                  v-for="(label, di) in DAY_LABELS"
                  :key="di"
                  type="button"
                  class="day-chip"
                  :class="{ 'day-chip-active': businessHours.days.includes(di + 1) }"
                  @click="toggleDay(di + 1)"
                >{{ label }}</button>
              </div>
            </div>
            <div v-for="(period, i) in businessHours.periods" :key="i" class="bh-entry">
              <div class="bh-time-inputs">
                <input type="time" v-model="period.open" class="time-input" />
                <span class="time-sep">至</span>
                <input type="time" v-model="period.close" class="time-input" />
              </div>
              <button type="button" class="bh-remove-btn" @click="removeBusinessHoursEntry(i)">
                <Trash2 :size="14" />
              </button>
            </div>
            <button type="button" class="btn btn-secondary bh-add-btn" @click="addBusinessHoursEntry">
              <Plus :size="14" />
              添加时段
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>餐厅简介</label>
          <textarea
            v-model="restaurantSettings.restaurant_description"
            placeholder="请输入餐厅简介"
            rows="3"
            class="settings-textarea"
          ></textarea>
        </div>
        <div class="form-group">
          <label>特色标签</label>
          <div class="tag-add-row">
            <input
              v-model="newFeature"
              type="text"
              placeholder="输入标签名称"
              @keydown.enter="addFeature"
            />
            <button type="button" class="btn btn-secondary tag-add-btn" @click="addFeature">
              <Plus :size="14" />
              添加
            </button>
          </div>
          <div class="tag-pills">
            <span v-for="(tag, i) in featuresList" :key="i" class="tag-pill">
              {{ tag }}
              <button type="button" @click="removeFeature(i)"><X :size="12" /></button>
            </span>
          </div>
        </div>
        <div class="form-actions">
          <button
            class="btn btn-primary save-btn"
            :disabled="savingSettings"
            @click="handleSaveSettings"
          >
            <Save :size="16" />
            {{ savingSettings ? '保存中...' : '保存信息' }}
          </button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h2 class="section-title">外观设置</h2>
      <div class="setting-item">
        <div class="setting-info">
          <Monitor v-if="appStore.theme === 'system'" :size="20" />
          <Sun v-else-if="appStore.resolvedTheme === 'light'" :size="20" />
          <Moon v-else :size="20" />
          <span>主题模式</span>
        </div>
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

    <div class="settings-section">
      <h2 class="section-title">账号设置</h2>
      <div class="setting-item clickable" @click="showPasswordModal = true">
        <div class="setting-info">
          <Lock :size="20" />
          <span>修改密码</span>
        </div>
        <span class="setting-arrow">></span>
      </div>
    </div>

    <div class="settings-section">
      <h2 class="section-title">关于</h2>
      <div class="setting-item clickable" @click="showAboutModal = true">
        <div class="setting-info">
          <Info :size="20" />
          <span>系统信息</span>
        </div>
        <span class="setting-arrow">></span>
      </div>
    </div>

    <div class="settings-section">
      <h2 class="section-title">
        数据管理
      </h2>
      <div class="data-management">
        <button class="btn btn-primary" @click="handleExport" :disabled="exporting">
          <Download :size="16" />
          {{ exporting ? '导出中...' : '导出数据' }}
        </button>
        <button class="btn btn-secondary" @click="triggerFileInput" :disabled="importing">
          <Upload :size="16" />
          {{ importing ? '导入中...' : '导入数据' }}
        </button>
        <input ref="fileInput" type="file" accept=".zip" @change="handleFileSelect" hidden />
      </div>
    </div>

    <!-- 开发人员选项 -->
    <div class="settings-section">
      <h2 class="section-title">
        开发人员选项
      </h2>
      <div class="setting-item">
        <div class="setting-info">
          <Code :size="20" />
          <span>调试工具</span>
        </div>
        <label class="toggle-switch">
          <input
            type="checkbox"
            :checked="appStore.devMode"
            @click="handleDevModeClick"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <div class="logout-section">
      <button class="btn btn-danger reset-btn" @click="showResetModal = true">
        <RotateCcw :size="18" />
        恢复默认设置
      </button>
      <button class="btn btn-secondary logout-btn" @click="handleLogout">
        <LogOut :size="18" />
        退出登录
      </button>
    </div>

    <!-- Reset Modal -->
    <Modal
      :show="showResetModal"
      title="确认恢复默认设置"
      size="sm"
      @close="showResetModal = false"
    >
      <div class="reset-warning">
        <AlertTriangle :size="48" class="warning-icon" />
        <p>此操作将清除所有数据并恢复默认设置，包括：</p>
        <ul>
          <li>所有订单记录</li>
          <li>所有菜品和分类</li>
          <li>所有桌位信息</li>
          <li>所有库存记录</li>
          <li>所有系统设置</li>
        </ul>
        <p class="warning-text">此操作不可撤销！</p>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showResetModal = false">取消</button>
        <button
          class="btn btn-danger"
          :disabled="resetting"
          @click="handleResetDatabase"
        >
          {{ resetting ? '重置中...' : '确认重置' }}
        </button>
      </template>
    </Modal>

    <!-- Password Modal -->
    <Modal
      :show="showPasswordModal"
      title="修改密码"
      size="sm"
      @close="showPasswordModal = false"
    >
      <div class="form-content">
        <div class="form-group">
          <label>旧密码</label>
          <input
            v-model="passwordForm.oldPassword"
            type="password"
            placeholder="请输入旧密码"
          />
        </div>
        <div class="form-group">
          <label>新密码</label>
          <input
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="请输入新密码"
          />
        </div>
        <div class="form-group">
          <label>确认密码</label>
          <input
            v-model="passwordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
          />
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showPasswordModal = false">取消</button>
        <button
          class="btn btn-primary"
          :disabled="changingPassword"
          @click="handleChangePassword"
        >
          {{ changingPassword ? '修改中...' : '确定' }}
        </button>
      </template>
    </Modal>

    <!-- About Modal -->
    <Modal
      :show="showAboutModal"
      title="系统信息"
      size="sm"
      @close="showAboutModal = false"
    >
      <div class="about-content">
        <h3>红灯笼食府管理系统</h3>
        <p class="version">版本 1.0.0</p>
        <div class="info-list">
          <div class="info-row">
            <span>技术栈</span>
            <span>Vue 3 + Node.js + SQLite</span>
          </div>
          <div class="info-row">
            <span>开发框架</span>
            <span>Vite + TypeScript</span>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Import Preview Modal -->
    <Modal
      :show="showImportModal"
      title="导入数据预览"
      size="sm"
      @close="showImportModal = false"
    >
      <div class="import-preview-content" v-if="importPreview">
        <div class="preview-info">
          <div class="info-row">
            <span>备份版本</span>
            <span>{{ importPreview.version || '未知' }}</span>
          </div>
          <div class="info-row">
            <span>导出时间</span>
            <span>{{ importPreview.exportedAt ? new Date(importPreview.exportedAt).toLocaleString() : '未知' }}</span>
          </div>
        </div>
        <div class="preview-stats" v-if="importPreview.counts">
          <h4>数据统计</h4>
          <div class="stats-list">
            <div class="stat-item" v-if="importPreview.counts.categories">
              <span>分类数量</span>
              <span>{{ importPreview.counts.categories }}</span>
            </div>
            <div class="stat-item" v-if="importPreview.counts.dishes">
              <span>菜品数量</span>
              <span>{{ importPreview.counts.dishes }}</span>
            </div>
            <div class="stat-item" v-if="importPreview.counts.tables">
              <span>桌位数量</span>
              <span>{{ importPreview.counts.tables }}</span>
            </div>
            <div class="stat-item" v-if="importPreview.counts.orders">
              <span>订单数量</span>
              <span>{{ importPreview.counts.orders }}</span>
            </div>
            <div class="stat-item" v-if="importPreview.counts.users">
              <span>用户数量</span>
              <span>{{ importPreview.counts.users }}</span>
            </div>
            <div class="stat-item" v-if="importPreview.counts.inventory">
              <span>库存记录</span>
              <span>{{ importPreview.counts.inventory }}</span>
            </div>
            <div class="stat-item" v-if="importPreview.counts.images">
              <span>图片数量</span>
              <span>{{ importPreview.counts.images }}</span>
            </div>
          </div>
        </div>
        <div class="import-warning">
          <AlertTriangle :size="20" class="warning-icon-small" />
          <p>导入将覆盖当前所有数据，此操作不可撤销！</p>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showImportModal = false">取消</button>
        <button
          class="btn btn-danger"
          :disabled="importing"
          @click="handleImport"
        >
          {{ importing ? '导入中...' : '确认导入' }}
        </button>
      </template>
    </Modal>

    <!-- 启用调试工具确认弹窗 -->
    <ConfirmDialog
      :show="showDevModeConfirm"
      title="启用调试工具"
      message="调试工具包含高级功能，仅供开发人员使用，误操作可能影响系统数据。确定要启用吗？"
      confirm-text="启用"
      cancel-text="取消"
      type="warning"
      @confirm="confirmDevMode"
      @cancel="cancelDevMode"
    />
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 800px;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: var(--spacing-xl);
}

.settings-section {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-lg);
  overflow: hidden;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.settings-form {
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.settings-form .form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.settings-form .form-group label {
  font-size: 0.875rem;
  font-weight: 500;
}

.settings-form .form-group input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.settings-textarea {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  resize: vertical;
  font-family: var(--font-body);
  line-height: 1.6;
}

.save-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

/* 营业时间条目 */
.bh-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.bh-days-header {
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
}

.bh-entry {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
}

.day-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.day-chip {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.day-chip:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.day-chip-active {
  background-color: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.day-chip-active:hover {
  background-color: var(--color-primary-hover, #c53030);
  color: white;
}

.bh-time-inputs {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.time-input {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 0.85rem;
}

.time-sep {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.bh-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-error);
  cursor: pointer;
}

.bh-remove-btn:hover {
  background-color: var(--color-error-bg, rgba(239, 68, 68, 0.1));
}

.bh-add-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  align-self: flex-end;
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 0.8rem;
}

/* 特色标签 */
.tag-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
}

.tag-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 9999px;
  background-color: rgba(220, 38, 38, 0.08);
  color: var(--color-primary);
  font-size: 0.8rem;
}

:global([data-theme="dark"]) .tag-pill {
  background-color: rgba(220, 38, 38, 0.15);
}

.tag-pill button {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  padding: 0;
  opacity: 0.6;
}

.tag-pill button:hover {
  opacity: 1;
}

.tag-add-row {
  display: flex;
  gap: var(--spacing-xs);
}

.tag-add-row input {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.tag-add-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: 0.85rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--spacing-sm);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
}

.setting-item.clickable {
  cursor: pointer;
}

.setting-item.clickable:hover {
  background-color: var(--color-bg-tertiary);
}

.setting-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
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
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.theme-btn:hover {
  border-color: var(--color-primary);
}

.theme-btn-active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.setting-arrow {
  color: var(--color-text-muted);
}

.logout-section {
  margin-top: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.reset-btn {
  width: 100%;
  justify-content: center;
}

.logout-btn {
  width: 100%;
  justify-content: center;
}

.reset-warning {
  text-align: center;
  padding: var(--spacing-md);
}

.warning-icon {
  color: var(--color-error);
  margin-bottom: var(--spacing-md);
}

.reset-warning p {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.reset-warning ul {
  text-align: left;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: var(--spacing-sm) 0;
  padding-left: var(--spacing-xl);
}

.reset-warning li {
  margin-bottom: var(--spacing-xs);
}

.warning-text {
  color: var(--color-error) !important;
  font-weight: 600;
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
}

.form-group input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.about-content {
  text-align: center;
}

.about-content h3 {
  font-size: 1.25rem;
  margin-bottom: var(--spacing-xs);
}

.version {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-lg);
}

.info-list {
  text-align: left;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--color-border-light);
  font-size: 0.875rem;
}

.info-row span:first-child {
  color: var(--color-text-muted);
}

.data-management {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}

.data-management .btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
  justify-content: center;
}

.import-preview-content {
  padding: var(--spacing-sm);
}

.preview-info {
  margin-bottom: var(--spacing-md);
}

.preview-stats {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
}

.preview-stats h4 {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-primary);
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.stat-item span:first-child {
  color: var(--color-text-muted);
}

.import-warning {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background-color: var(--color-error-bg, rgba(239, 68, 68, 0.1));
  border-radius: var(--radius-md);
  border: 1px solid var(--color-error-border, rgba(239, 68, 68, 0.2));
}

.warning-icon-small {
  color: var(--color-error);
  flex-shrink: 0;
}

.import-warning p {
  font-size: 0.875rem;
  color: var(--color-error);
  margin: 0;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--color-border);
  border-radius: 24px;
  transition: background-color 0.25s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.25s;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: var(--color-primary);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}
</style>
