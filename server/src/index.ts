import 'dotenv/config'
import { execSync } from 'child_process'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import { resolve } from 'path'
import { initializeDatabase } from './db/init.js'
import { apiRouter } from './routes/index.js'

if (process.platform === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'inherit' })
  } catch {
    // Ignore if chcp fails
  }
  process.stdout.setDefaultEncoding?.('utf8')
  process.stderr.setDefaultEncoding?.('utf8')
}

const app = express()
const PORT = process.env.PORT || 3001

const isProduction = process.env.NODE_ENV === 'production'

let dbReady = false
let dbInitPromise: Promise<void> | null = null

const corsOptions = {
  origin: isProduction ? process.env.FRONTEND_URL : 'http://localhost:5173',
  credentials: true,
}

app.use(cors(corsOptions))
app.use(cookieParser())
app.use(compression({
  threshold: 1024,
  level: 6,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
  if (!dbReady && req.path !== '/health') {
    res.status(503).json({ 
      success: false, 
      error: 'Service unavailable - database initializing',
      retryAfter: 2
    })
    return
  }
  next()
})

app.use('/sources', express.static(resolve(process.cwd(), 'public/sources'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
}))

app.use('/api', apiRouter)

if (isProduction) {
  const distPath = resolve(process.cwd(), 'dist')
  app.use(express.static(distPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
  }))
  
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/sources')) {
      return next()
    }
    res.sendFile(resolve(distPath, 'index.html'))
  })
}

app.get('/health', (req, res) => {
  res.json({ 
    status: dbReady ? 'ok' : 'initializing', 
    timestamp: new Date().toISOString(),
    dbReady
  })
})

if (!isProduction) {
  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not found' })
  })
}

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.message)
  console.error('Stack:', err.stack)
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ success: false, error: 'Invalid token' })
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, error: err.message })
  }
  
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  })
})

async function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log('Database initialization in progress...')
  })

  dbInitPromise = initializeDatabase()
    .then(() => {
      dbReady = true
      console.log('Database initialized successfully')
    })
    .catch((error) => {
      console.error('Failed to initialize database:', error)
      server.close(() => {
        console.error('Server closed due to database initialization failure')
        process.exit(1)
      })
    })
}

startServer()
