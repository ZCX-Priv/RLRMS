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
for /f "tokens=1 delims=." %%a in ('node -v ^| findstr /r "[0-9]"') do set NODE_MAJOR=%%a
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
) else (
    echo [WARN] 未检测到 PM2 进程管理器
    echo   建议使用 PM2 管理生产环境进程：
    echo   npm install -g pm2
)

:: 8. 完成
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
echo   生产环境（PM2 托管）：
echo     pm2 start ecosystem.config.cjs
echo     pm2 save
echo.
)
echo 服务默认端口: 3000 (可在 .env 中修改 PORT)
echo.
pause
