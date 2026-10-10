#!/usr/bin/env python3
"""OG-картинки 1200x630 для страниц статей и фильмов.

Зачем: одна общая og-image не даёт клика в соцсетях и Discover, а у уникальной
карточки с названием CTR заметно выше. Берём обложку страницы, добавляем
название и бренд — получается готовая карточка.

Правила:
  * обрабатываем только страницы, у которых og:image внешний (Steam/TMDB) или site-og.png;
  * если у статьи своя картинка в /img/... (загружена вручную) — не трогаем;
  * картинки кладём в img/og/<slug>.jpg и прописываем в og:image/twitter:image.

Запуск: python scripts/make_og.py --limit 40
"""
import argparse
import io
import os
import re
import sys
import urllib.request
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    sys.exit("Нужен Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "img" / "og"
W, H = 1200, 630
PAD = 60
COVER_W = 540  # правая часть под обложку

FONTS = [
    os.environ.get("OG_FONT", ""),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/arial.ttf",
]


def load_font(size):
    for path in FONTS:
        if path and Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def fetch_image(url):
    """Скачивает картинку-обложку. Возвращает Image или None."""
    if not url or not url.startswith("http"):
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "One1GameBot/1.0"})
        with urllib.request.urlopen(req, timeout=25) as resp:
            return Image.open(io.BytesIO(resp.read())).convert("RGB")
    except Exception as err:
        print(f"    обложка недоступна: {err}")
        return None


def cover_crop(img, w, h):
    """Вписывает картинку в размер w×h без искажений (crop по центру)."""
    src_ratio = img.width / img.height
    dst_ratio = w / h
    if src_ratio > dst_ratio:
        new_h = h
        new_w = int(h * src_ratio)
    else:
        new_w = w
        new_h = int(w / src_ratio)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - w) // 2
    top = (new_h - h) // 2
    return img.crop((left, top, left + w, top + h))


def wrap(text, font, max_width, draw, max_lines=5):
    words = str(text or "").split()
    lines, cur = [], ""
    for word in words:
        probe = (cur + " " + word).strip()
        if draw.textlength(probe, font=font) <= max_width or not cur:
            cur = probe
        else:
            lines.append(cur)
            cur = word
        if len(lines) >= max_lines:
            break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    return lines


def render_card(title, cover_url, out_path):
    bg = Image.new("RGB", (W, H), (11, 18, 32))
    draw = ImageDraw.Draw(bg)

    # Лёгкий градиент сверху вниз
    for y in range(H):
        k = y / H
        draw.line(
            [(0, y), (W, y)],
            fill=(int(15 - 6 * k), int(22 - 9 * k), int(38 - 16 * k)),
        )

    # Текст рисуем на «чистом» фоне, обложку подмешиваем последней,
    # чтобы переход из фона в картинку был без видимого шва.
    draw.rectangle([0, 0, 8, H], fill=(45, 127, 249))  # акцентная полоса слева
    brand_font = load_font(34)
    draw.text((PAD, 52), "ONE1GAME", font=brand_font, fill=(126, 231, 135))

    text_w = W - COVER_W - PAD * 2 + 40
    title_font = load_font(64)
    lines = wrap(title, title_font, text_w, draw, max_lines=5)
    y = 168
    for line in lines:
        draw.text((PAD, y), line, font=title_font, fill=(233, 240, 248))
        y += 78

    foot_font = load_font(28)
    draw.text((PAD, H - 74), "one1game.org", font=foot_font, fill=(159, 176, 199))

    # Обложка справа с плавным входом в фон
    cover = fetch_image(cover_url)
    if cover:
        fitted = cover_crop(cover, COVER_W, H)
        fade = 150
        for x in range(COVER_W):
            col = fitted.crop((x, 0, x + 1, H))
            if x < fade:
                base_col = bg.crop((W - COVER_W + x, 0, W - COVER_W + x + 1, H))
                col = Image.blend(base_col, col, x / fade)
            bg.paste(col, (W - COVER_W + x, 0))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    bg.save(out_path, "JPEG", quality=82, optimize=True, progressive=True)
    return out_path


def parse_entries():
    """Возвращает [(url, title, image)] из articles-data.js."""
    text = (ROOT / "articles-data.js").read_text(encoding="utf-8", errors="ignore")
    entries = []
    for block in re.findall(r"\{[^{}]*\}", text, re.DOTALL):
        m_url = re.search(r'"url"\s*:\s*"([^"]+)"', block)
        if not m_url:
            continue
        m_title = re.search(r'"title"\s*:\s*"([^"]*)"', block)
        m_img = re.search(r'"image"\s*:\s*"([^"]*)"', block)
        entries.append((m_url.group(1), m_title.group(1) if m_title else "",
                        m_img.group(1) if m_img else ""))
    return entries


def current_og(path):
    try:
        html = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return None, ""
    m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
    return (m.group(1) if m else None), html


def should_skip(og_url):
    """Чужую (внешнюю) и общую картинки заменяем, ручную /img/... — нет."""
    if not og_url:
        return True
    if "/img/" in og_url and "/img/og/" not in og_url:
        return True
    return False


def set_meta(html, new_url):
    html = re.sub(r'(<meta property="og:image" content=")[^"]*(")',
                  lambda m: m.group(1) + new_url + m.group(2), html)
    html = re.sub(r'(<meta name="twitter:image" content=")[^"]*(")',
                  lambda m: m.group(1) + new_url + m.group(2), html)
    return html


def process_kino(limit, only_missing):
    """Страницы фильмов: сейчас у всех общая site-og.png — делаем свою карточку."""
    kino = ROOT / "kino"
    done = 0
    for page in sorted(kino.glob("*.html")):
        if done >= limit:
            break
        if page.name == "index.html":
            continue
        try:
            html = page.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        m_og = re.search(r'<meta property="og:image" content="([^"]+)"', html)
        og_url = m_og.group(1) if m_og else ""
        if should_skip(og_url):
            continue
        slug = page.stem
        out = OUT_DIR / f"{slug}.jpg"
        if only_missing and out.exists():
            continue
        m_title = re.search(r'<meta property="og:title" content="([^"]+)"', html) \
            or re.search(r"<title>([^<]+)</title>", html)
        title = (m_title.group(1) if m_title else slug).split(" — ")[0].split(" | ")[0]
        m_poster = re.search(r'https://image\.tmdb\.org/[^"\s]+', html)
        try:
            render_card(title, m_poster.group(0) if m_poster else "", out)
        except Exception as err:
            print(f"  [ошибка] {slug}: {err}")
            continue
        new_url = f"https://one1game.org/img/og/{slug}.jpg"
        if new_url not in html:
            page.write_text(set_meta(html, new_url), encoding="utf-8", newline="\n")
        done += 1
        print(f"  [ок] kino/{slug}")
    return done


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=40, help="сколько карточек собрать за прогон")
    ap.add_argument("--only-missing", action="store_true", help="пропускать уже готовые")
    ap.add_argument("--only", default="", help="собрать карточку только для этого slug")
    args = ap.parse_args()

    done = 0
    for url, title, image in parse_entries():
        if done >= args.limit:
            break
        if url.startswith("/kino/"):
            continue
        page = ROOT / url.lstrip("/")
        if not page.exists():
            continue
        if args.only and page.stem != args.only:
            continue
        og_url, html = current_og(page)
        if should_skip(og_url):
            continue
        slug = page.stem
        out = OUT_DIR / f"{slug}.jpg"
        if args.only_missing and out.exists():
            continue
        try:
            render_card(title, image, out)
        except Exception as err:
            print(f"  [ошибка] {slug}: {err}")
            continue
        new_url = f"https://one1game.org/img/og/{slug}.jpg"
        if new_url not in html:
            page.write_text(set_meta(html, new_url), encoding="utf-8", newline="\n")
        done += 1
        print(f"  [ок] {slug}")

    kino_done = 0 if args.only else process_kino(args.limit, args.only_missing)
    print(f"Готово: собрано карточек — {done} (статьи) + {kino_done} (кино)")


if __name__ == "__main__":
    main()
