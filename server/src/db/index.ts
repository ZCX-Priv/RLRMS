import initSqlJs, { Database } from 'sql.js'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(__dirname, '../../data')
const dbPath = resolve(dataDir, 'restaurant.db')

let db: Database | null = null
let deferSave = false

// 预处理语句缓存：复用 prepare() 结果，避免重复解析 SQL
// 注意：sql.js 的 Statement 对象在 free() 之前可重复 bind/step
const stmtCache = new Map<string, ReturnType<Database['prepare']>>()

// 防抖保存相关变量
let saveTimer: ReturnType<typeof setTimeout> | null = null
let autoSaveTimer: ReturnType<typeof setInterval> | null = null
let isDirty = false
const SAVE_DEBOUNCE_MS = 500
const SAVE_INTERVAL_MS = 30000

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

// 立即同步保存到磁盘（内部使用）
function flushSave(): void {
  if (!isDirty || !db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(dbPath, buffer)
  isDirty = false
}

// 调度防抖保存
function scheduleSave(): void {
  isDirty = true
  if (deferSave) return // 批量操作期间不保存
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    flushSave()
  }, SAVE_DEBOUNCE_MS)
}

// 启动自动定时保存（服务器启动时调用）
export function startAutoSave(): void {
  if (autoSaveTimer) return
  autoSaveTimer = setInterval(() => {
    if (isDirty && !deferSave) {
      flushSave()
    }
  }, SAVE_INTERVAL_MS)

  // 进程退出时强制保存
  const gracefulShutdown = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer)
      autoSaveTimer = null
    }
    flushSave()
    process.exit(0)
  }
  process.on('SIGINT', gracefulShutdown)
  process.on('SIGTERM', gracefulShutdown)
}

// Begin batch operation - defer saves until endBatch is called
export function beginBatch(): void {
  deferSave = true
}

// End batch operation - save database once
export function endBatch(): void {
  deferSave = false
  scheduleSave()
}

// Run batch statements in a single transaction
export function runBatch(statements: { sql: string; params: (string | number | null)[] }[]): void {
  const database = getDb()
  beginBatch()
  try {
    for (const { sql, params } of statements) {
      database.run(sql, params)
    }
  } finally {
    endBatch()
  }
}

// Initialize SQL.js and database
export async function initDatabase(): Promise<Database> {
  if (db) return db

  const SQL = await initSqlJs()

  // Try to load existing database
  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // 数据库实例可能变化，清空预处理语句缓存
  stmtCache.clear()

  return db
}

// Get database instance
export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

// Run a query that modifies data
export function run(sql: string, params: (string | number | null)[] = []): { changes: number; lastInsertRowId: number } {
  const database = getDb()
  database.run(sql, params)
  scheduleSave()
  return {
    changes: database.getRowsModified(),
    lastInsertRowId: 0 // sql.js doesn't return this directly
  }
}

/**
 * 批量执行相同的 SQL 语句（复用预处理语句）
 * 适用于批量更新场景（如 reorder 操作）
 * 在循环外 prepare 一次，循环内 bind + step + reset
 * @param sql SQL 语句
 * @param paramsBatch 参数数组的数组，每个元素对应一次执行
 */
export function runBatchPrepared(sql: string, paramsBatch: (string | number | null)[][]): void {
  const database = getDb()
  const stmt = database.prepare(sql)
  try {
    for (const params of paramsBatch) {
      stmt.reset()
      stmt.bind(params)
      stmt.step()
    }
  } finally {
    stmt.free()
  }
  scheduleSave()
}

// Get a single row
export function get<T = unknown>(sql: string, params: (string | number | null)[] = []): T | undefined {
  const database = getDb()
  // 复用预处理语句，避免重复 prepare
  let stmt = stmtCache.get(sql)
  if (!stmt) {
    stmt = database.prepare(sql)
    stmtCache.set(sql, stmt)
  }

  stmt.reset()
  stmt.bind(params)

  if (stmt.step()) {
    return stmt.getAsObject() as T
  }

  return undefined
}

// Get all rows
export function all<T = unknown>(sql: string, params: (string | number | null)[] = []): T[] {
  const database = getDb()
  // 复用预处理语句，避免重复 prepare
  let stmt = stmtCache.get(sql)
  if (!stmt) {
    stmt = database.prepare(sql)
    stmtCache.set(sql, stmt)
  }

  stmt.reset()
  stmt.bind(params)

  const results: T[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T)
  }

  return results
}

// Execute raw SQL (multiple statements)
export function exec(sql: string): void {
  const database = getDb()
  database.run(sql)
  scheduleSave()
}
