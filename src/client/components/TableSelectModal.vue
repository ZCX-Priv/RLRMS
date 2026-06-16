<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/api'
import { useTableStore } from '@/stores/table'
import { useAppStore } from '@/stores/app'
import type { Table } from '@/types'
import Modal from '@/shared/components/Modal.vue'
import { Check, Ban } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
  onSelect?: () => void
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const tableStore = useTableStore()
const appStore = useAppStore()

const tables = ref<Table[]>([])
const loading = ref(true)
const selectedTableId = ref<string | null>(null)

async function fetchTables() {
  try {
    loading.value = true
    const res = await api.getTables()
    tables.value = res.data
  } catch (error) {
    console.error('Failed to fetch tables:', error)
    appStore.showToast('获取桌位失败', 'error')
  } finally {
    loading.value = false
  }
}

function getTableStatusIcon(status: string) {
  switch (status) {
    case 'available':
      return Check
    case 'reserved':
      return Ban
    default:
      return Ban
  }
}

function getTableStatusColor(status: string) {
  switch (status) {
    case 'available':
      return 'var(--color-table-available)'
    case 'reserved':
      return 'var(--color-table-reserved)'
    default:
      return 'var(--color-table-occupied)'
  }
}

function handleSelect(table: Table) {
  if (table.status === 'available') {
    selectedTableId.value = table.id
  }
}

function handleConfirm() {
  const table = tables.value.find(t => t.id === selectedTableId.value)
  if (table) {
    tableStore.selectTable(table)
    emit('update:show', false)
    appStore.showToast(`已选择 ${table.name}`, 'success')
    if (props.onSelect) {
      props.onSelect()
    }
  }
}

function handleCancel() {
  selectedTableId.value = tableStore.selectedTable?.id || null
  emit('update:show', false)
}

onMounted(() => {
  fetchTables()
  selectedTableId.value = tableStore.selectedTable?.id || null
})
</script>

<template>
  <Modal
    :show="show"
    title="请选择桌位"
    size="md"
    @close="handleCancel"
  >
    <div class="table-grid">
      <button
        v-for="table in tables"
        :key="table.id"
        class="table-item"
        :class="{
          'table-item-disabled': table.status !== 'available',
          'table-item-selected': selectedTableId === table.id
        }"
        @click="handleSelect(table)"
        :disabled="table.status !== 'available'"
      >
        <div class="table-icon">
          <component
            :is="getTableStatusIcon(table.status)"
            :size="20"
            :color="getTableStatusColor(table.status)"
          />
        </div>
        <span class="table-name">{{ table.name }}</span>
        <span class="table-capacity">{{ table.capacity }}人</span>
      </button>
    </div>
    
    <div class="legend">
      <div class="legend-item">
        <span class="legend-dot legend-available"></span>
        <span>可预订</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot legend-reserved"></span>
        <span>已预订</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot legend-occupied"></span>
        <span>已占用</span>
      </div>
    </div>

    <template #footer>
      <button class="btn btn-secondary" @click="handleCancel">取消</button>
      <button
        class="btn btn-primary"
        :disabled="!selectedTableId"
        @click="handleConfirm"
      >
        确定
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.table-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
}

.table-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background-color: var(--color-bg-tertiary);
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.table-item:hover:not(:disabled) {
  border-color: var(--color-primary);
  background-color: var(--color-bg-secondary);
}

.table-item-selected {
  border-color: var(--color-primary);
  background-color: var(--color-bg-secondary);
}

.table-item-disabled {
  opacity: 0.5;
}

.table-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--color-bg-secondary);
}

.table-name {
  font-size: 0.875rem;
  font-weight: 500;
}

.table-capacity {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.legend {
  display: flex;
  justify-content: center;
  gap: var(--spacing-lg);
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-available {
  background-color: var(--color-table-available);
}

.legend-reserved {
  background-color: var(--color-table-reserved);
}

.legend-occupied {
  background-color: var(--color-table-occupied);
}
</style>
