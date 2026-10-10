// Consent-aware Google Analytics loader.
(function() {
  'use strict';

  var MEASUREMENT_ID = 'G-SZYYDYEC6T';
  var METRIKA_ID = 113479059;
  var CONSENT_KEY = 'ga_consent';
  var loaded = false;
  var metrikaLoaded = false;

  window.One1GameAnalytics = window.One1GameAnalytics || {
    track: function(name, params) {
      if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
      if (typeof window.ym === 'function') window.ym(METRIKA_ID, 'reachGoal', name, params || {});
    }
  };

  // Яндекс.Метрика — грузится только после согласия (как и GA).
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

  function loadAnalytics() {
    if (!loaded && typeof window.gtag !== 'function') {
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
    loadMetrika();
  }

  function setConsent(value) {
    localStorage.setItem(CONSENT_KEY, value);
    if (value === 'yes') loadAnalytics();
    var banner = document.getElementById('cookie-banner');
    if (banner) banner.classList.remove('show');
  }

  function showBanner() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'cookie-banner';
      banner.className = 'cookie-banner';
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-label', 'Настройки cookies');
      banner.innerHTML = '<div class="cookie-banner-inner"><p>Мы используем аналитические cookies, чтобы улучшать сайт. <a href="/privacy">Подробнее</a></p><div class="cookie-actions"><button type="button" id="cookie-decline" class="cookie-btn cookie-decline">Только необходимые</button><button type="button" id="cookie-accept" class="cookie-btn cookie-accept">Разрешить аналитику</button></div></div>';
      document.body.appendChild(banner);
    }

    // Some legacy article pages already contain a banner with inline handlers.
    // Reuse it and add the missing loader action without creating duplicates.
    var accept = banner.querySelector('#cookie-accept, .cookie-btn.primary, .cookie-btn.cookie-accept');
    var decline = banner.querySelector('#cookie-decline, .cookie-btn.secondary, .cookie-btn.cookie-decline');
    if (!accept || !decline) {
      var buttons = banner.querySelectorAll('button');
      accept = accept || buttons[buttons.length - 1];
      decline = decline || buttons[0];
    }
    if (accept && !accept.dataset.one1gameConsentBound) {
      accept.dataset.one1gameConsentBound = '1';
      accept.addEventListener('click', function() { setConsent('yes'); });
    }
    if (decline && !decline.dataset.one1gameConsentBound) {
      decline.dataset.one1gameConsentBound = '1';
      decline.addEventListener('click', function() { setConsent('no'); });
    }
    if (!localStorage.getItem(CONSENT_KEY)) {
      requestAnimationFrame(function() { banner.classList.add('show'); });
    }
  }

  window.enableGA = loadAnalytics;
  window.One1GameAnalyticsConsent = { enable: loadAnalytics };

  try {
    var consent = localStorage.getItem(CONSENT_KEY);
    if (consent === 'yes') loadAnalytics();
    else if (!consent) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
      else showBanner();
    }
  } catch (error) {
    // If storage is unavailable, keep analytics disabled.
  }
})();
