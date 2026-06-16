import { z } from 'zod'

// 中国大陆手机号正则（宽松匹配，支持虚拟运营商）
const phoneRegex = /^1[3-9]\d{9}$/

export const createOrderSchema = z.object({
  table_id: z.string().uuid().optional().nullable(),
  dining_time: z.enum(['中午', '晚上']),
  contact_name: z.string().min(1, '请输入联系人姓名').max(50),
  contact_phone: z.string().regex(phoneRegex, '请输入有效的手机号码'),
  items: z.array(z.object({
    dish_id: z.string().uuid(),
    dish_name: z.string().min(1),
    quantity: z.number().int().positive(),
    unit_price: z.number().nonnegative(),
    subtotal: z.number().nonnegative(),
    spec: z.string().optional().nullable()
  })).min(1, '购物车不能为空')
})

export const createDishSchema = z.object({
  name: z.string().min(1, '菜品名称不能为空').max(100),
  price: z.number().nonnegative('价格不能为负数'),
  category_id: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  specs: z.array(z.string()).optional(),
  image_url: z.string().max(500).optional().nullable()
})

export const updateDishSchema = z.object({
  name: z.string().min(1, '菜品名称不能为空').max(100).optional(),
  price: z.number().nonnegative('价格不能为负数').optional(),
  category_id: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  specs: z.array(z.string()).optional(),
  image_url: z.string().max(500).optional().nullable(),
  status: z.enum(['on_sale', 'off_sale']).optional()
})

export const createTableSchema = z.object({
  table_no: z.string().min(1, '桌位编号不能为空').max(20),
  name: z.string().min(1, '桌位名称不能为空').max(50),
  capacity: z.number().int().positive().optional()
})

export const createCategorySchema = z.object({
  name: z.string().min(1, '分类名称不能为空').max(50),
  sort_order: z.number().int().optional()
})

export const createInventorySchema = z.object({
  material_name: z.string().min(1, '物料名称不能为空').max(100),
  quantity: z.number(),
  unit: z.string().min(1, '单位不能为空').max(20),
  warning_threshold: z.number().optional()
})

// 库存更新验证
export const updateInventorySchema = z.object({
  quantity: z.number().nonnegative('数量不能为负数'),
  warning_threshold: z.number().nonnegative('预警阈值不能为负数').optional()
})

// 订单状态白名单验证
export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'completed', 'cancelled'], {
    errorMap: () => ({ message: '无效的订单状态' })
  })
})

// 重置数据库确认验证
export const confirmResetSchema = z.object({
  confirm: z.literal('RESET', { errorMap: () => ({ message: '需要确认字段 RESET' }) })
})

// 取消订单验证（需要手机号验证身份）
export const cancelOrderSchema = z.object({
  phone: z.string().regex(phoneRegex, '请输入有效的手机号码以验证身份')
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type CreateDishInput = z.infer<typeof createDishSchema>
export type UpdateDishInput = z.infer<typeof updateDishSchema>
export type CreateTableInput = z.infer<typeof createTableSchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type CreateInventoryInput = z.infer<typeof createInventorySchema>
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>
