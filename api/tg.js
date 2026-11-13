import { sadd, srem, smembers, setOnce, getRaw, del } from '../lib/store.js';
import { guard } from '../lib/auth.js';

const СПИСОК = 'tg:subs';
const ЖИТТЯ_КОДУ = 30 * 60;
const КОД = /^[a-f0-9]{24}$/;

export default async function handler(req, res) {
  if (req.query && req.query.admin) return адмінка(req, res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(401).json({ ok: false });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});

  try {
    const msg = body.message || body.edited_message;

    if (msg && msg.chat && msg.chat.id && msg.chat.type === 'private') {
      const id = String(msg.chat.id);
      const текст = String(msg.text || '').trim();
      const [команда, арг] = текст.split(/\s+/, 2);
      const cmd = (команда || '').toLowerCase().replace(/@.*$/, '');

      if (cmd === '/stop') {
        await srem(СПИСОК, id);
        await reply(id, 'Готово — заявки сюди більше не надсилатимемо.');
      } else if (cmd === '/start' && арг && КОД.test(арг.toLowerCase())) {
        const ключ = 'tg:code:' + арг.toLowerCase();
        const є = await getRaw(ключ);
        if (є) {
          await del(ключ);
          await sadd(СПИСОК, id);
          await reply(id, '✅ Підключено! Нові заявки з сайту приходитимуть сюди.\n\nЩоб відписатися — надішліть /stop.');
        } else {
          await reply(id, 'Посилання застаріло або вже використане. Попросіть у адміністратора нове.');
        }
      } else {
        const підписаний = (await smembers(СПИСОК)).map(String).includes(id);
        await reply(id, підписаний
          ? 'Ви отримуєте заявки з сайту. Щоб відписатися — надішліть /stop.'
          : 'Це службовий бот «Фірмової Штори» для менеджерів. Щоб отримувати заявки, ' +
            'попросіть в адміністратора посилання для підключення.');
      }
    }

    const зміна = body.my_chat_member;
    if (зміна && зміна.chat && зміна.chat.id) {
      const st = зміна.new_chat_member && зміна.new_chat_member.status;
      if (st === 'kicked' || st === 'left') await srem(СПИСОК, зміна.chat.id);
    }
  } catch (e) {

    console.error('tg webhook:', e.message);
  }

  return res.status(200).json({ ok: true });
}

async function адмінка(req, res) {
  if (!(await guard(req, res, 'settings'))) return;
  res.setHeader('Cache-Control', 'private, no-store');
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (req.method === 'GET') {
    const ids = (await smembers(СПИСОК)).map(String);
    const фіксовані = String(process.env.TELEGRAM_CHAT_ID || '').split(/[,\s]+/).filter(Boolean);
    const хто = await Promise.all(ids.map(async id => ({ id, ...(await чат(token, id)) })));
    return res.status(200).json({
      ok: true, token: !!token, secret: !!process.env.TELEGRAM_WEBHOOK_SECRET,
      fixed: фіксовані.length, subs: хто
    });
  }

  if (req.method === 'POST') {
    if (!token) return res.status(503).json({ error: 'Немає TELEGRAM_BOT_TOKEN' });
    const бот = await імʼяБота(token);
    if (!бот) return res.status(502).json({ error: 'Telegram не відповів. Спробуйте ще раз.' });
    const код = [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');
    await setOnce('tg:code:' + код, '1', ЖИТТЯ_КОДУ);
    return res.status(200).json({ ok: true, link: `https://t.me/${бот}?start=${код}`, minutes: ЖИТТЯ_КОДУ / 60 });
  }

  if (req.method === 'DELETE') {
    const id = String((req.query && req.query.id) || '').slice(0, 40);
    if (!/^-?\d+$/.test(id)) return res.status(400).json({ error: 'Потрібен id' });
    await srem(СПИСОК, id);
    if (token) await reply(id, 'Адміністратор відключив цей чат від заявок сайту.');
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Метод не підтримується' });
}

async function імʼяБота(token) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: тайм(4000) });
    const d = await r.json();
    return d && d.ok && d.result && d.result.username ? d.result.username : null;
  } catch (e) { return null; }
}

async function чат(token, id) {
  if (!token) return {};
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(id)}`, { signal: тайм(4000) });
    const d = await r.json();
    if (!d || !d.ok) return { name: '', username: '', gone: true };
    const c = d.result || {};
    return {
      name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.title || '',
      username: c.username || ''
    };
  } catch (e) { return {}; }
}

async function reply(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: тайм(4000)
    });
  } catch (e) {}
}

function тайм(ms) { try { return AbortSignal.timeout(ms); } catch (e) { return undefined; } }
function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
