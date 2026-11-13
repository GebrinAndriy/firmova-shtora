import { guard } from '../lib/auth.js';
import { setItem, getItem } from '../lib/store.js';

const KEY = 'settings';

const НЕБЕЗПЕЧНІ = new Set(['__proto__', 'constructor', 'prototype']);
function очистити(v, глибина) {
  if (глибина > 32 || !v || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(x => очистити(x, глибина + 1));
  const out = {};
  for (const k of Object.keys(v)) {
    if (НЕБЕЗПЕЧНІ.has(k)) continue;
    out[k] = очистити(v[k], глибина + 1);
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const data = await getItem(KEY);

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(data || {});
  }

  if (req.method === 'PUT') {
    if (!(await guard(req, res, 'settings'))) return;
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Очікується обʼєкт налаштувань' });
    }
    const raw = JSON.stringify(body);
    if (raw.length > 400_000) return res.status(413).json({ error: 'Налаштування завеликі' });

    const база = body._base, силоміць = body._force === true;
    delete body._base; delete body._force;
    if (база !== undefined && !силоміць) {
      const тепер = await getItem(KEY);
      if (тепер && тепер.savedAt && тепер.savedAt !== база) {
        return res.status(409).json({ error: 'conflict', savedAt: тепер.savedAt });
      }
    }

    const безпечно = очистити(body, 0);
    const savedAt = new Date().toISOString();
    await setItem(KEY, { ...безпечно, savedAt });
    return res.status(200).json({ ok: true, savedAt });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Метод не підтримується' });
}
