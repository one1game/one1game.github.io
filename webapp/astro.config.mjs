import { defineConfig } from 'astro/config';

// Проект собирается в /app и живёт рядом с основным сайтом на Cloudflare Pages.
// base обязателен: без него ассеты будут запрашиваться с корня и перекроют сайт.
export default defineConfig({
  site: 'https://one1game.org',
  base: '/app',
  outDir: './dist',
  trailingSlash: 'ignore',
  // Панель разработчика Astro внизу экрана не нужна: она путает с UI приложения.
  devToolbar: { enabled: false },
  build: {
    assets: '_assets',
    inlineStylesheets: 'auto',
  },
});
