import 'dotenv/config'
import { createApp, initDb } from './index.js'
import { flushSave } from './db/index.js'

const PORT = process.env.PORT || 3000

const app = createApp()
const server = app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
  console.log('Database initialization in progress...')
})

initDb(server)

// 注册进程退出钩子，确保防抖缓冲区中的数据不会丢失
process.on('SIGTERM', () => { flushSave(); process.exit(0) })
process.on('SIGINT', () => { flushSave(); process.exit(0) })
