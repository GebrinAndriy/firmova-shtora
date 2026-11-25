import assert from 'node:assert/strict';
import { test } from 'node:test';

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
process.env.ADMIN_PASSWORD_HASH = 'test-admin';
process.env.MANAGER_PASSWORD_HASH = 'test-manager';
process.env.ADMIN_SESSION_SECRET = 'test-secret';

const { makeCookie } = await import('../lib/auth.js');
const { push, hset } = await import('../lib/store.js');
const { default: funnel, деньКиєва } = await import('../api/funnel.js');

async function call({ method = 'GET', query = {}, body, ua = 'Mozilla/5.0 (iPhone)', ip = '10.0.0.1', auth = false } = {}) {
  const headers = { 'user-agent': ua, 'x-forwarded-for': ip };
  if (auth) headers.cookie = (await makeCookie('admin')).split(';')[0];
  const res = {
    code: 200, data: null, headers: {},
    status(c) { this.code = c; return this; },
    json(d) { this.data = d; return this; },
    end() { return this; },
    setHeader(k, v) { this.headers[k] = v; }
  };
  await funnel({ method, query, body, headers }, res);
  return res;
}

const сьогодні = () => деньКиєва(new Date());

test('steps are counted per source; bots and junk are not', async () => {
  for (const s of ['visit', 'visit', 'calc', 'price']) assert.equal((await call({ method: 'POST', body: JSON.stringify({ s, src: 'ads' }) })).code, 204);
  await call({ method: 'POST', body: { s: 'visit', src: 'other' } });
  await call({ method: 'POST', body: { s: 'visit', src: 'ads' }, ua: 'facebookexternalhit/1.1' });
  assert.equal((await call({ method: 'POST', body: { s: 'hack', src: 'ads' } })).code, 400);
  assert.equal((await call({ method: 'POST', body: 'not json' })).code, 400);

  const r = await call({ query: { days: '1' }, auth: true });
  const day = r.data.days.at(-1);
  assert.equal(day.day, сьогодні());
  assert.equal(day.ads.visit, 2);
  assert.equal(day.ads.calc, 1);
  assert.equal(day.ads.price, 1);
  assert.equal(day.other.visit, 1);
  assert.equal(деньКиєва(new Date(r.data.since)), сьогодні(), 'the start moment is recorded');
});

test('leads and payments come from the lead list, split by ad source', async () => {
  const at = new Date().toISOString();
  await push('leads', { id: 'f-1', at, source: 'Квіз-калькулятор', total: 900, utm: { fbclid: 'x' } });
  await push('leads', { id: 'f-2', at, source: 'Квіз-калькулятор', total: 500, utm: {} });
  await push('leads', { id: 'f-3', at, source: 'Чат', total: 700, utm: { fbclid: 'y' } });
  await hset('lead-status:h', 'f-1', 'оплачено');
  const r = await call({ query: { days: '7' }, auth: true });
  const day = r.data.days.at(-1);
  assert.equal(r.data.days.length, 7);
  assert.deepEqual([day.ads.lead, day.ads.paid, day.ads.paidSum], [1, 1, 900]);
  assert.deepEqual([day.other.lead, day.other.paid], [1, 0]);
  assert.deepEqual(r.data.paidList.map(x => [x.id, x.total, x.src, x.from]), [['f-1', 900, 'ads', 'калькулятор']]);
});

test('leads made before the counter started are left out', async () => {
  const since = (await call({ query: { days: '1' }, auth: true })).data.since;
  const before = new Date(Date.parse(since) - 1000).toISOString();
  await push('leads', { id: 'f-old', at: before, source: 'Квіз-калькулятор', total: 1910, utm: {} });
  await hset('lead-status:h', 'f-old', 'оплачено');
  const r = await call({ query: { days: '90' }, auth: true });
  const day = r.data.days.at(-1);
  assert.equal(day.other.paid, 0, 'the funnel step leaves it out');
  assert.ok(r.data.paidList.some(x => x.id === 'f-old' && x.total === 1910), 'the paid list still shows it');
});

test('the report needs a login; a flood from one address stops counting', async () => {
  assert.equal((await call({ query: {} })).code, 401);
  for (let i = 0; i < 45; i++) await call({ method: 'POST', body: { s: 'mode', src: 'other' }, ip: '10.9.9.9' });
  const day = (await call({ query: { days: '1' }, auth: true })).data.days.at(-1);
  assert.equal(day.other.mode, 40);
});
