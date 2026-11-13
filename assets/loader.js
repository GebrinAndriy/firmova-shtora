(function () {
  'use strict';
  var html = document.documentElement;
  if (!html.classList.contains('fsh-boot')) return;

  var done = false, shownAt = Date.now();
  var MIN = 350, MAX = 2500;
  var contentReady = false, fontsReady = false;

  function hide() {
    if (done) return; done = true;
    try { sessionStorage.setItem('fsh_seen', '1'); } catch (e) {}
    html.classList.add('fsh-boot-off');
    setTimeout(function () {
      html.classList.remove('fsh-boot');
      html.classList.remove('fsh-boot-off');
    }, 280);
  }

  function maybe() {
    if (contentReady && fontsReady) {
      setTimeout(hide, Math.max(0, MIN - (Date.now() - shownAt)));
    }
  }

  document.addEventListener('fsh-content', function () { contentReady = true; maybe(); }, { once: true });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { fontsReady = true; maybe(); });
  } else { fontsReady = true; }

  addEventListener('load', function () { setTimeout(function () { contentReady = true; maybe(); }, 200); });
  setTimeout(hide, MAX);
})();
