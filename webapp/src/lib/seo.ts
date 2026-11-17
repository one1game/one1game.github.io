/** Длина title, которую поисковики показывают без обрезки. */
const TITLE_MAX = 68;

function cut(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const slice = text.slice(0, limit - 1);
  const at = slice.lastIndexOf(' ');
  const base = at > limit * 0.55 ? slice.slice(0, at) : slice;
  return `${base.replace(/[\s.,;:—–-]+$/, '')}…`;
}

/**
 * Собирает title в пределах TITLE_MAX: сначала пробует с брендом,
 * а если места мало — оставляет только заголовок без суффикса.
 */
export function fitTitle(main: string, suffix = ' — One1Game', max = TITLE_MAX): string {
  const clean = String(main || '').replace(/\s+/g, ' ').trim();
  if (!clean) return suffix.replace(/^ — /, '');
  const full = `${clean}${suffix}`;
  if (full.length <= max) return full;
  const room = max - suffix.length;
  if (room >= 34) return `${cut(clean, room)}${suffix}`;
  return cut(clean, max);
}
