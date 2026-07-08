// youtube-feed.js — лента последних видео YouTube через API с кэшем
(function() {
  'use strict';

  var CONTAINER_ID = 'yt-feed';
  var API_KEY = 'AIzaSyAZmC4iYKyT6KUfV2hgTiK_rAw6KgS-U6U';
  var CHANNEL_ID = 'UChR3kvItnDlJ8vn2_sBmTiQ';
  var MAX_RESULTS = 6;
  var CACHE_KEY = 'one1game_yt_cache';
  var CACHE_TTL = 60 * 60 * 1000; // 1 час

  var container = document.getElementById(CONTAINER_ID);
  if (!container) return;

  // Показываем скелетон
  container.innerHTML = '<div class="yt-loading">Загрузка видео...</div>';

  // Проверяем кэш
  var cached = getCache();
  if (cached) {
    render(cached);
    return;
  }

  // Запрашиваем API
  var url = 'https://www.googleapis.com/youtube/v3/search' +
    '?part=snippet' +
    '&channelId=' + CHANNEL_ID +
    '&order=date' +
    '&maxResults=' + MAX_RESULTS +
    '&type=video' +
    '&key=' + API_KEY;

  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.items || data.items.length === 0) {
        container.innerHTML = '<div class="yt-empty">Нет видео</div>';
        return;
      }
      setCache(data.items);
      render(data.items);
    })
    .catch(function() {
      // Fallback: пробуем кэш даже просроченный
      var stale = getCache(true);
      if (stale) {
        render(stale);
      } else {
        container.innerHTML = '<div class="yt-error">Не удалось загрузить видео</div>';
      }
    });

  function getCache(ignoreTTL) {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (!ignoreTTL && Date.now() - entry.ts > CACHE_TTL) return null;
      return entry.data;
    } catch(e) { return null; }
  }

  function setCache(items) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: items }));
    } catch(e) {}
  }

  function render(items) {
    var html = '';
    items.forEach(function(item, i) {
      var vid = item.id.videoId;
      var title = item.snippet.title;
      var thumb = item.snippet.thumbnails.medium.url;
      var date = new Date(item.snippet.publishedAt).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric'
      });

      html +=
        '<a href="https://www.youtube.com/watch?v=' + vid + '" class="yt-card" target="_blank" rel="noopener">' +
        '  <div class="yt-thumb">' +
        '    <img src="' + thumb + '" alt="" loading="lazy" />' +
        '    <span class="yt-play"><i class="fab fa-youtube"></i></span>' +
        '  </div>' +
        '  <div class="yt-info">' +
        '    <span class="yt-title">' + escapeHTML(title) + '</span>' +
        '    <span class="yt-date">' + date + '</span>' +
        '  </div>' +
        '</a>';
    });
    container.innerHTML = html;
  }

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
