(function(){
  const KEY = 'fsh_theme';
  const mq = matchMedia('(prefers-color-scheme:dark)');
  const root = document.documentElement;

  const saved = () => { try{ return localStorage.getItem(KEY); }catch(e){ return null; } };
  const now = () => root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

  function apply(t, remember){
    root.setAttribute('data-theme', t);
    if(remember){
      try{ localStorage.setItem(KEY, t); }catch(e){}
      (window.dataLayer = window.dataLayer || []).push({event:'theme', theme:t});
    }
    document.querySelectorAll('.thm [data-theme-set]').forEach(b=>{
      b.setAttribute('aria-pressed', String(b.dataset.themeSet === t));
    });
    document.querySelectorAll('.thm').forEach(g=>g.dataset.on = t);
  }

  apply(saved() || (mq.matches ? 'dark' : 'light'));

  mq.addEventListener('change', e => { if(!saved()) apply(e.matches ? 'dark' : 'light'); });

  const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.4"/>' +
    '<g stroke-linecap="round"><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6' +
    'M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8"/></g></svg>';
  const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M20 14.2A8.4 8.4 0 1 1 9.8 4a6.8 6.8 0 0 0 10.2 10.2z"/></svg>';

  function build(){
    const g = document.createElement('div');
    g.className = 'thm';
    g.setAttribute('role','group');
    g.setAttribute('aria-label','Тема оформлення');
    g.innerHTML =
      '<span class="thm-pill" aria-hidden="true"></span>' +
      '<button type="button" class="thm-b" data-theme-set="light" title="Світла тема">' +
        SUN + '<span class="sr">Світла тема</span></button>' +
      '<button type="button" class="thm-b" data-theme-set="dark" title="Темна тема">' +
        MOON + '<span class="sr">Темна тема</span></button>';
    g.addEventListener('click', e=>{
      const b = e.target.closest('[data-theme-set]');
      if(b) apply(b.dataset.themeSet, true);
    });
    return g;
  }

  function mount(){

    const right = document.querySelector('.navf .menu-r');
    if(right && !right.querySelector('.thm')){
      const before = right.querySelector('.cta-link') || right.querySelector('.burger');
      right.insertBefore(build(), before || null);
    }
    apply(now());
  }

  const HKEY = 'fsh_theme_hint2';
  const РАЗІВ = 3;

  const лічильник = () => { try{ return +localStorage.getItem(HKEY) || 0; }catch(e){ return 99; } };
  const seen = () => лічильник() >= РАЗІВ;
  const порахувати = () => { try{ localStorage.setItem(HKEY, лічильник() + 1); }catch(e){} };
  const markSeen = () => { try{ localStorage.setItem(HKEY, РАЗІВ); }catch(e){} };

  const vw = () => innerWidth  || document.documentElement.clientWidth  || 1200;
  const vh = () => innerHeight || document.documentElement.clientHeight || 800;

  function onScreen(el){
    if(!el) return false;
    const r = el.getBoundingClientRect();
    if(r.width <= 0 || r.height <= 0) return false;
    return r.bottom > 0 && r.right > 0 && r.top < vh() && r.left < vw();
  }
  const anchor = () => [...document.querySelectorAll('.thm, .fab-thm')].find(onScreen) || null;

  let tip = null, life = null;

  let показано = false;

  function place(a){
    const r = a.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const below = r.top < vh() / 2;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - tw / 2), vw() - tw - 12);
    tip.style.left = left + 'px';
    tip.style.top = (below ? r.bottom + 12 : r.top - th - 12) + 'px';
    tip.dataset.dir = below ? 'down' : 'up';
    tip.style.setProperty('--ax',
      Math.min(Math.max(r.left + r.width / 2 - left - 5.5, 14), tw - 26) + 'px');
  }

  function drop(done){
    if(!tip) return;
    if(done) markSeen();
    clearTimeout(life);
    const t = tip;
    tip = null;
    t.classList.remove('on');
    setTimeout(()=>t.remove(), 340);
  }

  function show(a){
    показано = true;
    tip = document.createElement('div');
    tip.className = 'thint';
    tip.setAttribute('role', 'status');
    tip.innerHTML = '<span><b>Тут перемикається тема</b>' +
      'Світла або темна — як зручніше читати.</span>' +
      '<button class="thint-x" type="button" aria-label="Зрозуміло">✕</button>';
    document.body.appendChild(tip);
    place(a);
    tip.querySelector('.thint-x').addEventListener('click', ()=>drop(true));
    a.addEventListener('click', ()=>drop(true), {once:true});
    порахувати();
    life = setTimeout(()=>drop(false), 9000);

    setTimeout(()=>{ if(tip) tip.classList.add('on'); }, 20);
  }

  function sync(){
    if(seen()){ drop(false); return; }
    const a = anchor();
    if(a && !tip && !показано) show(a);
    else if(!a && tip) drop(false);
    else if(a && tip) place(a);
  }

  let wait = null;
  const later = () => { clearTimeout(wait); wait = setTimeout(sync, 160); };
  addEventListener('scroll', later, {passive:true});
  addEventListener('resize', later);

  let відки = scrollY;

  const гасити = () => { if(tip) drop(false); };
  addEventListener('pointerdown', гасити, {passive:true, capture:true});
  addEventListener('keydown', гасити, {passive:true});
  addEventListener('wheel', гасити, {passive:true});
  addEventListener('touchmove', гасити, {passive:true});
  addEventListener('scroll', ()=>{ if(Math.abs(scrollY - відки) > 24) гасити(); }, {passive:true});

  function boot(){ mount(); setTimeout(sync, 2500); }

  if(document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
