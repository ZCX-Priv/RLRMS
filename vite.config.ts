import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

/**
 * 移除 console.log 的插件
 * 仅在生产环境生效
 */
function removeConsolePlugin(): Plugin {
  return {
    name: 'remove-console',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const fileName in bundle) {
        const file = bundle[fileName]
        if (file.type === 'chunk' && file.code) {
          // 移除 console.log、console.info、console.debug（保留 console.warn 和 console.error）
          file.code = file.code
            .replace(/console\.(log|info|debug)\s*\([^)]*\)\s*;?/g, '')
            .replace(/console\.(log|info|debug)\s*\([^)]*\);?/g, '')
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    // 仅在生产环境移除 console
    ...(mode === 'production' ? [removeConsolePlugin()] : []),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // 预构建常用依赖以加速开发模式
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', 'lucide-vue-next'],
  },
  server: {
    // 端口由 Express 统一控制（Vite 中间件模式）
    // 此配置仅在独立运行 Vite 时生效（如 Trae IDE 预览）
    // 禁用预加载：避免 vite:json 插件在 transformIndexHtml 时触发无意义的 JSON 解析警告
    preTransformRequests: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/sources': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // 代码分割策略
    rollupOptions: {
      output: {
        // 手动分割 chunks
        manualChunks(id) {
          // lucide-vue-next 图标库（独立 chunk 便于 tree-shaking）
          if (id.includes('node_modules/lucide-vue-next/')) {
            return 'vendor-icons'
          }
          // Vue 生态 + 所有依赖合并为 vendor（避免循环依赖）
          if (id.includes('node_modules/')) {
            return 'vendor'
          }
        },
        // 资源文件名使用内容哈希
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || []
          const ext = info[info.length - 1]
          // CSS 文件
          if (ext === 'css') {
            return 'assets/css/[name]-[hash].[ext]'
          }
          // 图片资源
          if (/png|jpe?g|gif|svg|webp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash].[ext]'
          }
          // 字体资源
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return 'assets/fonts/[name]-[hash].[ext]'
          }
          // 其他资源
          return 'assets/[name]-[hash].[ext]'
        },
      },
    },
    // CSS 代码分割
    cssCodeSplit: true,
    // chunk 大小警告限制（适应 3M 带宽，gzip 后约 175KB）
    chunkSizeWarningLimit: 600,
    // 启用 minify
    minify: 'esbuild',
    // 启用 source map（生产环境可关闭以减小体积）
    sourcemap: false,
    // 清空输出目录
    emptyOutDir: true,
  },
}))