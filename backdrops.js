// Backdrops: the scenery around the table, built like a stage set.
//
// Each backdrop is a stack of flat layers at different distances. When the camera leans (fx.js publishes the lean
// as --camx / --camy on #room) far layers slide more than near ones, which is what makes the room feel deep.
// Things inside a layer move on their own: every moving thing is its own small picture (a "sprite"), so the
// browser can slide it around without redrawing anything.
//
// All coordinates are in one 1000 x 160 drawing. The bottom edge is where the wall meets the floor and x = 500 is
// straight ahead. In a normal window only a low strip is in view: about x 250–750, y 82–142 on the wall, and
// y 52–126 on the layer that stands in front of it (the table hides its feet). The rest shows on wide or tall
// screens and while the camera swoops in. So the action is drawn inside that strip.
//
// A set is { base, layers, front }: `base` is only used for the small shop picture (in the room the wall's own
// colours do that job), `layers` sit on the wall from far to near, `front` stands on the floor in front of the wall.

const O = '#14121f'; // the ink every outline is drawn in
const PAPER = '#f7eed6';
const ink = (inner, w = 2.2) => `<g stroke="${O}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`;
// A line drawn twice: a dark one underneath, the colour on top. Ropes, stalks, pipes.
const stroke2 = (d, c, w, o = 3) => `<path d="${d}" stroke="${O}" stroke-width="${w + o}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const rnd = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647; // the same "random" picture every time
const star = (cx, cy, n, r0, r1, attrs = '') => {
  let d = '';
  for (let i = 0; i < n * 2; i++) { const a = (Math.PI * i) / n - Math.PI / 2, r = i % 2 ? r1 : r0; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`; }
  return `<path d="${d}Z" ${attrs}/>`;
};
// A sprite: a picture w x h placed at x, y, with its own motion. `fx` marks things that only make sense while moving.
const S = (x, y, w, h, art, anim = '', vars = '', cls = '') => ({ x, y, w, h, art, anim, vars, cls });
const sparkle = (c = '#ffffff') => star(5, 5, 4, 5, 1.3, `fill="${c}"`);

// ---------- Under the Sea ----------
const kelp = (h, c, w = 5.5, leaf = true) => { // a wavy stalk rooted at the bottom middle of a 30 x h box
  const n = Math.max(2, Math.round(h / 24)), seg = h / n;
  let d = `M15 ${h}`, leaves = '';
  for (let i = 0; i < n; i++) {
    const y0 = h - seg * i, y1 = y0 - seg, s = i % 2 ? 8 : -8, ym = (y0 + y1) / 2;
    d += ` Q${15 + s} ${ym.toFixed(1)} 15 ${y1.toFixed(1)}`;
    if (leaf && i < n - 1) leaves += `<path d="M${15 + s * 0.5} ${ym.toFixed(1)} q${s * 1.5} ${(-seg * 0.1).toFixed(1)} ${s * 1.8} ${(-seg * 0.6).toFixed(1)} q${-s * 1.5} ${(seg * 0.05).toFixed(1)} ${-s * 1.8} ${(seg * 0.6).toFixed(1)}Z" fill="${c}"/>`;
  }
  return `${leaves ? ink(leaves, 1.6) : ''}${stroke2(d, c, w, 3)}`;
};
const fishAt = (x, y, sc, c, { flip = 1, fin = c, stripes = 0, w = 1.6 } = {}) => `<g transform="translate(${x} ${y}) scale(${sc * flip} ${sc})">${ink(`<path d="M-11 0 L-21 -7 Q-17 0 -21 7Z" fill="${fin}"/><path d="M-13 0 Q0 -11 13 0 Q0 11 -13 0Z" fill="${c}"/><path d="M-4 -7 Q1 -14 6 -6Z" fill="${fin}"/>`, w / sc)}${stripes ? `<g stroke="#ffffff" stroke-width="2.4" fill="none"><path d="M-5 -6.5 Q-3 0 -5 6.5"/><path d="M3 -7.5 Q5 0 3 7.5"/></g>` : ''}<circle cx="7.5" cy="-1.6" r="1.5" fill="${O}"/></g>`;
const fishSprite = (x, y, sc, c, opts, secs, delay, dir = 1) => S(x, y, 44 * sc, 22 * sc, fishAt(22 * sc, 11 * sc, sc, c, { ...opts, flip: dir }), `bgAcross ${secs}s linear ${delay}s infinite, bgWob ${(1.3 + sc * 0.3).toFixed(1)}s ease-in-out infinite alternate`, `--dx:${dir * 1180};--r:3`);
const school = (c, dir) => [[12, 9], [32, 5], [54, 11], [22, 23], [46, 26], [68, 19]].map(([x, y]) => fishAt(x, y, 0.42, c, { flip: dir, w: 1.2 })).join('');
const jelly = (x, y, c, c2, i) => S(x, y, 22, 36, `<g stroke="${c2}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".9"><path d="M5 14 q-2 5 0 10 t0 10"/><path d="M9 15 q2 5 0 10 t0 9"/><path d="M13 15 q-2 5 0 10 t0 9"/><path d="M17 14 q2 5 0 10 t0 10"/></g>${ink(`<path d="M2 15 Q2 2 11 2 Q20 2 20 15 Q16 12 11 15 Q6 12 2 15Z" fill="${c}"/>`, 1.6)}<path d="M6 8 Q8 5 11 5" stroke="#ffffff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>`,
  `bgFloat ${7 + i}s ease-in-out ${-i * 1.7}s infinite alternate, bgPulse ${2 + i * 0.2}s ease-in-out infinite alternate`, '--fy:-9;--s:1.1 .88;transform-origin:50% 30%');
const bubbles = (x, y, i, big = 1) => S(x, y, 12 * big, 40 * big, `<g fill="none" stroke="#ffffff" stroke-width="${1.4 * big}" opacity=".85"><circle cx="${6 * big}" cy="${34 * big}" r="${3.4 * big}"/><circle cx="${8 * big}" cy="${20 * big}" r="${2.2 * big}"/><circle cx="${4 * big}" cy="${8 * big}" r="${1.5 * big}"/></g>`, `bgRise ${8 + (i % 4) * 1.4}s linear ${-i * 2.3}s infinite`, `--dy:${-118 * big};--dx:${(i % 2 ? 9 : -6) * big}`, 'fx');
const coral = {
  brain: (x, c) => ink(`<path transform="translate(${x} 153)" d="M0 0 Q-4 -28 8 -32 Q8 -44 20 -40 Q28 -52 38 -40 Q50 -42 48 -28 Q60 -24 54 0Z" fill="${c}"/><path transform="translate(${x} 153)" d="M12 -22 q6 -6 12 0 M26 -30 q5 -5 10 0 M20 -10 q8 -6 16 0" fill="none"/>`, 2.2),
  branch: (x, c) => ink(`<path transform="translate(${x} 153)" d="M12 0 V-14 Q2 -18 4 -30 Q10 -28 12 -22 Q12 -34 18 -40 Q24 -34 22 -22 Q28 -30 34 -28 Q34 -16 24 -12 V0Z" fill="${c}"/>`, 2.2),
  tubes: (x, c, c2) => [[0, 34], [11, 46], [23, 28]].map(([dx, h]) => `${ink(`<rect x="${x + dx}" y="${153 - h}" width="11" height="${h}" rx="5" fill="${c}"/>`, 2)}<ellipse cx="${x + dx + 5.5}" cy="${155 - h}" rx="3.4" ry="1.8" fill="${c2}"/>`).join(''),
  fan: (x, c) => `${ink(`<path transform="translate(${x} 153)" d="M0 0 Q-26 -30 0 -54 Q26 -30 0 0Z" fill="${c}"/>`, 2.2)}<g transform="translate(${x} 153)" stroke="${O}" stroke-width="1.3" fill="none" opacity=".7"><path d="M0 0 V-52 M0 -4 Q-12 -26 -8 -42 M0 -4 Q12 -26 8 -42 M0 -8 Q-18 -24 -16 -34 M0 -8 Q18 -24 16 -34"/></g>`,
  anemone: (x, c) => ink(`<g transform="translate(${x} 153)" fill="${c}"><path d="M-10 0 Q-12 -10 -4 -10 H4 Q12 -10 10 0Z"/>${[-9, -5, -1, 3, 7].map((dx, i) => `<path d="M${dx} -9 q${i % 2 ? 3 : -3} -8 0 -15 q4 0 3 15Z"/>`).join('')}</g>`, 1.8),
};
function underwater() {
  const r = rnd(7);
  return {
    base: `<linearGradient id="bgSeaT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fb8d6"/><stop offset="1" stop-color="#0a3a6e"/></linearGradient><rect width="1000" height="160" fill="url(#bgSeaT)"/>`,
    view: '360 66 240 92',
    layers: [
      { // far off: pale shapes, shafts of light, a whale
        par: 1.7,
        art: `<path d="M-40 164 V120 L0 108 L40 98 L70 124 L112 86 L150 122 L190 106 L230 132 L262 94 L300 128 L352 114 L392 80 L430 120 L470 102 L520 130 L566 98 L610 122 L650 84 L700 126 L744 108 L790 132 L832 92 L880 124 L930 102 L970 128 L1040 112 V164Z" fill="#1b5f8c" opacity=".5"/>
          <g stroke="#1b5f8c" stroke-width="5" opacity=".42" fill="none" stroke-linecap="round">${Array.from({ length: 16 }, (_, i) => { const x = 24 + i * 63 + r() * 20, h = 46 + r() * 40; return `<path d="M${x.toFixed(0)} 160 q-8 ${(-h / 4).toFixed(0)} 0 ${(-h / 2).toFixed(0)} q8 ${(-h / 4).toFixed(0)} 0 ${(-h / 2).toFixed(0)}"/>`; }).join('')}</g>`,
        items: [
          ...[60, 240, 420, 600, 780].map((x, i) => S(x, -12, 130, 178, `<path d="M48 0 H100 L70 178 H0Z" fill="#ffffff" opacity=".12"/>`, `bgTwinkle ${6 + i * 1.3}s ease-in-out ${-i * 2.1}s infinite alternate, bgSway ${12 + i * 2}s ease-in-out ${-i * 3}s infinite alternate`, '--o:.3;--k:2.5;transform-origin:50% 0')),
          S(1080, 84, 124, 46, `<g fill="#1b5f8c" opacity=".75"><path d="M4 26 Q22 6 64 8 Q94 10 106 24 L122 10 Q118 26 124 40 L106 28 Q86 43 52 41 Q20 39 4 26Z"/><path d="M52 40 L44 47 L64 41Z"/></g>`, 'bgAcross 170s linear -70s infinite', '--dx:-1320'),
        ],
      },
      { // the middle distance: thin weed, schools of small fish, jellyfish
        par: 1,
        art: `${[60, 170, 330, 505, 668, 842, 950].map((x) => ink(`<path d="M${x} 160 q8 -24 30 -20 q20 -12 34 6 q12 2 10 14Z" fill="#2a709c"/>`, 1.6)).join('')}
          ${Array.from({ length: 15 }, (_, i) => { const x = 20 + i * 66 + r() * 24, h = 48 + r() * 38; return `<g transform="translate(${(x - 15).toFixed(0)} ${(160 - h).toFixed(0)})" opacity=".9">${kelp(h, i % 2 ? '#1f8a6a' : '#2a9a7a', 4, false)}</g>`; }).join('')}`,
        items: [
          S(-120, 84, 84, 34, school('#ffd23f', 1), 'bgAcross 78s linear -24s infinite', '--dx:1240'),
          S(1040, 104, 84, 34, school('#dfe9f2', -1), 'bgAcross 96s linear -52s infinite', '--dx:-1240'),
          S(-120, 120, 84, 34, school('#ff8a2b', 1), 'bgAcross 112s linear -84s infinite', '--dx:1240'),
          jelly(300, 94, '#ff9bd0', '#ff5d9e', 0), jelly(545, 90, '#c9a6ff', '#8a5df0', 1), jelly(700, 100, '#ff9bd0', '#ff5d9e', 2), jelly(150, 102, '#c9a6ff', '#8a5df0', 3), jelly(880, 92, '#ff9bd0', '#ff5d9e', 4),
        ],
      },
      { // the reef itself
        par: 0.35,
        art: `${coral.tubes(296, '#a06bff', '#4a2a9a')}${coral.brain(402, '#ff7ab8')}${coral.branch(560, '#ff8a2b')}${coral.fan(706, '#ff5d73')}${coral.anemone(480, '#35d08a')}${coral.anemone(626, '#ffd23f')}
          ${coral.branch(118, '#ff8a2b')}${coral.anemone(216, '#ff7ab8')}${coral.brain(836, '#ff7ab8')}${coral.tubes(926, '#a06bff', '#4a2a9a')}${coral.fan(40, '#ff5d73')}
          ${ink(`<path d="M-40 164 V151 Q60 143 120 149 T240 149 T360 147 T480 151 T600 148 T720 150 T840 147 T1040 151 V164Z" fill="#e8c98a"/>`, 2)}
          ${ink(`<path d="M644 153 V138 Q644 130 652 130 H672 Q680 130 680 138 V153Z" fill="#8a4a22"/><path d="M644 140 H680" fill="none"/><rect x="658" y="137" width="8" height="7" rx="1.5" fill="#ffd23f"/>`, 2)}
          ${star(352, 147, 5, 6, 2.6, `fill="#ff8a2b" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"`)}${star(770, 148, 5, 5, 2.2, `fill="#ff5d73" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"`)}`,
        items: [
          ...[[252, 96, 0], [276, 70, 1], [372, 84, 0], [468, 62, 1], [604, 90, 0], [630, 60, 1], [748, 100, 0], [774, 74, 1], [96, 90, 0], [176, 70, 1], [868, 84, 0], [960, 96, 1]].map(([x, h, d], i) => S(x - 15, 153 - h, 30, h, kelp(h, d ? '#1f7a2c' : '#35d08a'), `bgSway ${6 + (i % 4)}s ease-in-out ${-i * 0.9}s infinite alternate`, '--k:4;transform-origin:50% 100%')),
          fishSprite(-80, 92, 1.3, '#ffd23f', { fin: '#ff8a2b' }, 44, -10), fishSprite(1040, 84, 1.1, '#ff8a2b', { stripes: 1 }, 52, -30, -1),
          fishSprite(-80, 126, 1, '#5fd0ff', { fin: '#1f86e6' }, 38, -22), fishSprite(1040, 106, 1.4, '#ff5d73', { fin: '#c22a44' }, 60, -5, -1), fishSprite(-80, 114, 0.9, '#c9a6ff', { fin: '#7a4df0' }, 50, -41),
          S(1040, 96, 50, 28, `${ink(`<path d="M18 18 L10 27 L24 21Z" fill="#8fd16a"/><path d="M36 18 L45 26 L41 17Z" fill="#8fd16a"/><circle cx="8" cy="14" r="5" fill="#8fd16a"/><path d="M12 16 Q14 4 28 4 Q42 4 45 16 Q30 23 12 16Z" fill="#3aa63f"/>`, 1.8)}<path d="M20 8 L24 17 M30 5 V19 M38 8 L35 17" stroke="${O}" stroke-width="1.2" fill="none"/><circle cx="6.5" cy="13" r="1.1" fill="${O}"/>`, 'bgAcross 92s linear -48s infinite, bgWob 3.2s ease-in-out infinite alternate', '--dx:-1190;--r:4'),
          ...[300, 436, 566, 662, 716, 190, 860].map((x, i) => bubbles(x, 110, i)),
          S(657, 126, 10, 10, sparkle('#fff3c4'), 'bgTwinkle 1.3s ease-in-out infinite alternate', '--o:.05', 'fx'),
        ],
      },
    ],
    front: { // right behind the table: dark weed, drifting specks, a shark going by
      par: -1,
      items: [
        ...[[112, 150], [142, 118], [264, 156], [292, 126], [318, 94], [700, 102], [724, 150], [752, 122], [858, 140], [890, 156]].map(([x, h], i) => S(x - 15, 160 - h, 30, h, kelp(h, i % 2 ? '#127a6c' : '#0e5a5e', 8), `bgSway ${9 + (i % 3) * 2}s ease-in-out ${-i * 1.3}s infinite alternate`, '--k:5;transform-origin:50% 100%')),
        S(-170, 72, 112, 40, `<g transform="scale(.66)">${ink(`<path d="M22 30 L4 10 Q12 30 2 52Z" fill="#1a4468"/><path d="M84 15 L98 -4 L106 18Z" fill="#1a4468"/><path d="M96 42 L84 58 L112 43Z" fill="#1a4468"/><path d="M22 30 Q58 8 114 18 Q142 22 166 31 Q142 41 114 43 Q68 49 22 30Z" fill="#2a5f8c"/>`, 2.4)}<path d="M40 37 Q90 47 152 34 Q120 42 96 43 Q62 47 40 37Z" fill="#7fa3bf"/><circle cx="148" cy="28" r="1.8" fill="${O}"/><path d="M122 24 v8 M127 24 v8 M132 25 v7" stroke="${O}" stroke-width="1.3"/></g>`, 'bgAcross 70s linear -32s infinite, bgWob 2.6s ease-in-out infinite alternate', '--dx:1400;--r:1.5'),
        ...[0, 1, 2].map((i) => S(i * 350 - 20, 10, 300, 150, (() => { const q = rnd(31 + i); return `<g fill="#ffffff" opacity=".55">${Array.from({ length: 26 }, () => `<circle cx="${(q() * 300).toFixed(0)}" cy="${(q() * 150).toFixed(0)}" r="${(0.5 + q() * 0.9).toFixed(1)}"/>`).join('')}</g>`; })(), `bgRise ${30 + i * 7}s linear ${-i * 11}s infinite`, '--dx:-70;--dy:36', 'fx')),
        ...[272, 306, 712, 742].map((x, i) => bubbles(x, 96, i + 3, 1.5)),
      ],
    },
  };
}

// ---------- Pirate Deck ----------
const wavePath = (y, wl, amp, n) => `M0 ${y}${` q${wl / 4} ${-amp} ${wl / 2} 0 t${wl / 2} 0`.repeat(n)}`;
const waveStrip = (y, wl, amp, sw, op, secs, dir) => { const n = Math.ceil(1000 / wl) + 4; return S(-2 * wl, y - amp - 3, n * wl, amp * 2 + 6, `<path d="${wavePath(amp + 3, wl, amp, n)}" stroke="#ffffff" stroke-width="${sw}" fill="none" stroke-linecap="round" opacity="${op}"/>`, `bgAcross ${secs}s linear infinite`, `--dx:${dir * wl}`); };
const cloud = (x, y, sc, secs, delay) => S(x, y, 100 * sc, 40 * sc, `<g transform="scale(${sc})">${ink(`<path d="M12 36 Q0 34 4 24 Q6 14 18 16 Q24 4 40 8 Q52 0 62 12 Q76 10 78 22 Q92 22 90 32 Q88 38 78 36Z" fill="#ffffff"/>`, 2 / sc)}<path d="M26 22 q6 -6 12 0 M48 18 q6 -6 12 0" stroke="${O}" stroke-width="${1.3 / sc}" fill="none" stroke-linecap="round"/><path d="M16 32 H76" stroke="#b9dff5" stroke-width="3" stroke-linecap="round"/></g>`, `bgAcross ${secs}s linear ${delay}s infinite`, '--dx:1300');
const HZ = 118; // the horizon
function ship() {
  const sunRays = Array.from({ length: 14 }, (_, i) => { const a = (i * Math.PI * 2) / 14, p = (t, rr) => `${(90 + Math.cos(a + t) * rr).toFixed(1)} ${(90 + Math.sin(a + t) * rr).toFixed(1)}`; return `<path d="M${p(0, 15)} L${p(-0.09, 88)} L${p(0.09, 88)}Z"/>`; }).join('');
  const rig = (xs, top) => { // ropes running up to the mast, with rungs between them
    const at = (x, y) => x + (top - x) * ((160 - y) / 230);
    let rungs = '';
    for (let y = 150; y > -6; y -= 13) rungs += `M${at(xs[0], y).toFixed(1)} ${y} Q${((at(xs[0], y) + at(xs[2], y)) / 2).toFixed(1)} ${y + 2.5} ${at(xs[2], y).toFixed(1)} ${y}`;
    return `${stroke2(rungs, '#b98a4e', 1.6, 2)}${xs.map((x) => stroke2(`M${x} 160 L${top} -70`, '#c99a5e', 2.6, 2.6)).join('')}`;
  };
  const tackle = (x, len, i) => S(x - 8, -60, 16, len + 60, `${stroke2(`M8 0 V${len + 38}`, '#c99a5e', 2.4, 2.4)}${ink(`<rect x="2" y="${len + 36}" width="12" height="15" rx="4" fill="#8a4a22"/><path d="M8 ${len + 51} v4 q0 5 -5 4" fill="none"/>`, 2)}<circle cx="8" cy="${len + 43.5}" r="2.4" fill="#ffd23f" stroke="${O}" stroke-width="1.2"/>`, `bgWob ${6 + i * 1.7}s ease-in-out ${-i * 2}s infinite alternate`, '--r:1.6;transform-origin:50% 0');
  const dolphin = `${ink(`<path d="M15 5 L19 -2 L22 6Z" fill="#6aa6d6"/><path d="M2 13 Q10 1 25 5 Q31 6 35 10 Q29 9 26 11 Q18 17 7 15 L1 20 Q3 16 2 13Z" fill="#7fb8e2"/>`, 1.6)}<circle cx="28" cy="8" r="1.1" fill="${O}"/>`;
  return {
    base: `<rect width="1000" height="160" fill="#8fd3ff"/>`,
    view: '376 66 240 92',
    layers: [
      { // sky: a low sun, clouds, an island on the horizon, gulls
        par: 1.7, cls: 'roll',
        art: `<rect x="-60" y="100" width="1120" height="18" fill="#c4e8ff" opacity=".7"/>
          <circle cx="648" cy="98" r="21" fill="#fff3c4" opacity=".4"/>${ink(`<circle cx="648" cy="98" r="11" fill="#fff3c4"/>`, 2)}
          <g transform="translate(330 ${HZ}) scale(.7)">${ink(`<path d="M-52 0 Q0 -8 54 0Z" fill="#f2dfa0"/><path d="M-44 0 Q0 -26 46 0Z" fill="#4fae54"/><path d="M-4 -12 Q-2 -24 4 -32" fill="none"/><path d="M4 -32 Q-8 -41 -17 -34 Q-6 -36 4 -29Z M4 -32 Q16 -43 27 -36 Q16 -36 4 -29Z M4 -32 Q0 -45 -9 -47 Q0 -40 2 -29Z M4 -32 Q10 -45 19 -45 Q10 -40 6 -29Z" fill="#1f7a2c"/>`, 2.4)}</g>
          ${ink(`<path d="M786 ${HZ} L800 107 L812 112 L824 ${HZ}Z" fill="#8d91a1"/><path d="M150 ${HZ} L166 109 L186 ${HZ}Z" fill="#8d91a1"/>`, 1.6)}`,
        items: [
          S(558, 8, 180, 180, `<g fill="#fff3c4" opacity=".3">${sunRays}</g>`, 'bgSpin 260s linear infinite'),
          cloud(-140, 83, 0.55, 230, -40), cloud(-140, 92, 0.4, 190, -120), cloud(-140, 80, 0.5, 260, -170), cloud(-140, 96, 0.34, 170, -75), cloud(-140, 86, 0.45, 210, -8), cloud(-140, 40, 1, 240, -100), cloud(-140, 20, 0.8, 200, -20),
          ...[[86, 76, -14], [92, 64, -37], [99, 90, -55]].map(([y, secs, delay]) => S(-40, y, 14, 6, `<path d="M1 5 Q4 0 7 4 Q10 0 13 5" fill="none" stroke="${O}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`, `bgAcross ${secs}s linear ${delay}s infinite, bgPulse .55s ease-in-out infinite alternate`, '--dx:1100;--s:1 .45')),
        ],
      },
      { // open water and the ships on it
        par: 1, cls: 'roll',
        art: `<rect x="-60" y="${HZ}" width="1120" height="110" fill="#1f86e6"/><rect x="-60" y="${HZ}" width="1120" height="7" fill="#58b0f2"/><path d="M-60 ${HZ} H1060" stroke="#ffffff" stroke-width="1.2" opacity=".7"/>`,
        items: [
          waveStrip(125, 44, 2.4, 1.6, 0.75, 8, 1), waveStrip(132, 56, 3, 1.8, 0.55, 10, 1),
          S(428, 86, 60, 39, `<g transform="scale(.62)">${ink(`<path d="M46 44 V4 M68 44 V14 M24 44 V16 M84 42 L96 36" fill="none"/><path d="M6 44 V37 H22 V44 H84 L90 40 L86 50 Q78 60 60 60 H26 Q12 60 6 44Z" fill="#6b3218"/><path d="M34 10 Q48 14 60 10 L62 24 Q48 28 32 24Z" fill="${PAPER}"/><path d="M32 27 Q48 31 62 27 L64 41 Q48 45 30 41Z" fill="${PAPER}"/><path d="M60 18 Q69 21 78 18 L80 38 Q69 41 58 38Z" fill="${PAPER}"/><path d="M16 20 Q24 23 32 20 L33 38 Q24 41 15 38Z" fill="${PAPER}"/><path d="M46 4 h-13 l3 3.5 l-3 3.5 h13Z" fill="${O}"/>`, 2.6)}<path d="M10 48 H84" stroke="#ffd23f" stroke-width="2.4"/><g fill="#ffd23f"><circle cx="30" cy="54" r="1.8"/><circle cx="44" cy="54" r="1.8"/><circle cx="58" cy="54" r="1.8"/></g></g>`, 'bgFloat 80s ease-in-out -20s infinite alternate, bgWob 4.2s ease-in-out infinite alternate', '--fx:150;--fy:0;--r:2.5;transform-origin:50% 90%'),
          S(770, 103, 22, 18, `<g transform="scale(.74)">${ink(`<path d="M15 16 V2" fill="none"/><path d="M4 16 H26 L22 22 H8Z" fill="#5a2c12"/><path d="M15 3 Q4 10 15 14Z" fill="${PAPER}"/>`, 2)}</g>`, 'bgFloat 95s ease-in-out -50s infinite alternate, bgWob 3.1s ease-in-out infinite alternate', '--fx:-170;--fy:0;--r:4;transform-origin:50% 90%'),
          ...[[300, 122], [372, 129], [470, 134], [560, 124], [612, 131], [690, 121], [742, 133], [220, 132], [840, 126], [520, 127], [400, 136]].map(([x, y], i) => S(x, y, 8, 8, `<g transform="scale(.8)">${sparkle()}</g>`, `bgTwinkle ${(1.1 + (i % 4) * 0.35).toFixed(2)}s ease-in-out ${(-i * 0.45).toFixed(2)}s infinite alternate`, '--o:0', 'fx')),
        ],
      },
      { // the swell near the ship
        par: 0.45, cls: 'roll',
        art: `<path d="${wavePath(138, 70, 3.4, 18).replace('M0', 'M-60')} V270 H-60Z" fill="#1668c4"/>`,
        items: [
          waveStrip(144, 80, 4, 2.2, 0.6, 6, -1), waveStrip(153, 96, 5, 2.6, 0.5, 5, -1),
          S(300, 128, 36, 20, dolphin, 'bgJump 13s linear -4s infinite', '', 'fx'), S(640, 130, 36, 20, dolphin, 'bgJump 17s linear -11s infinite', '', 'fx'),
          S(566, 134, 18, 20, `<g transform="scale(.8)">${ink(`<rect x="2" y="2" width="18" height="20" rx="4" fill="#a8562a"/>`, 2)}<path d="M2 8 H20 M2 16 H20" stroke="#ffd23f" stroke-width="2"/></g>`, 'bgFloat 3.4s ease-in-out infinite alternate, bgWob 4.6s ease-in-out infinite alternate', '--fy:-3;--r:7'),
          S(250, 131, 18, 13, `<g transform="scale(.8)">${ink(`<path d="M2 16 Q8 12 10 0 Q18 6 20 16Z" fill="#3b3e4a"/>`, 2)}</g>`, 'bgFloat 26s ease-in-out infinite alternate', '--fx:150;--fy:0'),
        ],
      },
    ],
    front: { // the ship's own rail, rigging and tackle
      par: -1,
      art: `${Array.from({ length: 9 }, (_, i) => stroke2(`M${40 + i * 115} 125 Q${97.5 + i * 115} 143 ${155 + i * 115} 125`, '#c99a5e', 3, 2.6)).join('')}
        ${Array.from({ length: 10 }, (_, i) => ink(`<rect x="${34 + i * 115}" y="119" width="12" height="46" rx="2" fill="#8a4a22"/><circle cx="${40 + i * 115}" cy="119" r="7.5" fill="#a8562a"/>`, 2.2)).join('')}`,
      items: [
        S(0, 0, 1000, 160, rig([226, 262, 298], 334), 'bgWob 7s ease-in-out infinite alternate', '--r:.35;transform-origin:26% 100%'),
        S(0, 0, 1000, 160, rig([702, 738, 774], 666), 'bgWob 8s ease-in-out -3s infinite alternate', '--r:.35;transform-origin:74% 100%'),
        tackle(410, 52, 0), tackle(590, 40, 1),
      ],
    },
  };
}

// ---------- Great Hall ----------
const WIN = [{ x: 318, w: 46 }, { x: 468, w: 64, moon: 1 }, { x: 636, w: 46 }, { x: 150, w: 46 }, { x: 804, w: 46 }];
const WY = 84, WH = 52;
const banner = (x, c, c2, i) => S(x, 84, 24, 52, `<g transform="scale(.68)">${ink(`<path d="M2 6 H32 V70 L17 57 L2 70Z" fill="${c}"/><path d="M17 20 l8 12 -8 12 -8 -12Z" fill="${c2}"/><rect x="-2" y="2" width="38" height="6" rx="3" fill="#8a4a22"/>`, 2.8)}<path d="M2 12 H32" stroke="${c2}" stroke-width="2.4"/></g>`, `bgSway ${5 + (i % 3)}s ease-in-out ${-i * 1.1}s infinite alternate`, '--k:2.6;transform-origin:50% 0');
const TORCH = [392, 608, 305, 695];
function castle() {
  const sky = (w, moon) => { // what is outside one window: stars, the moon, cloud, far hills and a tower
    const q = rnd(w + 3);
    return [
      S(-30, -30, w + 60, WH + 60, `<g fill="#ffffff">${Array.from({ length: 30 }, () => `<circle cx="${(q() * (w + 60)).toFixed(1)}" cy="${(q() * (WH + 30)).toFixed(1)}" r="${(0.45 + q() * 0.7).toFixed(1)}"/>`).join('')}</g>`),
      ...(moon ? [S(w / 2 - 4, 6, 26, 26, `<circle cx="13" cy="13" r="13" fill="#fff3c4" opacity=".25"/><circle cx="13" cy="13" r="8.5" fill="#fff3c4" stroke="${O}" stroke-width="1.5"/><circle cx="10" cy="10" r="1.7" fill="#e6d59a"/><circle cx="16" cy="15" r="2.1" fill="#e6d59a"/><circle cx="11" cy="17" r="1" fill="#e6d59a"/>`)] : []),
      S(-70, moon ? 14 : 10, 48, 15, `<path d="M4 14 Q-2 12 3 8 Q6 2 14 5 Q20 0 28 4 Q38 2 39 8 Q47 8 44 14Z" fill="#4a5cae" opacity=".9"/>`, `bgAcross ${moon ? 70 : 90}s linear ${moon ? -20 : -50}s infinite`, `--dx:${w + 150}`),
      S(-20, 26, w + 40, 46, `<path d="M0 46 V22 Q${(w + 40) * 0.3} 10 ${(w + 40) * 0.55} 18 T${w + 40} 14 V46Z" fill="#0b1238"/>${moon ? '' : `<path d="M${(w * 0.5 + 12).toFixed(0)} 30 V6 h-2.500 v-6 h2.500 v2.500 h3.500 v-2.500 h3.500 v2.500 h3.500 v-2.500 h2.500 v6 h-2.500 V30Z" fill="#0b1238"/><rect x="${(w * 0.5 + 17).toFixed(0)}" y="10" width="2.500" height="4" fill="#ffd23f"/>`}`),
      ...(moon ? [S(-24, 22, 12, 6, `<path transform="scale(.75)" d="M0 3 Q4 -1 6 4 L8 2 L10 4 Q12 -1 16 3 Q12 3 10 7 L8 5 L6 7 Q4 3 0 3Z" fill="${O}"/>`, 'bgAcross 15s linear -4s infinite, bgPulse .26s ease-in-out infinite alternate', `--dx:${w + 60};--dy:-12;--s:1 .5`, 'fx')] : []),
    ];
  };
  return {
    base: '',
    view: '380 66 240 92',
    layers: [
      { // the wall: windows on the night, banners, torches
        par: 0,
        art: `<radialGradient id="bgTorchK"><stop offset="0" stop-color="#ffb21f" stop-opacity=".6"/><stop offset="1" stop-color="#ffb21f" stop-opacity="0"/></radialGradient>
          ${ink(`<rect x="-60" y="70" width="1120" height="8" fill="#7a7e90"/>`, 2.2)}${Array.from({ length: 13 }, (_, i) => ink(`<path d="M${52 + i * 76} 62 V34 Q${56 + i * 76} 28 ${60 + i * 76} 34 V62Z" fill="#17245e"/>`, 2)).join('')}
          ${WIN.map(({ x, w }) => `${stroke2(`M${x} ${WY + WH} V${WY + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${WY + w / 2} V${WY + WH}`, '#565a6b', 5, 3)}${stroke2(`M${x + w / 2} ${WY + 3} V${WY + WH} M${x + 3} ${WY + 30} H${x + w - 3}`, '#2c2f45', 2, 2)}${ink(`<rect x="${x - 7}" y="${WY + WH - 2}" width="${w + 14}" height="7" rx="2" fill="#7a7e90"/>`, 2.2)}`).join('')}
          ${TORCH.map((x) => ink(`<rect x="${x - 2}" y="110" width="4" height="26" rx="2" fill="#5a2c12"/><path d="M${x - 7} 110 H${x + 7} L${x + 4.500} 104 H${x - 4.500}Z" fill="#454b7a"/>`, 2)).join('')}`,
        items: [
          ...WIN.map(({ x, w, moon }) => ({ win: true, x, y: WY, w, h: WH, par: 1.8, bg: 'linear-gradient(#0a0f2e, #1a2a6c 70%, #33479a)', fill: '#17245e', items: sky(w, moon) })),
          banner(416, '#e3263e', '#ffd23f', 0), banner(560, '#1f86e6', '#ffffff', 1), banner(212, '#7a4df0', '#ffd23f', 2), banner(764, '#3aa63f', '#ffffff', 3),
          ...TORCH.map((x, i) => S(x - 42, 53, 84, 84, `<circle cx="42" cy="42" r="42" fill="url(#bgTorchK)"/>`, `bgTwinkle ${(0.33 + i * 0.07).toFixed(2)}s ease-in-out ${-i * 0.2}s infinite alternate`, '--o:.62')),
          ...TORCH.map((x, i) => S(x - 7.500, 83, 15, 23, `<g transform="scale(.83)">${ink(`<path d="M9 0 Q21 16 15 26 Q9 30 3 26 Q-3 16 9 0Z" fill="#ffb21f"/>`, 2)}<path d="M9 12 Q14 20 11 25 Q9 27 7 25 Q4 20 9 12Z" fill="#fff3c4"/></g>`, `bgPulse ${(0.17 + i * 0.03).toFixed(2)}s ease-in-out infinite alternate, bgWob ${(0.27 + i * 0.05).toFixed(2)}s ease-in-out infinite alternate`, '--s:1.08 .88;--r:5;transform-origin:50% 100%')),
        ],
      },
      { // sparks drifting up in front of the wall
        par: -0.4,
        items: TORCH.flatMap((x, i) => [0, 1].map((j) => S(x - 6 + j * 8, 84, 8, 8, `<circle cx="4" cy="4" r="${1.2 + j * 0.4}" fill="${j ? '#ffd27a' : '#ff9f43'}"/>`, `bgRise ${3.6 + i * 0.7 + j * 1.3}s ease-out ${-(i + j * 2) * 0.9}s infinite`, `--dy:-44;--dx:${j ? 12 : -9}`, 'fx'))),
      },
    ],
    front: { // stone columns standing in the hall
      par: -1,
      art: [290, 710, 118, 882].map((x) => `${ink(`<rect x="${x - 13}" y="-60" width="26" height="212" fill="#8d91a1"/><rect x="${x - 17}" y="150" width="34" height="14" rx="2" fill="#7a7e90"/><rect x="${x - 15}" y="144" width="30" height="7" rx="3" fill="#9a9eae"/>`, 2.4)}<rect x="${x + 4}" y="-60" width="8" height="204" fill="#6c7083"/><rect x="${x - 11}" y="-60" width="3" height="204" fill="#c4c7d4"/><path d="M${x - 4} -60 V144 M${x + 3} -60 V144" stroke="${O}" stroke-width="1" opacity=".45"/>
        ${ink(`<path d="M${x - 10} 74 H${x + 10} V88 Q${x + 10} 98 ${x} 102 Q${x - 10} 98 ${x - 10} 88Z" fill="#e3263e"/><path d="M${x} 74 V102 M${x - 10} 86 H${x + 10}" fill="none" stroke="#ffd23f"/>`, 1.8)}`).join(''),
      items: [],
    },
  };
}

// ---------- Space Station ----------
const starTile = (n, seed, r0, r1, cols) => { const q = rnd(seed); let s = ''; for (let i = 0; i < n; i++) s += `<circle cx="${(q() * 1000).toFixed(1)}" cy="${(q() * 160).toFixed(1)}" r="${(r0 + q() * (r1 - r0)).toFixed(2)}" fill="${cols[(q() * cols.length) | 0]}"/>`; return s; };
const twice = (tile) => `${tile}<g transform="translate(1000 0)">${tile}</g>`; // drawn twice side by side so it can scroll for ever
const rock = (sc, c) => ink(`<path transform="scale(${sc})" d="M4 9 L8 2 L16 1 L21 7 L19 15 L11 18 L5 15Z" fill="${c}"/><path transform="scale(${sc})" d="M9 6 l3 2 M14 11 l2 -2" fill="none"/>`, 1.6);
const STRUTS = [170, 335, 500, 665, 830, 5, 995];
function space() {
  const neb = `<radialGradient id="bgNebAK"><stop offset="0" stop-color="#7a4df0" stop-opacity=".7"/><stop offset="1" stop-color="#7a4df0" stop-opacity="0"/></radialGradient><radialGradient id="bgNebBK"><stop offset="0" stop-color="#17a0b8" stop-opacity=".6"/><stop offset="1" stop-color="#17a0b8" stop-opacity="0"/></radialGradient><radialGradient id="bgNebCK"><stop offset="0" stop-color="#e0458a" stop-opacity=".45"/><stop offset="1" stop-color="#e0458a" stop-opacity="0"/></radialGradient>
    <ellipse cx="180" cy="100" rx="170" ry="56" fill="url(#bgNebAK)"/><ellipse cx="560" cy="118" rx="200" ry="50" fill="url(#bgNebBK)"/><ellipse cx="860" cy="96" rx="150" ry="50" fill="url(#bgNebCK)"/>`;
  const planet = `<g transform="scale(.68)"><g transform="rotate(-18 75 55)">${stroke2('M9 55 A66 14 0 0 1 141 55', '#ffd23f', 5, 4)}</g>
    ${ink(`<circle cx="75" cy="55" r="38" fill="#f2742b"/>`, 3.4)}
    <clipPath id="bgPlK"><circle cx="75" cy="55" r="38"/></clipPath><g clip-path="url(#bgPlK)"><path d="M33 38 Q75 28 117 40 V48 Q75 36 33 46Z" fill="#ffab5c"/><path d="M33 62 Q75 54 117 66 V77 Q75 64 33 73Z" fill="#c9551a"/><path d="M33 84 Q75 78 117 88 V92 Q75 84 33 89Z" fill="#ffab5c"/><ellipse cx="92" cy="58" rx="9" ry="4.500" fill="#ffd9a0" stroke="${O}" stroke-width="1.800"/><path d="M88 12 A46 46 0 0 1 88 98 L117 98 V12Z" fill="${O}" opacity=".24"/></g>
    <path d="M48 36 Q56 24 70 21" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
    <g transform="rotate(-18 75 55)">${stroke2('M9 55 A66 14 0 0 0 141 55', '#ffd23f', 5, 4)}</g></g>`;
  const streak = `<path d="M0 3 H40" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/><circle cx="43" cy="3" r="2.4" fill="#ffffff"/>`;
  return {
    base: `<rect width="1000" height="160" fill="#07081c"/>`,
    view: '440 66 240 92',
    layers: [
      { par: 2.2, items: [S(0, 0, 2000, 160, twice(`${neb}${starTile(120, 11, 0.4, 0.9, ['#ffffff', '#c9d6ff', '#9fb0e6'])}`), 'bgAcross 330s linear infinite', '--dx:-1000')] },
      { // nearer stars drift faster; a few glitter; now and then one falls
        par: 1.6,
        items: [
          S(0, 0, 2000, 160, twice(starTile(46, 29, 0.9, 1.7, ['#ffffff', '#fff3c4', '#bfe0ff'])), 'bgAcross 210s linear infinite', '--dx:-1000'),
          ...[[282, 94], [396, 128], [452, 88], [612, 134], [722, 92], [770, 124], [226, 126], [880, 100], [120, 90], [540, 86]].map(([x, y], i) => S(x, y, 10, 10, sparkle(i % 3 ? '#ffffff' : '#fff3c4'), `bgTwinkle ${(1.4 + (i % 4) * 0.5).toFixed(1)}s ease-in-out ${(-i * 0.6).toFixed(1)}s infinite alternate`, '--o:.08')),
          S(640, 84, 46, 6, streak, 'bgShoot 14s linear -3s infinite', '--dx:-190;--dy:58;rotate:163deg', 'fx'),
          S(430, 82, 46, 6, streak, 'bgShoot 23s linear -15s infinite', '--dx:-170;--dy:60;rotate:160deg', 'fx'),
        ],
      },
      { // the planet and what goes round it
        par: 1,
        items: [
          S(534, 74, 102, 75, planet, 'bgFloat 14s ease-in-out infinite alternate', '--fy:-3;--fx:0'),
          S(288, 90, 24, 24, `<g transform="scale(.8)">${ink(`<circle cx="15" cy="15" r="12" fill="#35c8b0"/>`, 2.6)}<path d="M15 3 A12 12 0 0 1 15 27 A17 17 0 0 0 15 3Z" fill="${O}" opacity=".3"/><circle cx="10" cy="11" r="2" fill="#8ff0dd"/></g>`, 'bgFloat 18s ease-in-out -6s infinite alternate', '--fy:3;--fx:4'),
          S(446, 98, 18, 18, `<g transform="scale(.8)">${ink(`<circle cx="11" cy="11" r="9" fill="#d9d3c4"/>`, 2.4)}<circle cx="8" cy="8" r="2.2" fill="#aaa391"/><circle cx="14" cy="14" r="1.500" fill="#aaa391"/></g>`, 'bgFloat 9s ease-in-out infinite alternate, bgBobY 9s ease-in-out -4.5s infinite alternate', '--fx:24;--fy:0;--by:7'),
          ...[[-40, 92, 1, 120, -30, '#8d91a1'], [-40, 128, 0.7, 150, -95, '#a89a86'], [-40, 102, 0.55, 180, -140, '#8d91a1'], [-40, 116, 0.85, 135, -62, '#a89a86']].map(([x, y, sc, secs, delay, c], i) => S(x, y, 24 * sc, 20 * sc, rock(sc, c), `bgAcross ${secs}s linear ${delay}s infinite, bgSpin ${20 + i * 9}s linear infinite`, '--dx:1090')),
          S(1040, 100, 36, 15, `<g transform="scale(.82)">${ink(`<path d="M12 9 L2 3 V15Z" fill="#ffb21f"/><path d="M40 9 Q30 1 14 3 V15 Q30 17 40 9Z" fill="#e8edf2"/><path d="M20 3 L14 -2 V3Z M20 15 L14 20 V15Z" fill="#e3263e"/>`, 2)}<circle cx="28" cy="9" r="2.600" fill="#5fd0ff" stroke="${O}" stroke-width="1.400"/></g>`, 'bgAcross 46s linear -18s infinite, bgWob 1.8s ease-in-out infinite alternate', '--dx:-1180;--r:2'),
        ],
      },
      { // a scanner ring drawn on the glass
        par: 0.3,
        items: [
          S(540, 67, 90, 90, `<circle cx="45" cy="45" r="41" fill="none" stroke="#5ff0e0" stroke-width="1.4" stroke-dasharray="9 6" opacity=".7"/><path d="M45 0 v7 M45 83 v7 M0 45 h7 M83 45 h7" stroke="#5ff0e0" stroke-width="1.500"/>`, 'bgSpin 52s linear infinite'),
          S(634, 90, 26, 18, `<g fill="#5ff0e0" opacity=".8"><rect x="0" y="0" width="20" height="2.2"/><rect x="0" y="5" width="12" height="2.2"/><rect x="0" y="10" width="24" height="2.2"/><rect x="0" y="15" width="8" height="2.2"/></g>`, 'bgTwinkle 1.1s steps(2) infinite alternate', '--o:.35'),
        ],
      },
      { // the station's own window frame
        par: 0,
        art: `${ink(`<rect x="-60" y="68" width="1120" height="11" fill="#4a5165"/><rect x="-60" y="139" width="1120" height="34" fill="#3f4658"/>`, 2.4)}<path d="M-60 142 H1060" stroke="#8d97ad" stroke-width="2"/>
          ${STRUTS.map((x) => `${ink(`<rect x="${x - 7}" y="-70" width="14" height="240" fill="#5c6478"/><path d="M${x - 7} 79 l-10 0 l10 12Z M${x + 7} 79 l10 0 l-10 12Z M${x - 7} 139 l-10 0 l10 -12Z M${x + 7} 139 l10 0 l-10 -12Z" fill="#4a5165"/>`, 2.4)}<rect x="${x - 4.4}" y="-70" width="2.6" height="240" fill="#9aa4ba"/>${Array.from({ length: 12 }, (_, i) => `<circle cx="${x + 3.2}" cy="${-52 + i * 18}" r="1.3" fill="#2c3142"/>`).join('')}`).join('')}
          ${[230, 395, 560, 725, 100, 890].map((x) => `${ink(`<rect x="${x}" y="146" width="44" height="10" rx="2" fill="#141a36"/>`, 1.6)}<path d="M${x + 4} 152 l5 -3 l5 4 l6 -5 l6 3 l6 -2 l6 3" stroke="#5ff0e0" stroke-width="1.2" fill="none"/>`).join('')}`,
        items: [200, 262, 366, 432, 530, 596, 696, 760, 860, 140].map((x, i) => S(x, 147.5, 6, 6, `<circle cx="3" cy="3" r="2.6" fill="${['#ff5d73', '#35d08a', '#ffd23f'][i % 3]}" stroke="${O}" stroke-width="1"/>`, `bgTwinkle ${(0.5 + (i % 5) * 0.3).toFixed(1)}s steps(2) ${(-i * 0.37).toFixed(2)}s infinite alternate`, '--o:.15')),
      },
    ],
    front: { // inside the station: pipework, a small drone
      par: -1,
      art: [290, 710, 124, 876].map((x) => `${[-11, 0, 11].map((dx, i) => `${stroke2(`M${x + dx} -70 V166`, ['#7f8aa3', '#5c6478', '#9aa4ba'][i], 7, 3)}`).join('')}${ink(`<rect x="${x - 18}" y="112" width="36" height="8" rx="3" fill="#3f4658"/><rect x="${x - 18}" y="62" width="36" height="8" rx="3" fill="#3f4658"/><rect x="${x - 18}" y="150" width="36" height="14" rx="3" fill="#3f4658"/>`, 2.2)}`).join(''),
      items: [
        ...[290, 710, 124, 876].map((x, i) => S(x - 4, 86, 8, 8, `<circle cx="4" cy="4" r="3.4" fill="#ff5d73" stroke="${O}" stroke-width="1.2"/>`, `bgTwinkle ${0.9 + i * 0.25}s steps(2) infinite alternate`, '--o:.2')),
        S(398, 74, 36, 28, `<path d="M18 4 V9" stroke="${O}" stroke-width="1.6"/><circle cx="18" cy="3" r="2" fill="#ff5d73" stroke="${O}" stroke-width="1"/>${ink(`<rect x="2" y="13" width="6" height="7" rx="2" fill="#5c6478"/><rect x="28" y="13" width="6" height="7" rx="2" fill="#5c6478"/><ellipse cx="18" cy="16" rx="12" ry="8.5" fill="#e8edf2"/>`, 1.8)}<circle cx="22" cy="15.5" r="3.6" fill="#5ff0e0" stroke="${O}" stroke-width="1.4"/><path d="M12 25 q6 3 12 0" stroke="#5fd0ff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>`, 'bgFloat 6s ease-in-out infinite alternate, bgWob 5s ease-in-out infinite alternate', '--fy:-7;--fx:16;--r:6'),
      ],
    },
  };
}

// ---------- The Back Room (the free one): the posters and wallpaper are the wall itself; this adds what stands in the room ----------
function backroom() {
  const wisp = (x, i) => S(x, 40, 60, 112, `<filter id="bgSmokeK${i}" x="-60%" y="-20%" width="220%" height="140%"><feGaussianBlur stdDeviation="4"/></filter><path d="M30 110 C8 92 52 78 30 60 C10 44 48 34 30 8" stroke="#ffffff" stroke-width="9" fill="none" stroke-linecap="round" opacity=".2" filter="url(#bgSmokeK${i})"/>`, `bgRise ${17 + i * 4}s linear ${-i * 6}s infinite, bgWob ${6 + i}s ease-in-out infinite alternate`, '--dy:-84;--dx:14;--r:5', 'fx');
  const crates = (x) => `${ink(`<rect x="${x}" y="118" width="52" height="46" rx="2" fill="#a8562a"/><rect x="${x + 10}" y="94" width="34" height="25" rx="2" fill="#b8672f"/>`, 2.2)}<path d="M${x} 132 H${x + 52} M${x} 148 H${x + 52} M${x + 4} 120 L${x + 48} 162 M${x + 10} 106 H${x + 44}" stroke="${O}" stroke-width="1.3" fill="none" opacity=".6"/>`;
  return {
    base: '',
    layers: [{ par: -0.5, items: [wisp(330, 0), wisp(470, 1), wisp(600, 2), wisp(200, 3), wisp(760, 4)] }],
    front: {
      par: -1,
      art: `<g transform="translate(290 160) scale(.6) translate(-290 -160)">${stroke2('M290 150 L274 160 M290 150 L306 160 M290 22 V152', '#6b3218', 5, 4)}${stroke2('M290 38 Q278 38 276 30 M290 38 Q302 38 304 30', '#6b3218', 3.4, 3.4)}
        ${ink(`<path d="M276 32 L266 42 L264 120 L282 122 L286 70 L288 122 L300 120 L296 48 L284 34Z" fill="#b98a4e"/><path d="M276 32 L282 46 L284 34" fill="#d1a566"/><ellipse cx="290" cy="20" rx="15" ry="3.800" fill="#2c2f45"/><path d="M280 19 Q281 8 290 9 Q299 8 300 19Z" fill="#2c2f45"/>`, 3)}<path d="M265 80 L297 78" stroke="#8a5a2a" stroke-width="3.400"/><path d="M280.500 17 H299.500" stroke="#e3263e" stroke-width="3"/></g>
        <g transform="translate(711 160) scale(.8) translate(-711 -160)">${ink(`<path d="M696 136 H726 L722 164 H700Z" fill="#c9551a"/><rect x="693" y="131" width="36" height="7" rx="2" fill="#e06a2b"/>`, 2.6)}</g>${crates(104)}${crates(850)}`,
      items: [
        S(679, 71, 64, 67, `<g transform="scale(.8)">${ink(`<path d="M40 84 Q30 42 8 36 Q26 52 40 84Z" fill="#2f9a48"/><path d="M40 84 Q36 32 22 10 Q34 36 40 84Z" fill="#1f7a2c"/><path d="M40 84 Q44 28 56 6 Q46 34 40 84Z" fill="#2f9a48"/><path d="M40 84 Q52 44 74 36 Q56 54 40 84Z" fill="#1f7a2c"/><path d="M40 84 Q60 64 78 70 Q58 72 40 84Z" fill="#2f9a48"/><path d="M40 84 Q20 66 2 74 Q22 74 40 84Z" fill="#1f7a2c"/>`, 2.2)}</g>`, 'bgWob 7s ease-in-out infinite alternate', '--r:1.6;transform-origin:50% 100%'),
      ],
    },
  };
}

const SETS = { none: backroom, castle, ship, underwater, space };

// ---------- turning a set into the room, or into one flat picture for the shop ----------
const PAD = 30; // how far the view behind a window runs past the opening, so sliding it never shows an edge
const boxCss = (s, dx = 0, dy = 0) => `left:calc(var(--su)*${s.x + dx});top:calc(var(--su)*${s.y + dy});width:calc(var(--su)*${s.w});height:calc(var(--su)*${s.h});`;
const spriteHtml = (s, dx = 0, dy = 0) => `<svg class="spr ${s.cls}" viewBox="0 0 ${s.w} ${s.h}" style="${boxCss(s, dx, dy)}${s.anim ? `animation:${s.anim};` : ''}${s.vars}" aria-hidden="true">${s.art}</svg>`;
const windowHtml = (w) => `<div class="win" style="${boxCss(w)}border-radius:calc(var(--su)*${w.w / 2}) calc(var(--su)*${w.w / 2}) 0 0;background:${w.bg}"><div class="pl" style="--par:${w.par}">${w.items.map((s) => spriteHtml(s, PAD, PAD)).join('')}</div></div>`;
const layerHtml = (l, cls) => `<div class="${cls} ${l.cls || ''}" style="--par:${l.par}">${l.art ? `<svg class="scn" viewBox="0 0 1000 160" preserveAspectRatio="none" aria-hidden="true">${l.art}</svg>` : ''}${(l.items || []).map((s) => (s.win ? windowHtml(s) : spriteHtml(s))).join('')}</div>`;
// Names (gradients, clip shapes) must not clash between the room's copy and a shop picture's copy.
const keyed = (html, k) => html.replace(/\b(bg[A-Z][A-Za-z]*)K/g, `$1${k}`);

// The layers for the room: `wall` goes on the back wall, `front` stands on the floor in front of it.
export function backdropLayers(id) {
  const set = (SETS[id] || SETS.none)();
  return { wall: keyed(set.layers.map((l) => layerHtml(l, 'bgl')).join(''), 'R'), front: keyed(layerHtml(set.front, 'bgfront'), 'R') };
}
// One still picture of a backdrop, for the shop and the Customize screen.
const flat = (s, dx = 0, dy = 0) => (s.cls === 'fx' ? '' : `<g transform="translate(${s.x + dx} ${s.y + dy})${/rotate:(-?\d+)deg/.test(s.vars) ? ` rotate(${s.vars.match(/rotate:(-?\d+)deg/)[1]})` : ''}">${s.art}</g>`);
const flatLayer = (l, id, n) => `${l.art || ''}${(l.items || []).map((s, i) => (s.win
  ? `<clipPath id="bgWin${id}${n}${i}"><path d="M${s.x} ${s.y + s.h} V${s.y + s.w / 2} A${s.w / 2} ${s.w / 2} 0 0 1 ${s.x + s.w} ${s.y + s.w / 2} V${s.y + s.h}Z"/></clipPath><g clip-path="url(#bgWin${id}${n}${i})"><rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${s.fill}"/>${s.items.map((t) => flat(t, s.x, s.y)).join('')}</g>`
  : flat(s))).join('')}`;
const thumb = (id) => () => {
  const set = SETS[id]();
  // the window surrounds are drawn in a layer's `art`, which comes before its windows, so draw the windows first
  const body = set.layers.map((l, n) => { const wins = { ...l, art: '', items: (l.items || []).filter((s) => s.win) }, rest = { ...l, items: (l.items || []).filter((s) => !s.win) }; return flatLayer(wins, id, n) + flatLayer(rest, id, n); }).join('') + flatLayer(set.front, id, 9);
  return keyed(`<svg class="scenery" viewBox="${set.view || '380 66 240 92'}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${set.base}${body}</svg>`, `T${id}`);
};
export const BACKDROP_ART = { castle: thumb('castle'), ship: thumb('ship'), underwater: thumb('underwater'), space: thumb('space') };
