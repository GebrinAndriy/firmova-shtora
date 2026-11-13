(function(){
'use strict';

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

if(typeof CFG !== 'undefined'){
  const mail = $('#footMail');
  if(mail && CFG.email){ mail.textContent = CFG.email; mail.href = 'mailto:' + CFG.email; }
  $$('[data-tel]').forEach(a=>{
    a.textContent = CFG.phone;
    a.href = 'tel:' + CFG.phone.replace(/[^\d+]/g,'');
  });
  const msg = $('#footMsg');
  if(msg){
    const L = CFG.links || {};

    const до = (k) => window.fshMsgHref ? fshMsgHref(k, L[k]) : ((L[k] && L[k] !== '#') ? L[k] : '');
    const real = до('viberChat') || до('telegram');
    if(real){ msg.href = real; msg.hidden = false; }
  }
}

const ICON = {

  home:'<path d="M3.5 10.6 12 4l8.5 6.6"/><path d="M5.8 9.4V19a1 1 0 0 0 1 1h10.4a1 1 0 0 0 1-1V9.4"/>'+
       '<path d="M9.8 20v-5.2h4.4V20"/>',
  fab: '<path d="M4 8.2 12 4.2l8 4-8 4-8-4Z"/><path d="M4 12.2 12 16.2l8-4"/>'+
       '<path d="M4 16.2 12 20.2l8-4"/>',
  tag: '<path d="M11.2 3.8H19a1.2 1.2 0 0 1 1.2 1.2v7.8a2 2 0 0 1-.6 1.4l-5.6 5.6a1.4 1.4 0 0 1-2 0l-6.4-6.4a1.4 1.4 0 0 1 0-2l5.2-5.2a2 2 0 0 1 1.4-.4Z"/>'+
       '<circle cx="16.2" cy="7.8" r="1.4"/>',
  truck:'<path d="M2.8 7.4h10.4a1 1 0 0 1 1 1v7.4H2.8a1 1 0 0 1-1-1V8.4a1 1 0 0 1 1-1Z"/>'+
       '<path d="M14.2 10.6h3.6l3.4 3.4v1.8h-7Z"/><circle cx="6.6" cy="18" r="1.9"/>'+
       '<circle cx="17.4" cy="18" r="1.9"/>',
  list:'<path d="M4 6.8h16"/><path d="M4 12h16"/><path d="M4 17.2h10"/>',
  chat:'<path d="M20.4 11.6c0 4-3.8 7.2-8.4 7.2-1 0-2-.15-2.9-.45L4 20l1.4-3.9C4.2 14.85 3.6 13.3 3.6 11.6c0-4 3.8-7.2 8.4-7.2s8.4 3.2 8.4 7.2Z"/>',
  box: '<path d="M12 3.6 20 7.4v9.2L12 20.4 4 16.6V7.4Z"/><path d="M4 7.4 12 11.2l8-3.8"/>'+
       '<path d="M12 11.2v9.2"/>',
  star:'<path d="m12 4 2.5 5.1 5.6.8-4 4 .95 5.6L12 16.85 6.95 19.5 7.9 13.9l-4-4 5.6-.8Z"/>',
  news:'<path d="M4.4 5.6h10.2a1 1 0 0 1 1 1v10.8a1.6 1.6 0 0 0 1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6Z"/>'+
       '<path d="M15.6 9.2h2.8a1.2 1.2 0 0 1 1.2 1.2v6.6a1.6 1.6 0 0 1-3.2 0"/>'+
       '<path d="M7.6 9.4h4.8M7.6 12.6h4.8M7.6 15.6h3"/>',
  calc:'<path d="M6.8 2.8h10.4a1.4 1.4 0 0 1 1.4 1.4v15.6a1.4 1.4 0 0 1-1.4 1.4H6.8a1.4 1.4 0 0 1-1.4-1.4V4.2a1.4 1.4 0 0 1 1.4-1.4Z"/>'+
       '<path d="M8.6 6.6h6.8"/><path d="M9 11h.01M12 11h.01M15 11h.01M9 14.4h.01M12 14.4h.01M15 14.4h.01M9 17.8h3.01"/>',
  roll:'<path d="M4.6 3.8h14.8a1 1 0 0 1 1 1v1.6a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1V4.8a1 1 0 0 1 1-1Z"/>'+
       '<path d="M5.8 7.4v9.8h12.4V7.4"/><path d="M5.8 11.2h12.4M5.8 14.4h12.4"/>'+
       '<path d="M12 17.2v2.6"/>',
  cart:'<path d="M3.4 4.6h2.2l2.3 9.9a1.6 1.6 0 0 0 1.6 1.2h6.9a1.6 1.6 0 0 0 1.6-1.2l1.4-6.1H6.6"/>'+
       '<circle cx="10" cy="19.2" r="1.4"/><circle cx="16.6" cy="19.2" r="1.4"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21'+
       'M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
  moon:'<path d="M20 14.4A8.4 8.4 0 1 1 9.6 4a6.9 6.9 0 0 0 10.4 10.4Z"/>'
};
const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';

const page = location.pathname.split('/').pop() || 'index.html';

(function mnav(){
  if($('.mnav')) return;
  const items = [
    {href:'/',                       icon:ICON.home, name:'Головна'},
    {href:'/#kolir',      icon:ICON.fab,  name:'Тканини'},
    {href:'kviz.html',               icon:ICON.calc, name:'Розрахунок', cta:true},
    {href:'/#tsina',      icon:ICON.tag,  name:'Ціни'},
    {href:'/#dostavka',   icon:ICON.truck, name:'Доставка'}
  ];

  if(page === 'blog.html') items[4] = {href:'blog.html', icon:ICON.news, name:'Блог'};
  const n = document.createElement('nav');
  n.className = 'mnav auto';
  n.setAttribute('aria-label','Основна навігація');
  n.innerHTML = '<div class="mnav-in">' + items.map(x=>{
    const тут = x.href.split('#')[0] === page;
    const on = тут ? ' on' : '';

    const cta = x.cta && !тут ? 'mnav-cta' : '';
    return '<a href="' + x.href + '" class="' + cta + on + '">' +
      svg(x.icon) + '<span>' + x.name + '</span></a>';
  }).join('') + '</div>';
  document.body.appendChild(n);
})();

(function onScroll(){
  const watch = ()=>[$('.mnav'), $('#floatTheme'), $('.chat-fab')].filter(Boolean);
  let last = scrollY;
  addEventListener('scroll', ()=>{
    const y = scrollY;
    const show = y > 240 && y > last;
    if(Math.abs(y - last) > 6){
      watch().forEach(e=>e.classList.toggle('show', show || y > last));
      last = y;
    }
  }, {passive:true});

  addEventListener('load', ()=>{
    if(document.documentElement.scrollHeight <= innerHeight + 80)
      watch().forEach(e=>e.classList.add('show'));
  });
})();

})();
