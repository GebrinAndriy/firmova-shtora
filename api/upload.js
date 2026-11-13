import { guard } from '../lib/auth.js';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export const config = { api: { bodyParser: false } };

const MAX = 6 * 1024 * 1024;
const TYPES = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/avif': 'avif'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > MAX) { reject(new Error('too-big')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const slug = s => String(s || 'photo')
  .toLowerCase()
  .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 40) || 'photo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Тільки POST' });
  }
  if (!(await guard(req, res, 'upload'))) return;

  if (!TOKEN) {
    return res.status(503).json({
      error: 'Сховище зображень не підключене. Створіть Blob-сховище у Vercel ' +
             '(Storage → Blob) і додайте змінну BLOB_READ_WRITE_TOKEN.'
    });
  }

  const type = (req.headers['content-type'] || '').split(';')[0].trim();
  const ext = TYPES[type];
  if (!ext) {
    return res.status(415).json({ error: 'Підтримуються JPG, PNG, WebP і AVIF' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return res.status(413).json({ error: 'Файл більший за 6 МБ' });
  }
  if (!body.length) return res.status(400).json({ error: 'Порожній файл' });

  const name = slug(req.query.name) + '-' + Date.now().toString(36) + '.' + ext;

  try {
    const r = await fetch('https://blob.vercel-storage.com/' + encodeURIComponent(name), {
      method: 'PUT',
      headers: {
        authorization: 'Bearer ' + TOKEN,
        'x-api-version': '7',
        'x-content-type': type,
        'x-add-random-suffix': '1',
        'x-cache-control-max-age': '31536000'
      },
      body
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: (data && data.error && data.error.message) || 'Сховище відхилило файл' });
    }
    return res.status(200).json({ ok: true, url: data.url, size: body.length });
  } catch (e) {
    return res.status(502).json({ error: 'Не вдалося завантажити: ' + (e.message || e) });
  }
}
