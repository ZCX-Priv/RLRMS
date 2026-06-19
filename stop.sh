#!/usr/bin/env bash

# 红灯笼食府管理系统 - 停止脚本 (Linux/macOS)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "========================================"
echo "   红灯笼食府管理系统 - 停止服务"
echo "========================================"
echo ""

STOPPED=false

# 读取端口
APP_PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
APP_PORT=${APP_PORT:-3000}

# 1. 优先通过 PM2 停止
if command -v pm2 &> /dev/null; then
    if pm2 describe red-lantern-restaurant &>/dev/null; then
        info "正在通过 PM2 停止服务..."
        pm2 stop red-lantern-restaurant 2>/dev/null
        pm2 delete red-lantern-restaurant 2>/dev/null
        pm2 save --force &>/dev/null
        info "PM2 进程已停止"
        STOPPED=true
    fi
fi

# 2. 通过 PID 文件停止
if [ "$STOPPED" = false ] && [ -f "logs/server.pid" ]; then
    PID=$(cat logs/server.pid)
    if kill -0 "$PID" 2>/dev/null; then
        info "正在停止进程 (PID: $PID)..."
        kill "$PID" 2>/dev/null
        # 等待进程退出（最多 5 秒）
        for i in $(seq 1 5); do
            if ! kill -0 "$PID" 2>/dev/null; then
                break
            fi
            sleep 1
        done
        # 如果还没退出，强制终止
        if kill -0 "$PID" 2>/dev/null; then
            warn "进程未响应，正在强制终止..."
            kill -9 "$PID" 2>/dev/null
        fi
        info "进程已停止"
        STOPPED=true
    else
        warn "PID 文件存在但进程已不存在 (PID: $PID)"
    fi
    rm -f logs/server.pid
fi

# 3. 兜底：通过端口查找进程
if [ "$STOPPED" = false ]; then
    PORT_PID=""
    if command -v lsof &> /dev/null; then
        PORT_PID=$(lsof -ti :"$APP_PORT" -sTCP:LISTEN 2>/dev/null)
    elif command -v ss &> /dev/null; then
        PORT_PID=$(ss -tlnp 2>/dev/null | grep ":$APP_PORT " | grep -oP 'pid=\K[0-9]+')
    elif command -v fuser &> /dev/null; then
        PORT_PID=$(fuser "$APP_PORT"/tcp 2>/dev/null)
    fi

    if [ -n "$PORT_PID" ]; then
        info "发现端口 $APP_PORT 上的进程 (PID: $PORT_PID)，正在停止..."
        kill "$PORT_PID" 2>/dev/null
        sleep 1
        if kill -0 "$PORT_PID" 2>/dev/null; then
            warn "进程未响应，正在强制终止..."
            kill -9 "$PORT_PID" 2>/dev/null
        fi
        info "进程已停止"
        STOPPED=true
    fi
fi

echo ""
if [ "$STOPPED" = true ]; then
    info "服务已停止"
else
    warn "未发现正在运行的服务"
fi
echo ""
