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

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0

client_id = None
is_connected = False
panel_connected = False
ws_app = None
running = True


def get_system_info():
    return {
        "hostname": platform.node(),
        "username": getpass.getuser(),
        "os": f"{platform.system()} {platform.release()}"
    }


def capture_screen():
    global panel_connected, running
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

                new_width = int(img.width * SCALE)
                new_height = int(img.height * SCALE)
                img = img.resize((new_width, new_height), Image.LANCZOS)

                buffer = BytesIO()
                img.save(buffer, format='JPEG', quality=QUALITY, optimize=True)
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
                    if frame_count % 30 == 0:
                        print(f"Transmitindo... {frame_count} frames")

                time.sleep(FRAME_INTERVAL)

            except Exception as e:
                print(f"Erro na captura: {e}")
                time.sleep(1)


def handle_mouse_move(data):
    try:
        x = int(data['x'] / SCALE)
        y = int(data['y'] / SCALE)
        pyautogui.moveTo(x, y, duration=0)
    except:
        pass


def handle_mouse_click(data):
    try:
        x = int(data['x'] / SCALE)
        y = int(data['y'] / SCALE)
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
        print(f"Clipboard recebido: {content[:30]}...")
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
        print(f"Arquivo salvo: {filename}")
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
    global client_id, panel_connected

    try:
        data = json.loads(message)
        msg_type = data.get('type')

        if msg_type == 'registered':
            client_id = data.get('clientId')
            print("")
            print("  " + "=" * 41)
            print(f"       SEU ID DE ACESSO: {client_id}")
            print("  " + "=" * 41)
            print("")
            print("  Compartilhe este ID com o operador")
            print("  Aguardando conexao do operador...")
            print("")

        elif msg_type == 'panel-connected':
            panel_connected = True
            print("  [!] Operador CONECTADO - transmitindo tela...")
            print("")

        elif msg_type == 'panel-disconnected':
            panel_connected = False
            print("")
            print("  [x] Operador DESCONECTADO")
            print("  Aguardando nova conexao...")
            print("")

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
        elif msg_type == 'disconnect-client':
            print("Sessao encerrada pelo operador.")
            running = False
            os._exit(0)

    except Exception as e:
        print(f"Erro: {e}")


def on_error(ws, error):
    print(f"Erro de conexao: {error}")


def on_close(ws, close_status_code, close_msg):
    global is_connected, panel_connected
    is_connected = False
    panel_connected = False
    print("Desconectado do servidor")


def on_open(ws):
    global is_connected
    is_connected = True
    print("Conectado ao servidor!")
    info = get_system_info()
    ws.send(json.dumps({"type": "register-client", **info}))


def main():
    global ws_app, running

    print("")
    print("=" * 45)
    print("           SUPORTE REMOTO ATIVO")
    print("=" * 45)
    print("")
    print("  Conectando ao servidor...")
    print("")
    print("  Para ENCERRAR: Feche esta janela")
    print("                 ou pressione Ctrl+C")
    print("")
    print("-" * 45)

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
            print("\nEncerrando...")
            break
        except Exception as e:
            print(f"Reconectando em 5s...")
            time.sleep(5)


if __name__ == "__main__":
    main()
