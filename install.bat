@echo off
chcp 65001 >nul 2>nul
setlocal enabledelayedexpansion

REM ============================================
REM 红灯笼食府管理系统 - Windows 生产环境一键安装脚本
REM 功能：检查环境 → 安装依赖 → 构建产物 → 配置 .env → PM2 启动
REM ============================================

cd /d "%~dp0"

echo ============================================
echo   红灯笼食府管理系统 - 生产环境安装
echo ============================================
echo.
echo 即将执行以下操作：
echo   1. 检查 Node.js 环境
echo   2. 安装 npm 依赖
echo   3. 构建前端和后端
echo   4. 配置 .env 环境变量
echo   5. 安装并启动 PM2 进程管理
echo.
echo 请确认在项目根目录执行此脚本，按任意键继续...
pause >nul

REM ============================================
REM 1. 环境检查
REM ============================================
echo.
echo [1/6] 检查 Node.js 环境...

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18+
    echo        下载地址：https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 npm，请重新安装 Node.js
    pause
    exit /b 1
)

REM 获取 Node.js 版本
for /f "delims=" %%v in ('node -v') do set NODE_VERSION=%%v
echo   Node.js 版本：%NODE_VERSION%

REM 解析主版本号（去掉 v 前缀，取第一个点之前的部分）
set NODE_VERSION_NUM=%NODE_VERSION:v=%
for /f "tokens=1 delims=." %%a in ("%NODE_VERSION_NUM%") do set NODE_MAJOR=%%a

if %NODE_MAJOR% LSS 18 (
    echo [错误] Node.js 版本过低（当前 %NODE_MAJOR%），需要 18+
    echo        请升级 Node.js：https://nodejs.org/
    pause
    exit /b 1
)

echo   环境检查通过
echo.

REM ============================================
REM 2. 安装依赖
REM ============================================
echo [2/6] 安装 npm 依赖（可能需要几分钟）...
call npm install
if errorlevel 1 (
    echo [错误] npm install 失败
    echo        请检查网络连接或 npm 镜像配置
    pause
    exit /b 1
)
echo   依赖安装完成
echo.

REM ============================================
REM 3. 构建前端
REM ============================================
echo [3/6] 构建前端...
call npm run build
if errorlevel 1 (
    echo [错误] 前端构建失败
    echo        请检查 TypeScript 类型错误或 Vite 配置
    pause
    exit /b 1
)
if not exist "dist\index.html" (
    echo [错误] 前端构建产物缺失（dist\index.html 不存在）
    pause
    exit /b 1
)
echo   前端构建完成
echo.

REM ============================================
REM 4. 构建后端
REM ============================================
echo [4/6] 构建后端...
call npm run build:server
if errorlevel 1 (
    echo [错误] 后端构建失败
    echo        请检查 server/ 下的 TypeScript 类型错误
    pause
    exit /b 1
)
if not exist "server\dist\index.js" (
    echo [错误] 后端构建产物缺失（server\dist\index.js 不存在）
    pause
    exit /b 1
)
echo   后端构建完成
echo.

REM ============================================
REM 5. 配置 .env
REM ============================================
echo [5/6] 配置环境变量...

if exist ".env" (
    REM 检查是否已有 JWT_SECRET
    findstr /C:"JWT_SECRET" .env >nul
    if errorlevel 1 (
        echo   正在生成 JWT_SECRET 并追加到 .env...
        for /f "delims=" %%k in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set JWT_KEY=%%k
        echo JWT_SECRET=!JWT_KEY!>>.env
        echo   已追加 JWT_SECRET
    ) else (
        echo   .env 已存在 JWT_SECRET，跳过
    )
) else (
    echo   正在生成 .env 文件...
    for /f "delims=" %%k in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set JWT_KEY=%%k
    (
        echo # 红灯笼食府管理系统 - 环境配置
        echo # 服务端口
        echo PORT=3000
        echo # 运行环境
        echo NODE_ENV=production
        echo # JWT 密钥（请妥善保管，泄露后需重置）
        echo JWT_SECRET=!JWT_KEY!
        echo # 前端访问地址（用于 CORS 白名单，多地址用逗号分隔）
        echo FRONTEND_URL=http://localhost:3000
    ) > .env
    echo   已生成 .env 文件
)
echo.

REM ============================================
REM 6. 安装并启动 PM2
REM ============================================
echo [6/6] 启动服务...

where pm2 >nul 2>nul
if errorlevel 1 (
    echo   正在全局安装 PM2...
    call npm install -g pm2
    if errorlevel 1 (
        echo [错误] PM2 安装失败
        echo        请尝试以管理员身份运行此脚本
        pause
        exit /b 1
    )
)

REM 清理旧进程（忽略错误，首次运行时不存在）
call pm2 delete red-lantern-restaurant >nul 2>nul

REM 启动服务
call pm2 start ecosystem.config.cjs --env production
if errorlevel 1 (
    echo [错误] PM2 启动失败
    echo        可能原因：端口 3000 被占用
    echo        排查命令：netstat -ano ^| findstr :3000
    pause
    exit /b 1
)

REM 保存 PM2 进程列表（用于开机自启恢复）
call pm2 save >nul 2>nul

echo   服务启动成功
echo.

REM ============================================
REM 完成
REM ============================================
echo ============================================
echo   安装完成！
echo ============================================
echo.
echo 访问地址：http://localhost:3000
echo 健康检查：http://localhost:3000/health
echo.
echo 默认管理员账号：admin
echo 默认密码：      admin123
echo （首次登录后请立即修改密码）
echo.
echo PM2 常用命令：
echo   pm2 status                            查看进程状态
echo   pm2 logs                              查看日志
echo   pm2 logs red-lantern-restaurant       查看本应用日志
echo   pm2 restart red-lantern-restaurant    重启服务
echo   pm2 stop red-lantern-restaurant       停止服务
echo   pm2 delete red-lantern-restaurant     删除进程
echo.
echo 开机自启配置（可选）：
echo   1. npm install -g pm2-windows-startup
echo   2. pm2-startup install
echo   3. pm2 save
echo.
echo ============================================
pause
endlocal
