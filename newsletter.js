// newsletter.js — подписка через защищённый serverless endpoint
(function() {
  'use strict';

  var API_BASE = String(window.ONE1GAME_API_BASE || '').replace(/\/$/, '');

  function setMessage(msg, className, text) {
    if (!msg) return;
    msg.className = 'newsletter-msg ' + className;
    msg.textContent = text;
  }

  function handleNewsletter(event) {
    event.preventDefault();
    var form = event.target;
    var email = form.querySelector('input[type="email"]');
    var btn = form.querySelector('button[type="submit"]');
    var container = form.closest('.newsletter-box') || form.parentElement;
    var msg = container ? container.querySelector('.newsletter-msg') : null;
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var value = email ? email.value.trim().toLowerCase() : '';

    if (!email || !emailRegex.test(value) || value.length > 254) {
      if (email) email.classList.add('error');
      setMessage(msg, 'error', 'Пожалуйста, введите корректный email');
      return false;
    }

    if (!API_BASE) {
      setMessage(msg, 'error', 'Подписка временно недоступна. Попробуйте позже.');
      return false;
    }

    email.classList.remove('error');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Отправка...';
    }

    fetch(API_BASE + '/api/newsletter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: value,
        website: ''
      })
    })
      .then(function(res) {
        return res.json().catch(function() { return {}; }).then(function(data) {
          if (!res.ok || !data.ok) {
            var error = new Error(data.error || 'subscription_failed');
            error.status = res.status;
            throw error;
          }
          return data;
        });
      })
      .then(function() {
        setMessage(msg, 'success', 'Спасибо! Проверьте почту для подтверждения подписки.');
        email.value = '';
      })
      .catch(function(error) {
        if (error && error.status === 409) {
          setMessage(msg, 'error', 'Этот email уже подписан или не может быть добавлен.');
        } else if (error && error.status === 429) {
          setMessage(msg, 'error', 'Слишком много запросов. Попробуйте через минуту.');
        } else {
          setMessage(msg, 'error', 'Не удалось оформить подписку. Попробуйте позже.');
        }
      })
      .finally(function() {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Подписаться';
        }
      });

    return false;
  }

  document.querySelectorAll('.newsletter-form').forEach(function(form) {
    form.addEventListener('submit', handleNewsletter);
  });
})();
