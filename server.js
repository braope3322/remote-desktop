import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;

// CHAVE FIXA - não muda entre deploys
const JWT_SECRET = 'RD_JWT_Secret_Key_2026_FIXED_abc123xyz789';

const DEVICES_FILE = join(__dirname, 'devices.json');
const USERS_FILE = join(__dirname, 'users.json');

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

// Dados
let allDevices = {};
if (existsSync(DEVICES_FILE)) {
  try {
    allDevices = JSON.parse(readFileSync(DEVICES_FILE, 'utf-8'));
    Object.keys(allDevices).forEach(id => { allDevices[id].online = false; });
  } catch (e) { allDevices = {}; }
}

let users = {};
if (existsSync(USERS_FILE)) {
  try {
    users = JSON.parse(readFileSync(USERS_FILE, 'utf-8'));
  } catch (e) { users = {}; }
}

if (Object.keys(users).length === 0) {
  users['admin'] = {
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin'
  };
  saveUsers();
  console.log('Admin criado: admin / admin123');
}

function saveDevices() {
  try { writeFileSync(DEVICES_FILE, JSON.stringify(allDevices, null, 2)); } catch (e) {}
}

function saveUsers() {
  try { writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); } catch (e) {}
}

// Conexões
const clients = new Map();
const panels = new Map();

// HTTP Server
const server = createServer((req, res) => {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

  // Login
  if (req.url === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        const user = users[username];

        if (user && bcrypt.compareSync(password, user.password)) {
          const token = jwt.sign({ username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ token, username, role: user.role }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Credenciais inválidas' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro' }));
      }
    });
    return;
  }

  // Verify
  if (req.url === '/api/verify' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { token } = JSON.parse(body);
        const decoded = jwt.verify(token, JWT_SECRET);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: true, username: decoded.username, role: decoded.role }));
      } catch (e) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false }));
      }
    });
    return;
  }

  // Servir arquivos
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

// WebSocket
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  let clientId = null;
  let role = null;
  let authenticated = false;
  let username = null;
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      // Auth do painel
      if (msg.type === 'auth') {
        try {
          const decoded = jwt.verify(msg.token, JWT_SECRET);
          authenticated = true;
          username = decoded.username;
          role = 'panel';
          clientId = 'panel-' + uuidv4().slice(0, 6);
          panels.set(clientId, ws);
          ws.send(JSON.stringify({ type: 'auth-success', panelId: clientId }));
          sendDeviceList(ws);
        } catch (e) {
          ws.send(JSON.stringify({ type: 'auth-failed', message: 'Token inválido' }));
        }
        return;
      }

      // Screen frames
      if (msg.type === 'screen-frame') {
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
        return;
      }

      // Registro de cliente
      if (msg.type === 'register-client') {
        let existingId = null;
        Object.keys(allDevices).forEach(id => {
          if (allDevices[id].hwid === msg.hwid && msg.hwid !== 'N/A') {
            existingId = id;
          }
        });

        clientId = existingId || uuidv4().slice(0, 8).toUpperCase();
        role = 'client';
        authenticated = true;

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
        return;
      }

      if (!authenticated) return;

      switch (msg.type) {
        case 'connect-to-client': {
          const target = clients.get(msg.targetId);
          if (target) {
            target.ws.send(JSON.stringify({ type: 'panel-connected', panelId: clientId }));
            ws.send(JSON.stringify({ type: 'connected-to-client', clientId: msg.targetId }));
          }
          break;
        }

        case 'disconnect-from-client': {
          const target = clients.get(msg.targetId);
          if (target) target.ws.send(JSON.stringify({ type: 'panel-disconnected' }));
          break;
        }

        case 'mouse-move':
        case 'mouse-click':
        case 'mouse-scroll':
        case 'key-press':
        case 'key-combination': {
          const target = clients.get(msg.targetId);
          if (target?.ws.readyState === 1) target.ws.send(JSON.stringify(msg));
          break;
        }

        case 'clipboard-set': {
          const target = clients.get(msg.targetId);
          if (target?.ws.readyState === 1) {
            target.ws.send(JSON.stringify({ type: 'clipboard-set', content: msg.content }));
          }
          break;
        }

        case 'file-upload': {
          const target = clients.get(msg.targetId);
          if (target?.ws.readyState === 1) {
            target.ws.send(JSON.stringify({ type: 'file-upload', filename: msg.filename, content: msg.content }));
          }
          break;
        }

        case 'file-upload-result': {
          panels.forEach((panelWs) => {
            if (panelWs.readyState === 1) {
              panelWs.send(JSON.stringify({ type: 'file-upload-result', clientId: msg.clientId, success: msg.success, filename: msg.filename, error: msg.error }));
            }
          });
          break;
        }

        case 'disconnect-client': {
          const target = clients.get(msg.targetId);
          if (target?.ws.readyState === 1) {
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
          break;
        }

        case 'set-quality': {
          const target = clients.get(msg.targetId);
          if (target?.ws.readyState === 1) {
            target.ws.send(JSON.stringify({ type: 'set-quality', quality: msg.quality, scale: msg.scale }));
          }
          break;
        }

        case 'lock-screen': {
          const target = clients.get(msg.targetId);
          if (target?.ws.readyState === 1) {
            target.ws.send(JSON.stringify({ type: 'lock-screen', message: msg.message }));
          }
          break;
        }

        case 'unlock-screen': {
          const target = clients.get(msg.targetId);
          if (target?.ws.readyState === 1) {
            target.ws.send(JSON.stringify({ type: 'unlock-screen' }));
          }
          break;
        }

        case 'remove-device': {
          if (allDevices[msg.targetId]) {
            delete allDevices[msg.targetId];
            saveDevices();
            broadcastDeviceList();
          }
          break;
        }
      }
    } catch (err) {
      console.error('Error:', err.message);
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
    } else if (role === 'panel' && clientId) {
      panels.delete(clientId);
    }
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
    list.push({ id, ...allDevices[id] });
  });
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
