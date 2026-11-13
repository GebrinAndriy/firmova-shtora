(function(){
'use strict';

const VIDEO_ID = 'EjlmKkwkYjA';

const facade = document.getElementById('zmPlayBtn');
const frame  = document.getElementById('zmFrame');
if(!facade || !frame) return;

const thumb = facade.querySelector('.zm-thumb');
if(thumb) thumb.style.backgroundImage =
  'url(https://i.ytimg.com/vi/' + VIDEO_ID + '/hqdefault.jpg)';

facade.addEventListener('click', function(){
  const f = document.createElement('iframe');

  f.src = 'https://www.youtube-nocookie.com/embed/' + VIDEO_ID +
          '?autoplay=1&rel=0&modestbranding=1&hl=uk';
  f.title = 'Як зробити замір вікна';
  f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture';
  f.allowFullscreen = true;
  f.loading = 'lazy';
  frame.appendChild(f);
  frame.hidden = false;
  facade.remove();
  (window.dataLayer = window.dataLayer || []).push({event:'zamir_video'});
});

})();
