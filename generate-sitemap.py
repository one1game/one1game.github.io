import re

# Читаем ваш файл с данными
with open('articles-data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Ищем все ссылки в поле "url"
urls = re.findall(r'"url":\s*"([^"]+)"', content)
urls += re.findall(r'url:\s*"([^"]+)"', content)

# Начало XML
sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
sitemap += '  <url><loc>https://one1game.github.io/</loc><priority>1.0</priority></url>\n'
sitemap += '  <url><loc>https://one1game.github.io/archive.html</loc><priority>0.8</priority></url>\n'

# Добавляем статьи
for url in urls:
    # Убираем лишний слэш в начале, если он есть
    clean_url = url.lstrip('/')
    sitemap += f'  <url><loc>https://one1game.github.io/{clean_url}</loc><priority>0.7</priority></url>\n'

sitemap += '</urlset>'

# Сохраняем результат
with open('sitemap.xml', 'w', encoding='utf-8') as f:
    f.write(sitemap)