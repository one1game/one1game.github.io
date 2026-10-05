/* Список игр. Одна игра = один объект. Добавлять проще всего через admin.html */
window.GAMES = [
  {
    slug: "utki",
    title: "Утки",
    desc: "Пали по уткам, не дай им обкакать пушку: очки, уровни, растущая сложность.",
    url: "games/utki/",
    cover: "🦆",
    bg: "#050810",
    tags: ["аркада", "шутер"],
    colors: ["#f7b733", "#fc4a1a"],
    date: "2026-09-17",
    pinned: true
  },
  {
    slug: "fishing",
    title: "Рыбалка",
    desc: "Забрось удочку, следи за едой и водой, готовь улов и набивай инвентарь.",
    url: "games/fishing/",
    cover: "🎣",
    bg: "#87CEEB",
    tags: ["симулятор", "рыбалка"],
    colors: ["#38bdf8", "#0ea5e9"],
    date: "2026-09-17",
    pinned: false
  }
];
