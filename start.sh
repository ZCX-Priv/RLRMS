#!/usr/bin/env bash
set -e

# 红灯笼食府管理系统 - 启动脚本 (Linux/macOS)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "========================================"
echo "   红灯笼食府管理系统 - 启动服务"
echo "========================================"
echo ""

# 1. 检查 Node.js
if ! command -v node &> /dev/null; then
    error "未检测到 Node.js，请先安装 Node.js >= 18"
    exit 1
fi
info "Node.js 版本: $(node -v)"

# 2. 检查是否已构建
if [ ! -f "server/dist/index.js" ]; then
    error "未找到构建产物 server/dist/index.js"
    warn "请先运行安装脚本或手动构建："
    echo "  ./install.sh"
    echo "  或 npm run build:production"
    exit 1
fi
info "构建产物检查通过"

# 3. 读取端口
APP_PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
APP_PORT=${APP_PORT:-3000}
info "服务端口: $APP_PORT"

# 4. 检查端口是否被占用
check_port() {
    local port=$1
    if command -v ss &> /dev/null; then
        ss -tlnp 2>/dev/null | grep -q ":$port " && return 0
    fi
    if command -v lsof &> /dev/null; then
        lsof -i :"$port" -sTCP:LISTEN &>/dev/null && return 0
    fi
    if command -v netstat &> /dev/null; then
        netstat -tlnp 2>/dev/null | grep -q ":$port " && return 0
    fi
    return 1
}

if check_port "$APP_PORT"; then
    warn "端口 $APP_PORT 已被占用！"
    echo ""
    echo "  可能的原因："
    echo "    - 服务已在运行中"
    echo "    - 其他程序占用了该端口"
    echo ""
    echo "  解决方法："
    echo "    - 运行 ./stop.sh 停止现有服务"
    echo "    - 修改 .env 中的 PORT 配置"
    exit 1
fi

# 5. 创建日志目录
mkdir -p logs

# 6. 启动服务
get_local_ip() {
    # 尝试多种方式获取局域网 IP
    local ip=""
    if command -v hostname &> /dev/null; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    if [ -z "$ip" ] && command -v ip &> /dev/null; then
        ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
    fi
    if [ -z "$ip" ]; then
        ip="localhost"
    fi
    echo "$ip"
}

echo ""
if command -v pm2 &> /dev/null; then
    # ===== PM2 启动 =====
    info "使用 PM2 启动服务..."

    # 检查是否已在运行
    if pm2 describe red-lantern-restaurant &>/dev/null; then
        info "检测到服务已在 PM2 中运行，正在重启..."
        pm2 restart ecosystem.config.cjs
    else
        pm2 start ecosystem.config.cjs
    fi

    # 保存 PM2 进程列表
    pm2 save &>/dev/null

    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}   服务已启动！${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    LOCAL_IP=$(get_local_ip)
    echo "  本机访问:   http://localhost:$APP_PORT"
    echo "  局域网访问: http://$LOCAL_IP:$APP_PORT"
    echo ""
    echo "  管理命令:"
    echo "    查看状态:  pm2 status"
    echo "    查看日志:  pm2 logs red-lantern-restaurant"
    echo "    重启服务:  pm2 restart red-lantern-restaurant"
    echo "    停止服务:  ./stop.sh"
    echo ""
else
    # ===== 直接启动（后台运行）=====
    info "未检测到 PM2，使用直接启动模式..."

    export NODE_ENV=production
    nohup node server/dist/index.js > logs/out.log 2>&1 &
    SERVER_PID=$!
    echo "$SERVER_PID" > logs/server.pid

    # 等待 1 秒检查进程是否存活
    sleep 1
    if kill -0 "$SERVER_PID" 2>/dev/null; then
        echo ""
        echo -e "${CYAN}========================================${NC}"
        echo -e "${CYAN}   服务已启动！${NC}"
        echo -e "${CYAN}========================================${NC}"
        echo ""
        LOCAL_IP=$(get_local_ip)
        echo "  本机访问:   http://localhost:$APP_PORT"
        echo "  局域网访问: http://$LOCAL_IP:$APP_PORT"
        echo ""
        echo "  进程 PID:  $SERVER_PID"
        echo "  日志文件:  logs/out.log"
        echo "  停止服务:  ./stop.sh"
        echo ""
    else
        error "服务启动失败，请检查日志: logs/out.log"
        tail -20 logs/out.log 2>/dev/null
        exit 1
    fi
fi
