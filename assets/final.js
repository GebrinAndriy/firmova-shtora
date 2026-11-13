(function(){

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const track = (e,d={}) => (window.dataLayer=window.dataLayer||[]).push({event:e,...d});
const clampN = (v,a,b) => Math.min(Math.max(v,a),b);
const calm  = matchMedia('(prefers-reduced-motion:reduce)').matches;
const body  = document.body;
const LINE_KEY = 'fsh_line';

const heroScroll = $('#fheroScroll');
if(heroScroll && $('#fblind')){

  const blind = $('#fblind'), fill = $('#fmeterFill'), val = $('#fmeterVal'),
        hint = $('#fhint'), chain = $('#fchain'), hdr = $('header');
  let total = heroScroll.offsetHeight - innerHeight;
  let target = 0, cur = 0, running = false, shown = -1, visible = true, lastPaint = 0;
  const cl = v => v < 0 ? 0 : v > 1 ? 1 : v;

  function paint(p){
    lastPaint = performance.now();
    blind.style.transform = `translate3d(0,${(-100 + p*100).toFixed(3)}%,0)`;
    if(chain) chain.style.opacity = (1 - p*0.7).toFixed(3);
    if(fill)  fill.style.transform = `scaleY(${(1-p).toFixed(4)})`;
    if(hint)  hint.style.opacity = cl(1 - p*2.4).toFixed(3);
    const pct = Math.round(100 - p*100);
    if(val && pct !== shown){ shown = pct; val.textContent = pct + '%'; }
  }
  function loop(){
    const gap = target - cur;
    cur = Math.abs(gap) > 0.35 ? target : cur + gap * 0.16;
    if(Math.abs(target - cur) < 0.0004) cur = target;
    paint(cur);
    if(cur !== target && visible) requestAnimationFrame(loop); else running = false;
  }
  const kick = ()=>{ if(!running && visible){ running = true; requestAnimationFrame(loop); } };

  addEventListener('scroll', ()=>{
    target = cl(scrollY / total);

    if(hdr) hdr.classList.toggle('solid', scrollY > heroScroll.offsetHeight - innerHeight * 0.6);
    kick();
    if(performance.now() - lastPaint > 150){ cur = target; paint(cur); }
  }, {passive:true});
  addEventListener('resize', ()=>{
    total = heroScroll.offsetHeight - innerHeight;
    target = cl(scrollY / total); kick();
  }, {passive:true});
  addEventListener('visibilitychange', ()=>{ if(!document.hidden){ running = false; kick(); } });
  new IntersectionObserver(es=>{ visible = es[0].isIntersecting; if(visible) kick(); },
    {rootMargin:'120px'}).observe(heroScroll);

  target = cur = cl(scrollY / total);
  paint(cur);
}

const io = new IntersectionObserver(es=>es.forEach(e=>{
  if(!e.isIntersecting) return;
  e.target.classList.add('in'); io.unobserve(e.target);
}), {threshold:.1, rootMargin:'0px 0px -6% 0px'});
const watch = el => io.observe(el);
$$('[data-rv4]').forEach(watch);

let line = null;
const linesBox = $('#lines');

const PICK = window.PICK || {};

const KVIZ = (()=>{
  const a = $('[data-kviz]');
  const q = new URLSearchParams((a ? a.getAttribute('href') : '').split('?')[1] || '');
  const f = q.get('from');
  return f ? 'kviz.html?from=' + f : 'kviz.html';
})();
const kvizUrl = id => KVIZ + (id ? (KVIZ.includes('?') ? '&' : '?') + 'line=' + id : '');

function renderLines(){
  if(!linesBox || typeof CFG === 'undefined' || !PICK.render) return;
  PICK.render(linesBox, CFG.lines, {
    choose:  id => (id === line ? clearLine() : setLine(id)),
    clear:   () => clearLine(),
    current: () => line
  });
}

function clearLine(){
  line = null;
  delete body.dataset.line;
  if(PICK.clear) PICK.clear(linesBox);
  const hint = $('#linesHint');
  if(hint) hint.innerHTML = PICK.hintIdle ||
    '<i>1</i> Оберіть тип, і сайт нижче покаже все саме про нього';
  $$('[data-kviz]').forEach(a=>a.href = kvizUrl());
  try{ localStorage.removeItem(LINE_KEY); }catch(e){}
  track('line_reset');
  const sec = $('#lineup');
  if(sec) setTimeout(()=>sec.scrollIntoView({behavior:'smooth', block:'start'}), 120);
}

function setLine(id, quiet){
  if(!CFG.lines[id]) return;
  line = id;
  const L = CFG.lines[id];
  body.dataset.line = id;
  if(PICK.set) PICK.set(linesBox, id, quiet);

  const set = (sel,v) => $$(sel).forEach(e=>e.textContent = v);
  set('[data-line-name]', L.name);
  set('[data-line-short]', L.short);
  set('[data-line-claim]', L.claim);
  set('[data-line-warranty]', L.warranty);
  set('[data-line-from]', 'від ' + L.from + ' ₴/м²');
  const txt = $('#lineText'); if(txt) txt.textContent = L.text;
  const bl = $('#lineBullets');
  if(bl) bl.innerHTML = L.bullets.map(b=>`<li>${b}</li>`).join('');
  const rooms = $('#lineRooms');
  if(rooms) rooms.innerHTML = L.good.map(g=>`<span>${g}</span>`).join('');
  const hint = $('#linesHint');
  if(hint) hint.innerHTML = '<i>✓</i> Показано все про «' + L.name + '»';

  $$('[data-kviz]').forEach(a=>a.href = kvizUrl(id));

  buildFabrics();
  try{ localStorage.setItem(LINE_KEY, id); }catch(e){}
  $$('.after-pick [data-rv4]').forEach(watch);
  if(!quiet){
    track('line_pick', {line:id});
    const next = $('#afterPick');

    if(next) setTimeout(()=>next.scrollIntoView({behavior:'smooth', block:'start'}),
      PICK.delay == null ? 900 : PICK.delay);
  }
}

let cylIdx = 0, cards = [];
const cyl = $('#cyl');
const stage = cyl && cyl.parentElement;

let поз = 0;
const N = () => CFG.fabrics.length;

function fabCard(f, n, eager){
  let sw;
  if(f.img){
    const jpg = f.img.replace(/\.webp$/, '.jpg');
    sw = '<picture class="sw3"><source srcset="' + f.img + '" type="image/webp">' +
         '<img src="' + jpg + '" alt="" decoding="async" ' +
         'loading="' + (eager ? 'eager' : 'lazy') + '" width="460" height="613"></picture>';
  } else {
    const bg = window.fabricBg
      ? window.fabricBg(f, f.stripe !== false && line === 'daynight')
      : `linear-gradient(160deg, ${f.from}, ${f.to})`;
    sw = '<span class="sw3" style="background:' + bg + '"></span>';
  }
  return `<button class="card3" type="button" data-i="${n}" aria-label="${f.name}">
      ${sw}
      <span class="tx3"><b>${f.name}</b><span>${f.transmission}</span></span>
    </button>`;
}

function buildFabrics(){
  if(!cyl || typeof CFG === 'undefined') return;
  const F = CFG.fabrics;
  cyl.innerHTML = [...F, ...F, ...F]
    .map((f,i)=>fabCard(f, i % F.length, i >= F.length - 2 && i < F.length + 3)).join('');
  cards = $$('#cyl .card3');
  cards.forEach((c,k)=> c.onclick = ()=> йти(k));
  поз = F.length;
  розставити(true);
}

function розставити(тихо){
  if(!cards.length || !stage) return;
  const c = cards[поз];
  if(!c) return;
  cyl.style.transition = тихо ? 'none' : '';
  const x = stage.clientWidth/2 - (c.offsetLeft + c.offsetWidth/2);
  cyl.style.setProperty('--x', Math.round(x) + 'px');
  if(тихо) void cyl.offsetWidth;
  cyl.style.transition = '';

  cylIdx = ((поз % N()) + N()) % N();
  cards.forEach((e,k)=>{
    const d = Math.abs(k - поз);
    e.classList.toggle('on', d === 0);
    e.classList.toggle('near', d === 1);

    e.style.visibility = d <= 3 ? 'visible' : 'hidden';
    e.setAttribute('aria-current', d === 0 ? 'true' : 'false');
  });
  paintFab(тихо);
}

function йти(k){
  поз = k;
  розставити(false);
  clearTimeout(йти._t);
  йти._t = setTimeout(перебазувати, 620);
}

function перебазувати(){
  const n = N();
  if(поз >= n && поз < n*2) return;
  поз = n + (((поз % n) + n) % n);
  розставити(true);
}

const LIGHT = {'Світлопрозора':84,'Напівзатемнення':46,'Затемнення':22,'Повне затемнення':4};

function paintFab(quiet){
  const f = CFG.fabrics[cylIdx];
  if(!f) return;
  const put = (sel,v) => { const e = $(sel); if(e) e.textContent = v; };
  put('#fabName', f.name);
  put('#fabTr', f.transmission);
  const pc = LIGHT[f.transmission] ?? 40;
  const bar = $('#fabBar'); if(bar) bar.style.width = pc + '%';
  put('#fabPc', pc + '% світла');
  if(!quiet) track('fabric_view', {fabric:f.name, line});
}

const step = d => йти(поз + d);
const prevB = $('#cylPrev'), nextB = $('#cylNext');
if(prevB) prevB.onclick = ()=> step(-1);
if(nextB) nextB.onclick = ()=> step(1);

if(cyl){

  let sx = 0, s0 = 0, drag = false, крок = 1;
  stage.addEventListener('pointerdown', e=>{
    drag = true; sx = e.clientX; s0 = поз;
    const c = cards[поз];
    крок = c ? c.offsetWidth + 16 : 240;
  });
  addEventListener('pointermove', e=>{
    if(!drag) return;
    const d = Math.round((sx - e.clientX) / крок);
    if(d && s0 + d !== поз){ поз = s0 + d; розставити(false); }
  }, {passive:true});
  addEventListener('pointerup', ()=>{ if(drag){ drag = false; перебазувати(); } });

  let t;
  addEventListener('resize', ()=>{ clearTimeout(t); t = setTimeout(()=>розставити(true), 150); },
    {passive:true});
}

const setTxt = (s,v) => { const e = $(s); if(e && v != null) e.textContent = v; };

function applyCfgData(){
  if(typeof CFG === 'undefined') return;
  setTxt('#since',   CFG.company.since);
  setTxt('#yTotal',  CFG.company.years_total);
  setTxt('#yPro',    CFG.company.years_pro);
  setTxt('#cl2',     CFG.company.clients);
  setTxt('#footMail',CFG.email);

  const mail = $('#footMail');
  if(mail && CFG.email) mail.href = 'mailto:' + CFG.email;

  const msg = $('#footMsg');
  if(msg){
    const L = CFG.links || {};

    const до = (k) => window.fshMsgHref ? fshMsgHref(k, L[k]) : ((L[k] && L[k] !== '#') ? L[k] : '');
    const real = до('viberChat') || до('telegram');
    if(real){ msg.href = real; msg.hidden = false; }
  }
  if(CFG.production) setTxt('#faqProd', `${CFG.production.public}. Точний строк залежить від перевірки замірів, тканини та завантаження виробництва.`);
  if(CFG.phone) $$('[data-tel]').forEach(a=>{ a.textContent = CFG.phone; a.href = 'tel:' + CFG.phone.replace(/[^\d+]/g,''); });
  buildPriceExamples();
}
applyCfgData();
document.addEventListener('cfg-updated', applyCfgData);

function buildPriceExamples(){
  const box = $('#pex');
  if(!box || typeof CFG === 'undefined' || !Array.isArray(CFG.priceExamples)) return;
  const cheapest = Math.min(...CFG.fabrics.map(f => f.price));
  const money = n => Math.round(n / 10) * 10;

  box.innerHTML = CFG.priceExamples.map((e, i) => {
    const m2  = Math.max(CFG.minArea, (e.w / 100) * (e.h / 100));
    const one = Math.max(CFG.minPrice, m2 * cheapest);
    const sum = money(one * (e.count || 1));
    return `<article class="pex-card" data-rv4 style="--i:${i}">
        <b class="pex-name">${e.name}</b>
        <span class="pex-note2">${e.note || ''}</span>
        <span class="pex-sum"><i>від</i> ${sum.toLocaleString('uk-UA')} ₴</span>
      </article>`;
  }).join('');

  $$('#pex [data-rv4]').forEach(watch);
}
$$('.bignum[data-cfg]').forEach(b=>{
  new IntersectionObserver((es,ob)=>{
    if(!es[0].isIntersecting) return;
    ob.disconnect();
    const m = {clients:CFG.company.clients, pro:CFG.company.years_pro,
               total:CFG.company.years_total, since:CFG.company.since.split(' ').pop()};
    if(m[b.dataset.cfg]) b.textContent = m[b.dataset.cfg];
    const raw = b.textContent, n = parseInt(raw.replace(/[^\d]/g,''),10);
    if(!n || calm) return;
    const suf = raw.replace(/[\d\s ]/g,''), t0 = performance.now();
    (function step(t){
      const p = clampN((t-t0)/1400,0,1), e = 1 - Math.pow(1-p,3);
      b.textContent = Math.round(n*e).toLocaleString('uk-UA') + suf;
      if(p < 1) requestAnimationFrame(step);
    })(t0);
  }, {threshold:.5}).observe(b);
});

const rtabs = $('#rtabs4');
if(rtabs && typeof CFG !== 'undefined'){
  const R2 = CFG.rooms, webp = s => s.replace(/\.(jpe?g|png)$/i,'.webp');
  rtabs.innerHTML = R2.map((r,i)=>`<button type="button" class="${i?'':'on'}" data-i="${i}">${r.name}</button>`).join('');
  const box = $('#roomBox4');
  const room = i => {
    const r = R2[i];
    box.innerHTML = `
      <div class="rimg4 fade4"><picture><source srcset="${webp(r.img)}" type="image/webp">
        <img src="${r.img}" alt="${r.title}" loading="lazy" width="1200" height="800"></picture></div>
      <div class="rtx4 fade4"><h3>${r.title}</h3><p>${r.text}</p>
        <div class="meta4">
          <div><span>Рекомендована тканина</span><b>${r.fabric}</b></div>
          <div><span>Рівень світла</span><b>${r.light}</b></div>
        </div></div>`;
    $$('#rtabs4 button').forEach((b,k)=>b.classList.toggle('on', k===i));
  };
  room(0);
  rtabs.onclick = e => { const b = e.target.closest('button'); if(b) room(+b.dataset.i); };
}

const works = $('#works');
if(works && typeof CFG !== 'undefined'){
  const webp = s2 => s2.replace(/\.(jpe?g|png)$/i,'.webp');
  const R0 = CFG.reviews, N = R0.length;
  works.innerHTML = [...R0, ...R0, ...R0].map((r,i)=>`
    <article class="wslide" data-i="${i % N}">
      <picture><source srcset="${webp(r.src)}" type="image/webp">
      <img src="${r.src}" alt="${r.title}" loading="lazy" width="1400" height="875"></picture>
      <span class="ov"></span>
      <span class="tag">${r.tag}</span>
      <span class="tx"><b>${r.title}</b><span>${r.text}</span></span>
    </article>`).join('');

  const dots = $('#wDots');
  if(dots) dots.innerHTML = R0.map((_,i)=>`<i data-i="${i}"${i?'':' class="on"'}></i>`).join('');
  const slides = $$('.wslide');

  let pos = N;
  const centerOf = i => slides[i].offsetLeft - (works.clientWidth - slides[i].offsetWidth)/2;
  const markDot = idx =>{
    const a = ((idx % N) + N) % N;
    $$('#wDots i').forEach((d,k)=>d.classList.toggle('on', k===a));
  };
  const paintDots = ()=> markDot(pos);

  const nearest = ()=>{
    const mid = works.scrollLeft + works.clientWidth/2;
    let best = pos, bd = Infinity;
    slides.forEach((sl,k)=>{
      const d = Math.abs(sl.offsetLeft + sl.offsetWidth/2 - mid);
      if(d < bd){ bd = d; best = k; }
    });
    return best;
  };
  const place = smooth => {
    works.scrollTo({left: centerOf(pos), behavior: smooth ? 'smooth' : 'auto'});
    paintDots();
  };

  const rebase = ()=>{
    if(pos >= N && pos < N*2) return;
    pos = N + (((pos % N) + N) % N);
    works.scrollTo({left: centerOf(pos), behavior:'auto'});
  };
  const go = d => {
    pos += d;
    place(true);
    setTimeout(rebase, 520);
  };

  requestAnimationFrame(()=>requestAnimationFrame(()=>place(false)));
  addEventListener('load', ()=>place(false));
  addEventListener('resize', ()=>place(false), {passive:true});

  const wp = $('#wPrev'), wn = $('#wNext');
  if(wp) wp.onclick = ()=> go(-1);
  if(wn) wn.onclick = ()=> go(1);
  if(dots) dots.onclick = e => {
    const d = e.target.closest('i'); if(!d) return;
    pos = N + (+d.dataset.i); place(true);
  };

  let idle;
  works.addEventListener('scroll', ()=>{

    markDot(nearest());
    clearTimeout(idle);
    idle = setTimeout(()=>{
      pos = nearest();
      paintDots();
      rebase();
    }, 140);
  }, {passive:true});

  const lb = $('#lb');
  works.onclick = e => {
    const c = e.target.closest('.wslide'); if(!c || !lb) return;
    const r = R0[+c.dataset.i];
    $('#lbIn').innerHTML = `<button class="x" type="button" aria-label="Закрити">×</button>
      <img src="${r.src}" alt="${r.title}"><p class="cap">${r.title} · ${r.text}</p>`;
    lb.classList.add('open');
  };
  if(lb){
    lb.onclick = e => { if(e.target === lb || e.target.closest('.x')) lb.classList.remove('open'); };
    addEventListener('keydown', e => { if(e.key === 'Escape') lb.classList.remove('open'); });
  }
}

const blogRow = $('#blogRow');
if(blogRow && typeof CFG !== 'undefined'){
  const MONTHS = ['січня','лютого','березня','квітня','травня','червня',
                  'липня','серпня','вересня','жовтня','листопада','грудня'];
  const fmt = d0 => { const d = new Date(d0); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const PIC = ['assets/work-wood-cream','assets/work-kitchen-grey','assets/corp-office'];
  blogRow.innerHTML = CFG.news.slice(0,3).map((n,i)=>`
    <a class="bpost" href="blog.html#n-${i}">
      <span class="ph"><picture><source srcset="${PIC[i%3]}.webp" type="image/webp">
        <img src="${PIC[i%3]}.jpg" alt="${n.title}" loading="lazy" width="1200" height="750"></picture></span>
      <span class="bd">
        <span class="date">${fmt(n.date)}</span>
        <h3>${n.title}</h3>
        <p>${n.excerpt}</p>
        <span class="more">Читати <i>→</i></span>
      </span>
    </a>`).join('');
}

const mark = $('#mark');
if(mark) new IntersectionObserver(es=>mark.classList.toggle('off', !es[0].isIntersecting),
  {threshold:0}).observe(mark);

$$('.q4').forEach(q=>{
  const b = q.querySelector('button');
  b.onclick = ()=>{
    const open = q.classList.toggle('open');
    b.setAttribute('aria-expanded', open);
    if(open) $$('.q4').forEach(o=>{ if(o!==q){ o.classList.remove('open');
      o.querySelector('button').setAttribute('aria-expanded','false'); } });
  };
});
$$('[data-exp]').forEach(box=>{
  const btn = box.querySelector('.exp-btn');
  if(!btn) return;
  btn.onclick = ()=>{ const open = box.classList.toggle('open'); btn.setAttribute('aria-expanded', open); };
});

const burger = $('.burger');

if(burger) burger.onclick = ()=>{
  const m = $('.nav4 nav') || $('.navf .menu-l');
  if(!m) return;
  const open = m.style.display === 'flex';
  Object.assign(m.style, open ? {display:'',position:'',padding:''} : {
    display:'flex', position:'absolute', top:'var(--hdr)', left:'22px', right:'22px',
    background:'#FBFAF8', flexDirection:'column', gap:'2px', padding:'12px 14px',
    borderRadius:'18px', boxShadow:'var(--sh-m)'
  });
};

renderLines();
let saved = null;
try{ saved = localStorage.getItem(LINE_KEY); }catch(e){}

const only = body.dataset.onlyLine;
const fromUrl = new URLSearchParams(location.search).get('line');
if(only && CFG.lines[only]) setLine(only, true);
else if(fromUrl && CFG.lines[fromUrl]) setLine(fromUrl, true);
else if(saved && CFG.lines[saved]) setLine(saved, true);
else buildFabrics();

})();
