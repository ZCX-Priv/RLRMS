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
    read -p "是否立即用 PM2 启动服务？[Y/n] " pm2_choice
    if [[ ! "$pm2_choice" =~ ^[Nn]$ ]]; then
        info "正在用 PM2 启动服务..."
        cd "$SCRIPT_DIR"
        pm2 start ecosystem.config.cjs
        pm2 save
        info "PM2 服务已启动，运行 pm2 status 查看状态"
        info "建议执行 pm2 startup 设置开机自启"
    else
        warn "跳过 PM2 自动启动（可稍后执行: pm2 start ecosystem.config.cjs）"
    fi
else
    warn "未检测到 PM2 进程管理器"
    echo "  建议使用 PM2 管理生产环境进程："
    echo "  npm install -g pm2"
fi

# 8. 检查 Nginx
echo ""
if command -v nginx &> /dev/null; then
    NGINX_VER=$(nginx -v 2>&1)
    info "检测到 Nginx 已安装: $NGINX_VER"
    read -p "是否配置 Nginx 反向代理服务？[Y/n] " nginx_choice
    if [[ "$nginx_choice" =~ ^[Nn]$ ]]; then
        warn "跳过 Nginx 配置"
    else
        info "正在配置 Nginx..."

        # 判断系统类型（Debian/Ubuntu vs CentOS/RHEL）
        if [ -d /etc/nginx/sites-available ]; then
            NGINX_CONF_DIR="/etc/nginx/sites-available"
            NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
            NGINX_CONF_NAME="red-lantern.conf"
            NGINX_USE_SITES=true
        else
            NGINX_CONF_DIR="/etc/nginx/conf.d"
            NGINX_CONF_NAME="red-lantern.conf"
            NGINX_USE_SITES=false
        fi

        # 读取服务端口
        APP_PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
        APP_PORT=${APP_PORT:-3000}

        # 生成配置文件（替换端口占位）
        if [ -f "$SCRIPT_DIR/nginx.conf" ]; then
            sed "s/127\.0\.0\.1:3000/127.0.0.1:$APP_PORT/g" "$SCRIPT_DIR/nginx.conf" > "/tmp/red-lantern-nginx.conf"
        else
            warn "未找到项目目录中的 nginx.conf 模板，跳过自动配置"
        fi

        if [ -f /tmp/red-lantern-nginx.conf ]; then
            # 复制到配置目录（需要 root 权限）
            if command -v sudo &> /dev/null; then
                sudo cp /tmp/red-lantern-nginx.conf "$NGINX_CONF_DIR/$NGINX_CONF_NAME"

                if [ "$NGINX_USE_SITES" = true ]; then
                    # 创建软链接
                    sudo ln -sf "$NGINX_CONF_DIR/$NGINX_CONF_NAME" "$NGINX_ENABLED_DIR/$NGINX_CONF_NAME"
                    # 移除默认站点（避免端口冲突）
                    if [ -f "$NGINX_ENABLED_DIR/default" ]; then
                        sudo rm -f "$NGINX_ENABLED_DIR/default"
                        info "已移除默认站点配置（避免端口冲突）"
                    fi
                fi

                # 添加 WebSocket upgrade 变量映射（如果不存在）
                if ! grep -q 'connection_upgrade' /etc/nginx/nginx.conf 2>/dev/null; then
                    info "正在添加 WebSocket upgrade 变量映射到 /etc/nginx/nginx.conf..."
                    # 使用 awk 精确插入，避免 sed 转义问题
                    sudo awk '
                        /http\s*\{/ && !done {
                            print
                            print "    map $http_upgrade $connection_upgrade {"
                            print "        default upgrade;"
                            print "        '\'''\'' close;"
                            print "    }"
                            done=1
                            next
                        }
                        {print}
                    ' /etc/nginx/nginx.conf > /tmp/nginx.conf.tmp
                    sudo mv /tmp/nginx.conf.tmp /etc/nginx/nginx.conf
                fi

                # 检测配置语法
                if sudo nginx -t 2>&1; then
                    info "Nginx 配置语法检测通过"
                    sudo systemctl reload nginx 2>/dev/null || sudo service nginx reload 2>/dev/null
                    if [ $? -eq 0 ]; then
                        info "Nginx 已重载，反向代理服务已启用"
                        info "访问地址: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"
                    else
                        warn "Nginx 重载失败，请手动执行: sudo systemctl reload nginx"
                    fi
                else
                    error "Nginx 配置语法有误，请手动检查: $NGINX_CONF_DIR/$NGINX_CONF_NAME"
                fi
            else
                warn "需要 root 权限来配置 Nginx，请手动执行："
                echo "  sudo cp /tmp/red-lantern-nginx.conf $NGINX_CONF_DIR/$NGINX_CONF_NAME"
                [ "$NGINX_USE_SITES" = true ] && echo "  sudo ln -sf $NGINX_CONF_DIR/$NGINX_CONF_NAME $NGINX_ENABLED_DIR/$NGINX_CONF_NAME"
                echo "  sudo nginx -t && sudo systemctl reload nginx"
            fi
            rm -f /tmp/red-lantern-nginx.conf
        fi
    fi
else
    warn "未检测到 Nginx（如需要，请先安装后重新运行此脚本）"
fi

# 9. 检查 Apache
echo ""
APACHE_CMD=""
if command -v apache2 &> /dev/null; then
    APACHE_CMD="apache2"
elif command -v httpd &> /dev/null; then
    APACHE_CMD="httpd"
fi

if [ -n "$APACHE_CMD" ]; then
    APACHE_VER=$($APACHE_CMD -v 2>/dev/null | head -1)
    info "检测到 Apache 已安装: $APACHE_VER"
    read -p "是否配置 Apache 反向代理服务？[Y/n] " apache_choice
    if [[ "$apache_choice" =~ ^[Nn]$ ]]; then
        warn "跳过 Apache 配置"
    else
        info "正在配置 Apache..."

        # 读取服务端口
        APP_PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
        APP_PORT=${APP_PORT:-3000}

        # 生成配置文件
        if [ -f "$SCRIPT_DIR/apache.conf" ]; then
            sed "s/127\.0\.0\.1:3000/127.0.0.1:$APP_PORT/g" "$SCRIPT_DIR/apache.conf" > "/tmp/red-lantern-apache.conf"
        else
            warn "未找到项目目录中的 apache.conf 模板，跳过自动配置"
        fi

        if [ -f /tmp/red-lantern-apache.conf ]; then
            if command -v sudo &> /dev/null; then
                # 判断系统类型
                if [ "$APACHE_CMD" = "apache2" ]; then
                    # Debian/Ubuntu
                    APACHE_CONF_DIR="/etc/apache2/sites-available"
                    APACHE_CONF_NAME="red-lantern.conf"
                    sudo cp /tmp/red-lantern-apache.conf "$APACHE_CONF_DIR/$APACHE_CONF_NAME"

                    # 启用必要模块
                    info "启用 Apache 必要模块..."
                    sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers 2>/dev/null

                    # 启用站点
                    sudo a2ensite red-lantern 2>/dev/null

                    # 禁用默认站点（避免端口冲突）
                    if [ -f /etc/apache2/sites-enabled/000-default.conf ]; then
                        sudo a2dissite 000-default 2>/dev/null
                        info "已禁用默认站点（避免端口冲突）"
                    fi

                    # 检测配置语法
                    if sudo apache2ctl configtest 2>&1 | grep -q "Syntax OK"; then
                        info "Apache 配置语法检测通过"
                        sudo systemctl reload apache2 2>/dev/null || sudo service apache2 reload 2>/dev/null
                        if [ $? -eq 0 ]; then
                            info "Apache 已重载，反向代理服务已启用"
                        else
                            warn "Apache 重载失败，请手动执行: sudo systemctl reload apache2"
                        fi
                    else
                        error "Apache 配置语法有误，请手动检查: $APACHE_CONF_DIR/$APACHE_CONF_NAME"
                    fi
                else
                    # CentOS/RHEL
                    APACHE_CONF_DIR="/etc/httpd/conf.d"
                    APACHE_CONF_NAME="red-lantern.conf"
                    sudo cp /tmp/red-lantern-apache.conf "$APACHE_CONF_DIR/$APACHE_CONF_NAME"

                    if sudo $APACHE_CMD -t 2>&1 | grep -q "Syntax OK"; then
                        info "Apache 配置语法检测通过"
                        sudo systemctl reload httpd 2>/dev/null
                        if [ $? -eq 0 ]; then
                            info "Apache 已重载，反向代理服务已启用"
                        else
                            warn "Apache 重载失败，请手动执行: sudo systemctl reload httpd"
                        fi
                    else
                        error "Apache 配置语法有误，请手动检查: $APACHE_CONF_DIR/$APACHE_CONF_NAME"
                    fi
                fi
            else
                warn "需要 root 权限来配置 Apache，请手动执行："
                if [ "$APACHE_CMD" = "apache2" ]; then
                    echo "  sudo cp /tmp/red-lantern-apache.conf /etc/apache2/sites-available/red-lantern.conf"
                    echo "  sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers"
                    echo "  sudo a2ensite red-lantern && sudo systemctl reload apache2"
                else
                    echo "  sudo cp /tmp/red-lantern-apache.conf /etc/httpd/conf.d/red-lantern.conf"
                    echo "  sudo systemctl reload httpd"
                fi
            fi
            rm -f /tmp/red-lantern-apache.conf
        fi
    fi
else
    warn "未检测到 Apache（如需要，请先安装后重新运行此脚本）"
fi

# 10. 检查 Docker
echo ""
if command -v docker &> /dev/null; then
    DOCKER_VER=$(docker --version 2>/dev/null)
    info "检测到 Docker 已安装: $DOCKER_VER"
    if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
        read -p "是否使用 Docker Compose 部署服务？[y/N] " docker_choice
        if [[ "$docker_choice" =~ ^[Yy]$ ]]; then
            info "正在使用 Docker Compose 构建并启动服务..."
            cd "$SCRIPT_DIR"
            docker compose up -d --build
            if [ $? -eq 0 ]; then
                info "Docker 服务已启动"
                info "查看日志: docker compose logs -f"
                info "停止服务: docker compose down"
            else
                error "Docker Compose 启动失败，请查看上方错误日志"
            fi
        else
            info "跳过 Docker 部署（可稍后手动执行: docker compose up -d）"
        fi
    fi
else
    warn "未检测到 Docker（如需容器化部署，请先安装 Docker）"
fi

# 11. 完成
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
echo "  生产环境（PM2 托管，推荐）："
echo "    pm2 start ecosystem.config.cjs"
echo "    pm2 save"
echo "    pm2 startup"
echo ""
fi
if command -v docker &> /dev/null && [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
echo "  Docker 部署："
echo "    docker compose up -d"
echo "    docker compose logs -f"
echo ""
fi
echo "服务默认端口: 3000 (可在 .env 中修改 PORT)"
echo ""
echo "快捷命令："
echo "  启动服务:  ./start.sh"
echo "  停止服务:  ./stop.sh"
echo ""
if command -v nginx &> /dev/null; then
echo "Nginx 代理已配置（如已启用），访问地址: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"
echo ""
fi
if [ -n "$APACHE_CMD" ]; then
echo "Apache 代理已配置（如已启用），访问地址: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"
echo ""
fi
