// A small QR code maker, so a phone can join a game by pointing its camera at the host's screen.
// Nothing leaves the computer: the code is worked out here and drawn as a picture.
// It handles ordinary text up to 106 bytes (a join link is about 40), at the "M" error-correction level.
//   qrMatrix(text) -> square grid of true (dark) / false (light)
//   qrSvg(text)    -> the same as an SVG picture with a white margin

// For each size ("version") 1-6: [bytes of data it holds, error-correction bytes per block, number of blocks]
const SIZES = [null, [16, 10, 1], [28, 16, 1], [44, 26, 1], [64, 18, 2], [86, 24, 2], [108, 16, 4]];

// Reed-Solomon error correction over GF(256).
const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; };
function divisor(degree) {
  const out = new Array(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) { out[j] = mul(out[j], root); if (j + 1 < degree) out[j] ^= out[j + 1]; }
    root = mul(root, 2);
  }
  return out;
}
function remainder(data, div) {
  const out = div.map(() => 0);
  for (const b of data) { const f = b ^ out.shift(); out.push(0); div.forEach((c, i) => { out[i] ^= mul(c, f); }); }
  return out;
}

export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  const ver = SIZES.findIndex((v) => v && bytes.length <= v[0] - 2);
  if (ver < 1) throw new Error('Too long for a QR code here.');
  const [cap, ecLen, blocks] = SIZES[ver];

  // 1. the message as bits: "this is bytes", how many, the bytes, then padding
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, 8);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, b) => (n << 1) | b, 0));
  for (let pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);

  // 2. split into blocks, add error correction to each, and weave them together
  const div = divisor(ecLen), per = cap / blocks, parts = [];
  for (let b = 0; b < blocks; b++) { const d = data.slice(b * per, (b + 1) * per); parts.push([d, remainder(d, div)]); }
  const stream = [];
  for (let i = 0; i < per; i++) for (const [d] of parts) stream.push(d[i]);
  for (let i = 0; i < ecLen; i++) for (const [, e] of parts) stream.push(e[i]);

  // 3. the grid: the fixed parts first (corner squares, timing lines, the small alignment square)
  const n = 17 + 4 * ver;
  const dark = Array.from({ length: n }, () => new Array(n).fill(false));
  const fixed = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (x, y, on) => { if (x >= 0 && x < n && y >= 0 && y < n) { dark[y][x] = !!on; fixed[y][x] = true; } };
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); }
  for (let i = 8; i < n - 8; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
  if (ver > 1) { const c = n - 7; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
  // the strips that say which pattern was used (filled in at the end), and one module that is always dark
  const format = (mask) => {
    let rem = mask; // error-correction level M is written as 00, so the five bits are just the mask number
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((mask << 10) | rem) ^ 0x5412, bit = (i) => (f >>> i) & 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(i));
    set(8, n - 8, 1);
  };
  format(0);

  // 4. the message, zigzagging up and down in two-wide columns from the right
  let k = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < n; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? n - 1 - v : v;
      if (!fixed[y][x] && k < stream.length * 8) { dark[y][x] = ((stream[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; }
    }
  }

  // 5. flip modules by a pattern so there are no big blobs; try all eight and keep the one that reads most easily
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  const flip = (m) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fixed[y][x] && MASKS[m](x, y)) dark[y][x] = !dark[y][x]; };
  const penalty = () => {
    let p = 0, total = 0;
    const line = (get) => { // runs of one colour, and anything that looks like a corner square
      let run = 1, hist = '';
      for (let i = 0; i < n; i++) { hist += get(i) ? '1' : '0'; if (i && get(i) === get(i - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
      for (const pat of ['10111010000', '00001011101']) for (let at = hist.indexOf(pat); at >= 0; at = hist.indexOf(pat, at + 1)) p += 40;
    };
    for (let i = 0; i < n; i++) { line((j) => dark[i][j]); line((j) => dark[j][i]); }
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (dark[y][x] === dark[y][x + 1] && dark[y][x] === dark[y + 1][x] && dark[y][x] === dark[y + 1][x + 1]) p += 3;
    for (const row of dark) for (const d of row) if (d) total++;
    return p + Math.floor(Math.abs(total * 20 - n * n * 10) / (n * n)) * 10;
  };
  let best = 0, least = Infinity;
  for (let m = 0; m < 8; m++) { flip(m); format(m); const p = penalty(); if (p < least) { least = p; best = m; } flip(m); }
  flip(best); format(best);
  return dark;
}

// The code as a picture. `margin` is the white border the camera needs, in modules.
export function qrSvg(text, { margin = 3, fg = '#14121f', bg = '#ffffff' } = {}) {
  const m = qrMatrix(text), n = m.length;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) d += `M${x + margin} ${y + margin}h1v1h-1z`;
  return `<svg class="qr" viewBox="0 0 ${n + margin * 2} ${n + margin * 2}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
}
