import re, json
from pathlib import Path

root = Path(".")
missing = []
data = Path("articles-data.js").read_text(encoding="utf-8")
# extract image paths
for m in re.finditer(r'"image":\s*"(/[^"]+)"', data):
    p = m.group(1)
    f = root / p.lstrip("/")
    if not f.exists():
        missing.append(p)

print("Всего карточек:", len(re.findall(r'"url":', data)))
if missing:
    print("БИТЫЕ КАРТИНКИ В КАРТОЧКАХ:")
    for x in missing:
        print("  ", x)
else:
    print("Все картинки карточек на месте ✓")

# Проверка картинок в самих статьях (img src)
print("\n--- Проверка статей ---")
broken_articles = []
for f in sorted(Path("archive").glob("*.html")):
    c = f.read_text(encoding="utf-8")
    for m in re.finditer(r'(?:src|href)="(\.\./img/[^"]+)"', c):
        rel = m.group(1)
        # relative to archive/ → root
        target = (Path("archive") / rel).resolve()
        if not target.exists():
            broken_articles.append((f.name, rel))
    # absolute /img/ paths
    for m in re.finditer(r'(?:src|href)="(/img/[^"]+)"', c):
        p = m.group(1)
        target = root / p.lstrip("/")
        if not target.exists():
            broken_articles.append((f.name, p))

if broken_articles:
    print("БИТЫЕ КАРТИНКИ В СТАТЬЯХ:")
    seen = set()
    for fn, img in broken_articles:
        key = (fn, img)
        if key not in seen:
            seen.add(key)
            print(f"  {fn}: {img}")
else:
    print("Все картинки в статьях на месте ✓")
