#!/bin/bash
# ============================================
# 红灯笼食府管理系统 - Linux 生产环境一键安装脚本
# 功能：检查环境 → 安装依赖 → 构建产物 → 配置 .env → PM2 启动 → 配置 Nginx
# 用法：sudo bash install.sh
# ============================================

set -euo pipefail

# 切换到脚本所在目录（项目根目录）
cd "$(dirname "$0")"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 应用名称
APP_NAME="red-lantern-restaurant"
NGINX_CONF_NAME="red-lantern.conf"

# 打印函数
info()    { echo -e "${BLUE}[信息]${NC} $1"; }
success() { echo -e "${GREEN}[成功]${NC} $1"; }
warn()    { echo -e "${YELLOW}[警告]${NC} $1"; }
error()   { echo -e "${RED}[错误]${NC} $1"; }
step()    { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# ============================================
# 前置检查
# ============================================
echo -e "${CYAN}"
echo "============================================"
echo "  红灯笼食府管理系统 - 生产环境安装"
echo "============================================"
echo -e "${NC}"

# 检查 root 权限（Nginx 配置需要）
if [ "$(id -u)" -ne 0 ]; then
    error "此脚本需要 root 权限运行（Nginx 配置需要）"
    echo "    请使用：sudo bash install.sh"
    exit 1
fi

info "即将执行以下操作："
echo "  1. 检查 Node.js 环境"
echo "  2. 安装 npm 依赖"
echo "  3. 构建前端和后端"
echo "  4. 配置 .env 环境变量"
echo "  5. 安装并启动 PM2 进程管理"
echo "  6. 配置 Nginx 反向代理"
echo ""
read -p "确认继续？(y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    info "已取消"
    exit 0
fi

# ============================================
# 1. 环境检查
# ============================================
step "1/6 检查 Node.js 环境"

if ! command -v node &> /dev/null; then
    error "未检测到 Node.js，请先安装 Node.js 18+"
    echo "    Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "    CentOS/RHEL:   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo yum install -y nodejs"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    error "未检测到 npm，请重新安装 Node.js"
    exit 1
fi

NODE_VERSION=$(node -v)
info "Node.js 版本：${NODE_VERSION}"

# 解析主版本号
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    error "Node.js 版本过低（当前 ${NODE_MAJOR}），需要 18+"
    echo "    请升级 Node.js：https://nodejs.org/"
    exit 1
fi

success "环境检查通过"

# ============================================
# 2. 安装依赖
# ============================================
step "2/6 安装 npm 依赖（可能需要几分钟）"

if ! npm install; then
    error "npm install 失败"
    echo "    请检查网络连接或 npm 镜像配置"
    exit 1
fi

success "依赖安装完成"

# ============================================
# 3. 构建前端
# ============================================
step "3/6 构建前端"

if ! npm run build; then
    error "前端构建失败"
    echo "    请检查 TypeScript 类型错误或 Vite 配置"
    exit 1
fi

if [ ! -f "dist/index.html" ]; then
    error "前端构建产物缺失（dist/index.html 不存在）"
    exit 1
fi

success "前端构建完成"

# ============================================
# 4. 构建后端
# ============================================
step "4/6 构建后端"

if ! npm run build:server; then
    error "后端构建失败"
    echo "    请检查 server/ 下的 TypeScript 类型错误"
    exit 1
fi

if [ ! -f "server/dist/index.js" ]; then
    error "后端构建产物缺失（server/dist/index.js 不存在）"
    exit 1
fi

success "后端构建完成"

# ============================================
# 5. 配置 .env
# ============================================
step "5/6 配置环境变量"

if [ ! -f ".env" ]; then
    info "生成 .env 文件..."
    JWT_KEY=$(openssl rand -hex 48)
    cat > .env <<EOF
# 红灯笼食府管理系统 - 环境配置
# 服务端口
PORT=3000
# 运行环境
NODE_ENV=production
# JWT 密钥（请妥善保管，泄露后需重置）
JWT_SECRET=${JWT_KEY}
# 前端访问地址（用于 CORS 白名单，多地址用逗号分隔）
FRONTEND_URL=http://localhost:3000
EOF
    success "已生成 .env 文件（含随机 JWT_SECRET）"
elif ! grep -q "JWT_SECRET" .env; then
    info "检测到 .env 缺少 JWT_SECRET，正在追加..."
    JWT_KEY=$(openssl rand -hex 48)
    echo "JWT_SECRET=${JWT_KEY}" >> .env
    success "已追加 JWT_SECRET"
else
    info ".env 已存在 JWT_SECRET，跳过"
fi

# ============================================
# 6. 安装并启动 PM2 + 配置 Nginx
# ============================================
step "6/6 启动服务并配置 Nginx"

# 安装 PM2
if ! command -v pm2 &> /dev/null; then
    info "正在全局安装 PM2..."
    if ! npm install -g pm2; then
        error "PM2 安装失败"
        exit 1
    fi
fi

# 清理旧进程（忽略错误，首次运行时不存在）
pm2 delete "$APP_NAME" 2>/dev/null || true

# 启动服务
if ! pm2 start ecosystem.config.cjs --env production; then
    error "PM2 启动失败"
    echo "    可能原因：端口 3000 被占用"
    echo "    排查命令：lsof -i:3000 或 netstat -tlnp | grep 3000"
    exit 1
fi

# 保存进程列表
pm2 save || warn "pm2 save 失败（不影响本次运行，但开机自启可能不生效）"

# 配置开机自启
info "配置 PM2 开机自启..."
# 获取 node 路径，确保 systemd 服务能找到 node
NODE_BIN=$(which node)
NODE_DIR=$(dirname "$NODE_BIN")
env PATH=$PATH:$NODE_DIR pm2 startup systemd -u root --hp /root || {
    warn "PM2 开机自启配置失败，请手动执行：pm2 startup systemd"
}

success "PM2 服务启动成功"

# ============================================
# 配置 Nginx
# ============================================
info "配置 Nginx 反向代理..."

# 检查并安装 Nginx
if ! command -v nginx &> /dev/null; then
    info "安装 Nginx..."
    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y nginx
    elif command -v yum &> /dev/null; then
        yum install -y nginx
    elif command -v dnf &> /dev/null; then
        dnf install -y nginx
    else
        warn "无法自动安装 Nginx（未识别的包管理器）"
        warn "请手动安装 Nginx 后重新运行此脚本，或手动配置反向代理到 127.0.0.1:3000"
        # 跳过 Nginx 配置，直接到完成提示
        NGINX_SKIP=1
    fi
fi

if [ "${NGINX_SKIP:-0}" != "1" ]; then
    # 确保目录存在
    mkdir -p /etc/nginx/sites-available
    mkdir -p /etc/nginx/sites-enabled

    # 复制 Nginx 配置
    cp nginx.conf "/etc/nginx/sites-available/${NGINX_CONF_NAME}"

    # 创建软链接（-f 强制覆盖已存在的）
    ln -sf "/etc/nginx/sites-available/${NGINX_CONF_NAME}" "/etc/nginx/sites-enabled/${NGINX_CONF_NAME}"

    # 移除默认站点（避免 80 端口冲突）
    if [ -L /etc/nginx/sites-enabled/default ]; then
        rm -f /etc/nginx/sites-enabled/default
        info "已禁用 Nginx 默认站点"
    fi

    # 确保 nginx.conf 包含 sites-enabled（部分发行版默认不包含）
    if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
        warn "/etc/nginx/nginx.conf 未包含 sites-enabled 目录"
        warn "请手动添加：include /etc/nginx/sites-enabled/*;"
    fi

    # 测试 Nginx 配置
    if nginx -t; then
        # 重载 Nginx
        systemctl reload nginx 2>/dev/null || nginx -s reload
        success "Nginx 配置完成并已重载"
    else
        error "Nginx 配置测试失败，请检查配置文件"
        echo "    配置文件位置：/etc/nginx/sites-available/${NGINX_CONF_NAME}"
        exit 1
    fi
fi

# ============================================
# 完成
# ============================================
echo -e "${GREEN}"
echo "============================================"
echo "  安装完成！"
echo "============================================"
echo -e "${NC}"

info "访问地址："
echo "  本机：  http://localhost:3000"
echo "  Nginx：http://localhost（需先修改 server_name）"
echo "  健康检查：http://localhost:3000/health"

echo ""
info "默认管理员账号：admin"
info "默认密码：      admin123"
warn "（首次登录后请立即修改密码）"

echo ""
info "PM2 常用命令："
echo "  pm2 status                         查看进程状态"
echo "  pm2 logs                           查看日志"
echo "  pm2 logs ${APP_NAME}              查看本应用日志"
echo "  pm2 restart ${APP_NAME}           重启服务"
echo "  pm2 stop ${APP_NAME}              停止服务"
echo "  pm2 delete ${APP_NAME}            删除进程"

echo ""
info "Nginx 配置文件：/etc/nginx/sites-available/${NGINX_CONF_NAME}"
warn "请修改该文件中的 server_name your-domain.com 为你的实际域名"
warn "修改后执行：systemctl reload nginx"

echo ""
info "防火墙提示（如已启用 ufw）："
echo "  sudo ufw allow 80/tcp"
echo "  sudo ufw allow 443/tcp"

echo ""
info "数据库文件位置：$(pwd)/server/data/restaurant.db"
warn "请定期备份 server/data/ 目录"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  部署成功，祝您使用愉快！${NC}"
echo -e "${GREEN}============================================${NC}"
