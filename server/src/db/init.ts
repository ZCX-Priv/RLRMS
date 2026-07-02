import { initDatabase, run, get, all, beginBatch, endBatch } from './index.js'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

/**
 * 将 tags/specs 列的值规范化为合法的 JSON 数组字符串
 * 处理：null/空字符串/双重序列化的 '"[]"'/非法 JSON
 */
function normalizeJsonArray(value: string | null | undefined): string {
  if (!value || value.trim() === '') return '[]'
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return JSON.stringify(parsed)
    // 双重序列化：解析后是字符串，再解析一次
    if (typeof parsed === 'string') {
      try {
        const inner = JSON.parse(parsed)
        if (Array.isArray(inner)) return JSON.stringify(inner)
      } catch { /* ignore */ }
    }
    return '[]'
  } catch {
    return '[]'
  }
}

export async function initializeDatabase() {
  await initDatabase()

  // Begin batch operation to defer saves
  beginBatch()

  run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      phone TEXT,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  run(`
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      table_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      capacity INTEGER DEFAULT 4,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  run(`
    CREATE TABLE IF NOT EXISTS dishes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price TEXT NOT NULL,
      image_url TEXT,
      category_id TEXT,
      description TEXT,
      tags TEXT,
      specs TEXT,
      status TEXT DEFAULT 'on_sale',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `)

  run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      table_id TEXT,
      user_id TEXT,
      dining_time TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (table_id) REFERENCES tables(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      dish_id TEXT NOT NULL,
      dish_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      spec TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (dish_id) REFERENCES dishes(id)
    )
  `)

  run(`
    CREATE TABLE IF NOT EXISTS order_modifications (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      dish_id TEXT NOT NULL,
      dish_name TEXT NOT NULL,
      quantity_delta INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      spec TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `)

  run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      material_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT,
      warning_threshold REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  try {
    run('ALTER TABLE inventory ADD COLUMN sort_order INTEGER DEFAULT 0')
  } catch {
    // Column already exists, ignore
  }

  run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // === 创建索引以提升查询性能 ===
  run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)')
  run('CREATE INDEX IF NOT EXISTS idx_orders_contact_phone ON orders(contact_phone)')
  run('CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id)')
  run('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)')
  run('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)')
  run('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)')
  run('CREATE INDEX IF NOT EXISTS idx_order_modifications_order_id ON order_modifications(order_id)')
  run('CREATE INDEX IF NOT EXISTS idx_dishes_category_id ON dishes(category_id)')
  run('CREATE INDEX IF NOT EXISTS idx_dishes_status ON dishes(status)')
  run('CREATE INDEX IF NOT EXISTS idx_dishes_sort_order ON dishes(sort_order)')
  run('CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)')
  run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)')
  run('CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status)')

  console.log('Database tables and indexes initialized')

  const adminExists = get<{ id: string }>('SELECT id FROM users WHERE role = ?', ['admin'])
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10)
    const id = uuidv4()
    run(
      'INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)',
      [id, 'admin', hashedPassword, 'admin', '管理员']
    )
    console.log('Default admin user created: admin / admin123')
  }

  const settingsCount = get<{ count: number }>('SELECT COUNT(*) as count FROM settings')
  if (!settingsCount || settingsCount.count === 0) {
    const defaultSettings = [
      { key: 'restaurant_name', value: '红灯笼食府' },
      { key: 'restaurant_phone', value: '' },
      { key: 'restaurant_address', value: '' },
      { key: 'business_hours', value: '{"days":[1,2,3,4,5,6,7],"periods":[{"open":"10:00","close":"14:00"},{"open":"16:30","close":"22:00"}]}' },
      { key: 'notification_email', value: '' },
      { key: 'notification_phone', value: '' },
      { key: 'restaurant_description', value: '红灯笼食府秉承传统中餐烹饪技艺，精选时令食材，匠心打造每一道佳肴。我们致力于为宾客提供地道的中华美食体验，温馨舒适的用餐环境，以及贴心周到的服务。' },
      { key: 'restaurant_features', value: '传统中餐,时令食材,私密包厢,家庭聚餐' },
    ]
    for (const setting of defaultSettings) {
      run('INSERT INTO settings (key, value) VALUES (?, ?)', [setting.key, setting.value])
    }
    console.log('Default settings created')
  }

  // === 迁移：历史 customer 的 username 从 phone 改为数字会员号 ===
  // 幂等：只处理 username = phone 的 customer（迁移后 username != phone，不会重复执行）
  const legacyCustomers = all<{ id: string; phone: string }>(
    "SELECT id, phone FROM users WHERE role = 'customer' AND phone IS NOT NULL AND username = phone"
  )
  if (legacyCustomers.length > 0) {
    let memberNo = 10001
    for (const c of legacyCustomers) {
      // 跳过已占用的会员号（防止与已迁移的冲突）
      while (get<{ id: string }>('SELECT id FROM users WHERE username = ?', [String(memberNo)])) {
        memberNo++
      }
      run('UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [String(memberNo), c.id])
      memberNo++
    }
    console.log(`Migrated ${legacyCustomers.length} legacy customers to member numbers`)
  }

  // === 回填：历史订单 user_id ===
  // 幂等：只处理 user_id IS NULL（回填后非 NULL，不会重复）
  // 安全：auth.ts 查重逻辑保证一个 phone 对应一个 customer 记录
  const backfillResult = run(`
    UPDATE orders
    SET user_id = (SELECT id FROM users WHERE phone = orders.contact_phone AND role = 'customer')
    WHERE user_id IS NULL
      AND contact_phone IS NOT NULL
      AND EXISTS (SELECT 1 FROM users WHERE phone = orders.contact_phone AND role = 'customer')
  `)
  if (backfillResult.changes > 0) {
    console.log(`Backfilled user_id for ${backfillResult.changes} orders`)
  }

  // === 迁移：修复 dishes 表 tags/specs 列的异常 JSON 值 ===
  // 幂等：仅处理 NULL、空字符串、双重序列化的记录
  const badDishes = all<{ id: string; tags: string; specs: string }>(
    `SELECT id, tags, specs FROM dishes
     WHERE tags IS NULL OR tags = ''
        OR specs IS NULL OR specs = ''
        OR tags LIKE '%"[%]"%'
        OR specs LIKE '%"[%]"%'`
  )
  if (badDishes.length > 0) {
    beginBatch()
    for (const dish of badDishes) {
      const fixedTags = normalizeJsonArray(dish.tags)
      const fixedSpecs = normalizeJsonArray(dish.specs)
      run('UPDATE dishes SET tags = ?, specs = ? WHERE id = ?', [fixedTags, fixedSpecs, dish.id])
    }
    endBatch()
    console.log(`Fixed tags/specs for ${badDishes.length} dishes`)
  }

  // End batch operation and save database once
  endBatch()

  console.log('Database initialized successfully')
}
