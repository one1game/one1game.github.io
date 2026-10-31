// Analytics loader: Google Analytics + Яндекс.Метрика.
(function() {
  'use strict';

  var MEASUREMENT_ID = 'G-SZYYDYEC6T';
  var METRIKA_ID = 113479059;
  var loaded = false;
  var metrikaLoaded = false;

  window.One1GameAnalytics = window.One1GameAnalytics || {
    track: function(name, params) {
      if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
      if (typeof window.ym === 'function') window.ym(METRIKA_ID, 'reachGoal', name, params || {});
    }
  };

  function loadMetrika() {
    if (metrikaLoaded || typeof window.ym === 'function') {
      metrikaLoaded = true;
      return;
    }
    (function(m, e, t, r, i, k, a) {
      m[i] = m[i] || function() { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=' + METRIKA_ID, 'ym');

    window.ym(METRIKA_ID, 'init', {
      ssr: true,
      webvisor: true,
      clickmap: true,
      referrer: document.referrer,
      url: location.href,
      accurateTrackBounce: true,
      trackLinks: true
    });
    metrikaLoaded = true;
  }

  function loadGA() {
    if (loaded || typeof window.gtag === 'function') {
      loaded = true;
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, { anonymize_ip: true });

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
    script.dataset.analytics = 'google-analytics';
    document.head.appendChild(script);
    loaded = true;
  }

  function loadAnalytics() {
    loadGA();
    loadMetrika();
  }

  // Старые страницы содержат разметку баннера согласия — убираем её.
  function removeBanner() {
    var banner = document.getElementById('cookie-banner');
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
  }

  window.enableGA = loadAnalytics;
  window.One1GameAnalyticsConsent = { enable: loadAnalytics };

  loadAnalytics();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', removeBanner);
  else removeBanner();
})();
