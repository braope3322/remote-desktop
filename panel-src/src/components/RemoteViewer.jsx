import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  X, Maximize2, Minimize2, Settings, Lock, Unlock,
  Upload, Clipboard, Keyboard, Mouse, ZoomIn, ZoomOut
} from 'lucide-react';
import { cn } from '../lib/utils';

export function RemoteViewer({
  deviceId,
  deviceName,
  frame,
  frameSize,
  onClose,
  onMouseMove,
  onMouseClick,
  onMouseScroll,
  onKeyPress,
  onKeyCombination,
  onSetQuality,
  onLockScreen,
  onUnlockScreen,
  onUploadFile,
  onSetClipboard
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState(70);
  const [scale, setScale] = useState(0.75);
  const [isLocked, setIsLocked] = useState(false);
  const [keyboardActive, setKeyboardActive] = useState(true);
  const [mouseActive, setMouseActive] = useState(true);
  const [zoom, setZoom] = useState(1);

  // Draw frame on canvas
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

  // Calculate coordinates relative to the actual image
  const getCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    // Account for zoom transform
    const displayWidth = rect.width / zoom;
    const displayHeight = rect.height / zoom;

    // Get click position relative to canvas center, then adjust for zoom
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const offsetX = (e.clientX - centerX) / zoom + displayWidth / 2;
    const offsetY = (e.clientY - centerY) / zoom + displayHeight / 2;

    // Scale to canvas dimensions
    const scaleX = canvas.width / displayWidth;
    const scaleY = canvas.height / displayHeight;

    const x = Math.round(offsetX * scaleX);
    const y = Math.round(offsetY * scaleY);

    return { x, y };
  };

  // Mouse click handler
  const handleClick = (e) => {
    if (!mouseActive) return;

    const coords = getCoords(e);
    if (!coords) return;

    const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';

    console.log(`[Panel] Click: x=${coords.x}, y=${coords.y}, button=${button}, deviceId=${deviceId}`);
    onMouseClick(coords.x, coords.y, button, 1, deviceId);
  };

  // Double click handler
  const handleDoubleClick = (e) => {
    if (!mouseActive) return;

    const coords = getCoords(e);
    if (!coords) return;

    console.log(`[Panel] DoubleClick: x=${coords.x}, y=${coords.y}, deviceId=${deviceId}`);
    onMouseClick(coords.x, coords.y, 'left', 2, deviceId);
  };

  // Context menu (right click)
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!mouseActive) return;

    const coords = getCoords(e);
    if (!coords) return;

    console.log(`[Panel] RightClick: x=${coords.x}, y=${coords.y}, deviceId=${deviceId}`);
    onMouseClick(coords.x, coords.y, 'right', 1, deviceId);
  };

  // Scroll handler
  const handleWheel = (e) => {
    e.preventDefault();
    if (!mouseActive) return;

    const delta = e.deltaY > 0 ? -3 : 3;
    console.log(`[Panel] Scroll: delta=${delta}, deviceId=${deviceId}`);
    onMouseScroll(delta, deviceId);
  };

  // Keyboard handler
  const handleKeyDown = (e) => {
    if (!keyboardActive) return;
    e.preventDefault();
    e.stopPropagation();

    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Control');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.metaKey) modifiers.push('Meta');

    const key = e.key;

    if (modifiers.length > 0 && !['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      const combo = [...modifiers, key];
      console.log(`[Panel] KeyCombo: ${combo.join('+')}, deviceId=${deviceId}`);
      onKeyCombination(combo, deviceId);
    } else if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      console.log(`[Panel] KeyPress: ${key}, deviceId=${deviceId}`);
      onKeyPress(key, deviceId);
    }
  };

  // Focus container on mount and when keyboard is activated
  useEffect(() => {
    if (containerRef.current && keyboardActive) {
      containerRef.current.focus();
    }
  }, [keyboardActive]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Quality change
  const handleQualityChange = (preset) => {
    let q, s;
    switch (preset) {
      case 'low': q = 40; s = 0.5; break;
      case 'medium': q = 70; s = 0.75; break;
      case 'high': q = 90; s = 1; break;
      default: q = 70; s = 0.75;
    }
    setQuality(q);
    setScale(s);
    onSetQuality(q, s, deviceId);
    setShowSettings(false);
  };

  // Lock screen toggle
  const handleLockToggle = () => {
    if (isLocked) {
      onUnlockScreen(deviceId);
    } else {
      onLockScreen('Aguarde o tecnico...', deviceId);
    }
    setIsLocked(!isLocked);
  };

  // File upload
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          onUploadFile(file.name, base64, deviceId);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // Clipboard
  const handleClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onSetClipboard(text, deviceId);
      }
    } catch (e) {
      console.error('Clipboard error:', e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
    >
      {/* Header */}
      <div className="h-14 bg-zinc-900 border-b border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-white font-medium">{deviceName}</span>
          <span className="text-white/40 text-sm font-mono">({deviceId})</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setKeyboardActive(!keyboardActive)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              keyboardActive ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/10 text-white/50"
            )}
            title="Teclado"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          <button
            onClick={() => setMouseActive(!mouseActive)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              mouseActive ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/10 text-white/50"
            )}
            title="Mouse"
          >
            <Mouse className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-white/50 text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(2, z + 0.25))}
            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button
            onClick={handleLockToggle}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isLocked ? "bg-amber-500/20 text-amber-400" : "hover:bg-white/10 text-white/50"
            )}
            title="Bloquear tela"
          >
            {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>

          <button onClick={handleClipboard} className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white" title="Clipboard">
            <Clipboard className="w-4 h-4" />
          </button>

          <button onClick={handleFileUpload} className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white" title="Upload">
            <Upload className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                <div className="p-2 border-b border-white/10">
                  <span className="text-xs text-white/40 px-2">Qualidade</span>
                </div>
                <button onClick={() => handleQualityChange('low')} className="w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/5">
                  Baixa
                </button>
                <button onClick={() => handleQualityChange('medium')} className="w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/5">
                  Media
                </button>
                <button onClick={() => handleQualityChange('high')} className="w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/5">
                  Alta
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button onClick={toggleFullscreen} className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button onClick={onClose} className="p-2 hover:bg-red-500/20 rounded-lg text-white/50 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        tabIndex={0}
        className="flex-1 overflow-auto flex items-center justify-center p-4 outline-none bg-black"
        onKeyDown={handleKeyDown}
        style={{ cursor: mouseActive ? 'crosshair' : 'default' }}
      >
        {frame ? (
          <canvas
            ref={canvasRef}
            className="rounded-lg shadow-2xl"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              maxWidth: '100%',
              maxHeight: '100%'
            }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onWheel={handleWheel}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-white/40">
            <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full" />
            <span>Aguardando frames...</span>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="h-8 bg-zinc-900 border-t border-white/10 flex items-center justify-between px-4 text-xs text-white/40">
        <div className="flex items-center gap-4">
          <span>Resolucao: {frameSize.width}x{frameSize.height}</span>
          <span>Qualidade: {quality}%</span>
        </div>
        <div className="flex items-center gap-4">
          {keyboardActive && <span className="text-blue-400">Teclado ON</span>}
          {mouseActive && <span className="text-blue-400">Mouse ON</span>}
        </div>
      </div>
    </motion.div>
  );
}
