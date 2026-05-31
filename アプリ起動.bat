@echo off
chcp 65001 > nul
title Output Force
echo.
echo   Output Force  起動しています...
echo.
cd /d "%~dp0"

where node > nul 2>&1
if errorlevel 1 (
    echo   [エラー] Node.js が見つかりません。nodejs.org からインストールしてください。
    pause
    exit /b 1
)

if not exist node_modules\express (
    echo   初回セットアップ中...
    npm install
    if errorlevel 1 ( echo   失敗しました。 & pause & exit /b 1 )
    echo.
)

taskkill /f /im node.exe > nul 2>&1
timeout /t 1 /nobreak > nul

echo   サーバーを起動しています...
start /min "Output Force Server" node server.js
timeout /t 4 /nobreak > nul

echo   アプリを開いています...
set EDGE="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist %EDGE% set EDGE="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist %EDGE% (
    echo   Edge が見つかりません。ブラウザで http://localhost:3000 を開いてください。
    pause
    exit /b 0
)
start "" %EDGE% --app=http://localhost:3000 --new-window

echo   起動完了。このウィンドウは自動で閉じます。
timeout /t 2 /nobreak > nul