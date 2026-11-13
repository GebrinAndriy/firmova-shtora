import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { beforeEach, test } from 'node:test';

process.env.UPSTASH_REDIS_REST_URL = 'https://redis.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.META_CAPI_TOKEN;

const { default: handleLead } = await import('../api/lead.js');
const keys = new Map();
const leads = [];
let failWrite;
let loseResponse;
let redisOperations;

function write(raw) {
  if (failWrite) {
    failWrite = false;
    return false;
  }
  leads.unshift(raw);
  return true;
}

globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://redis.invalid');
  const [op, key, value, ...args] = JSON.parse(options.body);
  redisOperations.push(op);
  let result;
  switch (op) {
    case 'GET': result = keys.get(key) ?? null; break;
    case 'SET':
      result = args.includes('NX') && keys.has(key) ? null : 'OK';
      if (result) keys.set(key, value);
      break;
    case 'INCR':
      result = Number(keys.get(key) ?? 0) + 1;
      keys.set(key, result);
      break;
    case 'LPUSH':
      if (!write(value)) return new Response('{}', { status: 503 });
      result = leads.length;
      break;
    case 'LTRIM': result = 'OK'; break;
    case 'EVAL': {
      assert.equal(Number(value), 3);
      const [list, marker, confirmed, raw, id, ttl] = args;
      assert.equal(list, 'leads');
      assert.match(marker, /^lead:rid:/);
      const existing = keys.get(marker);
      if (existing && leads.some(entry => JSON.parse(entry).id === existing)) {
        result = [existing, 1];
      } else if (!raw) {
        result = [];
      } else {
        assert.equal(Number(ttl), 86400);
        if (!write(raw)) return Response.json({ error: 'simulated write failure' });
        keys.set(marker, id);
        keys.set(confirmed, id);
        result = [id, 0];
        if (loseResponse) {
          loseResponse = false;
          throw new Error('Response lost after Redis committed');
        }
      }
      break;
    }
    default: assert.fail('Unexpected Redis operation: ' + op);
  }
  return Response.json({ result });
};

beforeEach(() => {
  keys.clear();
  leads.length = 0;
  failWrite = false;
  loseResponse = false;
  redisOperations = [];
});

const rid = 'test-request-id';
const body = { name: 'Тест', phone: '0990000000', rid };
async function submit(payload = body) {
  const response = {
    status(status) { this.code = status; return this; },
    json(data) { return { status: this.code, data }; }
  };
  return handleLead({ method: 'POST', headers: {}, body: payload }, response);
}

function assertSaved(response, duplicate = false) {
  assert.equal(response.status, 200);
  assert.equal(response.data.ok, true);
  assert.equal(response.data.stored, true);
  assert.equal(response.data.persistent, true);
  assert.equal(Boolean(response.data.duplicate), duplicate);
  assert.equal(leads.length, 1);
  assert.equal(JSON.parse(leads[0]).id, response.data.id);
}

test('a retry actually writes the lead after a failed write', async () => {
  failWrite = true;
  assert.equal((await submit()).status, 500);
  assert.equal(leads.length, 0);
  assertSaved(await submit());
});

test('a retry returns the committed ID after losing the response', async () => {
  loseResponse = true;
  assert.equal((await submit()).status, 500);
  const id = JSON.parse(leads[0]).id;
  const retry = await submit();
  assertSaved(retry, true);
  assert.equal(retry.data.id, id);
});

test('concurrent identical submissions return one saved lead', async () => {
  const results = await Promise.all([submit(), submit()]);
  assert.deepEqual(results.map(x => Boolean(x.data.duplicate)).sort(), [false, true]);
  results.forEach(x => assertSaved(x, Boolean(x.data.duplicate)));
});

test('a new receipt retains the bare ID understood by the previous API', async () => {
  const saved = await submit();
  assertSaved(saved);
  assert.equal(keys.get('lead:rid:' + rid), saved.data.id);
  assert.equal(keys.get('lead:rid:saved:' + rid), saved.data.id);
});

test('an old marker pointing to a saved lead bypasses the new lead limits', async () => {
  keys.set('lead:rid:' + rid, 'old-id');
  keys.set('lead:tel:990000000:' + new Date().toISOString().slice(0, 10), 6);
  leads.push(JSON.stringify({ id: 'old-id' }));
  assertSaved(await submit(), true);
});

test('an orphaned old marker does not prevent a real save', async () => {
  keys.set('lead:rid:' + rid, 'orphaned-id');
  assertSaved(await submit());
});

test('IP-limited requests do not run a Redis receipt lookup', async () => {
  for (let i = 0; i < 8; i++) await submit({ ...body, name: '' });
  redisOperations.length = 0;
  assert.equal((await submit()).status, 429);
  assert.ok(!redisOperations.includes('EVAL'));
});

test('order and discount hold use the same saved lead contract', async () => {
  assertSaved(await submit({ ...body, kind: 'Замовлення' }));
  const hold = await submit({ ...body, rid: 'test-hold-id', hold: 5, kind: 'Фіксація знижки' });
  assert.equal(hold.status, 200);
  assert.equal(hold.data.stored, true);
  assert.equal(JSON.parse(leads[0]).hold, 5);
  assert.equal(leads.length, 2);
});

test('a submission without a request ID is still saved', async () => {
  assertSaved(await submit({ ...body, rid: undefined }));
});

test('Vercel rejects a write without persistent storage', () => {
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import handleLead from './api/lead.js';
    const res = { status(code) { this.code = code; return this; }, json(data) { console.log(JSON.stringify({status:this.code, data})); } };
    await handleLead({method:'POST',headers:{},body:{name:'Test',phone:'0990000000',rid:'test-no-store'}},res);
  `], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, VERCEL: '1', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' },
    encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stderr);
  const response = JSON.parse(run.stdout);
  assert.equal(response.status, 503);
  assert.equal(response.data.stored, undefined);
});
