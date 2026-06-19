@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: 红灯笼食府管理系统 - 启动脚本 (Windows)

echo.
echo ========================================
echo    红灯笼食府管理系统 - 启动服务
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
echo [INFO] Node.js 版本:
node -v

:: 2. 检查是否已构建
if not exist "server\dist\index.js" (
    echo [ERROR] 未找到构建产物 server\dist\index.js
    echo [WARN] 请先运行安装脚本或手动构建：
    echo   install.bat
    echo   或 npm run build:production
    pause
    exit /b 1
)
echo [INFO] 构建产物检查通过

:: 3. 读取端口
set APP_PORT=3000
if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
        if "%%a"=="PORT" set APP_PORT=%%b
    )
)
:: 去除空格
for /f "tokens=* delims= " %%p in ("!APP_PORT!") do set APP_PORT=%%p
echo [INFO] 服务端口: !APP_PORT!

:: 4. 检查端口是否被占用
netstat -ano | findstr "LISTENING" | findstr ":!APP_PORT! " >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARN] 端口 !APP_PORT! 已被占用！
    echo.
    echo   可能的原因：
    echo     - 服务已在运行中
    echo     - 其他程序占用了该端口
    echo.
    echo   解决方法：
    echo     - 运行 stop.bat 停止现有服务
    echo     - 修改 .env 中的 PORT 配置
    echo.
    pause
    exit /b 1
)

:: 5. 创建日志目录
if not exist "logs" mkdir logs

:: 6. 启动服务
echo.
where pm2 >nul 2>&1
if %errorlevel% equ 0 (
    :: ===== PM2 启动 =====
    echo [INFO] 使用 PM2 启动服务...

    :: 检查是否已在运行
    pm2 describe red-lantern-restaurant >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] 检测到服务已在 PM2 中运行，正在重启...
        call pm2 restart ecosystem.config.cjs
    ) else (
        call pm2 start ecosystem.config.cjs
    )

    :: 保存 PM2 进程列表
    call pm2 save >nul 2>&1

    echo.
    echo ========================================
    echo    服务已启动！
    echo ========================================
    echo.
    echo   本机访问:   http://localhost:!APP_PORT!
    echo.
    echo   管理命令:
    echo     查看状态:  pm2 status
    echo     查看日志:  pm2 logs red-lantern-restaurant
    echo     重启服务:  pm2 restart red-lantern-restaurant
    echo     停止服务:  stop.bat
    echo.
) else (
    :: ===== 直接启动（后台运行）=====
    echo [INFO] 未检测到 PM2，使用直接启动模式...
    echo [WARN] 建议安装 PM2 以获得更好的进程管理：npm install -g pm2
    echo.

    set NODE_ENV=production
    start /b "" node server\dist\index.js > logs\out.log 2>&1

    :: 等待一下确认启动
    timeout /t 2 /nobreak >nul

    :: 检查端口是否已开始监听
    netstat -ano | findstr "LISTENING" | findstr ":!APP_PORT! " >nul 2>&1
    if !errorlevel! equ 0 (
        echo ========================================
        echo    服务已启动！
        echo ========================================
        echo.
        echo   本机访问:   http://localhost:!APP_PORT!
        echo.
        echo   日志文件:  logs\out.log
        echo   停止服务:  stop.bat
        echo.
        echo [WARN] 直接启动模式下，关闭此窗口将停止服务
        echo [WARN] 建议使用 PM2 管理进程
        echo.
    ) else (
        echo [ERROR] 服务启动失败，请检查日志: logs\out.log
        type logs\out.log 2>nul
        echo.
    )
)

pause
