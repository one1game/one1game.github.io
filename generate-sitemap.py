import re

# Читаем данные из вашего файла со статьями
try:
    with open('articles-data.js', 'r', encoding='utf-8') as f:
        content = f.read()
except FileNotFoundError:
    print("Файл articles-data.js не найден!")
    exit(1)

# Ищем все ссылки (поддерживаем оба формата записи в JS)
urls = re.findall(r'url:\s*["\']([^"\']+)["\']', content)

# Формируем XML
xml_content = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url><loc>https://one1game.github.io/</loc><priority>1.0</priority></url>',
    '  <url><loc>https://one1game.github.io/archive.html</loc><priority>0.8</priority></url>'
]

for url in urls:
    # Очищаем ссылку от начального слэша, чтобы не было двойного //
    clean_url = url.lstrip('/')
    xml_content.append(f'  <url><loc>https://one1game.github.io/{clean_url}</loc><priority>0.7</priority></url>')

xml_content.append('</urlset>')

# Записываем поверх вашего пустого sitemap.xml
with open('sitemap.xml', 'w', encoding='utf-8') as f:
    f.write('\n'.join(xml_content))

print("Sitemap успешно обновлен!")