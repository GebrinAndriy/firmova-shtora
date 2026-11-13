import { createHash } from 'node:crypto';

const PIXEL = () => process.env.META_PIXEL_ID;
const TOKEN = () => process.env.META_CAPI_TOKEN;

export const metaReady = () => Boolean(PIXEL() && TOKEN());

const sha = v => createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');

function нормТел(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10 && d[0] === '0') d = '38' + d;
  else if (d.length === 9) d = '380' + d;
  return d;
}

export async function capi(eventName, o = {}) {
  if (!metaReady()) return { sent: false, reason: 'не налаштовано' };

  const user = {};
  const тел = нормТел(o.phone);
  if (тел) user.ph = [sha(тел)];
  if (o.fbp) user.fbp = o.fbp;
  if (o.fbc) user.fbc = o.fbc;
  if (o.ip)  user.client_ip_address = o.ip;
  if (o.ua)  user.client_user_agent = o.ua;

  const custom = { product_line: 'roller' };
  if (o.value) { custom.value = Math.round(Number(o.value) || 0); custom.currency = 'UAH'; }

  const подія = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    user_data: user,
    custom_data: custom
  };
  if (o.eventId)   подія.event_id = o.eventId;
  if (o.sourceUrl) подія.event_source_url = o.sourceUrl;

  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${PIXEL()}/events?access_token=${encodeURIComponent(TOKEN())}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [подія] }) }
    );
    if (r.ok) return { sent: true, reason: null };

    let msg = '';
    try { const j = await r.json(); msg = (j && j.error && j.error.message) || ''; } catch (e) {}
    return { sent: false, reason: 'meta ' + r.status + (msg ? ': ' + msg.slice(0, 160) : '') };
  } catch (e) {
    return { sent: false, reason: String(e.message || e) };
  }
}
