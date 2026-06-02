import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;
const DEVICES_FILE = join(__dirname, 'devices.json');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.py': 'text/plain',
  '.exe': 'application/octet-stream'
};

// Carregar dispositivos salvos
let allDevices = {};
if (existsSync(DEVICES_FILE)) {
  try {
    allDevices = JSON.parse(readFileSync(DEVICES_FILE, 'utf-8'));
    // Marcar todos como offline ao iniciar
    Object.keys(allDevices).forEach(id => {
      allDevices[id].online = false;
    });
  } catch (e) {
    allDevices = {};
  }
}

function saveDevices() {
  try {
    writeFileSync(DEVICES_FILE, JSON.stringify(allDevices, null, 2));
  } catch (e) {
    console.error('Error saving devices:', e);
  }
}

const clients = new Map();
const panels = new Map();

const server = createServer((req, res) => {
  if (req.url === '/c') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('RemoteSupport.exe');
    return;
  }

  let filePath = join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);

  if (!existsSync(filePath)) {
    filePath = join(__dirname, 'public', 'index.html');
  }

  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    res.end(content);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocketServer({ server });

console.log(`Server starting on port ${PORT}...`);

wss.on('connection', (ws, req) => {
  let clientId = null;
  let role = null;
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case 'register-client': {
          // Verificar se já existe pelo HWID
          let existingId = null;
          Object.keys(allDevices).forEach(id => {
            if (allDevices[id].hwid === msg.hwid && msg.hwid !== 'N/A') {
              existingId = id;
            }
          });

          if (existingId) {
            clientId = existingId;
          } else {
            clientId = uuidv4().slice(0, 8).toUpperCase();
          }

          role = 'client';

          // Atualizar ou criar dispositivo
          allDevices[clientId] = {
            hostname: msg.hostname || 'Unknown',
            username: msg.username || 'Unknown',
            os: msg.os || 'Unknown',
            ip: clientIp,
            hwid: msg.hwid || 'N/A',
            online: true,
            lastSeen: new Date().toISOString(),
            firstSeen: allDevices[clientId]?.firstSeen || new Date().toISOString()
          };

          clients.set(clientId, { ws });
          saveDevices();

          ws.send(JSON.stringify({ type: 'registered', clientId }));
          broadcastDeviceList();
          console.log(`Client registered: ${clientId} (${msg.hostname})`);
          break;
        }

        case 'register-panel': {
          role = 'panel';
          clientId = 'panel-' + uuidv4().slice(0, 6);
          panels.set(clientId, ws);
          ws.send(JSON.stringify({ type: 'registered', panelId: clientId }));
          sendDeviceList(ws);
          console.log(`Panel connected: ${clientId}`);
          break;
        }

        case 'connect-to-client': {
          const target = clients.get(msg.targetId);
          if (target) {
            target.ws.send(JSON.stringify({ type: 'panel-connected', panelId: clientId }));
            ws.send(JSON.stringify({ type: 'connected-to-client', clientId: msg.targetId }));
            console.log(`Panel ${clientId} connected to client ${msg.targetId}`);
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Client not found or offline' }));
          }
          break;
        }

        case 'disconnect-from-client': {
          const target = clients.get(msg.targetId);
          if (target) {
            target.ws.send(JSON.stringify({ type: 'panel-disconnected' }));
          }
          break;
        }

        case 'screen-frame': {
          panels.forEach((panelWs) => {
            if (panelWs.readyState === 1) {
              panelWs.send(JSON.stringify({
                type: 'screen-frame',
                clientId: msg.clientId,
                frame: msg.frame,
                width: msg.width,
                height: msg.height
              }));
            }
          });
          break;
        }

        case 'mouse-move':
        case 'mouse-click':
        case 'mouse-scroll':
        case 'key-press':
        case 'key-combination': {
          const target = clients.get(msg.targetId);
          if (target && target.ws.readyState === 1) {
            target.ws.send(JSON.stringify(msg));
          }
          break;
        }

        case 'clipboard-set': {
          const target = clients.get(msg.targetId);
          if (target && target.ws.readyState === 1) {
            target.ws.send(JSON.stringify({
              type: 'clipboard-set',
              content: msg.content
            }));
          }
          break;
        }

        case 'clipboard-content': {
          panels.forEach((panelWs) => {
            if (panelWs.readyState === 1) {
              panelWs.send(JSON.stringify({
                type: 'clipboard-content',
                clientId: msg.clientId,
                content: msg.content
              }));
            }
          });
          break;
        }

        case 'file-upload': {
          const target = clients.get(msg.targetId);
          if (target && target.ws.readyState === 1) {
            target.ws.send(JSON.stringify({
              type: 'file-upload',
              filename: msg.filename,
              content: msg.content,
              path: msg.path
            }));
          }
          break;
        }

        case 'file-upload-result': {
          panels.forEach((panelWs) => {
            if (panelWs.readyState === 1) {
              panelWs.send(JSON.stringify({
                type: 'file-upload-result',
                clientId: msg.clientId,
                success: msg.success,
                filename: msg.filename,
                error: msg.error
              }));
            }
          });
          break;
        }

        case 'disconnect-client': {
          const target = clients.get(msg.targetId);
          if (target && target.ws.readyState === 1) {
            target.ws.send(JSON.stringify({ type: 'disconnect-client' }));
            target.ws.close();
          }
          clients.delete(msg.targetId);
          if (allDevices[msg.targetId]) {
            allDevices[msg.targetId].online = false;
            allDevices[msg.targetId].lastSeen = new Date().toISOString();
            saveDevices();
          }
          broadcastDeviceList();
          console.log(`Client ${msg.targetId} disconnected by panel`);
          break;
        }

        case 'set-quality': {
          const target = clients.get(msg.targetId);
          if (target && target.ws.readyState === 1) {
            target.ws.send(JSON.stringify({
              type: 'set-quality',
              quality: msg.quality,
              scale: msg.scale
            }));
          }
          break;
        }

        case 'remove-device': {
          // Remover dispositivo do histórico
          if (allDevices[msg.targetId]) {
            delete allDevices[msg.targetId];
            saveDevices();
            broadcastDeviceList();
            console.log(`Device ${msg.targetId} removed from history`);
          }
          break;
        }
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    if (role === 'client' && clientId) {
      clients.delete(clientId);
      if (allDevices[clientId]) {
        allDevices[clientId].online = false;
        allDevices[clientId].lastSeen = new Date().toISOString();
        saveDevices();
      }
      broadcastDeviceList();
      console.log(`Client disconnected: ${clientId}`);
    } else if (role === 'panel' && clientId) {
      panels.delete(clientId);
      console.log(`Panel disconnected: ${clientId}`);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

function broadcastDeviceList() {
  const list = getDeviceList();
  panels.forEach((panelWs) => {
    if (panelWs.readyState === 1) {
      panelWs.send(JSON.stringify({ type: 'device-list', devices: list }));
    }
  });
}

function sendDeviceList(ws) {
  ws.send(JSON.stringify({ type: 'device-list', devices: getDeviceList() }));
}

function getDeviceList() {
  const list = [];
  Object.keys(allDevices).forEach(id => {
    list.push({
      id,
      ...allDevices[id]
    });
  });
  // Ordenar: online primeiro, depois por lastSeen
  list.sort((a, b) => {
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    return new Date(b.lastSeen) - new Date(a.lastSeen);
  });
  return list;
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
