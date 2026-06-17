#!/usr/bin/env node

import { execSync } from 'child_process'
import { existsSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

console.log('🚀 开始构建生产环境...\n')

console.log('📦 构建前端...')
execSync('npm run build', { stdio: 'inherit', cwd: rootDir })

console.log('\n📦 构建后端...')
execSync('npm run build:server', { stdio: 'inherit', cwd: rootDir })

console.log('\n📁 复制必要文件...')

const distDir = resolve(rootDir, 'dist')
const serverDistDir = resolve(rootDir, 'server/dist')
const publicDir = resolve(rootDir, 'public')
const serverDataDir = resolve(rootDir, 'server/data')

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

const copyDir = (src, dest) => {
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true })
  }
}

copyDir(publicDir, resolve(distDir, 'public'))
copyDir(serverDataDir, resolve(distDir, 'data'))

console.log('\n✅ 构建完成！')
console.log('\n📋 部署说明：')
console.log('1. 将以下目录上传到服务器：')
console.log('   - dist/           (前端静态文件)')
console.log('   - server/dist/    (后端编译文件)')
console.log('   - public/         (图片资源)')
console.log('   - server/data/    (数据库文件)')
console.log('   - node_modules/   (依赖)')
console.log('   - package.json')
console.log('   - .env.production (从 .env.production.example 复制并修改)')
console.log('\n2. 在服务器上设置环境变量：')
console.log('   cp .env.production.example .env.production')
console.log('   编辑 .env.production 设置 JWT_SECRET 等配置')
console.log('\n3. 启动服务：')
console.log('   NODE_ENV=production node server/dist/index.js')
