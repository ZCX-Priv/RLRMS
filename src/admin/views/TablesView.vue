<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/app'
import type { Table } from '@/types'

const Modal = defineAsyncComponent(() => import('@/shared/components/Modal.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/shared/components/ConfirmDialog.vue'))
import { Plus, Edit, Trash2, Users, Armchair, Search } from 'lucide-vue-next'

interface TableWithOrder extends Table {
  current_order?: string
}

const appStore = useAppStore()

const tables = ref<TableWithOrder[]>([])
const loading = ref(true)
const initialized = ref(false)
const showAddModal = ref(false)
const editingTable = ref<TableWithOrder | null>(null)
const showDeleteConfirm = ref(false)
const tableToDelete = ref<TableWithOrder | null>(null)
const formData = ref({
  table_no: '',
  name: '',
  capacity: 4,
})

const searchQuery = ref('')

const filteredTables = computed(() => {
  const sortFn = (a: Table, b: Table) => {
    const aStartsWithDigit = /^\d/.test(a.table_no)
    const bStartsWithDigit = /^\d/.test(b.table_no)
    if (aStartsWithDigit !== bStartsWithDigit) return aStartsWithDigit ? 1 : -1
    return a.table_no.localeCompare(b.table_no, 'zh-CN', { numeric: true })
  }
  if (!searchQuery.value) return [...tables.value].sort(sortFn)
  const q = searchQuery.value.toLowerCase()
  return tables.value
    .filter(t => t.name.toLowerCase().includes(q) || t.table_no.toLowerCase().includes(q))
    .sort(sortFn)
})

const statusColor: Record<string, string> = {
  available: 'var(--color-table-available)',
  reserved: 'var(--color-table-reserved)',
  occupied: 'var(--color-table-occupied)',
}

const statusText: Record<string, string> = {
  available: '可用',
  reserved: '已预订',
  occupied: '占用中',
}

async function fetchTables(showLoading = true) {
  try {
    if (showLoading && !initialized.value) {
      loading.value = true
    }
    const res = await api.getAdminTables()
    tables.value = res.data
    initialized.value = true
  } catch (error) {
    console.error('Failed to fetch tables:', error)
    appStore.showToast('获取桌位失败', 'error')
  } finally {
    loading.value = false
  }
}

function openAddModal() {
  editingTable.value = null
  formData.value = { table_no: '', name: '', capacity: 4 }
  showAddModal.value = true
}

function openEditModal(table: TableWithOrder) {
  editingTable.value = table
  formData.value = {
    table_no: table.table_no,
    name: table.name,
    capacity: table.capacity,
  }
  showAddModal.value = true
}

async function handleSave() {
  try {
    if (editingTable.value) {
      const res = await api.updateTable(editingTable.value.id, formData.value)
      const index = tables.value.findIndex(t => t.id === editingTable.value!.id)
      if (index !== -1 && res.data) {
        tables.value[index] = { ...tables.value[index], ...res.data }
      }
      appStore.showToast('桌位信息已更新', 'success')
    } else {
      const res = await api.createTable(formData.value)
      if (res.data) {
        tables.value.push(res.data)
      }
      appStore.showToast('桌位已创建', 'success')
    }
    showAddModal.value = false
  } catch (error) {
    console.error('Failed to save table:', error)
    const errorMessage = error instanceof Error ? error.message : '操作失败'
    appStore.showToast(errorMessage, 'error')
  }
}

function handleDelete(table: TableWithOrder) {
  tableToDelete.value = table
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!tableToDelete.value) return
  const tableId = tableToDelete.value.id
  const index = tables.value.findIndex(t => t.id === tableId)
  const deletedTable = index !== -1 ? tables.value[index] : null
  
  if (index !== -1) {
    tables.value.splice(index, 1)
  }
  
  try {
    await api.deleteTable(tableId)
    appStore.showToast('桌位已删除', 'success')
  } catch (error) {
    console.error('Failed to delete table:', error)
    if (deletedTable && index !== -1) {
      tables.value.splice(index, 0, deletedTable)
    }
    appStore.showToast('删除失败', 'error')
  } finally {
    showDeleteConfirm.value = false
    tableToDelete.value = null
  }
}

async function handleStatusChange(table: TableWithOrder, status: string) {
  const index = tables.value.findIndex(t => t.id === table.id)
  const previousStatus = table.status
  
  if (index !== -1) {
    tables.value[index] = { ...tables.value[index]!, status: status as Table['status'] }
  }
  
  try {
    await api.updateTableStatus(table.id, status)
    appStore.showToast('桌位状态已更新', 'success')
  } catch (error) {
    console.error('Failed to update status:', error)
    if (index !== -1) {
      tables.value[index] = { ...tables.value[index]!, status: previousStatus }
    }
    appStore.showToast('更新失败', 'error')
  }
}

onMounted(() => {
  fetchTables()
})
</script>

<template>
  <div class="tables-page">
    <div class="page-header">
      <h1 class="page-title">桌位管理</h1>
      <div class="search-input-wrapper">
        <Search :size="16" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索桌位..."
        />
      </div>
      <button class="btn btn-primary" @click="openAddModal">
        <Plus :size="18" />
        添加桌位
      </button>
    </div>

    <div v-if="loading && !initialized" class="loading-state">
      <div class="loading-spinner"></div>
    </div>

    <div v-else-if="initialized && filteredTables.length === 0" class="empty-state">
      <div class="empty-icon">
        <Armchair :size="64" />
      </div>
      <h3 class="empty-title">{{ searchQuery ? '未找到匹配的桌位' : '暂无桌位' }}</h3>
      <p class="empty-description">{{ searchQuery ? '请尝试其他关键词' : '点击上方按钮添加第一个桌位' }}</p>
    </div>

    <div v-else class="tables-grid">
      <div
        v-for="table in filteredTables"
        :key="table.id"
        class="table-card"
        :style="{ borderColor: statusColor[table.status] }"
      >
        <div class="table-status" :style="{ backgroundColor: statusColor[table.status] }">
          {{ statusText[table.status] }}
        </div>
        
        <h3 class="table-name">{{ table.name }}</h3>
        <p class="table-no">编号: {{ table.table_no }}</p>
        <div class="table-capacity">
          <Users :size="16" />
          {{ table.capacity }}人
        </div>

        <div class="table-actions">
          <select
            :value="table.status"
            class="status-select"
            @change="handleStatusChange(table, ($event.target as HTMLSelectElement).value)"
          >
            <option value="available">可用</option>
            <option value="reserved">已预订</option>
            <option value="occupied">占用中</option>
          </select>
          <button class="action-btn" @click="openEditModal(table)">
            <Edit :size="16" />
          </button>
          <button class="action-btn action-btn-danger" @click="handleDelete(table)">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <Modal
      :show="showAddModal"
      :title="editingTable ? '编辑桌位' : '添加桌位'"
      size="sm"
      @close="showAddModal = false"
    >
      <div class="form-content">
        <div class="form-group">
          <label>桌位编号</label>
          <input v-model="formData.table_no" type="text" placeholder="如: T1" />
        </div>
        <div class="form-group">
          <label>桌位名称</label>
          <input v-model="formData.name" type="text" placeholder="如: 1号桌" />
        </div>
        <div class="form-group">
          <label>容纳人数</label>
          <input v-model="formData.capacity" type="number" min="1" />
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
      message="确定要删除该桌位吗？"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<style scoped>
.tables-page {
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

.tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.table-card {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  position: relative;
  border: 2px solid transparent;
}

.table-status {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  padding: 2px var(--spacing-sm);
  font-size: 0.625rem;
  border-radius: var(--radius-full);
  color: white;
}

.table-name {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: var(--spacing-xs);
}

.table-no {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-sm);
}

.table-capacity {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
}

.table-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.status-select {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  background-color: var(--color-bg-primary);
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

.form-group input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
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
}
</style>
