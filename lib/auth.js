import { scrypt as _scrypt, timingSafeEqual, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(_scrypt);

const HASH_ADMIN   = process.env.ADMIN_PASSWORD_HASH   || '';
const HASH_MANAGER = process.env.MANAGER_PASSWORD_HASH || '';
const SECRET = process.env.ADMIN_SESSION_SECRET || '';
const TTL    = 12 * 60 * 60 * 1000;
const COOKIE = 'fsh_admin';

export const isConfigured = Boolean(HASH_ADMIN && SECRET);
export const hasManager   = Boolean(HASH_MANAGER && SECRET);

const ПРАВА = {
  admin:   ['leads', 'chats', 'settings', 'upload'],
  manager: ['leads', 'chats']
};

export function can(role, що) {
  return (ПРАВА[role] || []).includes(що);
}

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

export async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function sign(payload) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };

export async function makeHash(password) {
  const salt = randomBytes(16);
  const key = await scrypt(String(password), salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyHash(password, stored) {
  if (!stored) return false;
  if (stored.startsWith('scrypt$')) {
    const [, nStr, saltHex, hashHex] = stored.split('$');
    const N = Number(nStr) || SCRYPT.N;
    let salt, expected;
    try { salt = Buffer.from(saltHex, 'hex'); expected = Buffer.from(hashHex, 'hex'); }
    catch { return false; }
    if (!expected.length) return false;
    let got;
    try { got = await scrypt(String(password), salt, expected.length, { ...SCRYPT, N }); }
    catch { return false; }
    return got.length === expected.length && timingSafeEqual(got, expected);
  }

  const got = await sha256(String(password));
  return equal(got, stored.toLowerCase());
}

export async function roleFor(password) {
  if (!isConfigured || !password) return null;
  const адмін = await verifyHash(password, HASH_ADMIN);
  const менед = HASH_MANAGER ? await verifyHash(password, HASH_MANAGER) : false;
  return адмін ? 'admin' : менед ? 'manager' : null;
}

export async function makeCookie(role) {
  const exp = Date.now() + TTL;
  const тіло = `${exp}.${role}`;
  const token = `${тіло}.${await sign(тіло)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=${TTL / 1000}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0`;
}

export async function sessionRole(req) {
  if (!isConfigured) return null;
  const raw = req.headers.cookie || '';
  const hit = raw.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!hit) return null;
  const [exp, role, sig] = hit.slice(COOKIE.length + 1).split('.');
  if (!exp || !role || !sig) return null;
  if (Number(exp) < Date.now()) return null;
  if (!equal(sig, await sign(`${exp}.${role}`))) return null;
  return ПРАВА[role] ? role : null;
}

export async function isAuthed(req) {
  return Boolean(await sessionRole(req));
}

export async function guard(req, res, що) {
  if (!isConfigured) {
    res.status(503).json({ error: 'Адмінку не налаштовано: немає ADMIN_PASSWORD_HASH або ADMIN_SESSION_SECRET' });
    return false;
  }
  const role = await sessionRole(req);
  if (!role) {
    res.status(401).json({ error: 'Потрібен вхід' });
    return false;
  }
  if (що && !can(role, що)) {
    res.status(403).json({ error: 'Для цієї дії потрібні права адміністратора' });
    return false;
  }
  return role;
}
