import re

# Путь к вашему файлу с данными
DATA_FILE = 'articles-data.js'
# Путь к итоговому sitemap
SITEMAP_FILE = 'sitemap.xml'
# Ваш домен
BASE_URL = 'https://one1game.github.io'

def generate():
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Ошибка: {DATA_FILE} не найден")
        return

    # Это "умное" регулярное выражение найдет URL, 
    # даже если слово url в кавычках или без них, и если используются ' или "
    # Оно ищет паттерны: "url": "...", url: "...", 'url': '...' и т.д.
    regex = r'["\']?url["\']?:\s*["\']([^"\']+)["\']'
    urls = re.findall(regex, content)

    if not urls:
        print("Статьи не найдены. Проверьте формат в articles-data.js")
        return

    # Собираем XML
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        f'  <url><loc>{BASE_URL}/</loc><priority>1.0</priority></url>',
        f'  <url><loc>{BASE_URL}/archive.html</loc><priority>0.8</priority></url>'
    ]

    for url in urls:
        # Убираем лишние слэши в начале, если они есть
        clean_path = url.lstrip('/')
        lines.append(f'  <url><loc>{BASE_URL}/{clean_path}</loc><priority>0.7</priority></url>')

    lines.append('</urlset>')

    with open(SITEMAP_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print(f"Готово! В sitemap добавлено страниц: {len(urls) + 2}")

if __name__ == "__main__":
    generate()
