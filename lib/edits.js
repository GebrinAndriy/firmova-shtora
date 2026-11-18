import { hgetall, hset } from './store.js';

export const ПРАВКИ = 'lead-edit:h';

const рядок = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const текст = (v, max) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').trim().slice(0, max);
const см = v => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n <= 1000 ? n : null;
};
const гроші = v => {
  if (v == null || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 10000000 ? n : null;
};

export async function усіПравки() {
  const raw = await hgetall(ПРАВКИ).catch(() => ({}));
  const out = {};
  for (const [id, v] of Object.entries(raw)) {
    try { const п = JSON.parse(v); if (п && typeof п === 'object') out[id] = п; } catch (e) {}
  }
  return out;
}

export function зПравкою(lead, п) {
  if (!lead || !п) return lead;
  const out = { ...lead };
  for (const k of ['name', 'phone', 'delivery', 'windows', 'total', 'individual']) {
    if (п[k] !== undefined) out[k] = п[k];
  }
  out.comment = п.comment || '';
  out.edited = { at: п.at, by: п.by };
  return out;
}

export function перевіритиПравку(body, lead) {
  const name = рядок(body.name, 80);
  const phone = рядок(body.phone, 24).replace(/[\s()-]/g, '');
  if (name.length < 2) return { error: 'Вкажіть імʼя та прізвище' };
  if (!/^(\+?38)?0\d{9}$/.test(phone)) return { error: 'Вкажіть коректний номер телефону' };

  const п = { name, phone, comment: текст(body.comment, 2000) };
  if (body.delivery !== undefined) п.delivery = рядок(body.delivery, 200);

  if (Array.isArray(body.windows)) {
    const windows = [];
    for (const [i, w] of body.windows.slice(0, 30).entries()) {
      if (!w || typeof w !== 'object') continue;
      const fabricW = см(w.fabricW), fabricH = см(w.fabricH);
      if (!fabricW || !fabricH) return { error: `Штора ${i + 1}: вкажіть ширину й висоту тканини` };
      const fabric = рядок(w.fabric, 80);
      if (!fabric) return { error: `Штора ${i + 1}: оберіть тканину` };
      windows.push({
        window: windows.length + 1,
        line: рядок(w.line, 60),
        fabric,
        fabricW, fabricH,
        width: см(w.width) || fabricW,
        height: см(w.height) || fabricH,
        price: гроші(w.price),
        blinds: []
      });
    }
    if (!windows.length && (lead.windows || []).length) return { error: 'У заявці має лишитися хоча б одна штора' };
    п.windows = windows;
    if (windows.length) {
      п.individual = windows.some(w => w.price == null);
      п.total = п.individual ? null : windows.reduce((s, w) => s + w.price, 0);
    }
  }
  if (!п.windows || !п.windows.length) {
    if (body.total !== undefined) {
      п.total = гроші(body.total);
      п.individual = false;
    }
  }
  return { правка: п };
}

export async function зберегтиПравку(id, п) {
  await hset(ПРАВКИ, id, п);
}
