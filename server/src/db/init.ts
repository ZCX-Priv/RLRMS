import { initDatabase, run, get, beginBatch, endBatch } from './index.js'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

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
      price REAL NOT NULL,
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

  console.log('Database tables initialized')

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
      { key: 'business_hours', value: '11:00-21:00' },
      { key: 'notification_email', value: '' },
      { key: 'notification_phone', value: '' },
    ]
    for (const setting of defaultSettings) {
      run('INSERT INTO settings (key, value) VALUES (?, ?)', [setting.key, setting.value])
    }
    console.log('Default settings created')
  }

  // 创建数据库索引（提升查询性能，幂等操作）
  // orders 表索引
  run('CREATE INDEX IF NOT EXISTS idx_orders_contact_phone ON orders(contact_phone)')
  run('CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id)')
  run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)')
  run('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)')

  // order_items 表索引
  run('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)')
  run('CREATE INDEX IF NOT EXISTS idx_order_items_dish_id ON order_items(dish_id)')

  // dishes 表索引
  run('CREATE INDEX IF NOT EXISTS idx_dishes_category_id ON dishes(category_id)')
  run('CREATE INDEX IF NOT EXISTS idx_dishes_status ON dishes(status)')
  run('CREATE INDEX IF NOT EXISTS idx_dishes_name ON dishes(name)')

  // users 表索引
  run('CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)')
  run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)')

  // tables 表索引
  run('CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status)')

  console.log('Database indexes ensured')

  // End batch operation and save database once
  endBatch()

  console.log('Database initialized successfully')
}
