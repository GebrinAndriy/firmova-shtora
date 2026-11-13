const NP = 'https://api.novaposhta.ua/v2.0/json/';
const clean = v => String(v == null ? '' : v).trim().slice(0, 100);

async function call(key, model, method, props) {
  const r = await fetch(NP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: key, modelName: model, calledMethod: method, methodProperties: props || {} })
  });
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Тільки GET' });
  }
  const key = process.env.NOVAPOSHTA_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: 'no-key', items: [] });

  const type = clean(req.query.type);
  const q = clean(req.query.q);
  const ref = clean(req.query.ref);

  try {
    if (type === 'cities') {
      if (q.length < 2) return res.status(200).json({ ok: true, items: [] });
      const d = await call(key, 'Address', 'searchSettlements', { CityName: q, Limit: '15' });
      const addrs = (d.data && d.data[0] && d.data[0].Addresses) || [];
      const items = addrs.map(a => ({ name: a.Present, ref: a.Ref })).filter(x => x.name && x.ref);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.status(200).json({ ok: true, items });
    }
    if (type === 'warehouses') {
      if (!ref) return res.status(200).json({ ok: true, items: [] });
      const d = await call(key, 'Address', 'getWarehouses', { SettlementRef: ref, FindByString: q, Limit: '50' });
      const items = (d.data || []).map(w => ({ name: w.Description })).filter(x => x.name);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.status(200).json({ ok: true, items });
    }
    return res.status(400).json({ error: 'Невідомий тип запиту' });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'np-error', items: [] });
  }
}
