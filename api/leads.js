import { guard } from '../lib/auth.js';
import { range, count, getItem, removeById, isPersistent, hset, hgetall, hdel, setOnce, del } from '../lib/store.js';
import { усіСтатуси, СТАТУСИ } from '../lib/statuses.js';
import { capi, metaReady } from '../lib/meta.js';
import { ga4Purchase, ga4Ready } from '../lib/ga.js';
import { ПРАВКИ, усіПравки, зПравкою, перевіритиПравку, зберегтиПравку } from '../lib/edits.js';

const LIST = 'leads';

const ПОКУПКИ = 'meta-purch:h',  ПОКУПКИ_СТАРІ = 'meta-purch';

const ОПЛАЧЕНО = 'оплачено';

export function зведення(всі) {
  const st = {};
  let оплаченоГрн = 0;
  for (const l of всі) {
    st[l.status] = (st[l.status] || 0) + 1;
    if (l.status === ОПЛАЧЕНО && Number(l.total) > 0) оплаченоГрн += Number(l.total);
  }
  return { всього: всі.length, st, оплаченоГрн };
}

export default async function handler(req, res) {
  const роль = await guard(req, res, 'leads');
  if (!роль) return;

  if (req.method === 'GET') {
    const from = Math.max(0, Number(req.query.from) || 0);
    const size = Math.min(200, Math.max(1, Number(req.query.size) || 50));
    const [statuses, правки] = await Promise.all([усіСтатуси(), усіПравки()]);
    const повна = x => ({ ...зПравкою(x, правки[x.id]), status: statuses[x.id] || x.status || 'нова' });
    if (from === 0) {
      const всі = (await range(LIST, 0, 4999)).map(повна);
      return res.status(200).json({
        items: всі.slice(0, size), total: всі.length, from, size, persistent: isPersistent,
        stats: зведення(всі)
      });
    }
    const [items, total] = await Promise.all([range(LIST, from, from + size - 1), count(LIST)]);
    return res.status(200).json({
      items: items.map(повна),
      total, from, size, persistent: isPersistent
    });
  }

  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!body.id) return res.status(400).json({ error: 'Немає id' });
    const id = String(body.id).slice(0, 40);

    if (body.edit && typeof body.edit === 'object') {
      const lead = (await range(LIST, 0, 4999)).find(l => l.id === id);
      if (!lead) return res.status(404).json({ error: 'Заявку не знайдено. Можливо, її видалили.' });
      const правки = await усіПравки();
      const була = правки[id];
      if (String(body.was || '') !== String((була && була.at) || '')) {
        return res.status(409).json({ error: 'Цю заявку щойно змінили з іншого пристрою. Оновіть сторінку й внесіть зміни ще раз.' });
      }
      const { правка, error } = перевіритиПравку(body.edit, lead);
      if (error) return res.status(400).json({ error });
      правка.at = new Date().toISOString();
      правка.by = роль === 'manager' ? 'менеджер' : 'адміністратор';
      await зберегтиПравку(id, правка);
      const statuses = await усіСтатуси();
      return res.status(200).json({ ok: true, lead: { ...зПравкою(lead, правка), status: statuses[id] || lead.status || 'нова' } });
    }

    const нов = String(body.status || 'нова').slice(0, 24);
    const було = (await усіСтатуси())[id];
    await hset(СТАТУСИ, id, нов);

    let purchase = null;

    if (нов === ОПЛАЧЕНО && було !== ОПЛАЧЕНО && !(await setOnce('purch-lock:' + id, '1', 60).catch(() => true))) {
      return res.status(200).json({ ok: true, purchase: { error: 'покупку вже відправляють — оновіть сторінку за хвилину' } });
    }
    if (нов === ОПЛАЧЕНО && було !== ОПЛАЧЕНО) {
      try {
        const [старі, нові] = await Promise.all([
          getItem(ПОКУПКИ_СТАРІ).then(x => x || {}).catch(() => ({})),
          hgetall(ПОКУПКИ).catch(() => ({}))
        ]);
        let мітка = {};
        try { if (нові[id]) мітка = JSON.parse(нові[id]) || {}; } catch (e) {}
        if (!нові[id] && старі[id] && typeof старі[id] === 'object') мітка = { ...старі[id] };
        const сирий = (await range(LIST, 0, 4999)).find(l => l.id === id);
        const lead = сирий && зПравкою(сирий, (await усіПравки())[id]);
        if (!lead) purchase = { error: 'заявку не знайдено' };
        else if (!(Number(lead.total) > 0)) purchase = { error: 'у заявки немає суми' };
        else {
          purchase = {};
          if (мітка.meta) purchase.meta = 'вже було відправлено';
          else if (!metaReady()) purchase.meta = 'немає ключів META_PIXEL_ID / META_CAPI_TOKEN';
          else {
            const r = await capi('Purchase', {
              eventId: 'purch-' + lead.id,
              value: lead.total,
              phone: lead.phone,
              fbp: lead.meta && lead.meta.fbp,
              fbc: lead.meta && lead.meta.fbc
            });
            if (r.sent) { мітка.meta = new Date().toISOString(); purchase.meta = 'ok'; }
            else purchase.meta = r.reason;
          }
          if (мітка.ga) purchase.ga = 'вже було відправлено';
          else if (!ga4Ready()) purchase.ga = 'немає ключа GA4_API_SECRET';
          else {
            const r = await ga4Purchase(lead);
            if (r.sent) { мітка.ga = new Date().toISOString(); purchase.ga = 'ok'; }
            else purchase.ga = r.reason;
          }
          if (мітка.meta || мітка.ga) await hset(ПОКУПКИ, id, мітка);
        }
      } catch (e) { purchase = { error: String(e.message || e) };   }
      try { await del('purch-lock:' + id); } catch (e) {}
    }

    return res.status(200).json({ ok: true, purchase });
  }

  if (req.method === 'DELETE') {

    const id = String(req.query.id || '').slice(0, 40);
    if (!id) return res.status(400).json({ error: 'Потрібен id' });
    const ok = await removeById(LIST, id);

    if (ok) { try { await hdel(СТАТУСИ, id); await hdel(ПОКУПКИ, id); await hdel(ПРАВКИ, id); } catch (e) {} }
    return res.status(ok ? 200 : 404).json({ ok });
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ error: 'Метод не підтримується' });
}
