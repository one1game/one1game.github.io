// newsletter.js — подписка через Buttondown API
(function() {
  var API_KEY = 'a1846c71-2bb9-407f-9cbb-52dcde3693a8';
  var API_URL = 'https://api.buttondown.email/v1/subscribers';

  function handleNewsletter(event) {
    event.preventDefault();
    var form = event.target;
    var email = form.querySelector('input[type="email"]');
    var btn = form.querySelector('button[type="submit"]');
    var container = form.closest('.newsletter-box') || form.parentElement;
    var msg = container ? container.querySelector('.newsletter-msg') : null;
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.value)) {
      email.classList.add('error');
      if (msg) {
        msg.className = 'newsletter-msg error';
        msg.textContent = 'Пожалуйста, введите корректный email';
      }
      return false;
    }

    email.classList.remove('error');
    btn.disabled = true;
    btn.textContent = 'Отправка...';

    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Token ' + API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email_address: email.value,
        tags: ['one1game-site']
      })
    })
    .then(function(res) {
      if (!res.ok) {
        return res.json().then(function(err) {
          throw new Error(err.detail || 'Ошибка сервера');
        });
      }
      return res.json();
    })
    .then(function() {
      if (msg) {
        msg.className = 'newsletter-msg success';
        msg.textContent = '✓ Спасибо! Проверьте почту для подтверждения подписки.';
      }
      email.value = '';
    })
    .catch(function(err) {
      if (msg) {
        msg.className = 'newsletter-msg error';
        if (err.message && err.message.indexOf('already subscribed') !== -1) {
          msg.textContent = 'Вы уже подписаны!';
        } else {
          msg.textContent = 'Ошибка: ' + (err.message || 'попробуйте позже');
        }
      }
    })
    .finally(function() {
      btn.disabled = false;
      btn.textContent = 'Подписаться';
    });

    return false;
  }

  // Attach to all newsletter forms on the page
  var forms = document.querySelectorAll('.newsletter-form');
  forms.forEach(function(form) {
    form.addEventListener('submit', handleNewsletter);
  });
})();
