import "./shims/globals.mjs";

import _ from "underscore";
import worldMap from "./game/server/maps/world_server.json";
import WorldServer from "./game/server/js/worldserver.js";
import Player from "./game/server/js/player.js";

// Минимальная реализация интерфейса websocket-сервера, который ожидает
// оригинальный WorldServer из BrowserQuest.
class ServerShim {
  constructor() {
    this._connections = {};
  }

  onConnect(callback) {
    this.connection_callback = callback;
  }

  onError(callback) {
    this.error_callback = callback;
  }

  broadcast(message) {
    _.each(this._connections, (connection) => connection.send(message));
  }

  forEachConnection(callback) {
    _.each(this._connections, callback);
  }

  addConnection(connection) {
    this._connections[connection.id] = connection;
  }

  removeConnection(id) {
    delete this._connections[id];
  }

  getConnection(id) {
    return this._connections[id];
  }
}

// Адаптер Cloudflare WebSocket под интерфейс Connection из server/js/ws.js.
class ConnectionShim {
  constructor(id, ws, server) {
    this.id = id;
    this.ws = ws;
    this._server = server;
    this.remoteAddress = "cloudflare";
    this._closed = false;

    ws.addEventListener("message", (event) => {
      if (!this.listen_callback) return;
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (e) {
        this.close("Received message was not valid JSON.");
        return;
      }
      try {
        this.listen_callback(message);
      } catch (e) {
        // Не маскируем ошибку игры под «невалидный JSON».
        console.error("BrowserQuest handler error:", e && e.stack ? e.stack : e);
        this.close("Handler error: " + String((e && e.message) || e).slice(0, 100));
      }
    });

    ws.addEventListener("close", () => this.handleClose());
    ws.addEventListener("error", () => this.handleClose());
  }

  handleClose() {
    if (this._closed) return;
    this._closed = true;
    if (this.close_callback) this.close_callback();
    this._server.removeConnection(this.id);
  }

  onClose(callback) {
    this.close_callback = callback;
  }

  listen(callback) {
    this.listen_callback = callback;
  }

  send(message) {
    this.sendUTF8(JSON.stringify(message));
  }

  sendUTF8(data) {
    if (this.ws.readyState === 1) {
      this.ws.send(data);
    }
  }

  close(reason) {
    try {
      this.ws.close(1000, String(reason || "").slice(0, 120));
    } catch (e) {
      // Соединение уже закрыто.
    }
    this.handleClose();
  }
}

export class WorldDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.server = new ServerShim();
    this.world = null;
    this.counter = 0;
  }

  ensureWorld() {
    if (this.world) return;

    const world = new WorldServer("world1", 200, this.server);
    world.run(worldMap);
    this.world = world;

    this.server.onConnect((connection) => {
      const player = new Player(connection, world);
      world.connect_callback(player);
    });
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("BrowserQuest: connect via WebSocket at /ws", {
        status: 426,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    this.ensureWorld();

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const id = String(500000 + this.counter++);
    const connection = new ConnectionShim(id, server, this.server);

    this.server.addConnection(connection);
    if (this.server.connection_callback) {
      this.server.connection_callback(connection);
    }

    return new Response(null, { status: 101, webSocket: client });
  }
}
