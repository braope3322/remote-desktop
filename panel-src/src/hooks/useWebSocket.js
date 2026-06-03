import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = window.location.protocol === 'https:'
  ? `wss://${window.location.host}`
  : `ws://${window.location.host}`;

export function useWebSocket(token) {
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [connectedTo, setConnectedTo] = useState(null);

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const connectedToRef = useRef(null);

  useEffect(() => {
    connectedToRef.current = connectedTo;
  }, [connectedTo]);

  useEffect(() => {
    if (!token) return;

    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'auth', token }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case 'auth-success':
                setConnected(true);
                break;

              case 'auth-failed':
                setConnected(false);
                localStorage.removeItem('rd_token');
                window.location.reload();
                break;

              case 'device-list':
                setDevices(msg.devices || []);
                break;

              case 'screen-frame':
                if (connectedToRef.current && msg.clientId === connectedToRef.current) {
                  setCurrentFrame(msg.frame);
                  setFrameSize({ width: msg.width, height: msg.height });
                }
                break;

              case 'connected-to-client':
                setConnectedTo(msg.clientId);
                connectedToRef.current = msg.clientId;
                break;

              case 'file-upload-result':
                console.log('Upload result:', msg);
                break;
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        };

        ws.onclose = () => {
          setConnected(false);
          reconnectRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (e) {
        console.error('WebSocket error:', e);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
    };
  }, [token]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const json = JSON.stringify(data);
      console.log('[WS Send]', data.type, data);
      wsRef.current.send(json);
    } else {
      console.warn('[WS] Not connected, cannot send:', data);
    }
  }, []);

  const connectToDevice = useCallback((deviceId) => {
    send({ type: 'connect-to-client', targetId: deviceId });
    setConnectedTo(deviceId);
    connectedToRef.current = deviceId;
  }, [send]);

  const disconnectFromDevice = useCallback((deviceId) => {
    send({ type: 'disconnect-from-client', targetId: deviceId });
    setConnectedTo(null);
    connectedToRef.current = null;
    setCurrentFrame(null);
  }, [send]);

  const sendMouseMove = useCallback((x, y, targetId) => {
    send({ type: 'mouse-move', targetId, x: Math.round(x), y: Math.round(y) });
  }, [send]);

  const sendMouseClick = useCallback((x, y, button, clicks, targetId) => {
    send({ type: 'mouse-click', targetId, x: Math.round(x), y: Math.round(y), button, clicks });
  }, [send]);

  const sendMouseScroll = useCallback((delta, targetId) => {
    send({ type: 'mouse-scroll', targetId, delta });
  }, [send]);

  const sendKeyPress = useCallback((key, targetId) => {
    send({ type: 'key-press', targetId, key });
  }, [send]);

  const sendKeyCombination = useCallback((keys, targetId) => {
    send({ type: 'key-combination', targetId, keys });
  }, [send]);

  const setQuality = useCallback((quality, scale, targetId) => {
    send({ type: 'set-quality', targetId, quality, scale });
  }, [send]);

  const lockScreen = useCallback((message, targetId) => {
    send({ type: 'lock-screen', targetId, message });
  }, [send]);

  const unlockScreen = useCallback((targetId) => {
    send({ type: 'unlock-screen', targetId });
  }, [send]);

  const disconnectClient = useCallback((targetId) => {
    send({ type: 'disconnect-client', targetId });
  }, [send]);

  const removeDevice = useCallback((targetId) => {
    send({ type: 'remove-device', targetId });
  }, [send]);

  const uploadFile = useCallback((filename, content, targetId) => {
    send({ type: 'file-upload', targetId, filename, content });
  }, [send]);

  const setClipboard = useCallback((content, targetId) => {
    send({ type: 'clipboard-set', targetId, content });
  }, [send]);

  return {
    connected,
    devices,
    currentFrame,
    frameSize,
    connectedTo,
    connectToDevice,
    disconnectFromDevice,
    sendMouseMove,
    sendMouseClick,
    sendMouseScroll,
    sendKeyPress,
    sendKeyCombination,
    setQuality,
    lockScreen,
    unlockScreen,
    disconnectClient,
    removeDevice,
    uploadFile,
    setClipboard
  };
}
