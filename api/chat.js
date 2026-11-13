import OpenAI from 'openai';
import { bump, push, setItem, getItem, hincr } from '../lib/store.js';
import { clientIp } from '../lib/ip.js';
import { systemPrompt, КВІЗ } from '../lib/facts.js';
import { МОДЕЛЬ as MODEL } from '../lib/model.js';

const НА_ЛЮДИНУ = 30;
const НА_САЙТ    = 800;

const МАКС_ПОВІДОМЛЕНЬ = 24;
const МАКС_СИМВОЛІВ    = 1200;

const ЖИТТЯ_РОЗМОВИ = 120 * 86400;

const НОМЕР = /^[a-z0-9]{8,40}$/;
const UTM_КЛЮЧІ = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
function рекламні(v) {
  const out = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of UTM_КЛЮЧІ) if (v[k] != null && v[k] !== '') out[k] = String(v[k]).slice(0, 200);
  return out;
}

const key = () => process.env.OPENAI_API_KEY;

let налаштування = null, коли = 0;
async function живіНалаштування() {
  if (налаштування && Date.now() - коли < 60_000) return налаштування;
  try { налаштування = (await getItem('settings')) || {}; коли = Date.now(); }
  catch (e) { налаштування = налаштування || {}; }
  return налаштування;
}

const ip = clientIp;

function clean(body) {
  const list = body && Array.isArray(body.messages) ? body.messages : null;
  if (!list || !list.length) return null;
  const out = [];
  for (const m of list.slice(-МАКС_ПОВІДОМЛЕНЬ)) {
    const role = m && m.role === 'assistant' ? 'assistant' : 'user';
    const text = typeof (m && m.content) === 'string' ? m.content.trim() : '';
    if (!text) continue;
    out.push({ role, content: text.slice(0, МАКС_СИМВОЛІВ) });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out.length ? out : null;
}

const БАЗОВІ = { max_completion_tokens: 700, temperature: 0.4 };

async function спитати(client, messages) {
  const пар = { ...БАЗОВІ };
  for (let спроба = 0; спроба < 3; спроба++) {
    try {
      return await client.chat.completions.create({ model: MODEL, messages, ...пар });
    } catch (e) {
      const текст = (e && e.error && e.error.message) || (e && e.message) || '';
      const m = текст.match(/Unsupported (?:parameter|value): '([^']+)'/);
      const ім = m && m[1];
      if (e && e.status === 400 && ім && Object.prototype.hasOwnProperty.call(пар, ім)) {

        if (ім === 'max_completion_tokens') пар.max_tokens = БАЗОВІ.max_completion_tokens;
        delete пар[ім];
        console.error('Модель не приймає параметр', ім, '— пробуємо без нього');
        continue;
      }
      throw e;
    }
  }
  throw new Error('Модель не прийняла жодного набору параметрів');
}

const СПИСОК = 'chats';

function ключПитання(t) {
  return String(t).toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 70);
}

async function записати(cid, messages, відповідь, доКвізу, meta) {
  if (!cid) return;
  const ключ = 'chat:' + cid;
  let розмова = null;
  try { розмова = await getItem(ключ); } catch (e) { return; }

  const нова = !розмова;
  if (нова) {
    розмова = {
      id: cid,
      at: new Date().toISOString(),
      page: meta.page || '',
      utm: meta.utm || {},
      messages: []
    };
  }

  const людина = [...messages].reverse().find(m => m.role === 'user');
  if (людина) розмова.messages.push({ who: 'me', text: людина.content });
  розмова.messages.push({ who: 'bot', text: відповідь });
  розмова.messages = розмова.messages.slice(-40);
  розмова.updated = new Date().toISOString();
  розмова.turns = (розмова.turns || 0) + 1;
  if (доКвізу) розмова.quiz = true;

  try {
    await setItem(ключ, розмова, ЖИТТЯ_РОЗМОВИ);
    if (нова) {
      await push(СПИСОК, { id: cid, at: розмова.at });
      await hincr('chatstat', 'розмов');
    }
    await hincr('chatstat', 'реплік');
    if (доКвізу) await hincr('chatstat', 'у калькулятор');
    if (людина) await hincr('chatq', ключПитання(людина.content));
  } catch (e) {

    console.error('Історія чату:', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Тільки POST' });
  }

  if (!key()) {
    return res.status(503).json({
      error: 'Помічник ще не підключений.',
      hint: 'Додайте OPENAI_API_KEY у налаштуваннях проєкту на Vercel.'
    });
  }

  const messages = clean(req.body);
  if (!messages) return res.status(400).json({ error: 'Порожнє повідомлення' });

  try {
    const свій = await bump('rl:chat:ip:' + ip(req), 3600);
    if (свій > НА_ЛЮДИНУ) {
      return res.status(429).json({
        error: 'Забагато повідомлень поспіль. Спробуйте за годину — або порахуйте ціну в калькуляторі.',
        quiz: true
      });
    }
    const усі = await bump('rl:chat:day:' + new Date().toISOString().slice(0, 10), 86400);
    if (усі > НА_САЙТ) {
      return res.status(429).json({
        error: 'Помічник сьогодні перевантажений. Ціну можна порахувати в калькуляторі.',
        quiz: true
      });
    }
  } catch (e) {
    console.error('Лічильник звернень:', e.message);
    return res.status(503).json({ error: 'Помічник тимчасово недоступний. Ціну можна порахувати в калькуляторі.', quiz: true });
  }

  try {
    const client = new OpenAI({ apiKey: key() });
    const r = await спитати(client, [
      { role: 'system', content: systemPrompt(await живіНалаштування()) }, ...messages
    ]);

    const choice = r.choices && r.choices[0];
    let text = (choice && choice.message && choice.message.content || '').trim();

    const доКвізу = text.includes(КВІЗ);
    if (доКвізу) text = text.split(КВІЗ).join('').trim();

    const cid = String((req.body && req.body.cid) || '').toLowerCase();
    await записати(НОМЕР.test(cid) ? cid : '',
      messages, text, доКвізу, {
        page: String((req.body && req.body.page) || '').slice(0, 120),
        utm:  рекламні(req.body && req.body.utm)
      });

    if (!text) {
      return res.status(200).json({
        reply: 'Не впевнений, що відповім точно. Найшвидше це покаже калькулятор.',
        quiz: true
      });
    }
    return res.status(200).json({ reply: text, quiz: доКвізу });

  } catch (e) {
    const code = e && e.status;
    if (code === 401 || code === 403) {
      console.error('Ключ не прийнято:', code);
      return res.status(503).json({ error: 'Помічник тимчасово недоступний.', quiz: true });
    }
    if (code === 404) {
      console.error('Немає такої моделі:', MODEL);
      return res.status(503).json({ error: 'Помічник тимчасово недоступний.', quiz: true });
    }
    if (code === 429) {
      return res.status(429).json({ error: 'Забагато звернень. Спробуйте за хвилину.', quiz: true });
    }

    console.error('Чат:', code || 'без коду', MODEL,
      (e && e.error && e.error.message) || (e && e.message) || e);
    return res.status(502).json({ error: 'Помічник не відповів. Ціну можна порахувати в калькуляторі.', quiz: true });
  }
}
