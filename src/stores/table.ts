import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Table } from '@/types'

export const useTableStore = defineStore('table', () => {
  const selectedTable = ref<Table | null>(null)

  const isTableSelected = computed(() => selectedTable.value !== null)

  function selectTable(table: Table | null) {
    selectedTable.value = table
  }

  function clearSelection() {
    selectedTable.value = null
  }

  return {
    selectedTable,
    isTableSelected,
    selectTable,
    clearSelection,
  }
})
