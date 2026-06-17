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
  }

  // Remove item from cart
  function removeItem(dishId: string, spec: string | null = null) {
    const index = items.value.findIndex(
      (item: CartItem) => item.dish.id === dishId && item.spec === spec
    )
    if (index >= 0) {
      items.value.splice(index, 1)
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
      }
    }
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
