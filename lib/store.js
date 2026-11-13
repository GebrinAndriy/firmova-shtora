const URL_  = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const isPersistent = Boolean(URL_ && TOKEN);

async function redis(command) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!r.ok) throw new Error(`Сховище відповіло ${r.status}`);
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

const mem = { lists: new Map(), keys: new Map(), sets: new Map() };

export async function push(list, value) {
  const raw = JSON.stringify(value);
  if (isPersistent) {
    await redis(['LPUSH', list, raw]);
    await redis(['LTRIM', list, '0', '4999']);
    return;
  }
  const arr = mem.lists.get(list) || [];
  arr.unshift(raw);
  mem.lists.set(list, arr.slice(0, 5000));
}

const saveWithReceipt = `
local marker = redis.call('GET', KEYS[2])
if marker then
  if redis.call('GET', KEYS[3]) == marker then
    return {marker, 1}
  end
  for _, raw in ipairs(redis.call('LRANGE', KEYS[1], 0, -1)) do
    local ok, entry = pcall(cjson.decode, raw)
    if ok and type(entry) == 'table' and entry.id == marker then
      return {marker, 1}
    end
  end
end
if ARGV[1] == '' then return {} end

redis.call('MSET', KEYS[2], ARGV[2], KEYS[3], ARGV[2])
redis.call('EXPIRE', KEYS[2], ARGV[3])
redis.call('EXPIRE', KEYS[3], ARGV[3])
local pushed = redis.pcall('LPUSH', KEYS[1], ARGV[1])
if type(pushed) == 'table' and pushed.err then
  redis.call('DEL', KEYS[2], KEYS[3])
  return pushed
end
redis.call('LTRIM', KEYS[1], 0, 4999)
return {ARGV[2], 0}
`;

export async function pushWithReceipt(list, rid, value, ttl) {
  const key = 'lead:rid:' + rid;
  if (isPersistent) {
    try {
      const [id, duplicate] = await redis([
        'EVAL', saveWithReceipt, '3', list, key, 'lead:rid:saved:' + rid,
        value ? JSON.stringify(value) : '', value?.id || '', String(ttl)
      ]);
      return id ? { id, duplicate: duplicate === 1 } : null;
    } catch (e) {
      if (!/unknown command|script|lua|cjson|not supported|not allowed|disabled/i.test(e?.message || '')) throw e;
      console.error('pushWithReceipt: EVAL rejected, using plain commands', e.message);
    }
    const marker = await redis(['GET', key]);
    if (marker) return { id: marker, duplicate: true };
    if (!value) return null;
    if ((await redis(['SET', key, value.id, 'NX', 'EX', String(ttl)])) !== 'OK') {
      return { id: (await redis(['GET', key])) || value.id, duplicate: true };
    }
    try {
      await push(list, value);
    } catch (e) {
      await redis(['DEL', key]).catch(() => {});
      throw e;
    }
    return { id: value.id, duplicate: false };
  }

  const marker = mem.keys.get(key);
  if (marker?.until > Date.now()) return { id: marker.id, duplicate: true };
  if (!value) return null;

  const entries = mem.lists.get(list) || [];
  entries.unshift(JSON.stringify(value));
  mem.lists.set(list, entries.slice(0, 5000));
  mem.keys.set(key, { id: value.id, until: Date.now() + ttl * 1000 });
  return { id: value.id, duplicate: false };
}

export async function range(list, from = 0, to = 199) {
  const raw = isPersistent
    ? await redis(['LRANGE', list, String(from), String(to)])
    : (mem.lists.get(list) || []).slice(from, to + 1);
  return (raw || []).map(x => {
    try { return JSON.parse(x); } catch { return null; }
  }).filter(Boolean);
}

export async function count(list) {
  if (isPersistent) return Number(await redis(['LLEN', list])) || 0;
  return (mem.lists.get(list) || []).length;
}

export async function setItem(key, value, ttlSeconds) {
  const raw = JSON.stringify(value);
  if (isPersistent) {
    await redis(ttlSeconds ? ['SET', key, raw, 'EX', String(ttlSeconds)] : ['SET', key, raw]);
    return;
  }
  mem.keys.set(key, raw);
}

export async function setOnce(key, value, ttlSeconds) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (isPersistent) {
    const r = await redis(['SET', key, raw, 'NX', 'EX', String(ttlSeconds)]);
    return r === 'OK';
  }
  if (mem.keys.has(key)) return false;
  mem.keys.set(key, raw);
  return true;
}
export async function getRaw(key) {
  return isPersistent ? await redis(['GET', key]) : (mem.keys.get(key) ?? null);
}

export async function hset(key, field, value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (isPersistent) { await redis(['HSET', key, String(field), raw]); return; }
  const h = mem.keys.get('hs:' + key) || {};
  h[field] = raw; mem.keys.set('hs:' + key, h);
}
export async function hdel(key, field) {
  if (isPersistent) { await redis(['HDEL', key, String(field)]); return; }
  const h = mem.keys.get('hs:' + key); if (h) delete h[field];
}

export async function hgetall(key) {
  if (isPersistent) {
    const flat = await redis(['HGETALL', key]) || [];
    const out = {};
    if (Array.isArray(flat)) for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
    else if (flat && typeof flat === 'object') Object.assign(out, flat);
    return out;
  }
  return { ...(mem.keys.get('hs:' + key) || {}) };
}

export async function getItem(key) {
  const raw = isPersistent ? await redis(['GET', key]) : mem.keys.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function removeById(list, id) {
  const want = String(id);
  const збіг = raw => { try { return JSON.parse(raw).id === want; } catch { return false; } };
  if (isPersistent) {
    const items = await redis(['LRANGE', list, '0', '4999']);
    const hit = (items || []).find(збіг);
    if (!hit) return false;
    const removed = Number(await redis(['LREM', list, '1', hit])) || 0;
    return removed > 0;
  }
  const arr = mem.lists.get(list) || [];
  const i = arr.findIndex(збіг);
  if (i < 0) return false;
  arr.splice(i, 1);
  mem.lists.set(list, arr);
  return true;
}

export async function getMany(keys) {
  if (!keys.length) return [];
  const raw = isPersistent
    ? await redis(['MGET', ...keys])
    : keys.map(k => mem.keys.get(k));
  return (raw || []).map(x => {
    if (!x) return null;
    try { return JSON.parse(x); } catch { return null; }
  });
}

export async function sadd(key, member) {
  if (isPersistent) { await redis(['SADD', key, String(member)]); return; }
  const s = mem.sets.get(key) || new Set();
  s.add(String(member)); mem.sets.set(key, s);
}
export async function srem(key, member) {
  if (isPersistent) { await redis(['SREM', key, String(member)]); return; }
  const s = mem.sets.get(key); if (s) s.delete(String(member));
}
export async function smembers(key) {
  if (isPersistent) return (await redis(['SMEMBERS', key])) || [];
  return [...(mem.sets.get(key) || [])];
}

export async function hincr(key, field, by = 1) {
  if (isPersistent) return Number(await redis(['HINCRBY', key, field, String(by)])) || 0;
  const h = mem.keys.get('h:' + key) || {};
  h[field] = (h[field] || 0) + by;
  mem.keys.set('h:' + key, h);
  return h[field];
}

export async function hall(key) {
  if (isPersistent) {
    const flat = await redis(['HGETALL', key]) || [];
    const out = {};

    if (Array.isArray(flat)) {
      for (let i = 0; i < flat.length; i += 2) out[flat[i]] = Number(flat[i + 1]) || 0;
    } else if (flat && typeof flat === 'object') {
      for (const k of Object.keys(flat)) out[k] = Number(flat[k]) || 0;
    }
    return out;
  }
  return { ...(mem.keys.get('h:' + key) || {}) };
}

export async function getCount(key) {
  if (isPersistent) return Number(await redis(['GET', key])) || 0;
  const now = Date.now();
  const cur = mem.keys.get('c:' + key);
  return cur && cur.until > now ? cur.n : 0;
}

export async function del(key) {
  if (isPersistent) { await redis(['DEL', key]); return; }
  mem.keys.delete('c:' + key);
  mem.keys.delete(key);
}

export async function bump(key, ttlSeconds) {
  if (isPersistent) {

    await redis(['SET', key, '0', 'EX', String(ttlSeconds), 'NX']);
    const n = Number(await redis(['INCR', key]));
    if (!Number.isFinite(n)) throw new Error('лічильник зіпсований');
    return n;
  }
  const now = Date.now();
  const cur = mem.keys.get('c:' + key);
  const rec = cur && cur.until > now ? cur : { n: 0, until: now + ttlSeconds * 1000 };
  rec.n += 1;
  mem.keys.set('c:' + key, rec);
  return rec.n;
}
