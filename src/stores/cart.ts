import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CartItem, Dish, OrderItem } from '@/types'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

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

  // Add item to cart（不可变操作：始终创建新数组）
  function addItem(dish: Dish, quantity: number = 1, spec: string | null = null) {
    const existingIndex = items.value.findIndex(
      (item: CartItem) => item.dish.id === dish.id && item.spec === spec
    )

    if (existingIndex >= 0) {
      // 不可变更新：仅替换匹配项，其余保持引用不变
      items.value = items.value.map((item, index) =>
        index === existingIndex
          ? { ...item, quantity: item.quantity + quantity }
          : item
      )
    } else {
      // 不可变追加：使用 spread 创建新数组
      items.value = [...items.value, { dish, quantity, spec }]
    }
  }

  // Remove item from cart（不可变操作：使用 filter 创建新数组）
  function removeItem(dishId: string, spec: string | null = null) {
    items.value = items.value.filter(
      (item: CartItem) => !(item.dish.id === dishId && item.spec === spec)
    )
  }

  // Update item quantity（不可变操作：使用 map 创建新数组）
  function updateQuantity(dishId: string, quantity: number, spec: string | null = null) {
    if (quantity <= 0) {
      removeItem(dishId, spec)
      return
    }
    // 不可变更新：仅替换匹配项，其余保持引用不变
    items.value = items.value.map((item: CartItem) =>
      item.dish.id === dishId && item.spec === spec
        ? { ...item, quantity }
        : item
    )
  }

  // Clear cart
  function clearCart() {
    items.value = []
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
  }

  return {
    items,
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
