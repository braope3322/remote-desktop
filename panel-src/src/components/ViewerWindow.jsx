import { useEffect, useState, useRef, useCallback } from 'react';
import {
  X, Maximize2, Minimize2, Settings, Lock, Unlock,
  Upload, Clipboard, Keyboard, Mouse, ZoomIn, ZoomOut, Zap, ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';

const WS_URL = window.location.protocol === 'https:'
  ? `wss://${window.location.host}`
  : `ws://${window.location.host}`;

export function ViewerWindow() {
  const params = new URLSearchParams(window.location.search);
  const deviceId = params.get('id');
  const deviceName = params.get('name') || deviceId;
  const token = localStorage.getItem('rd_token');

  const [connected, setConnected] = useState(false);
  const [frame, setFrame] = useState(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [fps, setFps] = useState(0);
  const [keyboardActive, setKeyboardActive] = useState(true);
  const [mouseActive, setMouseActive] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [quality, setQuality] = useState(50);
  const [scale, setScale] = useState(0.6);
  const [isLocked, setIsLocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lockScreens, setLockScreens] = useState([]);
  const [selectedLockScreen, setSelectedLockScreen] = useState(null);
  const [showLockMenu, setShowLockMenu] = useState(false);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());

  // Fetch lock screens
  useEffect(() => {
    fetch('/api/lockscreens')
      .then(res => res.json())
      .then(data => {
        setLockScreens(data);
        if (data.length > 0) setSelectedLockScreen(data[0]);
      })
      .catch(console.error);
  }, []);

  // Connect WebSocket
  useEffect(() => {
    if (!token || !deviceId) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'auth-success') {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'connect-to-client', targetId: deviceId }));
      }

      if (msg.type === 'screen-frame' && msg.clientId === deviceId) {
        setFrame(msg.frame);
        setFrameSize({ width: msg.width, height: msg.height });
        frameCountRef.current++;

        const now = Date.now();
        if (now - lastFpsTimeRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;
        }
      }
    };

    ws.onclose = () => setConnected(false);

    return () => ws.close();
  }, [token, deviceId]);

  // Set quality on connect
  useEffect(() => {
    if (connected && wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({
        type: 'set-quality',
        targetId: deviceId,
        quality,
        scale
      }));
    }
  }, [connected, deviceId, quality, scale]);

  // Draw frame
  useEffect(() => {
    if (!frame || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = frameSize.width;
      canvas.height = frameSize.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = `data:image/jpeg;base64,${frame}`;
  }, [frame, frameSize]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width / zoom;
    const displayHeight = rect.height / zoom;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const offsetX = (e.clientX - centerX) / zoom + displayWidth / 2;
    const offsetY = (e.clientY - centerY) / zoom + displayHeight / 2;
    const scaleX = canvas.width / displayWidth;
    const scaleY = canvas.height / displayHeight;
    return { x: Math.round(offsetX * scaleX), y: Math.round(offsetY * scaleY) };
  };

  const handleClick = (e) => {
    if (!mouseActive) return;
    const coords = getCoords(e);
    if (coords) send({ type: 'mouse-click', targetId: deviceId, ...coords, button: 'left', clicks: 1 });
  };

  const handleDoubleClick = (e) => {
    if (!mouseActive) return;
    const coords = getCoords(e);
    if (coords) send({ type: 'mouse-click', targetId: deviceId, ...coords, button: 'left', clicks: 2 });
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!mouseActive) return;
    const coords = getCoords(e);
    if (coords) send({ type: 'mouse-click', targetId: deviceId, ...coords, button: 'right', clicks: 1 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (!mouseActive) return;
    send({ type: 'mouse-scroll', targetId: deviceId, delta: e.deltaY > 0 ? -3 : 3 });
  };

  const handleKeyDown = (e) => {
    if (!keyboardActive) return;
    e.preventDefault();
    const mods = [];
    if (e.ctrlKey) mods.push('Control');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (e.metaKey) mods.push('Meta');

    if (mods.length && !['Control','Alt','Shift','Meta'].includes(e.key)) {
      send({ type: 'key-combination', targetId: deviceId, keys: [...mods, e.key] });
    } else if (!['Control','Alt','Shift','Meta'].includes(e.key)) {
      send({ type: 'key-press', targetId: deviceId, key: e.key });
    }
  };

  const handleQualityChange = (preset) => {
    let q, s;
    switch (preset) {
      case 'fast': q = 30; s = 0.5; break;
      case 'balanced': q = 50; s = 0.6; break;
      case 'quality': q = 80; s = 0.85; break;
      default: q = 50; s = 0.6;
    }
    setQuality(q);
    setScale(s);
    send({ type: 'set-quality', targetId: deviceId, quality: q, scale: s });
    setShowSettings(false);
  };

  const handleLock = (lockScreen = selectedLockScreen) => {
    if (isLocked) {
      send({ type: 'unlock-screen', targetId: deviceId });
    } else {
      send({ type: 'lock-screen', targetId: deviceId, html: lockScreen?.html || '' });
    }
    setIsLocked(!isLocked);
    setShowLockMenu(false);
  };

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  if (!token || !deviceId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p>Sessao invalida</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="h-12 bg-zinc-900 border-b border-white/10 flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", connected ? "bg-green-500" : "bg-red-500")} />
          <span className="text-white font-medium text-sm">{deviceName}</span>
          <span className="text-white/30 text-xs font-mono">{deviceId}</span>
          <span className="text-white/30 text-xs ml-2">{fps} FPS</span>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setKeyboardActive(!keyboardActive)}
            className={cn("p-1.5 rounded", keyboardActive ? "bg-blue-500/20 text-blue-400" : "text-white/40")}>
            <Keyboard className="w-4 h-4" />
          </button>
          <button onClick={() => setMouseActive(!mouseActive)}
            className={cn("p-1.5 rounded", mouseActive ? "bg-blue-500/20 text-blue-400" : "text-white/40")}>
            <Mouse className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 text-white/40 hover:text-white">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-white/40 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.25))} className="p-1.5 text-white/40 hover:text-white">
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Lock Screen with Template Selector */}
          <div className="relative flex items-center">
            <button onClick={() => handleLock()}
              className={cn("p-1.5 rounded-l", isLocked ? "bg-amber-500/20 text-amber-400" : "text-white/40 hover:text-white")}>
              {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </button>
            {!isLocked && (
              <button onClick={() => setShowLockMenu(!showLockMenu)}
                className="p-1.5 rounded-r text-white/40 hover:text-white hover:bg-white/5">
                <ChevronDown className="w-3 h-3" />
              </button>
            )}
            {showLockMenu && !isLocked && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-zinc-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10">
                  <span className="text-[10px] text-white/40 uppercase tracking-wide">Selecionar Tela de Bloqueio</span>
                </div>
                {lockScreens.map(ls => (
                  <button key={ls.id}
                    onClick={() => { setSelectedLockScreen(ls); handleLock(ls); }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs hover:bg-white/5 flex items-center gap-2",
                      selectedLockScreen?.id === ls.id ? "text-blue-400" : "text-white/70"
                    )}>
                    <Lock className="w-3 h-3" />
                    {ls.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 text-white/40 hover:text-white">
              <Zap className="w-4 h-4" />
            </button>
            {showSettings && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-zinc-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                <button onClick={() => handleQualityChange('fast')} className="w-full px-3 py-2 text-left text-xs text-white/70 hover:bg-white/5">
                  Rapido (30%)
                </button>
                <button onClick={() => handleQualityChange('balanced')} className="w-full px-3 py-2 text-left text-xs text-white/70 hover:bg-white/5">
                  Balanceado (50%)
                </button>
                <button onClick={() => handleQualityChange('quality')} className="w-full px-3 py-2 text-left text-xs text-white/70 hover:bg-white/5">
                  Qualidade (80%)
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-white/10 mx-1" />

          <button onClick={() => window.close()} className="p-1.5 text-white/40 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown}
        className="flex-1 overflow-auto flex items-center justify-center bg-black outline-none"
        style={{ cursor: mouseActive ? 'crosshair' : 'default' }}>
        {frame ? (
          <canvas ref={canvasRef}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onWheel={handleWheel}
          />
        ) : (
          <div className="text-white/30 text-sm">Aguardando frames...</div>
        )}
      </div>

      {/* Footer */}
      <div className="h-6 bg-zinc-900 border-t border-white/10 flex items-center justify-between px-3 text-[10px] text-white/30 shrink-0">
        <span>{frameSize.width}x{frameSize.height} | Q:{quality}% S:{Math.round(scale*100)}%</span>
        <span>{connected ? 'Conectado' : 'Desconectado'}</span>
      </div>
    </div>
  );
}
