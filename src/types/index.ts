// API Types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// User Types
export interface User {
  id: string
  username: string
  role: 'customer' | 'admin'
  name: string | null
  phone: string | null
}

// Admin User (for user management page)
export interface AdminUser {
  id: string
  username: string
  role: 'customer' | 'admin'
  name: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  token: string
  user: User
}

// Table Types
export interface Table {
  id: string
  table_no: string
  name: string
  status: 'available' | 'occupied' | 'reserved'
  capacity: number
  created_at: string
  updated_at: string
}

// Category Types
export interface Category {
  id: string
  name: string
  sort_order: number
  created_at: string
}

// Dish Types
export interface Dish {
  id: string
  name: string
  price: number | string
  image_url: string | null
  category_id: string | null
  category_name: string | null
  description: string | null
  tags: string[]
  specs: string[]
  status: 'on_sale' | 'off_sale'
  sort_order: number
  created_at: string
  updated_at: string
}

// Order Types
export interface OrderItem {
  id: string
  order_id: string
  dish_id: string
  dish_name: string
  quantity: number
  unit_price: number
  subtotal: number
  spec: string | null
}

export interface OrderModification {
  id: string
  order_id: string
  dish_id: string
  dish_name: string
  quantity_delta: number
  unit_price: number
  spec: string | null
  created_at: string
}

export interface Order {
  id: string
  order_no: string
  table_id: string | null
  table_name: string | null
  table_no: string | null
  user_id: string | null
  dining_time: '中午' | '晚上' | null
  contact_name: string | null
  contact_phone: string | null
  total_amount: number
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  items: OrderItem[]
  modifications?: OrderModification[]
}

// Inventory Types
export interface InventoryItem {
  id: string
  material_name: string
  quantity: number
  unit: string
  warning_threshold: number
  created_at: string
  updated_at: string
}

// Cart Types
export interface CartItem {
  dish: Dish
  quantity: number
  spec: string | null
}

// Dashboard Stats
export interface DashboardStats {
  todayOrders: number
  todayRevenue: number
  pendingOrders: number
  availableTables: number
  recentOrders: Order[]
}

// Contact/Card Types
export interface ContactCard {
  id: string
  name: string
  phone: string
  title: string
}
