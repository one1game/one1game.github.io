import { WorldDO } from "./world-do.mjs";

export { WorldDO };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (url.pathname !== "/ws" && url.pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("BrowserQuest server. WebSocket endpoint: /ws", {
        status: 426,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    // Один постоянный мир на весь сайт.
    const id = env.WORLD.idFromName("main");
    return env.WORLD.get(id).fetch(request);
  },
};
