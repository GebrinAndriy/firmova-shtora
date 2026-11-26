import { createHash } from 'node:crypto';
import { guard, sessionRole } from '../lib/auth.js';
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

// n days ending on `кінець` (YYYY-MM-DD, Kyiv); a missing, broken or future date means today.
export function дніДо(n, кінець, now = new Date()) {
  const сьогодні = деньКиєва(now);
  const ок = /^\d{4}-\d{2}-\d{2}$/.test(String(кінець || '')) &&
    new Date(кінець + 'T00:00:00Z').toISOString().slice(0, 10) === кінець;
  const до = ок && кінець < сьогодні ? кінець : сьогодні;
  const [y, m, d] = до.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  return out;
}

// 'ads' = came from Facebook / Instagram: an ad link (fbclid / utm) or the visitor
// opened the site inside those apps or from their pages.
export function джерелоЗаявки(l) {
  const u = (l && l.utm) || {};
  return u.fbclid || /^(fb|facebook|ig|instagram|meta)/i.test(u.utm_source || '') ||
    l.came === 'facebook' || l.came === 'instagram' ? 'ads' : 'other';
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
    const крок = b && String(b.s || ''), дж = b && String(b.src || '');
    if (!КРОКИ.includes(крок) || !ДЖЕРЕЛА.includes(дж)) return res.status(400).json({ error: 'bad step' });
    if (БОТИ.test(String(req.headers['user-agent'] || ''))) return res.status(204).end();
    // The owner and managers browsing their own site are not visitors.
    try { if (await sessionRole(req)) return res.status(204).end(); } catch (e) {}

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
    let дні;
    try { дні = дніДо(n, req.query.end); } catch (e) { дні = дніДо(n); }
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

    // Funnel steps: calculator leads from the moment the counter started, so they
    // line up with the counted visits. The «Оплачено» list: every paid lead made in
    // the period (calculator or chat), whenever the counter started.
    const paidList = [];
    for (const сирий of leads) {
      const l = зПравкою(сирий, правки[сирий.id]);
      const r = заДнем[деньКиєва(new Date(l.at))];
      if (!r) continue;
      const s = джерелоЗаявки(l);
      const оплачена = (statuses[l.id] || l.status) === 'оплачено';
      const сума = Number(l.total) > 0 ? Number(l.total) : 0;
      if (оплачена) paidList.push({ id: l.id, at: l.at, name: String(l.name || '').slice(0, 80), total: сума, src: s,
                                    from: /квіз/i.test(String(l.source || '')) ? 'калькулятор' : String(l.source || 'сайт').slice(0, 40) });
      if (!/квіз/i.test(String(l.source || ''))) continue;
      if (відМоменту && String(l.at) < відМоменту) continue;
      r[s].lead++;
      if (оплачена) { r[s].paid++; r[s].paidSum += сума; }
    }
    paidList.sort((a, b) => String(b.at).localeCompare(String(a.at)));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ days, since: відМоменту, paidList: paidList.slice(0, 100) });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Метод не підтримується' });
}
