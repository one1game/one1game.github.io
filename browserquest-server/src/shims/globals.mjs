// Общие глобальные зависимости игрового сервера BrowserQuest.
// Оригинальный сервер рассчитывал на глобальный log из npm-пакета.
globalThis.log = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  debug: () => {},
};
