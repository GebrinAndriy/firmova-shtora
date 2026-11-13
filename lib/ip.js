export function clientIp(req) {
  const real = req.headers['x-real-ip'];
  if (real) {
    const v = String(Array.isArray(real) ? real[0] : real).trim();
    if (v) return v;
  }
  const fwd = req.headers['x-forwarded-for'];
  const list = String(Array.isArray(fwd) ? fwd[0] : (fwd || ''))
    .split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list[list.length - 1] : 'local';
}
