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

  // transformIndexHtml 警告去重：vite:json 插件每次页面请求都会触发，只打印一次
  const warnedMessages = new Set<string>()

  // 对非 API / sources 的请求，返回 Vite 转换后的 index.html（SPA fallback）
  app.use('*', async (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/sources') || req.path.startsWith('/health')) {
      return next()
    }

    try {
      const templatePath = resolve(process.cwd(), 'index.html')
      let template = readFileSync(templatePath, 'utf-8')
      try {
        template = await vite.transformIndexHtml(req.originalUrl, template)
      } catch (transformErr) {
        // Vite 7 transformIndexHtml 可能抛出非致命错误（如 vite:json 插件解析），
        // 如果 template 仍有效则继续使用，否则向上抛出
        if (!template) throw transformErr
        const msg = (transformErr as Error).message
        if (!warnedMessages.has(msg)) {
          warnedMessages.add(msg)
          console.warn('transformIndexHtml warning (suppressed duplicates):', msg)
        }
      }
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
