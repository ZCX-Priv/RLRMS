import { z } from 'zod'

export const createOrderSchema = z.object({
  table_id: z.string().uuid().optional().nullable(),
  dining_time: z.enum(['中午', '晚上']),
  contact_name: z.string().min(1, '请输入联系人姓名').max(50),
  contact_phone: z.string().min(1, '请输入联系电话'),
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

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type CreateDishInput = z.infer<typeof createDishSchema>
export type UpdateDishInput = z.infer<typeof updateDishSchema>
export type CreateTableInput = z.infer<typeof createTableSchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type CreateInventoryInput = z.infer<typeof createInventorySchema>
