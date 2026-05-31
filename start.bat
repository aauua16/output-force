@echo off
chcp 65001 > nul
echo.
echo   ⚡ Output Force を起動しています...
echo.
cd /d "%~dp0"

where node > nul 2>&1
if errorlevel 1 (
    echo   [エラー] Node.js が見つかりません。
    echo.
    echo   今すぐダウンロードページを開きますか？
    echo   インストール後、このファイルを再度実行してください。
    echo.
    choice /c YN /m "ダウンロードページを開く"
    if errorlevel 1 if not errorlevel 2 start "" "https://nodejs.org/ja/download"
    pause
    exit /b 1
)

if not exist node_modules (
    echo   初回セットアップ: npm install を実行中...
    npm install
    if errorlevel 1 (
        echo   [エラー] npm install に失敗しました。
        pause
        exit /b 1
    )
    echo.
)

if not exist data (
    mkdir data
)

start "" https://localhost:3000
node server.js
pause
