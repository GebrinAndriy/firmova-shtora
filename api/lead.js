import { push, pushWithReceipt, isPersistent, bump, smembers, srem } from '../lib/store.js';
import { clientIp } from '../lib/ip.js';
import { capi, metaReady } from '../lib/meta.js';

const LIST = 'leads';
const PHONE = /^(\+?38)?0\d{9}$/;

const НА_АДРЕСУ = 8;
const ВІКНО     = 10 * 60;
const НА_САЙТ   = 300;
const НА_НОМЕР  = 6;

const ЗАПИС_ЗА_ДОБУ = 400;
const МАКС_ТІЛО = 24 * 1024;
const TTL_ПОВТОРУ = 86400;

function clean(v, max = 200) {
  return String(v == null ? '' : v).trim().slice(0, max);
}
const число = (v, max = 100000) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : null;
};

const ціна = v => (v == null || v === '' ? null : число(v, 10000000));

function вікно(w, i) {
  if (!w || typeof w !== 'object' || Array.isArray(w)) return null;
  const blinds = Array.isArray(w.blinds)
    ? w.blinds.slice(0, 8).filter(b => b && typeof b === 'object' && !Array.isArray(b)).map((b, j) => ({
        n: число(b.n, 99) || j + 1,
        fabric: clean(b.fabric, 80),
        fabricW: число(b.fabricW, 100000), fabricH: число(b.fabricH, 100000),
        width: число(b.width, 100000),
        price: ціна(b.price)
      }))
    : [];
  return {
    window: число(w.window, 99) || i + 1,
    line: clean(w.line, 60),
    sashes: число(w.sashes, 99),
    whole: !!w.whole,
    fabricW: число(w.fabricW, 100000), fabricH: число(w.fabricH, 100000),
    width: число(w.width, 100000), height: число(w.height, 100000),
    system: clean(w.system, 60),
    fabric: clean(w.fabric, 200),
    side: clean(w.side, 40),
    options: Array.isArray(w.options) ? w.options.slice(0, 10).map(x => clean(x, 60)).filter(Boolean) : [],
    blinds,
    price: ціна(w.price)
  };
}

const UTM_КЛЮЧІ = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid'];
function рекламні(v) {
  const out = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of UTM_КЛЮЧІ) if (v[k] != null && v[k] !== '') out[k] = clean(v[k], 200);
  return out;
}

const html = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function зТаймаутом(ms) {
  try { return AbortSignal.timeout(ms); } catch (e) { return undefined; }
}

function колиУкраїнською(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  try {
    return new Intl.DateTimeFormat('uk-UA', {
      timeZone: 'Europe/Kyiv', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit'
    }).format(d).replace(' р.', '').replace(/,$/, '');
  } catch (e) {
    return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  }
}

async function toTelegram(lead) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: false, reason: 'не налаштовано' };

  const фіксовані = String(process.env.TELEGRAM_CHAT_ID || '')
    .split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
  let підписники = [];
  try { підписники = await smembers('tg:subs'); } catch (e) {}
  const чати = [...new Set([...фіксовані, ...підписники.map(String)])];
  if (!чати.length) return { sent: false, reason: 'немає отримувачів' };

  const вікон = (lead.windows || []).length;
  const коли = колиУкраїнською(lead.at);
  const текст = [
    '🪟 <b>Нова заявка</b>' + (коли ? ` · ${html(коли)}` : ''),
    `<b>${html(lead.name || 'Без імені')}</b> · ${html(lead.phone || 'номера немає')}`,
    lead.individual
      ? `Сума: <b>індивідуальна</b> — порахувати менеджеру` + (вікон ? ` · вікон: ${вікон}` : '')
      : (lead.total ? `Сума: <b>${цілі(lead.total)} грн</b>` + (вікон ? ` · вікон: ${вікон}` : '') : null),
    lead.kind || lead.source ? html(lead.kind || lead.source) : null,
    '',
    'Подробиці — в адмінці, розділ «Заявки».'
  ].filter(x => x !== null).join('\n');

  return розіслати(token, чати, текст);
}

async function розіслати(token, чати, текст) {
  const відповіді = await Promise.allSettled(чати.map(chat =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: текст, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: зТаймаутом(4000)
    }).then(r => ({ chat, r }))));
  let надіслано = 0;
  for (const v of відповіді) {
    if (v.status !== 'fulfilled') continue;
    const { chat, r } = v.value;
    if (r.ok) надіслано++;

    else if (r.status === 403) { try { await srem('tg:subs', chat); } catch (e) {} }
  }
  return { sent: надіслано > 0, reason: надіслано ? null : 'не доставлено', count: надіслано };
}

async function службове(текст) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const чати = String(process.env.TELEGRAM_CHAT_ID || '').split(/[,\s]+/).filter(Boolean);
  if (!token || !чати.length) return;
  try { await розіслати(token, чати, текст); } catch (e) {}
}

const цілі = n => Math.round(Number(n) || 0);

function мітки(v) {
  if (!v || typeof v !== 'object') return null;
  const m = {
    event_id: clean(v.event_id, 60),
    event_name: clean(v.event_name, 24),
    fbp: clean(v.fbp, 120),
    fbc: clean(v.fbc, 200),
    fbclid: clean(v.fbclid, 200)
  };
  return (m.event_id || m.fbp || m.fbc || m.fbclid) ? m : null;
}

function слід(v) {
  if (!v || typeof v !== 'object') return null;
  return {
    secs:    Math.min(99999, Math.max(0, Math.round(Number(v.secs) || 0))),
    did:     Array.isArray(v.did)  ? v.did.slice(0, 8).map(x => clean(x, 20)) : [],
    seen:    Array.isArray(v.seen) ? v.seen.slice(0, 16).map(x => clean(x, 40)) : [],
    summary: clean(v.summary, 400),
    from:    clean(v.from, 60),
    page:    clean(v.page, 120),
    ref:     clean(v.ref, 200),
    screen:  clean(v.screen, 20),
    opened:  clean(v.opened, 30)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Тільки POST' });
  }

  const origin = req.headers.origin;
  if (origin) {
    let чужий = true;
    try { чужий = new URL(origin).host !== req.headers.host; } catch (e) {}
    if (чужий) return res.status(403).json({ error: 'Заборонено' });
  }

  const rawLen = typeof req.body === 'string' ? req.body.length : JSON.stringify(req.body || {}).length;
  if (rawLen > МАКС_ТІЛО) return res.status(413).json({ error: 'Заявка завелика' });

  if (process.env.VERCEL === '1' && !isPersistent) {
    return res.status(503).json({ error: 'Не вдалося зберегти заявку. Спробуйте ще раз або зателефонуйте нам.' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const name = clean(body.name, 80);
  const phone = clean(body.phone, 24).replace(/[\s()-]/g, '');
  const rid = /^[a-z0-9-]{8,64}$/i.test(String(body.rid || '')) ? String(body.rid) : '';
  const confirmDuplicate = id =>
    res.status(200).json({ ok: true, id, stored: true, duplicate: true, persistent: isPersistent });

  const ip = clientIp(req);
  try {

    const адреса = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
    const свій = await bump('lead:ip:' + адреса, ВІКНО);
    if (свій > НА_АДРЕСУ) {
      return res.status(429).json({ error: 'Забагато заявок поспіль. Спробуйте за кілька хвилин.' });
    }
  } catch (e) {   }

  if (name.length < 2) return res.status(400).json({ error: 'Вкажіть імʼя' });
  if (!PHONE.test(phone)) return res.status(400).json({ error: 'Вкажіть коректний номер телефону' });

  if (rid) {
    try {
      const receipt = await pushWithReceipt(LIST, rid, null, TTL_ПОВТОРУ);
      if (receipt) return confirmDuplicate(receipt.id);
    } catch (e) {}
  }

  const сьогодні = new Date().toISOString().slice(0, 10);
  try {
    const з_номера = await bump('lead:tel:' + phone.slice(-9) + ':' + сьогодні, 86400);
    if (з_номера > НА_НОМЕР) {
      return res.status(429).json({ error: 'З цього номера сьогодні вже є кілька заявок — ми з вами зв’яжемося. Терміново — зателефонуйте нам.' });
    }
    const за_добу = await bump('lead:store:' + сьогодні, 86400);
    if (за_добу > ЗАПИС_ЗА_ДОБУ) {
      if (за_добу === ЗАПИС_ЗА_ДОБУ + 1) {
        await службове('⚠️ Сайт прийняв понад ' + ЗАПИС_ЗА_ДОБУ + ' заявок за добу — схоже на спам. ' +
          'Нові заявки до кінця доби не приймаються. Перевірте розділ «Заявки» в адмінці.');
      }
      return res.status(429).json({ error: 'Зараз не вдається прийняти заявку онлайн. Будь ласка, зателефонуйте нам.' });
    }
  } catch (e) {   }

  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    at: new Date().toISOString(),
    name, phone,
    source: clean(body.source, 60) || 'сайт',
    kind:   clean(body.kind, 80),

    page:   clean(body.page, 120),
    total:  Math.round(Number(body.total) || 0),

    individual: !!body.individual,

    windows: Array.isArray(body.windows)
      ? body.windows.slice(0, 20).filter(w => w && typeof w === 'object' && !Array.isArray(w)).map(вікно)
      : [],

    delivery: clean(body.delivery, 200),
    hold:   Math.round(Number(body.hold) || 0) || null,
    utm:    рекламні(body.utm),

    ga_cid: clean(body.ga_cid, 60),

    visit:  слід(body.visit),

    meta:   мітки(body.meta),
    note:   clean(body.note, 1000),
    status: 'нова'
  };

  if (JSON.stringify(lead).length > МАКС_ТІЛО) return res.status(413).json({ error: 'Заявка завелика' });

  try {
    if (rid) {
      const receipt = await pushWithReceipt(LIST, rid, lead, TTL_ПОВТОРУ);
      if (receipt.duplicate) return confirmDuplicate(receipt.id);
    } else {
      await push(LIST, lead);
    }
  } catch (e) {

    return res.status(500).json({ error: 'Не вдалося зберегти заявку. Зателефонуйте нам, будь ласка.' });
  }

  let переповнено = false;
  try { переповнено = (await bump('lead:day:' + lead.at.slice(0, 10), 86400)) > НА_САЙТ; }
  catch (e) {}
  const tg = переповнено ? { sent: false, reason: 'добова стеля' } : await toTelegram(lead);

  if (lead.meta && lead.meta.event_id && metaReady()) {
    const evName = lead.meta.event_name === 'PriceHold' ? 'PriceHold' : 'Lead';
    await Promise.race([capi(evName, {
      eventId: lead.meta.event_id,
      value: lead.total || undefined,
      phone: lead.phone,
      fbp: lead.meta.fbp, fbc: lead.meta.fbc,
      ip, ua: req.headers['user-agent'] || '',
      sourceUrl: req.headers['referer'] || ''
    }).catch(() => {}), new Promise(r => setTimeout(r, 2500))]);
  }

  return res.status(200).json({
    ok: true,
    id: lead.id,
    stored: true,
    persistent: isPersistent,
    forwarded: { telegram: tg.sent }
  });
}

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
