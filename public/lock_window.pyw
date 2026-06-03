"""
Janela de Lock - Processo Separado
Usa WDA_EXCLUDEFROMCAPTURE para ser invisivel na captura
"""
import sys
import ctypes
import tkinter as tk

def main():
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

    # Aplicar WDA_EXCLUDEFROMCAPTURE
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

    tk.Label(frame, text="🔒", font=('Segoe UI Emoji', 72), bg='#000000', fg='#f59e0b').pack(pady=20)
    tk.Label(frame, text=message, font=('Segoe UI', 24, 'bold'), bg='#000000', fg='#ffffff', wraplength=700).pack(pady=15)
    tk.Label(frame, text="Por favor, aguarde o técnico liberar a tela.", font=('Segoe UI', 12), bg='#000000', fg='#555555').pack(pady=10)

    def keep_top():
        root.lift()
        root.attributes('-topmost', True)
        root.after(200, keep_top)

    keep_top()
    root.mainloop()

if __name__ == "__main__":
    main()
