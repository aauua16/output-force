@echo off
chcp 65001 > nul
echo.
echo   Output Force - ファイアウォール設定
echo   （管理者として実行しています）
echo.

netsh advfirewall firewall add rule name="Output Force HTTP 3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Output Force HTTPS 3443" dir=in action=allow protocol=TCP localport=3443

echo.
echo   完了しました。他デバイスから接続できるようになります。
pause
