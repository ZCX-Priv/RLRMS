@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: 红灯笼食府管理系统 - 停止脚本 (Windows)

echo.
echo ========================================
echo    红灯笼食府管理系统 - 停止服务
echo ========================================
echo.

set STOPPED=false

:: 读取端口
set APP_PORT=3000
if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
        if "%%a"=="PORT" set APP_PORT=%%b
    )
)
for /f "tokens=* delims= " %%p in ("!APP_PORT!") do set APP_PORT=%%p

:: 1. 优先通过 PM2 停止
where pm2 >nul 2>&1
if %errorlevel% equ 0 (
    pm2 describe red-lantern-restaurant >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] 正在通过 PM2 停止服务...
        call pm2 stop red-lantern-restaurant >nul 2>&1
        call pm2 delete red-lantern-restaurant >nul 2>&1
        call pm2 save --force >nul 2>&1
        echo [INFO] PM2 进程已停止
        set STOPPED=true
    )
)

:: 2. 通过端口查找并停止进程
if "!STOPPED!"=="false" (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":!APP_PORT! "') do (
        set "PORT_PID=%%a"
    )

    if defined PORT_PID if "!PORT_PID!" neq "0" (
        echo [INFO] 发现端口 !APP_PORT! 上的进程 ^(PID: !PORT_PID!^)，正在停止...
        taskkill /PID !PORT_PID! /F >nul 2>&1
        if !errorlevel! equ 0 (
            echo [INFO] 进程已停止
            set STOPPED=true
        ) else (
            echo [ERROR] 停止进程失败，请尝试以管理员身份运行
        )
    )
)

echo.
if "!STOPPED!"=="true" (
    echo [INFO] 服务已停止
) else (
    echo [WARN] 未发现正在运行的服务
)
echo.

pause
