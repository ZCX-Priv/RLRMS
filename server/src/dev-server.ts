import 'dotenv/config'
import { createApp, initDb } from './index.js'

const PORT = process.env.PORT || 3000

const app = createApp()
const server = app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
  console.log('Database initialization in progress...')
})

initDb(server)
