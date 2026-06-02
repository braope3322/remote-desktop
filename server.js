import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = createServer((req, res) => {
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

const clients = new Map();
const panels = new Map();

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
          clientId = uuidv4().slice(0, 8).toUpperCase();
          role = 'client';
          clients.set(clientId, {
            ws,
            hostname: msg.hostname || 'Unknown',
            username: msg.username || 'Unknown',
            os: msg.os || 'Unknown',
            ip: clientIp,
            connectedAt: new Date().toISOString()
          });
          ws.send(JSON.stringify({ type: 'registered', clientId }));
          broadcastClientList();
          console.log(`Client registered: ${clientId} (${msg.hostname})`);
          break;
        }

        case 'register-panel': {
          role = 'panel';
          clientId = 'panel-' + uuidv4().slice(0, 6);
          panels.set(clientId, ws);
          ws.send(JSON.stringify({ type: 'registered', panelId: clientId }));
          sendClientList(ws);
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
            ws.send(JSON.stringify({ type: 'error', message: 'Client not found' }));
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
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    if (role === 'client' && clientId) {
      clients.delete(clientId);
      broadcastClientList();
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

function broadcastClientList() {
  const list = getClientList();
  panels.forEach((panelWs) => {
    if (panelWs.readyState === 1) {
      panelWs.send(JSON.stringify({ type: 'client-list', clients: list }));
    }
  });
}

function sendClientList(ws) {
  ws.send(JSON.stringify({ type: 'client-list', clients: getClientList() }));
}

function getClientList() {
  const list = [];
  clients.forEach((client, id) => {
    list.push({
      id,
      hostname: client.hostname,
      username: client.username,
      os: client.os,
      ip: client.ip,
      connectedAt: client.connectedAt
    });
  });
  return list;
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Panel: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
});
