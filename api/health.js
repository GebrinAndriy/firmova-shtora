import { isPersistent, bump } from '../lib/store.js';
import { isConfigured, sessionRole } from '../lib/auth.js';
import { МОДЕЛЬ } from '../lib/model.js';

async function читати(r) {
  try {
    const t = await r.json();
    return (t && t.error && (t.error.message || t.error.code)) || null;
  } catch (e) { return null; }
}

async function перевіритиКлюч() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { стан: 'ключа немає', деталі: 'Додайте OPENAI_API_KEY у змінні оточення.' };

  const заг = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  const вислід = { модель: МОДЕЛЬ };

  try {
    const r = await fetch('https://api.openai.com/v1/models', { headers: заг });
    if (r.status === 401 || r.status === 403)
      return { ...вислід, стан: 'ключ не прийнято', код: r.status,
               відповідь: await читати(r),
               деталі: 'Ключ недійсний, відкликаний або скопійований з помилкою.' };
    вислід.ключ = r.ok ? 'приймають' : 'відповідь ' + r.status;
    if (r.ok) {

      try {
        const д = await r.clone().json();
        const усі = (д.data || []).map(x => x.id);
        вислід.є_така_модель = усі.includes(МОДЕЛЬ);
        if (!вислід.є_така_модель) вислід.доступні = усі.slice(0, 25);
      } catch (e) {}
    }
  } catch (e) {
    return { ...вислід, стан: 'не вдалося звʼязатись', деталі: e.message };
  }

  try {

    let r, поле = 'max_completion_tokens';
    for (const імя of ['max_completion_tokens', 'max_tokens']) {
      поле = імя;
      r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: заг,
        body: JSON.stringify({ model: МОДЕЛЬ, [імя]: 1,
                               messages: [{ role: 'user', content: 'пінг' }] })
      });
      if (r.ok || r.status !== 400) break;
    }
    if (r.ok) return { ...вислід, стан: 'працює', стеля: поле };
    return { ...вислід, стан: 'модель не відповідає', код: r.status,
             відповідь: await читати(r),
             деталі: r.status === 404 ? 'Такої моделі для цього ключа немає — перевірте назву або баланс.'
                   : r.status === 429 ? 'Вичерпана квота або порожній баланс.'
                   : 'Дивіться поле «відповідь» — там текст від OpenAI.' };
  } catch (e) {
    return { ...вислід, стан: 'не вдалося звʼязатись', деталі: e.message };
  }
}

export default async function handler(req, res) {
  const дані = {
    ok: true,
    сховище:  isPersistent ? 'Upstash Redis' : 'памʼять процесу (дані зникнуть при перезапуску)',
    постійне: isPersistent,
    адмінка:  isConfigured,
    помічник: Boolean(process.env.OPENAI_API_KEY),
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    готово:   isPersistent && isConfigured
  };

  if (req.query && req.query.deep) {

    const role = await sessionRole(req);
    if (role !== 'admin') {
      дані.перевіркаКлюча = { стан: 'потрібен вхід адміністратора' };
      return res.status(200).json(дані);
    }

    let дозволено = false;
    try { дозволено = (await bump('health:deep', 3600)) <= 20; } catch (e) { дозволено = false; }
    дані.перевіркаКлюча = дозволено
      ? await перевіритиКлюч()
      : { стан: 'забагато перевірок поспіль', деталі: 'Спробуйте за годину.' };
  }

  res.status(200).json(дані);
}
