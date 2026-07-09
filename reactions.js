// reactions.js — Emoji reaction system powered by Supabase for One1Game
(function() {
  'use strict';

  var container = document.getElementById('reactions-section');
  if (!container) return;

  var SUPABASE_URL = 'https://xnbtizdqhpyvafftnlcb.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuYnRpemRxaHB5dmFmZnRubGNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODM3NTUsImV4cCI6MjA5MTY1OTc1NX0.9qrJJctl5o6q_stFSqMmtLbKyZzR8rrpiQppaG1f72o';

  var STORAGE_KEY = 'o1g_reacted_';

  var pageUrl = window.location.pathname.replace(/\/+$/, '') || '/';

  var EMOJIS = ['👍','🔥','😂','😍','💯','🎮','👾','💀'];

  // Render
  container.innerHTML =
    '<h3>Понравилась статья? Жми реакцию!</h3>' +
    '<div class="reactions-row" id="reactions-row">' +
    '  <div class="reactions-loading">Загрузка...</div>' +
    '</div>' +
    '<div class="reactions-error" id="reactions-error" style="display:none"></div>';

  loadSupabase(function(err) {
    if (err) {
      document.getElementById('reactions-row').innerHTML =
        '<div class="reactions-error">Не удалось загрузить реакции.</div>';
      return;
    }
    init();
  });

  function loadSupabase(cb) {
    if (window.supabase) { cb(null); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.onload = function() { cb(null); };
    s.onerror = function() { cb(new Error('fail')); };
    document.head.appendChild(s);
  }

  function init() {
    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    loadReactions(sb);
    bindButtons(sb);
  }

  function loadReactions(sb) {
    sb
      .from('reactions')
      .select('*')
      .eq('page_url', pageUrl)
      .then(function(res) {
        var row = document.getElementById('reactions-row');
        if (res.error) {
          row.innerHTML = '<div class="reactions-error">Ошибка загрузки.</div>';
          return;
        }
        var data = res.data || [];
        var counts = {};
        data.forEach(function(r) { counts[r.emoji] = r.count; });

        var reacted = getReactedSet();

        row.innerHTML = EMOJIS.map(function(emoji) {
          var count = counts[emoji] || 0;
          var active = reacted.has(emoji) ? ' active' : '';
          return (
            '<button class="reaction-btn' + active + '" data-emoji="' + emoji + '">' +
            '  <span class="emoji">' + emoji + '</span>' +
            '  <span class="count">' + count + '</span>' +
            '</button>'
          );
        }).join('');
      });
  }

  function bindButtons(sb) {
    var row = document.getElementById('reactions-row');
    row.addEventListener('click', function(e) {
      var btn = e.target.closest('.reaction-btn');
      if (!btn) return;

      var emoji = btn.getAttribute('data-emoji');
      var reacted = getReactedSet();

      // Already reacted - undo
      if (reacted.has(emoji)) {
        undoReaction(sb, emoji, btn);
        return;
      }

      // Check if already reacted any emoji on this page
      if (reacted.size > 0) {
        showError('Вы уже поставили реакцию! Можно только одну.');
        return;
      }

      // Add reaction
      btn.classList.add('active');
      btn.style.pointerEvents = 'none';

      sb.rpc('increment_reaction', {
        p_page_url: pageUrl,
        p_emoji: emoji
      }).then(function(res) {
        btn.style.pointerEvents = 'auto';
        if (res.error) {
          btn.classList.remove('active');
          showError('Ошибка. Попробуйте позже.');
          return;
        }
        var newCount = res.data || 0;
        btn.querySelector('.count').textContent = newCount;
        markReacted(emoji);
      });
    });
  }

  function undoReaction(sb, emoji, btn) {
    btn.classList.remove('active');
    btn.style.pointerEvents = 'none';

    // Decrement via RPC (we'll need a decrement function or just update directly)
    // For simplicity, just remove from localStorage and reload
    removeReacted(emoji);

    // Decrement in DB
    sb
      .from('reactions')
      .select('count')
      .eq('page_url', pageUrl)
      .eq('emoji', emoji)
      .single()
      .then(function(res) {
        if (res.error || !res.data) { btn.style.pointerEvents = 'auto'; return; }
        var newCount = Math.max(0, (res.data.count || 1) - 1);
        if (newCount <= 0) {
          sb.from('reactions').delete()
            .eq('page_url', pageUrl)
            .eq('emoji', emoji)
            .then(function() {
              btn.querySelector('.count').textContent = '0';
              btn.style.pointerEvents = 'auto';
            });
        } else {
          sb.from('reactions').update({ count: newCount })
            .eq('page_url', pageUrl)
            .eq('emoji', emoji)
            .then(function() {
              btn.querySelector('.count').textContent = String(newCount);
              btn.style.pointerEvents = 'auto';
            });
        }
      });
  }

  function getReactedSet() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY + pageUrl);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch(e) { return new Set(); }
  }

  function markReacted(emoji) {
    var set = getReactedSet();
    set.add(emoji);
    try { localStorage.setItem(STORAGE_KEY + pageUrl, JSON.stringify([...set])); } catch(e) {}
  }

  function removeReacted(emoji) {
    var set = getReactedSet();
    set.delete(emoji);
    try { localStorage.setItem(STORAGE_KEY + pageUrl, JSON.stringify([...set])); } catch(e) {}
  }

  function showError(msg) {
    var el = document.getElementById('reactions-error');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(function() { el.style.display = 'none'; }, 3000);
  }
})();
