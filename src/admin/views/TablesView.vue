<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/app'
import type { Table } from '@/types'

const Modal = defineAsyncComponent(() => import('@/shared/components/Modal.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/shared/components/ConfirmDialog.vue'))
import { Plus, Edit, Trash2, Users, Armchair, Search, ChevronDown, Check } from 'lucide-vue-next'

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

const actionDropdownRef = ref<HTMLElement | null>(null)
const showActionDropdown = ref(false)
const editMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const showClearConfirm = ref(false)
const showBatchDeleteConfirm = ref(false)
const showProgressModal = ref(false)
const batchProgress = ref(0)
const batchTotal = ref(0)

const selectableTables = computed(() => filteredTables.value)

const isAllSelected = computed(() =>
  selectableTables.value.length > 0 &&
  selectableTables.value.every(t => selectedIds.value.has(t.id))
)

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
    selectedIds.value.clear()
  } else {
    selectableTables.value.forEach(t => selectedIds.value.add(t.id))
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
        await api.deleteTable(id)
      } catch (e) {
        console.error('Failed to delete table:', id, e)
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
    fetchTables(false)
  }
}

async function confirmClearAll() {
  const ids = tables.value.map(t => t.id)
  try {
    await Promise.all(ids.map(id => api.deleteTable(id)))
    appStore.showToast('已清空全部桌位', 'success')
  } catch (error) {
    console.error('Failed to clear tables:', error)
    appStore.showToast('清空失败', 'error')
  } finally {
    showClearConfirm.value = false
    fetchTables(false)
  }
}

onMounted(() => {
  fetchTables()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
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
      <div v-if="!editMode" ref="actionDropdownRef" class="action-dropdown-wrapper">
        <button class="btn btn-primary action-main-btn" @click="openAddModal">
          <Plus :size="18" />
          添加桌位
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
        <div
          v-if="editMode"
          class="item-checkbox"
          :class="{ checked: selectedIds.has(table.id) }"
          @click.stop="toggleSelect(table.id)"
        >
          <Check v-if="selectedIds.has(table.id)" :size="14" />
        </div>
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
          <label>桌位名称</label>
          <input v-model="formData.name" type="text" placeholder="如: 1号桌" />
        </div>
        <div class="form-group">
          <label>桌位编号</label>
          <input v-model="formData.table_no" type="text" placeholder="如: T1" />
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
      message="确定要清空全部桌位吗？此操作不可恢复。"
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
.tables-page {
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 108px);
}

@media (min-width: 768px) {
  .tables-page {
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

.table-card .item-checkbox {
  position: absolute;
  top: var(--spacing-sm);
  left: var(--spacing-sm);
  z-index: 1;
}

.table-card .item-checkbox:not(.checked) {
  background-color: var(--color-bg-primary);
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
}
</style>
