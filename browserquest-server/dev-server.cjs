// Локальный игровой сервер BrowserQuest (Node.js + ws).
// Нужен только для разработки: в продакшене используется Worker + Durable Object.
// Запуск: node dev-server.cjs

const http = require("http");
const { WebSocketServer } = require("ws");

globalThis.log = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  debug: () => {},
};

const worldMap = require("./src/game/server/maps/world_server.json");
const WorldServer = require("./src/game/server/js/worldserver.js");
const Player = require("./src/game/server/js/player.js");

class ServerShim {
  constructor() {
    this._connections = {};
  }
  onConnect(cb) {
    this.connection_callback = cb;
  }
  onError(cb) {
    this.error_callback = cb;
  }
  broadcast(message) {
    for (const id in this._connections) this._connections[id].send(message);
  }
  forEachConnection(cb) {
    for (const id in this._connections) cb(this._connections[id]);
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

class ConnectionShim {
  constructor(id, ws, server) {
    this.id = id;
    this.ws = ws;
    this._server = server;
    this.remoteAddress = "local";
    this._closed = false;

    ws.on("message", (data) => {
      if (!this.listen_callback) return;
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (e) {
        this.close("Received message was not valid JSON.");
        return;
      }
      try {
        this.listen_callback(message);
      } catch (e) {
        // Не маскируем ошибку игры под «невалидный JSON»: без этого
        // любой баг в обработчике выглядел как потеря соединения.
        console.error("BrowserQuest handler error:", e);
        this.close("Internal server error.");
      }
    });
    ws.on("close", () => this.handleClose());
    ws.on("error", () => this.handleClose());
  }
  handleClose() {
    if (this._closed) return;
    this._closed = true;
    if (this.close_callback) this.close_callback();
    this._server.removeConnection(this.id);
  }
  onClose(cb) {
    this.close_callback = cb;
  }
  listen(cb) {
    this.listen_callback = cb;
  }
  send(message) {
    this.sendUTF8(JSON.stringify(message));
  }
  sendUTF8(data) {
    if (this.ws.readyState === 1) this.ws.send(data);
  }
  close(reason) {
    try {
      this.ws.close(1000, String(reason || "").slice(0, 120));
    } catch (e) {
      // ignore
    }
    this.handleClose();
  }
}

const server = new ServerShim();
const world = new WorldServer("world1", 200, server);
world.run(worldMap);

server.onConnect((connection) => {
  world.connect_callback(new Player(connection, world));
});

let counter = 0;
const httpServer = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }
  res.writeHead(426, { "content-type": "text/plain; charset=utf-8" });
  res.end("BrowserQuest: connect via WebSocket at /ws");
});

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
wss.on("connection", (ws) => {
  const connection = new ConnectionShim(String(500000 + counter++), ws, server);
  server.addConnection(connection);
  if (server.connection_callback) server.connection_callback(connection);
});

const port = Number(process.env.PORT || 8787);
httpServer.listen(port, "127.0.0.1", () => {
  console.log(`BrowserQuest local server: ws://127.0.0.1:${port}/ws`);
});
