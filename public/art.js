// Card illustrations, drawn as vector art so they stay sharp at any size.
// Every picture is a 200x150 scene in a print-poster style: flat saturated colour,
// one heavy ink outline, and the subject in the middle so it survives being cropped
// down to a small card.

const O = '#14121f'; // the ink every outline is drawn in
const PAPER = '#f7eed6';

const rays = (cx, cy, n, len, fill, op = 0.14) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n;
    d += `M${cx} ${cy}L${(cx + Math.cos(a0) * len).toFixed(1)} ${(cy + Math.sin(a0) * len).toFixed(1)}L${(cx + Math.cos(a1) * len).toFixed(1)} ${(cy + Math.sin(a1) * len).toFixed(1)}Z`;
  }
  return `<path d="${d}" fill="${fill}" opacity="${op}"/>`;
};
const gear = (cx, cy, r, teeth, fill, extra = '') => {
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, w = Math.PI / teeth / 2;
    const pt = (ang, rad) => `${(cx + Math.cos(ang) * rad).toFixed(1)} ${(cy + Math.sin(ang) * rad).toFixed(1)}`;
    d += `${i ? 'L' : 'M'}${pt(a - w, r)}L${pt(a - w * 0.6, r * 1.22)}L${pt(a + w * 0.6, r * 1.22)}L${pt(a + w, r)}L${pt(a + w * 3, r)}`;
  }
  return `<path d="${d}Z" fill="${fill}" ${extra}/>`;
};
const star = (cx, cy, n, r0, r1, attrs) => {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? r1 : r0;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  }
  return `<path d="${d}Z" ${attrs}/>`;
};
// Outlined group: everything inside gets the ink line.
const ink = (inner, w = 3) => `<g stroke="${O}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`;
// Printed dot shading, laid over the darker side of things.
const DOTS = `<pattern id="hlDots" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="2.5" cy="2.5" r="1.15" fill="${O}"/></pattern>`;
const dots = (d, op = 0.28) => `<path d="${d}" fill="url(#hlDots)" opacity="${op}"/>`;
// A stalk of wheat from its foot (x, y) to its tip (tx, ty).
const wheat = (x, y, tx, ty) => {
  const ang = (Math.atan2(-(x - tx), y - ty) * 180) / Math.PI;
  let k = '';
  for (let i = 0; i < 5; i++) k += `<ellipse cx="-5" cy="${i * 9 + 7}" rx="4" ry="6.5" transform="rotate(28 -5 ${i * 9 + 7})"/><ellipse cx="5" cy="${i * 9 + 7}" rx="4" ry="6.5" transform="rotate(-28 5 ${i * 9 + 7})"/>`;
  return `<path d="M${x} ${y}L${tx} ${ty}" stroke="${O}" stroke-width="3.4" fill="none" stroke-linecap="round"/><g transform="translate(${tx} ${ty}) rotate(${ang.toFixed(1)})" fill="#ffc321" stroke="${O}" stroke-width="2.2"><ellipse cx="0" cy="-1" rx="4" ry="7.5"/>${k}</g>`;
};
const barrel = (x, y, w, h, c, c2) => ink(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c}"/><path d="M${x} ${y + h * 0.3}H${x + w}M${x} ${y + h * 0.68}H${x + w}" fill="none"/><ellipse cx="${x + w / 2}" cy="${y}" rx="${w / 2}" ry="3.4" fill="${c2}"/>`, 2.6);
const crate = (x, y, s, c = '#e0a252') => ink(`<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="2" fill="${c}"/><path d="M${x} ${y}L${x + s} ${y + s}M${x + s} ${y}L${x} ${y + s}" fill="none"/>`, 2.4);

const SCENES = {
  Oil: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#ff8a3d"/><rect width="200" height="34" fill="#4a2a8a"/><rect y="34" width="200" height="24" fill="#b8327a"/><rect y="58" width="200" height="22" fill="#f2554a"/>
    <circle cx="100" cy="98" r="42" fill="#ffd23f" stroke="${O}" stroke-width="3"/>${rays(100, 98, 18, 180, '#fff3b0', 0.16)}
    <path d="M0 118 Q52 106 100 114 T200 110 V150 H0Z" fill="#2c1b52" stroke="${O}" stroke-width="3"/>
    ${dots('M0 132 Q60 124 100 130 T200 126 V150 H0Z', 0.5)}
    <g stroke="${O}" stroke-width="4.2" fill="none" stroke-linejoin="round" stroke-linecap="round">
      <path d="M74 120 L94 36 H106 L126 120"/><path d="M79 100 H121 M84 80 H116 M89 60 H111"/>
      <path d="M79 100 L116 80 M121 100 L84 80 M84 80 L111 60 M116 80 L89 60"/>
    </g>
    ${ink(`<rect x="88" y="29" width="24" height="8" rx="2" fill="${PAPER}"/>`)}
    <path d="M100 30 C95 20 86 12 70 10 C84 16 92 22 96 28 C94 14 97 6 106 -2 C103 8 103 18 103 27 C108 18 118 11 134 12 C118 18 108 24 100 30Z" fill="${O}"/>
    <g fill="${O}"><circle cx="66" cy="22" r="3"/><circle cx="138" cy="24" r="2.6"/><circle cx="124" cy="36" r="2.2"/><circle cx="78" cy="38" r="2"/><circle cx="60" cy="40" r="1.6"/><circle cx="144" cy="42" r="1.6"/></g>
    <ellipse cx="100" cy="124" rx="34" ry="6" fill="${O}"/><path d="M84 123 q10 -4 22 -1" stroke="#b8a6ff" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${barrel(46, 108, 22, 30, '#e3263e', '#ff6b7a')}${barrel(134, 110, 22, 28, '#2ec4a6', '#7df0d8')}${barrel(18, 116, 20, 26, '#2ec4a6', '#7df0d8')}${barrel(162, 118, 20, 24, '#e3263e', '#ff6b7a')}`,

  Livestock: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#59c8f2"/>${rays(100, 78, 16, 180, '#ffffff', 0.22)}
    <path d="M0 116 Q50 96 100 112 T200 104 V150 H0Z" fill="#3aa63f" stroke="${O}" stroke-width="3"/>
    <path d="M0 134 Q60 122 110 132 T200 128 V150 H0Z" fill="#2a8431"/>
    ${ink(`<path d="M52 152 Q56 116 100 114 Q144 116 148 152Z" fill="#7d3d1a"/>`)}
    ${ink(`<path d="M72 62 Q44 60 38 28 Q54 46 78 48Z" fill="${PAPER}"/><path d="M128 62 Q156 60 162 28 Q146 46 122 48Z" fill="${PAPER}"/>
      <path d="M70 70 Q50 64 44 78 Q56 88 74 82Z" fill="#7d3d1a"/><path d="M130 70 Q150 64 156 78 Q144 88 126 82Z" fill="#7d3d1a"/>
      <path d="M72 52 Q100 40 128 52 Q137 78 125 104 Q118 127 100 129 Q82 127 75 104 Q63 78 72 52Z" fill="#a8562a"/>`)}
    ${dots('M100 44 Q128 44 128 52 Q137 78 125 104 Q118 127 100 129Z', 0.22)}
    ${ink(`<path d="M91 49 Q100 45 109 49 Q108 74 100 84 Q92 74 91 49Z" fill="${PAPER}"/>
      <ellipse cx="100" cy="112" rx="23" ry="15.5" fill="#f7c6a6"/>`, 2.6)}
    <ellipse cx="91" cy="111" rx="3.6" ry="5" fill="${O}"/><ellipse cx="109" cy="111" rx="3.6" ry="5" fill="${O}"/>
    <path d="M90 120 a10 9.5 0 0 0 20 0" stroke="${O}" stroke-width="7.5" fill="none" stroke-linecap="round"/><path d="M90 120 a10 9.5 0 0 0 20 0" stroke="#ffd23f" stroke-width="3.6" fill="none" stroke-linecap="round"/>
    ${ink(`<circle cx="84" cy="81" r="5.6" fill="${PAPER}"/><circle cx="116" cy="81" r="5.6" fill="${PAPER}"/>`, 2.4)}
    <circle cx="85" cy="82" r="2.6" fill="${O}"/><circle cx="115" cy="82" r="2.6" fill="${O}"/>
    <path d="M75 71 L91 76 M125 71 L109 76" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
    <g fill="#ffffff" stroke="${O}" stroke-width="2"><path d="M20 30 q8 -10 18 -2 q10 -4 12 6 q6 2 2 8 H18 q-6 -6 2 -12Z"/><path d="M152 20 q6 -8 14 -2 q8 -3 10 5 q5 2 1 7 H150 q-5 -5 2 -10Z"/></g>`,

  Farmland: () => {
    let rows = '';
    const cols = ['#ffc321', '#3aa63f', '#e89a12', '#58c24c', '#ffc321', '#2a8431', '#e89a12', '#58c24c'];
    for (let i = 0; i < 8; i++) rows += `<path d="M100 80 L${-140 + i * 60} 150 L${-80 + i * 60} 150Z" fill="${cols[i]}" stroke="${O}" stroke-width="1.6"/>`;
    return `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#ffb02e"/><rect width="200" height="30" fill="#ff7d3a"/>
    <circle cx="100" cy="64" r="30" fill="#fff3b0" stroke="${O}" stroke-width="3"/>${rays(100, 64, 20, 170, '#fff6d0', 0.24)}
    <rect y="80" width="200" height="70" fill="#3aa63f"/>${rows}
    <path d="M0 80 H200" stroke="${O}" stroke-width="3.4"/>
    ${ink(`<rect x="28" y="52" width="40" height="29" fill="#e3263e"/><path d="M23 54 L48 32 L73 54Z" fill="#9c1426"/><rect x="42" y="62" width="13" height="19" fill="${PAPER}"/><path d="M42 62 L55 81 M55 62 L42 81" fill="none"/><rect x="44" y="40" width="8" height="8" fill="${PAPER}"/>
      <rect x="70" y="42" width="13" height="39" fill="${PAPER}"/><path d="M70 42 a6.5 7 0 0 1 13 0Z" fill="#9aa3b5"/><path d="M70 54 H83 M70 66 H83" fill="none"/>`, 2.6)}
    ${ink(`<path d="M152 80 L156 46 H162 L166 80Z" fill="#7b4a22"/>`, 2.6)}
    <g stroke="${O}" stroke-width="7" stroke-linecap="round"><path d="M159 46 L140 34 M159 46 L178 34 M159 46 L147 64 M159 46 L171 28"/></g>
    <g stroke="${PAPER}" stroke-width="3.4" stroke-linecap="round"><path d="M159 46 L140 34 M159 46 L178 34 M159 46 L147 64 M159 46 L171 28"/></g><circle cx="159" cy="46" r="3.4" fill="${O}"/>
    ${wheat(88, 152, 70, 62)}${wheat(112, 152, 130, 62)}${wheat(100, 152, 100, 46)}
    ${ink(`<path d="M86 132 Q100 124 114 132 Q100 140 86 132Z" fill="#e3263e"/>`, 2.4)}`;
  },

  Weapons: () => `<defs>${DOTS}<linearGradient id="wpSteel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c9d2de"/><stop offset=".5" stop-color="#8f9aab"/><stop offset="1" stop-color="#8f9aab"/></linearGradient></defs>
    <rect width="200" height="150" fill="#c4162c"/>${rays(100, 84, 16, 190, '#ff8a5c', 0.3)}
    <circle cx="100" cy="84" r="62" fill="#ff5d4a" opacity=".5"/>
    ${[40, -40].map((a) => `<g transform="rotate(${a} 100 84)">${ink(`<path d="M95 8 L100 -10 L105 8 V104 H95Z" fill="url(#wpSteel)"/><rect x="80" y="104" width="40" height="8" rx="4" fill="#ffd23f"/><rect x="95.5" y="112" width="9" height="22" fill="#7b4a22"/><circle cx="100" cy="138" r="6" fill="#ffd23f"/>`, 2.8)}</g>`).join('')}
    ${ink(`<circle cx="100" cy="92" r="35" fill="#262a45"/>`, 3.4)}
    ${dots('M100 57 A35 35 0 0 1 100 127 A48 48 0 0 0 100 57Z', 0.45)}
    <path d="M78 78 Q82 66 94 62" stroke="${PAPER}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="76" cy="90" r="3" fill="${PAPER}"/>
    ${ink(`<rect x="90" y="50" width="20" height="11" rx="2" fill="#9aa3b5"/>`, 2.8)}
    <path d="M100 50 Q102 34 118 30" stroke="${O}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M100 50 Q102 34 118 30" stroke="${PAPER}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-dasharray="5 4"/>
    ${star(122, 27, 8, 15, 6.5, `fill="#ffd23f" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"`)}${star(122, 27, 6, 7, 3, 'fill="#ffffff"')}
    <g fill="#ffd23f" stroke="${O}" stroke-width="1.6"><circle cx="144" cy="18" r="3"/><circle cx="106" cy="10" r="2.4"/><circle cx="140" cy="40" r="2.2"/></g>`,

  Workers: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#1f86e6"/>${rays(100, 76, 16, 190, '#bfe4ff', 0.2)}
    ${gear(100, 76, 47, 12, '#0d4f9e', `stroke="${O}" stroke-width="3" stroke-linejoin="round"`)}<circle cx="100" cy="76" r="33" fill="#1f86e6" stroke="${O}" stroke-width="3"/>
    <g fill="${O}"><path d="M0 150 V118 L14 106 V118 L28 106 V118 H40 V150Z"/><path d="M200 150 V112 L186 100 V112 L172 100 V112 H160 V150Z"/><rect x="6" y="84" width="9" height="40"/><rect x="186" y="78" width="9" height="40"/></g>
    <g fill="#ffd23f"><rect x="8" y="126" width="7" height="8"/><rect x="22" y="126" width="7" height="8"/><rect x="170" y="122" width="7" height="8"/><rect x="184" y="122" width="7" height="8"/></g>
    ${ink(`<path d="M50 152 Q52 114 82 110 H118 Q148 114 150 152Z" fill="#2747a8"/><path d="M84 110 L100 130 L116 110Z" fill="${PAPER}"/>
      <rect x="72" y="118" width="11" height="34" fill="#16307a"/><rect x="117" y="118" width="11" height="34" fill="#16307a"/>
      <rect x="90" y="96" width="20" height="18" fill="#e9a878"/>
      <path d="M76 64 Q75 104 100 107 Q125 104 124 64Z" fill="#f6c199"/>`)}
    ${dots('M100 64 H124 Q125 104 100 107Z', 0.2)}
    ${ink(`<path d="M70 66 Q70 32 100 32 Q130 32 130 66Z" fill="#ffd23f"/><rect x="94" y="28" width="12" height="24" rx="5" fill="#ffe88a"/><rect x="62" y="62" width="76" height="9" rx="4.5" fill="#f0a91e"/>`)}
    <circle cx="89" cy="82" r="3.2" fill="${O}"/><circle cx="111" cy="82" r="3.2" fill="${O}"/>
    <path d="M82 74 H95 M105 74 H118" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/>
    ${ink(`<path d="M84 96 Q92 88 100 93 Q108 88 116 96 Q108 102 100 98 Q92 102 84 96Z" fill="#5a2c12"/>`, 2.2)}
    <circle cx="77.500" cy="123" r="2.4" fill="#ffd23f"/><circle cx="122.500" cy="123" r="2.4" fill="#ffd23f"/>`,

  espionage: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#0d5466"/>
    <g fill="#7df0d8" opacity=".16"><rect y="14" width="200" height="9"/><rect y="36" width="200" height="9"/><rect y="58" width="200" height="9"/><rect y="80" width="200" height="9"/><rect y="102" width="200" height="9"/><rect y="124" width="200" height="9"/></g>
    <circle cx="100" cy="72" r="58" fill="#12788f"/>
    ${ink(`<path d="M42 152 Q46 110 78 104 H122 Q154 110 158 152Z" fill="#262a45"/><path d="M78 104 L93 132 L100 110Z" fill="#454b7a"/><path d="M122 104 L107 132 L100 110Z" fill="#454b7a"/>
      <path d="M77 62 Q76 104 100 108 Q124 104 123 62Z" fill="#1a1c30"/>`)}
    ${ink(`<path d="M74 60 Q71 26 100 27 Q129 26 126 60Z" fill="#454b7a"/><path d="M74 49 Q100 43 126 49 L126.500 59 Q100 53 73.500 59Z" fill="#e3263e"/><ellipse cx="100" cy="62" rx="45" ry="9" fill="#454b7a"/>`)}
    ${dots('M100 27 Q129 26 126 60 L145 62 Q145 71 100 71Z', 0.35)}
    <rect x="94" y="78" width="12" height="9" fill="${O}"/>
    ${ink(`<circle cx="85" cy="84" r="13" fill="#ffd23f"/><circle cx="115" cy="84" r="13" fill="#ffd23f"/>`, 3.4)}
    <circle cx="87" cy="85" r="5" fill="${O}"/><circle cx="113" cy="85" r="5" fill="${O}"/><path d="M77 78 q4 -5 9 -5 M107 78 q4 -5 9 -5" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${ink(`<path d="M62 150 Q60 120 74 112 Q84 114 82 128 L80 150Z" fill="#454b7a"/><path d="M138 150 Q140 120 126 112 Q116 114 118 128 L120 150Z" fill="#454b7a"/>`, 2.6)}`,

  lawsuit: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#f5dfa6"/>${rays(100, 104, 16, 190, '#b8741c', 0.14)}
    ${ink(`<rect x="18" y="12" width="52" height="66" rx="3" fill="#ffffff" transform="rotate(-8 44 45)"/>`, 2.4)}
    <g stroke="${O}" stroke-width="2.4" stroke-linecap="round" transform="rotate(-8 44 45)"><path d="M26 24 H62 M26 34 H56 M26 44 H62 M26 54 H50"/></g>
    <g transform="rotate(-8 44 45)">${ink(`<circle cx="56" cy="66" r="9" fill="#e3263e"/>`, 2.2)}</g>
    ${star(96, 100, 12, 46, 26, `fill="#ffd23f" stroke="${O}" stroke-width="3" stroke-linejoin="round"`)}${star(96, 100, 12, 28, 16, 'fill="#ffffff"')}
    ${ink(`<rect x="58" y="126" width="84" height="14" rx="3" fill="#5a2c12"/><rect x="68" y="114" width="64" height="13" rx="3" fill="#8a4a22"/>`)}
    <g transform="rotate(-24 96 92)">${ink(`<rect x="118" y="86" width="78" height="10" rx="5" fill="#c98d5a"/><rect x="72" y="70" width="50" height="40" rx="7" fill="#8a4a22"/><rect x="79" y="70" width="8" height="40" fill="#ffd23f"/><rect x="107" y="70" width="8" height="40" fill="#ffd23f"/>`)}</g>
    <g stroke="${O}" stroke-width="3.4" stroke-linecap="round"><path d="M44 96 L30 92 M48 112 L34 118 M150 112 L164 118 M56 82 L46 72"/></g>`,

  // a note slipped out of an envelope
  tip: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#1f9e8f"/>${rays(100, 78, 14, 190, '#c8fff4', 0.2)}
    <circle cx="100" cy="80" r="56" fill="#35c9b6" opacity=".6"/>
    <g transform="rotate(-6 100 60)">${ink(`<rect x="62" y="20" width="76" height="64" rx="4" fill="${PAPER}"/>`, 2.8)}<path d="M72 34 H128 M72 46 H118 M72 58 H124" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/>${star(118, 70, 5, 9, 4, `fill="#ffd23f" stroke="${O}" stroke-width="2" stroke-linejoin="round"`)}</g>
    ${ink(`<path d="M38 70 H162 V132 Q162 138 156 138 H44 Q38 138 38 132Z" fill="#ffd23f"/>`)}
    ${ink(`<path d="M38 70 L100 112 L162 70" fill="none"/>`)}
    ${dots('M100 112 L162 70 V132 Q162 138 156 138 H100Z', 0.3)}
    ${ink(`<circle cx="100" cy="118" r="10" fill="#e3263e"/>`, 2.4)}
    <g stroke="${O}" stroke-width="3.4" stroke-linecap="round"><path d="M30 36 L20 28 M36 22 L30 10 M170 36 L180 28"/></g>`,

  // a train ticket and a watch: proof of being somewhere else
  alibi: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#3aa0d6"/>${rays(100, 78, 14, 190, '#d6f1ff', 0.2)}
    <circle cx="100" cy="80" r="56" fill="#62bdee" opacity=".6"/>
    <g transform="rotate(-10 84 96)">${ink(`<path d="M22 70 H146 V88 Q138 90 138 98 Q138 106 146 108 V126 H22 V108 Q30 106 30 98 Q30 90 22 88Z" fill="${PAPER}"/>`, 2.8)}
      <path d="M54 74 V122" stroke="${O}" stroke-width="2.4" stroke-dasharray="4 4"/><path d="M64 84 H126 M64 96 H114 M64 108 H122" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/>
      ${star(40, 98, 5, 8, 3.5, `fill="#e3263e" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"`)}</g>
    ${ink(`<rect x="134" y="14" width="18" height="14" rx="3" fill="#ffd23f"/><circle cx="143" cy="58" r="32" fill="#ffd23f"/><circle cx="143" cy="58" r="24" fill="${PAPER}"/>`)}
    ${dots('M143 26 A32 32 0 0 1 143 90 A40 40 0 0 0 143 26Z', 0.3)}
    <path d="M143 58 V40 M143 58 L156 64" stroke="${O}" stroke-width="3.6" stroke-linecap="round"/><circle cx="143" cy="58" r="3" fill="${O}"/>
    <g fill="${O}"><circle cx="143" cy="38" r="1.6"/><circle cx="163" cy="58" r="1.6"/><circle cx="143" cy="78" r="1.6"/><circle cx="123" cy="58" r="1.6"/></g>`,

  // a magnifying glass over the books
  audit: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#e0862a"/>${rays(96, 76, 14, 190, '#ffe3b0', 0.22)}
    <circle cx="96" cy="78" r="56" fill="#f2a04a" opacity=".6"/>
    <g transform="rotate(-5 80 76)">${ink(`<rect x="34" y="20" width="96" height="112" rx="5" fill="${PAPER}"/>`, 2.8)}
      <path d="M46 36 H118 M46 50 H104 M46 64 H118 M46 78 H96 M46 92 H112 M46 106 H100" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      <g fill="#e3263e"><rect x="108" y="46" width="12" height="8"/><rect x="100" y="74" width="12" height="8"/></g></g>
    ${ink(`<path d="M142 104 L176 140" fill="none" stroke-width="13"/>`)}<path d="M142 104 L176 140" stroke="#8a4a22" stroke-width="7.5" stroke-linecap="round"/>
    ${ink(`<circle cx="120" cy="82" r="34" fill="#bfe8ff" fill-opacity=".72"/>`, 5)}
    <path d="M100 66 Q108 54 122 54" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M104 86 H136 M104 98 H128" stroke="${O}" stroke-width="5" stroke-linecap="round"/>`,

  // a court order and a hand held up: stop
  injunction: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#5a2fc2"/>${rays(100, 80, 14, 190, '#e6c8ff', 0.18)}
    <circle cx="100" cy="82" r="56" fill="#7a4df0" opacity=".65"/>
    <g transform="rotate(-8 66 78)">${ink(`<rect x="26" y="24" width="82" height="104" rx="5" fill="${PAPER}"/>`, 2.8)}
      <path d="M38 40 H96 M38 54 H86 M38 68 H96 M38 82 H80" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      ${ink(`<circle cx="84" cy="108" r="12" fill="#e3263e"/>`, 2.2)}${star(84, 108, 8, 12, 9, `fill="#e3263e" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"`)}</g>
    ${ink(`<path d="M112 152 V104 Q104 96 106 82 Q110 76 116 84 L120 96 V52 Q120 44 127 44 Q134 44 134 52 V40 Q134 32 141 32 Q148 32 148 40 V46 Q148 38 155 38 Q162 38 162 46 V58 Q162 52 168 52 Q174 52 174 60 V108 Q174 132 164 152Z" fill="#f2c9a0"/>`)}
    <path d="M134 52 V84 M148 46 V84 M162 58 V86" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>
    ${dots('M148 46 Q148 38 155 38 Q162 38 162 46 V58 Q162 52 168 52 Q174 52 174 60 V108 Q174 132 164 152 H146 Q156 110 148 46Z', 0.26)}
    <g stroke="#ffd23f" stroke-width="5" stroke-linecap="round"><path d="M180 30 L192 22 M186 46 L198 44 M170 18 L176 6"/></g>`,

  // old cards into the wastebasket, a fresh one dealt in
  writeoff: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#2c8f86"/>${rays(100, 80, 14, 190, '#c8fff4', 0.18)}
    <circle cx="100" cy="82" r="56" fill="#3fb5a8" opacity=".6"/>
    <g transform="rotate(-24 62 46)">${ink(`<rect x="44" y="18" width="38" height="52" rx="5" fill="${PAPER}"/><rect x="49" y="23" width="28" height="24" rx="2" fill="#e3263e"/>`, 2.6)}</g>
    <g transform="rotate(14 96 40)">${ink(`<rect x="78" y="12" width="38" height="52" rx="5" fill="${PAPER}"/><rect x="83" y="17" width="28" height="24" rx="2" fill="#1f86e6"/>`, 2.6)}</g>
    ${ink(`<path d="M44 72 H126 L116 140 H54Z" fill="#454b7a"/><rect x="38" y="64" width="94" height="12" rx="4" fill="#262a45"/>`)}
    <g stroke="${O}" stroke-width="2.6" stroke-linecap="round"><path d="M62 84 L66 130 M85 84 V130 M108 84 L104 130"/></g>
    ${dots('M100 76 H126 L116 140 H96Z', 0.34)}
    <g transform="rotate(10 162 96)">${ink(`<rect x="140" y="64" width="44" height="62" rx="6" fill="${PAPER}"/><rect x="146" y="70" width="32" height="30" rx="2" fill="#ffd23f"/>`, 2.8)}<path d="M147 108 H177 M147 116 H166" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/></g>
    ${star(166, 40, 4, 11, 4, `fill="#ffffff" stroke="${O}" stroke-width="2" stroke-linejoin="round"`)}
    <g fill="none" stroke="${O}" stroke-width="8" stroke-linecap="round"><path d="M132 36 Q150 30 158 48"/></g><g fill="none" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"><path d="M132 36 Q150 30 158 48"/></g>
    ${ink(`<path d="M150 50 L166 52 L158 38Z" fill="#ffd23f"/>`, 2.4)}`,

  // a gloved hand lifting a card off someone else's pile
  forcedTrade: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#5a2fc2"/>${rays(100, 84, 12, 190, '#e6c8ff', 0.16)}
    <circle cx="100" cy="84" r="56" fill="#7a4df0" opacity=".7"/>
    <g transform="rotate(-10 62 104)">${ink(`<rect x="34" y="78" width="46" height="62" rx="6" fill="${PAPER}"/><rect x="40" y="84" width="34" height="30" rx="2" fill="#1f86e6"/>`, 2.8)}</g>
    <g transform="rotate(6 84 104)">${ink(`<rect x="58" y="80" width="46" height="62" rx="6" fill="${PAPER}"/><rect x="64" y="86" width="34" height="30" rx="2" fill="#2fb36a"/>`, 2.8)}</g>
    <g transform="rotate(16 122 74)">${ink(`<rect x="98" y="36" width="50" height="70" rx="6" fill="${PAPER}"/><rect x="104" y="42" width="38" height="36" rx="2" fill="#e3263e"/><path d="M123 48 l11 22 h-22Z" fill="#ffd23f"/>`, 2.8)}<path d="M105 88 H141 M105 97 H128" stroke="${O}" stroke-width="3" stroke-linecap="round"/></g>
    ${ink(`<path d="M204 -4 L150 30 Q138 36 140 48 L143 62 Q146 70 153 66 L152 52 Q160 60 168 54 L162 40 L210 18Z" fill="#1a1c30"/><path d="M150 30 Q128 34 124 52 Q124 60 131 58 Q136 44 150 44Z" fill="#1a1c30"/>`, 2.8)}
    <path d="M176 18 L196 8" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
    <g stroke="#ffd23f" stroke-width="4.500" stroke-linecap="round"><path d="M92 62 L80 52 M96 46 L88 32 M112 28 L110 14"/></g>
    <g stroke="${O}" stroke-width="3" stroke-linecap="round"><path d="M26 66 L14 60 M30 50 L20 40"/></g>`,

  // a referee's whistle, mid-blast
  whistleblower: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#ffb21f"/>${rays(84, 84, 18, 200, '#fff3c4', 0.34)}
    <circle cx="84" cy="84" r="58" fill="#ffd23f" opacity=".7"/>
    ${ink(`<path d="M96 52 H168 Q176 52 176 60 V74 Q176 82 168 82 H128Z" fill="#e3263e"/>`)}
    ${ink(`<circle cx="88" cy="86" r="40" fill="#e3263e"/>`)}
    ${dots('M88 46 A40 40 0 0 1 88 126 A60 60 0 0 0 88 46Z', 0.4)}
    ${ink(`<rect x="100" y="52" width="26" height="15" rx="3" fill="#1a1c30"/>`, 2.6)}
    ${ink(`<circle cx="88" cy="90" r="13" fill="${PAPER}"/>`, 2.6)}
    <path d="M62 70 Q66 58 78 54" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${ink(`<circle cx="50" cy="112" r="9" fill="none"/>`, 4)}
    <path d="M44 120 Q22 136 30 152" stroke="${O}" stroke-width="4.500" fill="none" stroke-linecap="round"/>
    <g stroke="${O}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M112 34 L118 18"/><path d="M130 38 L144 24"/><path d="M94 32 L92 16"/></g>
    <g stroke="#ffffff" stroke-width="4" stroke-linecap="round" fill="none"><path d="M150 100 Q164 108 160 124"/><path d="M168 96 Q188 108 182 132"/></g>
    ${star(160, 34, 8, 12, 6, `fill="#ffffff" stroke="${O}" stroke-width="2.600" stroke-linejoin="round"`)}`,

  strike: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#e23a22"/>${rays(100, 86, 18, 190, '#ffd9a0', 0.24)}
    <circle cx="100" cy="84" r="58" fill="#ff6a3c" opacity=".55"/>
    ${ink(`<rect x="34" y="52" width="5" height="100" fill="#7b4a22"/><rect x="14" y="26" width="46" height="30" rx="2" fill="${PAPER}" transform="rotate(-6 37 41)"/>
      <rect x="161" y="60" width="5" height="92" fill="#7b4a22"/><rect x="140" y="34" width="46" height="30" rx="2" fill="${PAPER}" transform="rotate(7 163 49)"/>`, 2.6)}
    <g stroke="${O}" stroke-width="3" stroke-linecap="round"><path d="M22 36 L52 33 M23 45 L44 43" /><path d="M148 43 L178 47 M147 52 L168 55"/></g>
    <g fill="${O}"><path d="M0 150 V124 q12 -12 24 0 q10 -10 22 0 V150Z M200 150 V128 q-12 -12 -24 0 q-10 -10 -22 0 V150Z"/></g>
    ${ink(`<path d="M82 152 V106 H120 V152Z" fill="#e9a878"/>
      <path d="M70 58 Q70 45 80 45 Q87 45 88 52 Q88 41 97 41 Q104 41 104 50 Q105 42 112 42 Q119 43 120 52 Q121 46 127 47 Q134 49 134 60 V92 Q134 109 117 109 H87 Q70 109 70 92Z" fill="#f6c199"/>
      <path d="M70 78 Q60 72 62 62 Q67 53 77 59 L96 74 Q103 80 97 87 Q91 91 84 87Z" fill="#f6c199"/>
      <path d="M88 52 V70 M104 50 V70 M120 52 V70" fill="none"/>`)}
    ${dots('M112 42 Q119 43 120 52 Q121 46 127 47 Q134 49 134 60 V92 Q134 109 117 109 H104 V50Z', 0.22)}
    ${ink(`<rect x="78" y="118" width="46" height="13" rx="2" fill="#ffd23f"/>`)}`,

  bribe: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#178a52"/>${rays(100, 76, 14, 190, '#c8ffd9', 0.18)}
    <circle cx="100" cy="78" r="58" fill="#2bb673" opacity=".6"/>
    <g transform="rotate(-8 100 84)">
      ${ink(`<rect x="58" y="30" width="64" height="36" rx="3" fill="#a8e08a"/><circle cx="90" cy="48" r="10" fill="#d9f5c4"/>
        <g transform="rotate(10 110 50)"><rect x="80" y="36" width="64" height="36" rx="3" fill="#c9f0ae"/><circle cx="112" cy="54" r="10" fill="#eafbdc"/><path d="M112 47 V61 M108 50.500 Q112 47 116 50.500 Q112 54 108 57.500 Q112 61 116 57.500" fill="none" stroke-width="2"/></g>
        <path d="M44 62 H156 V126 H44Z" fill="${PAPER}"/><path d="M44 62 L100 102 L156 62" fill="#e8d8a8"/>
        <circle cx="100" cy="102" r="12" fill="#e3263e"/>`, 2.8)}
      <path d="M100 94.500 V109.500 M95.500 98 Q100 94 104.500 98 Q100 102 95.500 106 Q100 110 104.500 106" stroke="${PAPER}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    </g>
    <g fill="#ffd23f" stroke="${O}" stroke-width="2.4"><circle cx="26" cy="38" r="9"/><circle cx="174" cy="32" r="8"/><circle cx="170" cy="120" r="10"/><circle cx="28" cy="124" r="8"/><circle cx="150" cy="12" r="5.500"/><circle cx="46" cy="12" r="5.500"/></g>
    <g fill="none" stroke="${O}" stroke-width="1.8"><circle cx="26" cy="38" r="5"/><circle cx="170" cy="120" r="5.500"/><circle cx="174" cy="32" r="4.500"/><circle cx="28" cy="124" r="4.500"/></g>`,

  warehouse: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#ff9a4a"/><rect width="200" height="40" fill="#3a2f7a"/><rect y="40" width="200" height="22" fill="#c2477a"/>
    ${ink(`<circle cx="36" cy="28" r="12" fill="#fff3b0"/>`, 2.6)}
    <rect y="124" width="200" height="26" fill="#262a45" stroke="${O}" stroke-width="3"/>
    ${ink(`<path d="M24 124 V64 Q100 20 176 64 V124Z" fill="#b8663a"/><path d="M20 66 Q100 14 180 66 V76 Q100 28 20 76Z" fill="#7a3c1c"/>
      <rect x="38" y="84" width="34" height="40" fill="#5a2c12"/><rect x="128" y="84" width="34" height="40" fill="#5a2c12"/><rect x="83" y="84" width="34" height="40" fill="#ffd23f"/><rect x="83" y="84" width="34" height="14" fill="#7a3c1c"/>`)}
    <g stroke="${O}" stroke-width="2"><path d="M38 94 H72 M38 104 H72 M38 114 H72 M128 94 H162 M128 104 H162 M128 114 H162"/></g>
    ${dots('M100 36 Q150 46 176 64 V124 H100Z', 0.2)}
    ${ink(`<circle cx="100" cy="60" r="10" fill="#ffd23f"/>`, 2.6)}<path d="M94.500 56 L97.500 64 L100 58 L102.500 64 L105.500 56" stroke="${O}" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
    ${crate(4, 106, 24)}${crate(170, 110, 22)}${crate(176, 90, 20, '#c98a45')}${crate(88, 106, 16)}${crate(102, 110, 13, '#c98a45')}`,

  expansion: () => {
    let grid = '';
    for (let i = 0; i <= 10; i++) grid += `M${i * 20} 0V150M0 ${i * 15}H200`;
    const win = (x, y, n) => Array.from({ length: n }, (_, i) => `<rect x="${x}" y="${y + i * 15}" width="7" height="8"/><rect x="${x + 13}" y="${y + i * 15}" width="7" height="8"/>`).join('');
    return `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#1456b8"/><path d="${grid}" stroke="#8fc4ff" stroke-width=".8" opacity=".4"/>
    ${ink(`<rect x="30" y="98" width="32" height="40" fill="#57b3ff"/><rect x="68" y="72" width="32" height="66" fill="#8fd0ff"/><rect x="106" y="44" width="32" height="94" fill="${PAPER}"/>`)}
    <g fill="${O}">${win(36, 106, 2)}${win(74, 80, 4)}${win(112, 52, 5)}</g>
    ${dots('M122 44 H138 V138 H122Z M84 72 H100 V138 H84Z M46 98 H62 V138 H46Z', 0.25)}
    <path d="M10 138 H192" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
    ${ink(`<rect x="156" y="56" width="6" height="82" fill="#ffd23f"/><rect x="138" y="54" width="54" height="6" fill="#ffd23f"/><path d="M159 44 L159 54 M159 44 L188 54 M159 44 L140 54" fill="none"/>`, 2.6)}
    <path d="M182 60 V84" stroke="${O}" stroke-width="2.4"/>${ink(`<rect x="175" y="84" width="14" height="11" fill="#e3263e"/>`, 2.4)}
    <path d="M22 88 L66 58 L104 30 L146 14" fill="none" stroke="${O}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M22 88 L66 58 L104 30 L146 14" fill="none" stroke="#ffd23f" stroke-width="5.500" stroke-linecap="round" stroke-linejoin="round"/>
    ${ink(`<path d="M168 2 L158 32 L136 8Z" fill="#ffd23f"/>`, 2.8)}`;
  },

  duplicator: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#0e8f8a"/>${rays(100, 80, 20, 190, '#b8fff5', 0.2)}
    <circle cx="100" cy="88" r="56" fill="#22b8ae" opacity=".6"/>
    <path d="M62 60 L44 130 H98 L86 60Z" fill="#b8fff5" opacity=".4"/><path d="M114 60 L102 130 H156 L138 60Z" fill="#b8fff5" opacity=".4"/>
    ${ink(`<path d="M28 26 H172 V44 H152 V60 H48 V44 H28Z" fill="#454b7a"/><rect x="80" y="32" width="40" height="9" rx="4.500" fill="#5ef2d0"/><circle cx="46" cy="35" r="4.500" fill="#ffd23f"/><circle cx="154" cy="35" r="4.500" fill="#ffd23f"/>`)}
    <rect y="130" width="200" height="20" fill="#262a45" stroke="${O}" stroke-width="3"/>
    ${crate(50, 88, 42)}
    <g stroke="#ffffff" stroke-width="6" stroke-dasharray="7 5" fill="none" stroke-linejoin="round"><rect x="108" y="88" width="42" height="42" rx="2"/></g>
    <g opacity=".9">${crate(108, 88, 42, '#ffd27a')}</g>
    ${star(160, 76, 4, 11, 3.500, `fill="#ffffff" stroke="${O}" stroke-width="2" stroke-linejoin="round"`)}${star(100, 72, 4, 8, 2.600, `fill="#ffffff" stroke="${O}" stroke-width="2" stroke-linejoin="round"`)}${star(38, 100, 4, 8, 2.600, `fill="#ffffff" stroke="${O}" stroke-width="2" stroke-linejoin="round"`)}
    ${ink(`<circle cx="100" cy="109" r="10" fill="#ffd23f"/>`, 2.6)}<path d="M95 105 l10 8 M105 105 l-10 8" stroke="${O}" stroke-width="2.800" stroke-linecap="round"/>`,

  front: () => `<defs>${DOTS}</defs>
    <rect width="200" height="150" fill="#2a2470"/><rect y="0" width="200" height="30" fill="#161a4a"/>
    ${ink(`<circle cx="166" cy="22" r="12" fill="#fff3b0"/>`, 2.4)}<circle cx="160" cy="18" r="11" fill="#161a4a"/>
    <g fill="#ffffff"><circle cx="24" cy="14" r="1.500"/><circle cx="62" cy="8" r="1.200"/><circle cx="112" cy="14" r="1.500"/><circle cx="136" cy="6" r="1.200"/></g>
    ${ink(`<rect x="20" y="42" width="160" height="96" fill="#e0916a"/>`)}<rect y="138" width="200" height="12" fill="#161225" stroke="${O}" stroke-width="3"/>
    ${dots('M100 42 H180 V138 H100Z', 0.2)}
    ${ink(`<rect x="34" y="16" width="132" height="24" rx="3" fill="${PAPER}"/><circle cx="50" cy="28" r="5.500" fill="#ff4d8a"/><circle cx="150" cy="28" r="5.500" fill="#ff4d8a"/>`, 2.8)}
    <g stroke="${O}" stroke-width="3.400" stroke-linecap="round"><path d="M66 24 H134 M78 32 H122"/></g>
    ${ink(`<path d="M26 46 H174 L182 68 H18Z" fill="#ffffff"/><path d="M26 46 H44.500 L39 68 H18Z" fill="#ff4d8a"/><path d="M63 46 H81.500 L80 68 H59.500Z" fill="#ff4d8a"/><path d="M100 46 H118.500 L120.500 68 H100Z" fill="#ff4d8a"/><path d="M137 46 H155.500 L161 68 H141Z" fill="#ff4d8a"/>
      <rect x="32" y="76" width="78" height="52" fill="#ffd23f"/><rect x="124" y="76" width="42" height="62" fill="#7a3c1c"/>`, 2.6)}
    <circle cx="132" cy="108" r="3" fill="#ffd23f" stroke="${O}" stroke-width="1.600"/>
    <g fill="${O}"><path d="M50 128 V112 Q50 97 71 97 Q92 97 92 112 V128Z"/><circle cx="71" cy="88" r="10"/><rect x="54" y="78" width="34" height="5" rx="2.500"/><path d="M60 79 Q61 66 71 66 Q81 66 82 79Z"/></g>
    <g fill="#ffd23f"><rect x="63" y="86" width="7" height="4" rx="1.600"/><rect x="72" y="86" width="7" height="4" rx="1.600"/></g>
    ${ink(`<circle cx="40" cy="121" r="6" fill="#3aa63f"/><circle cx="102" cy="121" r="6" fill="#3aa63f"/>`, 2)}<g fill="#ff4d8a" stroke="${O}" stroke-width="1.600"><circle cx="40" cy="112" r="3.400"/><circle cx="102" cy="112" r="3.400"/></g>`,
};

// ---------- deck art packs ----------
// A deck can swap the picture and the little symbol of any card. Built-in packs are drawn here;
// a custom deck (made in the Deck Maker) supplies photos instead.
const STARS = [[18, 20, 1.6], [40, 52, 1], [170, 24, 1.8], [186, 70, 1.1], [24, 110, 1.3], [60, 134, 1], [150, 130, 1.5], [120, 14, 1], [76, 22, 1.2], [178, 112, 1], [10, 70, 1], [136, 142, 1.1]]
  .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff"/>`).join('');
const space = (bg, glow) => `<defs>${DOTS}</defs><rect width="200" height="150" fill="${bg}"/>${rays(100, 78, 14, 190, glow, 0.16)}${STARS}`;
// A planet: everything in `inner` is clipped to the disc, then shaded and outlined.
const planet = (id, r, base, inner, cx = 100, cy = 78) => `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
  <g clip-path="url(#${id})"><rect width="200" height="150" fill="${base}"/>${inner}<path d="M${cx + r * 0.25} ${cy - r} A${r * 1.25} ${r * 1.25} 0 0 1 ${cx + r * 0.25} ${cy + r} L${cx + r} ${cy + r} V${cy - r}Z" fill="url(#hlDots)" opacity=".38"/></g>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${O}" stroke-width="3.4"/>
  <path d="M${cx - r * 0.62} ${cy - r * 0.42} Q${cx - r * 0.42} ${cy - r * 0.74} ${cx - r * 0.08} ${cy - r * 0.8}" stroke="#ffffff" stroke-width="4.5" fill="none" stroke-linecap="round" opacity=".85"/>`;
const sea = (top, deep) => `<defs>${DOTS}<linearGradient id="seaG${top.slice(1)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${deep}"/></linearGradient></defs>
  <rect width="200" height="150" fill="url(#seaG${top.slice(1)})"/>
  <g fill="#ffffff" opacity=".1"><path d="M20 0 L52 0 L10 150 L-30 150Z"/><path d="M84 0 L108 0 L96 150 L52 150Z"/><path d="M146 0 L176 0 L196 150 L150 150Z"/></g>
  <g fill="none" stroke="#ffffff" stroke-width="2" opacity=".8"><circle cx="24" cy="38" r="4.5"/><circle cx="32" cy="22" r="2.6"/><circle cx="176" cy="30" r="5"/><circle cx="168" cy="14" r="2.4"/><circle cx="182" cy="52" r="2.6"/></g>
  ${ink(`<path d="M-4 152 V132 Q30 122 62 130 Q100 138 138 128 Q172 120 204 130 V152Z" fill="#e8c98a"/>`, 2.8)}`;
const arm = (d, c, w = 9) => `<path d="${d}" stroke="${O}" stroke-width="${w + 5}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
const eye = (x, y, r = 6) => `${ink(`<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff"/>`, 2.2)}<circle cx="${x + r * 0.2}" cy="${y + r * 0.1}" r="${r * 0.5}" fill="${O}"/>`;

const COSMOS = {
  // a ringed gas giant
  Oil: () => `${space('#1a1040', '#b99cff')}
    <g transform="rotate(-16 100 78)">${arm('M26 78 A74 17 0 0 1 174 78', '#ffd23f', 6)}</g>
    ${planet('cpGas', 44, '#7a4df0', `<path d="M40 52 Q100 40 160 54 V64 Q100 52 40 62Z" fill="#b99cff"/><path d="M40 74 Q100 66 160 78 V90 Q100 78 40 86Z" fill="#5a2fc2"/><path d="M40 98 Q100 90 160 102 V110 Q100 100 40 106Z" fill="#c9b5ff"/><ellipse cx="116" cy="88" rx="12" ry="6" fill="#ff7ab8" stroke="${O}" stroke-width="2.4"/>`)}
    <g transform="rotate(-16 100 78)">${arm('M26 78 A74 17 0 0 0 174 78', '#ffd23f', 6)}</g>
    ${star(164, 30, 4, 9, 3.5, `fill="#ffffff" stroke="${O}" stroke-width="2"`)}`,
  // a cratered desert world and its moon
  Livestock: () => `${space('#2b1408', '#ffc27a')}
    ${planet('cpDust', 46, '#f2742b', `<path d="M40 60 Q80 48 120 60 T170 58 V70 Q130 62 100 72 T40 72Z" fill="#ffab5c"/><path d="M40 96 Q90 84 160 100 V112 Q100 98 40 108Z" fill="#c9551a"/>
      ${ink(`<circle cx="82" cy="70" r="10" fill="#c9551a"/><circle cx="118" cy="96" r="13" fill="#c9551a"/><circle cx="112" cy="52" r="6" fill="#c9551a"/><circle cx="74" cy="104" r="5" fill="#c9551a"/>`, 2.4)}`)}
    ${planet('cpMoon', 13, '#d9d3c4', `<circle cx="158" cy="32" r="3.4" fill="#aaa391"/><circle cx="165" cy="40" r="2.4" fill="#aaa391"/>`, 162, 36)}`,
  // a green world of jungle and cloud
  Farmland: () => `${space('#0c2a14', '#a8f0a0')}
    ${planet('cpJungle', 46, '#2c9fd6', `${ink(`<path d="M58 50 Q78 38 96 50 Q110 60 100 74 Q84 84 70 76 Q52 66 58 50Z" fill="#3aa63f"/><path d="M108 84 Q128 74 142 88 Q150 104 134 114 Q112 120 104 104 Q100 92 108 84Z" fill="#3aa63f"/><path d="M60 96 Q72 90 80 98 Q84 110 72 114 Q58 110 60 96Z" fill="#1f7a2c"/><path d="M122 46 Q136 44 142 56 Q136 64 126 60Z" fill="#1f7a2c"/>`, 2.4)}
      <g fill="#ffffff" opacity=".9"><ellipse cx="88" cy="62" rx="16" ry="4"/><ellipse cx="126" cy="98" rx="18" ry="4.5"/><ellipse cx="70" cy="88" rx="10" ry="3"/></g>`)}
    ${ink(`<path d="M160 34 L168 20 L176 34 Z" fill="#ffd23f"/><rect x="163" y="34" width="10" height="12" rx="2" fill="${PAPER}"/><path d="M163 46 L158 52 H168Z M173 46 L178 52 H168Z" fill="#e3263e"/>`, 2.2)}`,
  // a molten world, cracked and glowing
  Weapons: () => `${space('#2a0608', '#ff8a3c')}${rays(100, 78, 20, 78, '#ffb21f', 0.5)}
    ${planet('cpLava', 44, '#4a0f16', `<g fill="none" stroke="#ff5a1f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M60 54 L82 70 L74 92 L96 108 L90 124"/><path d="M82 70 L108 62 L128 78 L150 72"/><path d="M108 62 L112 40"/><path d="M96 108 L122 100 L140 112"/></g>
      <g fill="none" stroke="#ffd23f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M60 54 L82 70 L74 92 L96 108 L90 124"/><path d="M82 70 L108 62 L128 78 L150 72"/><path d="M108 62 L112 40"/><path d="M96 108 L122 100 L140 112"/></g>
      ${ink(`<circle cx="118" cy="90" r="7" fill="#ffb21f"/><circle cx="72" cy="80" r="4" fill="#ffb21f"/>`, 2.2)}`)}
    ${ink(`<path d="M34 34 L44 26 L42 40 L52 44 L38 48Z" fill="#ffd23f"/><path d="M160 116 L172 112 L168 124 L176 130 L162 130Z" fill="#ffd23f"/>`, 2.2)}`,
  // a water world with a station in orbit
  Workers: () => `${space('#071c3a', '#9ad6ff')}
    ${planet('cpOcean', 46, '#1f86e6', `<path d="M40 56 Q70 46 100 56 T160 54 V62 Q130 56 100 64 T40 64Z" fill="#6cc0ff"/><path d="M40 90 Q80 80 120 92 T170 88 V98 Q130 94 100 102 T40 100Z" fill="#1560c4"/>
      <g fill="#ffffff"><path d="M66 74 Q82 62 100 72 Q112 80 104 88 Q98 80 86 80 Q74 82 66 74Z"/><ellipse cx="124" cy="62" rx="14" ry="4"/><ellipse cx="84" cy="106" rx="16" ry="4"/></g>`)}
    ${ink(`<rect x="150" y="26" width="16" height="12" rx="3" fill="${PAPER}"/><rect x="126" y="28" width="22" height="8" fill="#ffd23f"/><rect x="168" y="28" width="22" height="8" fill="#ffd23f"/><path d="M158 26 V18" fill="none"/><circle cx="158" cy="16" r="2.6" fill="#e3263e"/>`, 2.2)}
    <path d="M137 28 V36 M179 28 V36" stroke="${O}" stroke-width="2"/>`,
};
const REEF = {
  Oil: () => `${sea('#5a3fc2', '#241457')}
    ${arm('M74 78 Q52 98 36 92 Q24 86 30 74', '#9a6cf5')}${arm('M84 86 Q70 112 50 116 Q38 116 40 106', '#9a6cf5')}${arm('M96 90 Q92 116 80 126', '#9a6cf5')}
    ${arm('M106 90 Q112 116 124 126', '#9a6cf5')}${arm('M116 86 Q132 112 152 114 Q164 112 160 102', '#9a6cf5')}${arm('M126 78 Q148 96 164 90 Q176 84 170 72', '#9a6cf5')}
    ${ink(`<path d="M66 82 Q58 28 100 28 Q142 28 134 82 Q118 94 100 92 Q82 94 66 82Z" fill="#9a6cf5"/>`)}
    ${dots('M100 28 Q142 28 134 82 Q124 90 112 92 Q128 60 100 28Z', 0.34)}
    ${eye(86, 64, 9)}${eye(114, 64, 9)}
    <path d="M90 80 Q100 87 110 80" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g fill="#c9b5ff" stroke="${O}" stroke-width="1.6"><circle cx="40" cy="90" r="3"/><circle cx="160" cy="92" r="3"/><circle cx="52" cy="114" r="3"/><circle cx="150" cy="112" r="3"/></g>`,
  Livestock: () => `${sea('#12a3b8', '#0a4d6e')}
    ${ink(`<path d="M58 78 L24 50 Q34 78 24 106Z" fill="#ff8a2b"/><path d="M92 50 Q108 34 124 48 Z" fill="#ff8a2b"/><path d="M92 106 Q104 122 118 108Z" fill="#ff8a2b"/>`)}
    <clipPath id="rfFish"><ellipse cx="102" cy="78" rx="50" ry="30"/></clipPath>
    <g clip-path="url(#rfFish)"><rect width="200" height="150" fill="#ff8a2b"/><g fill="#ffffff" stroke="${O}" stroke-width="3"><path d="M70 40 Q80 78 70 116 H84 Q94 78 84 40Z"/><path d="M104 40 Q114 78 104 116 H116 Q126 78 116 40Z"/></g><path d="M130 48 Q160 78 130 108 H160 V48Z" fill="url(#hlDots)" opacity=".3"/></g>
    <ellipse cx="102" cy="78" rx="50" ry="30" fill="none" stroke="${O}" stroke-width="3.4"/>
    ${eye(134, 70, 7)}
    <path d="M144 86 Q150 88 152 82" stroke="${O}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    ${ink(`<path d="M30 132 Q26 110 34 96 Q38 112 44 118 Q46 104 54 98 Q54 118 60 132Z" fill="#35d08a"/><path d="M160 132 Q158 114 166 104 Q170 118 176 132Z" fill="#35d08a"/>`, 2.4)}`,
  Farmland: () => `${sea('#16a394', '#0a4a52')}
    ${ink(`<path d="M62 96 Q40 100 30 118 Q50 118 70 104Z" fill="#8bd66a"/><path d="M124 100 Q140 120 160 120 Q156 104 138 94Z" fill="#8bd66a"/><path d="M146 80 Q150 62 168 62 Q184 64 184 78 Q182 92 166 92 Q152 92 146 80Z" fill="#8bd66a"/><path d="M52 84 Q38 80 30 86 Q40 92 52 90Z" fill="#8bd66a"/>`)}
    ${ink(`<path d="M50 94 Q52 40 100 40 Q148 40 150 94 Q100 108 50 94Z" fill="#3aa63f"/>`)}
    <g fill="none" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"><path d="M86 54 L114 54 L124 72 L112 90 L88 90 L76 72Z"/><path d="M86 54 L78 44 M114 54 L122 44 M124 72 L146 70 M76 72 L54 70 M112 90 L118 100 M88 90 L82 100"/></g>
    <path d="M86 54 L114 54 L124 72 L112 90 L88 90 L76 72Z" fill="#7be36a" opacity=".55"/>
    ${dots('M100 40 Q148 40 150 94 Q134 98 120 100 Q140 70 100 40Z', 0.32)}
    ${eye(170, 74, 5)}
    <path d="M172 84 Q178 86 180 82" stroke="${O}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  Weapons: () => `${sea('#2b6fb8', '#12305e')}
    <g fill="none" stroke="${O}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M64 98 L40 106 L34 122"/><path d="M68 106 L50 120 L50 134"/><path d="M136 98 L160 106 L166 122"/><path d="M132 106 L150 120 L150 134"/></g>
    <g fill="none" stroke="#e3263e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M64 98 L40 106 L34 122"/><path d="M68 106 L50 120 L50 134"/><path d="M136 98 L160 106 L166 122"/><path d="M132 106 L150 120 L150 134"/></g>
    ${arm('M68 84 Q50 78 44 60', '#e3263e', 7)}${arm('M132 84 Q150 78 156 60', '#e3263e', 7)}
    ${ink(`<path d="M44 60 Q24 56 26 38 Q30 26 42 28 L40 42 L52 34 Q62 46 44 60Z" fill="#ff5d73"/><path d="M156 60 Q176 56 174 38 Q170 26 158 28 L160 42 L148 34 Q138 46 156 60Z" fill="#ff5d73"/>`)}
    ${ink(`<ellipse cx="100" cy="94" rx="42" ry="26" fill="#e3263e"/>`)}
    ${dots('M100 68 A42 26 0 0 1 100 120 A60 40 0 0 0 100 68Z', 0.34)}
    <path d="M88 70 V56 M112 70 V56" stroke="${O}" stroke-width="4" stroke-linecap="round"/>${eye(88, 52, 6)}${eye(112, 52, 6)}
    <path d="M86 102 Q100 112 114 102" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  Workers: () => `${sea('#3f9be8', '#103a78')}
    ${ink(`<path d="M22 86 Q26 44 90 42 Q146 42 166 76 L190 54 Q184 80 192 104 L166 92 Q132 122 70 118 Q26 112 22 86Z" fill="#2f7fe0"/>`)}
    ${ink(`<path d="M24 92 Q60 104 110 100 Q140 98 160 90 Q130 120 70 118 Q30 112 24 92Z" fill="#cfe8ff"/>`, 2.4)}
    <g stroke="${O}" stroke-width="2" fill="none"><path d="M44 104 Q46 110 44 114 M60 107 Q62 113 60 117 M76 108 Q78 114 76 118"/></g>
    ${dots('M90 42 Q146 42 166 76 L166 92 Q150 96 130 98 Q150 66 90 42Z', 0.3)}
    ${eye(52, 76, 5.5)}
    ${ink(`<path d="M100 96 Q112 112 130 108 Q120 100 116 94Z" fill="#2f7fe0"/>`, 2.4)}
    <g stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round"><path d="M70 36 Q70 20 58 14"/><path d="M70 36 Q72 20 84 14"/><path d="M70 36 V16"/></g>`,
};
const ICONS = {
  cosmos: {
    Oil: '<circle cx="8" cy="8" r="4.2"/><path d="M.8 10.8Q8 14 15.2 5.2Q8 10.4.8 10.8Z"/>',
    Livestock: '<path fill-rule="evenodd" d="M8 2a6 6 0 1 0 0 12a6 6 0 0 0 0-12ZM6 5.2a1.4 1.4 0 1 0 0 2.8a1.4 1.4 0 0 0 0-2.8ZM10.4 8.4a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 0 0 0-3.6Z"/>',
    Farmland: '<path fill-rule="evenodd" d="M8 2a6 6 0 1 0 0 12a6 6 0 0 0 0-12ZM5 10.5Q5 5.5 11 5.5Q11 10.5 5 10.5Z"/>',
    Weapons: '<path fill-rule="evenodd" d="M8 2a6 6 0 1 0 0 12a6 6 0 0 0 0-12ZM7.6 3L9.4 6.4L7.4 8.2L9.6 13L8.2 13L5.8 8L7.8 6.2L6.4 3.2Z"/>',
    Workers: '<path fill-rule="evenodd" d="M8 2a6 6 0 1 0 0 12a6 6 0 0 0 0-12ZM2.8 7.2Q5.4 5.2 8 7.2T13.2 7.2V8.8Q10.6 6.8 8 8.8T2.8 8.8Z"/>',
  },
  reef: {
    Oil: '<path d="M8 1.5C4.8 1.5 3 4 3 6.6c0 1.4.5 2.4 1.2 3.100L3 13.5h1.6l.9-2.6.7 3.100h1.4l.4-3 .4 3h1.4l.7-3.100.9 2.6H13l-1.2-3.8c.7-.7 1.2-1.700 1.2-3.100C13 4 11.2 1.5 8 1.5Z"/>',
    Livestock: '<path d="M1.5 8C3.5 4.5 7 3.5 10 5L14.5 2.5V13.5L10 11C7 12.5 3.5 11.5 1.5 8Z"/>',
    Farmland: '<ellipse cx="7.5" cy="8.5" rx="4.6" ry="3.6"/><circle cx="13.2" cy="7.4" r="1.8"/><path d="M4 5.5L2 3.5L5.5 4.5ZM4 11.5L2 13.5L5.5 12.5ZM11 12L12.5 13.8L9.8 12.8ZM10.5 5L12 3.2L9.5 4.3Z"/>',
    Weapons: '<ellipse cx="8" cy="10.5" rx="4.5" ry="3"/><path d="M2.2 2.5A2.3 2.3 0 1 0 5 6L3.6 4.8L5 3.8A2.3 2.3 0 0 0 2.2 2.5ZM13.8 2.5A2.3 2.3 0 1 1 11 6L12.4 4.8L11 3.8A2.3 2.3 0 0 1 13.8 2.5ZM3.8 6.2L5.6 8.4L4.8 9L3 6.8ZM12.2 6.2L10.4 8.4L11.2 9L13 6.8Z"/>',
    Workers: '<path d="M1.5 9C1.5 6 4 4 7.5 4C10.5 4 12.3 5.5 13 7.5L15 5.5C14.8 7.3 15.100 8.8 15.5 10L13.2 9.100C12 11.5 9.8 12.5 7 12.5C3.8 12.5 1.5 11.2 1.5 9Z"/>',
  },
};
const glow = (bg, c) => `<defs>${DOTS}</defs><rect width="200" height="150" fill="${bg}"/>${rays(100, 80, 16, 190, c, 0.2)}<circle cx="100" cy="80" r="56" fill="${c}" opacity=".22"/>`;
const sparkle = (x, y, r = 8) => star(x, y, 4, r, r * 0.36, `fill="#ffffff" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"`);
const FANTASY = {
  // a wizard under a starry hat
  Oil: () => `${glow('#2a1466', '#b99cff')}
    ${ink(`<path d="M150 150 V46" fill="none" stroke-width="7"/>`)}<path d="M150 150 V46" stroke="#8a4a22" stroke-width="3.6"/>
    ${ink(`<circle cx="150" cy="38" r="11" fill="#5ef2d0"/>`)}${sparkle(150, 38, 6)}
    ${ink(`<path d="M52 152 Q56 112 84 106 H116 Q144 112 148 152Z" fill="#5a2fc2"/>`)}
    ${ink(`<circle cx="100" cy="84" r="24" fill="#f2c9a0"/>`)}
    ${ink(`<path d="M76 92 Q80 136 100 144 Q120 136 124 92 Q112 104 100 102 Q88 104 76 92Z" fill="#ffffff"/>`)}
    <circle cx="91" cy="82" r="3" fill="${O}"/><circle cx="109" cy="82" r="3" fill="${O}"/><path d="M84 74 q6 -5 12 0 M104 74 q6 -5 12 0" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${ink(`<path d="M70 66 Q88 10 124 14 Q112 22 116 36 Q124 54 130 66Z" fill="#7a4df0"/><ellipse cx="100" cy="66" rx="42" ry="9" fill="#7a4df0"/>`)}
    ${dots('M104 20 Q112 22 116 36 Q124 54 130 66 L142 66 Q140 74 100 75 Z', 0.34)}
    ${star(96, 44, 5, 8, 3.4, `fill="#ffd23f" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"`)}${sparkle(34, 40)}${sparkle(170, 96, 6)}`,
  // a phoenix rising
  Livestock: () => `${glow('#3a1206', '#ffb21f')}
    ${ink(`<path d="M100 96 Q60 40 14 34 Q26 54 22 70 Q40 66 44 84 Q60 78 66 100Z" fill="#ff8a2b"/><path d="M100 96 Q140 40 186 34 Q174 54 178 70 Q160 66 156 84 Q140 78 134 100Z" fill="#ff8a2b"/>`)}
    ${ink(`<path d="M22 70 Q40 66 44 84 Q60 78 66 100 L84 100 Q60 62 22 70Z" fill="#ffd23f"/><path d="M178 70 Q160 66 156 84 Q140 78 134 100 L116 100 Q140 62 178 70Z" fill="#ffd23f"/>`, 2.4)}
    ${ink(`<path d="M88 112 Q80 138 70 150 Q90 144 96 128 Q98 146 100 152 Q104 146 104 128 Q112 144 130 150 Q120 138 112 112Z" fill="#e3263e"/>`)}
    ${ink(`<ellipse cx="100" cy="94" rx="20" ry="28" fill="#f2742b"/><circle cx="100" cy="58" r="15" fill="#f2742b"/>`)}
    ${ink(`<path d="M94 46 Q90 28 100 22 Q98 34 106 40 Q108 28 116 30 Q112 40 110 48Z" fill="#ffd23f"/><path d="M100 62 L92 74 L108 74Z" fill="#ffd23f"/>`, 2.4)}
    <circle cx="94" cy="56" r="2.6" fill="${O}"/><circle cx="106" cy="56" r="2.6" fill="${O}"/>
    ${dots('M100 66 A20 28 0 0 1 100 122 A30 34 0 0 0 100 66Z', 0.3)}`,
  // a grinning goblin
  Farmland: () => `${glow('#123a1a', '#a8f0a0')}
    ${ink(`<path d="M56 152 Q60 122 84 116 H116 Q140 122 144 152Z" fill="#8a4a22"/>`)}
    ${ink(`<path d="M62 72 L16 46 Q26 84 58 96Z" fill="#3aa63f"/><path d="M138 72 L184 46 Q174 84 142 96Z" fill="#3aa63f"/>`)}
    <path d="M30 56 Q40 74 56 82" stroke="#1f7a2c" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M170 56 Q160 74 144 82" stroke="#1f7a2c" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${ink(`<path d="M56 76 Q56 36 100 36 Q144 36 144 76 Q144 122 100 124 Q56 122 56 76Z" fill="#3aa63f"/>`)}
    ${dots('M100 36 Q144 36 144 76 Q144 122 100 124 Q130 80 100 36Z', 0.3)}
    ${ink(`<ellipse cx="82" cy="72" rx="12" ry="10" fill="#ffd23f"/><ellipse cx="118" cy="72" rx="12" ry="10" fill="#ffd23f"/>`, 2.4)}
    <ellipse cx="84" cy="73" rx="3" ry="7" fill="${O}"/><ellipse cx="116" cy="73" rx="3" ry="7" fill="${O}"/>
    <path d="M68 60 L92 64 M132 60 L108 64" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
    ${ink(`<path d="M74 96 Q100 116 126 96 Q100 104 74 96Z" fill="#14121f"/><path d="M82 99 L86 108 L90 101Z M110 101 L114 108 L118 99Z" fill="#ffffff"/>`, 2.2)}
    ${ink(`<path d="M96 80 Q100 92 104 80Z" fill="#1f7a2c"/>`, 2)}`,
  // a dragon, wings spread, breathing fire
  Weapons: () => `${glow('#3a0a10', '#ff8a3c')}
    ${ink(`<path d="M84 70 Q50 24 10 30 Q22 44 18 62 Q34 58 36 76 Q54 70 60 92Z" fill="#a3142a"/><path d="M116 70 Q150 24 190 30 Q178 44 182 62 Q166 58 164 76 Q146 70 140 92Z" fill="#a3142a"/>`)}
    ${ink(`<path d="M72 50 L60 18 L86 40Z" fill="#ffd23f"/><path d="M128 50 L140 18 L114 40Z" fill="#ffd23f"/>`, 2.6)}
    ${ink(`<path d="M64 62 Q64 36 100 36 Q136 36 136 62 Q138 84 124 100 Q118 120 100 120 Q82 120 76 100 Q62 84 64 62Z" fill="#e3263e"/>`)}
    ${dots('M100 36 Q136 36 136 62 Q138 84 124 100 Q118 120 100 120 Q122 80 100 36Z', 0.34)}
    ${ink(`<path d="M72 64 Q84 56 94 68 Q84 76 72 64Z" fill="#ffd23f"/><path d="M128 64 Q116 56 106 68 Q116 76 128 64Z" fill="#ffd23f"/>`, 2.4)}
    <ellipse cx="84" cy="66" rx="2.4" ry="5" fill="${O}"/><ellipse cx="116" cy="66" rx="2.4" ry="5" fill="${O}"/>
    <circle cx="92" cy="100" r="3" fill="${O}"/><circle cx="108" cy="100" r="3" fill="${O}"/>
    ${ink(`<path d="M84 122 Q76 140 64 150 Q92 150 100 134 Q108 150 136 150 Q124 140 116 122 Q100 132 84 122Z" fill="#ffb21f"/><path d="M92 128 Q90 140 84 148 Q98 146 100 138 Q102 146 116 148 Q110 140 108 128Z" fill="#fff3c4"/>`, 2.4)}`,
  // a unicorn in moonlight
  Workers: () => `${glow('#0f2a5c', '#9ad6ff')}
    ${ink(`<path d="M70 152 Q64 104 84 78 Q92 56 112 50 Q140 44 160 70 Q170 86 168 100 Q164 110 152 106 Q140 96 126 100 Q124 124 134 152Z" fill="#f2f6ff"/>`)}
    ${ink(`<path d="M112 50 Q84 36 60 54 Q72 56 70 68 Q54 70 46 88 Q60 84 62 96 Q48 104 46 124 Q60 112 66 118 Q62 134 70 152 Q64 104 84 78 Q92 56 112 50Z" fill="#1f86e6"/>`)}
    ${ink(`<path d="M120 52 L138 6 L134 56Z" fill="#ffd23f"/>`, 2.6)}<path d="M126 40 L134 36 M124 48 L135 44 M129 30 L135 26" stroke="${O}" stroke-width="2"/>
    ${ink(`<path d="M106 54 L98 34 L116 48Z" fill="#f2f6ff"/>`, 2.6)}
    ${dots('M126 100 Q124 124 134 152 L104 152 Q112 120 126 100Z', 0.26)}
    <circle cx="140" cy="74" r="4" fill="${O}"/><path d="M134 68 q6 -5 12 -1" stroke="${O}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="162" cy="96" r="2" fill="${O}"/>
    ${sparkle(30, 34)}${sparkle(176, 30, 6)}${sparkle(22, 110, 5)}`,
};
const dinoBg = (sky, sun, ground) => `<defs>${DOTS}</defs><rect width="200" height="150" fill="${sky}"/>${rays(150, 36, 14, 200, sun, 0.2)}
  ${ink(`<circle cx="150" cy="36" r="18" fill="${sun}"/>`, 2.6)}
  ${ink(`<path d="M-4 152 V96 L26 62 L44 84 L60 70 L84 104 V152Z" fill="#6b4a3a"/><path d="M20 70 L26 62 L32 70 Q26 74 20 70Z" fill="#ff5a1f"/>`, 2.6)}
  ${ink(`<path d="M-4 152 V124 Q50 110 100 122 Q150 132 204 118 V152Z" fill="${ground}"/>`, 2.8)}`;
const fern = (x, y, c = '#1f7a2c') => ink(`<path d="M${x} ${y} Q${x - 10} ${y - 20} ${x - 18} ${y - 22} Q${x - 10} ${y - 14} ${x - 4} ${y} Z M${x} ${y} Q${x} ${y - 24} ${x + 4} ${y - 30} Q${x + 6} ${y - 16} ${x + 4} ${y}Z M${x + 2} ${y} Q${x + 14} ${y - 18} ${x + 22} ${y - 18} Q${x + 12} ${y - 10} ${x + 6} ${y}Z" fill="${c}"/>`, 2);
const DINOS = {
  // a pterodactyl gliding
  Oil: () => `${dinoBg('#c9b5ff', '#ffe9a8', '#3aa63f')}
    ${ink(`<path d="M96 70 Q60 30 12 40 Q30 52 34 70 Q52 66 60 84 Q76 78 88 92Z" fill="#7a4df0"/><path d="M104 70 Q140 30 188 40 Q170 52 166 70 Q148 66 140 84 Q124 78 112 92Z" fill="#7a4df0"/>`)}
    <path d="M34 70 Q60 60 88 80 M166 70 Q140 60 112 80" stroke="${O}" stroke-width="2" fill="none"/>
    ${ink(`<ellipse cx="100" cy="88" rx="13" ry="20" fill="#9a78ff"/>`)}
    ${ink(`<path d="M92 66 Q92 48 104 46 Q116 46 118 58 L152 66 L118 70 Q112 76 100 74Z" fill="#9a78ff"/><path d="M96 50 L70 34 L98 60Z" fill="#5a2fc2"/>`)}
    <circle cx="106" cy="57" r="3" fill="${O}"/>
    ${ink(`<path d="M94 106 L90 120 M106 106 L110 120" fill="none"/>`, 3)}${fern(30, 136)}${fern(170, 132)}`,
  // a tyrannosaurus mid-roar
  Livestock: () => `${dinoBg('#ffd9a0', '#fff3c4', '#3aa63f')}
    ${ink(`<path d="M104 96 Q150 90 196 118 Q150 112 112 122Z" fill="#f2742b"/>`)}
    ${ink(`<path d="M84 128 L80 146 H96 L98 130Z M112 126 L114 146 H130 L126 122Z" fill="#c9551a"/>`)}
    ${ink(`<path d="M70 86 Q72 60 100 64 Q134 70 132 104 Q128 130 100 130 Q72 128 70 100Z" fill="#f2742b"/>`)}
    ${ink(`<path d="M74 92 L18 84 Q10 70 22 60 Q30 40 60 40 Q92 40 100 64 Q96 84 74 92Z" fill="#f2742b"/>`)}
    ${ink(`<path d="M22 72 L70 78 Q66 88 56 90 L24 86Z" fill="#7a1420"/><path d="M26 73 L30 80 L34 74 L38 81 L42 75 L46 82 L50 76 L54 83 L58 77Z" fill="#ffffff"/>`, 2)}
    ${ink(`<circle cx="62" cy="54" r="6" fill="#ffd23f"/>`, 2.2)}<circle cx="61" cy="55" r="2.6" fill="${O}"/><path d="M52 44 L72 48" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="24" cy="64" r="1.8" fill="${O}"/>
    ${ink(`<path d="M86 100 Q76 104 72 112 L78 114 M80 108 L74 118" fill="none"/>`, 3.4)}
    ${dots('M100 64 Q134 70 132 104 Q128 130 100 130 Q122 100 100 64Z', 0.3)}${fern(176, 138)}`,
  // a long-necked brontosaurus
  Farmland: () => `${dinoBg('#bfe8ff', '#fff3c4', '#7be36a')}
    ${ink(`<path d="M132 96 Q170 96 196 120 Q164 112 136 118Z" fill="#3aa63f"/>`)}
    ${ink(`<path d="M70 112 L66 146 H82 L86 116Z M118 112 L122 146 H138 L134 108Z" fill="#1f7a2c"/>`)}
    ${ink(`<path d="M56 100 Q58 76 96 76 Q140 76 144 104 Q140 126 100 126 Q58 124 56 100Z" fill="#3aa63f"/>`)}
    ${ink(`<path d="M62 92 Q40 70 44 34 Q46 16 62 14 Q78 14 80 26 Q80 34 70 36 L60 36 Q58 64 84 82Z" fill="#3aa63f"/>`)}
    <circle cx="66" cy="24" r="3" fill="${O}"/><path d="M70 32 Q76 32 78 28" stroke="${O}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <g fill="#1f7a2c" stroke="${O}" stroke-width="1.6"><circle cx="90" cy="92" r="5"/><circle cx="110" cy="100" r="6"/><circle cx="124" cy="90" r="4"/><circle cx="52" cy="56" r="3"/></g>
    ${dots('M96 76 Q140 76 144 104 Q140 126 100 126 Q130 104 96 76Z', 0.3)}${fern(22, 138, '#1f7a2c')}`,
  // a triceratops, horns forward
  Weapons: () => `${dinoBg('#ffc2b0', '#fff3c4', '#3aa63f')}
    ${ink(`<path d="M150 98 Q180 100 196 116 Q170 112 152 116Z" fill="#e3263e"/>`)}
    ${ink(`<path d="M96 116 L94 146 H110 L112 120Z M134 114 L138 146 H154 L150 108Z" fill="#a3142a"/>`)}
    ${ink(`<path d="M84 96 Q88 70 126 72 Q160 76 160 102 Q156 124 122 124 Q88 124 84 96Z" fill="#e3263e"/>`)}
    ${ink(`<path d="M96 44 Q70 28 54 46 Q44 66 60 86 L96 96 Q112 70 96 44Z" fill="#ff5d73"/>`)}
    <g fill="#ffd23f" stroke="${O}" stroke-width="1.6"><circle cx="66" cy="44" r="3"/><circle cx="80" cy="38" r="3"/><circle cx="94" cy="46" r="3"/></g>
    ${ink(`<path d="M30 78 Q28 60 46 58 Q72 58 82 78 Q84 98 62 104 Q40 106 30 96 L20 94 Q22 84 30 78Z" fill="#e3263e"/>`)}
    ${ink(`<path d="M58 62 L48 26 L70 60Z" fill="${PAPER}"/><path d="M40 62 L22 34 L50 58Z" fill="${PAPER}"/><path d="M26 84 L8 78 L28 92Z" fill="${PAPER}"/>`, 2.6)}
    <circle cx="52" cy="76" r="3.4" fill="${O}"/><path d="M34 98 Q42 100 48 96" stroke="${O}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    ${dots('M126 72 Q160 76 160 102 Q156 124 122 124 Q146 100 126 72Z', 0.3)}${fern(182, 140)}`,
  // a stegosaurus with its plates up
  Workers: () => `${dinoBg('#bfe0ff', '#fff3c4', '#7be36a')}
    ${ink(`<path d="M70 70 L78 44 L90 66Z M92 62 L104 30 L116 60Z M118 62 L130 36 L140 66Z M142 72 L152 52 L158 78Z" fill="#ffd23f"/>`, 2.6)}
    ${ink(`<path d="M150 92 Q176 92 194 110 L186 112 Q172 104 152 110Z" fill="#1f86e6"/><path d="M180 100 L190 88 M186 106 L198 98" fill="none"/>`)}
    ${ink(`<path d="M72 114 L70 146 H86 L88 118Z M126 114 L130 146 H146 L142 108Z" fill="#1560c4"/>`)}
    ${ink(`<path d="M52 104 Q56 62 106 62 Q156 64 160 100 Q154 124 106 124 Q62 124 52 104Z" fill="#1f86e6"/>`)}
    ${ink(`<path d="M58 96 Q36 92 22 104 Q14 112 22 120 Q34 124 50 116 Q60 112 62 104Z" fill="#1f86e6"/>`)}
    <circle cx="30" cy="108" r="3" fill="${O}"/><path d="M22 116 Q30 119 36 116" stroke="${O}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    ${dots('M106 62 Q156 64 160 100 Q154 124 106 124 Q140 96 106 62Z', 0.3)}${fern(176, 140, '#1f7a2c')}`,
};
const banner = (bg, c) => `<defs>${DOTS}</defs><rect width="200" height="150" fill="${bg}"/>${rays(100, 78, 12, 190, c, 0.18)}
  <g fill="${c}" opacity=".3"><path d="M0 0 H200 V14 L190 22 L180 14 L170 22 L160 14 L150 22 L140 14 L130 22 L120 14 L110 22 L100 14 L90 22 L80 14 L70 22 L60 14 L50 22 L40 14 L30 22 L20 14 L10 22 L0 14Z"/></g>`;
const MEDIEVAL = {
  // a crown on a cushion
  Oil: () => `${banner('#3b1f8a', '#c9b5ff')}
    ${ink(`<path d="M34 116 Q100 100 166 116 Q172 134 160 140 H40 Q28 134 34 116Z" fill="#7a4df0"/>`)}
    ${ink(`<circle cx="34" cy="128" r="6" fill="#ffd23f"/><circle cx="166" cy="128" r="6" fill="#ffd23f"/>`, 2.4)}
    ${ink(`<path d="M56 108 L46 48 L74 76 L100 34 L126 76 L154 48 L144 108Z" fill="#ffd23f"/><rect x="54" y="98" width="92" height="16" rx="4" fill="#f0a91e"/>`)}
    ${dots('M100 34 L126 76 L154 48 L144 108 H104Z', 0.3)}
    ${ink(`<circle cx="46" cy="46" r="7" fill="#e3263e"/><circle cx="100" cy="32" r="8" fill="#5ef2d0"/><circle cx="154" cy="46" r="7" fill="#e3263e"/><circle cx="76" cy="106" r="4.5" fill="#1f86e6"/><circle cx="100" cy="106" r="5.5" fill="#e3263e"/><circle cx="124" cy="106" r="4.5" fill="#1f86e6"/>`, 2.2)}
    ${sparkle(170, 40, 7)}${sparkle(28, 80, 6)}`,
  // a war horse in its bridle
  Livestock: () => `${banner('#7a3a12', '#ffc27a')}
    ${ink(`<path d="M64 152 Q56 110 76 82 Q84 56 108 48 Q140 42 160 70 Q174 92 170 108 Q164 118 152 112 Q140 100 126 104 Q122 128 132 152Z" fill="#c9742b"/>`)}
    ${ink(`<path d="M108 48 Q84 34 62 52 Q72 56 70 68 Q54 72 48 92 Q62 86 64 98 Q52 108 52 128 Q62 116 68 122 Q64 138 68 152 Q58 110 76 82 Q84 56 108 48Z" fill="#3b1d0c"/>`)}
    ${ink(`<path d="M104 52 L96 30 L116 46Z M122 48 L122 26 L134 48Z" fill="#c9742b"/>`, 2.6)}
    <g fill="none" stroke="${O}" stroke-width="6" stroke-linecap="round"><path d="M112 66 L168 96"/><path d="M146 58 L132 104"/></g>
    <g fill="none" stroke="#e3263e" stroke-width="2.6" stroke-linecap="round"><path d="M112 66 L168 96"/><path d="M146 58 L132 104"/></g>
    ${ink(`<circle cx="140" cy="80" r="5" fill="#ffd23f"/>`, 2)}
    <circle cx="136" cy="68" r="4" fill="${O}"/><circle cx="163" cy="100" r="2.2" fill="${O}"/>
    ${dots('M126 104 Q122 128 132 152 L100 152 Q110 124 126 104Z', 0.3)}`,
  // a castle on a green hill
  Farmland: () => `${banner('#2c9fd6', '#ffffff')}
    ${ink(`<path d="M-4 152 V118 Q50 96 100 106 Q150 96 204 118 V152Z" fill="#3aa63f"/>`)}
    ${ink(`<rect x="62" y="62" width="76" height="56" fill="#c8cfd8"/><path d="M62 62 V50 H74 V58 H86 V50 H98 V58 H110 V50 H122 V58 H134 V50 H138 V62Z" fill="#c8cfd8"/>`)}
    ${ink(`<rect x="40" y="44" width="28" height="74" fill="#aab3bf"/><path d="M36 44 L54 16 L72 44Z" fill="#e3263e"/><rect x="132" y="44" width="28" height="74" fill="#aab3bf"/><path d="M128 44 L146 16 L164 44Z" fill="#e3263e"/>`)}
    ${ink(`<path d="M88 118 V94 Q88 82 100 82 Q112 82 112 94 V118Z" fill="#5a2c12"/>`)}<path d="M100 84 V118 M88 100 H112" stroke="${O}" stroke-width="2"/>
    <g fill="${O}"><rect x="50" y="62" width="7" height="14" rx="3"/><rect x="142" y="62" width="7" height="14" rx="3"/><rect x="76" y="72" width="6" height="12" rx="3"/><rect x="118" y="72" width="6" height="12" rx="3"/></g>
    ${ink(`<path d="M54 16 V4 L70 9 L54 13" fill="#ffd23f"/><path d="M146 16 V4 L162 9 L146 13" fill="#ffd23f"/>`, 2.2)}
    ${dots('M146 44 H160 V118 H138 V62 H146Z', 0.3)}`,
  // a sword laid over a shield
  Weapons: () => `${banner('#7a1420', '#ffb3a0')}
    ${ink(`<path d="M54 30 H146 V84 Q146 122 100 142 Q54 122 54 84Z" fill="#e3263e"/>`)}
    ${ink(`<path d="M100 30 V142 Q54 122 54 84 V30Z" fill="${PAPER}"/>`, 2.6)}
    ${dots('M100 30 H146 V84 Q146 122 100 142Z', 0.26)}
    <g transform="rotate(38 100 78)">
      ${ink(`<path d="M94 -4 L100 -14 L106 -4 V100 H94Z" fill="#dfe6ee"/>`)}<path d="M100 -8 V98" stroke="${O}" stroke-width="2"/>
      ${ink(`<rect x="72" y="98" width="56" height="11" rx="5" fill="#ffd23f"/><rect x="94" y="109" width="12" height="26" rx="3" fill="#5a2c12"/><circle cx="100" cy="140" r="8" fill="#ffd23f"/>`)}
    </g>
    ${sparkle(150, 30, 8)}`,
  // a knight's helm with a plume
  Workers: () => `${banner('#123a6b', '#9ad6ff')}
    ${ink(`<path d="M44 152 Q48 120 76 112 H124 Q152 120 156 152Z" fill="#aab3bf"/>`)}
    ${ink(`<path d="M100 34 Q150 6 170 40 Q150 30 134 46 Q150 44 156 60 Q136 50 118 58Z" fill="#1f86e6"/>`)}
    ${ink(`<path d="M60 76 Q60 34 100 34 Q140 34 140 76 V104 Q140 122 100 124 Q60 122 60 104Z" fill="#dfe6ee"/>`)}
    ${dots('M100 34 Q140 34 140 76 V104 Q140 122 100 124 Q124 80 100 34Z', 0.3)}
    ${ink(`<path d="M60 66 H140 V84 L100 96 L60 84Z" fill="#aab3bf"/>`)}
    <g fill="${O}"><rect x="68" y="72" width="26" height="5" rx="2"/><rect x="106" y="72" width="26" height="5" rx="2"/></g>
    <path d="M100 96 V122" stroke="${O}" stroke-width="3"/>
    <g fill="${O}"><circle cx="84" cy="104" r="2"/><circle cx="84" cy="112" r="2"/><circle cx="116" cy="104" r="2"/><circle cx="116" cy="112" r="2"/><circle cx="92" cy="108" r="2"/><circle cx="108" cy="108" r="2"/></g>
    ${ink(`<circle cx="62" cy="72" r="5" fill="#ffd23f"/><circle cx="138" cy="72" r="5" fill="#ffd23f"/>`, 2.2)}`,
};
Object.assign(ICONS, {
  fantasy: {
    Oil: '<path d="M8 1.5L11.5 10.5H4.5ZM1.5 12Q8 9.5 14.5 12Q8 14.5 1.5 12Z"/>',
    Livestock: '<path d="M8 1.5C9 4.5 12.5 6 12.5 10A4.5 4.5 0 0 1 3.5 10C3.5 8 4.5 7 5.5 6C5.8 7.5 6.5 8 7 8.2C6.5 6 7 3.5 8 1.5Z"/>',
    Farmland: '<path d="M8 3C5 3 3.5 5.5 3.5 8L.8 5.5L2.2 10C3 12.5 5.2 14 8 14C10.8 14 13 12.5 13.8 10L15.2 5.5L12.5 8C12.5 5.5 11 3 8 3Z"/>',
    Weapons: '<path d="M3 2L6 5.5H10L13 2L12.5 7L14 10L8 14.5L2 10L3.5 7Z"/>',
    Workers: '<path d="M8 1.5L9.9 6L14.7 6.3L11 9.4L12.2 14.1L8 11.5L3.8 14.1L5 9.4L1.3 6.3L6.1 6Z"/>',
  },
  dinos: {
    Oil: '<path d="M1 5Q5 4 8 8Q11 4 15 5Q12.5 7 11 11L8 9.5L5 11Q3.5 7 1 5Z"/>',
    Livestock: '<path d="M8 15C5.5 15 4.5 12.5 5.5 10L3 5L5 4.5L7 9L7.2 2H8.8L9 9L11 4.5L13 5L10.5 10C11.5 12.5 10.5 15 8 15Z"/>',
    Farmland: '<path d="M2 13V10C2 7.5 4 7 7 7C9 7 10 6 10.5 4C10.8 2.5 12 1.5 13.5 2C14.5 2.3 14.5 3.5 13.5 3.8L12.2 4C12 7 11.5 9 10.5 10V13H8.8V10.8H5V13Z"/>',
    Weapons: '<path d="M2 13L4 4L6.5 10L8 2L9.5 10L12 4L14 13Z"/>',
    Workers: '<path d="M1.5 13C1.5 10 4 8.5 8 8.5C12 8.5 14.5 10 14.5 13ZM4 8L5.2 4.5L6.5 7.8ZM7 7.5L8.2 3.2L9.5 7.5ZM10 7.8L11.2 4.5L12.3 8.2Z"/>',
  },
  medieval: {
    Oil: '<path d="M2 12L1.5 5L5 8L8 3L11 8L14.5 5L14 12ZM2 13H14V14.5H2Z"/>',
    Livestock: '<path d="M4 14H12V12.5C12 9 13 7 11 4L11.5 2L9.5 3C6.5 3 4.5 5 3 8L4.5 9.5L7 8C7 10 5 11 4 12.5Z"/>',
    Farmland: '<path d="M2 14V6H4V4H5.5V6H7V4H9V6H10.5V4H12V6H14V14H9.5V10.5A1.5 1.5 0 0 0 6.5 10.5V14Z"/>',
    Weapons: '<path d="M8 1L9.5 3V9.5H12V11H9V14.5H7V11H4V9.5H6.5V3Z"/>',
    Workers: '<path fill-rule="evenodd" d="M8 1.5C4.5 1.5 3 4.5 3 8V13H6.5V9.5H9.5V13H13V8C13 4.5 11.5 1.5 8 1.5ZM4.5 6.4H11.5V7.8H4.5Z"/>',
  },
});
const pirBg = (sky, sun, seaC) => `<defs>${DOTS}</defs><rect width="200" height="150" fill="${sky}"/>${rays(46, 40, 14, 220, sun, 0.2)}
  ${ink(`<circle cx="46" cy="40" r="17" fill="${sun}"/>`, 2.6)}
  ${ink(`<path d="M-4 152 V118 Q12 108 28 118 T60 118 T92 118 T124 118 T156 118 T188 118 T220 118 V152Z" fill="${seaC}"/>`, 2.8)}
  <path d="M10 134 q8 -6 16 0 M60 140 q8 -6 16 0 M120 134 q8 -6 16 0 M164 142 q8 -6 16 0" stroke="#ffffff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>`;
const PIRATES = {
  // a bottle of rum
  Oil: () => `${pirBg('#3b1f8a', '#ffb3f0', '#241457')}
    ${ink(`<rect x="20" y="104" width="160" height="14" rx="3" fill="#8a4a22"/>`)}
    ${ink(`<path d="M86 30 H114 V52 Q134 62 134 84 V104 H66 V84 Q66 62 86 52Z" fill="#7a4df0"/>`)}
    ${dots('M114 52 Q134 62 134 84 V104 H104 Q120 80 104 52Z', 0.34)}
    ${ink(`<rect x="88" y="16" width="24" height="16" rx="3" fill="#c98d5a"/>`, 2.6)}
    ${ink(`<rect x="72" y="70" width="56" height="26" rx="2" fill="${PAPER}"/>`, 2.4)}
    <path d="M82 76 L92 90 M92 76 L82 90 M96 76 L106 90 M106 76 L96 90 M110 76 L120 90 M120 76 L110 90" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
    <path d="M76 58 Q78 48 88 46" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85"/>
    ${ink(`<path d="M146 76 H170 V104 H146Z" fill="#c98d5a"/><path d="M170 82 Q182 84 182 92 Q182 100 170 100" fill="none"/><path d="M144 76 Q158 66 172 76Z" fill="#ffffff"/>`, 2.6)}
    ${sparkle(160, 36, 7)}`,
  // a parrot on the yardarm
  Livestock: () => `${pirBg('#ffd9a0', '#fff3c4', '#12a3b8')}
    ${ink(`<rect x="10" y="106" width="180" height="11" rx="5" fill="#8a4a22"/>`)}
    ${ink(`<path d="M92 104 Q84 128 70 148 Q96 140 104 118 Q108 136 116 148 Q120 126 114 104Z" fill="#e3263e"/>`)}
    ${ink(`<path d="M72 78 Q72 44 102 44 Q132 46 132 80 Q130 108 102 110 Q74 108 72 78Z" fill="#f2742b"/>`)}
    ${ink(`<path d="M106 62 Q134 66 136 96 Q124 108 106 104 Q116 84 106 62Z" fill="#ffd23f"/>`, 2.6)}
    <path d="M112 76 Q124 84 124 98 M118 70 Q130 80 130 94" stroke="${O}" stroke-width="2" fill="none"/>
    ${ink(`<circle cx="88" cy="46" r="22" fill="#f2742b"/>`)}
    ${ink(`<path d="M70 44 Q52 44 50 60 Q56 70 66 64 Q62 56 74 54Z" fill="#ffd23f"/><path d="M66 64 Q62 74 70 76 Q74 70 72 62Z" fill="#14121f"/>`, 2.6)}
    ${ink(`<circle cx="86" cy="40" r="8" fill="#ffffff"/>`, 2.2)}<circle cx="84" cy="41" r="3.6" fill="${O}"/>
    ${ink(`<path d="M92 26 Q98 10 110 14 Q104 18 106 28Z" fill="#e3263e"/>`, 2.4)}
    ${ink(`<path d="M84 108 V116 M100 110 V116" fill="none"/>`, 3.4)}
    ${dots('M102 44 Q132 46 132 80 Q130 108 102 110 Q122 80 102 44Z', 0.24)}`,
  // a treasure chest on a palm island
  Farmland: () => `${pirBg('#bfe8ff', '#fff3c4', '#1f86e6')}
    ${ink(`<path d="M10 128 Q60 96 104 100 Q150 96 192 128 Q150 140 100 138 Q50 140 10 128Z" fill="#e8c98a"/>`)}
    ${ink(`<path d="M150 108 Q146 70 156 40" fill="none" stroke-width="9"/>`)}<path d="M150 108 Q146 70 156 40" stroke="#8a4a22" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${ink(`<path d="M156 40 Q134 26 116 40 Q136 38 150 48Z M156 40 Q160 16 184 16 Q170 26 164 44Z M156 40 Q182 36 194 56 Q176 46 160 50Z M156 40 Q140 50 136 70 Q150 56 162 52Z" fill="#3aa63f"/>`, 2.4)}
    ${ink(`<rect x="46" y="82" width="74" height="40" rx="3" fill="#8a4a22"/><path d="M40 82 Q44 50 84 50 Q122 50 126 82Z" fill="#a8562a"/>`)}
    ${ink(`<path d="M50 82 Q60 66 72 70 Q80 60 92 68 Q104 62 116 82Z" fill="#ffd23f"/>`, 2.4)}
    <g fill="#ffd23f" stroke="${O}" stroke-width="1.8"><circle cx="66" cy="76" r="5"/><circle cx="84" cy="72" r="5"/><circle cx="100" cy="76" r="5"/><circle cx="130" cy="124" r="5"/><circle cx="36" cy="124" r="4"/></g>
    <g fill="#f0a91e" stroke="${O}" stroke-width="2.4"><rect x="46" y="96" width="74" height="7"/><rect x="76" y="90" width="14" height="18" rx="2"/></g>
    <circle cx="83" cy="99" r="2.4" fill="${O}"/>
    ${ink(`<circle cx="92" cy="60" r="4" fill="#e3263e"/><circle cx="74" cy="62" r="3.4" fill="#5ef2d0"/>`, 1.8)}`,
  // crossed cutlasses under a skull
  Weapons: () => `${banner('#7a1420', '#ffb3a0')}
    <g transform="rotate(-52 100 98)">${ink(`<path d="M94 14 Q112 40 106 104 H94Z" fill="#dfe6ee"/><path d="M82 104 H118 Q122 116 100 118 Q88 116 94 110 H82Z" fill="#ffd23f"/><rect x="94" y="116" width="12" height="20" rx="3" fill="#5a2c12"/>`)}</g>
    <g transform="rotate(52 100 98)">${ink(`<path d="M106 14 Q88 40 94 104 H106Z" fill="#dfe6ee"/><path d="M118 104 H82 Q78 116 100 118 Q112 116 106 110 H118Z" fill="#ffd23f"/><rect x="94" y="116" width="12" height="20" rx="3" fill="#5a2c12"/>`)}</g>
    <g transform="translate(17 -4) scale(.83)">
    ${ink(`<path d="M72 60 Q72 30 100 30 Q128 30 128 60 Q128 76 118 82 V94 H82 V82 Q72 76 72 60Z" fill="${PAPER}"/>`)}
    ${ink(`<ellipse cx="88" cy="60" rx="8" ry="9" fill="#14121f"/><ellipse cx="112" cy="60" rx="8" ry="9" fill="#14121f"/><path d="M100 68 L95 78 H105Z" fill="#14121f"/>`, 1.6)}
    <path d="M90 84 V94 M100 84 V94 M110 84 V94" stroke="${O}" stroke-width="2.4"/>
    ${ink(`<path d="M70 36 Q100 14 130 36 Q100 28 70 36Z" fill="#e3263e"/>`, 2.4)}
    </g>`,
  // a ship under full sail
  Workers: () => `${pirBg('#9ad6ff', '#fff3c4', '#1f86e6')}
    ${ink(`<path d="M100 20 V104" fill="none" stroke-width="5"/><path d="M62 34 V104" fill="none" stroke-width="4"/><path d="M140 40 V104" fill="none" stroke-width="4"/>`)}
    ${ink(`<path d="M80 28 Q104 44 80 62 Q98 62 122 62 Q128 44 122 28Z" fill="#ffffff"/><path d="M78 68 Q106 84 78 100 H126 Q134 84 126 68Z" fill="#ffffff"/><path d="M46 44 Q62 60 46 78 H76 Q82 60 76 44Z" fill="${PAPER}"/><path d="M130 50 Q146 66 130 84 H160 Q164 66 158 50Z" fill="${PAPER}"/>`, 2.6)}
    ${ink(`<path d="M100 20 L126 12 L118 22 L126 30 L100 26Z" fill="#14121f"/>`, 2)}
    ${ink(`<path d="M24 100 H178 Q174 126 150 130 H56 Q30 126 24 100Z" fill="#8a4a22"/>`)}
    <path d="M30 110 H174" stroke="${O}" stroke-width="2.4"/>
    <g fill="#ffd23f" stroke="${O}" stroke-width="1.6"><circle cx="60" cy="120" r="3.4"/><circle cx="84" cy="120" r="3.4"/><circle cx="108" cy="120" r="3.4"/><circle cx="132" cy="120" r="3.4"/></g>
    ${dots('M110 100 H178 Q174 126 150 130 H120Z', 0.3)}`,
};
const westBg = (sky, sun, sand) => `<defs>${DOTS}</defs><rect width="200" height="150" fill="${sky}"/>${rays(152, 44, 14, 220, sun, 0.22)}
  ${ink(`<circle cx="152" cy="44" r="18" fill="${sun}"/>`, 2.6)}
  ${ink(`<path d="M-4 152 V96 H18 V80 H44 V96 H60 V152Z" fill="#c9551a"/><path d="M140 152 V100 H160 V88 H182 V100 H204 V152Z" fill="#c9551a"/>`, 2.6)}
  ${ink(`<path d="M-4 152 V122 Q50 112 100 120 Q150 126 204 116 V152Z" fill="${sand}"/>`, 2.8)}`;
const WEST = {
  // a masked outlaw
  Oil: () => `${glow('#2a1466', '#b99cff')}
    ${ink(`<path d="M46 152 Q50 120 78 112 H122 Q150 120 154 152Z" fill="#3b2a1a"/>`)}
    ${ink(`<circle cx="100" cy="82" r="30" fill="#e9a878"/>`)}
    ${ink(`<path d="M70 86 Q100 78 130 86 Q132 112 118 124 L112 138 L104 128 L100 142 L94 128 L88 138 L82 124 Q68 112 70 86Z" fill="#7a4df0"/>`)}
    <g fill="#ffffff" opacity=".8"><circle cx="84" cy="100" r="2.6"/><circle cx="100" cy="106" r="2.6"/><circle cx="116" cy="100" r="2.6"/><circle cx="92" cy="116" r="2.6"/><circle cx="108" cy="116" r="2.6"/></g>
    <path d="M78 70 L94 74 M122 70 L106 74" stroke="${O}" stroke-width="4" stroke-linecap="round"/><circle cx="88" cy="78" r="3" fill="${O}"/><circle cx="112" cy="78" r="3" fill="${O}"/>
    ${ink(`<path d="M66 62 Q66 24 100 24 Q134 24 134 62Z" fill="#262a45"/><path d="M26 62 Q100 44 174 62 Q150 76 100 74 Q50 76 26 62Z" fill="#262a45"/>`)}
    ${ink(`<path d="M68 54 Q100 46 132 54 V62 Q100 54 68 62Z" fill="#e3263e"/>`, 2.4)}
    ${dots('M100 24 Q134 24 134 62 Q150 64 174 62 Q150 76 100 74Z', 0.34)}`,
  // a longhorn steer
  Livestock: () => `${westBg('#ffd9a0', '#fff3c4', '#e8c98a')}
    ${ink(`<path d="M70 62 Q30 60 8 28 Q10 62 44 76 Q58 80 70 78Z" fill="${PAPER}"/><path d="M130 62 Q170 60 192 28 Q190 62 156 76 Q142 80 130 78Z" fill="${PAPER}"/>`)}
    ${ink(`<path d="M68 70 L46 78 Q52 92 70 88Z" fill="#c9551a"/><path d="M132 70 L154 78 Q148 92 130 88Z" fill="#c9551a"/>`, 2.6)}
    ${ink(`<path d="M64 62 Q64 40 100 40 Q136 40 136 62 Q138 96 124 116 Q118 136 100 136 Q82 136 76 116 Q62 96 64 62Z" fill="#f2742b"/>`)}
    ${ink(`<path d="M86 44 Q100 60 96 96 Q100 104 104 96 Q100 60 114 44Z" fill="${PAPER}"/>`, 2.4)}
    ${ink(`<path d="M78 112 Q78 100 100 100 Q122 100 122 112 Q122 136 100 136 Q78 136 78 112Z" fill="#ffc9a0"/>`)}
    <ellipse cx="90" cy="116" rx="4" ry="5.5" fill="${O}"/><ellipse cx="110" cy="116" rx="4" ry="5.5" fill="${O}"/>
    <circle cx="80" cy="74" r="4.5" fill="${O}"/><circle cx="120" cy="74" r="4.5" fill="${O}"/>
    ${ink(`<path d="M92 130 Q100 146 108 130" fill="none" stroke-width="4"/>`)}<path d="M92 130 Q100 146 108 130" stroke="#ffd23f" stroke-width="2.4" fill="none"/>
    ${dots('M100 40 Q136 40 136 62 Q138 96 124 116 Q118 100 104 96 Q100 60 114 44Z', 0.28)}`,
  // a saguaro cactus in bloom
  Farmland: () => `${westBg('#bfe8ff', '#fff3c4', '#e8c98a')}
    ${ink(`<path d="M84 136 V40 Q84 22 100 22 Q116 22 116 40 V136Z" fill="#3aa63f"/>`)}
    ${ink(`<path d="M84 96 H62 Q46 96 46 80 V60 Q46 50 56 50 Q66 50 66 60 V78 H84Z" fill="#3aa63f"/><path d="M116 84 H136 Q152 84 152 68 V52 Q152 42 142 42 Q132 42 132 52 V66 H116Z" fill="#3aa63f"/>`)}
    <g stroke="${O}" stroke-width="2" stroke-linecap="round"><path d="M100 34 V130 M92 44 V128 M108 44 V128 M56 60 V86 M142 52 V74"/></g>
    ${dots('M100 22 Q116 22 116 40 V136 H104 Q110 80 100 22Z', 0.34)}
    ${ink(`<circle cx="100" cy="20" r="8" fill="#ff7ab8"/><circle cx="56" cy="48" r="6" fill="#ff7ab8"/><circle cx="142" cy="40" r="6" fill="#ffd23f"/>`, 2.2)}
    <circle cx="100" cy="20" r="2.6" fill="#ffd23f"/>
    ${ink(`<path d="M20 132 Q24 120 30 132Z M168 136 Q174 122 180 136Z" fill="#8bd66a"/>`, 2)}`,
  // a bundle of dynamite, fuse lit
  Weapons: () => `${glow('#3a0a10', '#ff8a3c')}
    ${ink(`<rect x="52" y="52" width="28" height="84" rx="5" fill="#e3263e"/><rect x="86" y="46" width="28" height="90" rx="5" fill="#e3263e"/><rect x="120" y="52" width="28" height="84" rx="5" fill="#e3263e"/>`)}
    ${dots('M134 52 H143 Q148 52 148 57 V131 Q148 136 143 136 H134Z M100 46 H109 Q114 46 114 51 V136 H100Z M66 52 H80 V136 H66Z', 0.3)}
    ${ink(`<rect x="46" y="72" width="108" height="12" rx="3" fill="${PAPER}"/><rect x="46" y="104" width="108" height="12" rx="3" fill="${PAPER}"/>`, 2.6)}
    <path d="M100 46 Q100 28 116 26 Q134 24 138 12" stroke="${O}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M100 46 Q100 28 116 26 Q134 24 138 12" stroke="#c98d5a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    ${star(140, 12, 7, 15, 6, `fill="#ffd23f" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"`)}${star(140, 12, 7, 7, 3, 'fill="#ffffff"')}
    <g stroke="${O}" stroke-width="3" stroke-linecap="round"><path d="M160 22 L172 16 M158 6 L166 -2 M122 4 L118 -4"/></g>`,
  // the sheriff's star
  Workers: () => `${glow('#123a6b', '#9ad6ff')}
    ${ink(`<path d="M30 152 L48 20 H152 L170 152Z" fill="#1f86e6"/>`)}
    <path d="M100 20 V152" stroke="${O}" stroke-width="3"/><g fill="${PAPER}" stroke="${O}" stroke-width="1.8"><circle cx="100" cy="34" r="4"/><circle cx="100" cy="136" r="4"/></g>
    ${dots('M100 20 H152 L170 152 H100Z', 0.24)}
    ${star(100, 84, 5, 46, 20, `fill="#ffd23f" stroke="${O}" stroke-width="3.4" stroke-linejoin="round"`)}
    <g fill="#ffd23f" stroke="${O}" stroke-width="2.4"><circle cx="100" cy="38" r="6"/><circle cx="143.8" cy="69.8" r="6"/><circle cx="127" cy="121.2" r="6"/><circle cx="73" cy="121.2" r="6"/><circle cx="56.2" cy="69.8" r="6"/></g>
    ${ink(`<circle cx="100" cy="84" r="15" fill="#f0a91e"/>`, 2.4)}${star(100, 84, 5, 9, 4, `fill="${PAPER}" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"`)}
    <path d="M70 62 Q78 52 90 50" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85"/>`,
};
Object.assign(ICONS, {
  pirates: {
    Oil: '<path d="M6.5 1.500H9.500V4.500C11 5.5 11.5 6.5 11.5 8V14.500H4.500V8C4.5 6.5 5 5.5 6.5 4.500Z"/>',
    Livestock: '<path d="M9 2C6.5 2 5 4 5 6.500V10L3 14.500L7 12.500C10 12.5 12 10.5 12 7.500V6L14 5L12 4C11.5 2.8 10.5 2 9 2Z"/>',
    Farmland: '<path d="M2 7C2 4.5 4 3.5 8 3.500C12 3.5 14 4.5 14 7V8H2ZM2 9H7V10.500H9V9H14V13.500H2Z"/>',
    Weapons: '<path d="M2 2L9 9L8 10L1.5 3.500ZM14 2L7 9L8 10L14.5 3.500ZM5 11L6.5 9.500L7.5 10.500L6 12L7 13L5.5 14.500L3 12ZM11 11L9.5 9.500L8.5 10.500L10 12L9 13L10.5 14.500L13 12Z"/>',
    Workers: '<path d="M7.5 1.500V9H3ZM8.5 3L13 9H8.500ZM1.5 10.500H14.500L12.5 14H3.500Z"/>',
  },
  west: {
    Oil: '<path d="M5 9C5 5 6 3.5 8 3.500C10 3.5 11 5 11 9ZM1 10.500Q8 8.5 15 10.500Q8 13.5 1 10.500Z"/>',
    Livestock: '<path d="M1 3Q2 7 5.5 7.500V11Q5.5 14 8 14Q10.5 14 10.5 11V7.500Q14 7 15 3Q12 5.5 10 5.500H6Q4 5.5 1 3Z"/>',
    Farmland: '<path d="M6.5 2.500A1.5 1.5 0 0 1 9.5 2.500V7H10.500V5.500A1.2 1.2 0 0 1 13 5.500V8.500Q13 9.8 11.5 9.800H9.500V14.500H6.500V11.500H4.500Q3 11.5 3 10V7A1.2 1.2 0 0 1 5.5 7V9H6.500Z"/>',
    Weapons: '<path d="M4 6H7V14.500H4ZM9 6H12V14.500H9ZM5.5 6V4Q5.5 2.5 8 2.500Q10 2.5 10.5 1.500L11.5 2Q11 4 8 4Q7 4 7 5V6Z"/>',
    Workers: '<path d="M8 1L9.8 5H14L11.5 8L14 11H9.800L8 15L6.2 11H2L4.5 8L2 5H6.200Z"/>',
  },
});
export const ART_PACKS = {
  cosmos: { art: COSMOS, icons: ICONS.cosmos }, reef: { art: REEF, icons: ICONS.reef },
  fantasy: { art: FANTASY, icons: ICONS.fantasy }, dinos: { art: DINOS, icons: ICONS.dinos }, medieval: { art: MEDIEVAL, icons: ICONS.medieval },
  pirates: { art: PIRATES, icons: ICONS.pirates }, west: { art: WEST, icons: ICONS.west },
};

// The same card back as one image address with its colours filled in. A face-down card on the table then needs no
// drawing of its own: every one of them shares this picture (set once per deck as the CSS variable --backimg).
export function cardBackUrl({ a, b, line, gem, h }) {
  const svg = CARD_BACK.replace(' class="backart"', ' xmlns="http://www.w3.org/2000/svg"')
    .replace(/class="bk-a"/g, `fill="${a}"`).replace(/class="bk-b"/g, `fill="${b}"`)
    .replace(/class="bk-line"/g, `stroke="${line}"`).replace(/class="bk-gem"/g, `fill="${gem}"`)
    .replace(/class="bk-h"/g, `stroke="${h}"`).replace(/class="bk-dot"/g, `fill="${line}"`);
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// The deck whose pictures are in use right now: null for the standard art, else
// { art: { key: function | image URL }, icons: { type: svg paths | { text } | { img } } }.
let DECK = null;
const svgSafe = (u) => String(u).replace(/[<>"&]/g, '');
const artCache = new Map(); // drawings are built once per deck and reused: a redraw of the table asks for the same ones every time
export function setArtDeck(d) { DECK = d || null; }
export function art(key) {
  let per = artCache.get(DECK);
  if (!per) artCache.set(DECK, (per = new Map()));
  let out = per.get(key);
  if (out === undefined) per.set(key, (out = drawArt(key)));
  return out;
}
function drawArt(key) {
  const a = DECK?.art?.[key];
  if (typeof a === 'string') return `<svg class="art" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><image href="${svgSafe(a)}" width="200" height="150" preserveAspectRatio="xMidYMid slice"/></svg>`;
  const scene = typeof a === 'function' ? a : SCENES[key];
  return `<svg class="art" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${scene ? scene() : ''}</svg>`;
}

// The back of every card: midnight ink, a yellow lattice and the H monogram.
// The card back. Its colours come from CSS (--bk-*), so a deck skin can repaint it.
export const CARD_BACK = `<svg class="backart" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
  <defs><pattern id="bkPat" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="bk-b" width="12" height="12"/><rect class="bk-a" width="6" height="6"/><rect class="bk-a" x="6" y="6" width="6" height="6"/></pattern></defs>
  <rect class="bk-a" width="100" height="140"/><rect class="bk-line" x="5" y="5" width="90" height="130" rx="4" fill="url(#bkPat)" stroke-width="2"/>
  <rect class="bk-line" x="10" y="10" width="80" height="120" rx="2" fill="none" stroke-width=".8" opacity=".75"/>
  <path class="bk-gem" d="M50 40 L78 70 L50 100 L22 70Z" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
  <path class="bk-line" d="M50 46 L72 70 L50 94 L28 70Z" fill="none" stroke-width="1"/>
  <path d="M41 58 V82 M59 58 V82 M41 70 H59 M37 58 H45 M55 58 H63 M37 82 H45 M55 82 H63" stroke="${O}" stroke-width="6.400" stroke-linecap="square" fill="none"/>
  <path class="bk-h" d="M41 58 V82 M59 58 V82 M41 70 H59 M37 58 H45 M55 58 H63 M37 82 H45 M55 82 H63" stroke-width="3" stroke-linecap="square" fill="none"/>
  <g class="bk-dot" stroke="${O}" stroke-width="1"><path d="M50 16 l5 7 -5 7 -5 -7Z M50 110 l5 7 -5 7 -5 -7Z"/><circle cx="20" cy="20" r="2.600"/><circle cx="80" cy="20" r="2.600"/><circle cx="20" cy="120" r="2.600"/><circle cx="80" cy="120" r="2.600"/></g>
</svg>`;

// Portrait for each seat. People get their initial on a rosette; every bot is a
// little tycoon with their own hat.
const SEAT_COLORS = ['#ffd23f', '#ff5d73', '#57b3ff', '#7be36a', '#c58bf0', '#ff9f43'];
export const seatColor = (seat) => SEAT_COLORS[seat % SEAT_COLORS.length];
const SKIN = ['#f6c199', '#e9a878', '#c98d5a', '#f2d2b6', '#a8683c', '#f6c199'];
const HATS = [
  `<rect x="20.500" y="5" width="19" height="15" rx="1" fill="${O}"/><rect x="20.500" y="14.500" width="19" height="3.400" fill="#e3263e"/><rect x="14" y="19" width="32" height="4.400" rx="2.200" fill="${O}"/>`,
  `<path d="M19 21 Q19 7 30 7 Q41 7 41 21Z" fill="#454b7a" stroke="${O}" stroke-width="2"/><rect x="13.500" y="19.500" width="33" height="4" rx="2" fill="#454b7a" stroke="${O}" stroke-width="2"/>`,
  `<path d="M20 20 Q21 8 30 11 Q39 8 40 20Z" fill="#8a4a22" stroke="${O}" stroke-width="2"/><ellipse cx="30" cy="21" rx="17.500" ry="3.600" fill="#8a4a22" stroke="${O}" stroke-width="2"/>`,
  `<path d="M17 22 Q17 10 31 10 Q44 11 46 22 Q32 18 17 22Z" fill="#262a45" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`,
  `<path d="M16 25 Q30 8 44 25 Q30 19 16 25Z" fill="#2ec4a6" stroke="${O}" stroke-width="2" stroke-linejoin="round"/><path d="M19 22 Q30 14 41 22" fill="none" stroke="${O}" stroke-width="2"/>`,
  `<path d="M22 21 Q21 7 30 10 Q39 7 38 21Z" fill="#e0a252" stroke="${O}" stroke-width="2"/><path d="M9 19 Q30 30 51 19 Q30 24 9 19Z" fill="#e0a252" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`,
];
// Faces the bots pull when something happens to them. Each is a mouth and a pair of eyebrows drawn over the head;
// CSS shows one of them (and hides the resting mouth) while the portrait's holder has a data-mood.
const brow = (d) => `<path d="${d}" fill="none" stroke="${O}" stroke-width="1.9" stroke-linecap="round"/>`;
const MOODS = `<g class="m-shock">${brow('M23.4 26.6 q2.6 -2.8 5.2 0 M31.8 26.6 q2.6 -2.8 5.2 0')}<ellipse cx="30" cy="38" rx="2.7" ry="3.5" fill="${O}"/></g>
  <g class="m-smug">${brow('M23.4 27.4 H28.6 M32 26 q2.6 -2 5 .4')}<path d="M25.4 37 Q31 41.4 36 35.6" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round"/></g>
  <g class="m-angry">${brow('M23 26 L28.8 28.6 M37 26 L31.2 28.6')}<path d="M25.4 39.4 Q30 35.6 34.6 39.4" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round"/></g>
  <g class="m-sad">${brow('M23.4 28.4 L28.4 26.4 M36.6 28.4 L31.6 26.4')}<path d="M26.4 39 Q30 36.8 33.6 39" fill="none" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/><path d="M39.4 27 q2 3.4 0 4.8 q-2 -1.4 0 -4.800Z" fill="#6cc0ff" stroke="${O}" stroke-width=".800"/></g>`;
// A portrait. Bots are tycoons with a fixed look per seat. A person is a badge with their initial unless they built
// a face on the Customize screen: avatar = { style: 'face', hat: 0-6 (6 = no hat), skin: 0-5, extra: 0 none | 1 monocle | 2 shades | 3 moustache, suit: 0-4 }.
const SUITS = ['#262a45', '#7a1420', '#1f5a2a', '#5a2c12', '#3b1f8a'];
export const AVATAR_OPTIONS = { hats: 7, skins: 6, extras: 4, suits: 5 };
function faceSvg(c, { hat, skin, extra, suit = 0, smile }) {
  const mouth = smile
    ? `<path d="M24 37 Q30 33 36 37 Q30 40 24 37Z" fill="${O}"/>`
    : `<path d="M26 37.5 Q30 40 34 37.5" fill="none" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>`;
  const add = extra === 1 ? `<circle cx="34.5" cy="31" r="4" fill="none" stroke="${O}" stroke-width="1.6"/>`
    : extra === 2 ? `<path d="M22 31 H38" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/>`
    : extra === 3 ? `<path d="M24.5 35.4 Q27.5 33 30 35 Q32.5 33 35.5 35.4 Q32.5 37 30 35.6 Q27.5 37 24.5 35.4Z" fill="${O}"/>` : '';
  return `<svg class="crest" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="28" fill="${c}" stroke="${O}" stroke-width="2.6"/>
    <path d="M9 50 Q12 43 24 42 H36 Q48 43 51 50 A28 28 0 0 1 9 50Z" fill="${SUITS[suit] || SUITS[0]}" stroke="${O}" stroke-width="2" stroke-linejoin="round"/><path d="M26 42 L30 48 L34 42Z" fill="${PAPER}" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="30" cy="31" r="11" fill="${SKIN[skin] || SKIN[0]}" stroke="${O}" stroke-width="2"/>
    ${extra === 2 ? '' : `<circle cx="26" cy="31" r="1.7" fill="${O}"/><circle cx="34.5" cy="31" r="1.7" fill="${O}"/>`}${add}<g class="m-base">${mouth}</g>${MOODS}${HATS[hat] || ''}</svg>`;
}
export function crest(name, seat, isBot, avatar = null) {
  const c = seatColor(seat), k = seat % 6;
  if (isBot) return faceSvg(c, { hat: k, skin: k, extra: k === 0 ? 1 : k === 3 ? 2 : 0, smile: k % 2 === 0 });
  if (avatar?.style === 'face') return faceSvg(c, { hat: avatar.hat, skin: avatar.skin, extra: avatar.extra, suit: avatar.suit, smile: true });
  const ch = ((name || '?').trim()[0] || '?').toUpperCase().replace(/[<&]/g, '');
  return `<svg class="crest" viewBox="0 0 60 60" aria-hidden="true">${star(30, 30, 14, 29, 25.5, `fill="${c}" stroke="${O}" stroke-width="2" stroke-linejoin="round"`)}<circle cx="30" cy="30" r="20.5" fill="#1b1e3a" stroke="${O}" stroke-width="2"/>
    <text x="30" y="40.5" text-anchor="middle" font-family="'Abril Fatface', Georgia, serif" font-size="29" fill="${c}">${ch}</text></svg>`;
}

// Small resource symbols for chips, costs and labels.
const ICON_PATHS = {
  Oil: '<path d="M8 1.2C5 6 3 8.6 3 11a5 5 0 0 0 10 0C13 8.6 11 6 8 1.2Z"/>',
  Livestock: '<path d="M1.5 2.6Q2.8 6 5 6.6Q4 8.2 4.5 10.2Q5.5 14.4 8 14.4Q10.5 14.4 11.5 10.2Q12 8.2 11 6.6Q13.2 6 14.5 2.6Q11.6 3.2 10.6 5Q8 4 5.4 5Q4.4 3.2 1.5 2.6Z"/>',
  Farmland: '<path d="M7.3 15V9.6Q4 9 4 5.8Q7 6.2 7.3 8.4V5.6Q4.6 5 4.8 2Q7.4 2.6 8 4.6Q8.6 2.6 11.2 2Q11.4 5 8.7 5.6V8.4Q9 6.2 12 5.8Q12 9 8.7 9.6V15Z"/>',
  Weapons: '<path d="M2 1.5 4.2 1.8 9.6 7.2 11 5.8 12.2 7 10.9 8.3 14.5 12 12.8 13.7 9.2 10 7.9 11.3 6.7 10.1 8.1 8.7 2.3 3.6Z"/><path d="M14 1.5 11.8 1.8 9.9 3.7 11.4 5.2 13.7 3.6ZM5.1 8.6 3.8 7.4 2.6 8.6 3.9 9.9 1.5 12.3 3.2 14 5.6 11.6 6.8 12.8 8 11.6 6.6 10.2Z"/>',
};
export function ico(type) {
  const c = DECK?.icons?.[type];
  if (c && typeof c === 'object' && c.img) return `<svg class="ico i-${type} pic" viewBox="0 0 16 16" aria-hidden="true"><clipPath id="icoClip"><circle cx="8" cy="8" r="7.4"/></clipPath><image href="${svgSafe(c.img)}" width="16" height="16" preserveAspectRatio="xMidYMid slice" clip-path="url(#icoClip)"/></svg>`;
  if (c && typeof c === 'object' && c.text) return `<svg class="ico i-${type} pic" viewBox="0 0 16 16" aria-hidden="true"><text x="8" y="12.6" font-size="12" text-anchor="middle">${String(c.text).replace(/[<>&]/g, '')}</text></svg>`;
  const body = typeof c === 'string' ? c : type === 'Workers' ? `${gear(8, 8, 4.6, 8, 'currentColor')}<circle cx="8" cy="8" r="2" fill="var(--pipbg, #1f86e6)"/>` : ICON_PATHS[type] || '';
  return `<svg class="ico i-${type}" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${body}</svg>`;
}
