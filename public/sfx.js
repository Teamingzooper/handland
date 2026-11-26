// Sound. Every effect, the music and the room ambience are real recordings made by other people and
// shared as CC0 on freesound.org (see audio/CREDITS.md). Nothing here is synthesised: this file only
// loads the files in public/audio and decides which ones play, how loud, and when.
// Call sfx.name() to play. Browsers only allow sound after the first click, so everything stays
// silent until unlock() has run.

const DIR = 'audio/';
let ctx = null, master = null, musicGain = null, roomGain = null, meter = null;
const prefs = JSON.parse(localStorage.getItem('handland-audio') || '{"sound":true,"music":true}');
const save = () => localStorage.setItem('handland-audio', JSON.stringify(prefs));

// Recordings that come in several takes: a random take is used each time so repeats don't sound stamped out.
const TAKES = { tick: 7, pick: 6, slide: 6, drop: 6, shuffle: 6, chip: 5, clatter: 4, flip: 3 };
// One layer of a sound: which recording, how loud, how long after the start, and optional pitch (rate) or pitch wobble (jit).
const L = (s, vol = 1, at = 0, o = {}) => ({ s, vol, at, ...o });

const SOUNDS = {
  // hands and cards
  hover: [L('tick', 0.22, 0, { jit: 0.12 })],
  click: [L('click', 0.65)],
  select: [L('pick', 0.42, 0, { jit: 0.06 })],
  slide: [L('slide', 0.5, 0, { jit: 0.06 })],
  deal: [L('drop', 0.7, 0, { jit: 0.08 })],
  flip: [L('flip', 0.95, 0, { jit: 0.05 })],
  shuffle: [L('shuffle', 0.7), L('shuffle', 0.6, 0.75)],
  chip: [L('chip', 0.55, 0, { jit: 0.06 })],
  // a card slapped onto the table
  play: [L('slap', 0.6), L('thud', 0.3, 0.01)],
  resolve: [L('stamp', 0.7), L('typeding', 0.5, 0.12)],
  // trades
  offer: [L('slide', 0.65), L('knock', 0.35, 0.22)],
  swap: [L('slide', 0.6), L('slide', 0.6, 0.16), L('pick', 0.5, 0.34)],
  decline: [L('knock', 0.95), L('knock', 0.8, 0.17, { rate: 0.94 })],
  scammed: [L('scratch', 0.5), L('aww2', 0.5, 0.3)],
  // the moment someone shouts "scam!": a hand hits the table and the room gasps
  call: [L('slam', 0.6), L('gasp', 0.5, 0.12)],
  liar: [L('hit', 0.85), L('ooh', 0.7, 0.1)],
  honest: [L('ding', 0.6), L('applause', 0.4, 0.15)],
  lawsuit: [L('gavel0', 0.9), L('gavel1', 0.9, 0.26)],
  // card effects
  bust: [L('siren', 0.45), L('cuffs', 0.7, 0.55)],
  strike: [L('deskslam', 0.55), L('glass', 0.6, 0.05)],
  coin: [L('coins', 1)],
  peek: [L('shutter', 0.8)],
  heat: [L('match', 0.7), L('fire', 0.5, 0.3)],
  cover: [L('unlock', 0.6), L('vault', 0.45, 0.15)],
  // Whistleblower: a real whistle, then the room reacts. Forced Trade: a card snatched away.
  whistle: [L('whistle', 0.5), L('gasp', 0.4, 0.5)],
  steal: [L('whoosh', 0.35), L('snatch', 0.9, 0.06), L('snatch2', 0.9, 0.16)],
  // one bright note; played at a rising pitch as each card of a monopoly is counted
  chime: [L('typeding', 0.55), L('chip', 0.4)],
  // turn and score
  turn: [L('bell', 0.85)],
  hold: [L('heart', 0.6)],
  broken: [L('crack', 0.55), L('bottle', 0.5, 0.08)],
  token: [L('register', 0.85), L('chips', 0.6, 0.45), L('yay', 0.3, 0.5)],
  win: [L('fanfare', 0.9), L('cheer', 0.7, 0.4)],
  lose: [L('aww', 0.5), L('trombone', 0.5, 0.5)],
  tick: [L('clock', 0.32)],
  error: [L('blip', 0.18, 0, { rate: 0.7 }), L('blip', 0.18, 0.11, { rate: 0.6 })],
};
const MUSIC = ['speakeasy', 'jazzloop', 'rustedmaid', 'bluesimpro', 'smoothkeys'];
const MUSIC_VOL = 0.36, ROOM_VOL = 0.12;

// Fetch every file straight away (no sound can play yet), decode once the browser lets us make an AudioContext.
const files = new Set(['room']);
for (const layers of Object.values(SOUNDS)) for (const l of layers) {
  if (TAKES[l.s]) for (let i = 0; i < TAKES[l.s]; i++) files.add(l.s + i); else files.add(l.s);
}
const raw = {}, buf = {};
const ext = (n) => (n === 'room' ? '.mp3' : '.wav');
const fetched = Promise.all([...files].map((n) => fetch(DIR + n + ext(n)).then((r) => (r.ok ? r.arrayBuffer() : null)).then((a) => { if (a) raw[n] = a; }).catch(() => {})));

function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.ratio.value = 4;
  comp.connect(ctx.destination);
  meter = ctx.createAnalyser(); meter.fftSize = 2048; comp.connect(meter);
  master = ctx.createGain();
  master.gain.value = prefs.sound ? 0.9 : 0;
  master.connect(comp);
  musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(comp);
  roomGain = ctx.createGain(); roomGain.gain.value = 0; roomGain.connect(master);
  fetched.then(() => Promise.all(Object.keys(raw).map((n) => ctx.decodeAudioData(raw[n]).then((b) => { buf[n] = b; delete raw[n]; }).catch(() => {})))).then(startRoom);
  if (prefs.music) startMusic();
}

const lastTake = {};
function take(s) {
  const n = TAKES[s];
  if (!n) return s;
  let i = Math.floor(Math.random() * n);
  if (i === lastTake[s]) i = (i + 1) % n;
  lastTake[s] = i;
  return s + i;
}
function playLayer({ s, vol, at, rate = 1, jit = 0 }, pitch = 1) {
  const b = buf[take(s)];
  if (!b) return;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = b;
  src.playbackRate.value = pitch * rate * (1 + (Math.random() * 2 - 1) * jit);
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start(ctx.currentTime + at);
}

// The room: quiet bar chatter looping under everything. It follows the Sound switch.
let roomOn = false;
function startRoom() {
  if (roomOn || !buf.room) return;
  roomOn = true;
  const src = ctx.createBufferSource();
  src.buffer = buf.room; src.loop = true; src.connect(roomGain); src.start();
  roomGain.gain.linearRampToValueAtTime(ROOM_VOL, ctx.currentTime + 4);
}

// Music: recorded jazz tracks played one after another in a shuffled order.
let player = null, order = [], musicOn = false;
function nextTrack() {
  if (!musicOn) return;
  if (!order.length) {
    order = [...MUSIC].sort(() => Math.random() - 0.5);
    if (player && order[0] === player.dataset.name && order.length > 1) order.push(order.shift());
  }
  const name = order.shift();
  if (!player) {
    player = new Audio();
    player.preload = 'auto';
    player.addEventListener('ended', nextTrack);
    player.addEventListener('error', () => setTimeout(nextTrack, 2000));
    ctx.createMediaElementSource(player).connect(musicGain);
  }
  player.dataset.name = name;
  player.src = `${DIR}music_${name}.mp3`;
  player.play().catch(() => {});
}
function startMusic() {
  if (!ctx || musicOn) return;
  musicOn = true;
  musicGain.gain.cancelScheduledValues(ctx.currentTime);
  musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
  musicGain.gain.linearRampToValueAtTime(MUSIC_VOL, ctx.currentTime + 3);
  if (player && player.src && !player.ended) player.play().catch(() => {}); else nextTrack();
}
function stopMusic() {
  musicOn = false;
  if (!ctx) return;
  musicGain.gain.cancelScheduledValues(ctx.currentTime);
  musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
  musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  setTimeout(() => { if (!musicOn) player?.pause(); }, 700);
}

const last = {};
export const sfx = new Proxy({}, {
  // sfx.name() plays a sound; sfx.name({ rate: 1.2 }) plays it higher, for runs that climb in pitch.
  get: (_, name) => (opts) => {
    if (!ctx || !prefs.sound || !SOUNDS[name]) return;
    const now = performance.now();
    if (now - (last[name] || 0) < 45) return; // don't stack the same sound on itself
    last[name] = now;
    try { SOUNDS[name].forEach((l) => playLayer(l, opts?.rate || 1)); } catch { /* audio is never worth crashing for */ }
  },
});
export const audio = {
  unlock, prefs,
  toggleSound() { prefs.sound = !prefs.sound; save(); if (master) master.gain.value = prefs.sound ? 0.9 : 0; return prefs.sound; },
  toggleMusic() { prefs.music = !prefs.music; save(); unlock(); if (prefs.music) startMusic(); else stopMusic(); return prefs.music; },
  // for checking from the console: what loaded, what is playing
  // how loud the output is right now (0 to 1); lets a test confirm sound is really coming out
  level() { if (!meter) return 0; const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d); return Math.sqrt(d.reduce((t, x) => t + x * x, 0) / d.length); },
  state: () => ({ loaded: Object.keys(buf).length, wanted: files.size, missing: [...files].filter((n) => !buf[n]), track: player?.dataset.name || null, time: player?.currentTime || 0, ctx: ctx?.state || null }),
};
window.__audio = audio;
