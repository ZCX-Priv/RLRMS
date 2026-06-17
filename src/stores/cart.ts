import { defineStore } from 'pinia'
import { ref, computed, watch, toRaw } from 'vue'
import type { CartItem, Dish, OrderItem } from '@/types'
import { getItem as dbGet, setItem as dbSet, removeItem as dbRemove } from '@/utils/storage'

const CART_ITEMS_KEY = 'cart_items'
const CART_ORDER_ID_KEY = 'cart_add_dish_order_id'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const addDishOrderId = ref<string | null>(null)
  const restored = ref(false)

  // Get total price
  const totalAmount = computed(() => {
    return items.value.reduce((sum, item) => {
      return sum + item.dish.price * item.quantity
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
    saveItems()
    saveOrderId()
  }

  // Get items for order submission
  function getOrderItems() {
    return items.value.map(item => ({
      dish_id: item.dish.id,
      dish_name: item.dish.name,
      quantity: item.quantity,
      unit_price: item.dish.price,
      subtotal: item.dish.price * item.quantity,
      spec: item.spec || undefined,
    }))
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
    saveItems()
  }

  // 显式保存：使用 JSON 序列化/反序列化彻底剥离所有层级的 Vue reactive Proxy，
  // 确保传入 IndexedDB 的是纯对象，避免结构化克隆失败
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

  // watch 作为兜底（主要保存已在各操作函数中显式调用）
  watch(items, () => {
    if (!restored.value) return
    saveItems()
  }, { deep: true })

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
  }
})
