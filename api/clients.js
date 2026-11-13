import { range, getItem, setItem, isPersistent, hset, hgetall } from '../lib/store.js';
import { усіСтатуси } from '../lib/statuses.js';
import { guard } from '../lib/auth.js';

const LIST = 'leads';
const МЕЖА = 2000;

const СТАНИ = ['нова', 'дзвонили', 'не додзвонились', 'не актуально'];
const СТАН_КЛЮЧ = 'client-state';

const СТАН_ХЕШ = 'client-state:h';

function ключТелефону(p) {
  const цифри = String(p || '').replace(/\D/g, '');
  return цифри.length > 9 ? цифри.slice(-9) : цифри;
}

function дія(l) {

  if (l.peek) return 'перегляд';
  if (l.hold) return 'фіксація';
  if (String(l.source || '').toLowerCase().includes('чат')) return 'чат';
  return 'замовлення';
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Метод не підтримується' });
  }
  if (!(await guard(req, res, 'leads'))) return;

  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const ключ = String(body.key || '').replace(/\D/g, '').slice(0, 20);
    const стан = String(body.state || '').slice(0, 24);
    if (!ключ) return res.status(400).json({ error: 'Немає ключа клієнта' });
    if (!СТАНИ.includes(стан)) return res.status(400).json({ error: 'Невідомий стан' });
    await hset(СТАН_ХЕШ, ключ, стан);
    return res.status(200).json({ ok: true });
  }

  const [заявки, статуси, стани] = await Promise.all([
    range(LIST, 0, МЕЖА - 1),
    усіСтатуси().catch(() => ({})),
    Promise.all([
      getItem(СТАН_КЛЮЧ).then(x => x || {}).catch(() => ({})),
      hgetall(СТАН_ХЕШ).catch(() => ({}))
    ]).then(([старі, нові]) => ({ ...старі, ...нові }))
  ]);

  const люди = new Map();

  for (const l of заявки) {
    const ключ = ключТелефону(l.phone);
    if (!ключ) continue;

    let к = люди.get(ключ);
    if (!к) {
      к = {
        key: ключ, phone: l.phone, name: l.name || '',
        first: l.at, last: l.at,
        orders: 0, holds: 0, chats: 0,
        quiz: false, chat: false,
        total: 0, leads: [], pages: [], utm: null, secs: 0
      };
      люди.set(ключ, к);
    }

    if (l.name && l.at >= к.last) к.name = l.name;
    if (l.phone && String(l.phone).length > String(к.phone).length) к.phone = l.phone;

    if (l.at < к.first) к.first = l.at;
    if (l.at > к.last)  к.last  = l.at;

    const що = дія(l);
    if (що === 'замовлення') { к.orders += 1; к.total += Math.round(Number(l.total) || 0); }
    if (що === 'фіксація')   { к.holds  += 1; }
    if (що === 'чат')        { к.chats  += 1; к.chat = true; }

    const did = (l.visit && Array.isArray(l.visit.did)) ? l.visit.did : [];
    if (did.includes('квіз') || (l.windows || []).length) к.quiz = true;
    if (did.includes('чат')) к.chat = true;
    if (l.visit && l.visit.secs) к.secs += Number(l.visit.secs) || 0;
    if (l.page && !к.pages.includes(l.page)) к.pages.push(l.page);
    if (!к.utm && l.utm && l.utm.utm_source) к.utm = l.utm;

    к.leads.push({
      id: l.id, at: l.at, kind: l.kind || '', source: l.source || '',
      total: Math.round(Number(l.total) || 0),
      hold: l.hold || null,
      windows: (l.windows || []).length,
      status: статуси[l.id] || l.status || 'нова',
      act: що
    });
  }

  const список = [...люди.values()]
    .map(к => ({
      ...к,
      state: стани[к.key] || 'нова',
      leads: к.leads.sort((a, b) => (a.at < b.at ? 1 : -1))
    }))
    .sort((a, b) => (a.last < b.last ? 1 : -1));

  return res.status(200).json({
    clients: список,
    states: СТАНИ,
    total: список.length,
    scanned: заявки.length,
    persistent: isPersistent,

    partial: заявки.length >= МЕЖА
  });
}
