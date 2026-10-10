// Cloudflare Pages Function (middleware).
// Задача: www.one1game.org → one1game.org (301, с сохранением пути и query).
//
// Почему так, а не через _redirects/Redirect Rule:
//   * Pages `_redirects` не умеет редирект по хосту (source — только путь);
//   * Redirect Rule на уровне зоны требует прав токена (Zone → Config → Edit), которых нет.
// Функция ловит только www, для остальных хостов пропускает запрос дальше.

export function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'www.one1game.org') {
    return Response.redirect('https://one1game.org' + url.pathname + url.search, 301);
  }
  return context.next();
}
