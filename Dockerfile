# ============================================
# 红灯笼食府管理系统 - Dockerfile
# 多阶段构建：构建阶段 → 运行阶段（精简镜像）
# ============================================

# ===== 阶段 1：构建 =====
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖描述文件，优先安装依赖（利用 Docker 层缓存）
COPY package.json package-lock.json ./

# 安装所有依赖（包括 devDependencies，构建需要）
RUN npm ci

# 复制源代码
COPY . .

# 构建生产环境版本
RUN npm run build:production

# ===== 阶段 2：运行 =====
FROM node:20-alpine AS runner

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 创建非 root 用户
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# 从构建阶段复制必要文件
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

# 仅安装生产依赖
RUN npm ci --omit=dev && \
    npm cache clean --force

# 复制构建产物
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# 创建数据和日志目录（运行时通过 volume 挂载）
RUN mkdir -p server/data logs && \
    chown -R appuser:appgroup /app

# 切换到非 root 用户
USER appuser

# 健康检查（每 30s 检测一次，连续 3 次失败重启）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 暴露端口
EXPOSE 3000

# 启动服务
CMD ["node", "server/dist/index.js"]
