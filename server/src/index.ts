import 'dotenv/config'
import { execSync } from 'child_process'
import express from 'express'
import type { Express } from 'express'
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

const PORT = process.env.PORT || 3000

const isProduction = process.env.NODE_ENV === 'production'

let dbReady = false
let dbInitPromise: Promise<void> | null = null

/**
 * 创建并配置 Express 应用实例
 * 生产环境和开发环境（Vite 中间件模式）共用
 */
export function createApp(): Express {
  const app = express()

  // 生产环境启用 CORS（开发环境前后端同源，无需 CORS）
  if (isProduction) {
    app.use(cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
    }))
  }

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

  app.get('/health', (req, res) => {
    res.json({ 
      status: dbReady ? 'ok' : 'initializing', 
      timestamp: new Date().toISOString(),
      dbReady
    })
  })

  // 生产环境：托管前端构建产物 + SPA fallback
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

  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Error:', err.message)
    console.error('Stack:', err.stack)
    
    if (err.name === 'UnauthorizedError') {
      res.status(401).json({ success: false, error: 'Invalid token' })
      return
    }
    
    if (err.name === 'ValidationError') {
      res.status(400).json({ success: false, error: err.message })
      return
    }
    
    res.status(500).json({ 
      success: false, 
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
    })
  })

  return app
}

/**
 * 初始化数据库并标记就绪状态
 */
export function initDb(server: ReturnType<Express['listen']>) {
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

// 生产环境：直接启动服务器
if (isProduction) {
  const app = createApp()
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log('Database initialization in progress...')
  })
  initDb(server)
}
