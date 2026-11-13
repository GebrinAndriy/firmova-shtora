import { roleFor, makeCookie, clearCookie, isConfigured, hasManager, sessionRole } from '../lib/auth.js';
import { bump, getCount, del } from '../lib/store.js';
import { clientIp } from '../lib/ip.js';

const МЕЖА_АДРЕСИ = 8;
const МЕЖА_ГЛОБАЛЬНА = 100;
const ВІКНО = 15 * 60;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const role = await sessionRole(req);
    return res.status(200).json({ configured: isConfigured, authed: Boolean(role), role, hasManager });
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearCookie());
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Тільки POST' });
  }
  if (!isConfigured) {
    return res.status(503).json({ error: 'Адмінку не налаштовано. Задайте ADMIN_PASSWORD_HASH і ADMIN_SESSION_SECRET.' });
  }

  const ip = clientIp(req);
  const ключІР  = 'login:fail:' + ip;
  const ключВсі = 'login:fail:all';

  let невдачІР = 0, невдачВсі = 0;
  try { невдачІР = await getCount(ключІР); невдачВсі = await getCount(ключВсі); } catch (e) {}
  if (невдачІР >= МЕЖА_АДРЕСИ || невдачВсі >= МЕЖА_ГЛОБАЛЬНА) {
    return res.status(429).json({ error: 'Забагато спроб. Спробуйте за кілька хвилин.' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});

  const role = await roleFor(String(body.password || ''));

  if (!role) {
    try { await bump(ключІР, ВІКНО); await bump(ключВсі, ВІКНО); } catch (e) {}
    return res.status(401).json({ error: 'Невірний пароль' });
  }

  try { await del(ключІР); } catch (e) {}
  res.setHeader('Set-Cookie', await makeCookie(role));
  return res.status(200).json({ ok: true, role });
}

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
