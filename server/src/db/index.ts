import initSqlJs, { Database } from 'sql.js'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(__dirname, '../../data')
const dbPath = resolve(dataDir, 'restaurant.db')

let db: Database | null = null
let deferSave = false

// Debounce timer for coalescing writes
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 50

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

// Save database to file (synchronous, for critical paths)
export function saveDatabase() {
  // Cancel any pending debounced save since we're saving now
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
    saveDebounceTimer = null
  }
  if (db) {
    const data = db.export()
    const buffer = Buffer.from(data)
    writeFileSync(dbPath, buffer)
  }
}

// Schedule a debounced save (coalesces multiple writes within SAVE_DEBOUNCE_MS)
function scheduleSave() {
  if (deferSave) return // Batch mode: defer until endBatch
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer)
  saveDebounceTimer = setTimeout(() => {
    saveDebounceTimer = null
    saveDatabase()
  }, SAVE_DEBOUNCE_MS)
}

// Begin batch operation - defer saves until endBatch is called
export function beginBatch(): void {
  deferSave = true
  // Cancel any pending debounced save
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
    saveDebounceTimer = null
  }
}

// End batch operation - save database once
export function endBatch(): void {
  deferSave = false
  saveDatabase()
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

  return db
}

// Get database instance
export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

// Run a query that modifies data (uses debounced save for better throughput)
export function run(sql: string, params: (string | number | null)[] = []): { changes: number; lastInsertRowId: number } {
  const database = getDb()
  database.run(sql, params)
  scheduleSave()
  return {
    changes: database.getRowsModified(),
    lastInsertRowId: 0 // sql.js doesn't return this directly
  }
}

// Get a single row
export function get<T = unknown>(sql: string, params: (string | number | null)[] = []): T | undefined {
  const database = getDb()
  const stmt = database.prepare(sql)
  stmt.bind(params)
  
  if (stmt.step()) {
    const row = stmt.getAsObject() as T
    stmt.free()
    return row
  }
  
  stmt.free()
  return undefined
}

// Get all rows
export function all<T = unknown>(sql: string, params: (string | number | null)[] = []): T[] {
  const database = getDb()
  const stmt = database.prepare(sql)
  stmt.bind(params)
  
  const results: T[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T)
  }
  
  stmt.free()
  return results
}

// Execute raw SQL (multiple statements)
export function exec(sql: string): void {
  const database = getDb()
  database.run(sql)
  scheduleSave()
}

// Flush pending debounced saves (call before server shutdown)
export function flushSave(): void {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
    saveDebounceTimer = null
    saveDatabase()
  }
}