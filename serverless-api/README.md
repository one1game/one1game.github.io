# One1Game API Worker

Этот Worker является серверной прослойкой для статического сайта GitHub Pages. Он предоставляет только три узких endpoint-а:

- `GET /health` — проверка доступности Worker;
- `POST /api/newsletter` — добавление подписчика в Buttondown;
- `GET /api/youtube-feed` — получение последних видео канала через YouTube Data API.

Приватные ключи не должны находиться в `worker.js`, `wrangler.jsonc`, фронтенд-коде, GitHub Actions YAML, логах или issue. Worker читает их только из Cloudflare Secrets через `env`.

До фактического деплоя Worker файл `api-config.js` намеренно содержит пустой `ONE1GAME_API_BASE`: newsletter показывает безопасное состояние «сервис временно недоступен», а YouTube использует публичный `youtube-feed-fallback.json`. Не подставляйте случайный или чужой endpoint.

## Первоначальная настройка

Требуется установленный Node.js и аккаунт Cloudflare с правом создания Worker.

```bash
npm install -g wrangler
wrangler login
cd serverless-api
wrangler secret put BUTTONDOWN_API_KEY
wrangler secret put YOUTUBE_API_KEY
wrangler deploy
```

Команды `wrangler secret put` запрашивают значение интерактивно. Не добавляйте значение ключа в аргументы команды и не сохраняйте его в истории shell.

После деплоя Wrangler выдаст URL вида `https://one1game-api.<account>.workers.dev`. Этот URL нужно указать в `api-config.js` сайта. Для production предпочтительнее привязать собственный поддомен, например `api.one1game.github.io` или `api.example.com`, если DNS-политика проекта это позволяет.

## Локальная разработка

```bash
copy .dev.vars.example .dev.vars
# В .dev.vars вручную вставить только новые тестовые секреты
wrangler dev
```

Файл `.dev.vars` уже добавлен в ignore-правила. Не используйте в локальной разработке старые ключи, которые ранее находились в публичном JavaScript; их нужно отозвать.

## Проверка endpoint-ов

Health endpoint должен отвечать без утечки конфигурации:

```bash
curl -i https://one1game-api.<account>.workers.dev/health \
  -H "Origin: https://one1game.github.io"
```

Preflight newsletter:

```bash
curl -i -X OPTIONS https://one1game-api.<account>.workers.dev/api/newsletter \
  -H "Origin: https://one1game.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

Тест newsletter в production не следует выполнять реальным email без необходимости: endpoint вызывает создание подписчика. Для полноценного теста используйте тестовый адрес и учитывайте double opt-in Buttondown.

YouTube feed:

```bash
curl -i https://one1game-api.<account>.workers.dev/api/youtube-feed \
  -H "Origin: https://one1game.github.io"
```

Ответ не должен содержать `YOUTUBE_API_KEY`, upstream JSON целиком или заголовки с секретами.

## Обязательные production-настройки

`ALLOWED_ORIGIN` сейчас ограничен `https://one1game.github.io`. Если появится custom domain, его нужно явно заменить в `wrangler.jsonc` и в клиентском `api-config.js`; не используйте `*`.

Нужно включить rate limiting для `/api/newsletter` и `/api/youtube-feed`, а для newsletter желательно добавить Cloudflare Turnstile. Даже при проверке Origin любой клиент может вручную отправить запрос, поэтому CORS не заменяет rate limit и антиспам.

## Ротация

Перед первым deploy отзовите старый Buttondown token и старый Google API key. Создайте новые значения, добавьте их через `wrangler secret put`, затем удалите старые credentials у поставщиков. Если секрет когда-либо попадал в Git, считайте его скомпрометированным даже после удаления строки из текущего файла.
