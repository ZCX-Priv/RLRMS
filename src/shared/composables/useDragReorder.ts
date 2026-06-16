import { ref, type Ref } from 'vue'

interface DragItem {
  id: string
  [key: string]: unknown
}

interface UseDragReorderOptions<T extends DragItem> {
  items: Ref<T[]>
  onReorder: (orders: { id: string; sort_order: number }[]) => Promise<void>
}

export function useDragReorder<T extends DragItem>(options: UseDragReorderOptions<T>) {
  const { items, onReorder } = options
  
  const draggedIndex = ref<number | null>(null)
  const dragOverIndex = ref<number | null>(null)
  const isDragging = ref(false)
  const isSaving = ref(false)

  function handleDragStart(event: DragEvent, index: number) {
    draggedIndex.value = index
    isDragging.value = true
    
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(index))
    }
    
    const target = event.target as HTMLElement
    target.classList.add('dragging')
  }

  function handleDragEnd(event: DragEvent) {
    const target = event.target as HTMLElement
    target.classList.remove('dragging')
    draggedIndex.value = null
    dragOverIndex.value = null
    isDragging.value = false
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
    dragOverIndex.value = index
  }

  function handleDragLeave() {
    dragOverIndex.value = null
  }

  async function handleDrop(event: DragEvent, targetIndex: number) {
    event.preventDefault()
    
    const sourceIndex = draggedIndex.value
    if (sourceIndex === null || sourceIndex === targetIndex) {
      draggedIndex.value = null
      dragOverIndex.value = null
      isDragging.value = false
      return
    }

    const newItems = [...items.value]
    const removedItems = newItems.splice(sourceIndex, 1)
    if (removedItems.length === 0) {
      draggedIndex.value = null
      dragOverIndex.value = null
      isDragging.value = false
      return
    }
    const removed = removedItems[0]!
    newItems.splice(targetIndex, 0, removed)
    
    items.value = newItems
    
    const orders = newItems.map((item, index) => ({
      id: item.id,
      sort_order: index
    }))
    
    isSaving.value = true
    try {
      await onReorder(orders)
    } catch (error) {
      console.error('Failed to save order:', error)
    } finally {
      isSaving.value = false
    }
    
    draggedIndex.value = null
    dragOverIndex.value = null
    isDragging.value = false
  }

  return {
    draggedIndex,
    dragOverIndex,
    isDragging,
    isSaving,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}
