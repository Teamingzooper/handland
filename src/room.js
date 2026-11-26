// A Handland game room: who is sitting where, the game itself, the bots' moves, the clocks, the tutorial script.
// Nothing in here knows about the network. The server (server.js) puts HTTP in front of it; on a plain web page with
// no server, the browser loads this same file and runs the room inside the page (public/client.js does that).
import { newGame, applyAction, actors, viewFor, playerLeft, CARDS, TYPES, RULES, POWERS } from './engine.js';
import { botAction, safeAction } from './bots.js';
import { tutorialGame, BEATS, COACH } from './tutorial.js';

// Random numbers good enough for room codes and seat tokens, in Node and in a browser alike.
const randInt = (n) => { const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); return a[0] % n; };
const hex = (bytes) => [...globalThis.crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
const DEV = () => !!globalThis.process?.env?.HANDLAND_DEV;
// The address other devices use to reach this game. Only a server has one.
let lanFn = () => '';
export const setLan = (fn) => { lanFn = fn; };
export const rulesData = () => ({ CARDS, TYPES, RULES, POWERS });

const BOT_NAMES = ['Baron Bluff', 'Madame Margin', 'Slick Rick', 'Lady Ledger', 'Duke Dividend', 'Uncle Pennybags-Not', 'Countess Cartel'];
const MAX_SEATS = 6;
const BOT_DELAY = 1300, REVEAL_DELAY = 3600, COST_WINDOW = 15000, TRADE_WINDOW = 75000, OPEN_WINDOW = 30000, AWAY_GRACE = 20000;

const rooms = new Map();

function makeRoom() {
  let code;
  do { code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[randInt(24)]).join(''); } while (rooms.has(code));
  const room = { code, watchers: [], seats: [], state: null, opts: { difficulty: 1, speed: 1, clock: 1, without: [], marks: 'all' }, look: { theme: 'backroom', deck: 'classic', bg: 'none' }, winTarget: RULES.winTarget, timer: null, deadline: null, deadlineFor: null, lastReveal: 0, touched: Date.now() };
  rooms.set(code, room);
  return room;
}
// A player's own portrait, built on the Customize screen. Only small whole numbers are kept.
function cleanAvatar(a) {
  if (!a || a.style !== 'face') return null;
  const n = (v, max) => (Number.isInteger(v) && v >= 0 && v < max ? v : 0);
  return { style: 'face', hat: n(a.hat, 7), skin: n(a.skin, 6), extra: n(a.extra, 4), suit: n(a.suit, 5) };
}
function addSeat(room, name, isBot, avatar = null) {
  const seat = { name, isBot, avatar: isBot ? null : cleanAvatar(avatar), token: isBot ? null : hex(12), streams: new Set(), awaySince: Date.now() };
  room.seats.push(seat);
  return seat;
}
function botName(room) {
  return BOT_NAMES.find((n) => !room.seats.some((s) => s.name === n)) || `Bot ${room.seats.length + 1}`;
}

function payload(room, idx) {
  return {
    code: room.code, you: idx, spectator: idx < 0, host: room.seats.findIndex((s) => !s.isBot), started: !!room.state, winTarget: room.winTarget, marks: room.opts.marks, look: room.look,
    lan: lanFn(), seats: room.seats.map((s) => ({ name: s.name, isBot: s.isBot, avatar: s.avatar, online: s.isBot || s.streams.size > 0 })),
    msLeft: room.deadline ? Math.max(0, room.deadline - Date.now()) : null,
    coach: room.tutorial ? { text: BEATS[room.tutorial.i].text || '', step: room.tutorial.i, total: BEATS.length, next: BEATS[room.tutorial.i].who === 'info', done: !!BEATS[room.tutorial.i].done } : null,
    view: room.state ? viewFor(room.state, idx) : null,
  };
}
function broadcast(room) {
  room.seats.forEach((seat, idx) => {
    if (!seat.streams.size) return;
    const data = `data: ${JSON.stringify(payload(room, idx))}\n\n`;
    for (const res of seat.streams) res.write(data);
  });
  // Spectators (a TV, a stream) all get the same public view: nobody's hidden cards.
  const watching = room.watchers.filter((w) => w.streams.size);
  if (watching.length) {
    const data = `data: ${JSON.stringify(payload(room, -1))}\n\n`;
    for (const w of watching) for (const res of w.streams) res.write(data);
  }
}

// A seat is driven by the computer if it is a bot, or a human who has been gone a while.
function isAuto(seat) {
  return seat.isBot || (seat.streams.size === 0 && seat.awaySince !== null && Date.now() - seat.awaySince > AWAY_GRACE);
}

// Decide what happens next without a human click: a bot moves, or a clock runs.
function tick(room) {
  clearTimeout(room.timer);
  room.timer = null;
  const s = room.state;
  if (room.tutorial) { tutorialTick(room); return; }
  if (!s || s.phase === 'over') { room.deadline = null; return; }
  const who = actors(s);
  const auto = who.filter((id) => isAuto(room.seats[id]));
  if (auto.length) {
    const delay = s.revealN !== room.lastReveal ? REVEAL_DELAY : BOT_DELAY * room.opts.speed;
    room.timer = setTimeout(() => {
      room.lastReveal = s.revealN;
      const costWindow = s.pending?.kind === 'cost';
      // Calls on a payment go round the table one seat at a time. Bots sitting next to each other answer in the same beat
      // so a full lap of passes does not drag; any other move is one at a time.
      for (let k = 0; k < room.seats.length; k++) {
        const id = actors(s)[0];
        if (id === undefined || !isAuto(room.seats[id])) break;
        if (applyAction(s, id, botAction(s, id)).error) applyAction(s, id, safeAction(s, id));
        if (!costWindow || s.pending?.kind !== 'cost') break;
      }
      broadcast(room);
      tick(room);
    }, delay);
    return;
  }
  // Only humans left to act. Give them a clock when they are holding up someone else's play.
  if (s.pending) {
    const key = `${s.pendingN}`;
    if (room.deadlineFor !== key) {
      room.deadlineFor = key;
      room.deadline = Date.now() + (['cost', 'alibi'].includes(s.pending.kind) ? COST_WINDOW : ['tip', 'power', 'dup'].includes(s.pending.kind) || (s.pending.open && s.pending.stage === 'response') ? OPEN_WINDOW : TRADE_WINDOW) * room.opts.clock;
      broadcast(room); // so everyone's countdown starts
    }
    room.timer = setTimeout(() => {
      room.deadline = null;
      applyAction(s, -1, { type: 'timeout' });
      broadcast(room);
      tick(room);
    }, Math.max(0, room.deadline - Date.now()));
  } else {
    room.deadline = null;
    // If the player whose turn it is has left, check back once the grace period is up.
    if (who.some((id) => room.seats[id].streams.size === 0)) room.timer = setTimeout(() => tick(room), AWAY_GRACE + 500);
  }
}

// Tutorial rooms follow the script instead of the bot brain, and never run a clock.
function tutorialTick(room) {
  const s = room.state, beat = BEATS[room.tutorial.i];
  if (beat.who !== 'coach') return;
  const delay = s.revealN !== room.lastReveal ? REVEAL_DELAY : 1700;
  room.timer = setTimeout(() => {
    room.lastReveal = s.revealN;
    const r = applyAction(s, 1, beat.act(s));
    if (r.error) console.error('tutorial script error:', r.error);
    room.tutorial.i++;
    skipQuietBeats(room);
    broadcast(room);
    tick(room);
  }, delay);
}
// If the game ended, jump to the closing beat.
function skipQuietBeats(room) {
  if (room.state.phase === 'over') room.tutorial.i = BEATS.length - 1;
}

function startGame(room) {
  room.state = newGame({ names: room.seats.map((s) => s.name), bots: room.seats.map((s) => s.isBot), winTarget: room.winTarget, difficulty: room.opts.difficulty, without: room.opts.without, marks: room.opts.marks });
  room.lastReveal = 0; room.deadline = null; room.deadlineFor = null;
}

// ---------- HTTP ----------

const fail = (m) => ({ error: m });
// The host's cosmetic choice for the whole table. The server only passes the names along; the client knows what they look like.
const lookId = (v, d) => (typeof v === 'string' && /^([a-z]{1,16}|custom-[a-z0-9]{4,12})$/.test(v) ? v : d);
// A deck someone made in the Deck Maker: names, colours and photos. Kept as plain checked strings and handed to the other players.
function cleanDeck(d) {
  if (!d || typeof d !== 'object' || !/^custom-[a-z0-9]{4,12}$/.test(d.id)) return null;
  const strs = (o, max, ok = () => true) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => /^[A-Za-z]{1,20}$/.test(k) && typeof v === 'string' && v.length <= max && ok(v)).slice(0, 20));
  return {
    id: d.id, name: String(d.name || 'Custom deck').slice(0, 24), rev: Number(d.rev) || 0,
    colors: strs(d.colors, 7, (v) => /^#[0-9a-fA-F]{6}$/.test(v)), names: strs(d.names, 16), icons: strs(d.icons, 8),
    art: strs(d.art, 400000, (v) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)),
  };
}
const cleanLook = (l) => ({ theme: lookId(l?.theme, 'backroom'), deck: lookId(l?.deck, 'classic'), bg: lookId(l?.bg, 'none') });
const cleanName = (n) => String(n || '').replace(/[<>&"]/g, '').trim().slice(0, 16) || 'Player';

export function api(route, body) {
  if (route === 'create' && body.tutorial) {
    const room = makeRoom();
    const seat = addSeat(room, cleanName(body.name), false, body.avatar);
    addSeat(room, COACH, true);
    room.winTarget = 1;
    room.tutorial = { i: 0 };
    room.state = tutorialGame(seat.name);
    return { code: room.code, token: seat.token };
  }
  if (route === 'create') {
    const room = makeRoom();
    const seat = addSeat(room, cleanName(body.name), false, body.avatar);
    const bots = Math.max(0, Math.min(MAX_SEATS - 1, Number(body.bots) || 0));
    // Game settings chosen on the bot-game menu. Anything missing or odd falls back to the normal game.
    const o = body.opts || {}, oneOf = (v, list, d) => (list.includes(v) ? v : d);
    room.opts = { marks: oneOf(o.marks, ['all', 'looks', 'none'], 'all'), difficulty: oneOf(o.difficulty, [0, 1, 2, 3], 1), speed: oneOf(o.speed, [0.5, 1, 1.8], 1), clock: oneOf(o.clock, [0.5, 1, 2, 4], 1), without: Array.isArray(o.without) ? o.without.filter((k) => ['whistleblower', 'lawsuit', 'forcedTrade', 'strike'].includes(k)) : [] };
    room.winTarget = oneOf(o.winTarget, [1, 2, 3], RULES.winTarget);
    room.look = cleanLook(body.look);
    room.customDeck = cleanDeck(body.customDeck);
    if (room.look.deck.startsWith('custom-') && room.customDeck?.id !== room.look.deck) room.look.deck = 'classic';
    for (let i = 0; i < bots; i++) addSeat(room, botName(room), true);
    if (body.start && bots > 0) { startGame(room); tick(room); }
    return { code: room.code, token: seat.token };
  }
  const room = rooms.get(String(body.code || '').toUpperCase());
  if (!room) return fail('No game with that code.');
  room.touched = Date.now();
  if (route === 'getdeck') return { deck: room.customDeck || null };
  // Watch a game without playing in it. Allowed at any time, also after the game has started.
  if (route === 'watch') {
    if (room.watchers.length >= 12) return fail('Too many screens are already watching this game.');
    const w = { token: hex(12), streams: new Set() };
    room.watchers.push(w);
    return { code: room.code, token: w.token, watch: true };
  }
  if (route === 'join') {
    if (room.state) return fail('That game has already started.');
    if (room.seats.length >= MAX_SEATS) return fail('That game is full.');
    let name = cleanName(body.name);
    while (room.seats.some((s) => s.name === name)) name = `${name.slice(0, 14)}2`;
    const seat = addSeat(room, name, false, body.avatar);
    broadcast(room);
    return { code: room.code, token: seat.token };
  }
  const idx = room.seats.findIndex((s) => s.token && s.token === body.token);
  if (idx < 0) return fail('You are not in this game.');
  const isHost = idx === room.seats.findIndex((s) => !s.isBot);
  if (route === 'deck') {
    if (!isHost) return fail('Only the host can do that.');
    room.customDeck = cleanDeck(body.deck);
    return room.customDeck ? { ok: true } : fail('That deck could not be read.');
  }
  // Leaving on purpose (the Leave button). In the lobby the seat is simply freed. In a game the table is told and a
  // bot takes the seat over at once; closing the window by accident is different (see isAuto: a short grace, then the
  // computer covers for you until you come back).
  if (route === 'leave') {
    const seat = room.seats[idx];
    for (const res of seat.streams) res.end();
    seat.streams.clear();
    if (room.tutorial) { rooms.delete(room.code); clearTimeout(room.timer); return { ok: true }; }
    if (!room.state) room.seats.splice(idx, 1);
    else { seat.isBot = true; seat.token = null; seat.avatar = null; playerLeft(room.state, idx); }
    if (!room.seats.some((x) => !x.isBot)) { rooms.delete(room.code); clearTimeout(room.timer); return { ok: true }; } // nobody left to play for
    broadcast(room); tick(room);
    return { ok: true };
  }
  if (route === 'lobby' && body.op === 'tutNext') {
    if (!room.tutorial || BEATS[room.tutorial.i].who !== 'info' || BEATS[room.tutorial.i].done) return fail('Nothing to continue.');
    room.tutorial.i++;
    broadcast(room); tick(room);
    return { ok: true };
  }
  if (route === 'lobby') {
    if (room.tutorial) return fail('That is not available in the tutorial.');
    if (!isHost) return fail('Only the host can do that.');
    if (body.op === 'look') {
      room.look = cleanLook(body.value);
      if (room.look.deck.startsWith('custom-') && room.customDeck?.id !== room.look.deck) room.look.deck = 'classic';
      broadcast(room); return { ok: true };
    }
    if (body.op === 'rematch') { if (room.state?.phase !== 'over') return fail('The game is not over.'); startGame(room); }
    else if (body.op === 'toLobby') { if (room.state?.phase !== 'over') return fail('The game is not over.'); clearTimeout(room.timer); room.state = null; }
    else if (room.state) return fail('The game has already started.');
    else if (body.op === 'addBot') { if (room.seats.length >= MAX_SEATS) return fail('The table is full.'); addSeat(room, botName(room), true); }
    else if (body.op === 'removeBot') { const i = room.seats.findLastIndex((s) => s.isBot); if (i >= 0) room.seats.splice(i, 1); }
    else if (body.op === 'target') room.winTarget = Math.max(1, Math.min(3, Number(body.value) || 2));
    else if (body.op === 'marks') room.opts.marks = ['all', 'looks', 'none'].includes(body.value) ? body.value : 'all';
    else if (body.op === 'start') { if (room.seats.length < 2) return fail('You need at least 2 players. Add a bot!'); startGame(room); }
    else return fail('Unknown lobby action.');
    broadcast(room); tick(room);
    return { ok: true };
  }
  // Test-only (the server must be started with HANDLAND_DEV=1): put chosen cards in my hand, set my Heat, place a
  // Duplicator, or make a seat hold a monopoly.
  if (route === 'rig' && DEV() && room.state) {
    const st = room.state, me = st.players[idx];
    if (body.hand) me.hand = body.hand.map((kind) => ({ id: st.nextId++, kind }));
    if (body.res) me.res = body.res.map((type) => ({ id: st.nextId++, type }));
    if (body.heat !== undefined) me.heat = body.heat;
    if (body.dup !== undefined) me.boosts = [...me.boosts.filter((b) => b.kind !== 'duplicator'), { id: st.nextId++, kind: 'duplicator', expanded: false, on: body.dup === 'loose' ? null : me.res[body.dup].id }]; // a Duplicator under my Nth card, or a loose one
    if (body.theirDup) { const t = st.players[body.theirDup.seat]; t.boosts.push({ id: st.nextId++, kind: 'duplicator', expanded: false, on: t.res[body.theirDup.at].id }); }
    if (body.hold !== undefined) { const t = st.players[body.hold]; t.res = Array.from({ length: 5 }, () => ({ id: st.nextId++, type: 'Oil' })); t.holding = 'Oil'; }
    broadcast(room); tick(room);
    return { ok: true };
  }
  if (route === 'act') {
    if (!room.state) return fail('The game has not started.');
    if (body.action?.type === 'timeout') return fail('Unknown action.');
    if (room.tutorial) {
      const beat = BEATS[room.tutorial.i];
      if (beat.who === 'coach') return fail('One moment, the Coach is making a move.');
      if (beat.who === 'info') return fail(beat.done ? 'The tutorial is finished.' : 'Read the Coach\'s note and click Next first.');
      if (!beat.allow(body.action || {}, room.state)) return fail(beat.hint);
    }
    const r = applyAction(room.state, idx, body.action);
    if (r.error) return r;
    if (room.tutorial) { room.tutorial.i++; skipQuietBeats(room); }
    broadcast(room); tick(room);
    return { ok: true };
  }
  return fail('Unknown request.');
}


// A screen starts listening to a room. `sink` is anything with write(text) and end(): an open HTTP response on the
// server, or a plain object when the room runs inside the page. Returns a function that stops listening, or null if
// there is no such room or seat.
export function attach(code, token, sink) {
  const room = rooms.get(String(code || '').toUpperCase());
  const idx = room ? room.seats.findIndex((s) => s.token && s.token === token) : -1;
  const watcher = room && idx < 0 ? room.watchers.find((w) => w.token === token) : null;
  if (watcher) {
    watcher.streams.add(sink);
    sink.write(`data: ${JSON.stringify(payload(room, -1))}\n\n`);
    return () => watcher.streams.delete(sink);
  }
  if (idx < 0) return null;
  const seat = room.seats[idx];
  seat.streams.add(sink); seat.awaySince = null;
  sink.write(`data: ${JSON.stringify(payload(room, idx))}\n\n`);
  broadcast(room);
  return () => {
    seat.streams.delete(sink);
    if (!seat.streams.size) { seat.awaySince = Date.now(); broadcast(room); tick(room); }
  };
}
// Forget rooms nobody has touched for six hours.
export function sweep() {
  for (const [code, room] of rooms) if (Date.now() - room.touched > 6 * 3600e3) { clearTimeout(room.timer); rooms.delete(code); }
}
