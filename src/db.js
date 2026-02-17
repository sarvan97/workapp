const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify({ users: [], logs: [], counters: { users: 1, logs: 1 } }, null, 2)
    );
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const candidate = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

function createUser(email, password) {
  const db = readDb();
  if (db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return null;
  }

  const user = {
    id: db.counters.users++,
    email,
    password_hash: hashPassword(password),
    created_at: nowIso()
  };

  db.users.push(user);
  writeDb(db);
  return { id: user.id, email: user.email, created_at: user.created_at };
}

function authenticateUser(email, password) {
  const db = readDb();
  const found = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!found || !verifyPassword(password, found.password_hash)) {
    return null;
  }
  return { id: found.id, email: found.email, created_at: found.created_at };
}

function createLog(userId, payload) {
  const db = readDb();
  const created = {
    id: db.counters.logs++,
    user_id: userId,
    date: payload.date,
    raw_text: payload.raw_text,
    activity_type: payload.activity_type,
    duration_minutes: payload.duration_minutes,
    category: payload.category,
    tags: payload.tags,
    notes: payload.notes,
    indicator_letter: payload.indicator_letter,
    indicator_color: payload.indicator_color,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  db.logs.push(created);
  writeDb(db);
  return created;
}

function listLogsByMonth(userId, month) {
  const db = readDb();
  return db.logs
    .filter((log) => log.user_id === userId && log.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
}

function updateLog(userId, id, payload) {
  const db = readDb();
  const idx = db.logs.findIndex((log) => log.id === id && log.user_id === userId);
  if (idx === -1) {
    return null;
  }
  db.logs[idx] = {
    ...db.logs[idx],
    date: payload.date,
    raw_text: payload.raw_text,
    activity_type: payload.activity_type,
    duration_minutes: payload.duration_minutes,
    category: payload.category,
    tags: payload.tags,
    notes: payload.notes,
    indicator_letter: payload.indicator_letter,
    indicator_color: payload.indicator_color,
    updated_at: nowIso()
  };
  writeDb(db);
  return db.logs[idx];
}

function deleteLog(userId, id) {
  const db = readDb();
  const before = db.logs.length;
  db.logs = db.logs.filter((log) => !(log.id === id && log.user_id === userId));
  if (db.logs.length === before) {
    return false;
  }
  writeDb(db);
  return true;
}

module.exports = {
  createUser,
  authenticateUser,
  createLog,
  listLogsByMonth,
  updateLog,
  deleteLog
};
