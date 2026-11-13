(function(){
  const cfg = (typeof CFG !== 'undefined') ? CFG : {};
  const track = (e,d={}) => (window.dataLayer=window.dataLayer||[]).push({event:e,...d});

  const GREETING = "Добрий день! Я помічник «Фірмової Штори» 🙂\nРозкажу про тканини, замір, оплату, доставку й гарантію.\n\nА точну ціну на ваше вікно покаже калькулятор: оберіть тканину, вкажіть розміри — і сума одразу перед очима.";

  const QUICK = ["Скільки коштує?", "Як зробити замір?", "Оплата й доставка", "Строки виготовлення"];

  const грн = n => Math.round(n).toLocaleString('uk-UA') + ' грн';
  const мінЦіна = () => (window.fshRollerMin ? window.fshRollerMin() : 0);
  const прикладЦіна = (w, h) => (window.fshRollerCheapest ? window.fshRollerCheapest(w, h) : null);
  const знижка = () => {
    const v = window.fshPromoPct ? window.fshPromoPct() : 0;
    return Math.round(v || 0);
  };
  const тканин = () => ((cfg.fabrics || []).length || 11);
  const строк = () => (cfg.production && cfg.production.public) || 'Виготовлення від 1–3 робочих днів';
  const телефон = () => {
    const d = String(cfg.phone || '').replace(/\D/g, '');
    const m = d.match(/^(?:38)?(0\d{2})(\d{3})(\d{2})(\d{2})$/);
    return m ? `+38 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : (cfg.phone || '');
  };

  const RULES = [
    { k:["замір","виміря","міряти","розмір вікна","як зняти розмір"], a:
      "Два правила, і замір вийде правильним.\n\n1. Вказуйте розмір тканини — того полотна, що затуляє вікно чи стулку, а не отвору й не скла. Готовий виріб вийде трохи ширшим: вал із кронштейнами виступає з боків.\n2. Кожна стулка — окрема штора.\n\nУ [калькуляторі](kviz.html) на кроці розмірів є «Не знаєте, як заміряти?» — там схема й відеоінструкція. А перед виробництвом консультант ще раз звірить розміри з вами." },

    { k:["ціна","коштує","вартіст","скільки грошей","прайс"], generic:true, kviz:true, a: () => {
      const мін = мінЦіна(), п = прикладЦіна(60, 150), з = знижка();
      return "Ціна залежить від ширини й висоти тканини." +
        (мін ? " Найдешевша штора — від " + грн(мін) + (п ? ", а, наприклад, 60×150 см — " + грн(п) : "") + "." : "") +
        (з ? " Це вже з урахуванням знижки −" + з + "%." : "") +
        "\n\nТочну суму під ваші розміри покаже калькулятор: дві хвилини, і ціна перед очима."; } },

    { k:["день-ніч","день ніч","класичн","різниц","відрізня","що обрати","яку обрати"], a:
      "Зараз на сайті — класичні рулонні штори: суцільне полотно, яке просто підіймається й опускається ланцюжком.\n\nШтори день-ніч ми теж робимо, але на сайті їх зараз немає й порахувати їх у калькуляторі не можна." },

    { k:["строк","коли буде","як довго","виготовл","термін"], a: () =>
      строк() + ".\n\nВідлік — після підтвердження замовлення й передоплати. У пікові періоди може бути довше, точний строк повідомимо при підтвердженні." },

    { k:["гарант"], a:
      "Гарантія — від 12 місяців залежно від комплектації, точний строк повідомляємо до оплати. Вона діє на виробничі дефекти механізму, кріплень і збірки.\n\nЯкщо помилка на нашому боці — переробляємо за свій рахунок." },

    { k:["оплат","передоплат","реквізит","карткою","картк","накладен","післяплат"], a:
      "Оплата на рахунок ФОП: після оформлення консультант звірить розміри й надішле реквізити. Можна оплатити 100% наперед або внести 50% передоплати, а решту — при отриманні.\n\nКарткових даних сайт не приймає — так ви застраховані від шахраїв." },

    { k:["доставк","нова пошта","новою поштою","відправ","привез","поштомат"], a:
      "Відправляємо Новою Поштою по всій Україні — у відділення або поштомат, якщо дозволяють габарити. Доставку оплачує покупець за тарифами Нової Пошти.\n\nШтора їде зібраною, у жорсткій упаковці, номер накладної надсилаємо того ж дня. Докладніше — у розділі [«Доставка й оплата»](index.html#dostavka)." },

    { k:["поверн","обмін","не підійшл","відмов"], a:
      "Штора виготовляється під ваші розміри, тож це виріб на замовлення.\n\nПеред запуском консультант звіряє розміри з вами. Якщо помилка на нашому боці — переробляємо за свій рахунок." },

    { k:["монтаж","встанов","повісити","прикрутити","свердл"], a:
      "Штора приїжджає зібраною, з кріпленнями, усіма деталями й відеоінструкцією — встановити можна самостійно, якщо хоч трохи вмієте користуватись викруткою.\n\nЯкщо виникнуть питання, наш технолог допоможе по телефону або відеозв'язку у Viber чи Telegram." },

    { k:["тканин","колір","кольор","відтін","блекаут","затемн"], a: () =>
      "У каталозі " + тканин() + " відтінків, усі — напівзатемнення: сонце приглушують, а кімната лишається світлою.\n\nПотрібне сильне чи повне затемнення — оберіть колір і вкажіть розміри в калькуляторі, ми порахуємо й такі варіанти. Усі кольори — у розділі [«Тканини»](index.html#kolir)." },

    { k:["догляд","прати","почистит","чистит","пил","мити"], a:
      "Догляд простий: при забрудненні протріть вологою серветкою. Прати й знімати полотно не потрібно — воно не збирає пил і не вбирає запахи, досить змотати й розмотати рулон." },

    { k:["телефон","подзвон","зателефон","менеджер","людин","оператор","вайбер","viber","телеграм","telegram","зв'яз","звʼяз","контакт"], a: () =>
      "Наш номер — " + телефон() + ": дзвінок, Viber або Telegram. Працюємо щодня з 09:00 до 21:00.\n\nА ціну на своє вікно можна побачити просто зараз у калькуляторі." },

    { k:["знижк","акці","дешевш","опт","гуртов"], kviz:true, a: () => {
      const з = знижка();
      return з
        ? `Зараз діє −${з}% на тканину, вона вже врахована в розрахунку.\n\nПорахуйте своє вікно — ціна буде зі знижкою, і її можна зафіксувати за собою до 14 днів.`
        : "Порахуйте своє вікно в калькуляторі — ціну побачите одразу, і її можна зафіксувати за собою до 14 днів."; } },
    { k:["нестандарт","велике вікно","мансард","трапец","скіс","арочн"], kviz:true, a:
      "Такі вікна рахуємо окремо.\n\nВкажіть розміри в калькуляторі й опишіть форму вікна — ми перевіримо можливість виготовлення й порахуємо." },
    { k:["скарг","претенз","брак","не працює","поламал","зламал"], a: () =>
      "Прикро це чути. Якщо проблема з нашої вини — виправимо за свій рахунок.\n\nОпишіть, будь ласка, що саме сталося, або зателефонуйте: " + телефон() + "." },
    { k:["замов","оформ","купит","хочу штор"], kviz:true, a:
      "Замовлення оформлюється в калькуляторі: оберіть тканину, вкажіть розміри — і в кошику одразу видно ціну. Там же лишаєте контакти й відділення Нової Пошти." }
  ];

  const PHONE_RE = /(\+?38)?[\s\-(]*0\d{2}[\s\-)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/;

  let open = false, history = [], lead = {name:null, phone:null};
  let контактЗаписано = false, квізЗапропоновано = false, контактЗапитано = false;
  const розмоваId = Math.random().toString(36).slice(2) + Date.now().toString(36);

  let chain = Promise.resolve();
  function queue(fn){
    chain = chain.then(()=> new Promise(done=>{
      setTimeout(()=>{ try{ fn(); } finally{ done(); } }, 700 + Math.random()*500);
    }));
  }

  const fab = document.createElement('button');
  fab.className = 'chat-fab';
  fab.setAttribute('aria-label','Відкрити чат');
  fab.innerHTML = '<span class="dot"></span><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 8.9 8.9 0 01-4-.9L3 21l1.9-4.5A8.4 8.4 0 013 11.5a8.4 8.4 0 018.5-8.4 8.4 8.4 0 019.5 8.4z"/></svg>';

  const win = document.createElement('div');
  win.className = 'chat-win';
  win.innerHTML = `
    <div class="chat-head">
      <div class="av" aria-hidden="true">
        <!-- значок «штора» з набору Lucide (MIT), вбудований, щоб
             не тягнути на сторінку цілу бібліотеку -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3h18"/><path d="M20 7H8"/><path d="M20 11H8"/><path d="M10 19h10"/>
          <path d="M8 15h12"/><path d="M4 3v14a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3"/>
        </svg>
      </div>
      <div>
        <b>Помічник «Фірмова Штора»</b>
        <span><i></i>Онлайн ${cfg.schedule ? '· ' + cfg.schedule.replace('Щодня з ','') : ''}</span>
      </div>
      <button class="x" aria-label="Закрити">×</button>
    </div>
    <div class="chat-body" id="chatBody"></div>
    <div class="chat-quick" id="chatQuick"></div>
    <form class="chat-msg" id="chatForm">
      <input type="text" id="chatInput" placeholder="Напишіть повідомлення..." autocomplete="off">
      <button type="submit" aria-label="Надіслати">➤</button>
    </form>
`;

  document.body.append(fab, win);

  const body = win.querySelector('#chatBody');
  const quick = win.querySelector('#chatQuick');

  const esc = t => String(t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function render(text){
    return esc(text)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
        (m, label, url) => /^(https?:|\/|[\w.-]+\.html)/.test(url)
          ? '<a href="' + url + '">' + label + '</a>' : label)

      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function донизу(){
    body.scrollTop = body.scrollHeight;
    requestAnimationFrame(()=>{ body.scrollTop = body.scrollHeight; });
    setTimeout(()=>{ body.scrollTop = body.scrollHeight; }, 60);
  }

  function add(text, who){
    const d = document.createElement('div');
    d.className = 'msg ' + who;
    d.innerHTML = render(text);
    body.append(d);
    донизу();
    if(who !== 'sys') history.push({who, text});
  }
  function typing(on){
    let t = body.querySelector('.typing');
    if(on && !t){
      t = document.createElement('div');
      t.className = 'typing';
      t.innerHTML = '<i></i><i></i><i></i>';
      body.append(t); донизу();
    }
    if(!on && t) t.remove();
  }

  const asked = new Set();
  let розмоваПочалась = false;
  function renderQuick(){
    if(розмоваПочалась){ quick.style.display = 'none'; return; }
    const left = QUICK.filter(q => !asked.has(q));
    const show = left.length ? left : QUICK;
    quick.innerHTML = show.map(q=>`<button type="button">${esc(q)}</button>`).join('');
    quick.querySelectorAll('button').forEach(b=>b.onclick=()=>send(b.textContent));
    quick.style.display = '';
  }

  function catchLead(text){
    const m = text.match(PHONE_RE);
    if(m && !lead.phone){
      lead.phone = m[0].trim();
      const nameGuess = text.replace(PHONE_RE,'').replace(/[,.]/g,' ').trim();
      if(!lead.name && nameGuess.length>=2 && nameGuess.length<=40) lead.name = nameGuess;
      return true;
    }
    return false;
  }

  function matches(text){
    const t = text.toLowerCase();
    const found = RULES
      .map(r=>({r, hits:r.k.filter(k=>t.includes(k)).length}))
      .filter(x=>x.hits > 0);

    const hasSpecific = found.some(x=>!x.r.generic);
    return found
      .sort((a,b)=>{
        const g = (a.r.generic && hasSpecific ? 1 : 0) - (b.r.generic && hasSpecific ? 1 : 0);
        return g || b.hits - a.hits;
      })
      .map(x=>x.r);
  }
  function answerFor(text){
    const m = matches(text);
    return m.length ? m[0] : null;
  }

  function offerQuiz(reason){
    if(квізЗапропоновано) return;
    квізЗапропоновано = true;
    const d = document.createElement('div');
    d.className = 'chat-go';
    d.innerHTML = '<a href="/kviz.html">Порахувати ціну в калькуляторі</a>';
    body.append(d);
    донизу();
    track('chat_to_kviz', {reason});

    askContact();
  }

  function askContact(){
    if(контактЗапитано || lead.phone) return;
    контактЗапитано = true;

    const f = document.createElement('form');
    f.className = 'chat-lead';
    f.innerHTML =
      '<b>Щоб ми могли звʼязатись</b>' +
      '<p>Як до вас звертатись і на який номер зателефонувати?</p>' +
      '<input type="text" name="nm" placeholder="Імʼя" autocomplete="given-name" maxlength="40">' +
      '<input type="tel" name="ph" placeholder="0XX XXX XX XX" autocomplete="tel" inputmode="tel" maxlength="20">' +
      '<span class="chat-lead-err" hidden></span>' +
      '<button type="submit">Записати</button>';

    const помилка = f.querySelector('.chat-lead-err');
    f.onsubmit = ev => {
      ev.preventDefault();
      const імя = f.nm.value.trim();
      const тел = f.ph.value.trim();
      if(імя.length < 2){
        помилка.textContent = 'Вкажіть, будь ласка, імʼя.';
        помилка.hidden = false;
        f.nm.focus();
        return;
      }
      if(!PHONE_RE.test(тел)){
        помилка.textContent = 'Номер виглядає неповним. Приклад: 067 123 45 67.';
        помилка.hidden = false;
        f.ph.focus();
        return;
      }
      помилка.hidden = true;
      lead.name = імя;
      lead.phone = тел.replace(/[\s()-]/g, '');

      const кнопка = f.querySelector('button');
      кнопка.disabled = true;
      кнопка.textContent = 'Записуємо…';
      записатиКонтакт().then(()=>{
        f.remove();
        add('Дякую, ' + імя + '! Записав ваш номер — зателефонуємо й допоможемо з розрахунком.', 'sys');
      }).catch(()=>{
        кнопка.disabled = false;
        кнопка.textContent = 'Записати';
        помилка.textContent = 'Не вдалося записати. Спробуйте ще раз за хвилину.';
        помилка.hidden = false;
      });
    };

    body.append(f);
    донизу();
  }

  function записатиКонтакт(){
    if(контактЗаписано || !lead.phone || !window.API) return Promise.resolve();
    контактЗаписано = true;
    track('chat_lead');

    let мета = null;
    if(window.__fbReady && window.metaEvent){
      const id = metaEvent('Lead');
      мета = Object.assign({ event_id: id }, window.metaIds ? metaIds() : {});
    }
    return API.sendLead({
      source: 'Чат',
      name: lead.name || '',
      phone: lead.phone,
      meta: мета,

      kind: квізЗапропоновано ? 'Гарячий контакт із чату' : 'Контакт із чату',
      note: history.map(h=>(h.who === 'me' ? 'Клієнт: ' : 'Помічник: ') + h.text).join('\n').slice(0, 900)
    }).catch(err=>{ контактЗаписано = false; throw err; });
  }

  function forApi(){
    return history
      .filter(h => h.who === 'me' || h.who === 'bot')
      .slice(-24)
      .map(h => ({ role: h.who === 'me' ? 'user' : 'assistant', content: h.text }));
  }

  function byRules(text, gotLead){
    const found = matches(text);
    const rule = found.length ? found[0] : null;
    const extra = found.length > 1 && !found[0].esc && !found[1].esc ? found[1] : null;
    if(gotLead && !rule){
      add(`Дякую${lead.name?', '+lead.name:''}! Записав ваш номер.\n\nЩоб побачити ціну вже зараз, порахуйте вікно в калькуляторі.`, 'bot');
      offerQuiz('клієнт залишив контакти');
      return;
    }
    if(rule){
      add(typeof rule.a === 'function' ? rule.a() : rule.a, 'bot');
      if(extra) add(typeof extra.a === 'function' ? extra.a() : extra.a, 'bot');
      renderQuick();
      if(rule.kviz) offerQuiz('питання про ціну або замовлення');
      return;
    }
    add('Не впевнений, що відповім точно, щоб не дезінформувати.\n\nЯкщо питання про ціну чи замовлення — найшвидше покаже калькулятор.', 'bot');
    offerQuiz('помічник не впевнений у відповіді');
  }

  async function send(text){
    text = (text||'').trim();
    if(!text) return;
    add(text, 'me');
    win.querySelector('#chatInput').value = '';
    asked.add(text);
    розмоваПочалась = true;
    quick.style.display = 'none';

    const gotLead = catchLead(text);
    typing(true);

    let data = null, ok = false;
    try{
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ messages: forApi(), cid: розмоваId,
                               page: location.pathname,
                               utm: window.fshUtm ? window.fshUtm() : {} })
      });
      data = await r.json().catch(()=>null);
      ok = r.ok;
    }catch(e){

    }
    typing(false);

    if(ok && data && data.reply){
      add(data.reply, 'bot');
      renderQuick();
      донизу();
      if(data.quiz) offerQuiz('помічник повів у калькулятор');
      if(gotLead) записатиКонтакт().catch(()=>{});
      return;
    }

    if(data && data.error && data.quiz){
      add(data.error, 'bot');
      offerQuiz('помічник недоступний');
      return;
    }
    byRules(text, gotLead);
  }

  const vv = window.visualViewport;
  function fitKeyboard(){
    if(!vv) return;
    if(!open || innerWidth > 760){
      win.style.top = ''; win.style.bottom = ''; win.style.height = '';
      return;
    }
    win.style.top = (Math.round(vv.offsetTop) + 8) + 'px';
    win.style.bottom = 'auto';
    win.style.height = (Math.round(vv.height) - 16) + 'px';

    body.scrollTop = body.scrollHeight;
  }
  if(vv){
    vv.addEventListener('resize', fitKeyboard);
    vv.addEventListener('scroll', fitKeyboard);
  }
  addEventListener('orientationchange', ()=>setTimeout(fitKeyboard, 250));

  function toggle(state){
    open = state ?? !open;
    win.classList.toggle('open', open);
    fab.style.display = open ? 'none' : 'grid';

    document.documentElement.classList.toggle('chat-open', open);
    if(open){
      track('chat_open');
      if(window.visitMark) visitMark('чат');
      if(!history.length){
        typing(true);
        setTimeout(()=>{ typing(false); add(GREETING, 'bot'); renderQuick(); }, 600);
      }
      setTimeout(()=>{ win.querySelector('#chatInput').focus(); fitKeyboard(); }, 300);
    }
    fitKeyboard();
  }
  fab.onclick = ()=>toggle(true);
  win.querySelector('.x').onclick = ()=>toggle(false);
  win.querySelector('#chatForm').onsubmit = e=>{ e.preventDefault(); send(win.querySelector('#chatInput').value); };

  addEventListener('keydown', e=>{ if(e.key === 'Escape' && open) toggle(false); });

  window.openChat = ()=>toggle(true);
})();
