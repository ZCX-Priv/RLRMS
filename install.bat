@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: 红灯笼食府管理系统 - 安装脚本 (Windows)

echo.
echo ========================================
echo    红灯笼食府管理系统 - 安装程序
echo ========================================
echo.

:: 1. 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 未检测到 Node.js，请先安装 Node.js ^>= 18
    echo   官方下载: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
echo [INFO] Node.js 版本: 
node -v

:: 2. 检查 npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 未检测到 npm，请确认 Node.js 安装完整
    pause
    exit /b 1
)
echo [INFO] npm 版本: 
npm -v

:: 3. 安装依赖
echo [INFO] 正在安装依赖...
npm install --production=false
if %errorlevel% neq 0 (
    echo [ERROR] 依赖安装失败
    pause
    exit /b 1
)
echo [INFO] 依赖安装完成

:: 4. 构建项目
echo [INFO] 正在构建生产环境版本...
call npm run build:production
if %errorlevel% neq 0 (
    echo [ERROR] 构建失败
    pause
    exit /b 1
)
echo [INFO] 构建完成

:: 5. 创建日志目录
if not exist "logs" mkdir logs
echo [INFO] 日志目录已创建: logs\

:: 6. 检查 .env 文件
if not exist ".env" (
    echo PORT=3000> .env
    echo [INFO] 已创建默认 .env 文件 (PORT=3000)
)

:: 7. 检查 PM2
echo.
where pm2 >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] PM2 已安装
    set /p pm2_choice="是否立即用 PM2 启动服务？[Y/n]: "
    if /i "!pm2_choice!"=="" set pm2_choice=Y
    if /i "!pm2_choice!"=="Y" (
        echo [INFO] 正在用 PM2 启动服务...
        call pm2 start ecosystem.config.cjs
        call pm2 save
        echo [INFO] PM2 服务已启动，运行 pm2 status 查看状态
    ) else (
        echo [WARN] 跳过 PM2 自动启动
    )
) else (
    echo [WARN] 未检测到 PM2 进程管理器
    echo   建议使用 PM2 管理生产环境进程：
    echo   npm install -g pm2
)

:: 8. 检查 Nginx
echo.
where nginx >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] 检测到 Nginx 已安装
    
    :: 获取 nginx 安装路径
    for /f "delims=" %%i in ('where nginx') do (
        set "NGINX_EXE=%%i"
        goto :got_nginx_path
    )
    :got_nginx_path
    for %%i in ("!NGINX_EXE!") do set "NGINX_DIR=%%~dpi"
    :: 去掉末尾的斜杠
    if "!NGINX_DIR:~-1!"=="\" set "NGINX_DIR=!NGINX_DIR:~0,-1!"
    
    set /p nginx_choice="是否配置 Nginx 反向代理服务？[Y/n]: "
    if /i "!nginx_choice!"=="" set nginx_choice=Y
    
    if /i "!nginx_choice!"=="Y" (
        echo [INFO] 正在配置 Nginx...
        
        :: 检查 nginx 配置目录是否存在
        if exist "!NGINX_DIR!\conf\nginx.conf" (
            :: 复制项目 nginx.conf 到 nginx 的 conf 目录
            copy /Y "%~dp0nginx.conf" "!NGINX_DIR!\conf\red-lantern.conf" >nul 2>&1
            if !errorlevel! equ 0 (
                echo [INFO] 已复制 nginx.conf 到 !NGINX_DIR!\conf\red-lantern.conf
                
                :: 在 nginx.conf 中添加 include（如果未包含）
                findstr /C:"red-lantern.conf" "!NGINX_DIR!\conf\nginx.conf" >nul 2>&1
                if !errorlevel! neq 0 (
                    echo [INFO] 请在 !NGINX_DIR!\conf\nginx.conf 的 http 块中添加：
                    echo.
                    echo     include red-lantern.conf;
                    echo.
                    echo   然后重新加载 Nginx: nginx -s reload
                ) else (
                    echo [INFO] nginx.conf 已包含 red-lantern.conf 配置
                )
                
                :: 提示用户修改 server_name
                echo [WARN] 请编辑 !NGINX_DIR!\conf\red-lantern.conf 将 server_name 修改为你的域名或 IP
                echo [INFO] 配置完成后执行: nginx -t ^&^& nginx -s reload
            ) else (
                echo [ERROR] 复制配置文件失败，请手动复制 nginx.conf 到 Nginx 配置目录
            )
        ) else (
            echo [ERROR] 未找到 Nginx 配置目录，请手动配置
            echo [INFO] 配置文件模板: %~dp0nginx.conf
        )
    ) else (
        echo [WARN] 跳过 Nginx 配置
    )
) else (
    echo [WARN] 未检测到 Nginx（如需要，请先安装后重新运行此脚本）
)

:: 9. 检查 Apache
echo.
where httpd >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] 检测到 Apache 已安装
    
    :: 获取 httpd 安装路径
    for /f "delims=" %%i in ('where httpd') do (
        set "HTTPD_EXE=%%i"
        goto :got_httpd_path
    )
    :got_httpd_path
    for %%i in ("!HTTPD_EXE!") do set "HTTPD_DIR=%%~dpi"
    :: httpd 通常在 bin 目录下，需要回退一层
    for %%i in ("!HTTPD_DIR!\..") do set "APACHE_HOME=%%~fi"
    
    set /p apache_choice="是否配置 Apache 反向代理服务？[Y/n]: "
    if /i "!apache_choice!"=="" set apache_choice=Y
    
    if /i "!apache_choice!"=="Y" (
        echo [INFO] 正在配置 Apache...
        
        if exist "!APACHE_HOME!\conf\httpd.conf" (
            :: 复制 apache.conf 到 Apache 配置目录
            copy /Y "%~dp0apache.conf" "!APACHE_HOME!\conf\extra\red-lantern.conf" >nul 2>&1
            if !errorlevel! equ 0 (
                echo [INFO] 已复制 apache.conf 到 !APACHE_HOME!\conf\extra\red-lantern.conf
                
                :: 在 httpd.conf 中添加 Include（如果未包含）
                findstr /C:"red-lantern.conf" "!APACHE_HOME!\conf\httpd.conf" >nul 2>&1
                if !errorlevel! neq 0 (
                    echo [INFO] 请在 !APACHE_HOME!\conf\httpd.conf 末尾添加：
                    echo.
                    echo     Include conf/extra/red-lantern.conf
                    echo.
                    echo   然后重启 Apache: httpd -k restart
                ) else (
                    echo [INFO] httpd.conf 已包含 red-lantern.conf 配置
                )
                
                :: 提示用户修改 server_name
                echo [WARN] 请编辑 !APACHE_HOME!\conf\extra\red-lantern.conf 将 ServerName 修改为你的域名或 IP
                echo [INFO] 配置完成后重启 Apache: httpd -k restart
            ) else (
                echo [ERROR] 复制配置文件失败，请手动复制 apache.conf 到 Apache 配置目录
            )
        ) else (
            echo [ERROR] 未找到 Apache 配置目录，请手动配置
            echo [INFO] 配置文件模板: %~dp0apache.conf
        )
    ) else (
        echo [WARN] 跳过 Apache 配置
    )
) else (
    echo [WARN] 未检测到 Apache（如需要，请先安装后重新运行此脚本）
)

:: 10. 检查 Docker
echo.
where docker >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('docker --version 2^>nul') do set DOCKER_VER=%%v
    echo [INFO] 检测到 Docker 已安装: !DOCKER_VER!
    
    if exist "%~dp0docker-compose.yml" (
        set /p docker_choice="是否使用 Docker Compose 部署服务？[y/N]: "
        if /i "!docker_choice!"=="" set docker_choice=N
        
        if /i "!docker_choice!"=="Y" (
            echo [INFO] 正在使用 Docker Compose 构建并启动服务...
            docker compose up -d --build
            if !errorlevel! equ 0 (
                echo [INFO] Docker 服务已启动
                echo [INFO] 查看日志: docker compose logs -f
                echo [INFO] 停止服务: docker compose down
            ) else (
                echo [ERROR] Docker Compose 启动失败，请查看上方错误日志
            )
        ) else (
            echo [INFO] 跳过 Docker 部署（可稍后执行: docker compose up -d）
        )
    )
) else (
    echo [WARN] 未检测到 Docker（如需容器化部署，请先安装 Docker Desktop）
)

:: 11. 完成
echo.
echo ========================================
echo    安装完成！
echo ========================================
echo.
echo 启动方式：
echo.
echo   开发环境：
echo     npm run dev
echo.
echo   生产环境（直接启动）：
echo     npm run start:production
echo.
where pm2 >nul 2>&1
if %errorlevel% equ 0 (
echo   生产环境（PM2 托管，推荐）：
echo     pm2 start ecosystem.config.cjs
echo     pm2 save
echo.
)
where docker >nul 2>&1
if %errorlevel% equ 0 (
    if exist "%~dp0docker-compose.yml" (
echo   Docker 部署：
echo     docker compose up -d
echo     docker compose logs -f
echo.
    )
)
echo 服务默认端口: 3000 (可在 .env 中修改 PORT)
echo.
echo 快捷命令：
echo   启动服务:  start.bat
echo   停止服务:  stop.bat
echo.
pause
