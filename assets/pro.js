(function(){

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const track = (e,d={}) => (window.dataLayer=window.dataLayer||[]).push({event:e,...d});
const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;

const kvizUrl = line => 'kviz.html' + (line ? '?line=' + line : '');

const DAYNIGHT = document.body.dataset.onlyLine === 'daynight';
const toMsg = from => (window.goMessenger ? window.goMessenger(from) : false);

const ord = $('#order');
let lastFocus = null;

function pane(name){
  if(!ord) return;
  ord.querySelectorAll('.ord-pane').forEach(p=>p.classList.toggle('on', p.dataset.pane === name));
  const box = ord.querySelector('.ord-scroll');
  if(box) box.scrollTop = 0;
  if(name === 'quiz') renderAsk();
}
function openOrder(from, start){
  if(!ord) return;
  lastFocus = document.activeElement;
  pane(start || 'pick');
  ord.hidden = false;
  void ord.offsetHeight;
  ord.classList.add('on');
  document.documentElement.classList.add('lock');
  track('order_open', {from});
  setTimeout(()=>{
    const p = ord.querySelector('.ord-pane.on');
    const f = p && p.querySelector('.ord-card, .ask-chip, button:not(.ord-x)');
    if(f) f.focus();
  }, 60);
}
function closeOrder(){
  if(!ord) return;
  ord.classList.remove('on');
  document.documentElement.classList.remove('lock');
  setTimeout(()=>{ if(!ord.classList.contains('on')) ord.hidden = true; }, 300);

  if(lastFocus && lastFocus.focus && lastFocus !== document.body && document.contains(lastFocus)){
    lastFocus.focus();
  } else {
    const main = document.getElementById('main');
    if(main){ main.setAttribute('tabindex','-1'); main.focus(); }
  }
}
$$('[data-order]').forEach(b=>b.addEventListener('click', e=>{
  e.preventDefault();
  if(DAYNIGHT){ toMsg(b.dataset.order || 'кнопка'); return; }
  openOrder(b.dataset.order || 'кнопка');
}));

$$('[data-pick]').forEach(b=>b.addEventListener('click', e=>{
  e.preventDefault();
  openOrder(b.dataset.pick || 'вибір типу');
}));
if(ord){
  ord.addEventListener('click', e=>{
    if(e.target.closest('[data-close]')){ closeOrder(); return; }
    const p = e.target.closest('[data-pane-go]');
    if(p){
      pane(p.dataset.paneGo);

      setTimeout(()=>{
        const box = ord.querySelector('.ord-pane.on');
        const f = box && box.querySelector('button:not(.ord-x), a[href], input');
        if(f) f.focus();
      }, 60);
    }
  });
  addEventListener('keydown', e=>{
    if(!ord.classList.contains('on')) return;
    if(e.key === 'Escape'){ closeOrder(); return; }

    if(e.key !== 'Tab') return;
    const win = ord.querySelector('.ord-win');
    const items = [...win.querySelectorAll('button:not([disabled]), a[href], input, select, textarea')]
      .filter(el => el.offsetParent !== null);
    if(!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
}

function route(line, from){
  track('route', {line, from});
  if(line === 'roller'){ location.href = kvizUrl(line); return; }
  toMsg(from || 'вибір типу');
}
$$('[data-go]').forEach(b=>b.addEventListener('click', ()=>route(b.dataset.go)));

const SHOT = {
  daynight:{src:'assets/work-zebra-tulle',  w:696, h:864},
  roller:  {src:'assets/work-roller-white', w:662, h:846}
};

const NEEDS = [
  {id:'light',   name:'Керувати світлом протягом дня', to:'daynight',
   short:'Більше або менше сонця за один рух',
   why:'Це головне, що вміє день-ніч: світло змінюється зміщенням смуг, без підняття штори.'},
  {id:'privacy', name:'Закрити кімнату від чужих очей', to:'daynight',
   short:'Вас не видно, а світло лишається',
   why:'Смуги закривають кімнату з вулиці, але лишають денне світло всередині.'},
  {id:'dark',    name:'Затемнити, коли треба спати',    to:'daynight',
   short:'Глибока темрява вночі, мʼяке світло вдень',
   why:'Зведені щільні смуги дають глибоке затемнення, а вдень та сама штора лишає мʼяке світло.'},
  {id:'cheap',   name:'Хочу найдешевший варіант',       to:'roller',
   short:'Просто закрити вікно, без півтонів',
   why:'Якщо керувати світлом не потрібно, класична рулонна закриє вікно простіше й дешевше.'}
];

function makeAsk(box){
  if(!box) return null;
  const st = {need:null};

  function draw(){
    if(!st.need){
      box.innerHTML = `
        <span class="ask-num">Одне питання</span>
        <h3>Що для вас найважливіше?</h3>
        <div class="ask-opts">${NEEDS.map(n=>
          `<button class="ask-opt" type="button" data-need="${n.id}">
            <b>${n.name}</b><span>${n.short}</span><i class="tick" aria-hidden="true">✓</i>
          </button>`).join('')}</div>`;
      return;
    }
    const n = NEEDS.find(x=>x.id===st.need);
    const L = CFG.lines[n.to];
    const ph = SHOT[n.to];
    box.innerHTML = `
      <span class="ask-num">Наша порада</span>
      <div class="ask-res">
        <span class="ask-shot"><picture>
          <source srcset="${ph.src}.webp" type="image/webp">
          <img src="${ph.src}.jpg" alt="${L.name}" loading="lazy"
               width="${ph.w}" height="${ph.h}"></picture></span>
        <div class="ask-res-tx">
          <span class="ask-room">${n.name}</span>
          <h3>${L.name}</h3>
          <p class="ask-why">${n.why}</p>
          <p class="ask-price"><b>від ${L.from} ₴</b> за м² тканини</p>
        </div>
      </div>
      <div class="ask-foot">
        <button class="btn btn-p" type="button" data-go="${n.to}">${
          n.to === 'roller' ? 'Порахувати вартість' : 'Запитати ціну в месенджері'}</button>
        <button class="ask-back" type="button" data-restart>Обрати інше</button>
      </div>`;
  }

  function think(){
    box.innerHTML = `
      <div class="ask-wait" role="status">
        <span class="ask-spin" aria-hidden="true"><i></i><i></i><i></i></span>
        <b>Підбираємо під вашу задачу</b>
        <span>Дивимось, яка штора впорається краще</span>
      </div>`;
    setTimeout(draw, 1000);
  }

  box.addEventListener('click', e=>{
    const n = e.target.closest('[data-need]');
    if(n){ st.need = n.dataset.need; track('ask_done', {need:st.need}); think(); return; }
    if(e.target.closest('[data-restart]')){ st.need = null; draw(); return; }
    const g = e.target.closest('[data-go]');
    if(g) route(g.dataset.go, 'підбір');
  });

  draw();
  return draw;
}

const renderAsk = makeAsk($('#ask')) || (()=>{});
makeAsk($('#askPage'));

$$('[data-price]').forEach(e=>{
  const L = CFG.lines[e.dataset.price];
  if(L) e.textContent = 'від ' + L.from + ' ₴';
});

const ROLL = document.body.classList.contains('roll-page');

const SECTIONS = ROLL ? [
  {href:'#chym',     name:'Чим відрізняється'},
  {href:'#de',       name:'Де підходять'},
  {href:'#komplekt', name:'Комплект'},
  {href:'#kolir',    name:'Кольори'},
  {href:'#tsina',    name:'Ціна'},
  {href:'#roboty',   name:'Наші роботи'},
  {href:'#yak',      name:'Як замовити'},
  {href:'#dostavka', name:'Доставка й оплата'},
  {href:'#faq',      name:'Питання'}
] : [
  {href:'#pro',        name:'Про нас'},
  {href:'#budova',     name:'Будова'},
  {href:'#tkanyny',    name:'Тканини'},
  {href:'#tsina',      name:'Скільки коштує'},
  {href:'#zamir',      name:'Як виміряти'},
  {href:'#kimnaty',    name:'Кімнати'},
  {href:'#vidhuky',    name:'Наші роботи'},
  {href:'/',name:'Класичні рулонні'}
];

const ICON = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>'+
        '<path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  fab:  '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/>'+
        '<path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/>'+
        '<path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  tag:  '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/>'+
        '<circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  truck:'<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>'+
        '<path d="M15 18H9"/>'+
        '<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>'+
        '<circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  list: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  box:  '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/>'+
        '<path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="m7.5 4.27 9 5.15"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  news: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>'+
        '<path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  calc: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8"/>'+
        '<path d="M16 14v4"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/>'+
        '<path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
  roll: '<path d="M3 3h18"/><path d="M20 7H8"/><path d="M20 11H8"/><path d="M10 19h10"/>'+
        '<path d="M8 15h12"/><path d="M4 3v14"/><circle cx="4" cy="19" r="2"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>'+
        '<path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  sun:  '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/>'+
        '<path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>'+
        '<path d="M2 12h2"/><path d="M20 12h2"/>'+
        '<path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
};
const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';

let sheet = $('#sheet');
if(!sheet){
  sheet = document.createElement('nav');
  sheet.id = 'sheet';
  sheet.className = 'sheet';
  sheet.setAttribute('aria-label','Розділи');
  document.body.appendChild(sheet);
}

function mnavItems(){
  if(ROLL) return [
    {href:'#top',                  icon:ICON.home, name:'Початок'},
    {href:'#komplekt',             icon:ICON.box,  name:'Комплект'},
    {href:'kviz.html?line=roller', icon:ICON.cart, name:'Порахувати', cta:true},
    {href:'#tsina',                icon:ICON.tag,  name:'Ціна'},
    {sheet:true,                   icon:ICON.list, name:'Розділи'}
  ];
  return [
    {href:'#main',      icon:ICON.home, name:'Головна'},
    {href:'#tkanyny',   icon:ICON.fab,  name:'Тканини'},
    {order:true,        icon:ICON.chat, name:'Написати', cta:true},

    {href:'#tsina',     icon:ICON.tag,  name:'Ціна'},
    {sheet:true,        icon:ICON.list, name:'Розділи'}
  ];
}

function alive(x){
  if(!x.href || x.href[0] !== '#') return true;
  const el = document.getElementById(x.href.slice(1));

  return !!el && !el.hidden;
}

function buildMnav(){

  let nav = $('.mnav');
  if(!nav){
    nav = document.createElement('nav');
    nav.className = 'mnav auto';
    nav.setAttribute('aria-label', 'Основна навігація');
    document.body.appendChild(nav);
  }
  const items = mnavItems().filter(alive);

  nav.innerHTML = '<div class="mnav-in">' + items.map(x=>{
    const inner = svg(x.icon) + '<span>' + x.name + '</span>';
    const cls = x.cta ? ' class="mnav-cta"' : '';
    if(x.order) return '<button type="button"' + cls + ' data-order="нижнє меню">' + inner + '</button>';
    if(x.sheet) return '<button type="button" id="mnavSections">' + inner + '</button>';
    return '<a href="' + x.href + '"' + cls + '>' + inner + '</a>';
  }).join('') + '</div>';

  const ordBtn = nav.querySelector('[data-order]');
  if(ordBtn) ordBtn.addEventListener('click', ()=>{
    if(DAYNIGHT) toMsg('нижнє меню'); else openOrder('нижнє меню');
  });

  const sBtn = nav.querySelector('#mnavSections');
  sheet.innerHTML = SECTIONS.filter(alive).map(x=>'<a href="' + x.href + '">' + x.name + '</a>').join('');
  const close = () => { sheet.classList.remove('on'); sBtn.setAttribute('aria-expanded','false'); };
  sBtn.setAttribute('aria-expanded','false');
  sBtn.addEventListener('click', e=>{
    e.stopPropagation();
    const open = !sheet.classList.contains('on');
    sheet.classList.toggle('on', open);
    sBtn.setAttribute('aria-expanded', String(open));
  });
  sheet.addEventListener('click', close);
  document.addEventListener('click', e=>{
    if(sheet.classList.contains('on') && !sheet.contains(e.target) && e.target !== sBtn) close();
  });
  addEventListener('keydown', e=>{ if(e.key === 'Escape') close(); });
}

function buildFloat(){
  if($('#floatTheme')) return;

  if(!document.body.classList.contains('roll-page')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.id = 'floatTheme';
  b.className = 'fab-thm';
  b.setAttribute('aria-label','Перемкнути тему');
  const paint = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    b.innerHTML = svg(dark ? ICON.moon : ICON.sun);
    b.title = dark ? 'Темна тема' : 'Світла тема';
  };
  paint();
  b.addEventListener('click', ()=>{
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const t = document.querySelector('.thm [data-theme-set="' + (dark ? 'light' : 'dark') + '"]');
    if(t) t.click();
    setTimeout(paint, 30);
  });
  document.body.appendChild(b);
}

window.rebuildNav = buildMnav;
buildMnav();
buildFloat();

const spy = (()=>{
  const links = $$('.navf .menu a[href^="#"]');
  if(!links.length) return null;
  const items = links.map(a=>({a, id:a.getAttribute('href').slice(1)}))
                     .filter(x=>document.getElementById(x.id));
  if(!items.length) return null;
  let current = null;

  return function mark(){
    const line = innerHeight * 0.4;
    let best = null;
    items.forEach(({id})=>{
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      if(r.top <= line && r.bottom > line) best = id;
    });
    if(best === current) return;
    current = best;

    $$('.navf .menu a[href^="#"], .mnav a[href^="#"], .sheet a[href^="#"]').forEach(a=>{
      a.classList.toggle('act', !!best && a.getAttribute('href') === '#' + best);
    });
  };
})();

let lastY = scrollY;
function mnavScroll(){
  const nav = $('.mnav');
  if(!nav) return;
  if(!nav.classList.contains('auto')) nav.classList.add('auto');
  const y = scrollY;
  let show;
  if(y < 240) show = false;
  else if(y > lastY + 4) show = true;
  else if(y < lastY - 4) show = false;
  else show = nav.classList.contains('show');
  lastY = y;

  [nav, $('#floatTheme'), $('.chat-fab')].forEach(el=>{
    if(el) el.classList.toggle('show', show);
  });
}

$$('[data-calc]').forEach(el=>{
  const [w,h] = el.dataset.calc.split('x').map(Number);
  const cheapest = Math.min(...CFG.fabrics.map(f=>f.roller || f.price));
  const m2 = Math.max(CFG.minArea, (w/100)*(h/100));
  const min = Math.round(CFG.minPrice * 0.7);
  el.textContent = Math.round(Math.max(min, m2 * cheapest)).toLocaleString('uk-UA') + ' ₴';
});

const swBox = $('#swatches');
if(swBox && typeof CFG !== 'undefined'){
  swBox.innerHTML = CFG.fabrics.map(f=>`
    <article class="sw-card">
      <span class="sw-color" style="background:${window.fabricBg ? window.fabricBg(f, false, true)
        : `linear-gradient(160deg,${f.from},${f.to})`}"></span>
      <span class="sw-tx">
        <b>${f.name}</b>
        <span>${f.transmission}</span>
        <i>${f.roller || f.price} ₴/м²</i>
      </span>
    </article>`).join('');
}

window.PRO = { openOrder };

addEventListener('scroll', ()=>{
  if(spy) spy();
  if(!calm) mnavScroll();
}, {passive:true});

setTimeout(()=>{ if(spy) spy(); mnavScroll(); }, 200);

})();

(function(){
  if(typeof CFG === 'undefined') return;
  const money = n => Math.round(n).toLocaleString('uk-UA') + ' ₴';

  const pctOf = id => window.fshPromoPct ? window.fshPromoPct(id) : 0;
  const multOf = id => window.fshPromoMult ? window.fshPromoMult(id) : 0;
  const labelOf = id => { const p = Math.round(pctOf(id)); return p ? '−' + p + '%' : ''; };

  const strip = document.getElementById('fabStrip');
  if(strip){

    let N = CFG.fabrics.length;
    const картка = (f, i) => {

        const now = window.fshRollerMin ? window.fshRollerMin(f.id) : (f.roller || f.price);
        const m = multOf(f.id);
        const old = m ? Math.round(now * m) : 0;
        const lab = labelOf(f.id);
        const jpg = f.img ? f.img.replace(/\.webp$/, '.jpg') : '';
        const pic = f.img
          ? '<picture><source srcset="' + f.img + '" type="image/webp">' +
            '<img src="' + jpg + '" alt="" decoding="async" width="460" height="613" ' +
            'loading="' + (i >= N - 3 && i < N + 4 ? 'eager' : 'lazy') + '"></picture>'
          : '<span class="fab-flat" style="background:' + (window.fabricBg ? window.fabricBg(f, false) : '') + '"></span>';
        return '<article class="fab" data-fab="' + f.id + '">' +
          '<span class="fab-ph">' + pic +
            '<i class="fab-badge" data-fab="' + f.id + '"' + (lab ? '' : ' style="display:none"') + '>' + lab + '</i>' +
          '</span>' +
          '<b class="fab-n">' + String(f.name || '').trim() + '</b>' +
          '<span class="fab-t">' + String(f.transmission || '').trim() + '</span>' +
          '<span class="fab-p" data-now="' + now + '" data-fab="' + f.id + '">' + (old ? '<s>' + money(old) + '</s>' : '') +
            '<em class="fab-from">від</em> <b>' + money(now) + '</b></span>' +
        '</article>';
    };
    const картки3 = () => {
      const triple = [...CFG.fabrics, ...CFG.fabrics, ...CFG.fabrics];
      return triple.map(картка).join('');
    };
    strip.innerHTML =
      '<div class="fabs-win"><div class="fabs-in">' + картки3() + '</div>' +
      '<button class="fabs-arw fabs-arw--prev" type="button" aria-label="Попередні тканини">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>' +
      '<button class="fabs-arw fabs-arw--next" type="button" aria-label="Наступні тканини">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button></div>';

    const вікно = strip.querySelector('.fabs-win');
    const rail  = strip.querySelector('.fabs-in');
    let картки = [...rail.children];
    let поз = N;

    function розставити(тихо){
      const c = картки[поз];
      if(!c || !вікно.clientWidth) return;
      rail.style.transition = тихо ? 'none' : '';
      const x = вікно.clientWidth/2 - (c.offsetLeft + c.offsetWidth/2);
      rail.style.setProperty('--x', Math.round(x) + 'px');
      if(тихо) void rail.offsetWidth;
      rail.style.transition = '';
      картки.forEach((e,k)=>{
        const d = Math.abs(k - поз);
        e.classList.toggle('on', d === 0);
        e.style.visibility = d <= 3 ? 'visible' : 'hidden';
      });

      const id = c.getAttribute('data-fab');
      const кн = document.getElementById('fabCalc');
      if(кн && id) кн.href = 'kviz.html?line=roller&fabric=' + encodeURIComponent(id);
    }
    function перебазувати(){
      if(поз >= N && поз < N*2) return;
      поз = N + (((поз % N) + N) % N);
      розставити(true);
    }
    function крок(d){
      поз += d;
      розставити(false);
      clearTimeout(крок._t);
      крок._t = setTimeout(перебазувати, 620);
    }
    strip.querySelector('.fabs-arw--prev').onclick = ()=> крок(-1);
    strip.querySelector('.fabs-arw--next').onclick = ()=> крок(1);
    const клікиКарток = () => картки.forEach((c,k)=> c.onclick = ()=>{ поз = k; розставити(false);
      clearTimeout(крок._t); крок._t = setTimeout(перебазувати, 620); });
    клікиКарток();

    const підпис = () => CFG.fabrics.map(f => [f.id, f.name, f.img, f.thumb].join('|')).join('~');
    let було = підпис();
    document.addEventListener('cfg-updated', () => {
      const тепер = підпис();
      if(тепер === було || !CFG.fabrics.length) return;
      було = тепер;
      const центр = картки[поз] && картки[поз].getAttribute('data-fab');
      N = CFG.fabrics.length;
      rail.innerHTML = картки3();
      картки = [...rail.children];
      const k = CFG.fabrics.findIndex(f => f.id === центр);
      поз = N + (k >= 0 ? k : 0);
      клікиКарток();
      розставити(true);
    });

    let sx = 0, s0 = 0, база = 0, крокPx = 240, drag = false, час = 0, остX = 0, швидкість = 0;

    вікно.addEventListener('pointerdown', e=>{

      if(e.pointerType === 'mouse') return;

      if(e.target.closest && e.target.closest('.fabs-arw')) return;
      const c = картки[поз];
      if(!c) return;
      drag = true; sx = остX = e.clientX; s0 = поз; час = e.timeStamp || performance.now();
      швидкість = 0;
      крокPx = c.offsetWidth + 12;
      база = вікно.clientWidth/2 - (c.offsetLeft + c.offsetWidth/2);
      rail.style.transition = 'none';
    });

    addEventListener('pointermove', e=>{
      if(!drag) return;
      const t = e.timeStamp || performance.now();

      const dt = Math.max(1, t - час);
      швидкість = (e.clientX - остX) / dt;
      час = t; остX = e.clientX;

      rail.style.setProperty('--x', Math.round(база + (e.clientX - sx)) + 'px');
    }, {passive:true});

    addEventListener('pointerup', e=>{
      if(!drag) return;
      drag = false;
      rail.style.transition = '';
      const пройдено = (e.clientX || остX) - sx;

      let крокiв = -Math.round(пройдено / крокPx);
      if(крокiв === 0){

        if(Math.abs(пройдено) > крокPx * 0.25) крокiв = пройдено < 0 ? 1 : -1;

        else if(Math.abs(швидкість) > 0.35) крокiв = швидкість < 0 ? 1 : -1;
      }
      поз = s0 + крокiв;
      розставити(false);
      clearTimeout(крок._t);
      крок._t = setTimeout(перебазувати, 620);
    });

    розставити(true);

    addEventListener('load', ()=>розставити(true));
    setTimeout(()=>розставити(true), 400);
    let t;
    addEventListener('resize', ()=>{ clearTimeout(t); t = setTimeout(()=>розставити(true), 150); },
      {passive:true});
  }

  const wins = document.getElementById('priceWins');

  function promoNow(){
    const p = CFG.promo || {};
    const pct = Number(p.percent);
    const on = !!p.on;
    const mult = on ? (pct > 0 && pct < 100 ? 1/(1 - pct/100) : (Number(p.multiplier) || 0)) : 0;
    const label = p.label || (pct > 0 ? '−' + Math.round(pct) + '%' : '−50%');
    return { on, mult, label };
  }
  function paintPrice(el, mult, fromPrefix){
    const now = Number(el.getAttribute('data-now')) || 0;
    const old = mult ? Math.round(now * mult) : 0;
    el.innerHTML = (old ? '<s>' + money(old) + '</s>' : '') +
      (fromPrefix ? '<em class="fab-from">від</em> ' : '') + '<b>' + money(now) + '</b>';
  }

  function recalcBase(){
    document.querySelectorAll('#fabStrip .fab-p[data-fab]').forEach(el => {
      const f = (CFG.fabrics || []).find(x => x.id === el.getAttribute('data-fab'));
      if(f && window.fshRollerMin) el.setAttribute('data-now', window.fshRollerMin(f.id));

      const card = f && el.closest('.fab');
      if(card){
        const n = card.querySelector('.fab-n'), t = card.querySelector('.fab-t');
        if(n) n.textContent = String(f.name || '').trim();
        if(t) t.textContent = String(f.transmission || '').trim();
      }
    });
  }

  function renderWins(mult){
    if(!wins || !Array.isArray(CFG.rollerExamples)) return;
    wins.innerHTML = CFG.rollerExamples.map(e => {

      const cheap = window.fshRollerCheapestFab ? window.fshRollerCheapestFab(e.w, e.h) : null;
      const now = cheap ? cheap.price : (window.fshRollerMin ? window.fshRollerMin() : 0);
      const m = cheap && window.fshPromoMult ? window.fshPromoMult(cheap.id) : mult;
      const old = m ? Math.round(now * m) : 0;

      const повне = /^https?:|\.(webp|jpe?g|png|avif)$/i.test(e.img || '');
      const фото = e.img
        ? (повне
            ? '<img src="' + e.img + '" alt="Рулонна штора ' + e.w + ' на ' + e.h + ' сантиметрів" ' +
              'width="640" height="640" loading="lazy" decoding="async">'
            : '<picture><source srcset="' + e.img + '.webp" type="image/webp">' +
              '<img src="' + e.img + '.jpg" alt="Рулонна штора ' + e.w + ' на ' + e.h + ' сантиметрів" ' +
              'width="640" height="640" loading="lazy" decoding="async"></picture>')
        : '<span class="pw-win" style="width:' + Math.round(96 * e.w / e.h) + 'px;height:96px"></span>';
      return '<article class="pw">' +
        '<span class="pw-fig">' + фото + '</span>' +
        '<b class="pw-n">' + e.name + '</b>' +
        '<span class="pw-note">' + (e.note ? e.note + ' · ' : '') + e.w + ' × ' + e.h + ' см</span>' +
        '<span class="pw-p">' + (old ? '<s>' + money(old) + '</s>' : '') +
          '<b>' + money(now) + '</b></span>' +
      '</article>';
    }).join('');
  }
  function syncPromoUI(){
    const { on, mult, label } = promoNow();
    recalcBase();
    renderWins(mult);

    document.querySelectorAll('[data-promo-pct]').forEach(el => { el.textContent = label; });

    const bar = document.getElementById('promo');
    if(bar) bar.style.display = on ? '' : 'none';
    document.querySelectorAll('.rhero-eyeb').forEach(el => { el.style.display = on ? '' : 'none'; });

    document.querySelectorAll('#fabStrip .fab-badge').forEach(b => {
      const l = labelOf(b.getAttribute('data-fab'));
      b.textContent = l; b.style.display = l ? '' : 'none';
    });
    document.querySelectorAll('#fabStrip .fab-p').forEach(el =>
      paintPrice(el, multOf(el.getAttribute('data-fab')), true));
  }
  syncPromoUI();
  document.addEventListener('cfg-updated', syncPromoUI);
})();

(function(){
  const плитки = [...document.querySelectorAll('.rwork-ph')];
  if(!плитки.length) return;
  const N = плитки.length;

  const стрічка = document.querySelector('.rworks');
  const стрілки = [...document.querySelectorAll('[data-rworks]')];

  function крок(){
    const карта = стрічка.querySelector('.rwork');
    if(!карта) return стрічка.clientWidth;
    const зазор = parseFloat(getComputedStyle(стрічка).columnGap) || 16;
    return карта.getBoundingClientRect().width + зазор;
  }

  function оновитиСтрілки(){
    const є = стрічка.scrollWidth - стрічка.clientWidth > 4;
    стрілки.forEach(b=>{ b.disabled = !є; });
  }

  стрілки.forEach(b=>{
    b.addEventListener('click', ()=>{
      const край = стрічка.scrollWidth - стрічка.clientWidth;
      const x = стрічка.scrollLeft;
      const вперед = Number(b.dataset.rworks) > 0;
      let куди = x + крок() * Number(b.dataset.rworks);
      if(вперед && x >= край - 8) куди = 0;
      else if(!вперед && x <= 8)  куди = край;
      стрічка.scrollTo({ left: куди, behavior:'smooth' });
    });
  });
  addEventListener('resize', оновитиСтрілки);
  оновитиСтрілки();

  let вікно = null, доріжка = null, точки = null;
  let поз = 1;
  const справжній = () => (поз - 1 + N) % N;

  function зібрати(){
    вікно = document.createElement('div');
    вікно.className = 'lbox';
    вікно.hidden = true;

    const слайд = i => {
      const кн = плитки[(i + N) % N];
      const img = кн.querySelector('img');
      const підпис = кн.closest('.rwork').querySelector('figcaption');
      return '<div class="lbox-slide"><figure>' +
        '<img alt="' + (img ? img.alt.replace(/"/g,'&quot;') : '') + '" ' +
             'data-src="' + кн.dataset.big + '">' +
        '<figcaption>' + (підпис ? підпис.textContent : '') + '</figcaption>' +
        '</figure></div>';
    };

    const слайди = [слайд(N - 1), ...плитки.map((_, i) => слайд(i)), слайд(0)].join('');

    вікно.innerHTML =
      '<button class="lbox-btn lbox-x" type="button" aria-label="Закрити">' +
        '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button>' +
      '<button class="lbox-btn lbox-prev" type="button" aria-label="Попереднє фото">' +
        '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button>' +
      '<button class="lbox-btn lbox-next" type="button" aria-label="Наступне фото">' +
        '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button>' +
      '<div class="lbox-win"><div class="lbox-track">' + слайди + '</div></div>' +
      '<div class="lbox-dots" aria-hidden="true">' +
        плитки.map(()=>'<i></i>').join('') + '</div>';

    document.body.append(вікно);
    доріжка = вікно.querySelector('.lbox-track');
    точки   = [...вікно.querySelectorAll('.lbox-dots i')];

    вікно.querySelector('.lbox-x').onclick = закрити;
    вікно.querySelector('.lbox-prev').onclick = () => йти(поз - 1);
    вікно.querySelector('.lbox-next').onclick = () => йти(поз + 1);

    вікно.addEventListener('click', e=>{
      if(e.target.closest('img') || e.target.closest('.lbox-btn')) return;
      закрити();
    });

    доріжка.addEventListener('transitionend', e=>{
      if(e.propertyName !== 'transform') return;
      if(поз === 0)     ставити(N, true);
      if(поз === N + 1) ставити(1, true);
    });

    свайп();
  }

  function вантажити(i){
    for(const j of [i - 1, i, i + 1]){
      const сл = доріжка.children[j];
      const img = сл && сл.querySelector('img');
      if(img && !img.src) img.src = img.dataset.src;
    }
  }

  function зсув(x, плавно){
    доріжка.classList.toggle('drag', !плавно);
    доріжка.style.transform = 'translate3d(' + x + 'px,0,0)';
  }

  function ставити(нова, миттєво){
    поз = нова;
    вантажити(поз);
    зсув(-поз * вікно.clientWidth, !миттєво);
    const р = справжній();
    точки.forEach((т,j)=>т.classList.toggle('on', j === р));
  }

  function йти(нова){ ставити(Math.max(0, Math.min(N + 1, нова))); }

  function свайп(){
    let x0 = null, t0 = 0, dx = 0;
    вікно.addEventListener('touchstart', e=>{
      x0 = e.touches[0].clientX; t0 = Date.now(); dx = 0;
    }, {passive:true});
    вікно.addEventListener('touchmove', e=>{
      if(x0 === null) return;
      dx = e.touches[0].clientX - x0;
      зсув(-поз * вікно.clientWidth + dx, false);
    }, {passive:true});
    вікно.addEventListener('touchend', ()=>{
      if(x0 === null) return;
      const швидко = Math.abs(dx) > 50 && Date.now() - t0 < 300;
      const далеко = Math.abs(dx) > вікно.clientWidth * 0.25;
      x0 = null;
      if(швидко || далеко) йти(поз + (dx < 0 ? 1 : -1));
      else ставити(поз);
    }, {passive:true});
  }

  function відкрити(i){
    if(!вікно) зібрати();

    document.documentElement.style.overflow = 'hidden';
    вікно.hidden = false;

    ставити(i + 1, true);
    вікно.querySelector('.lbox-x').focus();
  }

  function закрити(){
    if(!вікно) return;
    вікно.hidden = true;
    document.documentElement.style.overflow = '';
    плитки[справжній()].focus();
  }

  плитки.forEach((кн, i)=>{ кн.onclick = () => відкрити(i); });

  addEventListener('keydown', e=>{
    if(!вікно || вікно.hidden) return;
    if(e.key === 'Escape') закрити();
    if(e.key === 'ArrowLeft') йти(поз - 1);
    if(e.key === 'ArrowRight') йти(поз + 1);
  });

  addEventListener('resize', ()=>{ if(вікно && !вікно.hidden) ставити(поз, true); });
})();
