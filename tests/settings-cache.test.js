import assert from 'node:assert/strict';
import { test } from 'node:test';

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { default: settings } = await import('../api/settings.js');

async function get(query) {
  const res = {
    code: 200, data: null, headers: {},
    status(c) { this.code = c; return this; },
    json(d) { this.data = d; return this; },
    setHeader(k, v) { this.headers[k] = v; }
  };
  await settings({ method: 'GET', query, headers: {} }, res);
  return res;
}

test('visitors get settings from the edge cache, the admin always fresh', async () => {
  const site = await get({});
  assert.equal(site.code, 200);
  assert.match(site.headers['Cache-Control'], /s-maxage=20/);
  assert.match(site.headers['Cache-Control'], /stale-while-revalidate/);

  const admin = await get({ fresh: '1' });
  assert.match(admin.headers['Cache-Control'], /no-store/);
  assert.doesNotMatch(admin.headers['Cache-Control'], /s-maxage/);
});
