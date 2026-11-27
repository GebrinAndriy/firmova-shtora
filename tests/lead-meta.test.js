import assert from 'node:assert/strict';
import { test } from 'node:test';

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.TELEGRAM_BOT_TOKEN;
process.env.META_PIXEL_ID = '1234567890';
process.env.META_CAPI_TOKEN = 'test-token';

const sentToMeta = [];
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('https://graph.facebook.com/')) {
    sentToMeta.push(...JSON.parse(options.body).data);
    return Response.json({ events_received: 1 });
  }
  throw new Error('unexpected request to ' + url);
};

const { default: handleLead } = await import('../api/lead.js');

async function submit(body) {
  const res = { status(c) { this.code = c; return this; }, json(d) { this.data = d; return this; }, setHeader() {} };
  await handleLead({ method: 'POST', headers: { 'user-agent': 'test' }, body }, res);
  return res;
}

test('the server sends a discount hold to Meta as Lead and PriceHold with one event ID', async () => {
  sentToMeta.length = 0;
  const r = await submit({ name: 'Тест', phone: '0990000001', rid: 'hold-1', hold: 7, total: 600,
                           meta: { event_id: 'ev-hold', event_name: 'PriceHold' } });
  assert.equal(r.code, 200, JSON.stringify(r.data));
  assert.deepEqual(sentToMeta.map(e => e.event_name).sort(), ['Lead', 'PriceHold']);
  assert.ok(sentToMeta.every(e => e.event_id === 'ev-hold'));
  assert.equal(sentToMeta.find(e => e.event_name === 'Lead').custom_data.lead_type, 'hold');
  assert.equal(sentToMeta.find(e => e.event_name === 'Lead').custom_data.value, 600);
});

test('an order goes to Meta as one Lead', async () => {
  sentToMeta.length = 0;
  const r = await submit({ name: 'Тест', phone: '0990000002', rid: 'order-1', total: 900,
                           meta: { event_id: 'ev-order', event_name: 'Lead' } });
  assert.equal(r.code, 200, JSON.stringify(r.data));
  assert.deepEqual(sentToMeta.map(e => [e.event_name, e.event_id, e.custom_data.lead_type]), [['Lead', 'ev-order', 'order']]);
});
