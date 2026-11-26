#!/usr/bin/env python3
"""Describe downloaded clips without listening: length, loud regions, brightness. Usage: probe.py id [id ...]"""
import sys, json, subprocess, os
import numpy as np
D = os.path.join(os.path.dirname(__file__), '..', '..', 'build', 'audio-src'); meta = json.load(open(D + '/meta.json'))
def pcm(p, sr=22050):
    r = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32), sr
for i in sys.argv[1:]:
    x, sr = pcm(f'{D}/{i}.mp3'); n = int(sr * 0.02); k = len(x) // n
    if not k: print(i, 'empty'); continue
    e = np.sqrt((x[:k * n].reshape(k, n) ** 2).mean(1)); pk = np.abs(x).max(); th = max(e.max() * 0.08, 1e-4)
    on = e > th; segs = []; s = None; gap = 0
    for j, v in enumerate(on):
        if v:
            if s is None: s = j
            gap = 0
        elif s is not None:
            gap += 1
            if gap > 6: segs.append((s, j - gap + 1)); s = None
    if s is not None: segs.append((s, k))
    X = np.abs(np.fft.rfft(x[:min(len(x), sr * 4)])); f = np.fft.rfftfreq(min(len(x), sr * 4), 1 / sr); cen = (X * f).sum() / max(X.sum(), 1e-9)
    ss = ' '.join(f'{a*.02:.2f}-{b*.02:.2f}' for a, b in segs[:10]) + (f' +{len(segs)-10}' if len(segs) > 10 else '')
    print(f"{i:>7} {len(x)/sr:6.2f}s pk{pk:.2f} rms{e.mean():.3f} cen{cen:5.0f}Hz | {meta[i]['title'][:38]:38} | {ss}")
