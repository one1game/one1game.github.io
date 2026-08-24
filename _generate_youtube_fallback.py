from pathlib import Path
from urllib.request import urlopen
from xml.etree import ElementTree
import json

CHANNEL_ID = 'UChR3kvItnDlJ8vn2_sBmTiQ'
URL = f'https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}'
NS = {
    'yt': 'http://www.youtube.com/xml/schemas/2015',
    'media': 'http://search.yahoo.com/mrss/',
}

with urlopen(URL, timeout=20) as response:
    root = ElementTree.fromstring(response.read())

items = []
for entry in root.findall('{http://www.w3.org/2005/Atom}entry')[:6]:
    video_id = entry.findtext('yt:videoId', default='', namespaces=NS)
    title = entry.findtext('{http://www.w3.org/2005/Atom}title', default='')
    published = entry.findtext('{http://www.w3.org/2005/Atom}published', default='')
    group = entry.find('media:group', NS)
    thumbnail = ''
    if group is not None:
        thumb = group.find('media:thumbnail', NS)
        if thumb is not None:
            thumbnail = thumb.attrib.get('url', '')
    if video_id and title and thumbnail:
        items.append({
            'videoId': video_id,
            'title': title,
            'publishedAt': published,
            'thumbnail': thumbnail,
        })

Path('youtube-feed-fallback.json').write_text(json.dumps({'ok': True, 'items': items}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(f'Wrote {len(items)} fallback videos')
