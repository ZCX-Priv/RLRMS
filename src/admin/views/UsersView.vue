<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/app'
import type { AdminUser } from '@/types'

const Modal = defineAsyncComponent(() => import('@/shared/components/Modal.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/shared/components/ConfirmDialog.vue'))
import { Plus, Edit, Trash2, Users, Search, ChevronDown, Check } from 'lucide-vue-next'

const appStore = useAppStore()

const users = ref<AdminUser[]>([])
const loading = ref(true)
const showAddModal = ref(false)
const editingUser = ref<AdminUser | null>(null)
const showDeleteConfirm = ref(false)
const userToDelete = ref<AdminUser | null>(null)

const formData = ref({
  username: '',
  password: '',
  name: '',
  phone: '',
  role: 'customer' as 'admin' | 'customer',
})

const searchQuery = ref('')

const actionDropdownRef = ref<HTMLElement | null>(null)
const showActionDropdown = ref(false)
const editMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const showClearConfirm = ref(false)
const showBatchDeleteConfirm = ref(false)
const showProgressModal = ref(false)
const batchProgress = ref(0)
const batchTotal = ref(0)

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter(user =>
    user.username.toLowerCase().includes(q) ||
    (user.name && user.name.toLowerCase().includes(q)) ||
    (user.phone && user.phone.includes(q))
  )
})

const selectableUsers = computed(() => filteredUsers.value.filter(u => u.username !== 'admin'))

const isAllSelected = computed(() =>
  selectableUsers.value.length > 0 &&
  selectableUsers.value.every(u => selectedIds.value.has(u.id))
)

async function fetchUsers() {
  try {
    loading.value = true
    const res = await api.getUsers()
    users.value = res.data
  } catch (error) {
    console.error('Failed to fetch users:', error)
    appStore.showToast('获取用户列表失败', 'error')
  } finally {
    loading.value = false
  }
}

function openAddModal() {
  editingUser.value = null
  formData.value = {
    username: '',
    password: '',
    name: '',
    phone: '',
    role: 'customer',
  }
  showAddModal.value = true
}

function openEditModal(user: AdminUser) {
  editingUser.value = user
  formData.value = {
    username: user.username,
    password: '',
    name: user.name || '',
    phone: user.phone || '',
    role: user.role,
  }
  showAddModal.value = true
}

async function handleSave() {
  try {
    // 前端校验：新建顾客时称呼和手机号必填
    if (!editingUser.value && formData.value.role === 'customer') {
      if (!formData.value.name.trim()) {
        appStore.showToast('请填写称呼', 'error')
        return
      }
      if (!formData.value.phone.trim()) {
        appStore.showToast('请填写手机号', 'error')
        return
      }
    }

    if (editingUser.value) {
      const updateData: {
        password?: string
        role?: 'admin' | 'customer'
        name?: string
        phone?: string
      } = {
        role: formData.value.role,
        name: formData.value.name,
        phone: formData.value.phone,
      }
      if (formData.value.password) {
        updateData.password = formData.value.password
      }
      await api.updateUser(editingUser.value.id, updateData)
      appStore.showToast('用户已更新', 'success')
    } else {
      await api.createUser({
        username: formData.value.username,
        password: formData.value.password,
        role: formData.value.role,
        name: formData.value.name,
        phone: formData.value.phone,
      })
      appStore.showToast('用户已添加', 'success')
    }
    showAddModal.value = false
    fetchUsers()
  } catch (error) {
    console.error('Failed to save user:', error)
    const errorMessage = error instanceof Error ? error.message : '操作失败'
    appStore.showToast(errorMessage, 'error')
  }
}

function handleDelete(user: AdminUser) {
  userToDelete.value = user
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!userToDelete.value) return
  try {
    await api.deleteUser(userToDelete.value.id)
    appStore.showToast('用户已删除', 'success')
    showDeleteConfirm.value = false
    userToDelete.value = null
    fetchUsers()
  } catch (error) {
    console.error('Failed to delete user:', error)
    const errorMessage = error instanceof Error ? error.message : '删除失败'
    appStore.showToast(errorMessage, 'error')
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function handleClickOutside(e: MouseEvent) {
  if (showActionDropdown.value && actionDropdownRef.value &&
      !actionDropdownRef.value.contains(e.target as Node)) {
    showActionDropdown.value = false
  }
}

function enterEditMode() {
  showActionDropdown.value = false
  editMode.value = true
  selectedIds.value.clear()
}

function exitEditMode() {
  editMode.value = false
  selectedIds.value.clear()
}

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectableUsers.value.forEach(u => selectedIds.value.delete(u.id))
  } else {
    selectableUsers.value.forEach(u => selectedIds.value.add(u.id))
  }
}

function requestClearAll() {
  showActionDropdown.value = false
  showClearConfirm.value = true
}

async function confirmBatchDelete() {
  const ids = [...selectedIds.value]
  if (ids.length === 0) return
  showBatchDeleteConfirm.value = false
  batchTotal.value = ids.length
  batchProgress.value = 0
  showProgressModal.value = true
  let failed = 0
  try {
    for (const id of ids) {
      try {
        await api.deleteUser(id)
      } catch (e) {
        console.error('Failed to delete user:', id, e)
        failed++
      }
      batchProgress.value++
    }
    if (failed === 0) {
      appStore.showToast(`已删除 ${ids.length} 项`, 'success')
    } else {
      appStore.showToast(`已删除 ${ids.length - failed} 项，失败 ${failed} 项`, 'error')
    }
  } finally {
    showProgressModal.value = false
    exitEditMode()
    fetchUsers()
  }
}

async function confirmClearAll() {
  const ids = users.value.filter(u => u.username !== 'admin').map(u => u.id)
  try {
    await Promise.all(ids.map(id => api.deleteUser(id)))
    appStore.showToast('已清空全部用户（主管理员保留）', 'success')
  } catch (error) {
    console.error('Failed to clear users:', error)
    appStore.showToast('清空失败', 'error')
  } finally {
    showClearConfirm.value = false
    fetchUsers()
  }
}

onMounted(() => {
  fetchUsers()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="users-page">
    <div class="page-header">
      <h1 class="page-title">用户管理</h1>
      <div class="search-input-wrapper">
        <Search :size="16" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          name="user-search"
          autocomplete="off"
          placeholder="搜索用户..."
        />
      </div>
      <div v-if="!editMode" ref="actionDropdownRef" class="action-dropdown-wrapper">
        <button class="btn btn-primary action-main-btn" @click="openAddModal">
          <Plus :size="18" />
          添加用户
        </button>
        <span class="action-divider"></span>
        <button
          class="btn btn-primary action-toggle-btn"
          @click="showActionDropdown = !showActionDropdown"
        >
          <ChevronDown :size="14" />
        </button>
        <div v-if="showActionDropdown" class="action-dropdown-menu">
          <button class="action-dropdown-item" @click="enterEditMode">
            <Edit :size="14" />
            编辑
          </button>
          <button class="action-dropdown-item action-dropdown-danger" @click="requestClearAll">
            <Trash2 :size="14" />
            清空
          </button>
        </div>
      </div>
      <div v-else class="edit-toolbar">
        <label class="select-all-checkbox" @click.prevent="toggleSelectAll">
          <span class="item-checkbox" :class="{ checked: isAllSelected }">
            <Check :size="14" />
          </span>
          全选
        </label>
        <span class="selected-count">已选 {{ selectedIds.size }} 项</span>
        <button
          class="btn btn-danger btn-sm"
          :disabled="selectedIds.size === 0"
          @click="showBatchDeleteConfirm = true"
        >
          <Trash2 :size="14" />
          删除选中
        </button>
        <button class="btn btn-secondary btn-sm" @click="exitEditMode">取消</button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
    </div>

    <div v-else-if="filteredUsers.length === 0" class="empty-state">
      <div class="empty-icon">
        <Users :size="64" />
      </div>
      <h3 class="empty-title">{{ searchQuery ? '未找到匹配的用户' : '暂无用户数据' }}</h3>
      <p class="empty-description">{{ searchQuery ? '请尝试其他关键词' : '点击上方"添加用户"按钮开始添加用户' }}</p>
    </div>

    <div v-else class="user-list">
      <div
        v-for="user in filteredUsers"
        :key="user.id"
        class="user-item"
      >
        <div
          v-if="editMode && user.username !== 'admin'"
          class="item-checkbox"
          :class="{ checked: selectedIds.has(user.id) }"
          @click.stop="toggleSelect(user.id)"
        >
          <Check v-if="selectedIds.has(user.id)" :size="14" />
        </div>
        <div class="user-info">
          <div class="user-name-row">
            <h3 class="user-username">{{ user.name || user.username }}</h3>
            <span v-if="user.username === 'admin'" class="role-badge role-primary-admin">
              主管理员
            </span>
            <span v-else class="role-badge" :class="user.role === 'admin' ? 'role-admin' : 'role-customer'">
              {{ user.role === 'admin' ? '管理员' : '顾客' }}
            </span>
          </div>
          <div class="user-meta">
            <span v-if="user.phone" class="meta-item">{{ user.phone }}</span>
            <span class="meta-item meta-date">{{ formatDate(user.created_at) }}</span>
          </div>
        </div>

        <div v-if="user.username !== 'admin'" class="user-actions">
          <button class="action-btn" @click="openEditModal(user)">
            <Edit :size="16" />
          </button>
          <button class="action-btn action-btn-danger" @click="handleDelete(user)">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <Modal
      :show="showAddModal"
      :title="editingUser ? '编辑用户' : '添加用户'"
      size="sm"
      @close="showAddModal = false"
    >
      <div class="form-content">
        <div class="form-group">
          <label>用户名</label>
          <input
            v-model="formData.username"
            type="text"
            autocomplete="username"
            placeholder="请输入用户名"
            :disabled="!!editingUser"
          />
        </div>
        <div class="form-group">
          <label>密码{{ editingUser ? '（留空则不修改）' : '' }}</label>
          <input
            v-model="formData.password"
            type="password"
            autocomplete="new-password"
            :placeholder="editingUser ? '留空则不修改密码' : '请输入密码（至少6位）'"
          />
        </div>
        <div class="form-group">
          <label>
            称呼
            <span v-if="formData.role === 'customer' && !editingUser" class="required-mark">*</span>
          </label>
          <input
            v-model="formData.name"
            type="text"
            autocomplete="name"
            :placeholder="formData.role === 'customer' && !editingUser ? '请输入称呼' : '请输入称呼（可选）'"
          />
        </div>
        <div class="form-group">
          <label>
            手机号
            <span v-if="formData.role === 'customer' && !editingUser" class="required-mark">*</span>
          </label>
          <input
            v-model="formData.phone"
            type="text"
            autocomplete="tel"
            :placeholder="formData.role === 'customer' && !editingUser ? '请输入手机号' : '请输入手机号（可选）'"
          />
        </div>
        <div class="form-group">
          <label>角色</label>
          <select v-model="formData.role">
            <option value="admin">管理员</option>
            <option value="customer">顾客</option>
          </select>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showAddModal = false">取消</button>
        <button class="btn btn-primary" @click="handleSave">保存</button>
      </template>
    </Modal>

    <!-- Delete Confirm Dialog -->
    <ConfirmDialog
      :show="showDeleteConfirm"
      message="确定要删除该用户吗？"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirm = false"
    />

    <!-- Batch Delete Confirm Dialog -->
    <ConfirmDialog
      :show="showBatchDeleteConfirm"
      :message="`确定要删除选中的 ${selectedIds.size} 项吗？`"
      @confirm="confirmBatchDelete"
      @cancel="showBatchDeleteConfirm = false"
    />

    <!-- Clear All Confirm Dialog -->
    <ConfirmDialog
      :show="showClearConfirm"
      message="确定要清空全部用户吗？主管理员将保留，此操作不可恢复。"
      @confirm="confirmClearAll"
      @cancel="showClearConfirm = false"
    />

    <!-- Batch Delete Progress Modal -->
    <Modal :show="showProgressModal" title="正在删除" :closable="false" size="sm">
      <div class="progress-content">
        <div class="progress-bar-container">
          <div class="progress-bar-fill" :style="{ width: (batchTotal ? (batchProgress / batchTotal * 100) : 0) + '%' }"></div>
        </div>
        <p class="progress-text">正在删除 {{ batchProgress }}/{{ batchTotal }}...</p>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.users-page {
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 108px);
}

@media (min-width: 768px) {
  .users-page {
    min-height: calc(100vh - 48px);
  }
}

.page-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  margin-bottom: var(--spacing-xl);
  gap: var(--spacing-md);
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 280px;
  justify-self: center;
}

.search-input-wrapper .search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
  z-index: 1;
}

.search-input-wrapper input {
  padding: var(--spacing-sm) var(--spacing-md);
  padding-left: 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  width: 100%;
  background-color: transparent;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  justify-self: start;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3xl) var(--spacing-xl);
  text-align: center;
}

.empty-icon {
  width: 100px;
  height: 100px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-xl);
  color: var(--color-primary);
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.empty-description {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  max-width: 280px;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.user-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  transition: all var(--transition-fast);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.user-username {
  font-size: 1.125rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  flex-shrink: 0;
}

.role-primary-admin {
  background-color: #b91c1c;
  color: white;
}

.role-admin {
  background-color: var(--color-primary);
  color: white;
}

.role-customer {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.user-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.meta-item {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.meta-date {
  opacity: 0.7;
}

.user-actions {
  display: flex;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
}

.action-btn:hover {
  background-color: var(--color-bg-tertiary);
}

.action-btn-danger:hover {
  background-color: var(--color-error);
  color: white;
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

.form-group input,
.form-group select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.form-group select {
  padding-right: 2.5rem;
}

.form-group input:disabled {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-muted);
}

.required-mark {
  color: var(--color-error);
  margin-left: 2px;
}

.action-dropdown-wrapper {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  justify-self: end;
  min-width: 0;
}

.action-dropdown-wrapper .btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.action-main-btn {
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.action-toggle-btn {
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
  padding-left: var(--spacing-xs) !important;
  padding-right: var(--spacing-xs) !important;
  min-width: 32px;
  justify-content: center;
}

.action-divider {
  width: 1px;
  align-self: stretch;
  background-color: rgba(255, 255, 255, 0.3);
}

.action-dropdown-menu {
  position: absolute;
  top: calc(100% + var(--spacing-xs));
  right: 0;
  min-width: 120px;
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 100;
  padding: var(--spacing-xs);
  display: flex;
  flex-direction: column;
}

.action-dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: 0.875rem;
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  text-align: left;
  white-space: nowrap;
  transition: background-color var(--transition-fast);
  cursor: pointer;
}

.action-dropdown-item:hover {
  background-color: var(--color-bg-tertiary);
}

.action-dropdown-danger {
  color: var(--color-error);
}

.action-dropdown-danger:hover {
  background-color: rgba(220, 38, 38, 0.08);
}

.edit-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md);
  justify-content: flex-end;
  justify-self: end;
  min-width: 0;
}

.progress-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  align-items: center;
  padding: var(--spacing-sm) 0;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: var(--color-primary);
  transition: width var(--duration-fast) var(--ease-out);
}

.progress-text {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.select-all-checkbox {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
}

.selected-count {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.item-checkbox {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--transition-fast);
  color: transparent;
}

.item-checkbox.checked {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

@media (max-width: 640px) {
  .page-header {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
  }
  .page-title {
    grid-column: 1;
    grid-row: 1;
  }
  .action-dropdown-wrapper,
  .edit-toolbar {
    grid-column: 2;
    grid-row: 1;
  }
  .search-input-wrapper {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
    justify-self: stretch;
  }
  .user-meta {
    gap: var(--spacing-xs);
  }
}
</style>
