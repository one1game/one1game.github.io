/* =============================================================
   OBOI — галерея игровых обоев.
   Источники: Wallhaven (по умолчанию), Unsplash, Pexels, Pixabay.
   Ключи стоков хранятся только в localStorage.
   ============================================================= */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var KEY_STORE = 'oboi:keys';
  var FAV_STORE = 'oboi:favs';
  var PER_PAGE = 24;

  var state = {
    source: 'wallhaven',
    q: '',
    res: '',
    sort: 'favorites',
    page: 1,
    lastPage: 1,
    items: [],
    total: 0,
    loading: false,
    apiFailed: false,
    pendingReset: false,
    view: 'grid',
    favMode: false,
    viewerIndex: -1
  };

  var keys = readStore(KEY_STORE, {});
  var favs = readStore(FAV_STORE, []);
  var initialData = null;
  var cancelDebounce = function () {};

  var el = {
    grid: $('#oboi-grid'),
    empty: $('#oboi-empty'),
    moreWrap: $('#oboi-more-wrap'),
    more: $('#oboi-more'),
    end: $('#oboi-end'),
    result: $('#oboi-result-line'),
    total: $('#stat-total'),
    search: $('#oboi-search'),
    searchClear: $('#oboi-search-clear'),
    chips: $('#oboi-chips'),
    res: $('#oboi-res'),
    sort: $('#oboi-sort'),
    source: $('#oboi-source'),
    resMobile: $('#oboi-res-mobile'),
    sortMobile: $('#oboi-sort-mobile'),
    sourceMobile: $('#oboi-source-mobile'),
    favCount: $('#oboi-fav-count'),
    favOpen: $('#oboi-fav-open'),
    reset: $('#oboi-reset'),
    random: $('#oboi-random'),
    settingsOpen: $('#oboi-settings-open'),
    sheetRandom: $('#oboi-sheet-random'),
    sheetSettings: $('#oboi-sheet-settings'),
    sheet: $('#oboi-sheet'),
    sheetBackdrop: $('#oboi-sheet-backdrop'),
    sheetApply: $('#oboi-sheet-apply'),
    sheetClose: $('#oboi-sheet-close'),
    filterOpen: $('#oboi-filter-open'),
    modal: $('#oboi-modal'),
    modalClose: $('#oboi-modal-close'),
    modalSave: $('#oboi-modal-save'),
    modalClear: $('#oboi-modal-clear'),
    toast: $('#oboi-toast'),
    viewer: $('#oboi-viewer'),
    viewerImg: $('#oboi-viewer-img'),
    viewerCounter: $('#oboi-viewer-counter'),
    viewerTitle: $('#oboi-viewer-title'),
    viewerRes: $('#oboi-viewer-res'),
    viewerSource: $('#oboi-viewer-source'),
    viewerDownload: $('#oboi-viewer-download'),
    viewerOrigin: $('#oboi-viewer-origin'),
    viewerFav: $('#oboi-viewer-fav'),
    viewerShare: $('#oboi-viewer-share'),
    viewerClose: $('#oboi-viewer-close'),
    viewerPrev: $('#oboi-viewer-prev'),
    viewerNext: $('#oboi-viewer-next'),
    viewBtns: $$('.oboi-view-toggle button'),
    updated: $('#oboi-updated')
  };

  /* ── Storage ─────────────────────────────────────────────── */
  function readStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  /* ── Utils ───────────────────────────────────────────────── */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('ru-RU');
  }

  var toastTimer = null;
  function toast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.remove('is-visible');
    }, 2600);
  }

  function debounce(fn, ms) {
    var timer = null;
    function wrapped() {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, ms);
    }
    wrapped.cancel = function () { clearTimeout(timer); };
    return wrapped;
  }

  /* ── Источники ───────────────────────────────────────────── */
  function wallhavenParams(page) {
    var params = new URLSearchParams();
    params.set('q', state.q || 'game');
    params.set('categories', '110');
    params.set('purity', '100');
    params.set('sorting', state.sort);
    params.set('page', String(page));

    if (state.sort === 'toplist') params.set('topRange', '1M');

    if (state.res === '1920x1080') {
      params.set('resolutions', '1920x1080');
      params.set('ratios', '16x9');
      params.set('atleast', '1920x1080');
    } else if (state.res === '2560x1440') {
      params.set('resolutions', '2560x1440');
      params.set('ratios', '16x9');
      params.set('atleast', '2560x1440');
    } else if (state.res === '3840x2160') {
      params.set('atleast', '3840x2160');
      params.set('ratios', '16x9');
    } else if (state.res === 'phone') {
      params.set('atleast', '1080x1920');
      params.set('ratios', '9x16');
    } else if (state.res === 'ultrawide') {
      params.set('atleast', '3440x1440');
      params.set('ratios', '21x9');
    } else {
      params.set('atleast', '1920x1080');
    }

    return params;
  }

  function normalizeWallhaven(item) {
    return {
      id: item.id,
      source: 'Wallhaven',
      thumb: item.thumbs && item.thumbs.large ? item.thumbs.large : item.path,
      full: item.path,
      page: item.url,
      width: item.dimension_x,
      height: item.dimension_y,
      res: item.resolution,
      author: '',
      title: state.q ? state.q + ' — игровые обои' : 'Игровые обои'
    };
  }

  function loadWallhaven(page) {
    var params = wallhavenParams(page);
    return fetch('/api/wallhaven?' + params.toString(), { credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) throw new Error('proxy ' + res.status);
        return res.json();
      })
      .catch(function () {
        // GitHub Pages / локальная статика без Functions: пробуем напрямую.
        return fetch('https://wallhaven.cc/api/v1/search?' + params.toString())
          .then(function (res) {
            if (!res.ok) throw new Error('api ' + res.status);
            return res.json();
          });
      })
      .then(function (json) {
        var data = json && json.data ? json.data : [];
        var meta = json && json.meta ? json.meta : {};
        return {
          items: data.map(normalizeWallhaven),
          total: meta.total || data.length,
          lastPage: meta.last_page || page
        };
      });
  }

  function stockQuery() {
    return state.q || 'gaming neon cyberpunk';
  }

  function loadUnsplash(page) {
    var key = keys.unsplash;
    if (!key) return Promise.reject(new Error('NO_KEY:unsplash'));
    var params = new URLSearchParams({
      query: stockQuery(),
      page: String(page),
      per_page: String(PER_PAGE),
      orientation: state.res === 'phone' ? 'portrait' : 'landscape'
    });
    return fetch('https://api.unsplash.com/search/photos?' + params.toString(), {
      headers: { Authorization: 'Client-ID ' + key }
    }).then(function (res) {
      if (!res.ok) throw new Error('unsplash ' + res.status);
      return res.json();
    }).then(function (json) {
      var items = (json.results || []).map(function (item) {
        return {
          id: 'unsplash-' + item.id,
          source: 'Unsplash',
          thumb: item.urls.small,
          full: item.urls.full,
          page: item.links.html,
          width: item.width,
          height: item.height,
          res: item.width + '×' + item.height,
          author: item.user ? item.user.name : '',
          title: item.alt_description || 'Игровые обои'
        };
      });
      var total = json.total || items.length;
      return { items: items, total: total, lastPage: Math.ceil(total / PER_PAGE) };
    });
  }

  function loadPexels(page) {
    var key = keys.pexels;
    if (!key) return Promise.reject(new Error('NO_KEY:pexels'));
    var params = new URLSearchParams({
      query: stockQuery(),
      page: String(page),
      per_page: String(PER_PAGE),
      orientation: state.res === 'phone' ? 'portrait' : 'landscape'
    });
    return fetch('https://api.pexels.com/v1/search?' + params.toString(), {
      headers: { Authorization: key }
    }).then(function (res) {
      if (!res.ok) throw new Error('pexels ' + res.status);
      return res.json();
    }).then(function (json) {
      var items = (json.photos || []).map(function (item) {
        return {
          id: 'pexels-' + item.id,
          source: 'Pexels',
          thumb: item.src.medium,
          full: item.src.original,
          page: item.url,
          width: item.width,
          height: item.height,
          res: item.width + '×' + item.height,
          author: item.photographer || '',
          title: item.alt || 'Игровые обои'
        };
      });
      var total = json.total_results || items.length;
      return { items: items, total: total, lastPage: Math.ceil(total / PER_PAGE) };
    });
  }

  function loadPixabay(page) {
    var key = keys.pixabay;
    if (!key) return Promise.reject(new Error('NO_KEY:pixabay'));
    var params = new URLSearchParams({
      key: key,
      q: stockQuery(),
      page: String(page),
      per_page: String(PER_PAGE),
      image_type: 'photo',
      orientation: state.res === 'phone' ? 'vertical' : 'horizontal',
      safesearch: 'true'
    });
    return fetch('https://pixabay.com/api/?' + params.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('pixabay ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var items = (json.hits || []).map(function (item) {
          return {
            id: 'pixabay-' + item.id,
            source: 'Pixabay',
            thumb: item.webformatURL,
            full: item.largeImageURL,
            page: item.pageURL,
            width: item.imageWidth,
            height: item.imageHeight,
            res: item.imageWidth + '×' + item.imageHeight,
            author: item.user || '',
            title: item.tags || 'Игровые обои'
          };
        });
        var total = json.totalHits || items.length;
        return { items: items, total: total, lastPage: Math.ceil(total / PER_PAGE) };
      });
  }

  function loadSource(page) {
    if (state.favMode) {
      return Promise.resolve({ items: [], total: favs.length, lastPage: 1 });
    }
    if (state.source === 'unsplash') return loadUnsplash(page);
    if (state.source === 'pexels') return loadPexels(page);
    if (state.source === 'pixabay') return loadPixabay(page);
    return loadWallhaven(page);
  }

  /* ── Рендер карточек ─────────────────────────────────────── */
  function itemById(id) {
    if (state.favMode) {
      var fav = favs.filter(function (f) { return f.id === id; })[0];
      if (fav) return fav;
    }
    return state.items.filter(function (item) { return item.id === id; })[0];
  }

  function isFav(id) {
    return favs.some(function (item) { return item.id === id; });
  }

  function cardHtml(item) {
    var alt = item.title + ' — ' + item.res + (item.author ? ', автор ' + item.author : '');
    var favActive = isFav(item.id) ? ' is-active' : '';
    return '' +
      '<article class="wall-card" data-id="' + esc(item.id) + '">' +
        '<a class="wall-card__media" href="' + esc(item.full) + '" target="_blank" rel="noopener" data-open="' + esc(item.id) + '" aria-label="Открыть: ' + esc(alt) + '">' +
          '<img src="' + esc(item.thumb) + '" data-full="' + esc(item.full) + '" alt="' + esc(alt) + '" width="' + esc(item.width) + '" height="' + esc(item.height) + '" loading="lazy" decoding="async">' +
          '<span class="wall-card__res">' + esc(item.res) + '</span>' +
        '</a>' +
        '<button type="button" class="wall-card__fav' + favActive + '" data-fav="' + esc(item.id) + '" aria-label="' + (favActive ? 'Удалить из избранного' : 'Добавить в избранное') + '" aria-pressed="' + (favActive ? 'true' : 'false') + '"><i class="' + (favActive ? 'fas' : 'far') + ' fa-heart" aria-hidden="true"></i></button>' +
        '<div class="wall-card__actions">' +
          '<button type="button" class="wall-card__btn" data-open="' + esc(item.id) + '"><i class="fas fa-expand" aria-hidden="true"></i><span>Смотреть</span></button>' +
          '<a class="wall-card__btn" href="' + esc(item.full) + '" target="_blank" rel="noopener" download><i class="fas fa-download" aria-hidden="true"></i><span>Скачать</span></a>' +
          '<a class="wall-card__btn wall-card__btn--icon" href="' + esc(item.page) + '" target="_blank" rel="noopener nofollow" aria-label="Источник"><i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></a>' +
        '</div>' +
      '</article>';
  }

  function render() {
    var items = state.favMode ? favs : state.items;

    el.grid.classList.toggle('is-list', state.view === 'list');
    el.grid.setAttribute('data-orient',
      state.res === 'phone' ? 'portrait' : state.res === 'ultrawide' ? 'ultrawide' : 'landscape');

    if (!items.length) {
      el.grid.innerHTML = '';
      el.empty.hidden = false;
      el.moreWrap.hidden = true;
      el.end.hidden = true;
    } else {
      el.empty.hidden = true;
      el.grid.innerHTML = items.map(cardHtml).join('');
      el.moreWrap.hidden = state.favMode || state.page >= state.lastPage;
      el.end.hidden = state.favMode || state.page < state.lastPage;
    }

    if (state.favMode) {
      el.result.innerHTML = 'Избранное: <b>' + favs.length + '</b> обоев';
    } else if (state.loading && !items.length) {
      el.result.textContent = 'Загрузка подборки…';
    } else {
      el.result.innerHTML = 'Найдено <b>' + fmt(state.total) + '</b> · показано <b>' + items.length + '</b>';
    }

    if (state.total && el.total) el.total.textContent = fmt(state.total);
    updateFavCount();
    bindImageFallback();

    // Первые четыре карточки — LCP, грузим сразу.
    $$('img[data-full]', el.grid).forEach(function (img, index) {
      if (index < 4) {
        img.loading = 'eager';
        img.setAttribute('fetchpriority', 'high');
      }
    });
  }

  function bindImageFallback() {
    $$('img[data-full]', el.grid).forEach(function (img) {
      if (img.dataset.bound) return;
      img.dataset.bound = '1';
      img.addEventListener('error', function () {
        if (img.dataset.fallback) return;
        img.dataset.fallback = '1';
        img.src = img.dataset.full;
      });
    });
  }

  function skeleton() {
    var html = '';
    for (var i = 0; i < 12; i++) html += '<div class="wall-skeleton" aria-hidden="true"></div>';
    el.grid.innerHTML = html;
    el.empty.hidden = true;
    el.moreWrap.hidden = true;
    el.end.hidden = true;
  }

  /* ── Локальные подборки (data.json) ──────────────────────── */
  var PRESET_MAP = {
    '': 'home',
    'game': 'games',
    'games': 'games',
    'video game': 'games',
    'neon': 'neon',
    'cyberpunk': 'cyberpunk',
    'anime': 'anime',
    'dark': 'dark',
    'retro': 'retro',
    'fantasy': 'fantasy',
    'genshin impact': 'genshin-impact',
    'cyberpunk 2077': 'cyberpunk-2077',
    'elden ring': 'elden-ring',
    'gta 5': 'gta-5',
    'gta v': 'gta-5',
    'minecraft': 'minecraft',
    'counter strike': 'counter-strike',
    'counter-strike': 'counter-strike',
    'cs2': 'counter-strike',
    'valorant': 'valorant',
    'the witcher 3': 'the-witcher-3',
    'witcher 3': 'the-witcher-3',
    'star wars': 'star-wars',
    'dota 2': 'dota-2',
    'league of legends': 'league-of-legends',
    'fortnite': 'fortnite',
    'dark souls': 'dark-souls',
    'god of war': 'god-of-war',
    'red dead redemption 2': 'red-dead-redemption-2',
    'rdr2': 'red-dead-redemption-2',
    'hollow knight': 'hollow-knight'
  };

  var RES_MAP = {
    'phone': 'phone',
    'ultrawide': 'ultrawide',
    '3840x2160': '4k',
    '4k': '4k',
    '2560x1440': '2560x1440',
    '2k': '2560x1440',
    '1920x1080': '1920x1080'
  };

  function localPreset() {
    if (!initialData || state.source !== 'wallhaven') return null;
    if (state.sort !== 'toplist' && state.sort !== 'relevance' && state.sort !== 'favorites') return null;

    var key = null;
    if (state.res) {
      // Комбинацию «запрос + разрешение» оставляем API.
      if (state.q) return null;
      key = RES_MAP[state.res] || null;
    } else {
      var q = (state.q || '').trim().toLowerCase().replace(/\s+/g, ' ');
      key = PRESET_MAP[q] || null;
    }

    if (!key) return null;

    if (key === 'home') {
      return {
        items: initialData.home || [],
        total: initialData.total || (initialData.home || []).length
      };
    }

    var page = initialData.pages && initialData.pages[key];
    if (!page || !page.items || !page.items.length) return null;
    return page;
  }

  /* ── Загрузка ────────────────────────────────────────────── */
  function search(reset) {
    if (state.loading) {
      if (reset) state.pendingReset = true;
      return;
    }
    if (state.favMode) return;

    if (reset) {
      state.pendingReset = false;
      state.apiFailed = false;
      var local = localPreset();
      if (local) {
        state.items = local.items.slice();
        state.total = local.total || state.items.length;
        state.page = 1;
        state.lastPage = state.total > state.items.length ? 99 : 1;
        state.loading = false;
        render();
        syncUrl();
        return;
      }
    }

    state.loading = true;
    var nextPage = reset ? 1 : state.page + 1;
    if (reset) {
      state.items = [];
      state.total = 0;
      skeleton();
      el.result.textContent = 'Загрузка подборки…';
    }

    loadSource(nextPage).then(function (result) {
      if (reset) state.items = result.items;
      else state.items = state.items.concat(result.items);

      state.page = nextPage;
      state.lastPage = result.lastPage || nextPage;
      state.total = result.total || state.items.length;
      state.loading = false;
      render();
      syncUrl();
      runPending();
    }).catch(function (error) {
      state.loading = false;
      state.apiFailed = true;
      state.lastPage = state.page;
      var message = String(error && error.message || error);
      if (message.indexOf('NO_KEY:') === 0) {
        openSettings();
        toast('Добавьте ключ для этого источника');
      } else {
        toast('Не удалось загрузить ещё. Попробуйте позже.');
      }
      render();
      runPending();
      console.error(error);
    });
  }

  function runPending() {
    if (state.pendingReset) {
      state.pendingReset = false;
      search(true);
    }
  }

  function loadInitial() {
    var params = new URLSearchParams(location.search);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('res')) state.res = params.get('res');
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('source')) state.source = params.get('source');

    el.search.value = state.q;
    el.res.value = state.res;
    el.sort.value = state.sort;
    el.source.value = state.source;
    syncSelects();
    syncChips();

    fetch('data.json')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        initialData = data;
        if (data && data.generatedAt && el.updated) {
          var updatedDate = new Date(data.generatedAt);
          if (!isNaN(updatedDate.getTime())) {
            el.updated.textContent = 'Обновлено ' + updatedDate.toLocaleDateString('ru-RU') + ' · подборки обновляются ежедневно';
          }
        }
        if (data && data.home && data.home.length) {
          state.items = data.home;
          state.total = data.total || data.home.length;
          state.page = 1;
          state.lastPage = data.total > data.home.length ? 99 : 1;
          if (el.total) el.total.textContent = fmt(state.total);
          render();
          if (state.q || state.res || state.source !== 'wallhaven' || state.sort !== 'toplist') {
            search(true);
          }
        } else {
          search(true);
        }
        var id = params.get('id');
        if (id) openById(id);
      })
      .catch(function () {
        search(true);
      });
  }

  /* ── URL / селекты / чипы ────────────────────────────────── */
  function syncUrl() {
    try {
      if (state.favMode) return;
      var params = new URLSearchParams();
      if (state.q) params.set('q', state.q);
      if (state.res) params.set('res', state.res);
      if (state.sort !== 'favorites') params.set('sort', state.sort);
      if (state.source !== 'wallhaven') params.set('source', state.source);
      var qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    } catch (e) {}
  }

  function syncSelects() {
    el.res.value = state.res;
    el.sort.value = state.sort;
    el.source.value = state.source;
    el.resMobile.value = state.res;
    el.sortMobile.value = state.sort;
    el.sourceMobile.value = state.source;
  }

  function syncChips() {
    $$('.oboi-chip', el.chips).forEach(function (chip) {
      var q = chip.getAttribute('data-q');
      var filter = chip.getAttribute('data-filter');
      var active = false;
      if (q !== null) active = !state.res && state.q === q;
      if (filter === '4k') active = state.res === '3840x2160';
      if (filter === 'phone') active = state.res === 'phone';
      if (filter === 'ultrawide') active = state.res === 'ultrawide';
      if (!state.q && !state.res) active = !q && !filter;
      chip.classList.toggle('is-active', active);
    });
  }

  function applyQuery(q, res) {
    cancelDebounce();
    state.q = q || '';
    state.res = res || '';
    state.favMode = false;
    el.search.value = state.q;
    el.searchClear.classList.toggle('is-visible', !!state.q);
    syncSelects();
    syncChips();
    search(true);
  }

  function resetFilters() {
    cancelDebounce();
    state.q = '';
    state.res = '';
    state.sort = 'favorites';
    state.source = 'wallhaven';
    state.favMode = false;
    state.apiFailed = false;
    el.search.value = '';
    el.searchClear.classList.remove('is-visible');
    syncSelects();
    syncChips();
    search(true);
    toast('Фильтры сброшены');
  }

  /* ── Избранное ───────────────────────────────────────────── */
  function updateFavCount() {
    if (!el.favCount) return;
    el.favCount.textContent = String(favs.length);
    el.favCount.hidden = favs.length === 0;
    el.favOpen.classList.toggle('is-active', state.favMode);
    el.favOpen.setAttribute('aria-pressed', state.favMode ? 'true' : 'false');
  }

  function toggleFav(item) {
    if (!item) return;
    var index = -1;
    for (var i = 0; i < favs.length; i++) {
      if (favs[i].id === item.id) { index = i; break; }
    }
    if (index >= 0) {
      favs.splice(index, 1);
      toast('Удалено из избранного');
    } else {
      favs.unshift(item);
      toast('Добавлено в избранное');
    }
    writeStore(FAV_STORE, favs);
    updateFavCount();
    if (state.favMode) render();
    else {
      var card = $('.wall-card[data-id="' + cssEsc(item.id) + '"]', el.grid);
      if (card) {
        var btn = $('.wall-card__fav', card);
        if (btn) {
          var active = isFav(item.id);
          btn.classList.toggle('is-active', active);
          btn.setAttribute('aria-pressed', active ? 'true' : 'false');
          btn.setAttribute('aria-label', active ? 'Удалить из избранного' : 'Добавить в избранное');
          btn.innerHTML = '<i class="' + (active ? 'fas' : 'far') + ' fa-heart" aria-hidden="true"></i>';
        }
      }
    }
    if (state.viewerIndex >= 0) {
      if (state.favMode) {
        if (!favs.length) closeViewer();
        else {
          if (state.viewerIndex >= favs.length) state.viewerIndex = favs.length - 1;
          renderViewer();
        }
      } else {
        updateViewerFav();
      }
    }
  }

  function cssEsc(value) {
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function syncOverlayClass() {
    var open = el.viewer.classList.contains('is-open') ||
      el.sheet.classList.contains('is-open') ||
      el.modal.classList.contains('is-open');
    document.body.classList.toggle('oboi-overlay', open);
  }

  /* ── Viewer ──────────────────────────────────────────────── */
  function openById(id) {
    var items = state.favMode ? favs : state.items;
    var index = -1;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) { index = i; break; }
    }
    if (index >= 0) openViewer(index);
  }

  function openViewer(index) {
    var items = state.favMode ? favs : state.items;
    if (!items.length || index < 0 || index >= items.length) return;
    state.viewerIndex = index;
    el.viewer.classList.add('is-open');
    el.viewer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    syncOverlayClass();
    renderViewer();
  }

  function renderViewer() {
    var items = state.favMode ? favs : state.items;
    var item = items[state.viewerIndex];
    if (!item) return;

    el.viewerImg.src = item.thumb;
    el.viewerImg.alt = item.title + ' — ' + item.res;
    el.viewerCounter.innerHTML = '<b>' + (state.viewerIndex + 1) + '</b> / ' + items.length;
    el.viewerTitle.textContent = item.title;
    el.viewerRes.textContent = item.res;
    el.viewerSource.textContent = item.source + (item.author ? ' · ' + item.author : '');
    el.viewerDownload.href = item.full;
    el.viewerOrigin.href = item.page;
    updateViewerFav();

    // Полное изображение подгружаем после превью.
    var full = new Image();
    full.onload = function () {
      if (items[state.viewerIndex] === item) el.viewerImg.src = item.full;
    };
    full.src = item.full;

    // Предзагрузка соседних.
    [-1, 1].forEach(function (delta) {
      var next = items[state.viewerIndex + delta];
      if (next) {
        var preload = new Image();
        preload.src = next.full;
      }
    });
  }

  function updateViewerFav() {
    var items = state.favMode ? favs : state.items;
    var item = items[state.viewerIndex];
    if (!item) return;
    var active = isFav(item.id);
    el.viewerFav.classList.toggle('is-primary', active);
    el.viewerFav.innerHTML = '<i class="' + (active ? 'fas' : 'far') + ' fa-heart" aria-hidden="true"></i> ' + (active ? 'В избранном' : 'В избранное');
  }

  function moveViewer(delta) {
    var items = state.favMode ? favs : state.items;
    if (!items.length) return;
    state.viewerIndex = (state.viewerIndex + delta + items.length) % items.length;
    renderViewer();
  }

  function closeViewer() {
    state.viewerIndex = -1;
    el.viewer.classList.remove('is-open');
    el.viewer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    el.viewerImg.removeAttribute('src');
    syncOverlayClass();
  }

  function shareCurrent() {
    var items = state.favMode ? favs : state.items;
    var item = items[state.viewerIndex];
    if (!item) return;
    var url = location.origin + '/oboi/?id=' + encodeURIComponent(item.id);
    if (navigator.share) {
      navigator.share({ title: item.title + ' — ' + item.res, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        toast('Ссылка скопирована');
      }).catch(function () {
        toast(url);
      });
    } else {
      toast(url);
    }
  }

  /* ── Фильтры / sheet / settings ──────────────────────────── */
  function openSheet() {
    el.sheet.classList.add('is-open');
    el.sheetBackdrop.classList.add('is-open');
    el.sheet.setAttribute('aria-hidden', 'false');
    el.filterOpen.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    syncOverlayClass();
  }

  function closeSheet() {
    el.sheet.classList.remove('is-open');
    el.sheetBackdrop.classList.remove('is-open');
    el.sheet.setAttribute('aria-hidden', 'true');
    el.filterOpen.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    syncOverlayClass();
  }

  function openSettings() {
    Object.keys(keys).forEach(function (name) {
      var input = $('#oboi-key-' + name);
      if (input) input.value = keys[name] || '';
    });
    updateKeyStatuses();
    el.modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    syncOverlayClass();
  }

  function closeSettings() {
    el.modal.classList.remove('is-open');
    document.body.style.overflow = '';
    syncOverlayClass();
  }

  function updateKeyStatuses() {
    ['unsplash', 'pexels', 'pixabay'].forEach(function (name) {
      var badge = $('#oboi-status-' + name);
      if (!badge) return;
      var has = !!keys[name];
      badge.className = has ? 'is-on' : 'is-off';
      badge.textContent = has ? 'ключ есть' : 'нет ключа';
    });
  }

  function saveKeys() {
    ['unsplash', 'pexels', 'pixabay'].forEach(function (name) {
      var input = $('#oboi-key-' + name);
      if (input) {
        var value = input.value.trim();
        if (value) keys[name] = value;
        else delete keys[name];
      }
    });
    writeStore(KEY_STORE, keys);
    updateKeyStatuses();
    closeSettings();
    toast('Ключи сохранены в браузере');
  }

  function clearKeys() {
    keys = {};
    writeStore(KEY_STORE, keys);
    ['unsplash', 'pexels', 'pixabay'].forEach(function (name) {
      var input = $('#oboi-key-' + name);
      if (input) input.value = '';
    });
    updateKeyStatuses();
    toast('Ключи удалены');
  }

  function switchSource(name) {
    if (name === 'wallhaven') {
      state.source = name;
      syncSelects();
      search(true);
      return;
    }
    if (!keys[name]) {
      syncSelects();
      openSettings();
      toast('Сначала добавьте ключ для ' + name);
      return;
    }
    state.source = name;
    syncSelects();
    toast('Стоковые фото — не игровые арты');
    search(true);
  }

  /* ── События ─────────────────────────────────────────────── */
  function bindEvents() {
    var doSearch = debounce(function () {
      state.q = el.search.value.trim();
      state.favMode = false;
      el.searchClear.classList.toggle('is-visible', !!state.q);
      syncChips();
      search(true);
    }, 450);
    cancelDebounce = doSearch.cancel;

    el.search.addEventListener('input', doSearch);
    el.search.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.q = el.search.value.trim();
        state.favMode = false;
        el.searchClear.classList.toggle('is-visible', !!state.q);
        syncChips();
        search(true);
      }
    });

    el.searchClear.addEventListener('click', function () {
      el.search.value = '';
      el.searchClear.classList.remove('is-visible');
      state.q = '';
      state.favMode = false;
      syncChips();
      search(true);
      el.search.focus();
    });

    el.chips.addEventListener('click', function (e) {
      var chip = e.target.closest('.oboi-chip');
      if (!chip) return;
      var q = chip.getAttribute('data-q');
      var filter = chip.getAttribute('data-filter');
      if (filter === '4k') applyQuery('', '3840x2160');
      else if (filter === 'phone') applyQuery('', 'phone');
      else if (filter === 'ultrawide') applyQuery('', 'ultrawide');
      else applyQuery(q || '', '');
      el.search.value = state.q;
      el.searchClear.classList.toggle('is-visible', !!state.q);
    });

    [el.res, el.sort, el.source].forEach(function (select) {
      select.addEventListener('change', function () {
        if (select === el.source) {
          switchSource(select.value);
          return;
        }
        state.res = el.res.value;
        state.sort = el.sort.value;
        state.favMode = false;
        syncSelects();
        syncChips();
        search(true);
      });
    });

    [el.resMobile, el.sortMobile].forEach(function (select) {
      select.addEventListener('change', function () {
        state.res = el.resMobile.value;
        state.sort = el.sortMobile.value;
        state.favMode = false;
        syncSelects();
        syncChips();
      });
    });

    el.sourceMobile.addEventListener('change', function () {
      switchSource(el.sourceMobile.value);
    });

    el.filterOpen.addEventListener('click', openSheet);
    el.sheetClose.addEventListener('click', closeSheet);
    el.sheetBackdrop.addEventListener('click', closeSheet);
    el.sheetRandom.addEventListener('click', function () {
      closeSheet();
      state.sort = 'random';
      state.favMode = false;
      syncSelects();
      syncChips();
      search(true);
      toast('Случайная подборка');
    });
    el.sheetSettings.addEventListener('click', function () {
      closeSheet();
      openSettings();
    });
    el.reset.addEventListener('click', resetFilters);
    el.sheetApply.addEventListener('click', function () {
      state.res = el.resMobile.value;
      state.sort = el.sortMobile.value;
      state.favMode = false;
      syncSelects();
      syncChips();
      closeSheet();
      search(true);
    });

    el.sheet.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-q], button[data-filter]');
      if (!btn) return;
      var q = btn.getAttribute('data-q');
      var filter = btn.getAttribute('data-filter');
      if (filter === '4k') applyQuery('', '3840x2160');
      else if (filter === 'phone') applyQuery('', 'phone');
      else applyQuery(q || '', '');
      closeSheet();
    });

    el.favOpen.addEventListener('click', function () {
      state.favMode = !state.favMode;
      if (state.favMode) {
        state.page = 1;
        state.lastPage = 1;
        render();
        toast(favs.length ? 'Показано избранное' : 'В избранном пока пусто');
      } else {
        search(true);
      }
    });

    el.random.addEventListener('click', function () {
      state.sort = 'random';
      state.favMode = false;
      syncSelects();
      search(true);
      toast('Случайная подборка');
    });

    el.settingsOpen.addEventListener('click', openSettings);
    el.modalClose.addEventListener('click', closeSettings);
    el.modalSave.addEventListener('click', saveKeys);
    el.modalClear.addEventListener('click', clearKeys);
    el.modal.addEventListener('click', function (e) {
      if (e.target === el.modal) closeSettings();
    });

    el.more.addEventListener('click', function () {
      search(false);
    });

    // Автоподгрузка при прокрутке.
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !state.loading && !state.apiFailed && !state.favMode && state.page < state.lastPage) {
            search(false);
          }
        });
      }, { rootMargin: '500px 0px' });
      observer.observe(el.moreWrap);
    }

    el.viewBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.view = btn.getAttribute('data-view');
        el.viewBtns.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        render();
      });
    });

    // Делегирование карточек.
    el.grid.addEventListener('click', function (e) {
      var favBtn = e.target.closest('[data-fav]');
      if (favBtn) {
        e.preventDefault();
        var favItem = itemById(favBtn.getAttribute('data-fav'));
        toggleFav(favItem);
        return;
      }
      var openBtn = e.target.closest('[data-open]');
      if (openBtn) {
        e.preventDefault();
        openById(openBtn.getAttribute('data-open'));
      }
    });

    // Viewer.
    el.viewerClose.addEventListener('click', closeViewer);
    el.viewerPrev.addEventListener('click', function () { moveViewer(-1); });
    el.viewerNext.addEventListener('click', function () { moveViewer(1); });
    el.viewerFav.addEventListener('click', function () {
      var items = state.favMode ? favs : state.items;
      toggleFav(items[state.viewerIndex]);
    });
    el.viewerShare.addEventListener('click', shareCurrent);
    el.viewer.addEventListener('click', function (e) {
      if (e.target === el.viewer) closeViewer();
    });

    document.addEventListener('keydown', function (e) {
      if (!el.viewer.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowLeft') moveViewer(-1);
      if (e.key === 'ArrowRight') moveViewer(1);
    });

    // Свайпы.
    var touchX = 0;
    var touchY = 0;
    el.viewer.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }, { passive: true });

    el.viewer.addEventListener('touchend', function (e) {
      if (!e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - touchX;
      var dy = e.changedTouches[0].clientY - touchY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
        moveViewer(dx < 0 ? 1 : -1);
      }
    }, { passive: true });

    // Ресайз: закрываем мобильный sheet на десктопе.
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900) closeSheet();
    });
  }

  /* ── Старт ───────────────────────────────────────────────── */
  bindEvents();
  updateFavCount();
  updateKeyStatuses();
  loadInitial();
})();
