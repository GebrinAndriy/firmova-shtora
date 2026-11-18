import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
process.env.ADMIN_PASSWORD_HASH = 'test-admin';
process.env.MANAGER_PASSWORD_HASH = 'test-manager';
process.env.ADMIN_SESSION_SECRET = 'test-secret';

const { makeCookie } = await import('../lib/auth.js');
const { push, removeById, range, hdel } = await import('../lib/store.js');
const { default: leads } = await import('../api/leads.js');
const { default: clients } = await import('../api/clients.js');

const cookie = async role => (await makeCookie(role)).split(';')[0];

async function call(handler, { method = 'GET', query = {}, body, role = 'manager' } = {}) {
  const req = { method, query, body, headers: { cookie: await cookie(role) } };
  const res = {
    code: 200, data: null, headers: {},
    status(c) { this.code = c; return this; },
    json(d) { this.data = d; return this; },
    setHeader(k, v) { this.headers[k] = v; }
  };
  await handler(req, res);
  return res;
}

const lead = () => ({
  id: 'lead-1', at: '2026-11-17T16:40:00.000Z', name: 'Клієнтка', phone: '0501234578',
  source: 'Квіз-калькулятор', kind: 'Замовлення класичної рулонної', delivery: 'Нова Пошта, Полтава, 1',
  total: 865, individual: false,
  windows: [
    { window: 1, line: 'Класична рулонна', fabric: 'Феєрія мокачине', fabricW: 52, fabricH: 150, width: 56, height: 150, price: 453, blinds: [] },
    { window: 2, line: 'Класична рулонна', fabric: 'Феєрія мокачине', fabricW: 41, fabricH: 150, width: 45, height: 150, price: 412, blinds: [] }
  ]
});

const edit = (over = {}) => ({
  name: 'Клієнтка Бондар', phone: '050 123 45 78', comment: 'Передзвонити після 18:00', delivery: 'Нова Пошта, Полтава, 5',
  windows: [
    { line: 'Класична рулонна', fabric: 'Феєрія мокачине', fabricW: 52, fabricH: 150, width: 56, height: 150, price: 453 },
    { line: 'Класична рулонна', fabric: 'Беж льон', fabricW: 108, fabricH: 150, width: 112, height: 150, price: 660 }
  ],
  ...over
});

beforeEach(async () => {
  await hdel('lead-edit:h', 'lead-1');
  for (const l of await range('leads', 0, 100)) await removeById('leads', l.id);
  await push('leads', lead());
});

test('a manager edits a lead; the list shows the edit, the comment and a recomputed total', async () => {
  const r = await call(leads, { method: 'PATCH', body: { id: 'lead-1', was: '', edit: edit() } });
  assert.equal(r.code, 200, JSON.stringify(r.data));
  assert.equal(r.data.lead.name, 'Клієнтка Бондар');
  assert.equal(r.data.lead.phone, '0501234578');
  assert.equal(r.data.lead.total, 1113);
  assert.equal(r.data.lead.edited.by, 'менеджер');

  const list = await call(leads, { query: { from: 0, size: 50 } });
  const got = list.data.items.find(l => l.id === 'lead-1');
  assert.equal(got.comment, 'Передзвонити після 18:00');
  assert.equal(got.windows[1].fabric, 'Беж льон');
  assert.equal(got.delivery, 'Нова Пошта, Полтава, 5');
  assert.equal(got.source, 'Квіз-калькулятор', 'fields that were not edited stay');
});

test('an empty price makes the lead individual', async () => {
  const w = edit().windows; w[1].price = null;
  const r = await call(leads, { method: 'PATCH', body: { id: 'lead-1', was: '', edit: edit({ windows: w }) } });
  assert.equal(r.data.lead.individual, true);
  assert.equal(r.data.lead.total, null);
});

test('a stale edit is rejected instead of overwriting another manager', async () => {
  const first = await call(leads, { method: 'PATCH', body: { id: 'lead-1', was: '', edit: edit() } });
  const stale = await call(leads, { method: 'PATCH', body: { id: 'lead-1', was: '', edit: edit({ comment: 'інше' }) } });
  assert.equal(stale.code, 409);
  const next = await call(leads, { method: 'PATCH', body: { id: 'lead-1', was: first.data.lead.edited.at, edit: edit({ comment: 'інше' }) } });
  assert.equal(next.code, 200);
  assert.equal(next.data.lead.comment, 'інше');
});

test('bad input is refused with a clear message', async () => {
  for (const [over, msg] of [
    [{ phone: '123' }, /телефон/],
    [{ name: 'А' }, /імʼя/],
    [{ windows: [{ fabric: 'Беж', fabricW: 0, fabricH: 150 }] }, /ширину/],
    [{ windows: [] }, /хоча б одна/]
  ]) {
    const r = await call(leads, { method: 'PATCH', body: { id: 'lead-1', was: '', edit: edit(over) } });
    assert.equal(r.code, 400);
    assert.match(r.data.error, msg);
  }
  const missing = await call(leads, { method: 'PATCH', body: { id: 'nope', was: '', edit: edit() } });
  assert.equal(missing.code, 404);
});

test('the client base uses the edited name and total; deleting drops the edit', async () => {
  await call(leads, { method: 'PATCH', body: { id: 'lead-1', was: '', edit: edit() } });
  const c = await call(clients, {});
  const к = c.data.clients.find(x => x.phone === '0501234578');
  assert.equal(к.name, 'Клієнтка Бондар');
  assert.equal(к.total, 1113);

  await call(leads, { method: 'DELETE', query: { id: 'lead-1' } });
  await push('leads', lead());
  const list = await call(leads, { query: {} });
  assert.equal(list.data.items[0].comment, undefined);
  assert.equal(list.data.items[0].name, 'Клієнтка');
});
