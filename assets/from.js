(function(){
  const f = new URLSearchParams(location.search).get('from');
  if(f !== '2' && f !== '3') return;

  const home = 'final' + f + '.html';
  const pal  = f === '2' ? 'pal-plum' : 'pal-coffee';

  function fix(){
    document.body.classList.remove('pal-green');
    document.body.classList.add(pal);
    document.querySelectorAll('a[href^="final.html"]').forEach(a=>{
      a.setAttribute('href', a.getAttribute('href').replace('final.html', home));
    });
  }
  if(document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', fix);
  else fix();
})();
