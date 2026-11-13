

(function () {
'use strict';

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const gate = $('#gate');
const app  = $('#app');

let лінія = (() => { try { return localStorage.getItem('fsh_admin_line') || 'roller'; }
                     catch (e) { return 'roller'; } })();
const ЛІНІЇ = {
  roller:   { назва: 'Класична рулонна', ключі: ['rulonni.', 'kviz.'], поле: 'roller' },
  daynight: { назва: 'Фірмова штора день-ніч', ключі: ['index.'],      поле: 'price'  }
};
const спільні = ['blog.', 'umovy.'];
const моє = ключ => {
  const л = ЛІНІЇ[лінія];
  return л.ключі.some(п => ключ.startsWith(п)) || спільні.some(п => ключ.startsWith(п));
};

let роль = null;
const ДОСТУП = {
  admin:   ['leads', 'clients', 'chats', 'builder', 'prices', 'fabrics', 'texts', 'photos', 'contacts', 'system'],
  manager: ['leads', 'clients', 'chats']
};
function застосуватиРоль() {
  const можна = ДОСТУП[роль] || ДОСТУП.admin;
  $$('#sideNav [data-tab]').forEach(b => { b.hidden = !можна.includes(b.dataset.tab); });
  const lp = $('#linePick');
  if (lp) lp.hidden = !можна.includes('prices');
  const мітка = $('#roleTag');
  if (мітка) мітка.textContent = роль === 'manager' ? 'менеджер' : 'адміністратор';

  const відкрита = $('#sideNav .on');
  if (відкрита && відкрита.hidden) $('#sideNav [data-tab="leads"]').click();
}

let base = {};
let draft = {};
let dirty = false;

const clone = o => JSON.parse(JSON.stringify(o));

const НЕБЕЗПЕЧНІ_КЛЮЧІ = new Set(['__proto__', 'constructor', 'prototype']);
function deepMerge(target, src) {
  for (const k of Object.keys(src || {})) {
    if (k === 'savedAt' || НЕБЕЗПЕЧНІ_КЛЮЧІ.has(k)) continue;
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object')
      deepMerge(target[k], v);
    else target[k] = v;
  }
  return target;
}

function diff(now, was) {
  const out = {};
  for (const k of Object.keys(now)) {
    if (НЕБЕЗПЕЧНІ_КЛЮЧІ.has(k)) continue;
    const a = now[k], b = was ? was[k] : undefined;
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (a && typeof a === 'object' && !Array.isArray(a) && b && typeof b === 'object' && !Array.isArray(b)) {
      const inner = diff(a, b);
      if (Object.keys(inner).length) out[k] = inner;
    } else {
      out[k] = a;
    }
  }
  return out;
}

async function api(path, options) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  let r;
  try {
    r = await fetch(path, Object.assign(
      { headers: { 'Content-Type': 'application/json' }, signal: ac.signal, cache: 'no-store' },
      options));
  } catch (e) {
    clearTimeout(timer);
    console.error('Запит не пройшов:', path, e);
    throw new Error(e.name === 'AbortError'
      ? 'Сервер не відповів за 12 секунд. Перевірте зв’язок і спробуйте ще раз.'
      : 'Не вдалося звʼязатися з сервером: ' + (e.message || e));
  }
  clearTimeout(timer);

  let data = null, text = '';
  try { text = await r.text(); data = text ? JSON.parse(text) : null; } catch (e) {}
  window.__lastApi = { path, status: r.status, body: text.slice(0, 120) };
  if (!r.ok) {
    console.error('Сервер відповів', r.status, 'на', path, text.slice(0, 200));
    const er = new Error((data && data.error) || ('Сервер відповів ' + r.status));
    er.status = r.status; er.data = data;
    throw er;
  }
  return data;
}

let savedFull = {};
let savedAt = null;

async function putSettings(full) {
  const тіло = (силоміць) => JSON.stringify(Object.assign(diff(full, base),
    { _base: savedAt || '' }, силоміць ? { _force: true } : {}));
  let r;
  try {
    r = await api('/api/settings', { method: 'PUT', body: тіло(false) });
  } catch (err) {
    if (err.status !== 409) throw err;
    const ok = confirm('Налаштування вже змінив хтось інший після того, як ви відкрили адмінку ' +
      '(інша вкладка, інший пристрій чи другий адміністратор).\n\n' +
      'OK — зберегти ваші зміни поверх (його зміни буде втрачено).\n' +
      'Скасувати — нічого не зберігати; оновіть сторінку, щоб побачити його версію.');
    if (!ok) { const e = new Error('Збереження скасовано: налаштування змінив хтось інший. Оновіть сторінку.'); e.cancelled = true; throw e; }
    r = await api('/api/settings', { method: 'PUT', body: тіло(true) });
  }
  savedAt = (r && r.savedAt) || savedAt;
  savedFull = clone(full);
  return r;
}

const loginForm = $('#loginForm');
const loginErr  = $('#loginErr');

async function checkSession() {
  try {
    const s = await api('/api/login');
    if (!s.configured) {
      $('#gateNote').innerHTML =
        'Адмінку ще не налаштовано. Задайте змінні <code>ADMIN_PASSWORD_HASH</code> ' +
        'і <code>ADMIN_SESSION_SECRET</code> у налаштуваннях проєкту.';
      $('#pw').disabled = true;
      $('#loginBtn').disabled = true;
      return;
    }
    if (s.authed) { роль = s.role || 'admin'; start(); }
  } catch (e) {
    $('#gateNote').textContent = 'Сервер недоступний. Панель працює тільки на розгорнутому сайті.';
  }
}

loginForm.onsubmit = async e => {
  e.preventDefault();
  loginErr.classList.remove('on');
  const btn = $('#loginBtn');
  btn.disabled = true;
  btn.textContent = 'Перевіряємо…';
  try {
    const вхід = await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('#pw').value.trim() }) });
    роль = вхід.role || 'admin';
    await start();
  } catch (err) {
    console.error('Вхід не вдався:', err);
    loginErr.textContent = err.message || 'Невідома помилка.';
    loginErr.classList.add('on');

    const d = $('#loginDbg');
    if (d) {
      const a = window.__lastApi;
      d.textContent = a
        ? 'Сервер відповів ' + a.status + ' · довжина пароля: ' + $('#pw').value.trim().length
        : 'Запит не дійшов до сервера · довжина пароля: ' + $('#pw').value.trim().length;
      d.hidden = false;
    }
    $('#pw').select();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Увійти';
  }
};

(function eye(){
  const b = $('#pwEye'), i = $('#pw');
  if(!b || !i) return;
  b.onclick = () => {
    const show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(show));
    b.setAttribute('aria-label', show ? 'Сховати пароль' : 'Показати пароль');
    b.classList.toggle('on', show);
    i.focus();
  };
})();

(function theme(){
  const b = $('#thm');
  if(!b) return;
  const paint = ()=>{
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    b.textContent = dark ? 'Світла тема' : 'Темна тема';
  };
  paint();
  b.onclick = ()=>{
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('fsh_theme', next); } catch(e) {}
    paint();
  };
})();

$('#logout').onclick = async () => {
  if (dirty && !confirm('Є незбережені зміни. Все одно вийти?')) return;
  try { await api('/api/login', { method: 'DELETE' }); } catch (e) {}
  location.reload();
};

async function start() {
  gate.hidden = true;
  app.hidden = false;
  base = clone(typeof CFG !== 'undefined' ? CFG : {});
  draft = clone(base);
  try {
    const saved = await api('/api/settings');
    deepMerge(draft, saved || {});
    savedAt = (saved && saved.savedAt) || null;
  } catch (e) {}
  savedFull = clone(draft);
  try { виправитиОрфографію(); } catch (e) { console.error('орфографія:', e); }

  try { застосуватиРоль(); } catch (e) { console.error('роль:', e); }
  try { renderAll(); } catch (e) { console.error('renderAll:', e); }
  loadLeads(true).then(() => живіЗаявки(true)).catch(e => console.error('loadLeads:', e));
  loadHealth().catch(e => console.error('loadHealth:', e));
}

const ОРФОГРАФІЯ = [

  {"t": "txauto", "p": "kviz", "k": "main[1]>div[1]>div[1]>div[2]>div[1]>form[1]>section[3]>div[1]>span[2]", "from": "Оплата після підтвердження замовлення\n100% передоплата або 50% передоплати, решта 50% — при отриманні. Спосіб оплати узгодимо з вами телефоном.", "to": null},

  {"t": "texts", "k": "rulonni.top.1", "from": "Рулонні штори\nДопоможемо правильно заміряти, усе перевіримо й виготовимо", "to": "Рулонні штори\n*під ваш розмір*"},
  {"t": "texts", "k": "rulonni.top.2", "from": "Виготовимо з європейських комплектуючих", "to": "Допоможемо правильно заміряти, усе перевіримо й виготовимо з європейських комплектуючих."},
    {
      "t": "texts",
      "k": "kviz.page.11",
      "from": "Натисніть на фото , щоб побачити тканину ближче та тисніть \"Далі\"",
      "to": "Натисніть на фото, щоб побачити тканину ближче, і тисніть «Далі»"
    },
    {
      "t": "texts",
      "k": "kviz.page.33",
      "from": "Інструкція із заміру \"ФОТО\"",
      "to": "Інструкція із заміру «ФОТО»"
    },
    {
      "t": "texts",
      "k": "rulonni.dostavka.4",
      "from": "Консультант звірить з Вами розміри й надішлить реквізити: для часткової чи повної предоплати на рахунок ФОП (таким чином ви застраховані від шахраїв)",
      "to": "Консультант звірить із вами розміри й надішле реквізити для часткової чи повної передоплати на рахунок ФОП — так ви застраховані від шахраїв."
    },
    {
      "t": "texts",
      "k": "rulonni.dostavka.6",
      "from": "Виріб їде у жорсткій упаковці. Номер накладної надсилаємо того ж дня, якщо щось пропустите ми передзвонимо, щоб ви не сплачували за збереження на пошті.",
      "to": "Виріб їде в жорсткій упаковці. Номер накладної надсилаємо того ж дня. Якщо щось пропустите — ми передзвонимо, щоб ви не платили за зберігання на пошті."
    },
    {
      "t": "texts",
      "k": "rulonni.dostavka.8",
      "from": "Якщо помилка на нашому боці — переробляємо за свій рахунок. Розміри обовʼязково звіримо з Вами перед виготовленням.",
      "to": "Якщо помилка на нашому боці — переробляємо за свій рахунок. Розміри обовʼязково звіримо з вами перед виготовленням."
    },
    {
      "t": "texts",
      "k": "rulonni.faq.2",
      "from": "Так, якщо маєте бажання і хоч трохи вмієте користуватись викруткою. Якщо виникнуть питання при встановленні, наш технолог з радістю допоможемо Вам з встановленням по телефону або відеозвʼязку у вайбер чи телеграм.",
      "to": "Так, якщо маєте бажання й хоч трохи вмієте користуватися викруткою. Якщо під час встановлення виникнуть питання, наш технолог із радістю допоможе вам телефоном або відеозвʼязком у Viber чи Telegram."
    },
    {
      "t": "texts",
      "k": "rulonni.faq.3",
      "from": "Тканини, які представлені вище - захистять вас від сонячного проміння та сторонніх поглядів та залишать кімнату максимально освітленою, щоб Вам не вмикати додаткове світло. \n\n  А якщо Вам потрібне максимальне або повне затемнення - обирайте тканину, внесіть розміри, щоб ми мали змогу прорахувати такі варіанти, а Ви мали змогу порівняти ціни...",
      "to": "Тканини, представлені вище, захистять вас від сонячного проміння й сторонніх поглядів і залишать кімнату максимально світлою — не доведеться вмикати додаткове світло.\n\nА якщо вам потрібне сильне або повне затемнення — оберіть тканину й внесіть розміри: ми прорахуємо такі варіанти, і ви зможете порівняти ціни."
    },
    {
      "t": "texts",
      "k": "rulonni.faq.4",
      "from": "Перед запуском у виробництво консультант звірить розміри разом з Вами. Якщо штора не підійде то ми переробимо за свій рахунок.",
      "to": "Перед запуском у виробництво консультант звірить розміри разом із вами. Якщо штора не підійде, ми переробимо її за свій рахунок."
    },
    {
      "t": "texts",
      "k": "rulonni.faq.5",
      "from": "Протерти вологою серветкою при забрудненні. Прати й знімати полотно не потрібно, воно не збирає пил та не вбирає запахи. Достатньо змотати та розмотати рулон, щоб пил зник з поверхні.",
      "to": "Протріть вологою серветкою при забрудненні. Прати й знімати полотно не потрібно: воно не збирає пил і не вбирає запахів. Досить змотати й розмотати рулон, щоб пил зник із поверхні."
    },
    {
      "t": "texts",
      "k": "rulonni.komplekt.2",
      "from": "Класичні рулонні штори без зайвих доплат. Самостійно заміряйте та встановіть — і не витрачайте гроші на майстра.",
      "to": "Класичні рулонні штори без зайвих доплат. Самостійно заміряйте й установіть — і не витрачайте гроші на майстра."
    },
    {
      "t": "texts",
      "k": "rulonni.komplekt.3",
      "from": "Европейська сертифікована тканина та фурнітура.  Красиві кольори, приємна фактура та захист від яскравого сонця. Просто й затишно для вашого дому.",
      "to": "Європейська сертифікована тканина й фурнітура. Гарні кольори, приємна фактура та захист від яскравого сонця. Просто й затишно для вашого дому."
    },
    {
      "t": "texts",
      "k": "rulonni.komplekt.5",
      "from": "Готова штора, механізм, кріплення, необхідні деталі для встановлення, відео інструкція та онлайн тех підтримка 24/7.\n Нічого зайвого докуповувати не потрібно.",
      "to": "Готова штора, механізм, кріплення, необхідні деталі для встановлення, відеоінструкція та онлайн-техпідтримка 24/7.\nНічого зайвого докуповувати не потрібно."
    },
    {
      "t": "texts",
      "k": "rulonni.pro.2",
      "from": "Кожна штору ми виготовимо чітко по вашим розмірам. Штору отримаєте на пошті разом з усім, що потрібно для монтажу.",
      "to": "Кожну штору ми виготовимо чітко за вашими розмірами. Ви отримаєте її на пошті разом з усім, що потрібно для монтажу."
    },
    {
      "t": "texts",
      "k": "rulonni.top.1",
      "from": "Рулонні штори  Допоможемо правильно заміряти, все перевіримо та виготовимо",
      "to": "Рулонні штори\nДопоможемо правильно заміряти, усе перевіримо й виготовимо"
    },
    {
      "t": "texts",
      "k": "rulonni.top.2",
      "from": "Виготовимо з Европейських складових",
      "to": "Виготовимо з європейських комплектуючих"
    },
    {
      "t": "texts",
      "k": "rulonni.znak.2",
      "from": "Обслуговування, комплектуючі відповідають державним стандартам якості так як виготовлені в Европі. Ви отримуєте виріб, якому можна довіряти на всі 100%.",
      "to": "Обслуговування й комплектуючі відповідають державним стандартам якості, адже комплектуючі виготовлені в Європі. Ви отримуєте виріб, якому можна довіряти на всі 100%."
    },
    {
      "t": "texts",
      "k": "rulonni.zvyazok.2",
      "from": "Оберіть колір, впишіть ширину та висоту та дізнайтесь ціну на своє вікно.",
      "to": "Оберіть колір, впишіть ширину й висоту та дізнайтеся ціну на своє вікно."
    },
    {
      "t": "texts",
      "k": "umovy.dostavka.2",
      "from": "Оплата. Покупець може обрати 100% передоплату або 50% передоплати та 50% післяплатою під час отримання.   Доставка. Новою Поштою по Україні, у відділення або поштомат, якщо це дозволяють габарити виробу. Вартість доставки та комісію за післяплату оплачує покупець за тарифами відповідних служб.  Строк виготовлення. Зазвичай 1–3 робочі дні після підтвердження замовлення та отримання передоплати. У періоди високого навантаження — до 7 робочих днів. Конкретний строк погоджується до оплати.",
      "to": "**Оплата.** Покупець може обрати 100% передоплату або 50% передоплати та 50% післяплатою під час отримання.\n\n**Доставка.** Новою Поштою по Україні, у відділення або поштомат, якщо це дозволяють габарити виробу. Вартість доставки та комісію за післяплату оплачує покупець за тарифами відповідних служб.\n\n**Строк виготовлення.** Зазвичай 1–3 робочі дні після підтвердження замовлення та отримання передоплати. У періоди високого навантаження — до 7 робочих днів. Конкретний строк погоджується до оплати."
    },
    {
      "t": "texts",
      "k": "umovy.oferta.2",
      "from": "Публічна оферта\n\nЦі умови регулюють продаж товарів через сайт «Фірмова Штора».\n\nПродавець: ФОП Миколенко Дмитро Іванович\nРНОКПП: 3173401070\nАдреса: 36023, Україна, м. Полтава, бульвар Щепотьєва, буд. 3-А, кв. 96\nТелефон: +380 95 904 87 45\nEmail: dimetriskis@gmail.com\n\nПеред оформленням замовлення покупець обирає товар, комплектацію, розміри, кількість і спосіб оплати та перевіряє підсумкову вартість.\n\nОформлюючи замовлення, покупець підтверджує ознайомлення з характеристиками товару, ціною та умовами продажу. Продавець і покупець погоджують індивідуальні параметри й умови виконання замовлення до запуску виробництва.\n\nПитання, не врегульовані цими умовами, вирішуються відповідно до законодавства України.",
      "to": "Ці умови регулюють продаж товарів через сайт «Фірмова Штора».\n\nПродавець: ФОП Миколенко Дмитро Іванович\nРНОКПП: 3173401070\nАдреса: 36023, Україна, м. Полтава, бульвар Щепотьєва, буд. 3-А, кв. 96\nТелефон: +380 95 904 87 45\nEmail: dimetriskis@gmail.com\n\nПеред оформленням замовлення покупець обирає товар, комплектацію, розміри, кількість і спосіб оплати та перевіряє підсумкову вартість.\n\nОформлюючи замовлення, покупець підтверджує ознайомлення з характеристиками товару, ціною та умовами продажу. Продавець і покупець погоджують індивідуальні параметри й умови виконання замовлення до запуску виробництва.\n\nПитання, не врегульовані цими умовами, вирішуються відповідно до законодавства України."
    },
    {
      "t": "texts",
      "k": "umovy.garantiya.5",
      "from": null,
      "to": ""
    },
    {
      "t": "txauto",
      "p": "kviz",
      "k": "main[1]>div[1]>div[1]>div[2]>div[1]>aside[1]>div[1]>div[3]>div[2]>i[1]",
      "from": "по тарифам Нової Пошти",
      "to": "за тарифами Нової Пошти"
    },
    {
      "t": "txauto",
      "p": "index",
      "k": "main[1]>section[1]>div[2]>div[1]>div[1]>ul[1]>li[2]>span[1]",
      "from": "**від 3 дні**виготовлення",
      "to": "**від 3 днів**виготовлення"
    },
    {
      "t": "txauto",
      "p": "index",
      "k": "main[1]>div[1]>section[2]>div[1]>ul[1]>li[3]>b[1]",
      "from": "1-3 дні",
      "to": "1–3 дні"
    }
  ];

function виправитиОрфографію() {
  if (роль !== 'admin') return 0;
  let n = 0;
  for (const x of ОРФОГРАФІЯ) {
    if (x.t === 'texts') {
      draft.texts = draft.texts || {};
      const було = Object.prototype.hasOwnProperty.call(draft.texts, x.k) ? draft.texts[x.k] : null;
      if (було !== x.from) continue;
      draft.texts[x.k] = x.to; n++;
    } else if (x.t === 'txauto') {
      const сторінка = draft.txauto && draft.txauto[x.p];
      if (!сторінка || сторінка[x.k] !== x.from) continue;
      if (x.to === null) delete сторінка[x.k];
      else сторінка[x.k] = x.to;
      n++;
    }
  }
  if (n) {
    markDirty();
    const бар = $('.bar');
    if (бар && !$('#spellNote')) {
      const d = document.createElement('div');
      d.id = 'spellNote';
      d.className = 'note note--ok';
      d.style.margin = '0 0 14px';
      d.innerHTML = 'Підготовлено оновлення <b>' + n + '</b> ' +
        (n % 10 === 1 && n % 100 !== 11 ? 'тексту' : 'текстів') +
        ' сайту (орфографія, заголовок головної, блок «Оплата»). Перегляньте у «Тексти» чи в конструкторі й натисніть ' +
        '<b>«Зберегти зміни»</b>. «Скасувати» поверне, як було.';
      бар.after(d);
      $('#save').addEventListener('click', () => { const e = $('#spellNote'); if (e) e.remove(); }, { once: true });
    }
  }
  return n;
}

const TITLES = {
  leads: 'Заявки',
  clients: 'База клієнтів',
  chats: 'Історія чатів',
  builder: 'Конструктор сайту',
  prices: 'Ціни й лінійки',
  fabrics: 'Тканини',
  texts: 'Числа й блоки',
  photos: 'Фото сайту',
  contacts: 'Контакти й умови',
  system: 'Стан системи'
};

const linePick = $('#linePick');
if (linePick) linePick.onclick = e => {
  const b = e.target.closest('[data-line]');
  if (!b || b.dataset.line === лінія) return;
  лінія = b.dataset.line;
  try { localStorage.setItem('fsh_admin_line', лінія); } catch (err) {}
  linePick.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  renderPrices();
  renderFabrics();
  const t = $('#textsBox'), ph = $('#photosBox');
  if (t && t.dataset.ready) renderTexts();
  if (ph && ph.dataset.ready) renderPhotos();
};

$('#sideNav').onclick = e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  const tab = b.dataset.tab;
  $$('#sideNav button').forEach(x => x.classList.toggle('on', x === b));
  $$('.tab').forEach(s => s.classList.toggle('on', s.dataset.tab === tab));
  $('#tabTitle').textContent = TITLES[tab] || '';

  if (tab === 'chats'  && !$('#chatsBox').dataset.ready)  { $('#chatsBox').dataset.ready = '1';  loadChats(true); }
  if (tab === 'clients' && !$('#clientsBox').dataset.ready) { $('#clientsBox').dataset.ready = '1'; loadClients(); }
  if (tab === 'texts'  && !$('#textsBox').dataset.ready)  { $('#textsBox').dataset.ready = '1';  renderTexts(); }
  if (tab === 'photos' && !$('#photosBox').dataset.ready) { $('#photosBox').dataset.ready = '1'; renderPhotos(); }
  if (tab === 'builder') renderBuilder();

  const hide = (tab === 'leads' || tab === 'chats' || tab === 'clients' || tab === 'photos');
  $('#save').hidden = hide || !dirty;
  $('#reset').hidden = hide || !dirty;
};

function markDirty() {
  dirty = true;
  $('#save').hidden = false;
  $('#reset').hidden = false;
  $('#saved').classList.remove('on');
}

$('#reset').onclick = () => {
  if (!dirty) return;
  if (!confirm('Скасувати всі незбережені зміни?')) return;
  draft = clone(base);
  api('/api/settings').then(saved => {
      deepMerge(draft, saved || {});
      savedAt = (saved && saved.savedAt) || savedAt;
    })
    .catch(() => {})
    .finally(() => {
      savedFull = clone(draft);
      dirty = false;
      $('#save').hidden = true;
      $('#reset').hidden = true;
      renderAll();
    });
};

$('#save').onclick = async () => {
  const btn = $('#save');
  btn.disabled = true;
  btn.textContent = 'Зберігаємо…';
  try {
    await putSettings(draft);
    dirty = false;
    $('#reset').hidden = true;
    $('#saved').textContent = 'Збережено';
    $('#saved').classList.add('on');
    setTimeout(() => $('#saved').classList.remove('on'), 2600);
  } catch (err) {
    alert(err.cancelled ? err.message : 'Не вдалося зберегти: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Зберегти зміни';
  }
};

addEventListener('beforeunload', e => {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = '';
});

const відКореня = u => {
  const s = String(u || '');
  return s && !/^(\/|https?:|data:)/.test(s) ? '/' + s : s;
};

function utmМітка(utm) {
  if (!utm || typeof utm !== 'object') return '';
  const u = k => utm['utm_' + k] || utm[k] || '';
  const ч = [u('source'), u('campaign'), u('content') || u('term') || u('medium')]
    .filter(Boolean);
  return ч.join(' · ');
}

const грн = n => new Intl.NumberFormat('uk-UA').format(Math.round(Number(n) || 0));

function факт(назва, значення) {
  const v = значення == null || значення === '' ? '' : String(значення);
  if (!v) return '';
  return '<div class="fact"><span>' + esc(назва) + '</span><b>' + esc(v) + '</b></div>';
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function bind(root) {
  root.querySelectorAll('[data-path]').forEach(el => {
    const path = el.dataset.path.split('.');
    const num = el.type === 'number';
    const flag = el.type === 'checkbox';

    el.addEventListener(flag ? 'change' : 'input', () => {
      let o = draft;
      for (let i = 0; i < path.length - 1; i++) {
        if (!o[path[i]] || typeof o[path[i]] !== 'object') o[path[i]] = {};
        o = o[path[i]];
      }

      if(num && el.value.trim() === ''){
        el.setAttribute('aria-invalid', 'true');
        el.style.borderColor = 'var(--err)';
        return;
      }
      el.removeAttribute('aria-invalid');
      el.style.borderColor = '';
      o[path[path.length - 1]] = flag ? el.checked : (num ? Number(el.value) : el.value);
      markDirty();
      if (el.dataset.swatch) {
        const sw = el.closest('.row').querySelector('.sw');
        if (sw) sw.style.background = el.value;
      }
    });
  });
}

const field = (label, path, value, opts = {}) => {
  const num = opts.type === 'number';
  const attrs = (opts.attrs || '') + (num ? ' min="' + (opts.min != null ? opts.min : 0) + '"' : '') +
    (num && opts.max != null ? ' max="' + opts.max + '"' : '') + (num ? ' required' : '');
  return '<label class="f"><span class="lab">' + esc(label) + '</span>' +
    '<input type="' + (opts.type || 'text') + '" data-path="' + esc(path) + '" ' +
    (opts.swatch ? 'data-swatch="1" ' : '') +
    'value="' + esc(value) + '"' + attrs + '>' +
    (opts.hint ? '<small>' + esc(opts.hint) + '</small>' : '') + '</label>';
};

function tierRow(t, i) {
  return '<div class="row row--tier" data-ti="' + i + '">' +
    '<input type="number" min="1" max="2000" data-path="rollerFormula.tiers.' + i + '.toH" value="' + esc(t.toH == null ? '' : t.toH) + '">' +
    '<input type="number" min="0" max="100000" data-path="rollerFormula.tiers.' + i + '.base" value="' + esc(t.base == null ? '' : t.base) + '">' +
    '<input type="number" min="0" max="100000" data-path="rollerFormula.tiers.' + i + '.perM" value="' + esc(t.perM == null ? '' : t.perM) + '">' +
    '<button class="del" type="button" data-deltier="' + i + '" aria-label="Видалити тариф">×</button>' +
  '</div>';
}

function нормалізуватиТарифи(tiers) {
  if (!Array.isArray(tiers)) return;
  tiers.forEach(t => {
    if (t && typeof t === 'object') {
      if (t.toH == null && t.toW != null) t.toH = t.toW;
      delete t.toW;
    }
  });
}

function formulaCard() {
  if (лінія !== 'roller') return '';

  if (!draft.rollerFormula)
    draft.rollerFormula = JSON.parse(JSON.stringify((typeof CFG !== 'undefined' && CFG.rollerFormula) || { tiers: [] }));
  const RF = draft.rollerFormula;
  RF.tiers = Array.isArray(RF.tiers) ? RF.tiers : [];
  нормалізуватиТарифи(RF.tiers);
  return '<div class="card"><h3>Формула ціни (рулонна)</h3>' +
    '<p class="hint"><b>Висота</b> обирає рядок таблиці (тариф), <b>ширина</b> множиться на ціну за метр: ' +
    '<b>база + (грн за пог. метр) × ширина</b>. Напр. висота 150 см (тариф «до 160»), ширина 150 см: ' +
    '190 + 770 × 1,5 = 1345 грн. Надбавку за конкретну тканину задають у розділі «Тканини». ' +
    'Вужча за мінімальну ширина рахується як за цю мінімальну. ' +
    '<b>Індивідуальна</b> ціна лишається тільки для висоти понад останній тариф.</p>' +
    '<div class="rows-head rows-head--tier"><span>Висота до, см</span><span>База, грн</span>' +
      '<span>Грн за пог. метр ширини</span><span></span></div>' +
    '<div class="rows" id="tierRows">' + RF.tiers.map((t, i) => tierRow(t, i)).join('') + '</div>' +
    '<button class="btn btn-o" type="button" id="addTier" style="margin-top:10px">Додати тариф</button>' +
    '<div class="grid" style="margin-top:16px">' +
      field('Ширина рахується від, см', 'rollerFormula.fromW', RF.fromW, { type: 'number', min: 1, max: 1000, hint: 'Вужче рахуємо як за цю ширину' }) +
      field('Мінімальна ширина для вводу, см', 'rollerFormula.minW', RF.minW, { type: 'number', min: 1, max: 1000 }) +
      field('Максимальна ширина для вводу, см', 'rollerFormula.maxW', RF.maxW, { type: 'number', min: 1, max: 2000 }) +
      field('Мінімальна висота для вводу, см', 'rollerFormula.minH', RF.minH, { type: 'number', min: 1, max: 1000 }) +
      field('Максимальна висота для вводу, см', 'rollerFormula.maxH', RF.maxH, { type: 'number', min: 1, max: 2000, hint: 'Постав великою — тоді висота практично без ліміту' }) +
    '</div>' +
    '<label class="f" style="margin-top:14px"><span class="lab">Примітка під «Індивідуальна ціна»</span>' +
      '<textarea data-path="rollerFormula.note" rows="2">' + esc(RF.note || '') + '</textarea></label>' +
  '</div>';
}

function tariffsCard() {
  if (лінія !== 'roller') return '';
  if (!Array.isArray(draft.rollerTariffs))
    draft.rollerTariffs = clone((typeof CFG !== 'undefined' && CFG.rollerTariffs) || []);
  const fabs = draft.fabrics || [];
  const TT = draft.rollerTariffs;

  const block = (t, ti) => {
    t.tiers = Array.isArray(t.tiers) ? t.tiers : [];
    нормалізуватиТарифи(t.tiers);
    const picked = Array.isArray(t.fabrics) ? t.fabrics : [];
    const chips = fabs.length
      ? fabs.map(f =>
          '<label class="tf-chip' + (picked.indexOf(f.id) !== -1 ? ' on' : '') + '">' +
            '<input type="checkbox" data-tfab="' + ti + '" value="' + esc(f.id) + '"' +
            (picked.indexOf(f.id) !== -1 ? ' checked' : '') + '>' +
            '<span>' + esc(f.name) + '</span></label>').join('')
      : '<i class="hint">Спершу додайте тканини в розділі «Тканини».</i>';
    const rows = t.tiers.map((r, ri) =>
      '<div class="row row--tier">' +
        '<input type="number" min="1" max="2000" data-path="rollerTariffs.' + ti + '.tiers.' + ri + '.toH" value="' + esc(r.toH == null ? '' : r.toH) + '">' +
        '<input type="number" min="0" max="100000" data-path="rollerTariffs.' + ti + '.tiers.' + ri + '.base" value="' + esc(r.base == null ? '' : r.base) + '">' +
        '<input type="number" min="0" max="100000" data-path="rollerTariffs.' + ti + '.tiers.' + ri + '.perM" value="' + esc(r.perM == null ? '' : r.perM) + '">' +
        '<button class="del" type="button" data-deltrow="' + ti + '.' + ri + '" aria-label="Видалити рядок">×</button>' +
      '</div>').join('');
    return '<div class="tariff">' +
      '<div class="tariff-top">' +
        '<input type="text" class="tariff-name" data-path="rollerTariffs.' + ti + '.name" value="' + esc(t.name || '') + '" placeholder="Назва тарифу (напр. Преміум блекаут)">' +
        '<button class="del" type="button" data-deltariff="' + ti + '" aria-label="Видалити тариф">× тариф</button>' +
      '</div>' +
      '<div class="tf-fabs"><span class="lab">Діє для тканин:</span><div class="tf-chips">' + chips + '</div></div>' +
      '<div class="rows-head rows-head--tier"><span>Висота до, см</span><span>База, грн</span>' +
        '<span>Грн за пог. метр ширини</span><span></span></div>' +
      '<div class="rows">' + rows + '</div>' +
      '<button class="btn btn-o" type="button" data-addtrow="' + ti + '" style="margin-top:8px">Додати рядок</button>' +
      '<label class="f" style="margin-top:10px;max-width:260px"><span class="lab">Ширина рахується від, см</span>' +
        '<input type="number" min="1" max="1000" data-path="rollerTariffs.' + ti + '.fromW" value="' + esc(t.fromW == null ? '' : t.fromW) + '"></label>' +
    '</div>';
  };

  return '<div class="card"><h3>Окремі тарифи для тканин</h3>' +
    '<p class="hint">Звичайна тканина рахується за формулою вище плюс своя надбавка. Але якщо для якоїсь ' +
    'тканини потрібен <b>окремий прайс</b> — створіть тариф, впишіть його ціни (так само: висота обирає рядок, ' +
    'ширина множиться на ціну за метр) і позначте, для яких тканин він діє. Для цих тканин ціна береться ' +
    '<b>повністю з тарифу</b>, надбавка не додається. Порожньо — діє лише загальна формула.</p>' +
    '<div id="tariffList">' +
      (TT.length ? TT.map((t, i) => block(t, i)).join('') : '<p class="hint">Поки що окремих тарифів немає.</p>') +
    '</div>' +
    '<button class="btn btn-o" type="button" id="addTariff" style="margin-top:12px">Додати тариф</button>' +
  '</div>';
}

function цінаПрикладу(e) {
  const F = draft.rollerFormula || (typeof CFG !== 'undefined' && CFG.rollerFormula) || {};
  const tiers = Array.isArray(F.tiers) ? F.tiers : [];
  if (!tiers.length) return null;
  const th = t => Number(t && t.toH != null ? t.toH : (t && t.toW)) || 0;
  const w = Number(e.w), h = Number(e.h);
  if (!isFinite(w) || !isFinite(h)) return null;
  const maxH = th(tiers[tiers.length - 1]);
  if (maxH > 0 && h > maxH) return null;
  const effW = Math.max(w, Number(F.fromW) || 0);
  const t = tiers.find(x => h <= th(x)) || tiers[tiers.length - 1];
  return Math.round((Number(t.base) || 0) + (Number(t.perM) || 0) * (effW / 100));
}

function examplesCard() {
  if (лінія !== 'roller') return '';
  if (!Array.isArray(draft.rollerExamples))
    draft.rollerExamples = clone((typeof CFG !== 'undefined' && CFG.rollerExamples) || []);
  const EX = draft.rollerExamples;
  const row = (e, i) => {
    const p = цінаПрикладу(e);
    const pt = p == null ? 'індивідуальна (поза формулою)' : p.toLocaleString('uk-UA') + ' ₴';
    const prev = превФото(e.img);
    return '<div class="ex-row" data-exi="' + i + '">' +
      '<div class="ex-top">' +
        '<label class="ex-ph" title="Завантажити фото прикладу">' +
          (prev ? '<img src="' + esc(prev) + '" alt="">' : '<span class="ex-ph-add">＋ фото</span>') +
          '<input type="file" accept="image/*" data-eximg="' + i + '" hidden>' +
        '</label>' +
        '<div class="ex-grid">' +
          '<label class="f"><span class="lab">Назва</span>' +
            '<input type="text" data-path="rollerExamples.' + i + '.name" value="' + esc(e.name || '') + '"></label>' +
          '<label class="f"><span class="lab">Підпис</span>' +
            '<input type="text" data-path="rollerExamples.' + i + '.note" value="' + esc(e.note || '') + '"></label>' +
          '<label class="f"><span class="lab">Ширина, см</span>' +
            '<input type="number" min="1" max="2000" data-expath="' + i + '.w" data-path="rollerExamples.' + i + '.w" value="' + esc(e.w == null ? '' : e.w) + '"></label>' +
          '<label class="f"><span class="lab">Висота, см</span>' +
            '<input type="number" min="1" max="2000" data-expath="' + i + '.h" data-path="rollerExamples.' + i + '.h" value="' + esc(e.h == null ? '' : e.h) + '"></label>' +
        '</div>' +
      '</div>' +
      '<div class="ex-foot"><span class="ex-price">Ціна за формулою: <b>' + pt + '</b></span>' +
        '<button class="del" type="button" data-delex="' + i + '" aria-label="Видалити приклад">× приклад</button></div>' +
    '</div>';
  };
  return '<div class="card"><h3>Приклади вартості (блок «Скільки це коштує»)</h3>' +
    '<p class="hint">Картки з прикладами вікон на головній. Натисніть на квадрат ліворуч, щоб <b>завантажити фото</b> ' +
    'картки. <b>Ціна рахується за формулою</b> з розмірів, які ви тут вкажете — тож навіть якщо поміняєте фото й підпис ' +
    'на інший розмір, виправте ширину й висоту, і ціна стане правильною.</p>' +
    '<div id="exList">' + (EX.length ? EX.map((e, i) => row(e, i)).join('') : '<p class="hint">Прикладів немає.</p>') + '</div>' +
    '<button class="btn btn-o" type="button" id="addEx" style="margin-top:12px">Додати приклад</button>' +
  '</div>';
}

function renderPrices() {
  const L = draft.lines || {};
  const S = draft.systems || {};
  const box = $('#pricesBox');
  box.innerHTML =
    '<div class="card"><h3>Акція (знижка)</h3>' +
      '<p class="hint">Реальна ціна не змінюється — поруч показується перекреслена, ' +
      'більша, і напис «−NN%». Так виглядає знижка в калькуляторі, кошику й на картках ' +
      'тканин. Зніміть прапорець, коли акція скінчиться.</p>' +
      '<label class="flag" style="margin-bottom:12px"><input type="checkbox" data-path="promo.on"' +
        (draft.promo && draft.promo.on ? ' checked' : '') + '><span>Показувати знижку на сайті</span></label>' +
      '<div class="grid">' +
        field('Розмір знижки, %', 'promo.percent', draft.promo ? draft.promo.percent : 50,
          { type: 'number', min: 1, max: 95, hint: 'Напр. 50 — ціна поруч буде вдвічі більшою, перекресленою' }) +
      '</div></div>' +

    formulaCard() +

    tariffsCard() +

    examplesCard() +

    '<div class="card"><h3>Калькулятор: «Не знаєте, як заміряти?»</h3>' +
      '<p class="hint">Під полями розмірів у калькуляторі є посилання — воно відкриває вікно ' +
      'з фото-схемою заміру й відео. Фото міняється у «Фото сайту» (Калькулятор). Сюди вставте ' +
      'посилання на відео з YouTube (звичайне, youtu.be або Shorts) чи пряме посилання на .mp4. ' +
      'Порожньо — у вікні буде лише фото.</p>' +
      '<div class="grid">' +
        field('Відео-гайд, посилання', 'measureVideo', draft.measureVideo || '',
          { hint: 'Напр. https://youtu.be/XXXXXXXXXXX' }) +
      '</div></div>' +

    '<div class="card"><h3>Строк виготовлення</h3>' +
      '<p class="hint">Текст показується на сайті (у питаннях і в чаті).</p>' +
      '<div class="grid">' +
        field('Строк виготовлення', 'production.public',
          draft.production ? draft.production.public : '') +
      '</div></div>';
  bind(box);

  const addT = $('#addTier');
  if (addT) addT.onclick = () => {
    const ts = draft.rollerFormula.tiers;
    const last = ts[ts.length - 1] || { toH: 160, base: 0, perM: 0 };
    ts.push({ toH: (+last.toH || 0) + 40, base: +last.base || 0, perM: +last.perM || 0 });
    markDirty(); renderPrices();
  };
  box.querySelectorAll('[data-deltier]').forEach(b => b.onclick = () => {
    draft.rollerFormula.tiers.splice(+b.dataset.deltier, 1);
    markDirty(); renderPrices();
  });

  draft.rollerTariffs = Array.isArray(draft.rollerTariffs) ? draft.rollerTariffs : [];

  const addTariff = $('#addTariff');
  if (addTariff) addTariff.onclick = () => {

    const F = draft.rollerFormula || {};
    draft.rollerTariffs.push({
      id: 't-' + Date.now().toString(36),
      name: '', fabrics: [],
      fromW: F.fromW != null ? F.fromW : 40,
      tiers: (Array.isArray(F.tiers) ? F.tiers : []).map(t => ({ toH: +t.toH || 0, base: +t.base || 0, perM: +t.perM || 0 }))
    });
    markDirty(); renderPrices();
  };
  box.querySelectorAll('[data-deltariff]').forEach(b => b.onclick = () => {
    const i = +b.dataset.deltariff;
    if (!confirm('Видалити тариф «' + ((draft.rollerTariffs[i] || {}).name || 'без назви') + '»?')) return;
    draft.rollerTariffs.splice(i, 1);
    markDirty(); renderPrices();
  });
  box.querySelectorAll('[data-addtrow]').forEach(b => b.onclick = () => {
    const t = draft.rollerTariffs[+b.dataset.addtrow];
    t.tiers = Array.isArray(t.tiers) ? t.tiers : [];
    const last = t.tiers[t.tiers.length - 1] || { toH: 160, base: 0, perM: 0 };
    t.tiers.push({ toH: (+last.toH || 0) + 40, base: +last.base || 0, perM: +last.perM || 0 });
    markDirty(); renderPrices();
  });
  box.querySelectorAll('[data-deltrow]').forEach(b => b.onclick = () => {
    const [ti, ri] = b.dataset.deltrow.split('.').map(Number);
    draft.rollerTariffs[ti].tiers.splice(ri, 1);
    markDirty(); renderPrices();
  });

  box.querySelectorAll('[data-tfab]').forEach(cb => cb.onchange = () => {
    const t = draft.rollerTariffs[+cb.dataset.tfab];
    t.fabrics = Array.isArray(t.fabrics) ? t.fabrics : [];
    const id = cb.value;
    const at = t.fabrics.indexOf(id);
    if (cb.checked) { if (at === -1) t.fabrics.push(id); }
    else if (at !== -1) t.fabrics.splice(at, 1);
    cb.closest('.tf-chip').classList.toggle('on', cb.checked);
    markDirty();
  });

  draft.rollerExamples = Array.isArray(draft.rollerExamples) ? draft.rollerExamples : [];
  const addEx = $('#addEx');
  if (addEx) addEx.onclick = () => {
    draft.rollerExamples.push({ name: 'Новий приклад', note: '', w: 60, h: 150, img: '' });
    markDirty(); renderPrices();
  };
  box.querySelectorAll('[data-delex]').forEach(b => b.onclick = () => {
    const i = +b.dataset.delex;
    if (!confirm('Видалити приклад «' + ((draft.rollerExamples[i] || {}).name || '') + '»?')) return;
    draft.rollerExamples.splice(i, 1);
    markDirty(); renderPrices();
  });

  box.querySelectorAll('[data-eximg]').forEach(inp => inp.addEventListener('change', async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    const i = Number(inp.dataset.eximg);
    const label = inp.closest('.ex-ph');
    if (label) label.classList.add('busy');
    try {
      const url = await uploadImage(file, 'pryklad-' + i + '-' + Date.now().toString(36));
      draft.rollerExamples[i].img = url;
      await saveNow(['rollerExamples', i, 'img']);
      renderPrices();
    } catch (err) {
      if (label) label.classList.remove('busy');
      alert('Не вдалося завантажити: ' + err.message);
    }
    inp.value = '';
  }));

  box.querySelectorAll('#exList [data-expath]').forEach(inp => inp.addEventListener('input', () => {
    const rowEl = inp.closest('.ex-row'); if (!rowEl) return;
    const e = draft.rollerExamples[+rowEl.dataset.exi];
    const p = цінаПрикладу(e);
    const b = rowEl.querySelector('.ex-price b');
    if (b) b.textContent = p == null ? 'індивідуальна (поза формулою)' : p.toLocaleString('uk-UA') + ' ₴';
  }));
}

function renderFabrics() {
  const list = draft.fabrics || [];
  const box = $('#fabricsBox');

  const isRoller = лінія === 'roller';
  const поле = isRoller ? 'promo' : ЛІНІЇ[лінія].поле;
  const загальна = draft.promo && draft.promo.on && Number(draft.promo.percent) > 0
    ? Math.round(Number(draft.promo.percent)) : 0;
  const colHead = isRoller ? 'Знижка, %' : 'Ціна, грн за м²';
  const hint = isRoller
    ? 'Ціна рулонної рахується за формулою (Ціни → Формула), дорожчій тканині можна дати окремий тариф. ' +
      'Тут — <b>знижка окремої тканини</b>: вона перебиває загальну акцію (Ціни → Акція, зараз ' +
      (загальна ? '<b>−' + загальна + '%</b>' : 'вимкнена') + '). Порожньо — діє загальна, ' +
      '<b>0</b> — для цієї тканини без знижки. Натисніть на квадрат, щоб завантажити фото тканини.'
    : 'Показана ціна для лінійки «' + esc(ЛІНІЇ[лінія].назва) + '». Каталог тканин спільний, а ціна в кожної ' +
      'лінійки своя — другу видно в перемикачі ліворуч. Натисніть на квадрат, щоб завантажити фото тканини.';
  box.innerHTML =
    '<div class="card"><h3>Каталог тканин</h3>' +
      '<p class="hint">' + hint + '</p>' +
      '<div class="rows-head"><span>Фото й назва</span><span>' + colHead + '</span>' +
        '<span>Затемнення</span><span></span></div>' +
      '<div class="rows" id="fabRows">' +
      list.map((f, i) =>
        '<div class="row" data-i="' + i + '">' +
          '<span class="row-name">' +
            '<label class="fab-ph" title="Завантажити фото тканини">' +
              (f.img
                ? '<img src="' + esc(відКореня(f.img)) + '" alt="">'
                : '<i class="sw" style="background:' + esc(f.from || '#ccc') + '"></i>') +
              '<input type="file" accept="image/*" data-fabimg="' + i + '" hidden>' +
            '</label>' +
            '<input type="text" data-path="fabrics.' + i + '.name" value="' + esc(f.name) + '">' +
          '</span>' +
          (isRoller

            ? '<input type="number" min="0" max="95" step="1" data-fabpromo="' + i + '" value="' +
                esc(f.promo == null ? '' : f.promo) + '" placeholder="' +
                (загальна ? 'загальна −' + загальна + '%' : 'без знижки') + '">'
            : '<input type="number" min="0" data-path="fabrics.' + i + '.' + поле + '" value="' +
                esc(f[поле] == null ? '' : f[поле]) + '">') +

          '<input type="text" data-path="fabrics.' + i + '.transmission" value="' + esc(f.transmission) + '">' +
          '<button class="del" type="button" data-del="' + i + '" aria-label="Видалити тканину">×</button>' +
        '</div>').join('') +
      '</div>' +
      '<button class="btn btn-o" type="button" id="addFab" style="margin-top:14px">Додати тканину</button>' +
    '</div>';

  bind(box);

  box.querySelectorAll('[data-fabpromo]').forEach(inp => inp.addEventListener('input', () => {
    const f = draft.fabrics[+inp.dataset.fabpromo];
    if (!f) return;
    const v = inp.value.trim();
    const n = Number(v);
    const bad = v !== '' && !(isFinite(n) && n >= 0 && n <= 95);
    inp.style.borderColor = bad ? 'var(--err)' : '';
    if (bad) { inp.setAttribute('aria-invalid', 'true'); return; }
    inp.removeAttribute('aria-invalid');
    if (v === '') delete f.promo; else f.promo = Math.round(n);

    delete f.add;
    markDirty();
  }));

  box.querySelectorAll('[data-fabimg]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      const i = Number(inp.dataset.fabimg);
      const label = inp.closest('.fab-ph');
      label.classList.add('busy');
      try {
        const url = await uploadImage(file, 'tkanyna-' + (draft.fabrics[i] || {}).id);
        draft.fabrics[i].img = url;
        await saveNow(['fabrics', i, 'img']);
        renderFabrics();
      } catch (err) {
        label.classList.remove('busy');
        alert('Не вдалося завантажити: ' + err.message);
      }
      inp.value = '';
    });
  });

  box.onclick = e => {
    const d = e.target.closest('[data-del]');
    if (d) {
      const i = Number(d.dataset.del);
      if (!confirm('Видалити тканину «' + (draft.fabrics[i] || {}).name + '»?')) return;
      draft.fabrics.splice(i, 1);
      markDirty();
      renderFabrics();
      return;
    }
    if (e.target.id === 'addFab') {
      draft.fabrics = draft.fabrics || [];
      draft.fabrics.push({
        id: 'new-' + Date.now().toString(36),
        name: 'Нова тканина', price: 520, roller: 340,
        transmission: 'Напівзатемнення', from: '#DDDDDD', to: '#BBBBBB'
      });
      markDirty();
      renderFabrics();
    }
  };
}

const SOC_LINKS = [
  ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['telegram', 'Telegram'],
  ['viberChat', 'Viber'], ['tiktok', 'TikTok'], ['youtube', 'YouTube']
];

function renderContacts() {
  const l = draft.links || {};
  const box = $('#contactsBox');

  box.innerHTML =
    '<div class="card"><h3>Звʼязок</h3>' +
      '<p class="hint">Телефон і пошта підставляються в шапку, підвал і тексти помилок.</p>' +
      '<div class="grid">' +
        field('Телефон', 'phone', draft.phone) +
        field('Пошта', 'email', draft.email) +
        field('Графік роботи', 'schedule', draft.schedule) +
      '</div></div>' +

    '<div class="card"><h3>Соцмережі та месенджери</h3>' +
      '<p class="hint">Вставте посилання (https://…) — іконка зʼявиться в підвалі. Для <b>Telegram</b> і ' +
      '<b>Viber</b> можна просто вписати <b>номер телефону</b> (напр. +380 95 904 87 45), у Telegram ще й ' +
      '<b>@нік</b> — сайт сам зробить із нього посилання на чат. ' +
      'Галочкою можна тимчасово сховати іконку, не стираючи посилання.</p>' +
      '<div class="soc-rows">' +
      SOC_LINKS.map(([k, name]) =>
        '<div class="soc-row">' +
          '<label class="flag"><input type="checkbox" data-path="links.' + k + 'On"' +
            (l[k + 'On'] !== false ? ' checked' : '') + '><span>' + esc(name) + '</span></label>' +
          '<input type="text" data-path="links.' + k + '" placeholder="' +
            (k === 'telegram' ? '+380… або @нік або https://t.me/…' : k === 'viberChat' ? '+380… (номер у Viber)' : 'https://…') +
            '" value="' +
            esc(l[k] && l[k] !== '#' ? l[k] : '') + '">' +
        '</div>').join('') +
      '</div></div>';
  bind(box);
}

const BLOCK_NAMES = {
  budova:'Будова штори', pro:'Про нас', vidhuky:'Наші роботи',
  chomu:'Переваги', tkanyny:'Тканини', kimnaty:'Кімнати',
  pidbir:'Підбір за одним питанням', tsina:'Скільки це коштує',
  zamir:'Як виміряти', alt:'Якщо не підходить', blog:'Новини'
};

function blockRows() {
  const b = draft.blocks || {};
  return '<div class="flags">' + Object.keys(BLOCK_NAMES).map(id =>
    '<label class="flag"><input type="checkbox" data-path="blocks.' + id + '"' +
    (b[id] === false ? '' : ' checked') + '><span>' + esc(BLOCK_NAMES[id]) + '</span></label>'
  ).join('') + '</div>';
}

const DETAIL_NAMES = {
  budova:'Будова штори', tkanyny:'Тканини', zamir:'Як виміряти',
  chomu:'Переваги', tsina:'Скільки це коштує'
};
function detailRows() {
  const d = draft.details || {};
  return Object.keys(DETAIL_NAMES).map(id =>
    '<label class="f tf"><span class="lab">' + esc(DETAIL_NAMES[id]) + '</span>' +
    '<textarea data-path="details.' + id + '" rows="3" ' +
    'placeholder="Порожньо — кнопки «Детальніше» не буде">' + esc(d[id] || '') + '</textarea></label>'
  ).join('');
}

function priceExamplesRows() {
  const list = draft.priceExamples || [];
  if (!list.length) return '<p class="hint">Прикладів немає.</p>';
  return list.map((e, i) =>
    '<div class="row"><div class="grid">' +
      field('Назва', 'priceExamples.' + i + '.name', e.name) +
      field('Підпис', 'priceExamples.' + i + '.note', e.note) +
      field('Ширина, см', 'priceExamples.' + i + '.w', e.w, {type:'number'}) +
      field('Висота, см', 'priceExamples.' + i + '.h', e.h, {type:'number'}) +
      field('Скільки штор', 'priceExamples.' + i + '.count', e.count, {type:'number'}) +
    '</div></div>'
  ).join('');
}

let content = null;

async function loadContent() {
  if (content) return content;
  const r = await fetch('/assets/content.json', { cache: 'no-store' });
  content = await r.json();
  return content;
}

function groupBy(list, page) {
  const out = {};
  list.filter(x => x.page === page).forEach(x => {
    (out[x.section] = out[x.section] || []).push(x);
  });
  return out;
}

const SECTION_NAMES = {
  page: 'Шапка й підвал', pro: 'Про нас', chomu: 'Чому ми', vidhuky: 'Наші роботи',
  budova: 'Будова штори', tkanyny: 'Тканини', kimnaty: 'Кімнати', pidbir: 'Підбір',
  zamir: 'Як виміряти', alt: 'Якщо не підходить', blog: 'Блог', zvyazok: 'Заклик',
  'kimnaty-teaser': 'Кімнати (анонс)', top: 'Перший екран', chym: 'Чим відрізняється',
  de: 'Де підходять', komplekt: 'Комплект', kolir: 'Кольори', tsina: 'Ціна',
  yak: 'Як замовити', faq: 'Питання', order: 'Вікно вибору', roboty: 'Наші роботи',
  dostavka: 'Доставка', garantiya: 'Гарантія', povernennya: 'Повернення',
  oferta: 'Оферта', privacy: 'Конфіденційність'
};
const secName = k => SECTION_NAMES[k] || k;

function renderTexts() {
  const box = $('#textsBox');
  draft.texts = draft.texts || {};
  const фірма = draft.company || {};

  let html = '<div class="note note--ok">Самі тексти сторінок міняються у розділі ' +
    '<b>«Конструктор»</b> — прямо на сайті. Тут лишились наскрізні налаштування: ' +
    'числа компанії й які блоки показувати.</div>';

  const налаштування =
    '<div class="card"><h3>Числа компанії</h3>' +
      '<p class="hint">Підставляються в текст у кількох місцях одразу — у блок «Про нас» ' +
      'і на плитки з цифрами. Міняти їх у самих текстах не треба.</p>' +
      '<div class="grid">' +
        field('Працюємо з', 'company.since', фірма.since) +
        field('Років загального досвіду', 'company.years_total', фірма.years_total) +
        field('Років із рулонними', 'company.years_pro', фірма.years_pro) +
        field('Вікон оформлено', 'company.clients', фірма.clients) +
      '</div></div>' +

    '<div class="card"><h3>Які блоки показувати</h3>' +
      '<p class="hint">Вимкнений блок зникає зі сторінки разом із пунктом у меню. ' +
      'Розмітка лишається на місці, тож увімкнути назад можна будь-коли.</p>' +
      blockRows() +
    '</div>';

  box.innerHTML = html + налаштування;

  bind(box);

}

async function uploadImage(file, name) {
  if (!file) return null;
  const r = await fetch('/api/upload?name=' + encodeURIComponent(name || file.name), {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error((d && d.error) || ('Сервер відповів ' + r.status));
  return d.url;
}

async function saveNow(...paths) {
  const full = clone(savedFull);
  const get = (o, seg) => seg.reduce((v, k) => (v == null ? v : v[k]), o);
  for (const p of paths) {

    const seg = Array.isArray(p) ? p.map(String) : String(p).split('.');
    const батькоШлях = seg.slice(0, -1), ост = seg[seg.length - 1];
    let батько = батькоШлях.length ? get(full, батькоШлях) : full;

    if (!батько || typeof батько !== 'object') {
      full[seg[0]] = clone(draft[seg[0]]);
      continue;
    }
    const v = get(draft, seg);
    if (v === undefined) delete батько[ост];
    else батько[ост] = clone(v);
  }
  await putSettings(full);

  if (JSON.stringify(diff(draft, base)) === JSON.stringify(diff(savedFull, base))) {
    dirty = false;
    $('#save').hidden = true;
    $('#reset').hidden = true;
  }
  $('#saved').textContent = 'Збережено';
  $('#saved').classList.add('on');
  setTimeout(() => $('#saved').classList.remove('on'), 2600);
}

function взятиШлях(o, path) {
  return path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
}
function задатиШлях(o, path, val) {
  const p = path.split('.');
  let cur = o;
  for (let i = 0; i < p.length - 1; i++) {
    if (cur[p[i]] == null || typeof cur[p[i]] !== 'object') cur[p[i]] = {};
    cur = cur[p[i]];
  }
  cur[p[p.length - 1]] = val;
}

function превФото(v) {
  if (!v) return '';
  if (/^https?:/.test(v)) return v;
  if (/\.(webp|jpe?g|png|avif)$/i.test(v)) return v[0] === '/' ? v : '/' + v;
  return '/' + v + '.jpg';
}

function конфігФото() {
  const list = [];
  (draft.rollerExamples || []).forEach((e, i) =>
    list.push({ path: 'rollerExamples.' + i + '.img', title: 'Приклад вікна', sub: e.name || ('№' + (i + 1)) }));
  if (draft.vis)
    list.push({ path: 'vis.person', title: 'Людина за склом', sub: 'у калькуляторі' });
  (draft.rooms || []).forEach((r, i) =>
    list.push({ path: 'rooms.' + i + '.img', title: 'Кімната', sub: r.name || ('№' + (i + 1)) }));
  return list;
}

async function renderPhotos() {
  const box = $('#photosBox');
  box.innerHTML = '<div class="empty">Завантажуємо…</div>';
  let c;
  try { c = await loadContent(); }
  catch (e) { box.innerHTML = '<div class="note">Не вдалося прочитати довідник фото.</div>'; return; }

  draft.images = draft.images || {};
  let html = '<div class="note">Фото лінійки «' + esc(ЛІНІЇ[лінія].назва) +
    '». Нове зберігається одразу після вибору файла, до 6 МБ.</div><div class="shots">';
  c.images.filter(it => моє(it.key)).forEach(it => {
    const cur = draft.images[it.key];
    html += '<figure class="shot" data-key="' + esc(it.key) + '">' +
      '<img src="' + esc(cur || ('/' + it.src)) + '" alt="" loading="lazy">' +
      '<figcaption><b>' + esc(secName(it.section)) + '</b>' +
      '<span>' + esc(it.alt || it.src.split('/').pop()) + '</span>' +
      '<span class="shot-page">' + esc(it.page) + '</span></figcaption>' +
      '<label class="shot-btn">Замінити фото' +
      '<input type="file" accept="image/*" data-imgkey="' + esc(it.key) + '" hidden></label>' +
      (cur ? '<button class="shot-undo" type="button" data-undo="' + esc(it.key) + '">Повернути початкове</button>' : '') +
      '</figure>';
  });
  html += '</div>';

  if (лінія === 'roller') {
    const кф = конфігФото();
    if (кф.length) {
      html += '<div class="note" style="margin-top:20px">Фото калькулятора й прикладів — ' +
        'приклади вікон із цінами, людина за склом у калькуляторі, кімнати. Нове зберігається одразу.</div>' +
        '<div class="shots">';
      кф.forEach(it => {
        const val = взятиШлях(draft, it.path);
        const base0 = взятиШлях(base, it.path);
        html += '<figure class="shot">' +
          '<img src="' + esc(превФото(val)) + '" alt="" loading="lazy">' +
          '<figcaption><b>' + esc(it.title) + '</b><span>' + esc(it.sub) + '</span></figcaption>' +
          '<label class="shot-btn">Замінити фото' +
          '<input type="file" accept="image/*" data-cfgpath="' + esc(it.path) + '" hidden></label>' +
          (val !== base0 ? '<button class="shot-undo" type="button" data-cfgundo="' + esc(it.path) + '">Повернути початкове</button>' : '') +
          '</figure>';
      });
      html += '</div>';
    }
  }

  box.innerHTML = html;

  box.querySelectorAll('[data-cfgpath]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      const fig = inp.closest('.shot');
      const btn = fig.querySelector('.shot-btn');
      btn.textContent = 'Завантажуємо…';
      try {
        const url = await uploadImage(file, inp.dataset.cfgpath.split('.').join('-'));
        задатиШлях(draft, inp.dataset.cfgpath, url);
        await saveNow(inp.dataset.cfgpath);
        renderPhotos();
      } catch (err) {
        btn.textContent = 'Замінити фото';
        alert('Не вдалося завантажити: ' + err.message);
      }
      inp.value = '';
    });
  });

  box.querySelectorAll('[data-imgkey]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      const fig = inp.closest('.shot');
      const btn = fig.querySelector('.shot-btn');
      btn.textContent = 'Завантажуємо…';
      try {
        const url = await uploadImage(file, inp.dataset.imgkey.split('.').join('-'));
        draft.images[inp.dataset.imgkey] = url;
        await saveNow(['images', inp.dataset.imgkey]);
        fig.querySelector('img').src = url;
        renderPhotos();
      } catch (err) {
        btn.textContent = 'Замінити фото';
        alert('Не вдалося завантажити: ' + err.message);
      }
      inp.value = '';
    });
  });

  box.onclick = async e => {
    const cu = e.target.closest('[data-cfgundo]');
    if (cu) {
      задатиШлях(draft, cu.dataset.cfgundo, взятиШлях(base, cu.dataset.cfgundo));
      try { await saveNow(cu.dataset.cfgundo); renderPhotos(); }
      catch (err) { alert('Не вдалося: ' + err.message); }
      return;
    }
    const u = e.target.closest('[data-undo]');
    if (!u) return;
    delete draft.images[u.dataset.undo];
    try { await saveNow(['images', u.dataset.undo]); renderPhotos(); }
    catch (err) { alert('Не вдалося: ' + err.message); }
  };
}

let leads = [], from = 0, total = 0, filter = '', kind = '';

const STATUS = ['нова', 'в роботі', 'підтверджено', 'оплачено', 'закрита', 'невдала'];
const STCLASS = {
  'нова': 'st-new', 'в роботі': 'st-work', 'підтверджено': 'st-won',
  'оплачено': 'st-paid', 'закрита': 'st-done', 'невдала': 'st-fail'
};

function when(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return 'сьогодні о ' + time;
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }) + ' о ' + time;
}

async function loadLeads(reset) {
  if (reset) { from = 0; leads = []; }
  let data;
  try {
    data = await api('/api/leads?from=' + from + '&size=50');
  } catch (err) {
    $('#leadList').innerHTML = '<div class="empty">Не вдалося завантажити заявки: ' + esc(err.message) + '</div>';
    return;
  }
  leads = leads.concat(data.items || []);
  total = data.total || 0;
  from += (data.items || []).length;
  $('#more').hidden = from >= total;
  $('#leadCount').textContent = total ? String(total) : '';
  if (!data.persistent) {
    $('#leadList').dataset.warn = '1';
  }
  renderLeads();
}

$('#more').onclick = () => loadLeads(false);

function типЗаявки(l) {
  if (l.peek) return 'перегляд';
  if (l.hold) return 'фіксація';
  if (String(l.source || '').toLowerCase().includes('чат')) return 'чат';
  return 'замовлення';
}

$('#kinds').onclick = e => {
  const b = e.target.closest('[data-kind]');
  if (!b) return;
  kind = b.dataset.kind;
  $$('#kinds button').forEach(x => x.classList.toggle('on', x === b));
  renderLeads();
};

$('#filters').onclick = e => {
  const b = e.target.closest('[data-status]');
  if (!b) return;
  filter = b.dataset.status;
  $$('#filters button').forEach(x => x.classList.toggle('on', x === b));
  renderLeads();
};

const ЖИВО_МС = 20000;
let живийТаймер = null;
const свіжі = new Set();

async function перевіритиНові() {
  if (document.hidden || gate.hidden === false) return;

  if ($('#leadList .pick-menu:not([hidden])')) return;
  let d;
  try { d = await api('/api/leads?from=0&size=50'); }
  catch (err) { return; }

  const прийшли = d.items || [];
  total = d.total || total;
  $('#leadCount').textContent = total ? String(total) : '';

  for (const свіжа of прийшли) {
    const наша = leads.find(l => l.id === свіжа.id);
    if (наша && наша.status !== свіжа.status) наша.status = свіжа.status;
  }

  const нові = прийшли.filter(x => !leads.some(l => l.id === x.id));
  if (!нові.length) { renderLeads(); return; }

  leads = нові.concat(leads);
  from += нові.length;
  нові.forEach(l => свіжі.add(l.id));
  renderLeads();
  сказатиПроНові(нові.length);

  setTimeout(() => { нові.forEach(l => свіжі.delete(l.id)); renderLeads(); }, 7000);
}

function сказатиПроНові(n) {
  let т = $('#toast');
  if (!т) {
    т = document.createElement('div');
    т.id = 'toast';
    т.className = 'toast';
    document.body.append(т);
  }
  т.innerHTML = '<i class="toast-dot"></i>' +
    n + ' ' + скільки(n, 'нова заявка', 'нові заявки', 'нових заявок');
  т.classList.add('on');
  clearTimeout(т._t);
  т._t = setTimeout(() => т.classList.remove('on'), 5000);
}

function живіЗаявки(увімк) {
  clearInterval(живийТаймер);
  живийТаймер = увімк ? setInterval(перевіритиНові, ЖИВО_МС) : null;
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && живийТаймер) перевіритиНові();
});

const розкриті = new Set();

const розмір = (a, b) => (a && b ? a + '×' + b + ' см' : '');

function час(s) {
  const n = Math.round(Number(s) || 0);
  if (!n) return '';
  if (n < 60) return n + ' ' + скільки(n, 'секунда', 'секунди', 'секунд');
  const хв = Math.floor(n / 60), ск = n % 60;
  return хв + ' ' + скільки(хв, 'хвилина', 'хвилини', 'хвилин') +
    (ск ? ' ' + ск + ' с' : '');
}

function leadDetail(l) {
  const v = l.visit || {};
  const utm = Object.entries(l.utm || {}).filter(([, x]) => x);

  const вікна = (l.windows || []).map((w, i) =>
    '<div class="wfull"><h5>Вікно ' + esc(w.window || i + 1) + '</h5>' +
      '<div class="facts">' +
        факт('Лінійка', w.line) +
        факт('Тканина', w.fabric) +
        факт('Розмір тканини', розмір(w.fabricW, w.fabricH)) +
        факт('Розмір готового виробу', розмір(w.width, w.height)) +
        факт('К-ть штор', w.sashes) +
        факт('На все вікно', w.whole ? 'так' : '') +
        факт('Система', w.system) +
        факт('Керування', w.side) +
        факт('Додатково', (w.options || []).filter(Boolean).join(', ')) +
        факт('Ціна', w.price == null ? 'індивідуальна — порахувати' : (w.price ? грн(w.price) + ' грн' : '')) +
      '</div></div>').join('');

  const слід = (v.secs || v.summary)
    ? '<div class="facts">' +
        факт('Часу на сайті', час(v.secs)) +
        факт('Дивилась розділи', (v.seen || []).join(', ')) +
        факт('Натиснула кнопку', v.from) +
        факт('Зайшла', v.opened ? when(v.opened) : '') +
        факт('Екран', v.screen) +
        факт('Була перед цим на', v.ref) +
      '</div>' +
      (v.summary ? '<p class="lead-sum">' + esc(v.summary) + '</p>' : '')
    : '<p class="hint">Слід відвідування не записаний: або заявка прийшла ще до того, ' +
      'як ми почали його збирати, або в браузері вимкнені скрипти.</p>';

  return '<div class="lead-all">' +
    '<h4>Заявка</h4>' +
    '<div class="facts">' +
      факт('Прийшла', new Date(l.at).toLocaleString('uk-UA')) +
      факт('Імʼя', l.name) +
      факт('Телефон', l.phone) +
      факт('Що саме', l.kind) +
      факт('Джерело', l.source) +
      факт('Доставка', l.delivery) +
      факт('Фіксація знижки', l.hold ? l.hold + ' ' + скільки(l.hold, 'день', 'дні', 'днів') : '') +
      факт('Разом', l.individual ? 'індивідуальна — порахувати менеджеру'
                                  : (l.total ? грн(l.total) + ' грн' : '')) +
      факт('Сторінка', l.page) +
      факт('Номер', l.id) +
    '</div>' +
    (вікна ? '<h4>Склад замовлення</h4>' + вікна : '') +
    '<h4>Що людина робила на сайті</h4>' + слід +
    (utm.length ? '<h4>Реклама</h4><div class="facts">' +
      utm.map(([k, x]) => факт(k, x)).join('') + '</div>' : '') +
    (l.note ? '<h4>Нотатка</h4><div class="lead-note">' + esc(l.note) + '</div>' : '') +
  '</div>';
}

function статусПікер(id, зараз) {
  return пікер('lead', id, зараз, STATUS, STCLASS);
}

function пікер(вид, id, зараз, варіанти, класи) {
  return '<div class="pick" data-pick="' + esc(id) + '" data-pickkind="' + esc(вид) + '">' +
    '<button class="pick-btn" type="button" aria-haspopup="listbox" aria-expanded="false">' +
      '<i class="pick-dot ' + (класи[зараз] || '') + '"></i>' +
      '<span>' + esc(зараз) + '</span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>' +
    '</button>' +
    '<div class="pick-menu" role="listbox" hidden>' +
      варіанти.map(x =>
        '<button type="button" role="option" class="pick-opt' + (x === зараз ? ' on' : '') + '" ' +
        'aria-selected="' + (x === зараз) + '" data-val="' + esc(x) + '">' +
          '<i class="pick-dot ' + (класи[x] || '') + '"></i>' + esc(x) +
        '</button>').join('') +
    '</div></div>';
}

function закритиПікери(крім) {
  $$('.pick').forEach(p => {
    if (p === крім) return;
    p.querySelector('.pick-menu').hidden = true;
    p.querySelector('.pick-btn').setAttribute('aria-expanded', 'false');
  });
}

document.addEventListener('click', e => {
  const кнопка = e.target.closest('.pick-btn');
  if (кнопка) {
    const pick = кнопка.closest('.pick');
    const меню = pick.querySelector('.pick-menu');
    const було = меню.hidden;
    закритиПікери(pick);
    меню.hidden = !було;
    кнопка.setAttribute('aria-expanded', String(було));
    return;
  }
  const вибір = e.target.closest('.pick-opt');
  if (вибір) {
    const pick = вибір.closest('.pick');
    закритиПікери(null);
    if (pick.dataset.pickkind === 'client') встановитиСтанКлієнта(pick.dataset.pick, вибір.dataset.val);
    else встановитиСтатус(pick.dataset.pick, вибір.dataset.val);
    return;
  }
  if (!e.target.closest('.pick')) закритиПікери(null);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') закритиПікери(null);
});

async function встановитиСтатус(id, значення) {
  const lead = leads.find(l => l.id === id);
  const було = lead ? lead.status : null;
  if (lead) lead.status = значення;
  renderLeads();
  try {
    const відп = await api('/api/leads', { method: 'PATCH', body: JSON.stringify({ id, status: значення }) });

    const п = відп && відп.purchase;
    if (п) {
      const рядок = v => v === 'ok' ? 'відправлено ✓' : v;
      alert(п.error
        ? 'Статус змінено, але покупку не відправлено: ' + п.error
        : 'Відправка покупки в аналітику:\n\nMeta: ' + рядок(п.meta) + '\nGA4: ' + рядок(п.ga));
    }
  } catch (err) {
    if (lead) lead.status = було;
    renderLeads();
    alert('Не вдалося змінити статус: ' + err.message);
  }
}

function виноРядок(w) {
  const blinds = Array.isArray(w.blinds) ? w.blinds : null;
  if (blinds && blinds.length > 1) {
    const голова = '<div class="lead-win"><b>Вікно ' + esc(w.window) + '</b> · ' +
      esc(w.line || '') + ' · ' + blinds.length + ' штори' +
      (w.price ? ' — <b>' + esc(грн(w.price)) + ' грн</b>' : '') + '</div>';
    const рядки = blinds.map(b =>
      '<div class="lead-win lead-win--sub">Штора ' + esc(b.n) + ' · тканина ' +
      esc(b.fabricW) + '×' + esc(b.fabricH) + ' см, виріб ' + esc(b.width) + ' см · ' +
      esc(b.fabric || '') + (b.price ? ' — ' + esc(грн(b.price)) + ' грн' : '') + '</div>').join('');
    return голова + рядки;
  }
  return '<div class="lead-win"><b>Вікно ' + esc(w.window) + '</b> · ' + esc(w.line || '') +
    ' · тканина ' + esc(w.fabricW) + '×' + esc(w.fabricH) + ' см, виріб ' +
    esc(w.width) + '×' + esc(w.height) + ' см · ' + esc(w.fabric || '') +
    (w.system ? ', ' + esc(w.system) : '') +
    (w.price ? ' — <b>' + esc(грн(w.price)) + ' грн</b>' : '') + '</div>';
}

function renderLeads() {
  const box = $('#leadList');
  const shown = leads
    .filter(l => !filter || (l.status || 'нова') === filter)
    .filter(l => !kind   || типЗаявки(l) === kind);

  if (!shown.length) {
    box.innerHTML = '<div class="empty">' +
      (leads.length ? 'За цим відбором заявок немає.' : 'Заявок поки немає.') + '</div>';
    return;
  }

  box.innerHTML = shown.map(l => {

    try { return leadCard(l); }
    catch (err) {
      console.error('Заявка не відмальовується:', l && l.id, err);
      return '<article class="lead"><div class="lead-top">' +
        '<span class="lead-name">Пошкоджена заявка</span>' +
        '<span class="lead-when">' + esc(String((l && l.at) || '').slice(0, 16).replace('T', ' ')) + '</span></div>' +
        '<div class="lead-meta"><span class="chip">' + esc(String((l && l.name) || '').slice(0, 60)) + ' ' +
          esc(String((l && l.phone) || '').slice(0, 24)) + '</span></div>' +
        '<div class="lead-act"><button class="del" type="button" data-drop="' + esc(String((l && l.id) || '')) + '">Видалити</button></div>' +
        '</article>';
    }
  }).join('');
}

function leadCard(l) {
  {
    const tel = String(l.phone || '').replace(/[^\d+]/g, '');
    const st = l.status || 'нова';
    return '<article class="lead' + (розкриті.has(l.id) ? ' open' : '') +
      (свіжі.has(l.id) ? ' fresh' : '') + '">' +
      '<div class="lead-top">' +
        '<span class="lead-name">' + esc(l.name || 'Без імені') + '</span>' +
        '<span class="lead-phone"><a href="tel:' + esc(tel) + '">' + esc(l.phone) + '</a></span>' +
        '<span class="st ' + (STCLASS[st] || '') + '">' + esc(st) + '</span>' +
        '<span class="lead-when">' + esc(when(l.at)) + '</span>' +
      '</div>' +
      '<div class="lead-meta">' +
        '<span class="chip">' + esc(l.source || 'сайт') + '</span>' +
        (l.kind ? '<span class="chip">' + esc(l.kind) + '</span>' : '') +

        (l.individual ? '<span class="chip chip--sum">інд. ціна</span>'
                      : (l.total ? '<span class="chip chip--sum">' + esc(грн(l.total)) + ' грн</span>' : '')) +
        (utmМітка(l.utm) ? '<span class="chip chip--utm">📣 ' + esc(utmМітка(l.utm)) + '</span>' : '') +
      '</div>' +
      ((l.windows || []).length
        ? '<div class="lead-wins">' + l.windows.map(виноРядок).join('') + '</div>'
        : '') +
      (l.note ? '<div class="lead-note">' + esc(l.note) + '</div>' : '') +
      '<div class="lead-act">' +
        статусПікер(l.id, st) +
        '<button class="more-btn" type="button" data-all="' + esc(l.id) + '">' +
          (розкриті.has(l.id) ? 'Згорнути' : 'Детальніше') + '</button>' +
        '<button class="del" type="button" data-drop="' + esc(l.id) + '">Видалити</button>' +
      '</div>' +
      leadDetail(l) +
    '</article>';
  }
}

$('#leadList').onclick = async e => {
  if (e.target.closest('.pick')) return;
  const t = e.target.closest('[data-all]');
  if (t) {
    const id = t.dataset.all;
    const card = t.closest('.lead');
    const відкрито = card.classList.toggle('open');
    if (відкрито) розкриті.add(id); else розкриті.delete(id);
    t.textContent = відкрито ? 'Згорнути' : 'Детальніше';
    return;
  }
  const d = e.target.closest('[data-drop]');
  if (!d) return;
  const lead = leads.find(l => l.id === d.dataset.drop);
  if (!lead) return;
  if (!confirm('Видалити заявку від «' + (lead.name || 'без імені') + '»? Це не можна скасувати.')) return;
  try {
    await api('/api/leads?id=' + encodeURIComponent(lead.id), { method: 'DELETE' });
    loadLeads(true);
  } catch (err) {
    alert('Не вдалося видалити: ' + err.message);
  }
};

let клієнти = [], клФільтр = '', клПошук = '', клСтан = '';
let клНеповна = false;

let СТАНИ = ['нова', 'дзвонили', 'не додзвонились', 'не актуально'];
const СТАН_КЛАС = {
  'нова': 'st-new', 'дзвонили': 'st-call',
  'не додзвонились': 'st-work', 'не актуально': 'st-done'
};

async function встановитиСтанКлієнта(key, стан) {
  const к = клієнти.find(x => x.key === key);
  const було = к ? к.state : null;
  if (к) к.state = стан;
  renderClients();
  try {
    await api('/api/clients', { method: 'PATCH', body: JSON.stringify({ key, state: стан }) });
  } catch (err) {
    if (к) к.state = було;
    renderClients();
    alert('Не вдалося зберегти стан: ' + err.message);
  }
}

const КЛ_ФІЛЬТРИ = {
  '':         () => true,
  order:      к => к.orders > 0,
  hold:       к => к.holds > 0,
  chat:       к => к.chat || к.chats > 0,
  quiz:       к => к.quiz && !к.orders && !к.holds
};

async function loadClients() {
  const box = $('#clientsBox');
  box.innerHTML = '<div class="empty">Завантажуємо…</div>';
  let d;
  try {
    d = await api('/api/clients');
  } catch (err) {
    box.innerHTML = '<div class="empty">Не вдалося зібрати базу: ' + esc(err.message) + '</div>';
    return;
  }
  клієнти = d.clients || [];
  if (Array.isArray(d.states) && d.states.length) СТАНИ = d.states;
  клНеповна = Boolean(d.partial);
  $('#clientCount').textContent = клієнти.length ? String(клієнти.length) : '';
  renderClients();
}

function діїКлієнта(к) {
  const out = [];
  if (к.orders) out.push({ t: к.orders + ' ' + скільки(к.orders, 'замовлення', 'замовлення', 'замовлень'), c: 'chip--ok' });
  if (к.holds)  out.push({ t: к.holds + ' ' + скільки(к.holds, 'фіксація знижки', 'фіксації знижки', 'фіксацій знижки'), c: 'chip--warn' });
  if (к.chat || к.chats) out.push({ t: 'була в чаті', c: '' });
  if (к.quiz && !к.orders) out.push({ t: 'проходила калькулятор', c: '' });
  if (!out.length) out.push({ t: 'лишила контакт', c: '' });
  return out;
}

function renderClients() {
  const q = клПошук.trim().toLowerCase();
  const цифри = q.replace(/\D/g, '');
  const список = клієнти
    .filter(КЛ_ФІЛЬТРИ[клФільтр] || КЛ_ФІЛЬТРИ[''])
    .filter(к => !клСтан || (к.state || 'нова') === клСтан)
    .filter(к => !q ||
      String(к.name || '').toLowerCase().includes(q) ||
      (цифри && String(к.phone || '').replace(/\D/g, '').includes(цифри)));

  const замовили = клієнти.filter(к => к.orders).length;
  const фіксували = клієнти.filter(к => к.holds && !к.orders).length;
  const сума = клієнти.reduce((n, к) => n + (к.total || 0), 0);

  const зведення =
    '<div class="stats">' +
      '<div class="stat"><b>' + грн(клієнти.length) + '</b><span>людей у базі</span></div>' +
      '<div class="stat"><b>' + грн(замовили) + '</b><span>оформили замовлення</span></div>' +
      '<div class="stat"><b>' + грн(фіксували) + '</b><span>лише зафіксували знижку</span></div>' +
      '<div class="stat"><b>' + грн(сума) + '</b><span>на суму, грн</span></div>' +
    '</div>' +
    (клНеповна ? '<div class="note">Заявок більше, ніж ми переглядаємо за раз: ' +
      'у базі показані найсвіжіші дві тисячі.</div>' : '');

  const рядки = список.length
    ? список.map(к => {
        const tel = String(к.phone || '').replace(/[^\d+]/g, '');
        return '<div class="crow crow--cl" data-client="' + esc(к.key) + '">' +
          '<span class="cl-name">' + esc(к.name || 'Без імені') + '</span>' +
          '<a class="cl-phone" href="tel:' + esc(tel) + '">' + esc(к.phone) + '</a>' +
          '<span class="crow-tags">' +
            діїКлієнта(к).map(d => '<i class="chip ' + d.c + '">' + esc(d.t) + '</i>').join('') +
            (utmМітка(к.utm) ? '<i class="chip chip--utm">📣 ' + esc(utmМітка(к.utm)) + '</i>' : '') +
          '</span>' +
          '<span class="cl-sum">' + (к.total ? грн(к.total) + ' грн' : '') + '</span>' +
          '<span class="cl-state">' +
            пікер('client', к.key, к.state || 'нова', СТАНИ, СТАН_КЛАС) +
          '</span>' +
          '<span class="crow-when">' + esc(when(к.last)) + '</span>' +
        '</div>';
      }).join('')
    : '<div class="empty">' + (клієнти.length ? 'За цим відбором нікого немає.'
        : 'Поки нікого: база складається з заявок, у яких є імʼя й телефон.') + '</div>';

  $('#clientsBox').innerHTML = зведення +
    '<div class="card"><h3>Клієнти</h3>' +
      '<div class="toolbar">' +
        '<div class="seg" id="clFilters">' +
          ['', 'order', 'hold', 'chat', 'quiz'].map(k =>
            '<button type="button" data-cl="' + k + '"' + (клФільтр === k ? ' class="on"' : '') + '>' +
            ({ '': 'Усі', order: 'Замовили', hold: 'Фіксували знижку',
               chat: 'Були в чаті', quiz: 'Лише рахували' })[k] + '</button>').join('') +
        '</div>' +
        '<input type="search" id="clSearch" placeholder="Імʼя або номер" value="' + esc(клПошук) + '">' +
      '</div>' +
      '<div class="filters" id="clStates">' +
        '<button type="button" data-cs=""' + (клСтан ? '' : ' class="on"') + '>Будь-який стан</button>' +
        СТАНИ.map(x => '<button type="button" data-cs="' + esc(x) + '"' +
          (клСтан === x ? ' class="on"' : '') + '>' + esc(x) + '</button>').join('') +
      '</div>' +
      '<div class="crows">' + рядки + '</div>' +
    '</div>';

  const пошук = $('#clSearch');
  if (пошук) пошук.oninput = () => {
    клПошук = пошук.value;
    const де = пошук.selectionStart;
    renderClients();
    const новий = $('#clSearch');
    if (новий) { новий.focus(); try { новий.setSelectionRange(де, де); } catch (e) {} }
  };
}

$('#clientsBox').onclick = e => {

  if (e.target.closest('.pick')) return;
  const f = e.target.closest('[data-cl]');
  if (f) { клФільтр = f.dataset.cl; renderClients(); return; }
  const st = e.target.closest('[data-cs]');
  if (st) { клСтан = st.dataset.cs; renderClients(); return; }

  if (e.target.closest('.cl-phone')) return;
  const r = e.target.closest('[data-client]');
  if (r) openClient(r.dataset.client);
};

const ДІЯ_НАЗВА = { 'замовлення': 'Замовлення', 'фіксація': 'Фіксація знижки', 'чат': 'Звернення з чату', 'перегляд': 'Рахував ціну' };

function openClient(key) {
  const к = клієнти.find(x => x.key === key);
  if (!к) return;
  openViewer(к.name || 'Клієнт');
  $('#viewerBody').innerHTML =
    '<div class="facts">' +
      факт('Телефон', к.phone) +
      факт('Стан', к.state || 'нова') +
      факт('Перше звернення', when(к.first)) +
      факт('Останнє звернення', when(к.last)) +
      факт('Звернень усього', к.leads.length) +
      факт('На суму', к.total ? грн(к.total) + ' грн' : '') +
      факт('Часу на сайті', час(к.secs)) +
      факт('Сторінки', (к.pages || []).join(', ')) +
      факт('Реклама', к.utm ? Object.entries(к.utm).map(([a, b]) => a + '=' + b).join(', ') : '') +
    '</div>' +
    '<h4>Що робила</h4>' +
    '<div class="crows">' + к.leads.map(l =>
      '<div class="crow crow--still">' +
        '<span class="crow-when">' + esc(when(l.at)) + '</span>' +
        '<span class="crow-first">' + esc(l.kind || ДІЯ_НАЗВА[l.act] || l.act) + '</span>' +
        '<span class="crow-tags">' +
          (l.total ? '<i class="chip chip--sum">' + грн(l.total) + ' грн</i>' : '') +
          '<i class="chip">' + esc(l.status) + '</i>' +
        '</span>' +
      '</div>').join('') + '</div>';
}

let чати = [], чатВід = 0, чатВсього = 0;
let чатЗвід = { розмов: 0, реплік: 0, калькулятор: 0 };
let чатТоп = [];
let лишеКвіз = false;

async function loadChats(reset) {
  const box = $('#chatsBox');
  if (reset) { чатВід = 0; чати = []; box.innerHTML = '<div class="empty">Завантажуємо…</div>'; }
  let d;
  try {
    d = await api('/api/chats?from=' + чатВід);
  } catch (err) {
    box.innerHTML = '<div class="empty">Не вдалося завантажити історію: ' + esc(err.message) + '</div>';
    return;
  }
  чати = чати.concat(d.chats || []);
  чатВсього = d.total || 0;
  чатВід += (d.chats || []).length;
  чатЗвід = d.stats || чатЗвід;
  чатТоп = d.top || [];
  renderChats();
}

function коротко(t, n) {
  const s = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function скільки(n, одна, дві, багато) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return одна;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return дві;
  return багато;
}

function renderChats() {
  const з = чатЗвід;
  const частка = з.розмов ? Math.round(з.калькулятор / з.розмов * 100) : 0;
  const список = лишеКвіз ? чати.filter(c => c.quiz) : чати;
  const макс = чатТоп.length ? чатТоп[0].n : 1;

  const зведення =
    '<div class="stats">' +
      '<div class="stat"><b>' + грн(з.розмов) + '</b><span>розмов із помічником</span></div>' +
      '<div class="stat"><b>' + грн(з.реплік) + '</b><span>питань від людей</span></div>' +
      '<div class="stat"><b>' + грн(з.калькулятор) + '</b><span>пішли в калькулятор' +
        (з.розмов ? ' · ' + частка + '%' : '') + '</span></div>' +
    '</div>';

  const питання = чатТоп.length
    ? '<div class="card"><h3>Про що питають найчастіше</h3>' +
      '<p class="hint">Однакові питання зведені разом. Якщо щось тримається в цьому ' +
      'списку місяцями — відповідь варто додати прямо на сторінку, щоб не питали.</p>' +
      '<div class="qlist">' + чатТоп.map(q =>
        '<div class="q"><span class="q-txt">' + esc(q.text) + '</span>' +
        '<span class="q-bar"><i style="width:' + Math.max(6, Math.round(q.n / макс * 100)) + '%"></i></span>' +
        '<b class="q-n">' + q.n + '</b></div>').join('') +
      '</div></div>'
    : '<div class="card"><h3>Про що питають найчастіше</h3>' +
      '<p class="hint">Поки жодне питання не повторилось двічі — список зʼявиться, ' +
      'коли назбирається трохи розмов.</p></div>';

  const рядки = список.length
    ? список.map(c =>
        '<button class="crow" type="button" data-copen="' + esc(c.id) + '">' +
          '<span class="crow-when">' + esc(when(c.updated || c.at)) + '</span>' +
          '<span class="crow-first">' + esc(коротко(c.first, 110) || 'без питання') + '</span>' +
          '<span class="crow-tags">' +
            '<i class="chip">' + c.turns + ' ' + скільки(c.turns, 'репліка', 'репліки', 'реплік') + '</i>' +
            (c.quiz ? '<i class="chip chip--warn">показали калькулятор</i>' : '') +
          '</span>' +
        '</button>').join('')
    : '<div class="empty">' + (чати.length ? 'У цьому фільтрі розмов немає.' : 'Розмов поки немає.') + '</div>';

  $('#chatsBox').innerHTML = зведення + питання +
    '<div class="card"><h3>Розмови</h3>' +
      '<div class="filters" id="chatFilters">' +
        '<button type="button" data-cf="" class="' + (лишеКвіз ? '' : 'on') + '">Усі</button>' +
        '<button type="button" data-cf="esc" class="' + (лишеКвіз ? 'on' : '') + '">З кнопкою на калькулятор</button>' +
      '</div>' +
      '<div class="crows">' + рядки + '</div>' +
      (чатВід < чатВсього
        ? '<button class="btn btn-o" type="button" data-cmore="1" style="margin-top:14px">Показати ще</button>'
        : '') +
    '</div>';
}

$('#chatsBox').onclick = e => {
  const f = e.target.closest('[data-cf]');
  if (f) { лишеКвіз = f.dataset.cf === 'esc'; renderChats(); return; }
  if (e.target.closest('[data-cmore]')) { loadChats(false); return; }
  const o = e.target.closest('[data-copen]');
  if (o) openChatView(o.dataset.copen);
};

const viewer = $('#viewer');

function closeViewer() { viewer.hidden = true; }
function openViewer(назва) {
  viewer.hidden = false;
  $('#viewerTitle').textContent = назва;
  $('#viewerBody').scrollTop = 0;
}
$('#viewerX').onclick = closeViewer;
viewer.onclick = e => { if (e.target === viewer) closeViewer(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !viewer.hidden) closeViewer(); });

async function openChatView(id) {
  openViewer('Розмова з помічником');
  $('#viewerBody').innerHTML = '<div class="empty">Завантажуємо…</div>';
  let d;
  try {
    d = await api('/api/chats?id=' + encodeURIComponent(id));
  } catch (err) {
    $('#viewerBody').innerHTML = '<div class="empty">Не вдалося відкрити: ' + esc(err.message) + '</div>';
    return;
  }
  const c = d.chat || {};
  const utm = Object.entries(c.utm || {}).filter(([, v]) => v);
  $('#viewerBody').innerHTML =
    '<div class="facts">' +
      факт('Почалась', when(c.at)) +
      факт('Остання репліка', when(c.updated)) +
      факт('Сторінка', c.page) +
      факт('Реплік', c.turns) +
      факт('Показали калькулятор', (c.quiz || c.escalated) ? 'так' : 'ні') +
      (utm.length ? факт('Звідки', utm.map(([k, v]) => k + '=' + v).join(', ')) : '') +
    '</div>' +
    '<div class="talk">' + (c.messages || []).map(m =>
      '<div class="bub bub--' + (m.who === 'me' ? 'me' : 'bot') + '">' +
        '<i>' + (m.who === 'me' ? 'людина' : 'помічник') + '</i>' +
        esc(m.text).split('\n').join('<br>') +
      '</div>').join('') + '</div>';
}

async function loadHealth() {
  const box = $('#systemBox');
  let h;
  try {
    h = await api('/api/health');
  } catch (err) {
    box.innerHTML = '<div class="note">Не вдалося отримати стан: ' + esc(err.message) + '</div>';
    return;
  }
  const row = (label, ok, text) =>
    '<div class="state-row"><i class="dot ' + (ok ? 'dot-on' : 'dot-off') + '"></i>' +
    '<b>' + esc(label) + '</b><span>' + esc(text) + '</span></div>';

  box.innerHTML =
    (h.готово
      ? '<div class="note note--ok">Усе підключено: заявки зберігаються й не загубляться.</div>'
      : '<div class="note">Поки не все підключено. Заявки, що приходять зараз, ' +
        'можуть зникнути при перезапуску сервера.</div>') +
    '<div class="card"><h3>Що працює</h3><div class="state">' +
      row('Сховище заявок', h.постійне, h.сховище) +
      row('Вхід в адмінку', h.адмінка, h.адмінка ? 'налаштовано' : 'немає ADMIN_PASSWORD_HASH або ADMIN_SESSION_SECRET') +
      row('Помічник у чаті', h.помічник, h.помічник ? 'відповідає ІІ' : 'працюють заготовлені відповіді, немає OPENAI_API_KEY') +
      row('Telegram менеджерам', h.telegram, h.telegram ? 'заявки дублюються в чат' : 'немає TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT_ID') +
    '</div></div>' +

    (роль === 'admin'
      ? '<div class="card" id="tgCard"><h3>Telegram: хто отримує заявки</h3>' +
          '<p class="hint">Кожен у цьому списку отримує ім\u2019я, телефон і суму кожної заявки. ' +
          'Якщо тут є незнайома людина — натисніть «Прибрати». Нового менеджера підключайте кнопкою нижче: ' +
          'посилання одноразове і діє 30 хвилин. Без такого посилання бот більше нікого не підписує.</p>' +
          '<div id="tgBody">Завантажуємо…</div></div>'
      : '') +

    '<div class="card"><h3>Аналітика</h3>' +
      '<p class="hint">Ідентифікатор Google Analytics 4, виду G-XXXXXXXXXX. ' +
      'Поки поле порожнє, жоден сторонній скрипт на сайт не вантажиться.</p>' +
      '<div class="grid">' +
        field('GA4', 'analytics.ga4', (draft.analytics || {}).ga4) +
      '</div></div>';
  bind(box);
  if (роль === 'admin') renderTg();
}

async function renderTg() {
  const body = $('#tgBody');
  if (!body) return;
  let d;
  try { d = await api('/api/tg?admin=1'); }
  catch (err) { body.innerHTML = '<p class="hint">Не вдалося отримати список: ' + esc(err.message) + '</p>'; return; }
  const subs = d.subs || [];
  body.innerHTML =
    (subs.length
      ? '<div class="state">' + subs.map(x =>
          '<div class="state-row"><i class="dot ' + (x.gone ? 'dot-off' : 'dot-on') + '"></i>' +
          '<b>' + esc(x.name || 'Без імені') + '</b>' +
          '<span>' + (x.username ? '@' + esc(x.username) + ' · ' : '') + 'id ' + esc(x.id) +
            (x.gone ? ' · чат недоступний' : '') + '</span>' +
          '<button class="btn btn-o" type="button" data-tgdel="' + esc(x.id) + '" style="margin-left:auto">Прибрати</button>' +
          '</div>').join('') + '</div>'
      : '<p class="hint">Через бота заявки зараз не отримує ніхто.</p>') +
    (d.fixed ? '<p class="hint" style="margin-top:10px">Ще ' + d.fixed + ' чат(и) задано в TELEGRAM_CHAT_ID на Vercel — вони отримують заявки завжди.</p>' : '') +
    (!d.secret ? '<p class="hint" style="margin-top:10px">⚠ На Vercel не задано TELEGRAM_WEBHOOK_SECRET. ' +
      'Бот працює, але краще задати секрет і перепідключити вебхук.</p>' : '') +
    '<button class="btn btn-p" type="button" id="tgNew" style="margin-top:14px"' + (d.token ? '' : ' disabled') + '>' +
      'Підключити менеджера</button>' +
    '<div id="tgLink" style="margin-top:12px"></div>';

  body.querySelectorAll('[data-tgdel]').forEach(b => b.onclick = async () => {
    if (!confirm('Прибрати цей чат? Він перестане отримувати заявки.')) return;
    b.disabled = true;
    try { await api('/api/tg?admin=1&id=' + encodeURIComponent(b.dataset.tgdel), { method: 'DELETE' }); renderTg(); }
    catch (err) { b.disabled = false; alert('Не вдалося: ' + err.message); }
  });
  const нове = $('#tgNew');
  if (нове) нове.onclick = async () => {
    нове.disabled = true;
    try {
      const r = await api('/api/tg?admin=1', { method: 'POST' });
      $('#tgLink').innerHTML =
        '<p class="hint">Надішліть це посилання менеджеру. Він відкриває його й натискає «Запустити» (Start) — ' +
        'і заявки починають приходити. Діє ' + esc(r.minutes) + ' хв, спрацьовує один раз.</p>' +
        '<input type="text" readonly id="tgLinkInp" value="' + esc(r.link) + '" style="width:100%">';

      const inp = $('#tgLinkInp');
      if (inp) { inp.onclick = () => inp.select(); inp.select(); }
    } catch (err) { alert('Не вдалося створити посилання: ' + err.message); }
    нове.disabled = false;
  };
}

const BUILDER_PAGES = [
  { id: 'index', url: '/index.html',            name: 'Головна' },
  { id: 'kviz',  url: '/kviz.html?line=roller', name: 'Калькулятор' },
  { id: 'blog',  url: '/blog.html',             name: 'Блог' },
  { id: 'umovy', url: '/umovy.html',            name: 'Умови' }
];
const BUILDER_CSS = [
  'body.bld-edit [data-bld]{cursor:pointer;outline:2px dashed transparent;outline-offset:3px;',
  '  transition:outline-color .12s,background-color .12s;border-radius:3px}',
  'body.bld-edit [data-bld="txt"]:hover{outline-color:#C5925E;background:rgba(197,146,94,.14)}',
  'body.bld-edit [data-bld="img"]:hover{outline-color:#C5925E;outline-style:solid;outline-width:3px}',
  '[data-bld].bld-editing{outline:2px solid #0F7A52;background:rgba(15,122,82,.08);cursor:text;min-height:1.3em}',

  'body.bld-edit [data-bld="txt"]:empty{min-height:1.3em;min-width:90px;outline-color:rgba(197,146,94,.55)}',
  'body.bld-edit [data-bld="txt"]:empty:not(.bld-editing)::before{content:"Натисніть, щоб ввести текст";opacity:.45;font-style:italic;font-weight:400}',

  'body.bld-edit .kv-fabimg.has-win .ff-hint{display:flex;flex-direction:column;align-items:flex-start;gap:5px;',
  '  opacity:1!important;visibility:visible!important;pointer-events:auto;text-align:left;padding:8px 12px}',
  'body.bld-edit .kv-fabimg .ff-hint > span{display:block!important}',
  'body.bld-edit .kv-fabimg .ff-hint-pc::before{content:"ПК: ";opacity:.6;font-weight:400;font-style:normal}',
  'body.bld-edit .kv-fabimg .ff-hint-mob::before{content:"Телефон: ";opacity:.6;font-weight:400;font-style:normal}',
  'body.bld-edit .kv-fabimg .ff-hint-pc[data-bld]:empty:not(.bld-editing)::before{content:"ПК: (порожньо — натисніть)"}',
  'body.bld-edit .kv-fabimg .ff-hint-mob[data-bld]:empty:not(.bld-editing)::before{content:"Телефон: (порожньо — натисніть)"}'
].join('\n');

const BLD_TEXT_SEL = 'h1,h2,h3,h4,h5,h6,p,span,b,strong,em,i,small,li,a,button,figcaption,label,blockquote,td,th,summary,dt,dd,caption';

const BLD_SKIP = '.amb,.loader,#loader,.skip,.thm,.mnav,.lbox,.kv-toggle,.ck-banner,.exp--auto,[data-noedit],[class*="chat" i],#fabStrip,#priceWins,[data-dyn]';
const BLD_FAB  = '#fabStrip,.fabs,.fab,.sw-card,.swatches,.kv-fab,.kv-fabs,.kv-fabimg,.kv-fabview,.fsel';

let builderBuilt = false;
let builderPage = 'index';
let builderEdit = true;

function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/"/g, '\\"'); }

function htmlToMarkup(el) {
  let out = '';
  el.childNodes.forEach(n => {
    if (n.nodeType === 3) out += n.textContent;
    else if (n.nodeType === 1) {
      const t = n.tagName;
      if (t === 'BR') out += '\n';
      else if (/^(B|STRONG)$/.test(t)) out += '**' + n.textContent + '**';
      else if (/^(EM|I)$/.test(t)) out += '*' + n.textContent + '*';
      else out += n.textContent;
    }
  });
  return out;
}

function ceReadMarkup(el) {
  let out = '';
  const walk = node => {
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) out += n.textContent;
      else if (n.nodeType === 1) {
        const t = n.tagName;
        if (t === 'BR') out += '\n';
        else if (/^(DIV|P)$/.test(t)) {
          if (out && !out.endsWith('\n')) out += '\n';
          walk(n);
          if (!out.endsWith('\n')) out += '\n';
        } else walk(n);
      }
    });
  };
  walk(el);
  return out.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n');
}

function bldTextOk(el) {
  if (el.closest('script,style,noscript')) return false;
  if (el.closest(BLD_SKIP)) return false;
  const win = el.ownerDocument.defaultView;
  const txt = win.fshDirectText ? win.fshDirectText(el) : el.textContent;
  return txt.trim().length > 0;
}

function bldHasEditableAncestor(el) {
  let p = el.parentElement;
  while (p && p.tagName !== 'BODY') {
    if (p.matches(BLD_TEXT_SEL) && bldTextOk(p)) return true;
    p = p.parentElement;
  }
  return false;
}
function bldFabricImg(el) {
  if (el.closest(BLD_FAB)) return true;
  const s = (el.getAttribute('src') || '') + ' ' + (el.getAttribute('data-img') || '');
  return /\/rolls\/|\/fabwin\//.test(s);
}

function renderBuilder() {
  const box = $('#builderBox');
  if (!builderBuilt) {
    box.innerHTML =
      '<div class="note">Натисніть на будь-який <b>текст</b> або <b>фото</b> прямо на сторінці, щоб змінити — ' +
      'усе, що підсвічується пунктиром. Текст міняється тут одразу, зберігає кнопка «Зберегти зміни» вгорі; ' +
      'фото зберігається саме. Щоб слово стало бежевим — обгорніть його в *зірочки*, ' +
      'жирним — у **дві зірочки**; новий рядок — <b>Enter</b>, порожній рядок між абзацами теж робиться Enter. ' +
      'Завершити правку — клік поза текстом або <b>Esc</b>. ' +
      'Тканини міняються в розділі «Тканини».<br>' +
      'Щоб натиснути кнопку на сторінці (напр. пройти калькулятор), увімкніть «<b>Перегляд</b>» — ' +
      'тоді кліки працюють як на сайті. Повернете «Редагування» — знову можна міняти тексти.</div>' +
      '<div class="bld-tabs" id="bldTabs">' +
        BUILDER_PAGES.map(p => '<button type="button" data-page="' + p.id + '">' + esc(p.name) + '</button>').join('') +
        '<span class="bld-spacer"></span>' +
        '<button type="button" class="bld-mode on" id="bldMode">✎ Редагування</button>' +
        '<button type="button" class="bld-reload" id="bldReload" title="Оновити сторінку">↻ Оновити</button>' +
        '<a class="bld-open" id="bldOpen" target="_blank" rel="noopener">Відкрити ↗</a>' +
      '</div>' +
      '<div class="bld-frame"><iframe id="bldFrame" title="Перегляд сайту"></iframe>' +
        '<div class="bld-load" id="bldLoad">Завантажуємо сторінку…</div></div>';
    $('#bldTabs').addEventListener('click', e => {
      if (e.target.closest('#bldMode')) { setBuilderMode(!builderEdit); return; }
      if (e.target.closest('#bldReload')) { openBuilderPage(builderPage); return; }
      const b = e.target.closest('[data-page]');
      if (b) openBuilderPage(b.dataset.page);
    });
    $('#bldFrame').addEventListener('load', wireBuilderFrame);
    builderBuilt = true;
  }
  openBuilderPage(builderPage);
}

function openBuilderPage(id) {
  const p = BUILDER_PAGES.find(x => x.id === id) || BUILDER_PAGES[0];
  builderPage = p.id;
  $$('#bldTabs [data-page]').forEach(b => b.classList.toggle('on', b.dataset.page === p.id));
  const open = $('#bldOpen'); if (open) open.href = p.url;
  const load = $('#bldLoad'); if (load) load.style.display = '';
  const frame = $('#bldFrame');
  frame.src = p.url + (p.url.includes('?') ? '&' : '?') + '_bld=' + Date.now();
}

function wireBuilderFrame() {
  const load = $('#bldLoad'); if (load) load.style.display = 'none';
  const frame = $('#bldFrame');
  let doc, win;
  try { doc = frame.contentDocument; win = frame.contentWindow; } catch (e) { return; }
  if (!doc || !doc.body || !win || !win.fshDomPath) {
    if (doc && doc.body) setTimeout(wireBuilderFrame, 300);
    return;
  }

  doc.body.classList.toggle('bld-edit', builderEdit);
  const apply = () => applyDraftToFrame(doc);
  const rewire = () => wireEditable(doc);
  apply(); rewire();
  doc.addEventListener('cfg-updated', () => { apply(); rewire(); });
  setTimeout(() => { apply(); rewire(); }, 700);
  setTimeout(() => { apply(); rewire(); }, 1700);

  if (!doc.getElementById('bldStyle')) {
    const st = doc.createElement('style');
    st.id = 'bldStyle';
    st.textContent = BUILDER_CSS;
    doc.head.appendChild(st);
  }

  doc.addEventListener('click', e => {
    const bld = e.target.closest('[data-bld]');
    if (builderEdit && bld && !bld.isContentEditable) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (bld.getAttribute('data-bld') === 'img') pickBuilderImage(bld);
      else startTextEdit(bld);
      return;
    }

    if (builderEdit && bld && bld.isContentEditable) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    const a = e.target.closest('a');
    if (a) e.preventDefault();
  }, true);
  doc.addEventListener('submit', e => { if (builderEdit) e.preventDefault(); }, true);
}

function setBuilderMode(on) {
  builderEdit = on;
  const btn = $('#bldMode');
  if (btn) { btn.textContent = on ? '✎ Редагування' : '👁 Перегляд'; btn.classList.toggle('on', on); }
  try {
    const b = $('#bldFrame').contentDocument.body;
    if (b) b.classList.toggle('bld-edit', on);
  } catch (e) {}
}

function wireEditable(doc) {
  doc.querySelectorAll(BLD_TEXT_SEL).forEach(el => {
    if (el.dataset.bldWired || bldHasEditableAncestor(el)) return;

    if (!bldTextOk(el) && !el.hasAttribute('data-txt')) return;
    el.dataset.bldWired = '1';
    el.setAttribute('data-bld', 'txt');
  });
  doc.querySelectorAll('img').forEach(el => {
    if (el.dataset.bldWired || bldFabricImg(el) || el.closest(BLD_SKIP)) return;
    el.dataset.bldWired = '1';
    el.setAttribute('data-bld', 'img');
  });
}

function applyDraftToFrame(doc) {
  const win = doc.defaultView;
  if (!win.fshRenderText) return;
  const pk = win.fshPageKey();
  const t = draft.texts || {};
  for (const k in t) {
    if (t[k] == null) continue;
    doc.querySelectorAll('[data-txt="' + cssEsc(k) + '"]').forEach(el => win.fshRenderText(el, t[k]));
  }
  const dyn = el => !!(win.fshDynamic && win.fshDynamic(el));
  const ta = (draft.txauto || {})[pk] || {};
  for (const p in ta) {
    const el = win.fshResolvePath(p);

    if (dyn(el)) { delete ta[p]; continue; }
    if (el) win.fshRenderText(el, ta[p]);
  }
  const im = draft.images || {};
  for (const k in im) {
    if (!im[k]) continue;
    doc.querySelectorAll('[data-img="' + cssEsc(k) + '"]').forEach(el => win.fshSetImg(el, im[k]));
  }
  const ia = (draft.imgauto || {})[pk] || {};
  for (const p in ia) {
    const el = win.fshResolvePath(p);
    if (dyn(el)) { delete ia[p]; continue; }
    if (el && el.tagName === 'IMG') win.fshSetImg(el, ia[p]);
  }
}

function saveBuilderText(el, val) {
  const win = el.ownerDocument.defaultView;
  const named = el.getAttribute('data-txt');
  if (named) {
    draft.texts = draft.texts || {};
    draft.texts[named] = val;
  } else {
    const pk = win.fshPageKey(), path = win.fshDomPath(el);
    draft.txauto = draft.txauto || {};
    draft.txauto[pk] = draft.txauto[pk] || {};
    draft.txauto[pk][path] = val;
  }
  markDirty();
  win.fshRenderText(el, val);
}

function startTextEdit(el) {
  const win = el.ownerDocument.defaultView;
  const foreign = win.fshForeign ? win.fshForeign(el) : !!el.querySelector('a,svg,img,button,picture');

  if (foreign) {
    const cur = (win.fshDirectText ? win.fshDirectText(el) : el.textContent).trim();
    const val = window.prompt('Текст:', cur);
    if (val == null) return;
    saveBuilderText(el, val.trim());
    return;
  }
  if (el.isContentEditable) return;

  const originalHTML = el.innerHTML;
  const restore = htmlToMarkup(el);
  el.textContent = restore;
  el.classList.add('bld-editing');
  el.setAttribute('contenteditable', 'true');
  el.focus();
  try { const s = el.ownerDocument.getSelection(); s.selectAllChildren(el); } catch (e) {}

  let done = false;
  const finish = save => {
    if (done) return; done = true;
    el.removeAttribute('contenteditable');
    el.classList.remove('bld-editing');
    el.removeEventListener('blur', onBlur);
    el.removeEventListener('keydown', onKey);
    el.removeEventListener('paste', onPaste);
    el.removeEventListener('keyup', onKeyUp);
    const val = ceReadMarkup(el).trim();
    if (save && val !== restore.trim()) saveBuilderText(el, val);
    else el.innerHTML = originalHTML;
  };
  const onBlur = () => finish(true);

  const asButton = /^(BUTTON|SUMMARY)$/.test(el.tagName) || el.getAttribute('role') === 'button';
  const isSpace = e => e.key === ' ' || e.code === 'Space';
  const onKey = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) el.blur();
      else el.ownerDocument.execCommand('insertLineBreak');
    } else if (e.key === 'Escape') { e.preventDefault(); finish(false); }

    else if (isSpace(e) && asButton) {
      e.preventDefault();
      el.ownerDocument.execCommand('insertText', false, ' ');
    }
  };
  const onKeyUp = e => { if (isSpace(e) && asButton) e.preventDefault(); };

  const onPaste = e => {
    e.preventDefault();
    const cb = e.clipboardData || win.clipboardData;
    const text = cb ? cb.getData('text/plain') : '';
    const doc = el.ownerDocument;
    text.split(/\r?\n/).forEach((line, i) => {
      if (i) doc.execCommand('insertLineBreak');
      if (line) doc.execCommand('insertText', false, line);
    });
  };
  el.addEventListener('blur', onBlur);
  el.addEventListener('keydown', onKey);
  el.addEventListener('paste', onPaste);
  el.addEventListener('keyup', onKeyUp);
}

function pickBuilderImage(el) {
  const win = el.ownerDocument.defaultView;
  const key = el.getAttribute('data-img');
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    el.style.opacity = '.5';
    try {
      const nameBase = key ? key.split('.').join('-')
        : (win.fshPageKey() + '-' + win.fshDomPath(el).replace(/[^a-z0-9]+/gi, '-')).slice(0, 60);
      const url = await uploadImage(file, nameBase);
      if (key) {
        draft.images = draft.images || {};
        draft.images[key] = url;
      } else {
        const pk = win.fshPageKey(), path = win.fshDomPath(el);
        draft.imgauto = draft.imgauto || {};
        draft.imgauto[pk] = draft.imgauto[pk] || {};
        draft.imgauto[pk][path] = url;
      }
      await saveNow(key ? ['images', key] : ['imgauto', win.fshPageKey(), win.fshDomPath(el)]);
      win.fshSetImg(el, url);
    } catch (err) {
      alert('Не вдалося завантажити: ' + err.message);
    }
    el.style.opacity = '';
  };
  inp.click();
}

function renderAll() {
  if (linePick) linePick.querySelectorAll('button').forEach(
    b => b.classList.toggle('on', b.dataset.line === лінія));
  renderPrices();
  renderFabrics();
  renderContacts();
}

checkSession();

})();
