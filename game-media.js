// game-media.js — ленивый HLS-плеер для трейлеров Steam на страницах игр.
// Постер показывается сразу; hls.js подгружается только по клику пользователя.
// Работает по элементам .game-video[data-hls][data-poster].
(function () {
  'use strict';

  var HLS_SRC = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
  var loading = false;
  var queue = [];

  function loadHls(cb) {
    if (window.Hls) { cb(); return; }
    queue.push(cb);
    if (loading) return;
    loading = true;
    var s = document.createElement('script');
    s.src = HLS_SRC;
    s.onload = s.onerror = function () {
      var q = queue;
      queue = [];
      loading = false;
      for (var i = 0; i < q.length; i++) { try { q[i](); } catch (e) {} }
    };
    document.head.appendChild(s);
  }

  function mount(box, native) {
    var src = box.getAttribute('data-hls');
    if (!src) return;
    var poster = box.getAttribute('data-poster') || '';
    var v = document.createElement('video');
    v.controls = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.className = 'game-video-el';
    if (poster) v.poster = poster;

    box.textContent = '';
    box.classList.add('is-playing');
    box.removeAttribute('role');
    box.removeAttribute('tabindex');
    box.appendChild(v);

    if (native) {
      v.src = src;
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
      return;
    }
    var h = new window.Hls();
    h.loadSource(src);
    h.attachMedia(v);
    h.on(window.Hls.Events.MANIFEST_PARSED, function () {
      var pp = v.play();
      if (pp && pp.catch) pp.catch(function () {});
    });
  }

  function start(box) {
    if (box.classList.contains('is-playing')) return;
    var probe = document.createElement('video');
    if (probe.canPlayType('application/vnd.apple.mpegurl')) { mount(box, true); return; }
    loadHls(function () {
      if (window.Hls && window.Hls.isSupported()) mount(box, false);
    });
  }

  function init() {
    var boxes = document.querySelectorAll('.game-video');
    for (var i = 0; i < boxes.length; i++) {
      (function (box) {
        box.addEventListener('click', function () { start(box); });
        box.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            start(box);
          }
        });
      })(boxes[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
