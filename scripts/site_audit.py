#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
VERIFICATION = {'googlee56722acc2e581a3.html', 'yandex_f022bbd73d9b7625.html'}
SKIP_METADATA = {'stats.html', 'ot/index.html', 'game-ai/rpg/index.html'}
SECRET_PATTERNS = [
    re.compile(r'AIzaSy[A-Za-z0-9_-]{20,}'),
    re.compile(r'https://api\.buttondown\.email/v1/subscribers'),
    re.compile(r'Authorization\s*[:=].{0,40}Token\s+[A-Za-z0-9]'),
]

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.attrs = []
        self.ids = []
        self.title = ''
        self.in_title = False
        self.h1_count = 0
        self.lang = ''
        self.doctype = False
        self.description = None
        self.canonical = None
        self.links = []
        self.images = []

    def handle_decl(self, decl):
        if decl.lower().startswith('doctype html'):
            self.doctype = True

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        self.attrs.append((tag, data))
        if tag == 'html':
            self.lang = data.get('lang', '')
        if 'id' in data:
            self.ids.append(data['id'])
        if tag == 'title':
            self.in_title = True
        if tag == 'h1':
            self.h1_count += 1
        if tag == 'meta' and data.get('name', '').lower() == 'description':
            self.description = data.get('content', '')
        if tag == 'link' and data.get('rel', '').lower() == 'canonical':
            self.canonical = data.get('href', '')
        if tag == 'a' and data.get('href'):
            self.links.append(data['href'])
        if tag == 'img':
            self.images.append(data)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def iter_source_files():
    for path in ROOT.rglob('*'):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if any(part in {'.git', 'node_modules', '__pycache__'} for part in rel.parts):
            continue
        if rel.parts[:2] == ('ot', 'assets'):
            continue
        if rel.suffix.lower() in {'.html', '.js', '.css', '.json', '.jsonc', '.yml', '.yaml'}:
            yield path


def local_target(value, page):
    if not value or value.startswith(('#', 'data:', 'mailto:', 'tel:', 'javascript:', 'blob:')):
        return None
    parsed = urlparse(value)
    if parsed.scheme or parsed.netloc:
        return None
    raw = unquote(parsed.path)
    if raw.startswith('/'):
        target = ROOT / raw.lstrip('/')
    else:
        target = page.parent / raw
    if target.suffix == '' and not target.exists():
        target = target / 'index.html'
    return target

errors = []
warnings = []
html_count = 0

for path in sorted(ROOT.rglob('*.html')):
    rel = path.relative_to(ROOT).as_posix()
    if any(part in {'.git', 'node_modules'} for part in Path(rel).parts):
        continue
    html_count += 1
    text = path.read_text(encoding='utf-8', errors='replace')
    parser = PageParser()
    try:
        parser.feed(text)
    except Exception as exc:
        errors.append(f'{rel}: HTML parse error: {exc}')
        continue

    if not parser.doctype and Path(rel).name not in VERIFICATION:
        errors.append(f'{rel}: missing <!doctype html>')
    if not parser.lang and Path(rel).name not in VERIFICATION:
        errors.append(f'{rel}: missing html[lang]')
    if Path(rel).name not in VERIFICATION and not parser.title.strip():
        errors.append(f'{rel}: missing title')
    if rel not in SKIP_METADATA and Path(rel).name not in VERIFICATION:
        if not parser.description:
            warnings.append(f'{rel}: missing meta description')
        if not parser.canonical:
            warnings.append(f'{rel}: missing canonical')
    if parser.h1_count == 0 and rel not in SKIP_METADATA and Path(rel).name not in VERIFICATION:
        warnings.append(f'{rel}: missing H1')
    duplicate_ids = sorted({x for x in parser.ids if parser.ids.count(x) > 1})
    if duplicate_ids:
        errors.append(f'{rel}: duplicate ids: {", ".join(duplicate_ids)}')
    for image in parser.images:
        if 'alt' not in image:
            warnings.append(f'{rel}: image without alt: {image.get("src", "")[:100]}')
    for value in parser.links:
        target = local_target(value, path)
        if target is not None and not target.exists():
            errors.append(f'{rel}: broken local link: {value}')

for path in iter_source_files():
    text = path.read_text(encoding='utf-8', errors='replace')
    rel = path.relative_to(ROOT).as_posix()
    if 'var(--text-base)' in text:
        errors.append(f'{rel}: undefined CSS variable var(--text-base)')
    if re.search(r'K44"\s*/>|~8"\s*/>', text):
        errors.append(f'{rel}: malformed head fragment')
    for pattern in SECRET_PATTERNS:
        if not pattern.search(text) or path.name in {'site_audit.py'}:
            continue
        # Server-side upstream URLs are expected only in the Worker; credentials
        # and direct client calls are not allowed in public browser assets.
        if pattern.pattern.startswith('https://api\\.buttondown') and rel == 'serverless-api/worker.js':
            continue
        errors.append(f'{rel}: possible leaked credential or direct private API reference')
        break

print(f'HTML pages checked: {html_count}')
print(f'Errors: {len(errors)}')
print(f'Warnings: {len(warnings)}')
for item in errors:
    print(f'ERROR {item}')
for item in warnings:
    print(f'WARN {item}')

if errors:
    sys.exit(1)
