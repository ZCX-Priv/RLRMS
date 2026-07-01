import { defineStore } from 'pinia'
import { ref, computed, watch, toRaw } from 'vue'
import type { CartItem, Dish, OrderItem } from '@/types'
import { getItem as dbGet, setItem as dbSet, removeItem as dbRemove } from '@/utils/storage'

/** 用于对比的简化项结构 */
interface ItemSnapshot {
  dishId: string
  quantity: number
  spec: string | null
}

const CART_ITEMS_KEY = 'cart_items'
const CART_ORDER_ID_KEY = 'cart_add_dish_order_id'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const addDishOrderId = ref<string | null>(null)
  const restored = ref(false)
  const originalItems = ref<ItemSnapshot[]>([])

  // Get total price
  const totalAmount = computed(() => {
    return items.value.reduce((sum, item) => {
      const price = Number(item.dish.price)
      return sum + (isNaN(price) ? 0 : price) * item.quantity
    }, 0)
  })

  // Get total count
  const totalCount = computed(() => {
    return items.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  // Add item to cart
  function addItem(dish: Dish, quantity: number = 1, spec: string | null = null) {
    const existingIndex = items.value.findIndex(
      (item: CartItem) => item.dish.id === dish.id && item.spec === spec
    )

    if (existingIndex >= 0) {
      const existingItem = items.value[existingIndex]
      if (existingItem) {
        existingItem.quantity += quantity
      }
    } else {
      items.value.push({ dish, quantity, spec })
    }
    saveItems()
  }

  // Remove item from cart
  function removeItem(dishId: string, spec: string | null = null) {
    const index = items.value.findIndex(
      (item: CartItem) => item.dish.id === dishId && item.spec === spec
    )
    if (index >= 0) {
      items.value.splice(index, 1)
      saveItems()
    }
  }

  // Update item quantity
  function updateQuantity(dishId: string, quantity: number, spec: string | null = null) {
    const item = items.value.find(
      (item: CartItem) => item.dish.id === dishId && item.spec === spec
    )
    if (item) {
      if (quantity <= 0) {
        removeItem(dishId, spec)
      } else {
        item.quantity = quantity
        saveItems()
      }
    }
  }

  // Clear cart
  function clearCart() {
    items.value = []
    addDishOrderId.value = null
    originalItems.value = []
    saveItems()
    saveOrderId()
  }

  // Get items for order submission
  function getOrderItems() {
    return items.value.map(item => {
      const price = Number(item.dish.price)
      const unitPrice = isNaN(price) ? 0 : price
      return {
        dish_id: item.dish.id,
        dish_name: item.dish.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: unitPrice * item.quantity,
        spec: item.spec || undefined,
      }
    })
  }

  function setItemsFromOrder(orderItems: OrderItem[]): void {
    items.value = orderItems.map((item: OrderItem) => ({
      dish: {
        id: item.dish_id,
        name: item.dish_name,
        price: item.unit_price,
        image_url: null,
        category_id: null,
        category_name: null,
        description: null,
        tags: [],
        specs: [],
        status: 'on_sale' as const,
        sort_order: 0,
        created_at: '',
        updated_at: '',
      },
      quantity: item.quantity,
      spec: item.spec,
    }))
    // 保存原始快照用于变更对比
    originalItems.value = orderItems.map((item: OrderItem) => ({
      dishId: item.dish_id,
      quantity: item.quantity,
      spec: item.spec,
    }))
    saveItems()
  }

  /** 检测当前购物车相对于原始订单是否有改动 */
  const hasCartChanged = computed(() => {
    if (!addDishOrderId.value) return true // 新建订单无需对比
    const currentMap = new Map<string, number>()
    for (const item of items.value) {
      const key = `${item.dish.id}|${item.spec || ''}`
      currentMap.set(key, item.quantity)
    }
    if (currentMap.size !== originalItems.value.length) return true
    for (const orig of originalItems.value) {
      const key = `${orig.dishId}|${orig.spec || ''}`
      if (currentMap.get(key) !== orig.quantity) return true
    }
    return false
  })

  // 显式保存：使用 JSON 序列化剥离 Vue reactive Proxy，确保纯对象写入 IndexedDB
  function saveItems() {
    if (!restored.value) return
    const raw = JSON.parse(JSON.stringify(toRaw(items.value)))
    if (raw.length === 0) {
      dbRemove(CART_ITEMS_KEY).catch(console.error)
    } else {
      dbSet(CART_ITEMS_KEY, raw).catch(console.error)
    }
  }

  function saveOrderId() {
    if (!restored.value) return
    if (addDishOrderId.value === null) {
      dbRemove(CART_ORDER_ID_KEY).catch(console.error)
    } else {
      dbSet(CART_ORDER_ID_KEY, addDishOrderId.value).catch(console.error)
    }
  }

  // Restore cart from IndexedDB on store init
  async function restore() {
    try {
      const [savedItems, savedOrderId] = await Promise.all([
        dbGet<CartItem[]>(CART_ITEMS_KEY),
        dbGet<string>(CART_ORDER_ID_KEY),
      ])
      if (savedItems && savedItems.length > 0) {
        items.value = savedItems
      }
      if (savedOrderId) {
        addDishOrderId.value = savedOrderId
      }
    } catch {
      // IndexedDB 不可用时静默忽略
    } finally {
      restored.value = true
    }
  }

  // 防抖兜底 watcher：捕获显式 saveItems() 遗漏的变更路径
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(items, () => {
    if (!restored.value) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveItems, 100)
  }, { deep: true })

  // watch addDishOrderId for persistence
  watch(addDishOrderId, () => {
    if (!restored.value) return
    saveOrderId()
  })

  // Trigger restore immediately
  restore()

  return {
    items,
    addDishOrderId,
    restored,
    totalAmount,
    totalCount,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getOrderItems,
    setItemsFromOrder,
    hasCartChanged,
  }
})
