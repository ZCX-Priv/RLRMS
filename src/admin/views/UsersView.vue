<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/app'
import type { AdminUser } from '@/types'

const Modal = defineAsyncComponent(() => import('@/shared/components/Modal.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/shared/components/ConfirmDialog.vue'))
import { Plus, Edit, Trash2, Users, Search } from 'lucide-vue-next'

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

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter(user =>
    user.username.toLowerCase().includes(q) ||
    (user.name && user.name.toLowerCase().includes(q)) ||
    (user.phone && user.phone.includes(q))
  )
})

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

onMounted(() => {
  fetchUsers()
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
      <button class="btn btn-primary" @click="openAddModal">
        <Plus :size="18" />
        添加用户
      </button>
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
        <div class="user-info">
          <div class="user-name-row">
            <h3 class="user-username">{{ user.name || user.username }}</h3>
            <span class="role-badge" :class="user.role === 'admin' ? 'role-admin' : 'role-customer'">
              {{ user.role === 'admin' ? '管理员' : '顾客' }}
            </span>
          </div>
          <div class="user-meta">
            <span v-if="user.name" class="meta-item">{{ user.username }}</span>
            <span v-if="user.phone" class="meta-item">{{ user.phone }}</span>
            <span class="meta-item meta-date">{{ formatDate(user.created_at) }}</span>
          </div>
        </div>

        <div class="user-actions">
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
  </div>
</template>

<style scoped>
.users-page {
  max-width: 1200px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
  gap: var(--spacing-md);
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 280px;
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
  background: linear-gradient(135deg, var(--color-primary-light, rgba(220, 38, 38, 0.1)) 0%, var(--color-bg-tertiary) 100%);
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

.form-group input:disabled {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-muted);
}

.required-mark {
  color: var(--color-error);
  margin-left: 2px;
}

@media (max-width: 640px) {
  .page-header {
    flex-wrap: wrap;
  }
  .search-input-wrapper {
    order: 3;
    flex-basis: 100%;
    max-width: 100%;
  }
  .user-meta {
    gap: var(--spacing-xs);
  }
}
</style>
