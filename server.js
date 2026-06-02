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
const JWT_SECRET = process.env.JWT_SECRET || 'SUA_CHAVE_SECRETA_AQUI_' + uuidv4();
const DEVICES_FILE = join(__dirname, 'devices.json');
const USERS_FILE = join(__dirname, 'users.json');
const LOGS_FILE = join(__dirname, 'logs.json');

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

// ============================================
// DADOS PERSISTENTES
// ============================================

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

// Criar usuário admin padrão se não existir
if (Object.keys(users).length === 0) {
  const defaultPassword = 'admin123';
  users['admin'] = {
    password: bcrypt.hashSync(defaultPassword, 10),
    role: 'admin',
    createdAt: new Date().toISOString()
  };
  saveUsers();
  console.log('Usuario admin criado. Senha: admin123');
}

let logs = [];
if (existsSync(LOGS_FILE)) {
  try {
    logs = JSON.parse(readFileSync(LOGS_FILE, 'utf-8'));
  } catch (e) { logs = []; }
}

function saveDevices() {
  try { writeFileSync(DEVICES_FILE, JSON.stringify(allDevices, null, 2)); } catch (e) {}
}

function saveUsers() {
  try { writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); } catch (e) {}
}

function saveLogs() {
  try {
    // Manter apenas últimos 1000 logs
    if (logs.length > 1000) logs = logs.slice(-1000);
    writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
  } catch (e) {}
}

function addLog(action, details, user = 'system', ip = '') {
  logs.push({
    timestamp: new Date().toISOString(),
    action,
    details,
    user,
    ip
  });
  saveLogs();
}

// ============================================
// RATE LIMITING
// ============================================

const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const RATE_LIMIT_MAX = 100; // max requests por minuto

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimits.has(ip)) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  const limit = rateLimits.get(ip);
  if (now > limit.resetAt) {
    limit.count = 1;
    limit.resetAt = now + RATE_LIMIT_WINDOW;
    return true;
  }

  limit.count++;
  return limit.count <= RATE_LIMIT_MAX;
}

// ============================================
// CONEXÕES
// ============================================

const clients = new Map();
const panels = new Map();
const panelSessions = new Map(); // Sessões autenticadas

// ============================================
// HTTP SERVER
// ============================================

const server = createServer((req, res) => {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many requests' }));
    return;
  }

  // API de autenticação
  if (req.url === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        const user = users[username];

        if (user && bcrypt.compareSync(password, user.password)) {
          const token = jwt.sign({ username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
          addLog('login', `Usuario ${username} logou`, username, clientIp);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ token, username, role: user.role }));
        } else {
          addLog('login_failed', `Tentativa de login falhou: ${username}`, username, clientIp);
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Credenciais inválidas' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Requisição inválida' }));
      }
    });
    return;
  }

  // API de verificação de token
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

  // API de logs (apenas admin)
  if (req.url === '/api/logs' && req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Não autorizado' }));
      return;
    }

    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'admin') throw new Error('Não autorizado');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(logs.slice(-100)));
    } catch (e) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Não autorizado' }));
    }
    return;
  }

  // Servir arquivos estáticos
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

// ============================================
// WEBSOCKET SERVER
// ============================================

const wss = new WebSocketServer({ server });

console.log(`Server starting on port ${PORT}...`);

wss.on('connection', (ws, req) => {
  let clientId = null;
  let role = null;
  let authenticated = false;
  let username = null;
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

  ws.on('message', (data) => {
    // Rate limiting por WebSocket
    if (!checkRateLimit(clientIp)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded' }));
      return;
    }

    try {
      const msg = JSON.parse(data);

      // ============================================
      // AUTENTICAÇÃO DO PAINEL
      // ============================================

      if (msg.type === 'auth') {
        try {
          const decoded = jwt.verify(msg.token, JWT_SECRET);
          authenticated = true;
          username = decoded.username;
          role = 'panel';
          clientId = 'panel-' + uuidv4().slice(0, 6);
          panels.set(clientId, ws);
          panelSessions.set(clientId, { username, ip: clientIp });

          ws.send(JSON.stringify({ type: 'auth-success', panelId: clientId }));
          sendDeviceList(ws);
          addLog('panel_connect', `Painel conectado`, username, clientIp);
        } catch (e) {
          ws.send(JSON.stringify({ type: 'auth-failed', message: 'Token inválido' }));
          ws.close();
        }
        return;
      }

      // ============================================
      // REGISTRO DE CLIENTE (não precisa autenticação)
      // ============================================

      if (msg.type === 'register-client') {
        let existingId = null;
        Object.keys(allDevices).forEach(id => {
          if (allDevices[id].hwid === msg.hwid && msg.hwid !== 'N/A') {
            existingId = id;
          }
        });

        clientId = existingId || uuidv4().slice(0, 8).toUpperCase();
        role = 'client';
        authenticated = true; // Clientes são auto-autenticados

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

        clients.set(clientId, { ws, encryptionKey: msg.encryptionKey });
        saveDevices();

        ws.send(JSON.stringify({ type: 'registered', clientId }));
        broadcastDeviceList();
        addLog('client_connect', `Cliente ${clientId} conectou (${msg.hostname})`, 'client', clientIp);
        return;
      }

      // ============================================
      // COMANDOS QUE REQUEREM AUTENTICAÇÃO
      // ============================================

      if (!authenticated) {
        ws.send(JSON.stringify({ type: 'error', message: 'Não autenticado' }));
        return;
      }

      switch (msg.type) {
        case 'connect-to-client': {
          const target = clients.get(msg.targetId);
          if (target) {
            target.ws.send(JSON.stringify({ type: 'panel-connected', panelId: clientId }));
            ws.send(JSON.stringify({ type: 'connected-to-client', clientId: msg.targetId }));
            addLog('remote_start', `Acesso remoto iniciado em ${msg.targetId}`, username, clientIp);
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Cliente não encontrado ou offline' }));
          }
          break;
        }

        case 'disconnect-from-client': {
          const target = clients.get(msg.targetId);
          if (target) {
            target.ws.send(JSON.stringify({ type: 'panel-disconnected' }));
            addLog('remote_end', `Acesso remoto encerrado em ${msg.targetId}`, username, clientIp);
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
            target.ws.send(JSON.stringify({ type: 'clipboard-set', content: msg.content }));
          }
          break;
        }

        case 'clipboard-content': {
          panels.forEach((panelWs) => {
            if (panelWs.readyState === 1) {
              panelWs.send(JSON.stringify({ type: 'clipboard-content', clientId: msg.clientId, content: msg.content }));
            }
          });
          break;
        }

        case 'file-upload': {
          const target = clients.get(msg.targetId);
          if (target && target.ws.readyState === 1) {
            target.ws.send(JSON.stringify({ type: 'file-upload', filename: msg.filename, content: msg.content, path: msg.path }));
            addLog('file_upload', `Arquivo ${msg.filename} enviado para ${msg.targetId}`, username, clientIp);
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
          addLog('client_disconnect', `Cliente ${msg.targetId} desconectado pelo painel`, username, clientIp);
          break;
        }

        case 'set-quality': {
          const target = clients.get(msg.targetId);
          if (target && target.ws.readyState === 1) {
            target.ws.send(JSON.stringify({ type: 'set-quality', quality: msg.quality, scale: msg.scale }));
          }
          break;
        }

        case 'remove-device': {
          if (allDevices[msg.targetId]) {
            delete allDevices[msg.targetId];
            saveDevices();
            broadcastDeviceList();
            addLog('device_remove', `Dispositivo ${msg.targetId} removido`, username, clientIp);
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
      addLog('client_disconnect', `Cliente ${clientId} desconectou`, 'client', clientIp);
    } else if (role === 'panel' && clientId) {
      panels.delete(clientId);
      panelSessions.delete(clientId);
      addLog('panel_disconnect', `Painel desconectou`, username, clientIp);
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
  console.log(`JWT Secret: ${JWT_SECRET.substring(0, 20)}...`);
});
