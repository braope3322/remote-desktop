import websocket
import json
import threading
import time
import base64
import os
import platform
import getpass
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


def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')


def print_header():
    clear_screen()
    print("")
    print("  " + "=" * 46)
    print("  |                                            |")
    print("  |          SUPORTE REMOTO TECNICO            |")
    print("  |                                            |")
    print("  " + "=" * 46)
    print("")


def print_status(status, id_code=None):
    print_header()

    if status == "connecting":
        print("  Status: Conectando ao servidor seguro...")
        print("")
        print("  " + "-" * 46)
        print("  Conexao criptografada SSL/TLS")
        print("  " + "-" * 46)

    elif status == "waiting":
        print("  Status: AGUARDANDO OPERADOR")
        print("")
        print("  " + "=" * 46)
        print(f"  |     SEU CODIGO DE ACESSO: {id_code}        |")
        print("  " + "=" * 46)
        print("")
        print("  Informe este codigo ao tecnico de suporte.")
        print("  Aguardando conexao do operador...")
        print("")
        print("  " + "-" * 46)
        print("  Para encerrar: feche esta janela")
        print("  " + "-" * 46)

    elif status == "connected":
        print("  Status: OPERADOR CONECTADO")
        print("")
        print("  " + "!" * 46)
        print("  !  SESSAO DE SUPORTE REMOTO EM ANDAMENTO   !")
        print("  !  Sua tela esta sendo compartilhada       !")
        print("  " + "!" * 46)
        print("")
        print(f"  Codigo da sessao: {id_code}")
        print("  Conexao segura: SSL/TLS ativo")
        print("")
        print("  " + "-" * 46)
        print("  Para encerrar: feche esta janela")
        print("  " + "-" * 46)

    elif status == "disconnected":
        print("  Status: OPERADOR DESCONECTADO")
        print("")
        print(f"  Codigo de acesso: {id_code}")
        print("  Aguardando reconexao do operador...")
        print("")
        print("  " + "-" * 46)
        print("  Para encerrar: feche esta janela")
        print("  " + "-" * 46)


def get_system_info():
    return {
        "hostname": platform.node(),
        "username": getpass.getuser(),
        "os": f"{platform.system()} {platform.release()}"
    }


def capture_screen():
    global panel_connected, running, current_quality, current_scale
    frame_count = 0

    with mss.mss() as sct:
        monitor = sct.monitors[1]

        while running:
            if not panel_connected:
                time.sleep(0.5)
                continue

            try:
                screenshot = sct.grab(monitor)
                img = Image.frombytes('RGB', screenshot.size, screenshot.bgra, 'raw', 'BGRX')

                new_width = int(img.width * current_scale)
                new_height = int(img.height * current_scale)
                img = img.resize((new_width, new_height), Image.LANCZOS)

                buffer = BytesIO()
                img.save(buffer, format='JPEG', quality=current_quality, optimize=True)
                frame_data = base64.b64encode(buffer.getvalue()).decode('utf-8')

                if ws_app and is_connected:
                    ws_app.send(json.dumps({
                        "type": "screen-frame",
                        "clientId": client_id,
                        "frame": frame_data,
                        "width": img.width,
                        "height": img.height
                    }))
                    frame_count += 1

                time.sleep(FRAME_INTERVAL)

            except Exception as e:
                time.sleep(1)


def handle_mouse_move(data):
    global current_scale
    try:
        x = int(data['x'] / current_scale)
        y = int(data['y'] / current_scale)
        pyautogui.moveTo(x, y, duration=0)
    except:
        pass


def handle_mouse_click(data):
    global current_scale
    try:
        x = int(data['x'] / current_scale)
        y = int(data['y'] / current_scale)
        button = data.get('button', 'left')
        clicks = data.get('clicks', 1)

        if button == 'right':
            pyautogui.click(x, y, button='right')
        elif button == 'middle':
            pyautogui.click(x, y, button='middle')
        else:
            pyautogui.click(x, y, clicks=clicks)
    except:
        pass


def handle_mouse_scroll(data):
    try:
        delta = data.get('delta', 0)
        pyautogui.scroll(delta)
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
        mapped_key = key_map.get(key, key)
        pyautogui.press(mapped_key)
    except:
        pass


def handle_key_combination(data):
    try:
        keys = data.get('keys', [])
        key_map = {'Control': 'ctrl', 'Alt': 'alt', 'Shift': 'shift', 'Meta': 'win'}
        mapped_keys = [key_map.get(k, k.lower()) for k in keys]
        pyautogui.hotkey(*mapped_keys)
    except:
        pass


def handle_clipboard_set(data):
    try:
        content = data.get('content', '')
        pyperclip.copy(content)
    except:
        pass


def handle_file_upload(data):
    try:
        filename = data.get('filename', 'file')
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
                "error": str(e)
            }))


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
        elif msg_type == 'disconnect-client':
            print_header()
            print("  Sessao encerrada pelo operador.")
            print("")
            print("  Obrigado por usar nosso suporte!")
            print("")
            running = False
            time.sleep(2)
            os._exit(0)

    except Exception as e:
        pass


def on_error(ws, error):
    pass


def on_close(ws, close_status_code, close_msg):
    global is_connected, panel_connected
    is_connected = False
    panel_connected = False


def on_open(ws):
    global is_connected
    is_connected = True
    info = get_system_info()
    ws.send(json.dumps({"type": "register-client", **info}))


def main():
    global ws_app, running

    print_status("connecting")

    screen_thread = threading.Thread(target=capture_screen, daemon=True)
    screen_thread.start()

    while running:
        try:
            ws_app = websocket.WebSocketApp(
                SERVER_URL,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )
            ws_app.run_forever()

        except KeyboardInterrupt:
            running = False
            break
        except Exception as e:
            time.sleep(5)


if __name__ == "__main__":
    main()
