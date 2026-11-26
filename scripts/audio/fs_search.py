#!/usr/bin/env python3
"""Search freesound.org for CC0 sounds. Usage: fs_search.py "query" [max_seconds] [min_seconds] [count]"""
import re, sys, html, urllib.parse, urllib.request
q = sys.argv[1]; mx = float(sys.argv[2]) if len(sys.argv) > 2 else 6; mn = float(sys.argv[3]) if len(sys.argv) > 3 else 0
n = int(sys.argv[4]) if len(sys.argv) > 4 else 8
f = f'license:"Creative Commons 0" duration:[{mn} TO {mx}]'
url = 'https://freesound.org/search/?' + urllib.parse.urlencode({'q': q, 'f': f, 's': 'Downloads (most first)'})
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36'})
h = urllib.request.urlopen(req, timeout=30).read().decode('utf8', 'replace')
print(f'## {q}')
for m in list(re.finditer(r'class="bw-player"(.*?)tabindex', h, re.S))[:n]:
    b = m.group(1); g = lambda k: html.unescape((re.search(k + r'="([^"]*)"', b) or [0, ''])[1])
    print(f"{g('data-sound-id'):>7} {g('data-user-id'):>9} {float(g('data-duration') or 0):6.2f}s dl{g('data-num-downloads'):>6}  {g('data-username')} | {g('data-title')}")
