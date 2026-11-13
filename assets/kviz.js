(function(){

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => new Intl.NumberFormat('uk-UA').format(Math.round(n)) + ' ₴';

const pctOf = id => window.fshPromoPct ? window.fshPromoPct(id) : 0;
const multOf = id => { const p = pctOf(id); return p > 0 && p < 100 ? 1/(1 - p/100) : 0; };

const INDIV_HTML = '<span class="kv-indiv">Індивідуальна<sup>*</sup></span>';

function priceTag(val, withPct, old){
  if(val === null) return INDIV_HTML;
  if(!(old > val)) return money(val);
  const pct = withPct ? Math.round((1 - val/old) * 100) : 0;
  const tag = pct ? ' <span class="kv-off">−' + pct + '%</span>' : '';
  return '<s class="kv-was">' + money(old) + '</s> ' + money(val) + tag;
}

function indivNote(){ return (CFG.rollerFormula && CFG.rollerFormula.note) ||
  'Точну ціну порахує менеджер і повідомить вам.'; }

function fabTag(f){
  if(productLine === 'roller'){
    const now = window.fshRollerMin ? window.fshRollerMin(f.id) : 0;
    const pct = Math.round(pctOf(f.id));
    return (now ? 'від ' + money(now) : '') + (pct ? (now ? ' · ' : '') + 'знижка −' + pct + '%' : '');
  }
  return (f.price || 0) + ' ₴/м²';
}
const track = (e,d={}) => (window.dataLayer=window.dataLayer||[]).push({event:e,...d});
function clarityEvent(name){
  if(typeof window.clarity !== 'function') return false;
  try{
    if(localStorage.getItem('fsh_consent') !== 'all') return false;
    window.clarity('event', name);
    return true;
  }catch(e){ return false; }
}
const clamp = (v,a,b) => Math.min(Math.max(v,a),b);
const calm  = matchMedia('(prefers-reduced-motion:reduce)').matches;

const WHOLE_MAX_W = 400;
const STORE = 'fsh_kviz_v1';

let winNo = 1;
let step = 0;
let cart = [];
let cur = null;
let curAdded = false;
let curIdx = -1;
let sending = false;

const STEPS = ['line','fabric','size'];

let productLine = 'daynight';

const urlFabric = (() => {
  try{ return new URLSearchParams(location.search).get('fabric') || ''; }catch(e){ return ''; }
})();
function startFabric(){
  return (urlFabric && CFG.fabrics.some(f => f.id === urlFabric)) ? urlFabric : CFG.fabrics[0].id;
}
function blankBlind(){ return { fabric:startFabric(), w:65, h:150 }; }
function blank(){
  return { line:productLine, count:1, whole:false, w:65, h:150,
           system:'open', fabric:startFabric(), side:'right', options:[],
           blinds:[ blankBlind() ], bi:0, _seen:{0:true} };
}
const dup = o => JSON.parse(JSON.stringify(o));
function curBlind(){
  if(!Array.isArray(cur.blinds) || !cur.blinds.length) cur.blinds = [blankBlind()];
  if(cur.bi == null || cur.bi < 0) cur.bi = 0;
  if(cur.bi >= cur.blinds.length) cur.bi = cur.blinds.length - 1;
  return cur.blinds[cur.bi];
}

function loadBlind(){ const b = curBlind(); cur.fabric = b.fabric; cur.w = b.w; cur.h = b.h; }
function stashBlind(){ const b = curBlind(); b.fabric = cur.fabric; b.w = cur.w; b.h = cur.h; }

function fitBlinds(){
  const n = Math.max(1, cur.count || 1);
  if(!Array.isArray(cur.blinds) || !cur.blinds.length) cur.blinds = [blankBlind()];
  while(cur.blinds.length < n) cur.blinds.push(dup(cur.blinds[cur.blinds.length - 1]));
  if(cur.blinds.length > n) cur.blinds.length = n;
  if(cur.bi >= n) cur.bi = n - 1;
}

function blindObj(i){
  const b = (cur.blinds && cur.blinds[i]) || curBlind();
  return { line:cur.line, count:1, whole:cur.whole, system:cur.system,
           side:cur.side, fabric:b.fabric, w:b.w, h:b.h, options:cur.options || [] };
}

function fabPrice(c, fab){ return (c.line === 'roller' ? fab.roller : fab.price) || fab.price; }

function priceOne(c){
  const sys = CFG.systems[c.system] || { add:0, name:'' };
  const fab = CFG.fabrics.find(f=>f.id===c.fabric);

  if(!fab) return null;
  const opts = c.options.reduce((s,id)=>s+(CFG.options.find(o=>o.id===id)?.price||0),0);
  if(c.line === 'roller'){
    const b = window.fshRollerBase ? window.fshRollerBase(c.w, c.h, c.fabric) : null;
    if(b === null) return null;

    return Math.round(b + (sys.add||0) + opts);
  }

  const m2 = Math.max(CFG.minArea, (c.w/100)*(c.h/100));
  const base = m2 * fabPrice(c, fab);

  return Math.round(Math.max(CFG.minPrice, base) + (sys.add||0) + opts);
}

function priceWin(c){

  if(Array.isArray(c.blinds) && c.blinds.length){
    let sum = 0;
    for(const b of c.blinds){
      const p = priceOne(Object.assign({}, c, {fabric:b.fabric, w:b.w, h:b.h}));
      if(p === null) return null;
      sum += p;
    }
    return sum;
  }
  const p = priceOne(c);
  return p === null ? null : p * c.count;
}

function oldWin(c){
  const one = (fabric, p) => Math.round(p * (multOf(fabric) || 1));
  if(Array.isArray(c.blinds) && c.blinds.length){
    let sum = 0;
    for(const b of c.blinds){
      const p = priceOne(Object.assign({}, c, {fabric:b.fabric, w:b.w, h:b.h}));
      if(p === null) return null;
      sum += one(b.fabric, p);
    }
    return sum;
  }
  const p = priceOne(c);
  return p === null ? null : one(c.fabric, p) * c.count;
}

function prodW(c){ return c.w + (CFG.productExtraW || 0); }
function limits(c){

  if(c.line === 'roller' && CFG.rollerFormula){
    const F = CFG.rollerFormula;
    return { minW:+F.minW||20, maxW:+F.maxW||300, minH:+F.minH||20, maxH:+F.maxH||500 };
  }
  const s = CFG.systems[c.system];
  return { minW:s.minW, maxW: c.whole ? WHOLE_MAX_W : s.maxW, minH:s.minH, maxH:s.maxH };
}

function isIndiv(c){
  return c.line === 'roller' && window.fshRollerBase &&
         window.fshRollerBase(c.w, c.h, c.fabric) === null;
}
function sizeOk(c){
  const L = limits(c);
  return c.w >= L.minW && c.w <= L.maxW && c.h >= L.minH && c.h <= L.maxH;
}

function drawWindow(c, withBlinds){

  const panes = Math.max(1, c.count);
  const ratio = clamp(c.w / c.h, 0.32, 2.1);
  const SH = 320, SW = Math.round(SH * ratio);
  const M = c.whole ? 34 : 10, P = 18, SILL = 15, WALL = 22;
  const X0 = WALL + P, Y0 = WALL + P;
  const innerW = panes * SW + (panes - 1) * M;
  const VW = innerW + P*2 + WALL*2;
  const VH = SH + P*2 + SILL + WALL;
  const fab = CFG.fabrics.find(f=>f.id===c.fabric) || CFG.fabrics[0];
  const closed = c.system === 'closed';
  const left = c.side === 'left';
  const BLUR = Math.max(3, SW * 0.02);

  const d = [];
  d.push(`<defs>
    <linearGradient id="kw" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F7F5F1"/><stop offset="1" stop-color="#E9E5DD"/></linearGradient>
    <linearGradient id="ksky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#B6D6EA"/><stop offset="44%" stop-color="#D6E7EE"/>
      <stop offset="1" stop-color="#E9EDE3"/></linearGradient>
    <linearGradient id="kfr" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCD8D0"/></linearGradient>
    <linearGradient id="ksill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F5F1E9"/><stop offset="1" stop-color="#CFC9BD"/></linearGradient>
    <linearGradient id="kroll" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C3BDB4"/><stop offset="40%" stop-color="#918B82"/>
      <stop offset="1" stop-color="#635D55"/></linearGradient>
    <linearGradient id="kshade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".16"/>
      <stop offset="16%" stop-color="#fff" stop-opacity=".10"/>
      <stop offset="84%" stop-color="#fff" stop-opacity=".05"/>
      <stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>
    <linearGradient id="kglare" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".34"/>
      <stop offset="56%" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="khaze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FAFCFD" stop-opacity="0"/>
      <stop offset="52%" stop-color="#FAFCFD" stop-opacity=".42"/>
      <stop offset="1" stop-color="#FAFCFD" stop-opacity="0"/></linearGradient>
    <linearGradient id="kfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity=".2"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <radialGradient id="ksun" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#FFFEF6" stop-opacity="1"/>
      <stop offset=".13" stop-color="#FFF7D6" stop-opacity=".94"/>
      <stop offset=".40" stop-color="#FFE8A8" stop-opacity=".40"/>
      <stop offset="1" stop-color="#FFDF8E" stop-opacity="0"/></radialGradient>
    <filter id="kglass" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${(BLUR*0.17).toFixed(2)}"/></filter>
    <filter id="kflare" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${(SH*0.012).toFixed(2)}"/></filter>
    <filter id="kbokeh" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${BLUR}"/></filter>
    <filter id="ksoft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#1b2a20" flood-opacity=".2"/></filter>
    <filter id="ktiny" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#1b2a20" flood-opacity=".28"/></filter>
  </defs>`);

  d.push(`<rect width="${VW}" height="${VH}" fill="url(#kw)"/>`);
  d.push(`<rect x="${X0-P}" y="${Y0-P}" width="${innerW+P*2}" height="${SH+P*2}" rx="7"
    fill="url(#kfr)" stroke="#BDB7AD" stroke-width="1.4" filter="url(#ksoft)"/>`);
  d.push(`<rect x="${X0-4}" y="${Y0-4}" width="${innerW+8}" height="${SH+8}" rx="3"
    fill="none" stroke="#fff" stroke-width="2" opacity=".75"/>`);
  d.push(`<rect x="${X0-P-11}" y="${Y0+SH+P}" width="${innerW+P*2+22}" height="${SILL}" rx="4" fill="url(#ksill)"/>`);
  d.push(`<rect x="${X0-P-11}" y="${Y0+SH+P}" width="${innerW+P*2+22}" height="2.4" rx="1" fill="#FDFBF6"/>`);

  const FAR  = [[0.06,.56,.19,.085],[0.30,.535,.22,.10],[0.55,.552,.20,.088],[0.80,.532,.23,.102],[1.02,.556,.18,.09]];
  const NEAR = [[-0.02,.64,.16,.105],[0.17,.612,.19,.128],[0.38,.646,.15,.096],
                [0.56,.606,.20,.132],[0.76,.64,.17,.11],[0.97,.62,.18,.12]];
  const FC = ['#AFC0A6','#B7C7AD','#A8BA9F','#B2C3A9','#AABBA1'];
  const NC = ['#88A07F','#93AB8A','#7E9776','#8DA584','#849B7B','#90A887'];

  const sunX = X0 + innerW*0.78, sunY = Y0 + SH*0.16;
  const ray = (rx, ry, deg, op) =>
    `<ellipse cx="${sunX}" cy="${sunY}" rx="${rx}" ry="${ry}" fill="#FFF9E4" opacity="${op}"` +
    ` transform="rotate(${deg} ${sunX} ${sunY})"/>`;
  const SUN =
      `<circle cx="${sunX}" cy="${sunY}" r="${SH*0.66}" fill="url(#ksun)"/>`
    + `<g filter="url(#kflare)">`
    + ray(SH*1.15, SH*0.014, 0, '.75') + ray(SH*0.95, SH*0.012, 90, '.62')
    + ray(SH*0.52, SH*0.008, 45, '.45') + ray(SH*0.52, SH*0.008, -45, '.45')
    + `</g>`
    + `<circle cx="${sunX}" cy="${sunY}" r="${SH*0.105}" fill="#FFFEF8" filter="url(#kflare)"/>`
    + `<circle cx="${sunX}" cy="${sunY}" r="${SH*0.055}" fill="#FFFFFF"/>`;

  const PH = SH*0.68, PW = PH*0.654, px = X0 + innerW*0.29, py = Y0 + SH;
  const foto = (CFG.vis && CFG.vis.person) || '';
  const HUMAN = foto
    ? `<image href="${foto}" x="${px-PW/2}" y="${py-PH}" width="${PW}" height="${PH}"
        filter="url(#kglass)"/>`
    : `<g filter="url(#kglass)" opacity=".76">`
    + `<ellipse cx="${px}" cy="${py-PH*0.93}" rx="${PH*0.055}" ry="${PH*0.068}" fill="#57604F"/>`
    + `<path d="M${px-PH*0.115} ${py-PH*0.84} Q${px} ${py-PH*0.90} ${px+PH*0.115} ${py-PH*0.84}`
    + ` L${px+PH*0.095} ${py} L${px-PH*0.095} ${py} Z" fill="#57604F"/></g>`;

  for(let i=0;i<panes;i++){
    const gx = X0 + i*(SW+M), hz = Y0 + SH*0.60;
    d.push(`<clipPath id="kg${i}"><rect x="${gx}" y="${Y0}" width="${SW}" height="${SH}"/></clipPath>`);
    d.push(`<g clip-path="url(#kg${i})">`);
    d.push(`<rect x="${gx}" y="${Y0}" width="${SW}" height="${SH}" fill="url(#ksky)"/>`);
    d.push(`<g filter="url(#kbokeh)">`);
    d.push(`<rect x="${gx+SW*0.02}" y="${Y0+SH*0.26}" width="${SW*0.30}" height="${SH*0.34}" fill="#C6CCC8" opacity=".5"/>`);
    d.push(`<rect x="${gx+SW*0.66}" y="${Y0+SH*0.33}" width="${SW*0.28}" height="${SH*0.27}" fill="#CCD1CC" opacity=".42"/>`);
    FAR.forEach((t,k)=>d.push(`<ellipse cx="${gx+SW*t[0]}" cy="${Y0+SH*t[1]}" rx="${SW*t[2]}" ry="${SH*t[3]}" fill="${FC[k]}"/>`));
    d.push(`<rect x="${gx-BLUR*3}" y="${hz}" width="${SW+BLUR*6}" height="${Y0+SH-hz+BLUR*3}" fill="#9AAF91"/>`);
    NEAR.forEach((t,k)=>d.push(`<ellipse cx="${gx+SW*t[0]}" cy="${Y0+SH*t[1]}" rx="${SW*t[2]}" ry="${SH*t[3]}" fill="${NC[k]}"/>`));
    d.push(`<rect x="${gx-BLUR*3}" y="${Y0+SH*0.88}" width="${SW+BLUR*6}" height="${SH*0.24}" fill="#78906F" opacity=".8"/>`);
    d.push('</g>');
    d.push(SUN);
    d.push(HUMAN);
    d.push(`<rect x="${gx}" y="${Y0+SH*0.36}" width="${SW}" height="${SH*0.36}" fill="url(#khaze)"/>`);
    d.push(`<path d="M${gx} ${Y0+SH*0.8} L${gx+SW*0.66} ${Y0} L${gx+SW} ${Y0} L${gx} ${Y0+SH}Z" fill="url(#kglare)"/>`);
    d.push('</g>');
    if(i < panes-1)
      d.push(`<rect x="${gx+SW}" y="${Y0-1}" width="${M}" height="${SH+2}" fill="url(#kfr)" stroke="#BDB7AD" stroke-width="1"/>`);
  }

  const blind = (bx, bw, delay, key) => {
    const g = [];
    const CH = SH + 16;

    g.push(`<g class="roll-grp" style="--d:${delay}s">`);
    g.push(closed
      ? `<rect x="${bx-5}" y="${Y0-15}" width="${bw+10}" height="21" rx="5" fill="url(#kfr)"
           stroke="#BDB7AD" stroke-width="1.2" filter="url(#ktiny)"/>`
        + `<rect x="${bx-2}" y="${Y0-11}" width="${bw+4}" height="4" rx="2" fill="#D8D2C8"/>`
        + `<rect x="${bx-2}" y="${Y0-14}" width="${bw+4}" height="2" rx="1" fill="#fff" opacity=".8"/>`
      : `<rect x="${bx-4}" y="${Y0-11}" width="${bw+8}" height="17" rx="8.5" fill="url(#kroll)" filter="url(#ktiny)"/>`
        + `<rect x="${bx-4}" y="${Y0-11}" width="${bw+8}" height="5" rx="2.5" fill="#fff" opacity=".28"/>`
        + `<ellipse cx="${bx-2}" cy="${Y0-2.5}" rx="3" ry="8" fill="#5A544C" opacity=".5"/>`
        + `<ellipse cx="${bx+bw+2}" cy="${Y0-2.5}" rx="3" ry="8" fill="#5A544C" opacity=".5"/>`);
    g.push('</g>');

    g.push(`<clipPath id="kb${key}"><rect x="${bx-8}" y="${Y0-1}" width="${bw+16}" height="${CH}"/></clipPath>`);
    g.push(`<g clip-path="url(#kb${key})">`);
    g.push(`<g class="blind-grp" style="--drop:${-CH}px;--d:${(delay + 0.42).toFixed(2)}s">`);
    g.push(`<rect x="${bx}" y="${Y0}" width="${bw}" height="${SH}" fill="${fab.from}"/>`);
    if(c.line === 'roller'){

      g.push(`<rect x="${bx}" y="${Y0}" width="${bw}" height="${SH}" fill="${fab.to}" opacity=".55"/>`);
    } else {
      const band = Math.max(10, Math.round(SH/15));
      for(let y = Y0+band; y < Y0+SH-3; y += band*2){
        const bh = Math.min(band, Y0+SH-3-y);
        if(bh <= 2) continue;
        g.push(`<rect x="${bx}" y="${y}" width="${bw}" height="${bh}" fill="${fab.to}" opacity=".93"/>`);
        g.push(`<rect x="${bx}" y="${y}" width="${bw}" height="1.2" fill="#fff" opacity=".22"/>`);
      }
    }
    for(let x = bx+6; x < bx+bw-4; x += 7)
      g.push(`<rect x="${x}" y="${Y0}" width="1" height="${SH}" fill="#000" opacity=".03"/>`);
    g.push(`<rect x="${bx}" y="${Y0}" width="${bw}" height="${SH}" fill="url(#kshade)"/>`);
    g.push(`<rect x="${bx}" y="${Y0}" width="${bw}" height="15" fill="url(#kfade)"/>`);
    g.push(`<rect x="${bx-2}" y="${Y0+SH-10}" width="${bw+4}" height="11" rx="5" fill="#A29990" filter="url(#ktiny)"/>`);
    g.push(`<rect x="${bx-2}" y="${Y0+SH-10}" width="${bw+4}" height="3" rx="1.5" fill="#fff" opacity=".4"/>`);
    g.push('</g></g>');

    const cx = left ? bx + 9 : bx + bw - 9;
    const r = Math.max(1.25, SW * 0.013);
    const dstep = r * 2.05;
    const w = r * 3.4;
    const hang = Math.min(SH * 0.58, SH - 24);
    const nDown = Math.max(6, Math.round(hang / dstep));
    const Lx = cx - w / 2, Rx = cx + w / 2, topY = Y0 - 4;
    const ball = (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#ECE7E0" stroke="#9A9188" stroke-width=".4"/>`;
    let ch = `<g class="chain-grp" style="--d:${(delay + 1.15).toFixed(2)}s">`;
    for(let k = 0; k < nDown; k++){
      const y = topY + k * dstep;
      ch += ball(Lx, y) + ball(Rx, y);
    }

    const by = topY + (nDown - 1) * dstep, arcN = 5;
    for(let k = 1; k < arcN; k++){
      const t = k / arcN;
      ch += ball(cx - (w / 2) * Math.cos(Math.PI * t), by + (w / 2) * Math.sin(Math.PI * t));
    }
    ch += '</g>';
    g.push(ch);
    return g.join('');
  };

  if(withBlinds){
    for(let i=0;i<panes;i++)
      d.push(blind(X0 + i*(SW+M), SW, calm ? 0 : i*0.16, i));
  }

  return `<svg viewBox="0 0 ${VW} ${VH}" role="img"
    aria-label="Візуалізація вікна ${c.w} на ${c.h} сантиметрів">${d.join('')}</svg>`;
}

function miniWindow(c){
  const fab = CFG.fabrics.find(f=>f.id===c.fabric) || CFG.fabrics[0];
  const тло = window.fabricBg ? window.fabricBg(fab, false, true)
            : `linear-gradient(160deg,${fab.from},${fab.to})`;
  return `<span style="display:block;height:100%;background:${тло}"></span>`;
}

const answered = {size:true, options:true};

function syncChecked(){
  $$('.kv-opt[role="radio"],.kv-fab[role="radio"]').forEach(b=>
    b.setAttribute('aria-checked', b.classList.contains('on') ? 'true' : 'false'));
}

function markAnswered(name){
  syncChecked();
  answered[name] = true;
  const b = document.querySelector(`.kv-q[data-q="${name}"] [data-next]`);
  if(b) b.disabled = false;
}
function syncNext(name){
  const b = document.querySelector(`.kv-q[data-q="${name}"] [data-next]`);
  if(b) b.disabled = !answered[name];
}

let pushSteps = false;

function logicalPos(name){
  const baseN = (preset ? 0 : 1);
  const total = baseN + 2;
  let idx = total;
  if(name === 'line')         idx = 1;
  else if(name === 'fabric')  idx = baseN + 1;
  else if(name === 'size')    idx = baseN + 2;
  return { idx, total };
}
function blindText(){
  return (cur && cur.count > 1) ? `Штора ${(cur.bi||0)+1} з ${cur.count}` : '';
}
function setBlindLabels(){
  const t = blindText();
  const a = $('#kvSizeHint'), b = $('#kvFabBlind');
  if(a) a.textContent = t;
  if(b) b.textContent = t;
}
function fillSizeInputs(){
  const w = $('#kvW'), h = $('#kvH');
  if(w){ w.value = cur.w; w.classList.remove('bad'); }
  if(h){ h.value = cur.h; h.classList.remove('bad'); }
  setFieldErr('#kvErrW', null); setFieldErr('#kvErrH', null);
  syncProdW();
}

function syncProdW(){
  const el = $('#kvProdW');
  if(!el) return;
  const extra = CFG.productExtraW || 0;
  const w = +(($('#kvW') || {}).value) || 0;
  el.value = w > 0 ? (w + extra) : '';
}
function show(name, fromHistory){
  step = STEPS.indexOf(name);

  if(name === 'fabric') loadBlind();
  if(name === 'size'){ loadBlind(); fillSizeInputs(); }
  if(!fromHistory){
    const st = {kvStep:name, bi:cur.bi};
    if(pushSteps) history.pushState(st, '', location.href);
    else { history.replaceState(st, '', location.href); pushSteps = true; }
  }
  $$('.kv-q').forEach(q=>q.classList.toggle('on', q.dataset.q === name));
  syncChecked();
  if(name === 'fabric' && cur.fabric){ showFabric(cur.fabric); markAnswered('fabric'); }
  if(name === 'fabric') fitFabImg();
  if(name === 'size') syncLimits();
  setBlindLabels();

  const pos = logicalPos(name);
  $('#kvBar').style.width = Math.round(pos.idx / (pos.total + 1) * 100) + '%';
  const tag = cart.length ? ` · штора ${winNo}` : '';
  $('#kvStep').textContent = `Крок ${pos.idx} з ${pos.total}` + tag;

  $('#kvBack').disabled = step <= (preset ? 1 : 0) && !cart.length;
  $$('.kv-badge').forEach(b=>{
    b.textContent = cart.length ? `Штора ${winNo}` : 'Ваша штора';
    b.style.display = '';
  });
  syncNext(name);
  if(name === 'size') clarityEvent('kviz_measurement_opened');
  window.scrollTo({top:0, behavior:'smooth'});
}

function next(){
  if(sending) return;
  const name = STEPS[step];

  if(!answered[name]) return;

  if(name === 'fabric') stashBlind();
  if(name === 'size'){
    if(!checkSize()){
      clarityEvent('kviz_measurement_invalid');
      return;
    }
    stashBlind();

    finishBlind();
    return;
  }
  show(STEPS[Math.min(step+1, STEPS.length-1)]);
}
function back(){
  const name = STEPS[step];

  if(name === 'fabric' || name === 'size') stashBlind();
  const floor = preset ? 1 : 0;
  if(step <= floor){

    if(cart.length) openCart(false, true);
    return;
  }
  show(STEPS[step-1]);
}

function finishBlind(){
  stashBlind();
  const pw = priceWin(cur);
  track('kviz_result', {value: pw === null ? 0 : pw, indiv: pw === null});
  addToCartQuiet();
  openCart();
}

function buildLine(){
  const box = $('#kvLine');
  if(!box) return;
  box.innerHTML = Object.values(CFG.lines).filter(L=>L.id === 'roller').map(L=>`
    <button class="kv-opt kv-opt--line" type="button" role="radio" aria-checked="false" data-v="${L.id}">
      <span class="tick">✓</span>
      <b>${L.name}</b>
      <span>${L.claim}. ${L.text}</span>
      <span class="kv-from">від ${window.fshRollerMin ? fshRollerMin() : L.from} ₴</span>
    </button>`).join('');
  box.onclick = e => {
    const b = e.target.closest('.kv-opt'); if(!b) return;
    productLine = b.dataset.v;
    cur = cur || blank();
    cur.line = productLine;
    $$('#kvLine .kv-opt').forEach(x=>x.classList.toggle('on', x === b));
    markAnswered('line');
    track('kviz_line', {line:productLine});
  };
}

function fabButtonsHTML(){
  return CFG.fabrics.map(f=>`
    <button class="kv-fab" type="button" role="radio" aria-checked="false" data-v="${f.id}">
      <span class="sw" style="background:${window.fabricBg ? window.fabricBg(f, false, true)
        : `linear-gradient(160deg,${f.from} 0 50%,${f.to} 50% 100%)`}"></span>
      <b>${f.name}</b><span>${f.transmission}</span>
      <span class="kv-fabpr">${fabTag(f)}</span>
    </button>`).join('');
}
function fabOptionsHTML(){
  return CFG.fabrics.map(f=>{
    const тло = window.fabricBg ? window.fabricBg(f, false, true)
              : `linear-gradient(160deg,${f.from},${f.to})`;
    return `<button class="fsel-opt" type="button" role="option" aria-selected="false" data-v="${f.id}">
      <span class="fsel-sw" style="background:${тло}"></span>
      <span class="fsel-tx"><b>${f.name}</b><span>${f.transmission}</span></span>
      <i>${fabTag(f)}</i></button>`;
  }).join('');
}

function rebuildFabrics(){
  const box = $('#kvFabric');
  if(box) box.innerHTML = fabButtonsHTML();
  const поп = $('#kvFabSel .fsel-pop');
  if(поп) поп.innerHTML = fabOptionsHTML();
  if(cur && !CFG.fabrics.some(f => f.id === cur.fabric)){
    cur.fabric = startFabric();
    try{ stashBlind(); }catch(e){}
  }
  if(cur && cur.fabric) showFabric(cur.fabric);
}

function buildFabric(){
  const box = $('#kvFabric');
  box.innerHTML = fabButtonsHTML();
  box.onclick = e => {
    const b = e.target.closest('.kv-fab'); if(!b) return;
    обрати(b.dataset.v);
  };

  const panelHeight = el => (innerWidth <= 900 ? Math.max(el.offsetHeight, 70) : 0);

  const sel = $('#kvFabSel');
  if(sel){
    const поп = sel.querySelector('.fsel-pop');
    const кн  = sel.querySelector('.fsel-btn');
    поп.innerHTML = fabOptionsHTML();

    const відкрити = (так) => {
      поп.hidden = !так;
      sel.classList.toggle('open', так);
      кн.setAttribute('aria-expanded', так ? 'true' : 'false');
      if(так){

        const панель = document.querySelector('.mnav');
        const зайнято = панель ? panelHeight(панель) : 0;
        const кнR = кн.getBoundingClientRect();
        const нижче = innerHeight - зайнято - кнR.bottom - 18;
        const вище  = кнR.top - 18;
        const вгору = нижче < 220 && вище > нижче;
        sel.classList.toggle('up', вгору);
        поп.style.maxHeight = Math.max(160, Math.min(420, вгору ? вище : нижче)) + 'px';
        const є = поп.querySelector('.fsel-opt[aria-selected="true"]');
        (є || поп.firstElementChild).focus();
      }
    };
    кн.onclick = () => відкрити(поп.hidden);
    поп.onclick = e => {
      const o = e.target.closest('.fsel-opt'); if(!o) return;
      обрати(o.dataset.v); відкрити(false); кн.focus();
    };

    document.addEventListener('click', e => { if(!sel.contains(e.target)) відкрити(false); });
    sel.addEventListener('keydown', e => {
      if(e.key === 'Escape' && !поп.hidden){ відкрити(false); кн.focus(); }
    });
  }

  const fimg = $('#kvFabImg');
  if(fimg){

    const дотик = matchMedia('(hover: none), (pointer: coarse)').matches ||
                  ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    fimg.classList.toggle('touch', дотик);
    fimg.onclick = () => { if(fimg.classList.contains('has-win')) fimg.classList.toggle('peek'); };
  }

  if(cur && cur.fabric) showFabric(cur.fabric);
}

function обрати(id){
  cur.fabric = id;
  showFabric(id);
  markAnswered('fabric');
}

function syncLimits(){
  const L = limits(cur);
  syncSizeHint();

  $('#kvW').min = L.minW; $('#kvW').max = L.maxW; $('#kvW').step = 1;
  $('#kvH').min = L.minH; $('#kvH').max = L.maxH; $('#kvH').step = 1;
}

function syncSizeHint(){ setBlindLabels(); }

function fieldProblem(val, min, max, what){
  if(val === '' || val === null) return `Вкажіть ${what.acc}.`;
  const n = +val;
  if(!isFinite(n) || n <= 0) return `${what.nom} має бути більшою за нуль.`;
  if(!Number.isInteger(n)) return 'Вкажіть ціле число сантиметрів.';
  if(n < min) return `Мінімум ${min} см. Менше ми не виготовляємо.`;
  if(n > max) return `Максимум ${max} см. Для більшого потрібен індивідуальний розрахунок.`;
  return null;
}
function checkSize(silent){
  const L = limits(cur);
  const wEl = $('#kvW'), hEl = $('#kvH');
  cur.w = +wEl.value || 0;
  cur.h = +hEl.value || 0;

  const pw = fieldProblem(wEl.value.trim(), L.minW, L.maxW, {acc:'ширину', nom:'Ширина'});
  const ph = fieldProblem(hEl.value.trim(), L.minH, L.maxH, {acc:'висоту', nom:'Висота'});

  if(!silent){
    wEl.classList.toggle('bad', !!pw);
    hEl.classList.toggle('bad', !!ph);
    setFieldErr('#kvErrW', pw);
    setFieldErr('#kvErrH', ph);

    const warn = $('#kvSizeWarn');
    if(warn){
      const indiv = !pw && !ph && isIndiv(cur);
      warn.classList.toggle('on', !!indiv);
      if(indiv) warn.innerHTML = 'Для цього розміру ціна <b>індивідуальна</b> — ' +
        'менеджер порахує її й повідомить. Оформлення можна продовжити.';
    }

    const wide = $('#kvWideNote');
    if(wide){ wide.classList.remove('on'); wide.textContent = ''; }
  }
  return !pw && !ph;
}
function setFieldErr(sel, msg){
  const el = $(sel);
  if(!el) return;
  el.textContent = msg || '';
  el.classList.toggle('on', !!msg);
}

function buildSide(){
  const box = $('#kvSide');
  box.innerHTML = CFG.sides.map(s=>`
    <button class="kv-opt" type="button" role="radio" aria-checked="false" data-v="${s.id}">
      <span class="tick">✓</span><b>${s.name}</b>
    </button>`).join('');
  box.onclick = e => {
    const b = e.target.closest('.kv-opt'); if(!b) return;
    cur.side = b.dataset.v;
    $$('#kvSide .kv-opt').forEach(x=>x.classList.toggle('on', x === b));
    markAnswered('side');
  };
}

function buildOptions(){
  $('#kvOptions').innerHTML = CFG.options.map(o=>`
    <label class="kv-check">
      <input type="checkbox" value="${o.id}">
      <b>${o.name}</b><span class="pr">+ ${o.price} ₴</span>
    </label>`).join('');
  $('#kvOptions').onchange = ()=>{
    cur.options = $$('#kvOptions input:checked').map(i=>i.value);
  };
}

function saveCart(){
  try{ localStorage.setItem(STORE, JSON.stringify({t:Date.now(), cart})); }catch(e){}
}

const requestIds = new Map();
function newRid(){
  try{ if(crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}
let надіслано = false;
function loadCart(){
  try{
    const d = JSON.parse(localStorage.getItem(STORE) || 'null');
    if(!d || !Array.isArray(d.cart) || !d.cart.length) return false;
    if(Date.now() - d.t > 7*24*3600*1000){ localStorage.removeItem(STORE); return false; }
    cart = d.cart;
    return true;
  }catch(e){ return false; }
}

function resetForm(){
  ['system','fabric','side'].forEach(k=>delete answered[k]);
  ['system','fabric','side'].forEach(syncNext);
  $$('.kv-opt,.kv-fab').forEach(b=>b.classList.remove('on'));
  $('#kvW').value = 65; $('#kvH').value = 150;
  $$('#kvOptions input').forEach(i=>i.checked = false);
  $('#kvSizeWarn').classList.remove('on');
  $('#kvW').classList.remove('bad'); $('#kvH').classList.remove('bad');
  setFieldErr('#kvErrW', null); setFieldErr('#kvErrH', null);
}

function openCart(зІсторії, безПодії){
  syncOk();

  if(window.visitMark) visitMark('квіз');

  if(!зІсторії && !безПодії && window.metaEvent)
    metaEvent('InitiateCheckout', { value: cartSum() || 0, currency: 'UAH' });
  $('#kvQuiz').style.display = 'none';
  $('#kvCart').style.display = '';
  renderCart();

  if(!зІсторії) history.pushState({kvView:'cart'}, '', location.href);
  window.scrollTo({top:0, behavior:'smooth'});
}
function openQuiz(fresh){
  if(sending) return;
  $('#kvCart').style.display = 'none';
  $('#kvQuiz').style.display = '';
  if(fresh){
    cur = blank(); curAdded = false; curIdx = -1; resetForm();
    winNo = cart.length + 1;
    show('fabric');
  }
}

function renderCart(){
  const list = $('#kvList');
  if(!cart.length){
    list.innerHTML = '<div class="kv-empty">Тут зʼявляться ваші штори.<br>Пройдіть калькулятор, щоб додати першу.</div>';
    $('#kvTotalBox').style.display = 'none';
    $('#kvSubmit').disabled = true;
    return;
  }
  $('#kvTotalBox').style.display = '';
  $('#kvSubmit').disabled = sending;
  list.innerHTML = cart.map((c,i)=>{

    const bl = Array.isArray(c.blinds) && c.blinds.length
      ? c.blinds : [{ fabric:c.fabric, w:c.w, h:c.h }];
    const extra = CFG.productExtraW || 0;
    const fabNames = [...new Set(bl.map(b=>(CFG.fabrics.find(f=>f.id===b.fabric)||{}).name).filter(Boolean))];
    const same = bl.every(b=>b.w === bl[0].w && b.h === bl[0].h);
    const sizeTxt = same
      ? ('виріб ' + (bl[0].w + extra) + ' × ' + bl[0].h + ' см')
      : 'розміри різні';

    const n = bl.length;
    const заголовок = n > 1
      ? `Вікно ${i+1} · ${n} ${n < 5 ? 'штори' : 'штор'}`
      : `Штора ${i+1}`;
    return `<div class="kv-win" data-i="${i}" tabindex="0" role="button"
                 aria-label="${заголовок}: подивитись на вікні">
      <span class="mini">${miniWindow(bl[0])}</span>
      <span class="info">
        <b>${заголовок}</b>
        <span>${CFG.lines[c.line]?.short || ''} · ${fabNames.join(', ')}</span>
        <span>${sizeTxt}</span>
        <span class="kv-win-look">Подивитись на вікні</span>
      </span>
      <span class="pr">${priceTag(priceWin(c), false, oldWin(c))}</span>
      <button class="del" type="button" data-i="${i}" aria-label="Видалити: ${заголовок}">×</button>
    </div>`;
  }).join('');
  list.querySelectorAll('.del').forEach(b=>b.onclick = e=>{
    e.stopPropagation();
    if(sending) return;
    pvHide();
    const i = +b.dataset.i;
    cart.splice(i, 1);

    if(i === curIdx){ curAdded = false; curIdx = -1; }
    else if(i < curIdx) curIdx--;
    saveCart(); renderCart();
  });
  list.querySelectorAll('.kv-win').forEach(row=>{
    const i = +row.dataset.i;
    row.onmouseenter = ()=>{ if(курсор()) pvShow(i, row, false); };
    row.onmouseleave = ()=>{ if(курсор()) pvHide(); };
    row.onclick = e=>{ if(!e.target.closest('.del') && !курсор()) pvShow(i, row, true); };
    row.onkeydown = e=>{
      if(e.target === row && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); pvShow(i, row, true); }
    };
  });
  $('#kvTotal').innerHTML = priceTag(cartSum(), true, cartOld());
  $('#kvCount').textContent = cart.length;

  const note = $('#kvCartIndivNote');
  if(note){ note.innerHTML = '* ' + indivNote(); note.classList.toggle('on', cartSum() === null); }
  syncPay();
}

const cartSum = () => {
  let sum = 0;
  for(const c of cart){ const p = priceWin(c); if(p === null) return null; sum += p; }
  return sum;
};
const cartOld = () => {
  let sum = 0;
  for(const c of cart){ const p = oldWin(c); if(p === null) return null; sum += p; }
  return sum;
};

let priceObserver;
let priceSeen = false;
function syncPay(){
  const total = cartSum();
  const put = (sel, v) => { const e = $(sel); if(e) e.textContent = v; };
  put('#kvNowLab', total === null ? 'Ціна' : 'Ціна');
  const price = $('#kvNow');
  if(price) price.innerHTML = priceTag(total, true, cartOld());
  put('#kvRest', '');
  put('#kvGoSum', cart.length ? (total === null ? 'за розрахунком менеджера' : money(total)) : '');

  priceObserver?.disconnect();
  priceObserver = null;
  if(priceSeen || !cart.length || !Number.isFinite(total) ||
     typeof window.clarity !== 'function' || typeof IntersectionObserver !== 'function') return;
  const observer = new IntersectionObserver(entries=>{
    if(priceObserver !== observer || !entries.some(entry=>entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
    if(clarityEvent('kviz_price_shown')){
      priceSeen = true;
      observer.disconnect();
      priceObserver = null;
    }
  }, {threshold:0.5});
  priceObserver = observer;
  [price, $('#kvTotal'), $('#kvGoSum')].filter(Boolean).forEach(element=>observer.observe(element));
}
document.addEventListener('fsh-clarity-ready', ()=>{
  if($('.kv-q.on')?.dataset.q === 'size') clarityEvent('kviz_measurement_opened');
  if(cart.length && $('#kvCart').style.display !== 'none') syncPay();
});

const курсор = () => matchMedia('(hover:hover) and (pointer:fine)').matches;
let pvModal = false;
function pvShow(i, row, modal){
  const c = cart[i], pv = $('#kvPv');
  if(!c || !pv) return;
  const bl = Array.isArray(c.blinds) && c.blinds.length
    ? c.blinds : [{ fabric:c.fabric, w:c.w, h:c.h }];
  const extra = CFG.productExtraW || 0;
  const view = $('#kvPvView');
  view.classList.toggle('multi', bl.length > 1);
  view.innerHTML = bl.map(b =>
    drawWindow(Object.assign({}, c, { count:1, fabric:b.fabric, w:b.w, h:b.h }), true)).join('');
  const f = CFG.fabrics.find(x => x.id === bl[0].fabric) || {};
  const p = priceWin(c);
  $('#kvPvCap').innerHTML =
    '<b>' + (bl.length > 1 ? 'Вікно ' + (i+1) : (f.name || 'Штора')) + '</b>' +
    '<span>' + (bl.length > 1 ? bl.length + ' штори'
      : (f.transmission || '') + ' · тканина ' + bl[0].w + ' × ' + bl[0].h + ' см, виріб ' +
        (bl[0].w + extra) + ' см') + '</span>' +
    '<span class="kv-pv-pr">' + priceTag(p, false, oldWin(c)) + '</span>';
  pv.classList.toggle('modal', !!modal);
  pv.hidden = false;
  if(modal){
    if(!pvModal) history.pushState({kvView:'cart', pv:1}, '', location.href);
    pvModal = true;
    document.documentElement.classList.add('kv-lock');
    const x = pv.querySelector('.kv-pv-x'); if(x) x.focus({preventScroll:true});
  } else {

    const r = row.getBoundingClientRect(), box = pv.querySelector('.kv-pv-box');
    const W = box.offsetWidth, H = box.offsetHeight;
    let left = r.left - W - 18;
    if(left < 12) left = Math.min(innerWidth - W - 12, r.right + 18);
    const top = Math.max(12, Math.min(innerHeight - H - 12, r.top + r.height/2 - H/2));
    box.style.left = Math.max(12, left) + 'px';
    box.style.top = top + 'px';
  }

  void view.offsetWidth;
  view.querySelectorAll('svg').forEach(s => s.classList.add('blinds-on'));
}
function pvHide(){
  const pv = $('#kvPv');
  if(!pv || pv.hidden) return;
  pv.hidden = true;
  pv.classList.remove('modal');
  const box = pv.querySelector('.kv-pv-box');
  if(box){ box.style.left = ''; box.style.top = ''; }
  pvModal = false;
  document.documentElement.classList.remove('kv-lock');
}

(function(){
  const pv = $('#kvPv');
  if(!pv) return;
  pv.addEventListener('click', e => {
    if(!pvModal) return;
    if(e.target === pv || e.target.closest('.kv-pv-x')) history.back();
  });
})();

const атр = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function відеоЗаміру(){
  const url = String(CFG.measureVideo || '').trim();
  if(!url) return null;
  if(/\.(mp4|webm|mov)(\?|#|$)/i.test(url))
    return { html:'<video src="' + атр(url) + '" controls playsinline preload="metadata"></video>', vert:false };
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/) ||
            (/^[\w-]{11}$/.test(url) ? [url, url] : null);
  if(!m) return null;
  return {
    vert: /\/shorts\//.test(url),
    html:'<iframe src="https://www.youtube-nocookie.com/embed/' + m[1] +
      '?rel=0&modestbranding=1&playsinline=1&hl=uk" title="Як заміряти штору" ' +
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen></iframe>'
  };
}
let howOpen = false;
function howShow(){
  const how = $('#kvHow'), vid = $('#kvHowVid');
  if(!how) return;
  const v = відеоЗаміру();
  if(vid){
    vid.innerHTML = v ? v.html : '';
    vid.hidden = !v;
    vid.classList.toggle('vert', !!(v && v.vert));
  }
  how.classList.toggle('no-vid', !v);
  how.classList.toggle('vert', !!(v && v.vert));
  how.hidden = false;
  if(!howOpen) history.pushState(Object.assign({}, history.state, {how:1}), '', location.href);
  howOpen = true;
  document.documentElement.classList.add('kv-lock');
  const x = how.querySelector('.kv-how-x'); if(x) x.focus({preventScroll:true});
  track('kviz_measure_help', {video: !!v});
}
function howHide(){
  const how = $('#kvHow'), vid = $('#kvHowVid');
  if(!how || how.hidden) return;
  how.hidden = true;
  if(vid) vid.innerHTML = '';
  howOpen = false;
  document.documentElement.classList.remove('kv-lock');
  const b = $('#kvHowBtn'); if(b) b.focus({preventScroll:true});
}
(function(){
  const b = $('#kvHowBtn'), how = $('#kvHow');
  if(b) b.onclick = howShow;

  const ph = how && how.querySelector('.kv-how-ph img');
  if(ph){
    const ar = () => { if(ph.naturalWidth && ph.naturalHeight)
      how.style.setProperty('--how-ar', (ph.naturalWidth / ph.naturalHeight).toFixed(4)); };
    ph.addEventListener('load', ar); ar();
  }
  if(how) how.addEventListener('click', e => {
    if(e.target === how || e.target.closest('.kv-how-x,.kv-how-ok')) history.back();
  });
})();
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && (howOpen || pvModal)) history.back();
});

function закритиВікна(){
  if(howOpen){ howHide(); return true; }
  if(pvModal){ pvHide(); return true; }
  return false;
}

const urlLine = 'roller';
const preset = CFG.lines[urlLine];
if(preset) productLine = urlLine;
buildLine(); buildFabric(); buildSide(); buildOptions();
cur = blank(); curAdded = false; curIdx = -1;

if(preset){
  const card = document.querySelector('#kvLine .kv-opt[data-v="' + urlLine + '"]');
  if(card) card.classList.add('on');
  markAnswered('line');
}
syncLimits();

function fitFabImg(){
  const v = $('.kv-q[data-q="fabric"] .kv-fabview'), img = $('#kvFabImg');
  if(!v || !img) return;
  if(!matchMedia('(max-width:900px)').matches || !v.offsetParent){ img.style.width = ''; return; }

  img.style.width = '170px';
  const cap = v.querySelector('figcaption');
  const gap = parseFloat(getComputedStyle(v).rowGap) || 8;
  const free = v.clientHeight - (cap ? cap.offsetHeight : 0) - gap;
  img.style.width = Math.round(Math.max(170, Math.min(v.clientWidth, free))) + 'px';
}
{
  const v = $('.kv-q[data-q="fabric"] .kv-fabview');
  if(v && window.ResizeObserver) new ResizeObserver(fitFabImg).observe(v);
  addEventListener('resize', fitFabImg);
  addEventListener('load', fitFabImg);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(fitFabImg);
  fitFabImg();
}

let fabSig = CFG.fabrics.map(f => [f.id, f.name, f.img, f.thumb, f.win, f.transmission].join('|')).join('~');
document.addEventListener('cfg-updated', ()=>{
  const sig = CFG.fabrics.map(f => [f.id, f.name, f.img, f.thumb, f.win, f.transmission].join('|')).join('~');
  if(sig !== fabSig && CFG.fabrics.length){ fabSig = sig; rebuildFabrics(); }
  const by = id => CFG.fabrics.find(f => f.id === id);
  const put = (el, f) => { if(el && f) el.textContent = fabTag(f); };
  $$('#kvFabric .kv-fab').forEach(b => put(b.querySelector('.kv-fabpr'), by(b.dataset.v)));
  $$('#kvFabSel .fsel-opt').forEach(b => put(b.querySelector('i'), by(b.dataset.v)));
  if(cur) put($('#kvFabPrice'), by(cur.fabric));
  try{ renderCart(); }catch(e){}
});

$('#kvBack').onclick = back;
$$('[data-next]').forEach(b=>b.onclick = next);

['#kvW','#kvH'].forEach(sel=>{
  const el = $(sel);
  el.oninput = ()=>{
    cur.w = +$('#kvW').value||0;
    cur.h = +$('#kvH').value||0;
    syncProdW();
    if(el.classList.contains('bad')) checkSize();
  };
  el.onblur = ()=> checkSize();
});

function isRoller(){
  if(cart.length) return cart.every(c => c.line === 'roller');
  return (cur && cur.line) === 'roller';
}

function syncOk(){
  const hint = $('#kvOkHint');

  if(hint) hint.textContent = isRoller() ? ''
    : 'Передамо менеджеру: він передзвонить і підтвердить розміри перед виробництвом.';
  const pay = $('#kvPay');
  if(pay) pay.style.display = isRoller() ? '' : 'none';
}

function addToCartQuiet(){
  stashBlind();
  const копія = JSON.parse(JSON.stringify(cur));
  if(curAdded && curIdx >= 0 && curIdx < cart.length){
    cart[curIdx] = копія;
    saveCart();
    return;
  }
  cart.push(копія);
  curIdx = cart.length - 1;
  curAdded = true;
  saveCart();
  track('kviz_add_window', {value:priceWin(cur) || 0, total:cart.length});
}

let ckMode = 'order';
function setMode(m){
  if(sending) return;
  ckMode = m === 'hold' ? 'hold' : 'order';
  document.querySelectorAll('#kvModes [data-mode]').forEach(b=>{
    const on = b.dataset.mode === ckMode;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  });
  document.querySelectorAll('[data-for]').forEach(el=>{
    el.hidden = el.dataset.for !== ckMode;
  });
  const lab = $('#kvGoLab');
  if(lab && !sending) lab.textContent = ckMode === 'hold' ? 'Зафіксувати знижку' : 'Оформити замовлення';
  const sum = $('#kvGoSum');
  if(sum) sum.hidden = ckMode === 'hold';
  syncPay();
}
const modes = $('#kvModes');
if(modes) modes.addEventListener('click', e=>{
  const b = e.target.closest('[data-mode]');
  if(b) setMode(b.dataset.mode);
});

const payWay = undefined;

function showThanks(title, text){
  const t = $('#kvThanksTitle'), x = $('#kvThanksText');
  if(t) t.textContent = title;
  if(x) x.textContent = text;

  надіслано = true;
  cart = []; curAdded = false; curIdx = -1; requestIds.clear();
  try{ localStorage.removeItem(STORE); }catch(e){}
  try{ history.replaceState({kvView:'thanks'}, '', location.href); }catch(e){}
  $('#kvQuiz').style.display = 'none';
  $('#kvCart').style.display = 'none';
  $('#kvThanks').classList.add('on');
  window.scrollTo({top:0, behavior:'smooth'});
}

function send(extra){
  const totalSum = cartSum();
  const payload = Object.assign({
    source:'Квіз-калькулятор',

    utm: window.fshUtm ? window.fshUtm() : {},
    total: totalSum,
    individual: totalSum === null,
    windows: cart.map((c,i)=>{
      const bl = Array.isArray(c.blinds) && c.blinds.length
        ? c.blinds : [{ fabric:c.fabric, w:c.w, h:c.h }];
      const extra = CFG.productExtraW || 0;
      const b0 = bl[0];

      const blinds = bl.map((b,j)=>({
        n:j+1,
        fabric:CFG.fabrics.find(f=>f.id===b.fabric)?.name,
        fabricW:b.w, fabricH:b.h, width:b.w + extra,
        price:priceOne(Object.assign({}, c, {fabric:b.fabric, w:b.w, h:b.h}))
      }));
      return {
        window:i+1, line:CFG.lines[c.line]?.name, sashes:c.count, whole:c.whole,

        fabricW:b0.w, fabricH:b0.h, width:b0.w + extra, height:b0.h,
        system:CFG.systems[c.system].name,
        fabric:[...new Set(blinds.map(x=>x.fabric).filter(Boolean))].join(', '),
        side:CFG.sides.find(s=>s.id===c.side)?.name,
        options:c.options.map(id=>CFG.options.find(o=>o.id===id)?.name),
        blinds,
        price:priceWin(c)
      };
    })
  }, extra || {});

  if(window.gaClientId) payload.ga_cid = window.gaClientId();
  return window.API ? API.sendLead(payload) : Promise.reject(new Error('Немає звʼязку'));
}

let goLabWas = '';
function submitting(btn, on){
  if(!btn) return;
  sending = on;
  btn.disabled = on;
  const label = $('#kvGoLab');
  if(!label) return;
  if(on){ goLabWas = label.textContent; label.textContent = 'Надсилаємо…'; }
  else label.textContent = goLabWas || (ckMode === 'hold' ? 'Зафіксувати знижку' : 'Оформити замовлення');
}
function sendFail(box, err){
  let p = box.querySelector('.send-err');
  if(!p){
    p = document.createElement('p');
    p.className = 'send-err';
    box.appendChild(p);
  }
  const tel = (CFG.phone || '').replace(/[^\d+]/g,'');
  p.innerHTML = 'Не вдалося надіслати заявку. Спробуйте ще раз або зателефонуйте: ' +
    '<a href="tel:' + tel + '">' + (CFG.phone || '') + '</a>.';
  p.classList.add('on');
  console.warn('Заявка не пішла:', err);
}
$('#kvAddWin').onclick = ()=> openQuiz(true);
$('#kvRestart') && ($('#kvRestart').onclick = ()=>{
  if(sending) return;
  requestIds.clear();
  cart = []; try{ localStorage.removeItem(STORE); }catch(e){}
  openQuiz(true); if(!preset) show('line');
});

function metaStartCalc(){ if(window.metaEvent) metaEvent('StartCalculator'); }
if(window.__fbReady) metaStartCalc();
else document.addEventListener('meta-ready', metaStartCalc, { once:true });

const стартовийСтан = history.state;
const вернутиВКошик = !!(стартовийСтан && стартовийСтан.kvView === 'cart');

if(loadCart() && (!preset || вернутиВКошик)){
  openCart(true);
  history.replaceState({kvView:'cart'}, '', location.href);
} else {

  if(preset && cart.length){
    winNo = cart.length + 1;
    showOldCartNote();
  }
  show(preset ? 'fabric' : 'line');
}

function showOldCartNote(){
  const host = $('.kv-in');
  if(!host || $('#kvOldNote')) return;
  const total = cartSum();
  const n = document.createElement('div');
  n.className = 'kv-oldnote';
  n.id = 'kvOldNote';
  n.innerHTML =
    '<span>У вас уже є незавершене замовлення: ' +
    cart.length + (cart.length === 1 ? ' вікно' : cart.length < 5 ? ' вікна' : ' вікон') +
    (total === null ? '.' : ' на ' + money(total) + '.') + '</span>' +
    '<span class="kv-oldnote-act">' +
      '<button type="button" data-old="open">Подивитись</button>' +
      '<button type="button" data-old="drop">Почати заново</button>' +
    '</span>';
  host.prepend(n);
  n.onclick = e => {
    const b = e.target.closest('[data-old]'); if(!b) return;
    if(b.dataset.old === 'open'){ openCart(); return; }
    cart = []; winNo = 1;
    try{ localStorage.removeItem(STORE); }catch(err){}
    n.remove();
  };
}

addEventListener('popstate', e=>{

  if(закритиВікна()) return;

  if(надіслано || sending) return;
  const st = e.state || {};
  if(st.kvView === 'cart'){ openCart(true); return; }
  const name = st.kvStep;
  if(!name || !STEPS.includes(name)) return;

  if($('#kvCart').style.display !== 'none') openQuiz(false);
  if(st.bi != null) cur.bi = st.bi;
  show(name, true);
});

$('#kvForm').onsubmit = e => {
  e.preventDefault();
  const btn = $('#kvSubmit');
  if(sending || надіслано || btn?.disabled) return;
  const name = $('#kvName').value.trim();
  const phone = $('#kvPhone').value.replace(/[\s()-]/g,'');
  const city = ($('#kvCity') || {}).value ? $('#kvCity').value.trim() : '';
  const branch = ($('#kvBranch') || {}).value ? $('#kvBranch').value.trim() : '';
  const okName = name.length >= 2;
  const okPhone = /^(\+?38)?0\d{9}$/.test(phone);
  const roller = cart.length && cart.every(c=>c.line === 'roller');
  const hold = ckMode === 'hold';
  if(!hold) clarityEvent('kviz_order_submit_attempted');

  const okShip = hold || !roller || (city.length >= 2 && branch.length >= 1);
  const days = Math.round(Number(($('#kvDays') || {}).value || 0));
  const okDays = !hold || (days >= 1 && days <= 14);
  const errDays = $('#kvErrDays');
  if(errDays) errDays.style.display = okDays ? 'none' : 'block';
  $('#kvErrName').style.display = okName ? 'none' : 'block';
  $('#kvErrPhone').style.display = okPhone ? 'none' : 'block';
  const errCity = $('#kvErrCity');
  if(errCity) errCity.style.display = okShip ? 'none' : 'block';
  if(!okName || !okPhone || !okShip || !okDays){
    clarityEvent('kviz_checkout_invalid');
    const bad = !okName ? '#kvName' : !okPhone ? '#kvPhone' : !okShip ? '#kvCity' : '#kvDays';
    const el = $(bad); if(el) el.focus();
    return;
  }

  submitting(btn, true);
  const details = hold
    ? { name, phone, hold: days,
        kind: 'Фіксація знижки на ' + days + (days === 1 ? ' день' : days < 5 ? ' дні' : ' днів') }
    : { name, phone, pay: payWay,
        delivery: 'Нова Пошта, ' + city + ', ' + branch,
        kind: 'Замовлення класичної рулонної' };
  const request = JSON.stringify([details, cart]);
  if(!requestIds.has(request)) requestIds.set(request, newRid());
  const rid = requestIds.get(request);

  const eventName = hold ? 'PriceHold' : 'Lead';
  const eventId = window.__fbReady ? rid : null;
  const мета = eventId
    ? Object.assign({ event_id: eventId, event_name: eventName }, window.metaIds ? metaIds() : {})
    : null;
  const value = cartSum() || 0;
  const windows = cart.length;

  send({ ...details, rid, meta: мета })
    .then(result=>{
      if(result?.ok !== true || result.stored !== true || typeof result.id !== 'string' || !result.id.trim()){
        throw new Error('Сервер не підтвердив збереження заявки.');
      }

      track('kviz_submit', { value, windows,
                             lead_type: hold ? 'hold' : 'order' });
      clarityEvent(hold ? 'kviz_discount_hold_saved' : 'kviz_order_saved');
      if(eventId && window.metaEvent)
        metaEvent(eventName, { value, currency: 'UAH' }, eventId);
      afterSend(hold);
    })
    .catch(err=>{
      clarityEvent('kviz_submit_failed');
      submitting(btn, false);
      sendFail($('#kvForm'), err);
    });
};

function afterSend(hold){
  if(hold){
    showThanks('Знижку зафіксовано',
      'Ціна й склад замовлення збережені за вами. Нагадаємо за день до кінця строку.');
  } else {
    showThanks('Замовлення прийняте',
      'Менеджер звʼяжеться найближчої робочої години: звіримо розміри й надішлемо реквізити для оплати.');
  }
};

function showFabric(id){
  const f = CFG.fabrics.find(x => x.id === id);
  $$('#kvFabric .kv-fab').forEach(b=>{
    const це = b.dataset.v === id;
    b.classList.toggle('on', це);
    b.setAttribute('aria-checked', це ? 'true' : 'false');
  });
  if(!f) return;

  const sel = $('#kvFabSel');
  if(sel){
    sel.querySelectorAll('.fsel-opt').forEach(o=>
      o.setAttribute('aria-selected', o.dataset.v === id ? 'true' : 'false'));
    const кнSw = sel.querySelector('.fsel-btn .fsel-sw');
    const кнTx = sel.querySelector('.fsel-btn .fsel-tx');
    if(кнSw && window.fabricBg) кнSw.style.background = window.fabricBg(f, false, true);
    if(кнTx) кнTx.innerHTML = '<b>' + f.name + '</b><span>' + f.transmission + '</span>';
  }

  const img = $('#kvFabImg');
  if(img){
    img.removeAttribute('data-empty');

    const тло = window.fabricBg ? window.fabricBg(f, false)
              : ('linear-gradient(160deg,' + f.from + ',' + f.to + ')');
    const winEl = img.querySelector('.ff-win');
    const texEl = img.querySelector('.ff-tex');
    if(texEl) texEl.style.background = тло;

    const WIN_VER = '2';
    const winUrl = f.win && /^assets[/]/.test(f.win) && f.win.indexOf('?') < 0 ? f.win + '?v=' + WIN_VER : f.win;
    if(winEl) winEl.style.background = f.win ? ("url('" + winUrl + "') center/cover no-repeat") : тло;
    img.classList.toggle('has-win', !!f.win);
    img.classList.remove('peek');
    img.classList.remove('swap'); void img.offsetWidth; img.classList.add('swap');
  }
  const пиши = (sel2, txt) => { const e = $(sel2); if(e) e.textContent = txt; };
  пиши('#kvFabName', f.name);
  пиши('#kvFabTrans', f.transmission);
  пиши('#kvFabPrice', fabTag(f));
}

})();
