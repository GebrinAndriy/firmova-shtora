import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/kviz.js', import.meta.url), 'utf8');

function code(start, end) {
  const offset = source.indexOf(start);
  assert.notEqual(offset, -1, start);
  const boundary = source.indexOf(end, offset + start.length);
  assert.notEqual(boundary, -1, end);
  return source.slice(offset, boundary);
}

function checkout(mode = 'order', overrides = {}) {
  const fields = Object.fromEntries(Object.entries({
    Name: 'Тест', Phone: '0990000000', City: 'Львів', Branch: '1', Days: '3', ...overrides
  }).map(([name, value]) => ['#kv' + name, { value, focus() {} }]));
  const btn = { disabled: false };
  const form = {};
  const events = [];
  const errors = [];
  const thanks = [];
  const sent = [];
  const analytics = [];
  const window = {};
  const context = {
    $: selector => ({ '#kvSubmit': btn, '#kvForm': form }[selector] || fields[selector] || { style: {} }),
    cart: [{ line: 'roller' }], ckMode: mode, payWay: 'full', sending: false, надіслано: false,
    newRid: () => 'test-rid',
    window, cartSum: () => 501,
    localStorage: { getItem: () => context.consent },
    consent: 'all', requestIds: new Map(), metaIds: () => ({}),
    track: (...args) => events.push(args),
    send: async payload => {
      sent.push({ payload, rid: payload.rid });
      if (context.changeAfterSend) context.changeAfterSend();
      if (context.response instanceof Error) throw context.response;
      return context.response;
    },
    submitting: (_, on) => { btn.disabled = on; },
    sendFail: (_, err) => errors.push(err),
    afterSend: hold => thanks.push(hold),
    response: null
  };
  runInNewContext(code('function clarityEvent', 'const clamp = '), context);
  runInNewContext(code("$('#kvForm').onsubmit = ", 'function afterSend'), context);
  return { context, btn, window, fields, events, errors, thanks, sent, analytics, async submit() {
    form.onsubmit({ preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
  } };
}

test('HTTP 200 with incomplete confirmation keeps the form open and preserves the request ID', async () => {
  const page = checkout();
  for (const reply of [null, { ok: true, id: 'saved-id' }, { ok: true, stored: true, id: '' }]) {
    page.context.response = reply;
    await page.submit();
    assert.equal(page.btn.disabled, false);
  }
  assert.equal(page.errors.length, 3);
  assert.equal(page.thanks.length, 0);
  assert.equal(page.events.length, 0);
  page.context.response = { ok: true, stored: true, id: 'saved-id', duplicate: true };
  await page.submit();
  assert.equal(new Set(page.sent.map(x => x.rid)).size, 1);
  assert.deepEqual(page.thanks, [false]);
  assert.equal(page.events[0][0], 'kviz_submit');
  assert.equal(page.events[0][1].lead_type, 'order');
});

test('discount hold confirms with the existing GA4 lead type', async () => {
  const page = checkout('hold', { City: '', Branch: '' });
  page.context.response = { ok: true, stored: true, id: 'hold-id' };
  await page.submit();
  assert.deepEqual(page.thanks, [true]);
  assert.equal(page.events[0][1].lead_type, 'hold');
  assert.equal(page.sent[0].payload.hold, 3);
});

test('a failed send restores the checkout button and its price markup', () => {
  const label = { textContent: 'Оформити замовлення' };
  const sum = { textContent: '501 ₴', hidden: false };
  const btn = {
    disabled: false, dataset: {}, children: [label, sum],
    get textContent() { return this.children.map(x => x.textContent).join(''); },
    set textContent(text) { this.children = [{ textContent: text }]; }
  };
  runInNewContext(code('function submitting(btn, on)', 'function sendFail(') +
    '\nsubmitting(btn, true); assert.equal(btn.disabled, true); submitting(btn, false);',
    { btn, assert, sending: false, ckMode: 'order', $: sel => sel === '#kvGoLab' ? label : sum });
  assert.equal(btn.disabled, false);
  assert.deepEqual(btn.children, [label, sum]);
  assert.equal(label.textContent, 'Оформити замовлення');
  assert.equal(sum.hidden, false);
});

test('Clarity distinguishes attempt, invalid form, failed send, and saved order', async () => {
  const page = checkout('order', { Phone: '' });
  page.window.clarity = (...args) => page.analytics.push(args);
  await page.submit();
  assert.equal(page.sent.length, 0);
  page.fields['#kvPhone'].value = '0990000000';
  page.context.response = new Error('offline');
  await page.submit();
  page.context.response = { ok: true, stored: true, id: 'private-id', duplicate: true };
  await page.submit();
  await page.submit();
  assert.deepEqual(page.analytics, [
    ['event', 'kviz_order_submit_attempted'], ['event', 'kviz_checkout_invalid'],
    ['event', 'kviz_order_submit_attempted'], ['event', 'kviz_submit_failed'],
    ['event', 'kviz_order_submit_attempted'], ['event', 'kviz_order_saved']
  ]);
});

test('discount hold sends its own success and no order event', async () => {
  const page = checkout('hold');
  page.window.clarity = (...args) => page.analytics.push(args);
  page.context.response = { ok: true, stored: true, id: 'hold-id' };
  await page.submit();
  assert.deepEqual(page.analytics, [['event', 'kviz_discount_hold_saved']]);
});

test('switching to a different request after an ambiguous failure creates a fresh ID', async () => {
  const page = checkout();
  let id = 0;
  page.context.newRid = () => 'request-' + ++id;
  page.context.response = new Error('response lost');
  await page.submit();
  page.context.ckMode = 'hold';
  await page.submit();
  page.context.ckMode = 'order';
  await page.submit();
  assert.notEqual(page.sent[0].rid, page.sent[1].rid);
  assert.equal(page.sent[0].rid, page.sent[2].rid);
});

test('Meta retries use the same event ID as the original request', async () => {
  const page = checkout();
  page.window.__fbReady = true;
  page.context.response = new Error('response lost');
  await page.submit();
  page.context.response = { ok: true, stored: true, id: 'saved-id', duplicate: true };
  await page.submit();
  assert.ok(page.sent[0].payload.meta.event_id);
  assert.equal(page.sent[0].payload.meta.event_id, page.sent[1].payload.meta.event_id);
});

test('a saved order reports the amount and item count submitted with the request', async () => {
  const page = checkout();
  page.context.changeAfterSend = () => {
    page.context.cart.push({ line: 'roller' });
    page.context.cartSum = () => 999;
  };
  page.context.response = { ok: true, stored: true, id: 'saved-id' };
  await page.submit();
  assert.equal(page.events[0][1].value, 501);
  assert.equal(page.events[0][1].windows, 1);
});

test('revoking consent stops Clarity events even while its script is loaded', async () => {
  const page = checkout();
  page.window.clarity = (...args) => page.analytics.push(args);
  page.context.consent = 'necessary';
  page.context.response = { ok: true, stored: true, id: 'saved-id' };
  await page.submit();
  assert.deepEqual(page.thanks, [false]);
  assert.deepEqual(page.analytics, []);
});

test('measurements are recorded after opening and invalid sizes on continuing', () => {
  const events = [];
  const context = {
    STEPS: ['line', 'fabric', 'size'], step: 0, answered: { fabric: true, size: true }, sending: false,
    cur: {}, cart: [], history: { pushState() {}, replaceState() {} }, location: {},
    pushSteps: false, preset: true, loadBlind() {}, fillSizeInputs() {}, $$: () => [],
    syncChecked() {}, syncLimits() {}, setBlindLabels() {}, logicalPos: () => ({ idx: 2, total: 2 }),
    $: () => ({ style: {} }), syncNext() {}, window: { scrollTo() {} },
    stashBlind() {}, checkSize: () => false, finishBlind: () => assert.fail('Invalid size advanced'),
    clarityEvent: name => events.push(name)
  };
  runInNewContext(code('function show(name, fromHistory)', 'function back()') +
    '\nshow("size"); next();', context);
  assert.deepEqual(events, ['kviz_measurement_opened', 'kviz_measurement_invalid']);
});

test('only a visible numerical price is recorded once, after consent', () => {
  const events = [];
  let notify;
  let total = null;
  const price = { innerHTML: '' };
  const buttonPrice = {};
  const observed = [];
  const window = {};
  const context = {
    window, document: { addEventListener() {} }, localStorage: { getItem: () => 'all' },
    $: selector => ({ '#kvNow': price, '#kvGoSum': buttonPrice }[selector] || null),
    cart: [{}], cartSum: () => total, cartOld: () => 800,
    priceTag: () => String(total), money: String,
    IntersectionObserver: class {
      constructor(callback) { notify = callback; }
      observe(element) { observed.push(element); }
      disconnect() {}
    }
  };
  runInNewContext(code('const track = ', 'const clamp = '), context);
  runInNewContext(code('let priceObserver;', 'const курсор = '), context);
  runInNewContext('syncPay()', context);
  assert.equal(notify, undefined);
  total = 501;
  runInNewContext('syncPay()', context);
  assert.equal(notify, undefined);
  window.clarity = (...args) => events.push(args);
  runInNewContext('syncPay()', context);
  assert.ok(observed.includes(buttonPrice));
  notify([{ isIntersecting: false, intersectionRatio: 0 }]);
  assert.deepEqual(events, []);
  notify([{ isIntersecting: true, intersectionRatio: 1 }]);
  notify([{ isIntersecting: true, intersectionRatio: 1 }]);
  assert.deepEqual(events, [['event', 'kviz_price_shown']]);
});
