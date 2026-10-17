// Адрес игрового сервера BrowserQuest (Cloudflare Worker + Durable Object).
// Локальная разработка: ws://127.0.0.1:8787/ws
// Продакшен: https://one1game-browserquest.igoralx9119.workers.dev
window.BQ_WS_URL = (location.protocol === "https:")
  ? "wss://one1game-browserquest.igoralx9119.workers.dev/ws"
  : "ws://127.0.0.1:8787/ws";
