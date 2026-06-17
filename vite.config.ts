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
  server: {
    // 端口由 Express 统一控制（Vite 中间件模式）
    // 此配置仅在独立运行 Vite 时生效（如 Trae IDE 预览）
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
        manualChunks: (id) => {
          // Vue 核心库分离到 vendor chunk
          if (id.includes('node_modules/vue/') ||
              id.includes('node_modules/vue-router/') ||
              id.includes('node_modules/pinia/')) {
            return 'vendor'
          }
          // lucide-vue-next 分离到独立 chunk
          if (id.includes('node_modules/lucide-vue-next/')) {
            return 'lucide'
          }
          // 其他 node_modules 依赖
          if (id.includes('node_modules/')) {
            return 'dependencies'
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
    // chunk 大小警告限制为 200KB（适应 3M 带宽）
    chunkSizeWarningLimit: 200,
    // 启用 minify
    minify: 'esbuild',
    // 启用 source map（生产环境可关闭以减小体积）
    sourcemap: false,
    // 清空输出目录
    emptyOutDir: true,
  },
}))