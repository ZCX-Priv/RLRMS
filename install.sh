#!/usr/bin/env bash
set -e

# 红灯笼食府管理系统 - 安装脚本 (Linux/macOS)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "========================================"
echo "   红灯笼食府管理系统 - 安装程序"
echo "========================================"
echo ""

# 1. 检查 Node.js
if ! command -v node &> /dev/null; then
    error "未检测到 Node.js，请先安装 Node.js >= 18"
    error "推荐安装方式："
    echo "  - 使用 nvm:  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
    echo "  - 官方下载:  https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js 版本过低 (当前: $(node -v))，需要 >= 18"
    exit 1
fi
info "Node.js 版本: $(node -v)"

# 2. 检查 npm
if ! command -v npm &> /dev/null; then
    error "未检测到 npm，请确认 Node.js 安装完整"
    exit 1
fi
info "npm 版本: $(npm -v)"

# 3. 安装依赖
info "正在安装依赖..."
npm install --production=false
info "依赖安装完成"

# 4. 构建项目
info "正在构建生产环境版本..."
npm run build:production
info "构建完成"

# 5. 创建日志目录
mkdir -p logs
info "日志目录已创建: logs/"

# 6. 检查 .env 文件
if [ ! -f .env ]; then
    warn "未找到 .env 配置文件"
    echo "PORT=3000" > .env
    info "已创建默认 .env 文件 (PORT=3000)"
fi

# 7. 检查 PM2
echo ""
if command -v pm2 &> /dev/null; then
    info "PM2 已安装: $(pm2 -v)"
else
    warn "未检测到 PM2 进程管理器"
    echo "  建议使用 PM2 管理生产环境进程："
    echo "  npm install -g pm2"
fi

# 8. 完成
echo ""
echo "========================================"
echo "   安装完成！"
echo "========================================"
echo ""
echo "启动方式："
echo ""
echo "  开发环境："
echo "    npm run dev"
echo ""
echo "  生产环境（直接启动）："
echo "    npm run start:production"
echo ""
if command -v pm2 &> /dev/null; then
echo "  生产环境（PM2 托管）："
echo "    pm2 start ecosystem.config.cjs"
echo "    pm2 save"
echo "    pm2 startup"
echo ""
fi
echo "服务默认端口: 3000 (可在 .env 中修改 PORT)"
echo ""
