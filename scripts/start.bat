@echo off
chcp 65001 > nul
cd /d "%~dp0.."
echo.
echo   ⚡ Output Force を起動しています...
echo.

where python > nul 2>&1
if errorlevel 1 (
    echo   [エラー] Python 3.9+ が見つかりません。python.org からインストールしてください。
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo   初回セットアップ: 仮想環境を作成中...
    python -m venv .venv
    .venv\Scripts\pip install -r requirements.txt
    echo.
)

rem 個人設定（保存先など）。Git管理外。例: set OUTPUT_FORCE_DATA_DIR=C:\Users\me\Vault\output-force
if exist "%~dp0..\config.local.bat" call "%~dp0..\config.local.bat"

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
.venv\Scripts\python server.py
pause
