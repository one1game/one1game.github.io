import glob, io
files = glob.glob('*.html') + glob.glob('archive/*.html') + glob.glob('инструкция/*.html')
pats = [
    '<link rel="preload" href="styles.css" as="style" />',
    '<link rel="preload" href="../styles.css" as="style" />',
    '<link rel="preload" href="../styles.css" as="style" fetchpriority="high" />',
    '<link rel="preload" href="/styles.css?v=11" as="style" />',
]
for f in files:
    s = io.open(f, encoding='utf-8').read()
    t = s
    for p in pats:
        t = t.replace(p + '\n', '')
        t = t.replace(p, '')
    t = t.replace('styles.css?v=11', 'styles.css?v=12')
    t = t.replace('script.js?v=12', 'script.js?v=13')
    if t != s:
        io.open(f, 'w', encoding='utf-8', newline='').write(t)
print('done')
