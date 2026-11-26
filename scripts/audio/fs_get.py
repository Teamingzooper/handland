#!/usr/bin/env python3
"""Download freesound.org previews by sound id into build/audio-src and record title/author/licence.
Usage: fs_get.py id [id ...]   (ranges like 817536-817590 allowed). Skips anything that is not CC0."""
import re, sys, json, html, os, urllib.request
from concurrent.futures import ThreadPoolExecutor
D = os.path.join(os.path.dirname(__file__), '..', '..', 'build', 'audio-src'); os.makedirs(D, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36'}
MP = os.path.join(D, 'meta.json'); meta = json.load(open(MP)) if os.path.exists(MP) else {}
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60)
def one(i):
    i = str(i)
    if i in meta and os.path.exists(os.path.join(D, i + '.mp3')): return i, meta[i]
    try:
        r = get(f'https://freesound.org/s/{i}/'); url = r.geturl(); h = r.read().decode('utf8', 'replace')
        lic = re.search(r'creativecommons\.org/[a-z0-9/.\-]+', h); lic = lic.group(0) if lic else '?'
        b = re.search(r'class="bw-player"(.*?)tabindex', h, re.S).group(1)
        g = lambda k: html.unescape(re.search(k + r'="([^"]*)"', b).group(1))
        m = {'title': g('data-title'), 'user': g('data-username'), 'dur': float(g('data-duration')), 'url': url, 'licence': lic}
        if 'publicdomain/zero' not in lic: return i, {'skip': lic, **m}
        open(os.path.join(D, i + '.mp3'), 'wb').write(get(g('data-mp3').replace('-lq.', '-hq.')).read())
        return i, m
    except Exception as e: return i, {'skip': str(e)}
ids = []
for a in sys.argv[1:]:
    if '-' in a: x, y = a.split('-'); ids += range(int(x), int(y) + 1)
    else: ids.append(int(a))
with ThreadPoolExecutor(6) as ex:
    for i, m in ex.map(one, ids):
        if 'skip' in m: print('SKIP', i, m.get('title', ''), m['skip'])
        else: meta[i] = m; print(i, f"{m['dur']:.2f}s", m['user'], '|', m['title'])
json.dump(meta, open(MP, 'w'), indent=1)
