#!/usr/bin/env python3
"""Cut the downloaded CC0 recordings (build/audio-src, fetched by fs_get.py) into the game's sound files in public/audio.
Every sound in the game is a recording made by someone else and released as CC0 on freesound.org; nothing is synthesised.
Run:  python3 scripts/audio/build_audio.py"""
import json, os, subprocess, shutil
R = os.path.join(os.path.dirname(__file__), '..', '..'); SRC = f'{R}/build/audio-src'; OUT = f'{R}/public/audio'
meta = json.load(open(f'{SRC}/meta.json')); used = {}
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
def ff(*a): subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)

# name: (freesound id, start, end, fade-out seconds).  end None = to the end of the file.
SFX = {}
def group(name, first, n): SFX.update({f'{name}{k}': (first + k, 0, None, 0.02) for k in range(n)})
group('tick', 817581, 7); group('pick', 817546, 6); group('slide', 817575, 6); group('drop', 817539, 6)
group('shuffle', 817569, 6); group('chip', 817552, 5); group('clatter', 817557, 4)
SFX.update({
    'flip0': (84322, 0.30, 0.76, 0.05), 'flip1': (82379, 0, 0.30, 0.05), 'flip2': (19244, 0.12, 0.38, 0.04),
    'slap': (147532, 0, None, 0.02), 'thud': (198960, 0, None, 0.03), 'glassdown': (454222, 0, 0.30, 0.06),
    'click': (256116, 0, None, 0.01), 'blip': (146721, 0, None, 0.02), 'switch': (448394, 0.52, 0.72, 0.04),
    'knock': (63535, 0, None, 0.03),
    'bell': (685111, 0.78, 2.40, 0.5), 'ding': (879808, 0, 1.30, 0.5), 'typeding': (406243, 0, 0.80, 0.25),
    'stamp': (470710, 0.46, 0.92, 0.12),
    'gavel0': (173941, 0.20, 0.62, 0.15), 'gavel1': (173941, 1.16, 1.62, 0.15), 'gavel2': (173941, 2.26, 2.80, 0.2),
    'slam': (787456, 0.06, 0.52, 0.1), 'deskslam': (718357, 0.20, 0.66, 0.12),
    'gasp': (324898, 0.80, 3.00, 0.5), 'ooh': (870651, 0.50, 2.55, 0.35), 'aww': (124996, 0.08, 2.00, 0.3), 'aww2': (547589, 0.08, 1.06, 0.15),
    'applause': (462362, 0, 3.60, 1.2), 'cheer': (333404, 0.08, 3.80, 1.0), 'yay': (393402, 0.20, 1.30, 0.3),
    'hit': (367668, 0.44, 1.60, 0.4), 'scratch': (71853, 0, None, 0.04),
    'glass': (244238, 0.16, 1.45, 0.3), 'bottle': (212698, 0.46, 1.40, 0.4),
    'crack': (183453, 0.04, 0.42, 0.1),
    'coins': (17502, 0.24, 2.05, 0.3), 'coin': (343462, 0, None, 0.02),
    'register': (209578, 0.06, 1.10, 0.2), 'chips': (532861, 0.08, 0.70, 0.1), 'chipdrop': (540369, 0, None, 0.08),
    'shutter': (170229, 0, None, 0.03), 'paper': (353125, 0.24, 1.00, 0.15),
    'match': (524306, 0.04, 1.30, 0.3), 'fire': (260554, 0.04, 1.30, 0.5),
    'siren': (536773, 0.04, 0.74, 0.12), 'cuffs': (411696, 0, None, 0.03),
    'vault': (445099, 0.10, 1.00, 0.15), 'unlock': (448393, 0.38, 0.72, 0.06),
    'heart': (22416, 0, 1.70, 0.1), 'clock': (534094, 0, 0.16, 0.05),
    'fanfare': (456966, 0, 3.10, 0.4), 'trombone': (175409, 0.20, 4.70, 0.3),
    'whoosh': (60013, 0, 0.32, 0.08),
    'whistle': (817398, 0.04, 1.45, 0.12), 'snatch': (444416, 0, None, 0.05), 'snatch2': (444432, 0.14, 0.40, 0.06),
})
for name, (i, a, b, fo) in SFX.items():
    i = str(i); used[i] = meta[i]; b = b if b is not None else meta[i]['dur']
    d = max(b - a, 0.03); fo = min(fo, d / 2)
    # cut, short fades so nothing clicks, then bring the peak to just under full scale
    tmp = f'{OUT}/_t.wav'
    ff('-ss', str(a), '-t', str(d), '-i', f'{SRC}/{i}.mp3', '-ac', '1', '-ar', '44100',
       '-af', f'afade=t=in:d=0.004,afade=t=out:st={d - fo}:d={fo}', tmp)
    pk = subprocess.run(['ffmpeg', '-i', tmp, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    mx = float(pk.split('max_volume:')[1].split('dB')[0])
    ff('-i', tmp, '-af', f'volume={-1.0 - mx}dB', '-c:a', 'pcm_s16le', f'{OUT}/{name}.wav'); os.remove(tmp)

# Music: real recorded/produced tracks, evened out to the same loudness. (id, times to repeat)
MUSIC = [('speakeasy', 592587, 0), ('jazzloop', 261100, 0), ('rustedmaid', 464923, 2), ('bluesimpro', 162184, 0), ('smoothkeys', 681097, 2)]
for name, i, rep in MUSIC:
    i = str(i); used[i] = meta[i]
    ff(*(['-stream_loop', str(rep)] if rep else []), '-i', f'{SRC}/{i}.mp3', '-ac', '2', '-ar', '44100',
       '-af', 'loudnorm=I=-19:TP=-2:LRA=11', '-c:a', 'libmp3lame', '-b:a', '160k', f'{OUT}/music_{name}.mp3')
# Room ambience: bar chatter, with its tail cross-faded into its head so the loop has no seam.
i = '243373'; used[i] = meta[i]; d = meta[i]['dur'] - 0.5; x = 4
ff('-i', f'{SRC}/{i}.mp3', '-filter_complex',
   f'[0]atrim=0.2:{d},asetpts=N/SR/TB,loudnorm=I=-24:TP=-3,asplit[a][b];[a]atrim={x}:{d - 0.2 - x},asetpts=N/SR/TB[body];'
   f'[b]asplit[c][e];[c]atrim={d - 0.2 - x}:{d - 0.2},asetpts=N/SR/TB[tail];[e]atrim=0:{x},asetpts=N/SR/TB[head];'
   f'[tail][head]acrossfade=d={x}:c1=tri:c2=tri[seam];[seam][body]concat=n=2:v=0:a=1',
   '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', f'{OUT}/_room.wav')
ff('-i', f'{OUT}/_room.wav', '-c:a', 'libmp3lame', '-b:a', '112k', f'{OUT}/room.mp3'); os.remove(f'{OUT}/_room.wav')

with open(f'{OUT}/CREDITS.md', 'w') as f:
    f.write('# Sound credits\n\nEvery sound and music track in Handland is a recording shared on freesound.org under\n'
            'Creative Commons 0 (public domain dedication). Thank you to the people who recorded them.\n\n')
    for i, m in sorted(used.items(), key=lambda kv: (kv[1]['user'].lower(), kv[1]['title'].lower())):
        f.write(f"- {m['user']} — \"{m['title']}\" — {m['url']}\n")
print(len(SFX), 'sfx,', len(MUSIC), 'music tracks,', len(used), 'source recordings')
