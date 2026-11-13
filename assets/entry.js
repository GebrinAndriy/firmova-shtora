(function(){

const KEY = 'fsh_entry';

const store = (()=>{
  try{ sessionStorage.setItem('_t','1'); sessionStorage.removeItem('_t'); return sessionStorage; }
  catch(e){ return null; }
})();

const ICON = {
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.2 2.4c-.5.2-.8.7-.8 1.2v.6"/>' +
       '<circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>' +
       '<circle cx="12" cy="12" r="3.2"/>'
};
const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
  'stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';

function opts(){
  const dn   = (window.CFG && CFG.lines.daynight) || {from:'—'};
  const roll = (window.CFG && CFG.lines.roller)   || {from:'—'};
  return [
    { id:'daynight', n:'1',
      t:'Штори день-ніч',
      d:'Керують світлом протягом дня',
      meta:'від ' + dn.from + ' ₴/м²',
      img:'assets/work-zebra-tulle',
      btn:'Порахувати', short:'Порахувати',
      go:()=>{ location.href = 'kviz.html?line=daynight'; } },

    { id:'roller', n:'2',
      t:'Класичні рулонні',
      d:'Просто відкрити або закрити',
      meta:'від ' + roll.from + ' ₴/м²',
      img:'assets/work-roller-white',
      btn:'Подивитись', short:'Подивитись',
      go:()=>{ location.href = '/'; } },

    { id:'help', n:'3',
      t:'Не знаю, що підійде',
      d:'Одне питання — і ми порадимо',
      meta:'30 секунд',
      icon:ICON.help,
      btn:'Підібрати', short:'Підібрати',
      go:()=>{ if(window.PRO) window.PRO.openOrder('питання на вході', 'quiz'); } },

    { id:'look', n:'4',
      t:'Спершу подивлюсь сайт',
      d:'Що це дає, з чого зроблено, як виглядає',
      meta:'без поспіху',
      icon:ICON.eye,
      btn:'До сайту', short:'До сайту',
      go:()=>{} }
  ];
}

let OPTS = [];

function media(o){
  if(o.img) return '<span class="entry-ph"><picture>' +
    '<source srcset="' + o.img + '.webp" type="image/webp">' +
    '<img src="' + o.img + '.jpg" alt="" loading="eager" width="696" height="864">' +
    '</picture></span>';
  return '<span class="entry-ic" aria-hidden="true">' + svg(o.icon) + '</span>';
}

function build(){
  OPTS = opts();
  const el = document.createElement('div');
  el.className = 'entry';
  el.id = 'entry';
  el.innerHTML = `
    <div class="entry-scrim" data-skip></div>
    <div class="entry-win" role="dialog" aria-modal="true" aria-labelledby="entryTitle">
      <div class="entry-head">
        <span class="entry-mark">
          <img src="assets/logo-web.png" alt="" width="26" height="26">
          <b>Фірмова Штора</b>
        </span>
        <h2 id="entryTitle">Куди вам далі?</h2>
      </div>

      <div class="entry-list">
        ${OPTS.map(o=>`
          <button class="entry-card" type="button" data-entry="${o.id}">
            <span class="entry-n" aria-hidden="true">${o.n}</span>
            ${media(o)}
            <span class="entry-tx">
              <b>${o.t}</b>
              <span class="entry-d">${o.d}</span>
              <span class="entry-meta">${o.meta}</span>
            </span>
            <span class="entry-btn">
              <span class="full">${o.btn}</span><span class="short">${o.short}</span>
            </span>
          </button>`).join('')}
      </div>

      <button class="entry-skip" type="button" data-skip>Пропустити</button>
    </div>`;
  return el;
}

function close(){
  const el = document.getElementById('entry');
  if(!el) return;
  el.classList.remove('on');
  document.documentElement.classList.remove('lock');
  setTimeout(()=>el.remove(), 320);
}

function answer(id){
  const o = OPTS.find(x=>x.id===id);
  try{ if(store) store.setItem(KEY, id || 'skip'); }catch(e){}
  (window.dataLayer = window.dataLayer || []).push({event:'entry', choice:id || 'skip'});
  close();

  if(o) setTimeout(o.go, 280);
}

function show(){
  let asked = null;
  try{ asked = store && store.getItem(KEY); }catch(e){}

  const force = new URLSearchParams(location.search).get('entry') === '1';
  if(asked && !force) return;

  const el = build();
  document.body.appendChild(el);
  document.documentElement.classList.add('lock');
  requestAnimationFrame(()=>el.classList.add('on'));
  setTimeout(()=>{
    const first = el.querySelector('.entry-card');
    if(first) first.focus();
  }, 90);

  el.addEventListener('click', e=>{
    if(e.target.closest('[data-skip]')){ answer(null); return; }
    const b = e.target.closest('[data-entry]');
    if(b) answer(b.dataset.entry);
  });
  addEventListener('keydown', function esc(e){
    if(e.key === 'Escape'){ answer(null); removeEventListener('keydown', esc); return; }

    if(e.key !== 'Tab') return;
    const items = [...el.querySelectorAll('button:not([disabled])')];
    if(!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
}

if(document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', show);
else show();

})();
