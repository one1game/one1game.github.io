// comments.js — Guest comment system powered by Supabase for One1Game
(function() {
  'use strict';

  // Only run on pages that have #comments-section
  var container = document.getElementById('comments-section');
  if (!container) return;

  var SUPABASE_URL = 'https://xnbtizdqhpyvafftnlcb.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuYnRpemRxaHB5dmFmZnRubGNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODM3NTUsImV4cCI6MjA5MTY1OTc1NX0.9qrJJctl5o6q_stFSqMmtLbKyZzR8rrpiQppaG1f72o';

  // Determine page URL key — use canonical path without trailing slash
  var pageUrl = window.location.pathname.replace(/\/+$/, '') || '/';
  // For the home page, we use a specific key
  if (pageUrl === '') pageUrl = '/';

  // Render the comments UI
  renderUI();

  // Load supabase-js dynamically
  loadSupabase(function(err) {
    if (err) {
      showError('Не удалось загрузить систему комментариев.');
      return;
    }
    init();
  });

  // ── Render initial HTML ──────────────────
  function renderUI() {
    container.innerHTML =
      '<h3>Комментарии</h3>' +
      '<p class="comments-subtitle">Оставьте комментарий — без регистрации</p>' +
      '<form class="comments-form" id="comments-form">' +
      '  <div class="form-row">' +
      '    <input type="text" id="comment-name" placeholder="Ваше имя" maxlength="40" required />' +
      '  </div>' +
      '  <textarea id="comment-text" placeholder="Текст комментария..." maxlength="2000" required></textarea>' +
      '  <div class="form-error" id="form-error" style="display:none"></div>' +
      '  <button type="submit" class="btn-submit" id="comment-submit">Отправить</button>' +
      '</form>' +
      '<div class="comments-list" id="comments-list">' +
      '  <div class="comments-loading">Загрузка комментариев...</div>' +
      '</div>';
  }

  // ── Load supabase dynamically ────────────
  function loadSupabase(cb) {
    if (window.supabase) { cb(null); return; }
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = function() { cb(null); };
    script.onerror = function() { cb(new Error('failed to load')); };
    document.head.appendChild(script);
  }

  // ── Init ─────────────────────────────────
  function init() {
    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Load comments
    loadComments(sb);

    // Handle form submit
    var form = document.getElementById('comments-form');
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      submitComment(sb);
    });
  }

  // ── Load comments ────────────────────────
  function loadComments(sb) {
    sb
      .from('comments')
      .select('*')
      .eq('page_url', pageUrl)
      .order('created_at', { ascending: false })
      .then(function(res) {
        var list = document.getElementById('comments-list');
        if (res.error) {
          list.innerHTML = '<div class="comments-error">Ошибка загрузки комментариев.</div>';
          return;
        }
        var comments = res.data || [];
        if (comments.length === 0) {
          list.innerHTML = '<div class="comments-empty">Пока нет комментариев. Будьте первым!</div>';
          return;
        }
        list.innerHTML = comments.map(function(c) {
          var d = new Date(c.created_at);
          var dateStr = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) +
            ' в ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          var name = escapeHtml(c.author_name || 'Гость');
          var body = escapeHtml(c.content);
          return (
            '<div class="comment-card">' +
            '  <div class="comment-header">' +
            '    <span class="comment-author">' + name + '</span>' +
            '    <span class="comment-date">' + dateStr + '</span>' +
            '  </div>' +
            '  <div class="comment-body">' + body + '</div>' +
            '</div>'
          );
        }).join('');
      });
  }

  // ── Submit comment ───────────────────────
  function submitComment(sb) {
    var nameInput = document.getElementById('comment-name');
    var textInput = document.getElementById('comment-text');
    var submitBtn = document.getElementById('comment-submit');
    var errorEl = document.getElementById('form-error');

    var name = nameInput.value.trim();
    var text = textInput.value.trim();

    // Validate
    if (!name) {
      showFormError('Введите имя.');
      return;
    }
    if (name.length < 2) {
      showFormError('Имя должно быть не короче 2 символов.');
      return;
    }
    if (!text) {
      showFormError('Введите текст комментария.');
      return;
    }
    if (text.length < 3) {
      showFormError('Комментарий должен быть не короче 3 символов.');
      return;
    }

    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    sb
      .from('comments')
      .insert([{
        page_url: pageUrl,
        author_name: name,
        content: text
      }])
      .select()
      .single()
      .then(function(res) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить';

        if (res.error) {
          showFormError('Ошибка отправки. Попробуйте позже.');
          return;
        }

        // Clear form
        textInput.value = '';
        nameInput.value = '';

        // Add new comment to top of the list
        var list = document.getElementById('comments-list');
        var c = res.data;
        var d = new Date(c.created_at);
        var dateStr = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) +
          ' в ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        var name = escapeHtml(c.author_name || 'Гость');
        var body = escapeHtml(c.content);
        var html =
          '<div class="comment-card" style="border-color: var(--cyan);">' +
          '  <div class="comment-header">' +
          '    <span class="comment-author">' + name + '</span>' +
          '    <span class="comment-date">' + dateStr + '</span>' +
          '  </div>' +
          '  <div class="comment-body">' + body + '</div>' +
          '</div>';

        // Remove empty state if present, then prepend
        var emptyEl = list.querySelector('.comments-empty');
        if (emptyEl) {
          list.innerHTML = html;
        } else {
          list.insertAdjacentHTML('afterbegin', html);
        }
      });
  }

  // ── Helpers ──────────────────────────────
  function showFormError(msg) {
    var el = document.getElementById('form-error');
    el.textContent = msg;
    el.style.display = 'block';
  }

  function showError(msg) {
    var list = document.getElementById('comments-list');
    if (list) list.innerHTML = '<div class="comments-error">' + msg + '</div>';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();
