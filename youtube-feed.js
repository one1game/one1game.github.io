// youtube-feed.js — лента последних видео через защищённый serverless endpoint
(function() {
  'use strict';

  var CONTAINER_ID = 'yt-feed';
  var API_BASE = String(window.ONE1GAME_API_BASE || '').replace(/\/$/, '');
  var MAX_RESULTS = 6;
  var CACHE_KEY = 'one1game_yt_cache';
  var CACHE_TTL = 60 * 60 * 1000;

  var container = document.getElementById(CONTAINER_ID);
  if (!container) return;

  container.innerHTML = '<div class="yt-loading" role="status" aria-live="polite">Загрузка видео...</div>';

  var cached = getCache();
  if (cached) {
    render(cached);
    return;
  }

  var feedUrl = API_BASE ? API_BASE + '/api/youtube-feed' : '/youtube-feed-fallback.json';

  fetch(feedUrl, {
    headers: { 'Accept': 'application/json' }
  })
    .then(function(response) {
      return response.json().catch(function() { return {}; }).then(function(data) {
        if (!response.ok || !data.ok || !Array.isArray(data.items)) {
          throw new Error('feed_unavailable');
        }
        return data.items.slice(0, MAX_RESULTS);
      });
    })
    .then(function(items) {
      if (!items.length) {
        container.innerHTML = '<div class="yt-empty" role="status">Нет видео</div>';
        return;
      }
      setCache(items);
      render(items);
    })
    .catch(function() {
      var stale = getCache(true);
      if (stale) render(stale);
      else showError();
    });

  function showError() {
    container.innerHTML = '<div class="yt-error" role="status">Не удалось загрузить видео</div>';
  }

  function getCache(ignoreTTL) {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (!entry || !Array.isArray(entry.data)) return null;
      if (!entry.data.every(function(item) {
        return item && item.videoId && item.title && item.thumbnail;
      })) return null;
      if (!ignoreTTL && Date.now() - entry.ts > CACHE_TTL) return null;
      return entry.data;
    } catch (error) {
      return null;
    }
  }

  function setCache(items) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: items }));
    } catch (error) {}
  }

  function render(items) {
    var fragment = document.createDocumentFragment();

    items.forEach(function(item) {
      if (!item || !item.videoId || !item.thumbnail) return;

      var card = document.createElement('a');
      card.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(item.videoId);
      card.className = 'yt-card';
      card.target = '_blank';
      card.rel = 'noopener noreferrer';

      var imageBox = document.createElement('div');
      imageBox.className = 'yt-thumb';

      var image = document.createElement('img');
      image.src = item.thumbnail;
      image.alt = item.title || 'Видео One1Game';
      image.loading = 'lazy';
      image.width = 320;
      image.height = 180;
      imageBox.appendChild(image);

      var play = document.createElement('span');
      play.className = 'yt-play';
      play.setAttribute('aria-hidden', 'true');
      play.innerHTML = '<i class="fab fa-youtube"></i>';
      imageBox.appendChild(play);

      var info = document.createElement('div');
      info.className = 'yt-info';

      var title = document.createElement('span');
      title.className = 'yt-title';
      title.textContent = item.title || '';
      info.appendChild(title);

      var date = document.createElement('span');
      date.className = 'yt-date';
      date.textContent = formatDate(item.publishedAt);
      info.appendChild(date);

      card.appendChild(imageBox);
      card.appendChild(info);
      fragment.appendChild(card);
    });

    container.replaceChildren(fragment);
  }

  function formatDate(value) {
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
})();
