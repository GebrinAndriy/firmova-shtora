import { createHash } from 'node:crypto';
import { guard } from '../lib/auth.js';
import { hincr, hall, bump, range, setOnce, getRaw } from '../lib/store.js';
import { усіСтатуси } from '../lib/statuses.js';
import { усіПравки, зПравкою } from '../lib/edits.js';

// Anonymous funnel: the site reports "one more visitor reached step X today",
// at most once per browser tab. No cookies, no ids, no IPs are stored — only
// daily counters per step and traffic source. Leads and payments come from the
// lead list itself, so they are exact.
export const КРОКИ = ['visit', 'calc', 'size', 'price', 'mode'];
const ДЖЕРЕЛА = ['ads', 'other'];
const БОТИ = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|externalhit|python|curl|wget|node-fetch/i;
const ДНІ = [1, 7, 30, 90];
// When the counter started: leads made before it have no matching visits, so the
// report only counts leads from this moment on.
const СТАРТ = 'funnel:since';
let стартЗаписано = false;

export const деньКиєва = d => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(d);

function останніДні(n, now = new Date()) {
  const [y, m, d] = деньКиєва(now).split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  return out;
}

export function джерелоЗаявки(l) {
  const u = (l && l.utm) || {};
  return u.fbclid || /^(fb|facebook|ig|instagram|meta)/i.test(u.utm_source || '') ? 'ads' : 'other';
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
    const крок = b && String(b.s || ''), дж = b && String(b.src || '');
    if (!КРОКИ.includes(крок) || !ДЖЕРЕЛА.includes(дж)) return res.status(400).json({ error: 'bad step' });
    if (БОТИ.test(String(req.headers['user-agent'] || ''))) return res.status(204).end();

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'none';
    const ключ = 'fn:rl:' + createHash('sha256').update(ip).digest('hex').slice(0, 16);
    try { if ((await bump(ключ, 60)) > 40) return res.status(204).end(); } catch (e) {}

    try { await hincr('funnel:' + деньКиєва(new Date()), дж + ':' + крок); }
    catch (e) { return res.status(204).end(); }
    if (!стартЗаписано) {
      try { await setOnce(СТАРТ, new Date().toISOString(), 10 * 365 * 86400); стартЗаписано = true; } catch (e) {}
    }
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    if (!(await guard(req, res, 'leads'))) return;
    const n = ДНІ.includes(Number(req.query.days)) ? Number(req.query.days) : 7;
    const дні = останніДні(n);
    const [лічильники, leads, statuses, правки, старт] = await Promise.all([
      Promise.all(дні.map(d => hall('funnel:' + d).catch(() => ({})))),
      range('leads', 0, 4999),
      усіСтатуси(),
      усіПравки(),
      getRaw(СТАРТ).catch(() => null)
    ]);
    const відМоменту = старт && !isNaN(Date.parse(старт)) ? старт : null;
    const days = дні.map((d, i) => {
      const c = лічильники[i], row = { day: d, ads: {}, other: {} };
      for (const s of ДЖЕРЕЛА) for (const k of КРОКИ) row[s][k] = Number(c[s + ':' + k]) || 0;
      for (const s of ДЖЕРЕЛА) Object.assign(row[s], { lead: 0, paid: 0, paidSum: 0 });
      return row;
    });
    const заДнем = Object.fromEntries(days.map(r => [r.day, r]));

    const paidList = [];
    for (const сирий of leads) {
      const l = зПравкою(сирий, правки[сирий.id]);
      if (!/квіз/i.test(String(l.source || ''))) continue;
      if (відМоменту && String(l.at) < відМоменту) continue;
      const r = заДнем[деньКиєва(new Date(l.at))];
      if (!r) continue;
      const s = джерелоЗаявки(l);
      r[s].lead++;
      if ((statuses[l.id] || l.status) === 'оплачено') {
        const сума = Number(l.total) > 0 ? Number(l.total) : 0;
        r[s].paid++;
        r[s].paidSum += сума;
        paidList.push({ id: l.id, at: l.at, name: String(l.name || '').slice(0, 80), total: сума, src: s,
                        kind: l.hold ? 'фіксація' : 'замовлення' });
      }
    }
    paidList.sort((a, b) => String(b.at).localeCompare(String(a.at)));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ days, since: відМоменту, paidList: paidList.slice(0, 100) });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Метод не підтримується' });
}
