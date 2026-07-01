# 计划：菜品价格输入支持文字

## 概述

将添加/编辑菜品的 `price` 输入框从 `type="number"` 改为 `type="text"`，允许输入文字（如"时价"、"面议"）。当价格为文字时，客户端显示不追加"元"；当价格为数字时，照常追加"元"。同时删除 label 上的"(元)"。

文字价格的菜品加入购物车时按 0 元计价（unit_price=0, subtotal=0），不影响订单总价计算。

## 当前状态分析

- **输入框**：`src/admin/views/DishesView.vue` 第 637 行，`<input type="number" min="0" step="0.01">`，label 为 `价格(元)`
- **数据模型**：`Dish.price` 为 `number` 类型（`src/types/index.ts` 第 57 行）
- **数据库**：`price REAL NOT NULL`（`server/src/db/init.ts` 第 49 行）
- **Zod 验证**：`price: z.number().nonnegative()`（`server/src/validators/index.ts` 第 23、33 行）
- **购物车计算**：`item.dish.price * item.quantity`（`src/stores/cart.ts` 第 25、93 行）
- **价格显示**：14 处使用 `{{ price }}元` 拼接，无统一格式化函数

## 实施方案

### 1. 新建工具函数 `src/utils/format.ts`

创建 `formatPrice` 函数，统一处理价格显示逻辑：

```typescript
/**
 * 格式化价格显示
 * 数字（含数字字符串如"25"）追加"元"，非数字文字（如"时价"）原样返回
 */
export function formatPrice(price: number | string): string {
  const str = String(price)
  const num = Number(str)
  if (str !== '' && !isNaN(num)) {
    return `${str}元`
  }
  return str
}
```

### 2. 修改 `src/types/index.ts`

第 57 行：`price: number` → `price: number | string`

### 3. 修改 `server/src/validators/index.ts`

- 第 23 行（createDishSchema）：
  ```typescript
  price: z.union([z.number().nonnegative('价格不能为负数'), z.string().min(1, '价格不能为空')])
  ```
- 第 33 行（updateDishSchema）：
  ```typescript
  price: z.union([z.number().nonnegative('价格不能为负数'), z.string().min(1, '价格不能为空')]).optional()
  ```

### 4. 修改 `server/src/db/init.ts`

第 49 行：`price REAL NOT NULL` → `price TEXT NOT NULL`

> 说明：SQLite 动态类型系统允许在任何列存储任何类型。REAL 列也能存储文字，但改为 TEXT 更明确。现有数据库无需迁移（`CREATE TABLE IF NOT EXISTS` 不会修改已存在的表，SQLite 动态类型保证兼容）。

### 5. 修改 `src/admin/views/DishesView.vue`

- **第 36 行**：`price: 0` → `price: ''`（空字符串初始化，配合 text 输入）
- **第 157 行**：`price: dish.price` → `price: String(dish.price)`（编辑时统一转为字符串）
- **第 636 行**：`<label>价格(元)</label>` → `<label>价格</label>`
- **第 637 行**：`<input v-model="formData.price" type="number" min="0" step="0.01" />` → `<input v-model="formData.price" type="text" placeholder="请输入价格（如：25 或 时价）" />`
- **第 580 行**：`{{ dish.price }}元` → `{{ formatPrice(dish.price) }}`
- **script setup 导入**：添加 `import { formatPrice } from '@/utils/format'`

### 6. 修改 `src/stores/cart.ts`

处理文字价格在购物车中的计算（按 0 元计价）：

- **第 23-27 行**（totalAmount 计算）：
  ```typescript
  const totalAmount = computed(() => {
    return items.value.reduce((sum, item) => {
      const price = Number(item.dish.price)
      return sum + (isNaN(price) ? 0 : price) * item.quantity
    }, 0)
  })
  ```

- **第 87-96 行**（getOrderItems）：
  ```typescript
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
  ```

### 7. 修改客户端价格显示（7 处菜品单价展示）

以下文件将 `{{ ...price }}元` 改为 `{{ formatPrice(...price) }}`，并添加 `import { formatPrice } from '@/utils/format'`：

| 文件 | 行号 | 原代码 | 新代码 |
|------|------|--------|--------|
| `src/client/components/DishCard.vue` | 123 | `{{ dish.price }}元` | `{{ formatPrice(dish.price) }}` |
| `src/client/views/DishDetailView.vue` | 132 | `{{ dish.price }}元` | `{{ formatPrice(dish.price) }}` |
| `src/client/components/CartDrawer.vue` | 49 | `{{ item.dish.price }}元` | `{{ formatPrice(item.dish.price) }}` |
| `src/client/views/HomeView.vue` | 343 | `{{ item.dish.price }}元` | `{{ formatPrice(item.dish.price) }}` |
| `src/client/views/SearchView.vue` | 211 | `{{ item.dish.price }}元` | `{{ formatPrice(item.dish.price) }}` |
| `src/client/views/OrderConfirmView.vue` | 347 | `{{ item.dish.price }}元` | `{{ formatPrice(item.dish.price) }}` |

> **无需修改的显示位置**：订单总金额、小计等（`total_amount.toFixed(2)元`、`subtotal`、`unit_price * quantity`）始终为数字，照常追加"元"。

## 关于中文乱码

`type="number"` 浏览器会阻止非数字字符输入，这是无法输入中文的根本原因。改为 `type="text"` 后原生支持中文输入。项目全程使用 UTF-8 编码（HTML meta charset、SQLite 默认 UTF-8、JSON 传输），不存在编码问题。

## 假设与决策

1. **文字价格按 0 元计价**：用户确认，文字价格菜品可加入购物车并下单，unit_price 和 subtotal 存为 0
2. **数字字符串视为数字**：输入 "25" 视为数字价格，显示 "25元"
3. **现有数据库无需迁移**：SQLite 动态类型保证 REAL 列也能存储文字
4. **统一格式化函数**：新建 `src/utils/format.ts` 避免在 7+ 处重复条件判断逻辑

## 验证步骤

1. `npm run build` 确认无编译错误
2. 测试添加菜品：输入数字 "25" → 显示 "25元"
3. 测试添加菜品：输入文字 "时价" → 显示 "时价"（无"元"）
4. 测试编辑菜品：原有数字价格正常加载和保存
5. 测试购物车：文字价格菜品加入购物车，总价计算正确（按 0 元）
6. 测试下单：包含文字价格菜品的订单可正常提交
