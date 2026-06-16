import { createServer as createViteServer } from 'vite'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { createApp, initDb } from './index.js'

const PORT = process.env.PORT || 3000

async function startDevServer() {
  const app = createApp()

  // 创建 Vite 开发服务器（中间件模式）
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  })

  // 挂载 Vite 中间件到 Express
  app.use(vite.middlewares)

  // 对非 API / sources 的请求，返回 Vite 转换后的 index.html（SPA fallback）
  app.use('*', async (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/sources') || req.path.startsWith('/health')) {
      return next()
    }

    try {
      const templatePath = resolve(process.cwd(), 'index.html')
      let template = readFileSync(templatePath, 'utf-8')
      template = await vite.transformIndexHtml(req.originalUrl, template)
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template)
    } catch (e) {
      vite.ssrFixStacktrace(e as Error)
      next(e)
    }
  })

  const server = app.listen(PORT, () => {
    console.log(`Dev server running on http://localhost:${PORT}`)
    console.log('Database initialization in progress...')
  })

  initDb(server)
}

startDevServer()
