import { range, count, getMany, getItem, hall } from '../lib/store.js';
import { guard } from '../lib/auth.js';

const СПИСОК = 'chats';
const НА_СТОРІНЦІ = 20;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Тільки GET' });
  }
  if (!(await guard(req, res, 'chats'))) return;

  const id = String(req.query.id || '').slice(0, 40);
  if (id) {
    const розмова = await getItem('chat:' + id);
    if (!розмова) return res.status(404).json({ error: 'Розмову не знайдено' });
    return res.status(200).json({ chat: розмова });
  }

  const from = Math.max(0, Number(req.query.from) || 0);
  const [номери, всього, лічильники, питання] = await Promise.all([
    range(СПИСОК, from, from + НА_СТОРІНЦІ - 1),
    count(СПИСОК),
    hall('chatstat'),
    hall('chatq')
  ]);

  const розмови = (await getMany(номери.map(x => 'chat:' + x.id)))
    .map((c, i) => {
      if (!c) return null;
      const перше = (c.messages || []).find(m => m.who === 'me');
      const останнє = (c.messages || []).slice().reverse().find(m => m.who === 'me');
      return {
        id: c.id, at: c.at, updated: c.updated,
        turns: c.turns || 0,

        quiz: Boolean(c.quiz || c.escalated),
        page: c.page || '',
        first: перше ? перше.text : '',
        last: останнє ? останнє.text : '',
        msgs: (c.messages || []).length
      };
    })
    .filter(Boolean);

  const топ = Object.entries(питання)
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([text, n]) => ({ text, n }));

  return res.status(200).json({
    chats: розмови,
    total: всього,
    from,
    stats: {
      розмов:      лічильники['розмов'] || 0,
      реплік:      лічильники['реплік'] || 0,
      калькулятор: (Number(лічильники['у калькулятор']) || 0) +
                   (Number(лічильники['передано']) || 0)
    },
    top: топ
  });
}
