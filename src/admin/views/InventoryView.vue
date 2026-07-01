<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/app'
import type { InventoryItem } from '@/types'
import draggable from 'vuedraggable'

const Modal = defineAsyncComponent(() => import('@/shared/components/Modal.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/shared/components/ConfirmDialog.vue'))
import { Plus, Edit, Trash2, AlertTriangle, Package, GripVertical, Search, ChevronDown, Check } from 'lucide-vue-next'

const appStore = useAppStore()

const inventory = ref<InventoryItem[]>([])
const loading = ref(true)
const showAddModal = ref(false)
const editingItem = ref<InventoryItem | null>(null)
const showDeleteConfirm = ref(false)
const itemToDelete = ref<InventoryItem | null>(null)
const formData = ref({
  material_name: '',
  quantity: 0,
  unit: '',
  warning_threshold: 0,
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

const filteredInventory = computed(() => {
  if (!searchQuery.value) return inventory.value
  const q = searchQuery.value.toLowerCase()
  return inventory.value.filter(item => item.material_name.toLowerCase().includes(q))
})

const isAllSelected = computed(() =>
  filteredInventory.value.length > 0 &&
  filteredInventory.value.every(item => selectedIds.value.has(item.id))
)

async function onInventoryDragEnd(event: { oldIndex: number; newIndex: number }) {
  if (event.oldIndex === event.newIndex) return
  
  const orders = inventory.value.map((item, index) => ({
    id: item.id,
    sort_order: index
  }))
  
  try {
    await api.reorderInventory(orders)
  } catch (error) {
    console.error('Failed to save order:', error)
    appStore.showToast('排序保存失败', 'error')
    fetchInventory()
  }
}

async function fetchInventory() {
  try {
    loading.value = true
    const res = await api.getInventory()
    inventory.value = res.data
  } catch (error) {
    console.error('Failed to fetch inventory:', error)
    appStore.showToast('获取库存失败', 'error')
  } finally {
    loading.value = false
  }
}

function openAddModal() {
  editingItem.value = null
  formData.value = {
    material_name: '',
    quantity: 0,
    unit: '',
    warning_threshold: 0,
  }
  showAddModal.value = true
}

function openEditModal(item: InventoryItem) {
  editingItem.value = item
  formData.value = {
    material_name: item.material_name,
    quantity: item.quantity,
    unit: item.unit,
    warning_threshold: item.warning_threshold,
  }
  showAddModal.value = true
}

async function handleSave() {
  try {
    if (editingItem.value) {
      await api.updateInventoryItem(editingItem.value.id, {
        quantity: formData.value.quantity,
        warning_threshold: formData.value.warning_threshold,
      })
      appStore.showToast('库存已更新', 'success')
    } else {
      await api.createInventoryItem(formData.value)
      appStore.showToast('物料已添加', 'success')
    }
    showAddModal.value = false
    fetchInventory()
  } catch (error) {
    console.error('Failed to save inventory:', error)
    const errorMessage = error instanceof Error ? error.message : '操作失败'
    appStore.showToast(errorMessage, 'error')
  }
}

function handleDelete(item: InventoryItem) {
  itemToDelete.value = item
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!itemToDelete.value) return
  try {
    await api.deleteInventoryItem(itemToDelete.value.id)
    appStore.showToast('物料已删除', 'success')
    showDeleteConfirm.value = false
    itemToDelete.value = null
    fetchInventory()
  } catch (error) {
    console.error('Failed to delete inventory:', error)
    appStore.showToast('删除失败', 'error')
  }
}

function isLowStock(item: InventoryItem) {
  return item.quantity <= item.warning_threshold
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
    filteredInventory.value.forEach(item => selectedIds.value.delete(item.id))
  } else {
    filteredInventory.value.forEach(item => selectedIds.value.add(item.id))
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
        await api.deleteInventoryItem(id)
      } catch (e) {
        console.error('Failed to delete inventory item:', id, e)
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
    fetchInventory()
  }
}

async function confirmClearAll() {
  const ids = inventory.value.map(item => item.id)
  try {
    await Promise.all(ids.map(id => api.deleteInventoryItem(id)))
    appStore.showToast('已清空全部物料', 'success')
  } catch (error) {
    console.error('Failed to clear inventory:', error)
    appStore.showToast('清空失败', 'error')
  } finally {
    showClearConfirm.value = false
    fetchInventory()
  }
}

onMounted(() => {
  fetchInventory()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="inventory-page">
    <div class="page-header">
      <h1 class="page-title">库存管理</h1>
      <div class="search-input-wrapper">
        <Search :size="16" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索物料..."
        />
      </div>
      <div v-if="!editMode" ref="actionDropdownRef" class="action-dropdown-wrapper">
        <button class="btn btn-primary action-main-btn" @click="openAddModal">
          <Plus :size="18" />
          添加物料
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

    <div v-else-if="filteredInventory.length === 0" class="empty-state">
      <div class="empty-icon">
        <Package :size="64" />
      </div>
      <h3 class="empty-title">{{ searchQuery ? '未找到匹配的物料' : '暂无库存数据' }}</h3>
      <p class="empty-description">{{ searchQuery ? '请尝试其他关键词' : '点击上方“添加物料”按钮开始添加库存' }}</p>
    </div>

    <draggable
      v-else
      v-model="filteredInventory"
      item-key="id"
      class="inventory-list"
      :animation="200"
      ghost-class="ghost-inventory"
      handle=".drag-handle-inventory"
      :disabled="editMode || !!searchQuery"
      @end="onInventoryDragEnd"
    >
      <template #item="{ element: item }">
        <div
          class="inventory-item"
          :class="{ 'low-stock': isLowStock(item) }"
        >
          <div
            v-if="editMode"
            class="item-checkbox"
            :class="{ checked: selectedIds.has(item.id) }"
            @click.stop="toggleSelect(item.id)"
          >
            <Check v-if="selectedIds.has(item.id)" :size="14" />
          </div>
          <div class="drag-handle-inventory">
            <GripVertical :size="16" />
          </div>
          <div class="item-info">
            <h3 class="item-name">
              {{ item.material_name }}
              <AlertTriangle
                v-if="isLowStock(item)"
                :size="16"
                class="warning-icon"
              />
            </h3>
          </div>

          <div class="item-quantity">
            库存：{{ item.quantity }} {{ item.unit }}
          </div>

          <div class="item-threshold">
            预警阈值: {{ item.warning_threshold }} {{ item.unit }}
          </div>

          <div class="item-actions">
            <button class="action-btn" @click="openEditModal(item)">
              <Edit :size="16" />
            </button>
            <button class="action-btn action-btn-danger" @click="handleDelete(item)">
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
      </template>
    </draggable>

    <!-- Add/Edit Modal -->
    <Modal
      :show="showAddModal"
      :title="editingItem ? '编辑物料' : '添加物料'"
      size="sm"
      @close="showAddModal = false"
    >
      <div class="form-content">
        <div class="form-group">
          <label>物料名称</label>
          <input
            v-model="formData.material_name"
            type="text"
            placeholder="请输入物料名称"
            :disabled="!!editingItem"
          />
        </div>
        <div class="form-group">
          <label>数量</label>
          <input v-model="formData.quantity" type="number" min="0" step="0.01" />
        </div>
        <div class="form-group">
          <label>单位</label>
          <input
            v-model="formData.unit"
            type="text"
            placeholder="如: kg、个、瓶"
            :disabled="!!editingItem"
          />
        </div>
        <div class="form-group">
          <label>预警阈值</label>
          <input v-model="formData.warning_threshold" type="number" min="0" step="0.01" />
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
      message="确定要删除该物料吗？"
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
      message="确定要清空全部物料吗？此操作不可恢复。"
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
.inventory-page {
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 108px);
}

@media (min-width: 768px) {
  .inventory-page {
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

.inventory-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.inventory-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  border-left: 4px solid transparent;
  cursor: grab;
  transition: all var(--transition-fast);
}

.inventory-item:active {
  cursor: grabbing;
}

.ghost-inventory {
  opacity: 0.5;
  background: var(--color-primary-light, rgba(220, 38, 38, 0.1));
  border-radius: var(--radius-lg);
}

.inventory-item.low-stock {
  border-left-color: var(--color-warning);
  background-color: rgba(202, 138, 4, 0.05);
}

.drag-handle-inventory {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  opacity: 0.4;
  cursor: grab;
  flex-shrink: 0;
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.drag-handle-inventory:hover {
  opacity: 1;
  background-color: var(--color-bg-tertiary);
}

.item-info {
  flex: 1;
}

.item-name {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 1.125rem;
  font-weight: 600;
}

.warning-icon {
  color: var(--color-warning);
}

.item-quantity {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  min-width: 100px;
}

.item-threshold {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  min-width: 100px;
}

.item-actions {
  display: flex;
  gap: var(--spacing-xs);
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

.form-group input:disabled {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-muted);
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
}
</style>
