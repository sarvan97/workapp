const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  createUser,
  authenticateUser,
  createLog,
  listLogsByMonth,
  updateLog,
  deleteLog
} = require('./src/db');
const { parseWorkoutText } = require('./src/parser');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const sessions = new Map();

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [k, v] = part.trim().split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {});
}

function getSessionUser(req) {
  const sid = parseCookies(req).sid;
  return sid ? sessions.get(sid) || null : null;
}

function createSession(user) {
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, user);
  return sid;
}

function destroySession(req) {
  const sid = parseCookies(req).sid;
  if (sid) sessions.delete(sid);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const target = path.normalize(path.join(PUBLIC_DIR, reqPath));
  if (!target.startsWith(PUBLIC_DIR) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(target);
  const contentType =
    ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/plain';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(target).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/me') {
      return sendJson(res, 200, { user: getSessionUser(req) });
    }

    if (req.method === 'POST' && url.pathname === '/api/register') {
      const { email, password } = await readBody(req);
      if (!email || !password || password.length < 6) {
        return sendJson(res, 400, { error: 'Email and password (6+ chars) required' });
      }
      const user = createUser(email, password);
      if (!user) return sendJson(res, 409, { error: 'Email already exists' });
      const sid = createSession(user);
      return sendJson(res, 200, { user }, { 'Set-Cookie': `sid=${sid}; HttpOnly; Path=/; Max-Age=604800` });
    }

    if (req.method === 'POST' && url.pathname === '/api/login') {
      const { email, password } = await readBody(req);
      const user = authenticateUser(email, password);
      if (!user) return sendJson(res, 401, { error: 'Invalid credentials' });
      const sid = createSession(user);
      return sendJson(res, 200, { user }, { 'Set-Cookie': `sid=${sid}; HttpOnly; Path=/; Max-Age=604800` });
    }

    if (req.method === 'POST' && url.pathname === '/api/logout') {
      destroySession(req);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0' });
    }

    const user = getSessionUser(req);
    if (url.pathname.startsWith('/api/logs') && !user) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }

    if (req.method === 'GET' && url.pathname === '/api/logs') {
      const month = url.searchParams.get('month');
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return sendJson(res, 400, { error: 'month is required as YYYY-MM' });
      }
      return sendJson(res, 200, { logs: listLogsByMonth(user.id, month) });
    }

    if (req.method === 'POST' && url.pathname === '/api/logs') {
      const { raw_text, date } = await readBody(req);
      if (!raw_text || !date) return sendJson(res, 400, { error: 'date and raw_text required' });
      const parsed = parseWorkoutText(raw_text);
      const log = createLog(user.id, { ...parsed, date });
      return sendJson(res, 201, { log });
    }

    const idMatch = url.pathname.match(/^\/api\/logs\/(\d+)$/);
    if (idMatch && req.method === 'PUT') {
      const { raw_text, date } = await readBody(req);
      if (!raw_text || !date) return sendJson(res, 400, { error: 'date and raw_text required' });
      const parsed = parseWorkoutText(raw_text);
      const log = updateLog(user.id, Number(idMatch[1]), { ...parsed, date });
      if (!log) return sendJson(res, 404, { error: 'Log not found' });
      return sendJson(res, 200, { log });
    }

    if (idMatch && req.method === 'DELETE') {
      const ok = deleteLog(user.id, Number(idMatch[1]));
      if (!ok) return sendJson(res, 404, { error: 'Log not found' });
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'Not found' });
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Calwork listening on http://localhost:${PORT}`);
});
