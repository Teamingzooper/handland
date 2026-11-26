// Visual effects: a particle canvas over the whole window, plus the helpers that
// make cards glide between places instead of teleporting.

const canvas = document.createElement('canvas');
canvas.id = 'fx';
document.body.appendChild(canvas);
const g = canvas.getContext('2d');
let W = 0, H = 0, dpr = 1;
// Graphics level. lite = Low: no drifting dust, no idle camera sway, a plainer canvas. Nothing is redrawn while nothing moves.
export const gfx = { lite: false, auto: false, onAuto: null };
export function setLite(v) {
  gfx.lite = !!v;
  document.body.classList.toggle('lite', gfx.lite);
  resize();
}
function resize() {
  dpr = gfx.lite ? 1 : Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const parts = [];
const motes = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, s: 0.004 + Math.random() * 0.01, p: Math.random() * 6.28 }));
const rand = (a, b) => a + Math.random() * (b - a);

const KINDS = {
  spark: { colors: ['#fff3a8', '#f2c14e', '#ff9f43'], speed: [120, 420], life: [0.35, 0.8], size: [1.5, 3.5], gravity: 300, glow: true },
  ember: { colors: ['#ff5a3c', '#ff9f43', '#ffd27a'], speed: [80, 360], life: [0.5, 1.1], size: [2, 4.5], gravity: -80, glow: true },
  coin: { colors: ['#f2c14e', '#ffe08a', '#c9973a'], speed: [180, 560], life: [0.9, 1.7], size: [4, 7], gravity: 900, coin: true },
  smoke: { colors: ['#9aa3a8', '#6d767b', '#c9d1d5'], speed: [20, 110], life: [0.8, 1.6], size: [8, 20], gravity: -40, soft: true },
  confetti: { colors: ['#f2c14e', '#e2574c', '#5aa9e6', '#8fd16a', '#fff'], speed: [200, 700], life: [1.4, 2.6], size: [4, 8], gravity: 520, rect: true },
  shield: { colors: ['#9fd8ff', '#5aa9e6', '#ffffff'], speed: [60, 240], life: [0.5, 1], size: [2, 4], gravity: -60, glow: true },
  shard: { colors: ['#e8edf2', '#aeb7c2', '#f2c14e'], speed: [200, 520], life: [0.5, 1], size: [3, 7], gravity: 800, rect: true },
  mist: { colors: ['#7dfff0', '#b8fff5'], speed: [20, 90], life: [0.6, 1.2], size: [3, 7], gravity: -30, glow: true },
};

export function burst(x, y, kind = 'spark', count = 24, spread = Math.PI * 2, dir = -Math.PI / 2, scale = 1) {
  const k = KINDS[kind];
  for (let i = 0; i < count; i++) {
    const a = dir + rand(-spread / 2, spread / 2), v = rand(...k.speed) * scale;
    const life = rand(...k.life) * (scale < 1 ? 0.75 : 1);
    parts.push({ k, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, age: 0, size: rand(...k.size) * (scale < 1 ? 0.8 : 1), color: k.colors[(Math.random() * k.colors.length) | 0], rot: rand(0, 6.28), vr: rand(-9, 9) });
  }
}
export const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
export function burstAt(el, kind, count, spread, dir) {
  if (!el) return;
  const [x, y] = centerOf(el);
  burst(x, y, kind, count, spread, dir);
}
// A small, short-lived puff that stays close to where it starts (for the other players' panels).
export function puff(el, kind = 'spark', count = 12) {
  if (!el) return;
  const [x, y] = centerOf(el);
  burst(x, y, kind, count, Math.PI * 2, -Math.PI / 2, 0.32);
}
// A streak of light travelling from one element to another (targeting, trades).
export function streak(fromEl, toEl, kind = 'spark') {
  if (!fromEl || !toEl) return;
  const [x0, y0] = centerOf(fromEl), [x1, y1] = centerOf(toEl);
  const steps = 18;
  for (let i = 0; i < steps; i++) setTimeout(() => burst(x0 + (x1 - x0) * (i / steps), y0 + (y1 - y0) * (i / steps), kind, 3, 6.28), i * 16);
  setTimeout(() => burst(x1, y1, kind, 22), steps * 16);
}
export function rain(kind = 'confetti', seconds = 3) {
  const end = performance.now() + seconds * 1000;
  const drop = () => { burst(rand(0, W), -10, kind, 5, 1.2, Math.PI / 2); if (performance.now() < end) setTimeout(drop, 60); };
  drop();
}
export function shake(el = document.getElementById('app'), strength = 10) {
  el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${strength}px,${-strength / 2}px)` }, { transform: `translate(${-strength}px,${strength / 2}px)` }, { transform: `translate(${strength / 2}px,${strength / 3}px)` }, { transform: 'translate(0,0)' }], { duration: 380, easing: 'ease-out' });
}

let lastT = performance.now(), dirty = false;
// In Auto, frame times are watched for the first seconds of play; a machine that cannot hold a smooth rate is moved to Low.
const meter = { n: 0, sum: 0, slow: 0 };
function watchSpeed(realMs) {
  if (!gfx.auto || gfx.lite || document.visibilityState !== 'visible' || !document.body.classList.contains('in-game')) return;
  if (realMs > 120) return; // a hitch (tab switch, a big redraw), not a steady rate
  meter.n++; meter.sum += realMs;
  if (meter.n < 150) return;
  const avg = meter.sum / meter.n;
  meter.n = 0; meter.sum = 0;
  meter.slow = avg > 24 ? meter.slow + 1 : 0; // under about 42 frames a second
  if (meter.slow >= 2) { setLite(true); gfx.onAuto?.(); }
}
function frame(now) {
  const real = Math.min(0.4, (now - lastT) / 1000), dt = Math.min(0.05, real);
  watchSpeed(now - lastT);
  lastT = now;
  camFrame(real, now);
  if (gfx.lite && !parts.length) { // nothing to draw: leave the canvas alone so the screen is not recomposited every frame
    if (dirty) { g.clearRect(0, 0, W, H); dirty = false; }
    requestAnimationFrame(frame);
    return;
  }
  dirty = true;
  g.clearRect(0, 0, W, H);
  // drifting dust in the lamp light
  g.globalCompositeOperation = 'lighter';
  for (const m of gfx.lite ? [] : motes) {
    m.y -= m.s * dt; m.p += dt * 0.6;
    if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
    g.globalAlpha = 0.1 + 0.08 * Math.sin(m.p);
    g.fillStyle = '#ffe9b0';
    g.beginPath(); g.arc((m.x + Math.sin(m.p) * 0.01) * W, m.y * H, m.r, 0, 6.28); g.fill();
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age >= p.life) { parts.splice(i, 1); continue; }
    p.vy += p.k.gravity * dt; p.vx *= 1 - 1.2 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const t = p.age / p.life;
    g.globalCompositeOperation = p.k.glow ? 'lighter' : 'source-over';
    g.globalAlpha = p.k.soft ? 0.2 * (1 - t) : Math.min(1, (1 - t) * 1.6);
    g.fillStyle = p.color;
    if (p.k.coin) {
      g.save(); g.translate(p.x, p.y); g.scale(Math.abs(Math.cos(p.rot)) * 0.9 + 0.1, 1);
      g.beginPath(); g.arc(0, 0, p.size, 0, 6.28); g.fill();
      g.globalAlpha *= 0.5; g.fillStyle = '#7a5a10'; g.beginPath(); g.arc(0, 0, p.size * 0.55, 0, 6.28); g.fill();
      g.restore();
    } else if (p.k.rect) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); g.restore();
    } else {
      const r = p.k.soft ? p.size * (1 + t * 1.5) : p.size * (1 - t * 0.5);
      g.beginPath(); g.arc(p.x, p.y, r, 0, 6.28); g.fill();
    }
  }
  g.globalAlpha = 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- the camera ----------
// One transform moves the whole room: it leans with the pointer, dollies in when you
// sit down, and nudges forward when it is your move.

const cam = { x: 0, y: 0, z: 0, lx: 0, ly: 0, focus: 0, kick: 0, intro: 0, drawn: '' };
const roomEl = document.getElementById('room');
export const camMoving = () => cam.intro > 0.02;
export function camLook(px, py) { cam.lx = px; cam.ly = py; }
export function camFocus(on) { cam.focus = on; }
export function camKick(amount) { cam.kick = amount; }
export function camIntro() { cam.intro = 1; cam.x = 0; cam.y = -15; cam.z = -58; camApply(true); }
export function camApply(force = false) {
  const t = `translateZ(calc(var(--u) * ${cam.z.toFixed(3)})) rotateX(${cam.y.toFixed(3)}deg) rotateY(${cam.x.toFixed(3)}deg)`;
  const worlds = document.querySelectorAll('.world');
  if (!force && t === cam.drawn && [...worlds].every((w) => w.dataset.cam === '1')) return;
  cam.drawn = t;
  for (const w of worlds) { w.style.transform = t; w.dataset.cam = '1'; }
  // The backdrop's layers slide against each other by how far the camera leans (see backdrops.js).
  const px = cam.x.toFixed(2), py = Math.max(-4, cam.y).toFixed(2);
  if (roomEl && (px !== cam.px || py !== cam.py)) { cam.px = px; cam.py = py; roomEl.style.setProperty('--camx', px); roomEl.style.setProperty('--camy', py); }
}
function camFrame(dt, now) {
  if (!document.body.classList.contains('in-game') || document.body.classList.contains('flat')) return;
  cam.intro *= Math.exp(-dt * 3.1);
  cam.kick *= Math.exp(-dt * 5);
  const breathe = gfx.lite ? 0 : Math.sin(now / 2600) * 0.12;
  const tx = (gfx.lite ? 0 : cam.lx * 2.2), ty = (gfx.lite ? 0 : -cam.ly * 1.3) - 15 * cam.intro + breathe, tz = cam.focus * 2.2 - 58 * cam.intro + cam.kick;
  const k = 1 - Math.exp(-dt * 7);
  const dx = (tx - cam.x) * k, dy = (ty - cam.y) * k, dz = (tz - cam.z) * k;
  // Once the camera has settled, stop touching it: rewriting the transform every frame makes the whole table redraw.
  if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) < 0.0015 && Math.abs(tx - cam.x) + Math.abs(ty - cam.y) + Math.abs(tz - cam.z) < 0.01) return;
  cam.x += dx; cam.y += dy; cam.z += dz;
  camApply();
}

// ---------- card movement ----------
// Before the screen is redrawn we remember where every card was. After the redraw,
// each card starts from its old spot and travels to its new one.
//
// Cards live in different spaces: flat on the felt, held up in my hand, or standing in
// someone's name tent. Within one space a card moves in that space's own coordinates
// (so on the table it really lifts off the felt and comes back down). Between spaces a
// copy of the card flies across the screen, tilting from one angle to the other.
//
// Only my own cards and the middle of the table travel. Whatever starts in another
// player's area stays quiet: it just pops into its new place.

const zoneOf = (el) => (el.closest('.opp') ? 'opp' : el.closest('.mine, .handcol') ? 'me' : 'mid');
const spaceOf = (el) => (el.closest('.handcol') ? 'hand' : el.closest('.tent') ? 'tent' : el.closest('.plane') ? 'felt' : 'flat');
const ROOT = { felt: '.plane', hand: '.hand' };
const T = () => (document.body.classList.contains('flat') ? 0 : 44); // 2D view: nothing is tilted
const tiltOf = (el) => (el.closest('.plane') && !el.closest('.tent') ? (el.classList.contains('prop') ? Math.max(0, T() - 38) : T()) : 0);
// Where an element sits inside its space, ignoring every transform.
function place(el, root) {
  let x = 0, y = 0;
  for (let n = el; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  return { x, y, w: el.offsetWidth };
}
const spot = (el) => { const sp = spaceOf(el), root = ROOT[sp] && el.closest(ROOT[sp]); return { sp, loc: root ? place(el, root) : null }; };
const screenOf = (rect, tilt) => ({ cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, w: rect.width, tilt });

export function snapshot() {
  const map = new Map();
  for (const el of document.querySelectorAll('[data-cid]')) {
    if (map.has(el.dataset.cid)) continue;
    map.set(el.dataset.cid, { rect: el.getBoundingClientRect(), face: el.dataset.face, node: el, zone: zoneOf(el), tilt: tiltOf(el), ...spot(el) });
  }
  return map;
}

const EASE = 'cubic-bezier(.22,.9,.24,1)';
const popIn = (el) => el.animate([{ opacity: 0, scale: '.55' }, { opacity: 1, scale: '1.08', offset: 0.7 }, { opacity: 1, scale: '1' }], { duration: 240, easing: 'ease-out' });
const unit = () => Math.min(window.innerWidth * 0.01, window.innerHeight * 0.016);

// A copy of a card crossing the screen from one place (and angle) to another.
function fly(node, from, to, { duration = 600, delay = 0, fade = false, spin = 0 } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'flywrap';
  const g = node.cloneNode(true);
  g.removeAttribute('data-cid'); g.removeAttribute('style');
  g.classList.remove('picked', 'pickable', 'sel', 'can', 'prop');
  g.querySelectorAll('.rolebadge').forEach((e) => e.remove());
  const w = from.w, h = w * 1.4;
  Object.assign(g.style, { left: `${-w / 2}px`, top: `${-h / 2}px`, width: `${w}px`, transition: 'none', animation: 'none' });
  g.style.setProperty('--cw', `${w}px`);
  wrap.appendChild(g);
  document.body.appendChild(wrap);
  const dist = Math.hypot(to.cx - from.cx, to.cy - from.cy), lift = Math.min(90, 26 + dist * 0.08), s1 = to.w / w;
  const mx = from.cx + (to.cx - from.cx) * 0.5, my = from.cy + (to.cy - from.cy) * 0.5 - lift;
  const o = { duration, delay, easing: EASE, fill: 'both' };
  wrap.animate([{ transform: `translate(${from.cx}px,${from.cy}px)` }, { transform: `translate(${mx}px,${my}px)`, offset: 0.5 }, { transform: `translate(${to.cx}px,${to.cy}px)` }], o);
  const tip = to.cx < from.cx ? -8 : 8;
  g.animate([
    { transform: `rotateX(${from.tilt}deg) rotateY(${spin}deg) scale(1)`, opacity: 1 },
    { transform: `rotateX(${(from.tilt + to.tilt) / 2 - 10}deg) rotateY(0deg) rotate(${tip}deg) scale(${((1 + s1) / 2) * 1.18})`, opacity: 1, offset: 0.5 },
    { transform: `rotateX(${to.tilt}deg) rotateY(0deg) scale(${s1})`, opacity: fade ? 0.15 : 1 },
  ], o).onfinish = () => wrap.remove();
  return duration + delay;
}
const hideFor = (el, ms) => el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.97 }, { opacity: 1 }], { duration: ms + 20, fill: 'backwards' });

export function animateFrom(before, { originFor, exitFor, onMove, onFlip, onEnter, onLand }) {
  const seen = new Set();
  const u = unit();
  let enterIdx = 0;
  // Read every card's position first, then start the animations. Doing both in one loop made the browser lay the
  // whole table out again for every single card, which was most of the cost of a redraw.
  const items = [];
  for (const el of document.querySelectorAll('[data-cid]')) {
    const cid = el.dataset.cid;
    if (seen.has(cid)) continue;
    seen.add(cid);
    const now = el.getBoundingClientRect();
    if (!now.width) continue;
    items.push({ el, cid, now, zone: zoneOf(el), tilt: tiltOf(el), ...spot(el) });
  }
  const measured = new Map(); // where the piles are, read once and before anything moves
  const pileInfo = (node) => {
    let m = measured.get(node);
    if (!m) { const plane = node.closest('.plane'); measured.set(node, (m = { rect: node.getBoundingClientRect(), loc: plane ? place(node, plane) : null })); }
    return m;
  };
  for (const id of ['pile-res', 'pile-play']) { const c = document.getElementById(id)?.querySelector('.card'); if (c) pileInfo(c); }
  for (const { el, cid, now, zone, sp, loc, tilt } of items) {
    const old = before.get(cid);
    const felt = sp === 'felt';
    if (old) {
      const flipped = old.face !== el.dataset.face;
      if (old.sp === sp && loc && old.loc) { // same space: move in that space's own coordinates
        const dx = old.loc.x - loc.x, dy = old.loc.y - loc.y, sx = old.loc.w / loc.w;
        const dist = Math.hypot(dx, dy);
        const moved = dist > 2.5 || Math.abs(sx - 1) > 0.03;
        if (!moved && !flipped) continue;
        const far = dist > u * 9;
        if (old.zone === 'opp' && (far || zone !== 'opp')) { popIn(el); if (flipped) flipIn(el, 80); continue; } // from someone else's area: no flight
        const start = `translate3d(${dx}px,${dy}px,0) scale(${sx})`;
        let frames, duration;
        if (far) {
          const lift = felt ? Math.min(u * 9, u * 3 + dist * 0.12) : 0, rise = felt ? 0 : Math.min(70, 22 + dist * 0.07), tip = dx > 0 ? -7 : 7;
          frames = [
            { transform: start, zIndex: 50 },
            { transform: `translate3d(${dx * 0.46}px,${dy * 0.46 - rise}px,${lift}px) scale(${((sx + 1) / 2) * 1.12}) ${felt ? 'rotateX(-22deg) ' : ''}rotate(${tip}deg)`, zIndex: 50, offset: 0.5 },
            { transform: `translate3d(0,0,${lift * 0.12}px) scale(1.05) rotate(${-tip * 0.25}deg)`, zIndex: 50, offset: 0.86 },
            { transform: 'translate3d(0,0,0)', zIndex: 50 },
          ];
          duration = 560 + Math.min(280, dist * 0.3);
        } else {
          frames = [{ transform: start, zIndex: 50 }, { transform: `translate3d(${dx * 0.4}px,${dy * 0.4}px,${felt ? u * 0.8 : 0}px)`, zIndex: 50, offset: 0.5 }, { transform: 'translate3d(0,0,0)', zIndex: 50 }];
          duration = 320;
        }
        el.animate(frames, { duration, easing: EASE });
        if (flipped) { flipIn(el, far ? duration * 0.45 : 0); onFlip?.(el); }
        if (moved && far) { onMove?.(el); setTimeout(() => onLand?.(el), duration * 0.84); }
      } else if (old.sp !== sp) { // between my hand and the felt: a copy flies across
        if (old.zone === 'opp' || zone === 'opp' || camMoving()) { popIn(el); if (flipped) flipIn(el, 80); continue; }
        const ms = fly(el, screenOf(old.rect, old.tilt), screenOf(now, tilt), { duration: 620 });
        hideFor(el, ms);
        onMove?.(el); setTimeout(() => onLand?.(el), ms);
        if (flipped) { flipIn(el, ms); onFlip?.(el); }
      }
    } else {
      const from = zone === 'opp' ? null : originFor?.(el);
      if (!from) { popIn(el); continue; }
      const delay = Math.min(enterIdx++, 8) * 95;
      if (felt && loc) { // dealt across the felt: leaves the pile edge-on, turns in the air, lands with a bounce
        const o = pileInfo(from).loc;
        const dx = o.x - loc.x, dy = o.y - loc.y, s0 = o.w / loc.w, lift = Math.min(u * 10, u * 4 + Math.hypot(dx, dy) * 0.1);
        el.animate([
          { transform: `translate3d(${dx}px,${dy}px,${u * 1.6}px) scale(${s0}) rotateY(84deg) rotate(-14deg)`, opacity: 0.9, zIndex: 50 },
          { transform: `translate3d(${dx * 0.42}px,${dy * 0.42}px,${lift}px) scale(${((s0 + 1) / 2) * 1.16}) rotateX(-24deg) rotateY(0deg) rotate(6deg)`, opacity: 1, zIndex: 50, offset: 0.55 },
          { transform: `translate3d(0,0,${u * 0.5}px) scale(1.06) rotate(-1.5deg)`, zIndex: 50, offset: 0.86 },
          { transform: 'translate3d(0,0,0)', opacity: 1, zIndex: 50 },
        ], { duration: 680, delay, easing: EASE, fill: 'backwards' });
        onEnter?.(el, delay);
        setTimeout(() => onLand?.(el), delay + 590);
      } else if (camMoving()) { // sitting down: my hand slides in from the side
        el.animate([{ translate: '130% 0', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 520, delay: 500 + delay, easing: EASE, fill: 'backwards' });
        onEnter?.(el, 500 + delay);
      } else { // from the pile up into my hand
        const ms = fly(el, screenOf(pileInfo(from).rect, T()), screenOf(now, 0), { duration: 640, delay, spin: 80 });
        hideFor(el, ms);
        onEnter?.(el, delay);
        setTimeout(() => onLand?.(el), ms);
      }
    }
  }
  // cards that are gone: a copy flies off to the pile (never from another player's area)
  for (const [cid, old] of before) {
    if (seen.has(cid) || !old.rect.width || old.zone === 'opp') continue;
    const to = exitFor?.(cid);
    if (!to) continue;
    fly(old.node, screenOf(old.rect, old.tilt), screenOf(pileInfo(to).rect, T()), { duration: 540, fade: true });
  }
}

export function flipIn(el, delay = 0) {
  const inner = el.querySelector('.cardface') || el;
  inner.animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(90deg)', filter: 'brightness(2.2)' }, { transform: 'rotateY(0)' }], { duration: 480, delay, easing: 'ease-out', fill: 'backwards' });
}

// Tilt a card toward the pointer, the way a held card catches the light.
export function tilt(el, e) {
  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty('--rx', `${(-py * 12).toFixed(1)}deg`);
  el.style.setProperty('--ry', `${(px * 14).toFixed(1)}deg`);
  el.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(0)}%`);
  el.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(0)}%`);
}
export function untilt(el) { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); }

// A short effect drawn over one player's panel and clipped to it, so what the other
// players do never takes over the whole screen.
export function seatFx(seat, html, ms = 2600, color = '') {
  if (!seat) return;
  const parts = seat.classList.contains('opp') ? [...seat.querySelectorAll('.bust, .tent, .cards')] : [seat];
  const rs = parts.map((p) => p.getBoundingClientRect());
  const left = Math.min(...rs.map((q) => q.left)), top = Math.max(0, Math.min(...rs.map((q) => q.top)));
  const r = { left, top, width: Math.max(...rs.map((q) => q.right)) - left, height: Math.max(...rs.map((q) => q.bottom)) - top };
  const box = document.createElement('div');
  box.className = 'sfx';
  Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  box.style.setProperty('--ms', `${ms}ms`);
  if (color) box.style.setProperty('--c', color);
  box.innerHTML = html;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), ms);
}
