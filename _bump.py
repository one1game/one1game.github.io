import glob, io
files = glob.glob('*.html') + glob.glob('archive/*.html')
pre = '<link rel="preload" href="../styles.css" as="style" />\n  '
for f in files:
    s = io.open(f, encoding='utf-8').read()
    t = s.replace('script.js?v=11', 'script.js?v=12').replace('styles.css?v=10', 'styles.css?v=11')
    t = t.replace(pre, '')
    if t != s:
        io.open(f, 'w', encoding='utf-8', newline='').write(t)
        print('updated:', f)
print('done')
