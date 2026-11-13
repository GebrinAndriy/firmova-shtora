(function(){
  const КЛЮЧІ = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','ttclid'];
  const STORE = 'fsh_utm_v1', ЖИТТЯ = 30 * 864e5;
  const зАдреси = () => {
    const q = new URLSearchParams(location.search), out = {};
    for(const k of КЛЮЧІ){ const v = q.get(k); if(v) out[k] = v.slice(0, 200); }
    return out;
  };
  try{
    const тут = зАдреси();
    if(Object.keys(тут).length) localStorage.setItem(STORE, JSON.stringify({ t: Date.now(), utm: тут }));
  }catch(e){}
  window.fshUtm = function(){
    const тут = зАдреси();
    if(Object.keys(тут).length) return тут;
    try{
      const d = JSON.parse(localStorage.getItem(STORE) || 'null');
      if(d && d.utm && Date.now() - d.t < ЖИТТЯ) return d.utm;
    }catch(e){}
    return {};
  };
})();

window.API = (function(){
'use strict';

const ENDPOINT = '/api/lead';

async function sendLead(payload){

  let visit = null;
  try { visit = typeof window.visitData === 'function' ? window.visitData(payload && payload.source) : null; }
  catch (e) {}
  const body = Object.assign({ page: location.pathname, visit,
                               utm: window.fshUtm ? window.fshUtm() : {} }, payload);
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let data = null;
  try{ data = await r.json(); }catch(e){}
  if(!r.ok) throw new Error((data && data.error) || 'Сервер відповів ' + r.status);
  return data;
}

const SETTINGS_CACHE = 'fsh_settings_v1';

function накластиНалаштування(s){
  deepMerge(CFG, s);
  document.dispatchEvent(new CustomEvent('cfg-updated'));
  applyContent(s);
  try{ renderFooterSocial(); }catch(e){}
}

function показатиСторінку(){
  try{ document.documentElement.classList.remove('fsh-wait'); }catch(e){}
}

async function applySettings(){
  let кеш = null;
  if(typeof CFG !== 'undefined'){

    try{
      кеш = localStorage.getItem(SETTINGS_CACHE);
      if(кеш){
        const s = JSON.parse(кеш);
        if(s && typeof s === 'object') накластиНалаштування(s);
      }
    }catch(e){ кеш = null; }
    if(кеш) показатиСторінку();
    try{
      const r = await fetch('/api/settings', { headers:{ 'Accept':'application/json' } });
      if(r.ok){
        const s = await r.json();
        if(s && typeof s === 'object'){
          const свіже = JSON.stringify(s);

          if(свіже !== кеш){
            накластиНалаштування(s);
            try{ localStorage.setItem(SETTINGS_CACHE, свіже); }catch(e){}
          }
        }
      }
    }catch(e){   }
  }
  показатиСторінку();

  try{ document.dispatchEvent(new CustomEvent('fsh-content')); }catch(e){}
}

function richText(s){
  const esc = String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\r?\n/g, '<br>');
}
window.richText = richText;

window.fshPickTariff = function(fabricId){
  const F = (typeof CFG !== 'undefined' && CFG.rollerFormula) || {};
  const list = (typeof CFG !== 'undefined' && Array.isArray(CFG.rollerTariffs)) ? CFG.rollerTariffs : [];
  if(fabricId){
    const c = list.find(t => t && Array.isArray(t.fabrics) && t.fabrics.indexOf(fabricId) !== -1 &&
                             Array.isArray(t.tiers) && t.tiers.length);
    if(c) return {
      tiers: c.tiers,
      fromW: (c.fromW != null ? c.fromW : F.fromW),
      note:  c.note || F.note,
      name:  c.name || '',
      custom: true
    };
  }
  return { tiers: F.tiers, fromW: F.fromW, note: F.note, name: '', custom: false };
};

window.fshFabHasTariff = function(fabricId){ return window.fshPickTariff(fabricId).custom; };

window.fshFabTariffName = function(fabricId){ return window.fshPickTariff(fabricId).name || ''; };

window.fshPromoPct = function(fabricId){
  const C = (typeof CFG !== 'undefined') ? CFG : {};
  const f = fabricId && Array.isArray(C.fabrics) ? C.fabrics.find(x => x && x.id === fabricId) : null;
  if(f && f.promo !== '' && f.promo != null && isFinite(Number(f.promo))){
    const v = Number(f.promo);
    return v > 0 && v < 100 ? v : 0;
  }
  const p = C.promo || {};
  if(!p.on) return 0;
  const pct = Number(p.percent);
  if(pct > 0 && pct < 100) return pct;
  const m = Number(p.multiplier) || 0;
  return m > 1 ? (1 - 1/m) * 100 : 0;
};

window.fshPromoMult = function(fabricId){
  const pct = window.fshPromoPct(fabricId);
  return pct > 0 && pct < 100 ? 1/(1 - pct/100) : 0;
};

window.fshTierH = function(t){ return Number(t && t.toH != null ? t.toH : (t && t.toW)) || 0; };

window.fshRollerBase = function(w, h, fabricId){
  const T = window.fshPickTariff(fabricId);
  const tiers = Array.isArray(T.tiers) ? T.tiers : [];
  if(!tiers.length) return null;
  const maxH = window.fshTierH(tiers[tiers.length - 1]);
  w = Number(w); h = Number(h);
  if(!isFinite(w) || !isFinite(h)) return null;

  const effW = Math.max(w, Number(T.fromW) || 0);
  if(maxH > 0 && h > maxH) return null;
  const t = tiers.find(x => h <= window.fshTierH(x)) || tiers[tiers.length - 1];
  return Math.round((Number(t.base) || 0) + (Number(t.perM) || 0) * (effW / 100));
};

window.fshRollerMin = function(fabricId){
  const T = window.fshPickTariff(fabricId);
  const tiers = Array.isArray(T.tiers) ? T.tiers : [];
  if(!tiers.length) return 0;
  const t = tiers[0];
  return Math.round((Number(t.base) || 0) + (Number(t.perM) || 0) * ((Number(T.fromW) || 0) / 100));
};

window.fshRollerCheapestFab = function(w, h){
  const fabs = (typeof CFG !== 'undefined' && Array.isArray(CFG.fabrics)) ? CFG.fabrics : [];
  let best = null;
  for(const f of fabs){
    const p = window.fshRollerBase(w, h, f.id);
    if(p === null) continue;
    if(best === null || p < best.price) best = { price: p, id: f.id };
  }
  return best;
};
window.fshRollerCheapest = function(w, h){
  const b = window.fshRollerCheapestFab(w, h);
  return b ? b.price : null;
};

window.gaClientId = function(){
  try{
    const m = document.cookie.match(/(?:^|;\s*)_ga=GA\d\.\d\.(\d+\.\d+)/);
    return m ? m[1] : '';
  }catch(e){ return ''; }
};

addEventListener('error', function(e){
  const el = e && e.target;
  if(!el || el.tagName !== 'IMG') return;
  const pic = el.parentElement && el.parentElement.tagName === 'PICTURE' ? el.parentElement : null;

  if(pic && !el.dataset.fshNowebp){
    el.dataset.fshNowebp = '1';
    pic.querySelectorAll('source').forEach(s => s.remove());
    const src = el.getAttribute('src');
    if(src){ el.removeAttribute('src'); el.setAttribute('src', src); }
    return;
  }

  const n = +(el.dataset.fshRetry || 0);
  if(n < 1){
    el.dataset.fshRetry = String(n + 1);
    const src = el.src;
    setTimeout(() => { if(el.src) el.src = src; }, 600);
    return;
  }

  el.classList.add('fsh-img-off');
}, true);

function fshForeign(el){
  for(const ch of el.children)
    if(!/^(EM|B|I|STRONG|BR|SPAN|SMALL|SUP|SUB|U)$/.test(ch.tagName)) return true;
  return false;
}
function fshDirectText(el){
  let s = '';
  for(const n of el.childNodes) if(n.nodeType === 3) s += n.textContent;
  return s;
}
function fshSetDirectText(el, val){
  let set = false;
  for(const n of [...el.childNodes]){
    if(n.nodeType === 3){ if(!set){ n.textContent = val; set = true; } else n.textContent = ''; }
  }
  if(!set) el.insertBefore(document.createTextNode(val), el.firstChild);
}

function fshRenderText(el, val){
  val = val == null ? '' : String(val);
  if(fshForeign(el)) fshSetDirectText(el, val);
  else if(/[*\n]/.test(val)) el.innerHTML = richText(val);
  else el.textContent = val;
  if(el.classList && el.classList.contains('umovy-fill')) el.classList.add('is-filled');
}
function fshSetImg(el, url){
  if(!url) return;
  el.src = url;
  el.removeAttribute('srcset');
  const pic = el.closest('picture');
  if(pic) pic.querySelectorAll('source').forEach(x => x.remove());
}
window.fshForeign = fshForeign;
window.fshDirectText = fshDirectText;
window.fshRenderText = fshRenderText;
window.fshSetImg = fshSetImg;

function fshPageKey(){
  let p = (location.pathname || '').toLowerCase().replace(/\/+$/, '');
  p = (p.split('/').pop() || '').replace(/\.html?$/, '');
  return p || 'index';
}

function fshDomPath(el){
  const parts = [];
  while(el && el.nodeType === 1 && el.tagName !== 'BODY' && el.tagName !== 'HTML'){
    let i = 1, s = el;
    while((s = s.previousElementSibling)) if(s.tagName === el.tagName) i++;
    parts.unshift(el.tagName.toLowerCase() + '[' + i + ']');
    el = el.parentElement;
  }
  return parts.join('>');
}
function fshResolvePath(path){
  if(!path) return null;
  let node = document.body;
  for(const seg of path.split('>')){
    const m = seg.match(/^([a-z0-9]+)\[(\d+)\]$/);
    if(!m || !node) return null;
    const tag = m[1].toUpperCase(), idx = +m[2];
    let i = 0, found = null;
    for(let ch = node.firstElementChild; ch; ch = ch.nextElementSibling){
      if(ch.tagName === tag){ i++; if(i === idx){ found = ch; break; } }
    }
    if(!found) return null;
    node = found;
  }
  return node;
}
window.fshPageKey = fshPageKey;
window.fshDomPath = fshDomPath;
window.fshResolvePath = fshResolvePath;

const ДИНАМІЧНІ = '#fabStrip,#priceWins,[data-dyn]';
function fshDynamic(el){ return !!(el && el.closest && el.closest(ДИНАМІЧНІ)); }
window.fshDynamic = fshDynamic;

function applyAuto(s){
  const pk = fshPageKey();
  const ta = s && s.txauto && s.txauto[pk];
  if(ta) for(const path in ta){
    const el = fshResolvePath(path);
    if(el && !fshDynamic(el)) fshRenderText(el, ta[path]);
  }
  const ia = s && s.imgauto && s.imgauto[pk];
  if(ia) for(const path in ia){
    const el = fshResolvePath(path);
    if(fshDynamic(el)) continue;
    if(el && el.tagName === 'IMG') fshSetImg(el, ia[path]);
  }
}

function applyContent(s){
  const t = s && s.texts;
  if(t) for(const [key, val] of Object.entries(t)){
    if(val == null) continue;
    document.querySelectorAll('[data-txt="' + CSS.escape(key) + '"]')
      .forEach(el => fshRenderText(el, val));
  }
  const im = s && s.images;
  if(im) for(const [key, url] of Object.entries(im)){
    if(!url) continue;
    document.querySelectorAll('[data-img="' + CSS.escape(key) + '"]')
      .forEach(el => fshSetImg(el, url));
  }
  applyAuto(s);

  setTimeout(() => applyAuto(s), 700);
}

const НЕБЕЗПЕЧНІ_КЛЮЧІ = new Set(['__proto__', 'constructor', 'prototype']);
function deepMerge(target, src){
  for(const k of Object.keys(src)){
    if(k === 'savedAt' || НЕБЕЗПЕЧНІ_КЛЮЧІ.has(k)) continue;
    const v = src[k];
    if(v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object')
      deepMerge(target[k], v);
    else target[k] = v;
  }
}

function fabricBg(f, striped, small){
  if(!f) return 'transparent';

  const src = small ? (f.thumb || f.img) : f.img;

  if(src) return "url('" + src + "') center/cover no-repeat";
  return striped
    ? 'repeating-linear-gradient(180deg, ' + f.from + ' 0 11px, ' + f.to + ' 11px 22px)'
    : 'linear-gradient(160deg, ' + f.from + ', ' + f.to + ')';
}
window.fabricBg = fabricBg;

function номерМесенджера(v){
  const d = String(v).replace(/\D/g, '');
  if(d.length === 10 && d[0] === '0') return '38' + d;
  if(d.length === 9) return '380' + d;
  return d;
}
function fshMsgHref(key, value){
  const v = String(value == null ? '' : value).trim();
  if(!v || v === '#') return '';
  if(/^(https?:|viber:|tg:|mailto:|tel:)/i.test(v)) return v;

  if(/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(v)) return 'https://' + v;
  const телефон = /^\+?[\d\s()\-]+$/.test(v) && v.replace(/\D/g, '').length >= 9;
  const нік = v.replace(/^@/, '');
  if(key === 'telegram'){
    if(телефон) return 'https://t.me/+' + номерМесенджера(v);
    if(/^[a-z][a-z0-9_]{3,31}$/i.test(нік)) return 'https://t.me/' + нік;
    return '';
  }
  if(key === 'viberChat' || key === 'viberGroup'){
    if(телефон) return 'viber://chat?number=%2B' + номерМесенджера(v);
    return '';
  }
  if(key === 'instagram' && /^[a-z0-9._]{2,30}$/i.test(нік)) return 'https://instagram.com/' + нік;
  if(key === 'tiktok' && /^[a-z0-9._]{2,30}$/i.test(нік)) return 'https://www.tiktok.com/@' + нік;
  return v;
}
window.fshMsgHref = fshMsgHref;

function msgLink(){
  const L = (typeof CFG !== 'undefined' && CFG.links) || {};

  return ['viberChat', 'telegram', 'viberGroup'].map(k => fshMsgHref(k, L[k])).find(Boolean) || null;
}

function msgHref(){ return null; }

function goMessenger(from){
  (window.dataLayer = window.dataLayer || []).push({event:'messenger', from: from || ''});
  const href = msgHref(from);
  if(href){
    window.open(href, '_blank', 'noopener');
    return true;
  }
  if(typeof window.openChat === 'function'){ window.openChat(); return true; }
  return false;
}
window.msgLink = msgLink;
window.msgHref = msgHref;
window.goMessenger = goMessenger;

const SOCIAL = [
  { key:'facebook',  name:'Facebook',  icon:'<path d="M13.4 21v-7.4h2.5l.4-2.9h-2.9V8.9c0-.8.3-1.4 1.5-1.4h1.5V5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H8v2.9h2.5V21z"/>' },
  { key:'instagram', name:'Instagram', icon:'<path d="M12 4.6c2.4 0 2.7 0 3.6.05 2.5.1 3.65 1.3 3.75 3.75.04.9.05 1.2.05 3.6s0 2.7-.05 3.6c-.1 2.45-1.25 3.65-3.75 3.75-.9.04-1.2.05-3.6.05s-2.7 0-3.6-.05c-2.5-.11-3.65-1.31-3.75-3.75C4.6 14.7 4.6 14.4 4.6 12s0-2.7.05-3.6C4.75 5.95 5.95 4.75 8.4 4.65 9.3 4.6 9.6 4.6 12 4.6Zm0 3.65A3.75 3.75 0 1 0 12 15.75 3.75 3.75 0 0 0 12 8.25Zm0 6.18A2.43 2.43 0 1 1 12 9.57a2.43 2.43 0 0 1 0 4.86Zm3.9-6.33a.88.88 0 1 0 0 1.76.88.88 0 0 0 0-1.76Z"/>' },
  { key:'telegram',  name:'Telegram',  icon:'<path d="M21.9 5.3 18.8 19c-.23 1.02-.85 1.27-1.72.79l-4.75-3.5-2.29 2.2c-.25.26-.47.47-.96.47l.34-4.85 8.82-7.97c.38-.34-.08-.53-.6-.19L6.78 12.5l-4.7-1.47c-1.02-.32-1.04-1.02.21-1.51l18.37-7.08c.85-.32 1.6.2 1.24 1.86Z"/>' },
  { key:'viberChat', name:'Viber',     icon:'<path d="M12 2.8C7 2.8 3.6 6 3.6 10.6c0 2.4 1 4.5 2.7 5.9l-.9 3.5c-.1.4.3.7.7.5l3.5-1.9c.8.2 1.6.3 2.4.3 5 0 8.4-3.2 8.4-7.8S17 2.8 12 2.8Zm4.6 11.3c-.2.6-1.2 1.1-1.8 1.2-.4 0-.9.3-3.3-.9-2-1-3.3-3.2-3.4-3.3-.1-.1-.9-1.2-.9-2.2 0-1 .5-1.5.7-1.7.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .5.5l.7 1.6c0 .1.1.3 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.4-.1.6-.1l1.5.7c.2.1.4.2.5.3 0 .2 0 .7-.2 1.3Z"/>' },
  { key:'tiktok',    name:'TikTok',    icon:'<path d="M16.1 3.5c.35 2.1 1.55 3.46 3.65 3.6v2.86c-1.2.12-2.4-.23-3.5-.86v5.73c0 3.2-2.3 5.67-5.3 5.67-2.9 0-4.95-2.15-4.95-5 0-3.1 2.75-5.33 5.95-4.7v2.95c-.4-.12-.85-.2-1.3-.12-1.05.12-1.8 1-1.8 2.05 0 1.2.9 2.05 2.05 2.05 1.25 0 2.15-1.05 2.15-2.45V3.5z"/>' },
  { key:'youtube',   name:'YouTube',   icon:'<path d="M22 8.3a3 3 0 0 0-2.1-2.1C18 5.7 12 5.7 12 5.7s-6 0-7.9.5A3 3 0 0 0 2 8.3 31 31 0 0 0 1.7 12a31 31 0 0 0 .3 3.7 3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.3-1.2.3-3.7.3-3.7s0-2.5-.3-3.7ZM10.1 15.3V8.7l5.2 3.3z"/>' }
];
function renderFooterSocial(){

  const mail = document.querySelector('#footMail');
  const host = mail && mail.closest('div');
  if(!host) return;
  const L = (typeof CFG !== 'undefined' && CFG.links) || {};

  const items = SOCIAL.filter(s => fshMsgHref(s.key, L[s.key]) && L[s.key + 'On'] !== false);
  let box = host.querySelector('.foot-social') || document.querySelector('footer .foot-social');
  if(!items.length){ if(box) box.remove(); return; }
  if(!box){
    box = document.createElement('div');
    box.className = 'foot-social';
    host.appendChild(box);
  }
  box.innerHTML = items.map(s => {
    const raw = fshMsgHref(s.key, L[s.key]);
    const href = raw.replace(/"/g, '&quot;');

    const нова = /^https?:/i.test(raw) ? ' target="_blank"' : '';
    return '<a href="' + href + '"' + нова + ' rel="noopener nofollow" aria-label="' +
      s.name + '" title="' + s.name + '"><svg viewBox="0 0 24 24" fill="currentColor" ' +
      'stroke="none" aria-hidden="true">' + s.icon + '</svg></a>';
  }).join('');
}
window.renderFooterSocial = renderFooterSocial;
try{ renderFooterSocial(); }catch(e){}

return { sendLead, applySettings, fabricBg, msgLink, msgHref, goMessenger, renderFooterSocial };
})();

(function(){
  const t0 = Date.now();
  const seen = [];

  const віхи = [];

  const CODE = {
    budova:'bud', pro:'pro', vidhuky:'rob', chomu:'chm', tkanyny:'tka',
    kimnaty:'kim', 'kimnaty-teaser':'kim', pidbir:'pid', tsina:'cin',
    zamir:'zam', alt:'alt', blog:'blg', zvyazok:'cta', faq:'faq',
    komplekt:'kmp', kolir:'kol', chym:'chy', de:'de', yak:'yak',
    dostavka:'dst', dovira:'dov'
  };

  const FROM = {
    'шапка':'head', 'херо':'hero', 'будова':'how', 'тканини':'fab',
    'блок заміру':'measure', 'заклик':'cta', 'нижнє меню':'nav',
    'приклади ціни':'price', 'під підбором':'quiz', 'вибір типу':'pick',
    'підбір':'quiz', 'помічник передав менеджеру':'ai',
    'помічник недоступний':'ai_down', 'чат':'chat'
  };

  if('IntersectionObserver' in window){
    const io = new IntersectionObserver(es=>{
      for(const e of es){
        if(!e.isIntersecting) continue;
        const c = CODE[e.target.id];
        if(c && !seen.includes(c)) seen.push(c);
        io.unobserve(e.target);
      }
    }, { threshold: 0.4 });
    const start = () => document.querySelectorAll('section[id]').forEach(s=>io.observe(s));
    if(document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
    else start();
  }

  const secs = () => Math.min(9999, Math.round((Date.now() - t0) / 1000));

  function visitRef(from){
    const parts = ['fsh1', 't' + secs()];
    if(seen.length) parts.push('v-' + seen.slice(0, 8).join('-'));
    const f = FROM[from] || (from ? 'other' : '');
    if(f) parts.push('c-' + f);

    return parts.join('_').replace(/[^A-Za-z0-9_-]/g, '');
  }

  const NAME = {
    bud:'будову', pro:'про компанію', rob:'роботи', chm:'переваги',
    tka:'тканини', kim:'кімнати', pid:'підбір', cin:'ціни',
    zam:'замір', alt:'альтернативу', blg:'блог', cta:'заклик', faq:'питання',
    kmp:'комплект', kol:'тканини', dst:'доставку', dov:'відгуки й цифри'
  };
  function visitSummary(from){
    const s = secs();
    const час = s < 60 ? s + ' секунд' : Math.round(s / 60) + ' хвилин';
    const що = seen.map(c=>NAME[c]).filter(Boolean);
    return 'На сайті ' + час + '. ' +
      (що.length ? 'Дивилась(вся): ' + що.join(', ') + '. ' : 'Розділи не гортала. ') +
      (from ? 'Перейшла з кнопки «' + from + '».' : '');
  }

  function visitMark(що){
    const v = String(що || '').slice(0, 20);
    if (v && !віхи.includes(v)) віхи.push(v);
  }

  function visitData(from){
    return {
      secs: secs(),
      did: віхи.slice(0, 8),
      seen: seen.map(c => NAME[c]).filter(Boolean),
      summary: visitSummary(from),
      from: from || '',
      page: location.pathname,
      ref: (document.referrer || '').slice(0, 200),
      screen: (window.innerWidth || 0) + '×' + (window.innerHeight || 0),
      opened: new Date(t0).toISOString()
    };
  }

  window.visitRef = visitRef;
  window.visitSummary = visitSummary;
  window.visitData = visitData;
  window.visitMark = visitMark;
})();

(function(){
  const КЛЮЧ = 'fsh_consent';

  function metaId(){
    try { return crypto.randomUUID(); }
    catch(e){ return 'e' + Date.now() + Math.random().toString(16).slice(2); }
  }

  const META_STD = new Set(['PageView','ViewContent','Search','AddToCart','AddToWishlist',
    'InitiateCheckout','AddPaymentInfo','Purchase','Lead','CompleteRegistration','Contact',
    'CustomizeProduct','Donate','FindLocation','Schedule','StartTrial','SubmitApplication','Subscribe']);
  function metaEvent(name, params, eventId){
    const id = eventId || metaId();
    try {
      if(typeof fbq === 'function' && window.__fbReady){
        const method = META_STD.has(name) ? 'track' : 'trackCustom';
        fbq(method, name, Object.assign({ product_line: 'roller' }, params || {}), { eventID: id });
      }
    } catch(e){}
    return id;
  }

  function metaNewId(){ return metaId(); }
  window.metaNewId = metaNewId;
  function metaIds(){
    const ck = n => { const m = document.cookie.match('(^|;)\\s*' + n + '\\s*=\\s*([^;]+)');
                      return m ? decodeURIComponent(m[2]) : ''; };
    let fbclid = '';
    try { fbclid = new URLSearchParams(location.search).get('fbclid') || ''; } catch(e){}
    return { fbp: ck('_fbp'), fbc: ck('_fbc'), fbclid };
  }
  window.metaEvent = metaEvent;
  window.metaIds = metaIds;

  const згодаЄ = () => { try{ return localStorage.getItem(КЛЮЧ) === 'all'; }catch(e){ return false; } };

  let started = false;
  function аналітика(){
    if(started) return;
    started = true;
    const A = (typeof CFG !== 'undefined' && CFG.analytics) || {};

    const id = String(A.ga4 || '').trim();
    if(/^G-[A-Z0-9]{6,}$/i.test(id)){
      const dl = (window.dataLayer = window.dataLayer || []);
      function gtag(){ dl.push(arguments); }
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', id, { anonymize_ip: true });

      const sc = document.createElement('script');
      sc.async = true;
      sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
      document.head.appendChild(sc);

      const push = dl.push.bind(dl);
      dl.push = function(){
        const r = push.apply(null, arguments);
        const e = arguments[0];
        if(e && typeof e === 'object' && !Array.isArray(e) && typeof e.event === 'string'){
          const params = {};
          for(const k of Object.keys(e)) if(k !== 'event') params[k] = e[k];
          try{ gtag('event', e.event, params); }catch(err){}
        }
        return r;
      };
    }

    const cid = String(A.clarity || '').trim();
    if(/^[a-z0-9]{6,}$/i.test(cid)){
      (function(c,l,a,r,i){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        var t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        var y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window,document,"clarity","script",cid);
    }

    const mp = String(A.metaPixel || '').trim();
    if(/^\d{6,}$/.test(mp)){
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
        (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', mp);
      window.__fbReady = true;

      const рулонка = document.body && document.body.dataset.onlyLine === 'roller';
      if(рулонка) fbq('track', 'ViewContent',
        { content_name: 'roller', product_line: 'roller' },
        { eventID: metaId() });

      try { document.dispatchEvent(new Event('meta-ready')); } catch(e){}
    }
  }
  window.запуститиGA = аналітика;

  if(згодаЄ()) аналітика();

  let вузол = null;
  function сховати(){
    if(!вузол) return;
    вузол.classList.remove('on');
    const n = вузол; вузол = null;
    setTimeout(()=>n.remove(), 350);
  }
  function обрати(стан){
    try{ localStorage.setItem(КЛЮЧ, стан); }catch(e){}
    if(стан === 'all') аналітика();
    сховати();
  }
  function показати(){
    if(вузол) return;
    вузол = document.createElement('div');
    вузол.className = 'ck-banner';
    вузол.setAttribute('role', 'dialog');
    вузол.setAttribute('aria-label', 'Згода на використання cookie');
    вузол.innerHTML =
      '<span class="ck-ic" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 2a10 10 0 1 0 9.5 7 3.5 3.5 0 0 1-4.5-4.5A3.5 3.5 0 0 1 12 2z"/>' +
        '<circle cx="9" cy="11.5" r="1"/><circle cx="13.5" cy="15" r="1"/><circle cx="15.5" cy="9.5" r="1"/></svg>' +
      '</span>' +
      '<div class="ck-body">' +
        '<b>Трохи про cookie</b>' +
        '<p>Необхідні — щоб сайт працював. Аналітику вмикаємо лише з вашої згоди, ' +
        'щоб бачити, що покращити. <a href="/umovy.html#privacy">Докладніше</a>.</p>' +
      '</div>' +
      '<div class="ck-btns">' +
        '<button type="button" class="ck-no">Тільки необхідні</button>' +
        '<button type="button" class="ck-yes">Прийняти все</button>' +
      '</div>';
    document.body.appendChild(вузол);
    вузол.querySelector('.ck-yes').onclick = () => обрати('all');
    вузол.querySelector('.ck-no').onclick  = () => обрати('necessary');
    requestAnimationFrame(() => requestAnimationFrame(() => вузол.classList.add('on')));
  }
  window.openCookieSettings = показати;

  function керуванняВПідвал(){
    const якір = document.querySelector('footer a[href*="umovy.html#privacy"]');
    if(!якір || якір.parentElement.querySelector('.ck-manage')) return;
    const a = document.createElement('a');
    a.href = '#'; a.className = 'ck-manage'; a.textContent = 'Налаштування cookie';
    a.addEventListener('click', e => { e.preventDefault(); показати(); });
    якір.parentElement.appendChild(a);
  }

  function старт(){
    керуванняВПідвал();
    let вибрано = null;
    try{ вибрано = localStorage.getItem(КЛЮЧ); }catch(e){}
    if(!вибрано) setTimeout(показати, 700);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', старт);
  else старт();

  const css =
  '.ck-banner{position:fixed;left:20px;bottom:20px;z-index:120;width:min(382px,calc(100vw - 32px));' +
    'background:var(--card,#fff);color:var(--ink,#241E19);border:1px solid var(--line,#E8DED1);' +
    'border-radius:18px;box-shadow:0 2px 10px rgba(60,44,30,.08),0 24px 60px -28px rgba(60,44,30,.45);' +
    'padding:17px 18px 15px;display:grid;grid-template-columns:auto 1fr;gap:11px;' +
    "font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif;" +
    'opacity:0;transform:translateY(16px);transition:opacity .35s ease,transform .35s cubic-bezier(.2,.8,.2,1)}' +
  '.ck-banner.on{opacity:1;transform:none}' +
  '.ck-ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex:none;' +
    'background:var(--terra-bg,#F8F1E8);color:var(--terra,#95562A)}' +
  '.ck-ic svg{width:22px;height:22px}' +
  '.ck-body{min-width:0}' +
  ".ck-body b{font-family:'Manrope','Inter',sans-serif;font-size:14.5px;font-weight:800;" +
    'letter-spacing:-.02em;display:block;margin-bottom:3px}' +
  '.ck-body p{font-size:12.8px;line-height:1.5;color:var(--muted,#6B5C51);margin:0}' +
  '.ck-body a{color:var(--terra,#95562A);font-weight:600;text-decoration:underline;text-underline-offset:2px}' +
  '.ck-btns{grid-column:1/-1;display:flex;gap:9px;margin-top:3px}' +
  '.ck-btns button{flex:1;min-height:44px;border-radius:999px;cursor:pointer;' +
    "font-family:inherit;font-size:13.5px;font-weight:700;transition:background .18s,border-color .18s,color .18s}" +
  '.ck-yes{background:var(--terra,#95562A);color:#fff;border:0}' +
  '.ck-yes:hover{background:var(--terra-d,#78431F)}' +
  '.ck-no{background:transparent;color:var(--ink,#241E19);border:1.5px solid var(--line,#E8DED1)}' +
  '.ck-no:hover{border-color:var(--terra,#95562A);color:var(--terra,#95562A)}' +
  '.ck-manage{cursor:pointer}' +
  'html[data-theme="dark"] .ck-yes{color:#2A1A0C}' +
  '@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .ck-yes{color:#2A1A0C}}' +

  '@media(max-width:560px){' +
    '.ck-banner{left:8px;right:8px;top:calc(8px + env(safe-area-inset-top,0px));bottom:auto;width:auto;' +
      'grid-template-columns:1fr;gap:8px;padding:11px 12px 10px;border-radius:14px;transform:translateY(-16px)}' +
    '.ck-banner.on{transform:none}' +
    '.ck-ic,.ck-body b{display:none}' +
    '.ck-body p{font-size:12.5px;line-height:1.4}' +
    '.ck-btns{flex-direction:row;gap:8px;margin-top:0}' +
    '.ck-btns button{font-size:13px;padding:0 8px}}' +
  '@media(prefers-reduced-motion:reduce){.ck-banner{transition:opacity .2s}}';
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
})();

function applyBlocks(){
  if(typeof CFG === 'undefined' || !CFG.blocks) return;
  for(const [id, on] of Object.entries(CFG.blocks)){
    const sec = document.getElementById(id);
    if(sec) sec.hidden = !on;
  }

  if(typeof window.rebuildNav === 'function') window.rebuildNav();
}
window.applyBlocks = applyBlocks;
document.addEventListener('cfg-updated', applyBlocks);
if(document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', applyBlocks);
else applyBlocks();

function applyDetails(){
  if(typeof CFG === 'undefined' || !CFG.details) return;
  for(const [id, text] of Object.entries(CFG.details)){
    const sec = document.getElementById(id);
    if(!sec) continue;
    const had = sec.querySelector('[data-exp].exp--auto');
    const body = String(text || '').trim();
    if(!body){ if(had) had.remove(); continue; }

    const html = body.split(/\n{2,}/).map(par =>
      '<p>' + par.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                 .split('\n').join('<br>') + '</p>').join('');

    let box = had;
    if(!box){
      box = document.createElement('div');
      box.className = 'exp exp--auto';
      box.setAttribute('data-exp', '');
      box.innerHTML =
        '<button class="exp-btn" type="button" aria-expanded="false">' +
          '<span>Детальніше</span><i class="arw" aria-hidden="true"></i></button>' +
        '<div class="exp-body"><div class="exp-in"></div></div>';
      const wrap = sec.querySelector('.wrap') || sec;
      wrap.appendChild(box);
      const btn = box.querySelector('.exp-btn');
      btn.addEventListener('click', ()=>{
        const open = box.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
      });
    }
    box.querySelector('.exp-in').innerHTML = html;
  }
}
window.applyDetails = applyDetails;
document.addEventListener('cfg-updated', applyDetails);
if(document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', applyDetails);
else applyDetails();
