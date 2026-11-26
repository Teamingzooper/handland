// Handland client. The server sends this player's view of the table; we redraw the
// screen from it, glide the cards from where they were to where they are now, and
// play sound and particles for whatever just happened.
import { art, CARD_BACK, cardBackUrl, crest as drawCrest, ico, seatColor, setArtDeck, ART_PACKS, AVATAR_OPTIONS } from './art.js';
import { BACKDROP_ART, backdropLayers } from './backdrops.js';
import { qrSvg } from './qr.js';
import { hostRoom, joinRoom } from './net.js';
import { sfx, audio } from './sfx.js';
import { snapshot, animateFrom, burst, burstAt, puff, seatFx, streak, rain, shake, tilt, untilt, centerOf, camIntro, camApply, camFocus, camKick, camLook, gfx, setLite } from './fx.js';

const $ = (id) => document.getElementById(id);
// ---------- what kind of screen is this? ----------
// touch: fingers, not a mouse (no hovering). phone: a small touch screen, which gets bigger controls and a simpler table.
// Add ?phone=1 to the address to see the phone layout on a computer.
const forcePhone = new URLSearchParams(location.search).get('phone') === '1';
const isTouch = () => forcePhone || matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
// How wide the notch (or rounded corner) is on each side, as the browser reports it.
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)';
document.documentElement.appendChild(safeProbe);
function sizeUp() {
  const w = window.innerWidth, h = window.innerHeight, touch = isTouch(), phone = touch && (forcePhone || Math.min(w, h) < 560);
  document.body.classList.toggle('touch', touch);
  document.body.classList.toggle('phone', phone);
  document.body.classList.toggle('portrait', phone && h > w);
  // Some phone browsers already keep the page clear of the notch and still report it. Room is only made for the
  // notch when the page really runs the full length of the screen, underneath it.
  const under = w >= Math.max(screen.width, screen.height) - 4;
  document.body.classList.toggle('inset', phone && !under);
  const cs = getComputedStyle(safeProbe), sl = phone && under ? parseFloat(cs.paddingLeft) || 0 : 0, sr = phone && under ? parseFloat(cs.paddingRight) || 0 : 0;
  // On a wide, short phone the table only uses the middle of the screen, so the controls grow into the spare room
  // at the sides: as big as they can get without reaching the cards on the table (which sit around the table's centre line).
  const u = Math.min(w / 100, h * 0.016), mid = w / 2 - 7.7 * u;
  const grow = Math.min(1.45, (mid - 5 * u - sl) / (33 * u), (w - sr - (mid + 44 * u)) / (15.4 * u));
  document.body.style.setProperty('--hud', phone && w > h ? Math.max(1, grow).toFixed(2) : '1');
}
// ---------- graphics level: Auto (the default), High or Low ----------
// Auto starts on High, except for people who asked their system for less motion, and steps down to Low
// by itself if this machine cannot keep the table smooth. The choice it lands on is remembered.
let gfxPref = localStorage.getItem('handland-gfx') || 'auto';
function applyGfx() {
  const wantsLess = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = document.body.classList.contains('phone');
  const autoLow = localStorage.getItem('handland-gfx-auto') === 'low';
  gfx.auto = gfxPref === 'auto';
  setLite(gfxPref === 'low' || (gfxPref === 'auto' && (wantsLess || autoLow)));
}
gfx.onAuto = () => { localStorage.setItem('handland-gfx-auto', 'low'); if (P?.started) render(); };
const gfxLabel = () => `Graphics: ${gfxPref === 'auto' ? `Auto (${gfx.lite ? 'Low' : 'High'})` : gfxPref === 'low' ? 'Low' : 'High'}`;
window.addEventListener('resize', sizeUp);
window.addEventListener('orientationchange', sizeUp);
sizeUp();
applyGfx();

// Every portrait goes through here so a player's custom face shows wherever their seat is drawn.
const crest = (name, seat, isBot, avatar) => drawCrest(name, seat, isBot, avatar !== undefined ? avatar : (P?.seats?.[seat] && !P.seats[seat].isBot ? P.seats[seat].avatar : null));
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rich = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n\n/g, '<br><br>');

let DEF = { CARDS: {}, TYPES: [], RULES: {} };
let session = JSON.parse(sessionStorage.getItem('handland') || 'null');
let P = null; // latest payload from the server
let ui = {}; // what the player has picked so far in the current panel
let stream = null, deadlineAt = null, shownReveal = null, lastFx = null, prevTokens = null, lastTick = 0;
let myName = localStorage.getItem('handland-name') || '';
let flatView = localStorage.getItem('handland-view') === '2d'; // top-down table instead of the 3D room
document.body.classList.toggle('flat', flatView);

// Where the game itself runs. Normally that is the small server inside the Handland app (or `npm start`). On a plain
// web page with no server behind it, the same game code is loaded into the page instead (`local`), which is enough
// for games against bots and the tutorial; playing with other people still needs something they can all reach.
let local = null, stopLocal = null;
// Playing over the internet (net.js). `hosting`: this page runs the game and other players' pages connect to it.
// `remote`: this page is one of those other players, and everything it asks goes to the host's page.
let remote = null, hosting = null, soloSite = false;
// Where the web version lives. Invite links made inside the app point there, because the app's own address
// (this computer) cannot be reached from outside the home network.
const WEB_HOME = 'https://teamingzooper.github.io/handland/';
const inviteBase = () => (soloSite ? location.origin + location.pathname : WEB_HOME);
async function post(route, body, quiet = false) {
  let out;
  if (remote) out = await remote.api(route, JSON.parse(JSON.stringify(body)));
  else if (local) {
    try { out = local.api(route, JSON.parse(JSON.stringify(body))); } catch (e) { console.error(e); out = { error: 'Something went wrong.' }; }
  } else {
    const r = await fetch(`api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    out = await r.json();
  }
  if (out.error && !quiet) { toast(out.error); sfx.error(); }
  return out;
}
const act = (action) => post('act', { code: session.code, token: session.token, action });
const lobby = (op, value) => post('lobby', { code: session.code, token: session.token, op, value });

let toastTimer;
function toast(msg) {
  $('toast').textContent = msg;
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 3600);
}
let bannerTimer;
function banner(text, sub = '', cls = '') {
  $('banner').innerHTML = `<div class="b ${cls}">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  $('banner').classList.remove('hidden');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => $('banner').classList.add('hidden'), 1750);
}

let unloading = false; // a page reload also closes the stream; that must not count as leaving
window.addEventListener('beforeunload', (e) => { if (hosting && P?.seats?.some((x, i) => !x.isBot && i !== P.you)) { e.preventDefault(); e.returnValue = ''; return; } unloading = true; }); // closing the host's page would end the game for everyone
window.addEventListener('pagehide', () => { unloading = true; });
function connect() {
  stream?.close();
  const got = (data) => { P = JSON.parse(data); deadlineAt = P.msLeft === null ? null : Date.now() + P.msLeft; render(); };
  if (remote) { // the room is in the host's page, at the other end of the link
    stopLocal?.();
    stopLocal = remote.attach(session.token, { write: (d) => got(d.slice(6)), gone: () => leaveGame() });
    return;
  }
  if (local) { // the room is in this page: listen to it directly
    stopLocal?.();
    stopLocal = local.attach(session.code, session.token, { write: (d) => setTimeout(() => { if (session) got(d.slice(6)); }, 0), end: () => {} });
    if (!stopLocal) leaveGame(); // the page was reloaded and that game is gone
    return;
  }
  stream = new EventSource(`api/events?code=${session.code}&token=${session.token}`);
  stream.onmessage = (e) => got(e.data);
  stream.onerror = () => {
    if (stream.readyState === EventSource.CLOSED && !unloading) leaveGame(); // the room is gone
  };
}
function enter(out) {
  if (!out.token) return;
  session = { code: out.code, token: out.token, net: remote ? 1 : 0 };
  sessionStorage.setItem('handland', JSON.stringify(session));
  ui = {}; shownReveal = null; lastFx = null; prevTokens = null;
  connect();
}
function leaveGame() {
  if (session && remote) { const link = remote; remote = null; stopLocal?.(); stopLocal = null; link.api('leave', { token: session.token }); setTimeout(() => link.close(), 500); }
  else if (session && local) { try { local.api('leave', { code: session.code, token: session.token }); } catch { /* the room is already gone */ } stopLocal?.(); stopLocal = null; }
  else if (session) fetch('api/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: session.code, token: session.token }), keepalive: true }).catch(() => {});
  if (hosting) { hosting.stop(); if (hosting.restore) local = null; hosting = null; } // the online table closes with its host
  stream?.close();
  sessionStorage.removeItem('handland');
  session = null; P = null; shownReveal = null; lastFx = null; prevTokens = null;
  history.replaceState(null, '', location.pathname);
  render();
}

// ---------- cards ----------

const pip = (t) => `<span class="pip p-${t}" title="${t}">${ico(t)}</span>`;
const costPips = (cost) => (cost.length ? cost.map(pip).join('') : '');
const costText = (cost) => (cost.length ? cost.join(' + ') : 'Free');
const typeLabel = (t) => `${ico(t)} ${t}`;

// preview: draw the back as its own picture (shop and Customize show decks that are not the one in use).
function resCard(r, { mine = false, cls = '', owner = null, preview = false, dup = null } = {}) {
  // A Duplicator lies tucked under the card it doubles, sticking out at the top. It is still a Boost: a Strike can be aimed at it.
  const under = dup ? `<div class="card pc boost dup" data-face="up" data-owner="${owner}" data-zone="boost" data-id="${dup.id}" data-insp="pc:duplicator"><div class="cardface">${art('duplicator')}</div>${dup.expanded ? '<span class="plus">+1</span>' : ''}</div>` : '';
  const x2 = (r.worth > 1 ? `<span class="x2">×${r.worth}</span>` : '') + under;
  const own = owner === null ? '' : `data-owner="${owner}" data-zone="res" data-id="${r.id}"`;
  if (!r.type || r.known) {
    const peek = r.known ? `<span class="peeked" title="You have seen this card">${ico(r.type)}<i>${r.type}</i></span>` : '';
    return `<div class="card back ${cls}" data-cid="r${r.id}" data-face="down" ${own} ${r.known && !mine ? `data-insp="res:${r.type}"` : ''}><div class="cardface">${preview ? CARD_BACK : ''}${peek}</div>${x2}</div>`;
  }
  return `<div class="card res t-${r.type} ${r.faceUp ? 'exposed' : ''} ${cls}" data-cid="r${r.id}" data-face="up" ${own} data-insp="${mine ? `mine:${r.id}` : `res:${r.type}`}">
    <div class="cardface"><div class="ttl">${r.type}</div>${art(r.type)}<div class="typ">Resource</div></div>${x2}${mine && r.faceUp ? '<span class="eye">Everyone sees this</span>' : ''}</div>`;
}
function playCard(kind, id, { cls = '', attrs = '' } = {}) {
  const d = DEF.CARDS[kind];
  return `<div class="card pc ${d.kind} ${d.name.length > 9 ? 'longname' : ''} ${cls}" data-cid="h${id}" data-face="up" ${attrs}>
    <div class="cardface"><div class="ttl"><span>${d.name}</span><span class="pips">${costPips(d.cost)}</span></div>${art(kind)}
    <div class="typ ${d.cost.length > 1 ? 'long' : ''}">${d.kind === 'boost' ? 'Boost' : 'Action'} · ${costText(d.cost)}</div><div class="txt">${d.short || d.text}</div></div></div>`;
}
const backCard = (cid, cls = '') => `<div class="card back ${cls}" ${cid ? `data-cid="${cid}"` : ''} data-face="down"><div class="cardface"></div></div>`;

// ---------- faces: bots react to what happens to them ----------
const moods = new Map(); // seat -> { mood, until }
const moodAttr = (pid) => { const m = moods.get(pid); return m && m.until > performance.now() ? `data-mood="${m.mood}"` : ''; };
function setMood(pid, mood, ms = 2600, delay = 0) {
  if (pid === P?.view?.you) return;
  setTimeout(() => {
    moods.set(pid, { mood, until: performance.now() + ms });
    const put = () => { const b = $(`seat-${pid}`)?.querySelector('.bust'); if (b) { b.removeAttribute('data-mood'); void b.offsetWidth; b.dataset.mood = mood; } };
    put();
    setTimeout(() => { if (moods.get(pid)?.until <= performance.now() + 30) { moods.delete(pid); $(`seat-${pid}`)?.querySelector('.bust')?.removeAttribute('data-mood'); } }, ms);
  }, delay);
}

// Scoring a monopoly: the five cards are laid out and counted one at a time, each with a higher note, then swept to the score.
function scoreShow(type, toEl) {
  document.querySelector('.scoreshow')?.remove();
  const box = document.createElement('div');
  box.className = 'scoreshow';
  box.innerHTML = [0, 1, 2, 3, 4].map((i) => `<div class="sc" style="--i:${i}">${resFace(type)}</div>`).join('') + '<div class="pips">' + '<i></i>'.repeat(5) + '</div>';
  document.body.appendChild(box);
  const cards = [...box.querySelectorAll('.sc')], pips = [...box.querySelectorAll('.pips i')];
  cards.forEach((c, i) => setTimeout(() => { c.classList.add('hit'); pips[i].classList.add('on'); sfx.chime({ rate: 1 + i * 0.122 }); }, 500 + i * 230));
  setTimeout(() => {
    const r = toEl?.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r) { box.style.setProperty('--gx', `${r.left + r.width / 2 - (b.left + b.width / 2)}px`); box.style.setProperty('--gy', `${r.top + r.height / 2 - (b.top + b.height / 2)}px`); }
    box.classList.add('gone');
  }, 500 + 5 * 230 + 420);
  setTimeout(() => box.remove(), 500 + 5 * 230 + 1000);
}

// A token chip that flies to (or away from) a counter, so a change in Heat, Cover or score is something you watch happen.
function chipFly(kind, el, up, big) {
  const r = el.getBoundingClientRect(), ex = r.left + r.width / 2, ey = r.top + r.height / 2;
  const c = document.createElement('div');
  c.className = `flychip ${kind}`;
  c.innerHTML = `${TOK[kind]}<b>${up ? '+1' : '−1'}</b>`;
  document.body.appendChild(c);
  const H = window.innerHeight, W = window.innerWidth;
  const from = up ? (big ? [W / 2, H * 0.42] : [ex, ey - H * 0.11]) : [ex, ey];
  const to = up ? [ex, ey] : [ex + (big ? 0 : W * 0.01), ey - H * 0.1];
  const s0 = up ? (big ? 3.4 : 1.9) : 1.1, s1 = up ? 1 : 1.7;
  const at = (p, sc, rot) => `translate(${p[0]}px, ${p[1]}px) translate(-50%, -50%) scale(${sc}) rotate(${rot}deg)`;
  const mid = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - H * 0.06];
  const wait = $('reveal').classList.contains('hidden') ? (big && up ? 200 : 0) : 2700; // let a call-out finish first
  const a = c.animate([
    { transform: at(from, s0, -24), opacity: up ? 0 : 1 },
    { transform: at(from, s0, -18), opacity: 1, offset: up ? 0.18 : 0.01 },
    { transform: at(mid, (s0 + s1) / 2, 8), opacity: 1, offset: 0.62 },
    { transform: at(to, s1, 0), opacity: up ? 1 : 0 },
  ], { duration: up ? (big ? 900 : 650) : 620, delay: wait, easing: 'cubic-bezier(.3, 0, .25, 1)', fill: 'both' });
  a.onfinish = () => { c.remove(); if (up) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); sfx.chip(); } };
}

const TOK = {
  heat: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1c.5 2.6 3.6 4 3.6 7.6A3.6 3.6 0 0 1 8 15a3.6 3.6 0 0 1-3.6-3.6c0-1.6.8-2.6 1.6-3.4.2 1 .7 1.6 1.2 1.8C6.6 7 7 3.6 8 1Z"/></svg>',
  cover: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1 14 3v4.6c0 3.6-2.6 6.2-6 7.4-3.4-1.2-6-3.8-6-7.4V3Z"/></svg>',
  score: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 5 5 8l3-5 3 5 3.5-3-1.4 8H2.9Z"/></svg>',
};
function tokens(p) {
  const v = P.view;
  return `<span class="tokens">
    <span class="tok heat ${p.heat ? '' : 'zero'}" data-tok="heat" title="Heat: each one turns a card face up">${TOK.heat}${p.heat}</span>
    <span class="tok cover ${p.cover ? '' : 'zero'}" data-tok="cover" title="Cover: absorbs a wrong call-out">${TOK.cover}${p.cover}</span>
    <span class="tok score" data-tok="score" title="Monopoly tokens">${TOK.score}${p.banked.length}/${v.winTarget}</span></span>`;
}
const dupOn = (p, r) => p.boosts.find((b) => b.kind === 'duplicator' && b.on === r.id) || null;
// A row as it lies on the table: the cards in order, with an empty place wherever a card is out in a trade.
function rowHtml(p, draw, cls = '') {
  const out = p.res.map(draw);
  for (const at of [...(p.gaps || [])].sort((a, b) => a - b)) out.splice(Math.min(out.length, at), 0, `<div class="card gap ${cls}" title="This card is out in a trade"></div>`);
  return out.join('');
}
// Boosts in play beside the row. A Duplicator that is under a card is drawn there instead; a loose one waits here.
function boostRow(p) {
  const list = p.boosts.filter((b) => !(b.kind === 'duplicator' && b.on != null));
  if (!list.length) return '';
  return `<span class="boostrow">${list.map((b) => `<div class="card pc boost mini" data-cid="h${b.id}" data-face="up" data-owner="${p.id}" data-zone="boost" data-id="${b.id}" data-insp="pc:${b.kind}"><div class="cardface">${art(b.kind)}</div>${b.expanded ? '<span class="plus">+1</span>' : ''}${b.kind === 'duplicator' ? '<span class="loose">Loose</span>' : ''}</div>`).join('')}</span>`;
}
// At the most Heat there is, a wrong call costs a card. Said wherever I am about to call.
const burnNote = (me) => (me && me.heat >= DEF.RULES.heatCap && !me.cover ? '<p class="note warn">You are at 5 Heat: a wrong call destroys your leftmost card.</p>' : '');
const chip = (key, val, label, cls = '') => `<button class="chip ${JSON.stringify(ui[key]) === JSON.stringify(val) ? 'on' : ''} ${cls}" data-set="${key}" data-val='${JSON.stringify(val)}'>${label}</button>`;
const typeChips = (key) => DEF.TYPES.map((t) => chip(key, t, typeLabel(t))).join('');
const cardLabel = (r, i) => (r.type ? `${typeLabel(r.type)}${r.worth > 1 ? ' ×' + r.worth : ''}${r.known ? ' (peeked)' : ''}` : `Card ${i + 1} · hidden`);
const resFace = (t, cls = '') => `<div class="card res t-${t} ${cls}"><div class="cardface"><div class="ttl">${t}</div>${art(t)}<div class="typ">Resource</div></div></div>`;
const stepHd = (n, text) => `<div class="step"><span class="n">${n}</span>${text}</div>`;

// ---------- screens ----------

// ---------- redrawing only what changed ----------
// The table is drawn as a handful of regions (each player's seat, the middle, the piles, my cards, the prompt, my strip,
// my hand). On an update, a region whose markup is the same as last time is left exactly as it is, so the browser only
// re-lays-out the parts that actually changed. Most updates (a bot passing, a clock, someone else's move) touch one or two.
const REGIONS = '.seatbox.opp, #stage, .piles, .mine, .dock, .seatbox.me, .handcol';
const regionHtml = new Map();
function patchTable(app, html) {
  const table = app.querySelector(':scope > .table');
  if (!table || !table.querySelector('.dock')) { regionHtml.clear(); return false; } // first draw, or coming from another screen
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const fresh = [...tpl.content.querySelectorAll(REGIONS)], live = [...table.querySelectorAll(REGIONS)];
  if (fresh.length !== live.length || fresh.some((f, i) => f.id !== live[i].id || f.classList[0] !== live[i].classList[0])) { regionHtml.clear(); return false; }
  fresh.forEach((f, i) => {
    const h = f.outerHTML;
    if (regionHtml.get(i) === h) return;
    live[i].replaceWith(f);
    regionHtml.set(i, h);
  });
  const opps = table.querySelector('.opps'), newOpps = tpl.content.querySelector('.opps');
  if (opps && newOpps && opps.className !== newOpps.className) opps.className = newOpps.className;
  return true;
}

// How long each redraw of the screen takes, kept for tuning (window.__perf in the console).
const perf = { renders: 0, ms: 0, last: 0, worst: 0, snap: 0, html: 0, anim: 0, rest: 0 };
window.__perf = perf;
function render() {
  const t0 = performance.now();
  try { renderNow(); } finally { const d = performance.now() - t0; perf.renders++; perf.ms += d; perf.last = d; perf.worst = Math.max(perf.worst, d); }
}
function renderNow() {
  const app = $('app');
  let tm = performance.now();
  const lap = (k) => { const n = performance.now(); perf[k] += n - tm; tm = n; };
  const before = snapshot();
  lap('snap');
  applyLook();
  if (!session || !P || !P.started) document.body.classList.remove('in-game');
  if (!session || !P) { app.innerHTML = home() + modalHtml(); return; }
  if (!P.started) { app.innerHTML = lobbyScreen(); return; }
  document.body.classList.toggle('watch', !!P.spectator);
  if (P.spectator) { renderWatch(before); return; }
  const v = P.view, me = v.players[v.you];
  // Throw away half-made choices that no longer apply.
  const key = `${v.turnNumber}:${v.pending ? v.pending.n : 'free'}`;
  if (ui.key !== key) ui = { key };
  const myFreeTurn = v.phase === 'main' && v.turn === v.you && !v.pending && !(P.coach && P.coach.next);
  tidyUi(v, me);
  const out = stagedId(me);
  const mustAct = v.phase === 'main' && ((v.pending?.kind === 'cost' && v.pending.waiting.includes(v.you)) || (v.pending?.kind === 'trade' && (v.pending.stage === 'response' ? v.pending.to : v.pending.from) === v.you) || (v.pending?.kind === 'dup' && v.pending.player === v.you) || (!v.pending && v.turn === v.you));

  const others = v.players.filter((p) => p.id !== v.you);
  const empty = Math.max(0, me.handLimit - me.hand.length);

  const stack = (n) => { const k = Math.max(1, Math.min(9, Math.ceil(n / 6))); return `<div class="stack">${Array.from({ length: k }, (_, i) => `<i style="--i:${i}"></i>`).join('')}<div class="card back" style="--i:${k}" data-face="down"><div class="cardface"></div></div></div>`; };
  const fresh = !document.querySelector('.plane'); // sitting down at the table for the first time
  document.body.classList.add('in-game');
  const html = `<div class="table">
    <div class="scene"><div class="world"><div class="plane">
      <div class="opps ${others.length > 3 ? 'many' : ''}">${others.map((p) => `
        <div class="seatbox opp ${v.turn === p.id ? 'turn' : ''}" id="seat-${p.id}" style="--seat:${seatColor(p.id)}">
          <div class="bust" ${moodAttr(p.id)}>${crest(p.name, p.id, p.isBot)}</div>
          <div class="tent"><div class="name">${esc(p.name)}</div>${tokens(p)}${p.boycott ? '<div class="injrow"><span class="inj boy" title="Boycotted: no Action cards on their next turn">Boycott</span></div>' : ''}${p.enjoined ? '<div class="injrow"><span class="inj" title="Under an Injunction: nothing of theirs can score on their next turn">Injunction</span></div>' : ''}${status(v, p)}
            <div class="handn"><span class="fan">${p.handIds.map((id) => backCard(`h${id}`, 'tiny')).join('')}</span>${p.handCount} in hand</div></div>
          <div class="cards ${p.res.length + p.boosts.length > 5 ? 'tight' : ''}">${rowHtml(p, (r) => resCard(v.pending?.kind === 'whistle' && v.pending.caller === v.you && v.pending.accused === p.id ? { ...r, known: false } : r, { cls: 'mini', owner: p.id, dup: dupOn(p, r) }), 'mini')}${p.boosts.length ? boostRow(p) : ''}</div>
        </div>`).join('')}
      </div>
      <div class="stagebox" id="stage">${(stageHtml = stage(v))}</div>
      <div class="piles">
        <div class="pile" id="pile-res">${stack(v.decks.res)}Resources<b>${v.decks.res}</b></div>
        <div class="pile" id="pile-play">${stack(v.decks.play)}Cards<b>${v.decks.play}</b></div>
      </div>
      <div class="mine ${v.turn === v.you ? 'turn' : ''}">
        <div class="mat"><div class="cards ${me.res.length > 6 ? 'tight' : ''}">${rowHtml(me, (r) => resCard(r, { mine: true, owner: v.you, dup: dupOn(me, r) }))}</div>${me.boosts.length ? boostRow(me) : ''}</div>
        <div class="lbl">Your resources · ${me.res.length} of ${me.slotLimit} slots</div>
      </div>
    </div></div></div>
    <div class="dock"><div class="prompt ${mustAct ? 'act' : ''}">${promptHtml(v, me, myFreeTurn)}</div></div>
    <div class="seatbox me ${v.turn === v.you ? 'turn' : ''}" id="seat-${v.you}">
      ${me.enjoined ? '<span class="holdbadge inj">Injunction: nothing of yours can score next turn.</span>' : ''}
      ${me.boycott ? '<span class="holdbadge inj boy">Boycott: no Action cards for you this turn.</span>' : ''}
      ${me.holding ? `<span class="holdbadge">Secret hold: ${me.holding}. Keep all 5 until your next turn.</span>` : ''}
      <div class="idrow">${crest(me.name, me.id, false)}<div class="sub">${v.turn === v.you ? 'Your turn' : esc(me.name)}</div>${tokens(me)}</div>
      ${tally(me)}
    </div>
    <div class="handcol ${myFreeTurn ? 'live' : ''}">
      <div class="top">${document.body.classList.contains('phone') ? '<button class="btn ghost sm wide" data-do="menu">Menu</button>' : `
        <button class="btn ghost sm" data-do="toggleSound">${audio.prefs.sound ? 'Sound on' : 'Sound off'}</button><button class="btn ghost sm" data-do="toggleMusic">${audio.prefs.music ? 'Music on' : 'Music off'}</button>
        <button class="btn ghost sm" data-do="openRules">Rules</button><button class="btn ghost sm" data-do="leave">Leave</button>
        <button class="btn ghost sm" data-do="toggleView" title="Switch between the 3D table and a flat top-down view">${flatView ? 'View: 2D' : 'View: 3D'}</button><button class="btn ghost sm" data-do="cycleGfx" title="Low turns off idle motion, paper grain and dust so the table runs smoothly on slower devices">${gfxLabel().replace('Graphics: ', 'Gfx: ')}</button>`}
      </div>
      <div class="hd"><span class="t">Your hand</span><span class="c">${me.hand.length} / ${me.handLimit}</span></div>
      <div class="hint">${myFreeTurn ? 'Drag a card onto the table' : isTouch() ? 'Tap a card to see it' : 'Hover a card to read it'}</div>
      <div class="hand">${me.hand.map((h) => `<div class="hslot">${uncid(playCard(h.kind, h.id, { cls: `${myFreeTurn ? 'can' : ''} ${ui.card === h.id && ui.mode === 'play' ? 'sel' : ''} ${out === h.id ? 'out' : ''}`, attrs: `data-owner="${v.you}" data-zone="hand" data-id="${h.id}" data-insp="hand:${h.id}"` }), out === h.id)}</div>`).join('')}${'<div class="hslot empty"></div>'.repeat(empty)}</div>
    </div>
  </div>`;
  if (!patchTable(app, html)) app.innerHTML = html;

  lap('html');
  if (fresh) { camIntro(); sfx.shuffle(); } else camApply();
  camFocus(v.phase === 'main' && mustAct ? 1 : 0);
  const pileCard = (id) => $(id)?.querySelector('.card');
  animateFrom(before, {
    originFor: (el) => pileCard(el.dataset.cid[0] === 'r' ? 'pile-res' : 'pile-play'),
    exitFor: (cid) => pileCard(cid[0] === 'r' ? 'pile-res' : 'pile-play'),
    onEnter: (el, delay) => setTimeout(() => sfx.deal(), delay),
    onMove: () => sfx.slide(),
    onFlip: () => sfx.flip(),
    onLand: (el) => { if (el.isConnected) puff(el, 'spark', 5); },
  });
  lap('anim');
  decorate();
  const keep = inspCid;
  hideInspect();
  if (keep) { // still pointing at the same card after the redraw: keep its note open
    const el = document.elementFromPoint(mouse.x, mouse.y)?.closest?.('.card[data-insp]');
    if (el?.dataset.cid === keep) showInspect(el, true);
  }
  playFx(v);
  tokenChanges(v);
  showReveal(v);
  tickClock();
  lap('rest');
}

// ---------- spectator view: the whole table, nobody's secrets, no controls. Made to sit on a TV. ----------
function renderWatch(before) {
  const app = $('app'), v = P.view;
  const stack = (n) => { const k = Math.max(1, Math.min(9, Math.ceil(n / 6))); return `<div class="stack">${Array.from({ length: k }, (_, i) => `<i style="--i:${i}"></i>`).join('')}<div class="card back" style="--i:${k}" data-face="down"><div class="cardface"></div></div></div>`; };
  const fresh = !document.querySelector('.plane');
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="table">
    <div class="scene"><div class="world"><div class="plane">
      <div class="opps ${v.players.length > 3 ? 'many' : ''}">${v.players.map((p) => `
        <div class="seatbox opp ${v.turn === p.id ? 'turn' : ''}" id="seat-${p.id}" style="--seat:${seatColor(p.id)}">
          <div class="bust" ${moodAttr(p.id)}>${crest(p.name, p.id, p.isBot)}</div>
          <div class="tent"><div class="name">${esc(p.name)}</div>${tokens(p)}${p.boycott ? '<div class="injrow"><span class="inj boy" title="Boycotted: no Action cards on their next turn">Boycott</span></div>' : ''}${p.enjoined ? '<div class="injrow"><span class="inj" title="Under an Injunction: nothing of theirs can score on their next turn">Injunction</span></div>' : ''}${status(v, p)}
            <div class="handn"><span class="fan">${p.handIds.map((id) => backCard(`h${id}`, 'tiny')).join('')}</span>${p.handCount} in hand</div></div>
          <div class="cards ${p.res.length + p.boosts.length > 5 ? 'tight' : ''}">${rowHtml(p, (r) => resCard(r, { cls: 'mini', owner: p.id, dup: dupOn(p, r) }), 'mini')}${p.boosts.length ? boostRow(p) : ''}</div>
        </div>`).join('')}
      </div>
      <div class="stagebox" id="stage">${(stageHtml = stage(v))}</div>
      <div class="piles">
        <div class="pile" id="pile-res">${stack(v.decks.res)}Resources<b>${v.decks.res}</b></div>
        <div class="pile" id="pile-play">${stack(v.decks.play)}Cards<b>${v.decks.play}</b></div>
      </div>
    </div></div></div>
    <div class="watchbar">
      <span class="tag">Watching</span><span class="code">Game ${P.code}</span>
      <span class="score">${v.players.map((p) => `<span class="sc ${v.turn === p.id ? 'on' : ''}" style="--seat:${seatColor(p.id)}"><i></i>${esc(p.name)} <b>${p.banked.length}/${v.winTarget}</b></span>`).join('')}</span>
      <span class="grow"></span>
      <button class="btn ghost sm" data-do="toggleSound">${audio.prefs.sound ? 'Sound on' : 'Sound off'}</button><button class="btn ghost sm" data-do="toggleMusic">${audio.prefs.music ? 'Music on' : 'Music off'}</button>
      <button class="btn ghost sm" data-do="toggleView">${flatView ? '2D' : '3D'}</button><button class="btn ghost sm" data-do="leaveNow">Stop watching</button>
    </div>
  </div>`;
  if (fresh) { camIntro(); sfx.shuffle(); } else camApply();
  camFocus(0);
  const pileCard = (id) => $(id)?.querySelector('.card');
  animateFrom(before, {
    originFor: (el) => pileCard(el.dataset.cid[0] === 'r' ? 'pile-res' : 'pile-play'),
    exitFor: (cid) => pileCard(cid[0] === 'r' ? 'pile-res' : 'pile-play'),
    onEnter: (el, delay) => setTimeout(() => sfx.deal(), delay),
    onMove: () => sfx.slide(),
    onFlip: () => sfx.flip(),
  });
  hideInspect();
  playFx(v);
  tokenChanges(v);
  showReveal(v);
  tickClock();
}

// Does what is being played right now concern me? Trades between two other players do not.
const involvesMe = (v) => { const c = v.pending; return !c || c.kind === 'cost' || c.from === v.you || c.to === v.you; };

// One line under each opponent's name saying what they are doing.
function status(v, p) {
  if (v.phase !== 'main') return '';
  const c = v.pending, other = (id) => (id === v.you ? 'you' : esc(v.players[id].name));
  if (c?.kind === 'trade') {
    if (c.from === p.id) return c.stage === 'response' ? `<div class="sub">${c.open ? `Open offer: ${c.offerClaim}` : `Offers ${c.offerClaim} to ${other(c.to)}`}</div>` : '<div class="sub think">Deciding</div>';
    if (c.open && c.stage === 'response' && c.queue.includes(p.id)) return '<div class="sub quiet">Next in line</div>';
    if (c.to === p.id) return c.stage === 'response' ? '<div class="sub think">Thinking it over</div>' : `<div class="sub">Put down ${c.replyClaim}</div>`;
  }
  if (c?.kind === 'alibi') {
    if (c.accused === p.id) return '<div class="sub think">Has an answer?</div>';
    if (c.caller === p.id) return '<div class="sub">Calls it</div>';
  }
  if (c?.kind === 'tip' && c.player === p.id) return '<div class="sub think">Reading a tip</div>';
  if (c?.kind === 'power' && c.player === p.id) return `<div class="sub think">${DEF.POWERS[c.res].name}</div>`;
  if (c?.kind === 'dup' && c.player === p.id) return '<div class="sub think">Moving Duplicator</div>';
  if (c?.kind === 'whistle') {
    if (c.caller === p.id) return '<div class="sub think">Choosing 2 cards</div>';
    if (c.accused === p.id) return '<div class="sub">Caught holding</div>';
  }
  if (c?.kind === 'cost') {
    if (c.player === p.id) return `<div class="sub">Plays ${DEF.CARDS[c.card].name}</div>`;
    if (c.waiting[0] === p.id) return '<div class="sub think">Deciding</div>';
    if (c.waiting.includes(p.id)) return '<div class="sub quiet">Next in line</div>';
  }
  if (!c && v.turn === p.id) return '<div class="sub think">Their turn</div>';
  return `<div class="sub quiet">${v.turn === p.id ? 'Their turn' : 'Waiting'}</div>`;
}

// How close I am to five of a kind, for each resource.
function tally(me) {
  const counts = DEF.TYPES.map((t) => [t, me.res.filter((r) => r.type === t).reduce((n, r) => n + r.worth, 0)]);
  const best = Math.max(...counts.map((c) => c[1]));
  return `<div class="tally">${counts.map(([t, n]) => `<div class="tl t-${t} ${n === best && n > 0 ? 'best' : ''} ${n >= 5 ? 'full' : ''}">${ico(t)}<span>${n}</span><span class="bar">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < n ? 'f' : ''}"></i>`).join('')}</span></div>`).join('')}</div>`;
}

// The most recent thing that happened, in one line (there is no scrolling log).
function lastLine(v) {
  for (let i = v.log.length - 1; i >= 0; i--) if (!v.log[i].t.startsWith('—')) return v.log[i].t;
  return '';
}

let stageHtml = '';
const uncid = (html, off) => (off ? html.replace(/ data-cid="[^"]*"/, '') : html);
// The hand card that is lying on the table while I decide how to pay for it.
const stagedId = (me) => { const k = playKind(me); return k && !PASSIVE.includes(k) ? ui.card : null; };
// Drop half-made choices that stopped making sense.
function tidyUi(v, me) {
  if (ui.wb && (!canWhistle(v) || !me.hand.some((h) => h.kind === 'whistleblower'))) delete ui.wb;
  if (v.pending?.kind !== 'whistle') delete ui.wp;
  if (!isMyFreeTurn(v)) { if (ui.mode) ui = { key: ui.key, stake: ui.stake, claim: ui.claim }; return; }
  if (ui.mode === 'play' && !me.hand.some((x) => x.id === ui.card)) ui = { key: ui.key };
  if (ui.mode === 'trade' && me.traded) ui = { key: ui.key };
}
// Same rule as the server: a cost is covered by the right cards in any order. One true/false per card put down.
function payCheck(cost, types) {
  const need = [...cost], ok = types.map(() => false);
  const take = (t) => { const i = need.indexOf(t); if (i < 0) return false; need.splice(i, 1); return true; };
  types.forEach((t, i) => { if (t && cost[i] === t) ok[i] = take(t); });
  types.forEach((t, i) => { if (t && !ok[i]) ok[i] = take(t); });
  return ok;
}
const TARGETED = ['espionage', 'forcedTrade', 'strike'], NEEDS_MINE = ['duplicator', 'expansion'];
const SEATED = ['audit', 'injunction']; // aimed at a player, not at one of their cards
const PASSIVE = ['lawsuit', 'alibi']; // never played by themselves: they come out when a call happens
// Expansion with nothing to attach to turns into two cards, so it needs no Boost picked.
const expansionDraws = (me) => !me.boosts.some((b) => !b.expanded);
function playReady(me) {
  const kind = playKind(me);
  if (!kind || PASSIVE.includes(kind)) return false;
  if (!DEF.CARDS[kind].cost.every((_, i) => ui['pay' + i])) return false;
  if (TARGETED.includes(kind) && (ui.target === undefined || !ui.their)) return false;
  if (SEATED.includes(kind) && ui.target === undefined) return false;
  if (kind === 'writeoff' && !ui.wo) return false;
  if (kind === 'expansion' && expansionDraws(me)) return true;
  return !NEEDS_MINE.includes(kind) || !!ui.mine;
}
// Can I point at this player right now (to trade with, or to aim a card at)?
function seatPickable(v, me, pid) {
  if (!isMyFreeTurn(v) || pid === v.you) return false;
  const p = v.players[pid];
  if (ui.mode === 'trade') return p.res.length > 0;
  const kind = playKind(me);
  if (kind === 'injunction') return true;
  if (kind === 'audit') return p.res.length > 0;
  if (!TARGETED.includes(kind)) return false;
  return kind === 'strike' ? p.boosts.length > 0 : p.res.length > 0;
}
// Whistleblower is the one card that works at any moment, on anyone's turn.
const canWhistle = (v) => v.phase === 'main' && v.pending?.kind !== 'whistle' && !P.coach;
const isWhistle = (me, id) => me.hand.find((h) => h.id === id)?.kind === 'whistleblower';
const isMyFreeTurn = (v) => v.phase === 'main' && v.turn === v.you && !v.pending && !(P.coach && P.coach.next);
const promptHtml = (v, me, myFreeTurn) => `${coachBox()}${P.coach && (P.coach.next || P.coach.done) ? '' : panel(v, me, myFreeTurn)}`;
// Everyone the table is currently waiting for.
function waitingOn(v) {
  if (v.phase !== 'main') return [];
  const c = v.pending;
  if (!c) return [v.turn];
  if (c.kind === 'whistle') return [c.caller];
  if (c.kind === 'alibi') return [c.accused];
  if (c.kind === 'tip' || c.kind === 'power' || c.kind === 'dup') return [c.player];
  return c.kind === 'cost' ? [c.waiting[0]] : [c.stage === 'response' ? c.to : c.from];
}

// Redraw only the prompt after a local choice, so cards on the table keep moving undisturbed.
function renderLocal() {
  if (!P?.started || P.spectator) { render(); return; }
  regionHtml.clear();
  const v = P.view, me = v.players[v.you];
  const box = document.querySelector('.prompt');
  const top = box.scrollTop;
  tidyUi(v, me);
  box.innerHTML = promptHtml(v, me, isMyFreeTurn(v));
  box.scrollTop = top;
  const out = stagedId(me);
  for (const el of document.querySelectorAll('.hand .card')) {
    const id = Number(el.dataset.id);
    el.classList.toggle('sel', id === ui.card && ui.mode === 'play');
    el.classList.toggle('out', id === out);
    if (id === out) el.removeAttribute('data-cid'); else el.dataset.cid = `h${id}`; // the copy on the table is "the" card while it is out
  }
  const st = stage(v);
  if (st !== stageHtml) { $('stage').innerHTML = stageHtml = st; }
  hideInspect();
  decorate();
  tickClock();
}

// ---------- clicking cards on the table ----------
// The chips in the prompt and the cards themselves are two ways to make the same choice.

const playKind = (me) => (ui.mode === 'play' ? me.hand.find((h) => h.id === ui.card)?.kind : null);

function clickable(v, me, owner, zone) {
  const mine = owner === v.you, c = v.pending;
  if (c?.kind === 'whistle') return c.caller === v.you && owner === c.accused && zone === 'res';
  if (c?.kind === 'dup') return c.player === v.you && mine && zone === 'res';
  if (c?.kind === 'trade' && c.stage === 'response' && c.to === v.you && !(P.coach && P.coach.next)) return mine && zone === 'res';
  if (!isMyFreeTurn(v)) return false;
  if (zone === 'hand') return mine && (ui.mode !== 'discard' || me.hand.length > me.handLimit);
  if (ui.mode === 'trade') return zone === 'res';
  if (ui.mode === 'discard') return mine && zone === 'res' && me.res.length > me.slotLimit;
  const kind = playKind(me);
  if (!kind || PASSIVE.includes(kind)) return false;
  const d = DEF.CARDS[kind];
  if (mine && zone === 'res') return d.cost.length > 0 || kind === 'duplicator';
  if (mine && zone === 'boost') return kind === 'expansion';
  if (!mine && zone === 'res') return kind === 'espionage' || kind === 'forcedTrade';
  if (!mine && zone === 'boost') return kind === 'strike';
  return false;
}

function cardClick(owner, zone, id) {
  const v = P.view, me = v.players[v.you];
  if (!clickable(v, me, owner, zone)) return;
  const mine = owner === v.you, c = v.pending;
  const typeOf = (rid) => me.res.find((r) => r.id === rid)?.type;
  sfx.select();
  if (c?.kind === 'whistle') return toggle('wp', id, c.need);
  if (c?.kind === 'dup') { if (dupOn(me, { id })) { toast('That card already has a Duplicator.'); return; } act({ type: 'moveDup', resId: id }); return; }
  if (c?.kind === 'trade') { ui.stake = id; ui.claim ??= typeOf(id); return renderLocal(); }
  if (zone === 'hand') return ui.mode === 'discard' ? DO.togH(id) : DO.pickCard(id);
  if (ui.mode === 'trade') {
    if (mine) { ui.give = id; ui.claim ??= typeOf(id); } else ui.to = owner;
    return renderLocal();
  }
  if (ui.mode === 'discard') return DO.togR(id);
  const kind = playKind(me), d = DEF.CARDS[kind];
  if (mine && zone === 'res') {
    const slots = [...d.cost.map((_, i) => 'pay' + i), ...(kind === 'duplicator' ? ['mine'] : [])];
    const held = slots.find((k) => ui[k] === id);
    if (held) delete ui[held];
    else { const free = slots.find((k) => !ui[k]); if (free) ui[free] = id; }
  } else if (mine) ui.mine = id;
  else { ui.target = owner; ui.their = id; }
  renderLocal();
}

// Mark the cards the player has chosen (with what they are chosen for) and the ones they can click.
function decorate() {
  if (P?.spectator) return;
  document.querySelectorAll('.rolebadge').forEach((e) => e.remove());
  document.querySelectorAll('.picked, .pickable').forEach((e) => e.classList.remove('picked', 'pickable'));
  if (!P?.started) return;
  const v = P.view, me = v.players[v.you];
  const kind = playKind(me);
  const roles = {};
  if (ui.give) roles[`r${ui.give}`] = 'Give';
  if (ui.stake) roles[`r${ui.stake}`] = 'Put down';
  for (const [k, val] of Object.entries(ui)) if (k.startsWith('pay') && val) roles[`r${val}`] = 'Pay';
  if (ui.mine) roles[`${kind === 'expansion' ? 'h' : 'r'}${ui.mine}`] = kind === 'duplicator' ? 'Double' : kind === 'expansion' ? 'Expand' : 'Give';
  if (ui.their) roles[`${kind === 'strike' ? 'h' : 'r'}${ui.their}`] = kind === 'strike' ? 'Strike' : kind === 'espionage' ? 'Peek' : 'Steal';
  for (const id of ui.wp || []) roles[`r${id}`] = 'Take';
  if (kind === 'writeoff' && ui.wo) for (const r of me.res.slice(-ui.wo)) roles[`r${r.id}`] = 'Write off';
  for (const id of ui.dr || []) roles[`r${id}`] = 'Discard';
  for (const id of ui.dh || []) roles[`h${id}`] = 'Discard';
  for (const el of document.querySelectorAll('.table .card[data-zone]')) {
    const label = roles[el.dataset.cid];
    if (label) { el.classList.add('picked'); el.insertAdjacentHTML('beforeend', `<span class="rolebadge">${label}</span>`); }
    else if (el.dataset.zone !== 'hand' && clickable(v, me, Number(el.dataset.owner), el.dataset.zone)) el.classList.add('pickable');
  }
  const to = ui.mode === 'trade' ? ui.to : ui.target;
  document.querySelectorAll('.seatbox.aimed').forEach((e) => e.classList.remove('aimed'));
  if (to === 'open') document.querySelectorAll('.seatbox.opp').forEach((e) => e.classList.add('aimed'));
  else if (to !== undefined) $(`seat-${to}`)?.classList.add('aimed');
  for (const s of document.querySelectorAll('.seatbox.opp')) s.classList.toggle('pickseat', !!ui.wb || (to === undefined && seatPickable(v, me, Number(s.id.slice(5)))));
  for (const el of document.querySelectorAll('.hand .card')) if (isWhistle(me, Number(el.dataset.id))) el.classList.toggle('sel', !!ui.wb);
  dragRefresh();
}

// ---------- hover a small card to see it full size ----------

let inspTimer, inspCid = null;
const mouse = { x: -1, y: -1 };
function tipHtml(el) {
  const [what, key] = el.dataset.insp.split(':');
  const v = P.view, me = v.players[v.you];
  if (what === 'res') return { card: resFace(key), tip: '' };
  if (what === 'pc') return { card: playCard(key, 0).replace(/data-cid="[^"]*"/, ''), tip: '' };
  if (what === 'mine') {
    const r = me.res.find((x) => x.id === Number(key));
    if (!r) return null;
    const n = me.res.filter((x) => x.type === r.type).reduce((a, x) => a + x.worth, 0);
    const pick = el.classList.contains('pickable') || el.classList.contains('picked');
    return { card: '', tip: `<div class="tip"><h4>${typeLabel(r.type)}</h4>
      <div>${n >= 5 ? `You hold <b>${n}</b>. That is a monopoly: end your turn with all five and keep them for a round.` : `You hold <b>${n}</b>. ${5 - n} more for a monopoly.`}</div>
      ${r.worth > 1 ? '<div>Doubled: this card counts as 2.</div>' : ''}
      <div class="k">${r.faceUp ? 'Face up' : 'Hidden'}</div><div>${r.faceUp ? 'Your Heat shows this card to everyone.' : 'Only you can see what this is.'}</div>
      ${pick ? `<div class="do go">Click to ${el.classList.contains('picked') ? 'put it back' : 'choose it'}</div>` : ''}</div>` };
  }
  const h = me.hand.find((x) => x.id === Number(key));
  if (!h) return null;
  const d = DEF.CARDS[h.kind], free = isMyFreeTurn(v);
  const state = h.kind === 'whistleblower' ? '<div class="do go">Drag it onto a player at any time, even when it is not your turn</div>'
    : h.kind === 'lawsuit' ? '<div class="do">Use it from the Call + Lawsuit button when you call someone out</div>'
    : h.kind === 'alibi' ? '<div class="do">Keep it: you are asked to play it when someone calls you out</div>'
    : free ? `<div class="do go">Click to ${ui.card === h.id && ui.mode === 'play' ? 'see the steps' : 'play it'}</div>`
    : `<div class="do no">You can play it on your turn${h.kind === 'espionage' ? ', or Peek during a trade' : ''}</div>`;
  return { card: '', tip: `<div class="tip"><h4>${d.name}</h4><div>${d.text}</div>
    <div class="k">Cost</div><div class="cost">${d.cost.length ? `${costPips(d.cost)} ${costText(d.cost)}` : 'Free'}</div>
    ${d.cost.length ? '<div>You pay face down. Pay with the wrong card and you are bluffing: anyone may call it.</div>' : ''}
    <div class="k">${d.kind === 'boost' ? 'Boost' : 'Action'}</div><div>${d.kind === 'boost' ? 'Stays on the table in front of you.' : 'Used once, then discarded.'}</div>${state}</div>` };
}
function showInspect(el, still = false) {
  if (!P?.started || !el.isConnected) return;
  const out = tipHtml(el);
  if (!out) return;
  const box = $('inspect');
  box.innerHTML = out.card + out.tip;
  box.classList.remove('hidden', 'flipx');
  box.style.animation = still ? 'none' : '';
  inspCid = el.dataset.cid;
  const r = el.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight, gap = 14;
  let left, top;
  if (el.closest('.mine')) { // my own cards: the note sits above them
    left = r.left + r.width / 2 - w / 2; top = r.top - h - gap;
  } else {
    const onRight = r.right + gap + w < window.innerWidth && !el.closest('.handcol');
    left = onRight ? r.right + gap : r.left - gap - w;
    box.classList.toggle('flipx', !onRight);
    top = r.top + r.height / 2 - h / 2;
  }
  box.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, left))}px`;
  box.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, top))}px`;
}
function hideInspect() { clearTimeout(inspTimer); inspCid = null; $('inspect').classList.add('hidden'); }

// ---------- touch screens: tap a card to see it large ----------
// A finger cannot hover, and on a phone the cards are small. Tapping any card opens it big in the middle of the
// screen with what it does, and a button for whatever that card can do right now. Cards that are being picked
// from (paying, choosing a target, discarding) still pick on a tap; holding a finger on one opens it instead.
let zoomFor = null, zoomBypass = false, lastPointer = 'mouse';
function zoomParts(el) {
  const [what, key] = el.dataset.insp.split(':'), v = P.view, me = v.players[v.you];
  const out = tipHtml(el);
  if (!out) return null;
  let { card, tip } = out;
  const cost = (d) => `<div class="k">Cost</div><div class="cost">${d.cost.length ? `${costPips(d.cost)} ${costText(d.cost)}` : 'Free'}</div>`;
  if (what === 'mine') card = resFace(me.res.find((x) => x.id === Number(key)).type);
  if (what === 'hand') card = playCard(me.hand.find((x) => x.id === Number(key)).kind, 0).replace(/data-cid="[^"]*"/, '');
  if (what === 'pc') { const d = DEF.CARDS[key]; tip = `<div class="tip"><h4>${d.name}</h4><div>${d.text}</div>${cost(d)}<div class="k">${d.kind === 'boost' ? 'Boost' : 'Action'}</div><div>${d.kind === 'boost' ? 'Stays on the table in front of its owner.' : 'Used once, then discarded.'}</div></div>`; }
  if (what === 'res') tip = `<div class="tip"><h4>${typeLabel(key)}</h4><div>A resource card. Five of the same kind, kept for a full round, scores a Monopoly token.</div></div>`;
  return { card, tip };
}
// What this card can do right now, if anything: that becomes the button beside the big picture.
function zoomAction(el) {
  if (P.spectator) return null;
  const v = P.view, me = v.players[v.you], zone = el.dataset.zone, owner = Number(el.dataset.owner), id = Number(el.dataset.id);
  const tip = el.closest('.tippick');
  if (tip) return { label: 'Keep this card', sel: `.tippick[data-id="${tip.dataset.id}"]` };
  if (!zone) return null;
  const sel = `.table .card[data-zone="${zone}"][data-owner="${owner}"][data-id="${id}"]`;
  if (zone === 'hand' && owner === v.you && ui.mode !== 'discard' && isWhistle(me, id)) return canWhistle(v) ? { label: ui.wb ? 'Put it back' : 'Blow the whistle', sel } : null;
  if (!clickable(v, me, owner, zone)) return null;
  return { label: zone === 'hand' ? (ui.card === id && ui.mode === 'play' ? 'Put it back' : 'Play this card') : owner === v.you ? 'Use this card' : 'Choose this card', sel };
}
function showZoom(el) { // true if the card was opened
  if (!P?.started || !el.isConnected) return false;
  const parts = zoomParts(el);
  if (!parts) return false;
  hideInspect();
  const go = zoomAction(el);
  zoomFor = go?.sel || null;
  const box = $('zoom');
  box.innerHTML = `<div class="zin">${parts.card}<div class="zside">${parts.tip}<div class="zrow">${go ? `<button class="btn" data-do="zoomGo">${go.label}</button>` : ''}<button class="btn ghost" data-do="zoomClose">Close</button></div></div></div>`;
  box.classList.remove('hidden');
  sfx.select();
  return true;
}
function hideZoom() { zoomFor = null; $('zoom').classList.add('hidden'); }

// ---------- phones: the corner buttons live behind one Menu button, so the hand gets the height ----------
let menuOpen = false;
function drawMenu() {
  $('sheet').innerHTML = `<div class="sin"><h3>Menu</h3><div class="sgrid">
    <button class="btn ghost" data-do="toggleSound">${audio.prefs.sound ? 'Sound on' : 'Sound off'}</button><button class="btn ghost" data-do="toggleMusic">${audio.prefs.music ? 'Music on' : 'Music off'}</button>
    <button class="btn ghost" data-do="toggleView">${flatView ? 'View: 2D' : 'View: 3D'}</button><button class="btn ghost" data-do="cycleGfx">${gfxLabel()}</button>
    <button class="btn ghost" data-do="menuRules">How to play</button><button class="btn danger" data-do="menuLeave">Leave game</button>
  </div><button class="btn" data-do="sheetClose">Back to the game</button></div>`;
  $('sheet').classList.remove('hidden');
}

let harvest = {}; // my half-made Harvest choice: { n: which pending it belongs to, keep: card id }

// ---------- table talk: what players say out loud ----------

const LINES = {
  offer: ['{claim}, friend. All I ask is {ask}.', 'One {claim}, fresh off the truck. Got any {ask}?', '{claim} for {ask}. Honest deal.', 'Trust me. It\'s {claim}.'],
  reply: ['Here\'s your {claim}.', '{claim}, as requested.', 'That\'s {claim}. Probably.', 'One {claim}. Pleasure doing business.'],
  decline: ['No deal.', 'I\'ll pass.', 'Not today.', 'Nice try.'],
  pay: ['Paid in full.', 'It\'s all there. Count it.', 'Money\'s on the table.', 'Perfectly legitimate purchase.'],
  call: ['I smell a rat!', 'Show me that card.', 'You\'re bluffing.', 'Not buying it.'],
  honest: ['Told you.', 'Clean as a whistle.', 'You wound me.', 'That\'ll cost you.'],
  caught: ['...Worth a shot.', 'You got me.', 'A clerical error.', 'Hmph.'],
  token: ['The market is mine.', 'Cornered it.', 'Just good business.'],
  scam: ['Pleasure doing business.', 'No refunds.'],
  read: ['You went quiet.', 'Too quiet over there.', 'Nobody sits that still.', 'You stopped dealing.'], // a bot that blew the whistle because of how someone was playing
};
function say(v, pid, kind, vars = {}, n = 0, delay = 0) {
  const p = v.players[pid];
  if (!p || pid === v.you) return;
  const pool = LINES[kind];
  // Bots have patter; people just get their claim shown plainly.
  let text = p.isBot ? pool[(n * 7 + pid * 3) % pool.length] : kind === 'offer' ? '{claim}. I want {ask}.' : kind === 'reply' ? '{claim}.' : null;
  if (!text) return;
  text = text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  setTimeout(() => {
    const anchor = $(`seat-${pid}`)?.querySelector('.crest');
    if (!anchor) return;
    const bust = anchor.closest('.bust');
    if (bust) { bust.classList.remove('talk'); void bust.offsetWidth; bust.classList.add('talk'); }
    document.querySelector(`.bubble[data-p="${pid}"]`)?.remove();
    const r = anchor.getBoundingClientRect();
    const b = document.createElement('div');
    b.className = 'bubble'; b.dataset.p = pid; b.textContent = text;
    b.style.left = `${r.left + r.width * 0.8}px`; b.style.top = `${r.top + r.height * 0.62}px`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2900);
  }, delay);
}

// ---------- cosmetics: theme packs, deck skins, and the Shop Tokens that buy them ----------
// (Called "Shop Tokens" so they are not confused with the Monopoly tokens that win the game.)
const THEMES = [
  { id: 'backroom', name: 'The Back Room', price: 0, text: 'Midnight felt under one red lamp. The table you know.' },
  { id: 'emerald', name: 'Emerald Casino', price: 400, text: 'Green baize, mahogany rail, red carpet.' },
  { id: 'saloon', name: 'Dusty Saloon', price: 400, text: 'Worn leather, plank floor, lamplight.' },
  { id: 'neon', name: 'Neon Arcade', price: 600, text: 'Black felt with a hot pink rail and cyan glow.' },
  { id: 'frost', name: 'Ice Boardroom', price: 600, text: 'Cold blue felt, white trim, marble floor.' },
];
const DECKS = [
  { id: 'classic', name: 'Classic', price: 0, text: 'Cream paper, midnight backs.' },
  { id: 'goldleaf', name: 'Gold Leaf', price: 250, text: 'Black backs, gilt paper.' },
  { id: 'blueprint', name: 'Blueprint', price: 250, text: 'Drafting blue with white line work.' },
  { id: 'candy', name: 'Candy Shop', price: 350, text: 'Pink backs with a mint gem.' },
  { id: 'carbon', name: 'Carbon', price: 350, text: 'Graphite cards with a red edge.' },
  // Art decks: new pictures, names and symbols for the five resources.
  { id: 'cosmos', name: 'Deep Space', price: 500, text: 'Five planets instead of five resources.', names: { Oil: 'Gas Giant', Livestock: 'Dust World', Farmland: 'Jungle World', Weapons: 'Lava World', Workers: 'Ocean World' } },
  { id: 'reef', name: 'Coral Reef', price: 500, text: 'Five sea creatures instead of five resources.', names: { Oil: 'Octopus', Livestock: 'Clownfish', Farmland: 'Turtle', Weapons: 'Crab', Workers: 'Whale' } },
  { id: 'fantasy', name: 'Fantasy', price: 500, text: 'Wizards, dragons and other creatures of legend.', names: { Oil: 'Wizard', Livestock: 'Phoenix', Farmland: 'Goblin', Weapons: 'Dragon', Workers: 'Unicorn' } },
  { id: 'dinos', name: 'Dinosaurs', price: 500, text: 'Five dinosaurs under a smoking volcano.', names: { Oil: 'Pterodactyl', Livestock: 'T-Rex', Farmland: 'Brontosaurus', Weapons: 'Triceratops', Workers: 'Stegosaurus' } },
  { id: 'medieval', name: 'Medieval', price: 500, text: 'Crowns, castles and knights.', names: { Oil: 'Crown', Livestock: 'Horse', Farmland: 'Castle', Weapons: 'Sword', Workers: 'Knight' } },
  { id: 'pirates', name: 'Pirates', price: 500, text: 'Rum, parrots and buried treasure.', names: { Oil: 'Rum', Livestock: 'Parrot', Farmland: 'Treasure', Weapons: 'Cutlass', Workers: 'Ship' } },
  { id: 'west', name: 'Wild West', price: 500, text: 'Outlaws, longhorns and a sheriff\'s star.', names: { Oil: 'Outlaw', Livestock: 'Longhorn', Farmland: 'Cactus', Weapons: 'Dynamite', Workers: 'Sheriff' } },
];
// Backdrops: the scenery around the table. Separate from table themes, and the priciest thing in the shop.
const BACKDROPS = [
  { id: 'none', name: 'The Back Room', price: 0, text: 'Wallpaper, posters and one lamp.' },
  { id: 'castle', name: 'Great Hall', price: 900, text: 'Stone walls, banners and torchlight.' },
  { id: 'ship', name: 'Pirate Deck', price: 900, text: 'Open sea beyond the rail, deck boards underfoot.' },
  { id: 'underwater', name: 'Under the Sea', price: 1200, text: 'A reef in blue light, sand below.' },
  { id: 'space', name: 'Space Station', price: 1200, text: 'A ringed planet outside the window.' },
];
// My own portrait, built on the Customize screen. null = the badge with my initial.
let myAvatar = null;
try { myAvatar = JSON.parse(localStorage.getItem('handland-avatar') || 'null'); } catch { myAvatar = null; }
const saveAvatar = () => localStorage.setItem('handland-avatar', JSON.stringify(myAvatar));
// Decks made in the Deck Maker: { id, name, rev, colors: { back, line, paper }, names, icons, art: { key: photo as a data URL } }.
let myDecks = [];
try { myDecks = JSON.parse(localStorage.getItem('handland-decks') || '[]'); } catch { myDecks = []; }
let remoteDeck = null; // the host's custom deck, fetched when I am not the one who made it
const isCustom = (id) => typeof id === 'string' && id.startsWith('custom-');
const HEX = /^#[0-9a-fA-F]{6}$/, PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
// Check a deck that came from somewhere else (another player, or old saved data) before using any of it.
function cleanDeck(d) {
  if (!d || typeof d !== 'object' || !/^custom-[a-z0-9]{4,12}$/.test(d.id)) return null;
  const strs = (o, max, ok = () => true) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => /^[A-Za-z]{1,20}$/.test(k) && typeof v === 'string' && v.length <= max && ok(v)));
  return { id: d.id, name: String(d.name || 'Custom deck').slice(0, 24), rev: Number(d.rev) || 0, colors: strs(d.colors, 7, (v) => HEX.test(v)), names: strs(d.names, 16), icons: strs(d.icons, 8), art: strs(d.art, 400000, (v) => PHOTO.test(v)) };
}
myDecks = myDecks.map(cleanDeck).filter(Boolean);
function saveDecks() {
  try { localStorage.setItem('handland-decks', JSON.stringify(myDecks)); return true; }
  catch { toast('There is no room left to save that. Remove a photo or delete an old deck.'); sfx.error(); return false; }
}
// Photos become short blob: links once, so the long data is not pasted into every card on the table.
const blobUrls = new Map();
function photoUrl(data) {
  if (!PHOTO.test(data)) return null;
  if (!blobUrls.has(data)) {
    const [head, b64] = data.split(','), bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    blobUrls.set(data, URL.createObjectURL(new Blob([bytes], { type: head.slice(5, head.indexOf(';')) })));
  }
  return blobUrls.get(data);
}
// What the art module needs to draw a deck: pictures and symbols.
function artOf(deck) {
  if (!deck) return null;
  if (!isCustom(deck.id)) return ART_PACKS[deck.id] || null;
  const pics = {}, icons = {};
  for (const [k, v] of Object.entries(deck.art || {})) { const u = photoUrl(v); if (u) pics[k] = u; }
  for (const t of DEF?.TYPES || []) {
    if (deck.icons?.[t]) icons[t] = { text: deck.icons[t] };
    else if (pics[t]) icons[t] = { img: pics[t] };
  }
  return { art: pics, icons };
}
const deckById = (id) => DECKS.find((d) => d.id === id) || myDecks.find((d) => d.id === id) || (remoteDeck?.id === id ? remoteDeck : null);

// ---------- renaming: a deck can call Oil "Octopus" everywhere ----------
// The rules, the server and the buttons all keep using the real names. Only the words on screen change,
// by rewriting text as it appears. Anything inside [data-noskin] (the shop, the Deck Maker) is left alone.
let activeNames = null, nameRe = null;
const rawText = new WeakMap(), shownText = new WeakMap();
function skinNode(n) {
  if (n.parentElement?.closest('[data-noskin], script, style, textarea')) return;
  if (shownText.get(n) !== n.nodeValue) rawText.set(n, n.nodeValue); // the game wrote new text here
  const raw = rawText.get(n) ?? n.nodeValue;
  const out = nameRe ? raw.replace(nameRe, (w) => activeNames[w]) : raw;
  if (out !== n.nodeValue) n.nodeValue = out;
  shownText.set(n, out);
}
function skinTree(root) {
  if (root.nodeType === 3) { skinNode(root); return; }
  if (root.nodeType !== 1) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) skinNode(n);
}
new MutationObserver((list) => {
  if (!nameRe && !list.some((m) => m.type === 'characterData')) return;
  for (const m of list) {
    if (m.type === 'characterData') skinNode(m.target);
    else for (const n of m.addedNodes) skinTree(n);
  }
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
function setNames(names) {
  const esc2 = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const clean = {};
  for (const [k, v] of Object.entries(names || {})) { const t = String(v).replace(/[<>&]/g, '').trim().slice(0, 16); if (t && t !== k) clean[k] = t; }
  activeNames = Object.keys(clean).length ? clean : null;
  nameRe = activeNames ? new RegExp(`\\b(${Object.keys(activeNames).sort((a, b) => b.length - a.length).map(esc2).join('|')})\\b`, 'g') : null;
  document.body.toggleAttribute('data-longnames', !!activeNames && Object.entries(activeNames).some(([k, v]) => DEF?.TYPES.includes(k) && v.length > 9)); // only long resource names shrink the title
  skinTree(document.body);
}
// Token packs. The prices are placeholders I picked; real money is not connected yet (see buyPack).
const PACKS = [{ id: 'p500', tokens: 500, price: '$4.99' }, { id: 'p1200', tokens: 1200, price: '$9.99', note: 'Best seller' }, { id: 'p2600', tokens: 2600, price: '$19.99', note: 'Best value' }];
let wallet = { tokens: 0, owned: [], ...JSON.parse(localStorage.getItem('handland-wallet') || '{}') };
const saveWallet = () => localStorage.setItem('handland-wallet', JSON.stringify(wallet));
// ---------- earning Shop Tokens by playing ----------
// Every finished game pays a little: more for winning, for monopolies scored and for bluffs caught, and more again
// against harder bots and in longer games. Feats pay once each. What has been paid is kept on this device
// (`ledger`), next to the wallet, so a game is never paid twice.
const FEATS = [
  { id: 'tutorial', name: 'First deal', text: 'Finish the tutorial round.', tokens: 100, test: (g) => g.tutorial },
  { id: 'win', name: 'In business', text: 'Win a game.', tokens: 150, test: (g) => g.won },
  { id: 'monopoly', name: 'Cornered', text: 'Score a monopoly.', tokens: 50, test: (g) => g.tokens >= 1 },
  { id: 'hound', name: 'Bloodhound', text: 'Catch three bluffs in one game.', tokens: 100, test: (g) => g.right >= 3 },
  { id: 'whistle', name: 'Whistle while you work', text: 'Blow the whistle on five of a kind.', tokens: 100, test: (g) => g.whistles >= 1 },
  { id: 'clean', name: 'Clean hands', text: 'Win without telling a single lie.', tokens: 150, test: (g) => g.won && g.lies === 0 },
  { id: 'liar', name: 'Silver tongue', text: 'Win after five or more lies, never caught.', tokens: 150, test: (g) => g.won && g.lies >= 5 && g.caught === 0 },
  { id: 'cool', name: 'Cool customer', text: 'Win with no Heat on you.', tokens: 100, test: (g) => g.won && g.heat === 0 },
  { id: 'hard', name: 'Hard bargain', text: 'Win against Hard bots.', tokens: 200, test: (g) => g.won && g.solo && g.difficulty >= 2 },
  { id: 'insane', name: 'Out of their league', text: 'Win against Insane bots.', tokens: 400, test: (g) => g.won && g.solo && g.difficulty >= 3 },
  { id: 'full', name: 'Full table', text: 'Win a six-player game.', tokens: 150, test: (g) => g.won && g.players >= 6 },
  { id: 'long', name: 'The long con', text: 'Win a Long game (first to 3).', tokens: 150, test: (g) => g.won && g.target >= 3 },
  { id: 'company', name: 'Good company', text: 'Finish a game with another person.', tokens: 150, test: (g) => g.humans >= 2 },
  { id: 'powers', name: 'Five powers', text: 'Use all five monopoly powers, over any number of games.', tokens: 250, test: (g, led) => DEF.TYPES.every((t) => led.powers.includes(t)) },
];
let ledger = { feats: {}, powers: [], last: null, ...JSON.parse(localStorage.getItem('handland-earned') || '{}') };
const saveLedger = () => localStorage.setItem('handland-earned', JSON.stringify(ledger));
// The game on screen has ended: work out what it paid, pay it once, and return the breakdown to show.
function settle(v) {
  if (P.spectator || v.phase !== 'over') return null;
  if (ledger.last?.gid === v.gid) return ledger.last; // already paid, also after a reload
  const me = v.players[v.you], st = me.stats, humans = P.seats.filter((x) => !x.isBot).length;
  const g = { tutorial: !!P.coach, won: v.winner === v.you, tokens: me.banked.length, right: st.right, whistles: st.whistles || 0, lies: st.lies, caught: st.caught, heat: me.heat, players: v.players.length, target: v.winTarget, humans, solo: humans <= 1, difficulty: P.difficulty ?? 1 };
  for (const t of st.powers || []) if (!ledger.powers.includes(t)) ledger.powers.push(t);
  const lines = [], many = (n, one, more) => `${n} ${n === 1 ? one : more}`;
  if (!g.tutorial) {
    lines.push(['Played to the end', 10]);
    if (g.won) lines.push(['Won the game', 40]);
    if (g.tokens) lines.push([`${many(g.tokens, 'monopoly', 'monopolies')} scored`, g.tokens * 10]);
    if (g.right) lines.push([`${many(Math.min(6, g.right), 'bluff', 'bluffs')} caught`, Math.min(6, g.right) * 5]);
    if (g.whistles) lines.push([`${many(g.whistles, 'right Whistleblower', 'right Whistleblowers')}`, g.whistles * 10]);
  }
  const mult = g.tutorial ? 1 : (g.solo ? [0.5, 1, 1.5, 2][g.difficulty] : 1.5) * [0.6, 1, 1.4][g.target - 1];
  const why = `${g.solo ? `${['Easy', 'Normal', 'Hard', 'Insane'][g.difficulty]} bots` : 'Played with people'} · ${['short', 'standard', 'long'][g.target - 1]} game`;
  const play = Math.round((lines.reduce((n, l) => n + l[1], 0) * mult) / 5) * 5;
  const feats = FEATS.filter((f) => !ledger.feats[f.id] && (g.tutorial ? f.id === 'tutorial' : f.id !== 'tutorial') && f.test(g, ledger));
  for (const f of feats) ledger.feats[f.id] = 1;
  const total = play + feats.reduce((n, f) => n + f.tokens, 0);
  ledger.last = { gid: v.gid, lines, mult: +mult.toFixed(2), why, play, feats: feats.map((f) => f.id), total };
  wallet.tokens += total;
  saveWallet(); saveLedger();
  if (total) setTimeout(() => { sfx.coin(); const el = document.querySelector('.earned'); if (el) burstAt(el, 'coin', 26); }, 1600); // the coins land once, when the panel first shows
  return ledger.last;
}
function earnedHtml(e) {
  if (!e) return '';
  const feat = (id) => FEATS.find((f) => f.id === id);
  return `<div class="earned"><div class="et"><span>Earned</span><span class="etot">${tok(e.total)} <small>Shop Tokens</small></span></div>
    ${e.lines.map(([t, n]) => `<div class="el"><span>${t}</span><b>${n}</b></div>`).join('')}
    ${e.lines.length && e.mult !== 1 ? `<div class="el dim"><span>${e.why}</span><b>×${e.mult}</b></div>` : ''}
    ${e.feats.map((id) => `<div class="el feat"><span><em>Feat</em> ${feat(id).name}</span><b>${feat(id).tokens}</b></div>`).join('')}</div>`;
}
const owns = (id) => id === 'backroom' || id === 'classic' || id === 'none' || wallet.owned.includes(id) || myDecks.some((d) => d.id === id);
const tok = (n) => `<span class="stok"></span> ${n}`;
let modal = null; // { title, html, yes, onYes }
function modalHtml() {
  if (!modal) return '';
  return `<div class="dlg"><div class="box"><h2>${modal.title}</h2><div>${modal.html}</div>
    <div class="actions">${modal.yes ? `<button class="btn" data-do="modalYes">${modal.yes}</button>` : ''}<button class="btn ghost" data-do="modalNo">${modal.yes ? 'Cancel' : 'OK'}</button></div></div></div>`;
}
function shopScreen() {
  const good = (it, kind) => `<div class="good ${owns(it.id) ? 'owned' : ''}">
      ${kind === 'theme' ? `<div class="swatch" data-theme="${it.id}"></div>` : kind === 'bg' ? bgThumb(it.id) : `<div class="deckshow" data-deck="${it.id}">${resCard({ id: 0, type: null, worth: 1 }, { preview: true })}${withArt(artOf(it), () => resCard({ id: 0, type: 'Oil', worth: 1 })).replace(/data-insp="[^"]*"/, '').replace('>Oil<', `>${it.names?.Oil || 'Oil'}<`)}</div>`}
      <div class="nm">${it.name}</div><div class="ds">${it.text}</div>
      ${owns(it.id) ? `<div class="have">${it.price ? 'Owned' : 'Free · owned'}</div>` : `<button class="btn sm ${wallet.tokens >= it.price ? '' : 'ghost'}" data-do="buyItem" data-id="${it.id}">Buy · ${tok(it.price)}</button>`}</div>`;
  return `<div class="shop" data-noskin>
    <div class="head"><div class="logo sm">Shop</div><div class="wallet">${tok(wallet.tokens)} <small>Shop Tokens</small></div><button class="btn ghost" data-do="homeBack">Back</button></div>
    <h3>1 · Earn Shop Tokens <small>Every finished game pays. Winning, monopolies and caught bluffs pay more; harder bots and longer games multiply it.</small></h3>
    <div class="feats">${FEATS.map((f) => `<div class="feat ${ledger.feats[f.id] ? 'done' : ''}"><b>${f.name}</b><span>${f.text}</span><em>${ledger.feats[f.id] ? 'Done' : tok(f.tokens)}</em></div>`).join('')}</div>
    <h3>2 · Or buy Shop Tokens</h3>
    <div class="packs">${PACKS.map((p) => `<div class="good pack"><div class="amt">${tok(p.tokens)}</div><div class="ds">${p.note || 'Starter'}</div><button class="btn sm" data-do="buyPack" data-id="${p.id}">${p.price}</button></div>`).join('')}</div>
    <h3>3 · Theme packs <small>The table and the room. The host's theme is what everyone at the table sees.</small></h3>
    <div class="goods">${THEMES.map((t) => good(t, 'theme')).join('')}</div>
    <h3>4 · Backdrops <small>The whole room around the table.</small></h3>
    <div class="goods">${BACKDROPS.map((b) => good(b, 'bg')).join('')}</div>
    <h3>5 · Deck skins <small>Card backs and card paper, for every card in the game.</small></h3>
    <div class="goods">${DECKS.map((d) => good(d, 'deck')).join('')}</div>
    <h3>6 · Make your own deck <small>Free. Your photos, your names, your colours.</small></h3>
    <button class="btn" data-do="maker">Open the Deck Maker</button>
    <p class="fine">To use what you own, open Customize on the main menu. What you pick there is what your table looks like whenever you host. Cosmetics never change the rules.</p>
    <button class="btn ghost" data-do="custom">Open Customize</button>
  </div>`;
}
const bgThumb = (id) => `<div class="bgthumb" data-bg="${id}">${id === 'none' ? '<div class="plain"></div>' : BACKDROP_ART[id]()}</div>`;
// Draw something with another deck's pictures (shop previews), then put the current deck back.
let currentArt = null;
function withArt(pack, fn) { setArtDeck(pack); try { return fn(); } finally { setArtDeck(currentArt); } }
// Put the current look on the page: the host's choice inside a game, my own choice on the menus,
// and the deck being edited while the Deck Maker is open.
let lookKey = '';
// The look I have chosen for tables I host (only things I own).
const myLook = () => ({ theme: owns(setup.theme) ? setup.theme : 'backroom', deck: owns(setup.deck) ? setup.deck : 'classic', bg: owns(setup.bg) ? setup.bg : 'none' });
function applyLook() {
  const mine = myLook();
  const look = P ? P.look : homeView === 'maker' && mk.id ? { ...mine, deck: mk.id } : mine;
  const theme = THEMES.some((t) => t.id === look?.theme) ? look.theme : 'backroom';
  let deck = deckById(look?.deck);
  if (!deck && isCustom(look?.deck) && P) fetchRemoteDeck(look.deck); // the host made it; ask the server for it
  if (!deck) deck = DECKS[0];
  const bg = BACKDROPS.some((b) => b.id === look?.bg) ? look.bg : 'none';
  const key = `${theme}|${bg}|${deck.id}|${deck.rev || 0}|${DEF ? 1 : 0}`;
  if (key === lookKey) return;
  lookKey = key;
  document.body.dataset.theme = theme;
  document.body.dataset.bg = bg;
  document.body.dataset.deck = isCustom(deck.id) ? 'custom' : deck.id;
  const c = isCustom(deck.id) ? deck.colors || {} : {};
  const vars = { '--bk-a': c.back, '--bk-b': c.back && shade(c.back, 0.16), '--bk-gem': c.back && shade(c.back, -0.25), '--bk-line': c.line, '--bk-h': c.paper, '--cardpaper': c.paper };
  for (const [k, v] of Object.entries(vars)) { if (v && HEX.test(v)) document.body.style.setProperty(k, v); else document.body.style.removeProperty(k); }
  const cs = getComputedStyle(document.body), col = (k) => cs.getPropertyValue(k).trim();
  document.body.style.setProperty('--backimg', cardBackUrl({ a: col('--bk-a'), b: col('--bk-b'), line: col('--bk-line'), gem: col('--bk-gem'), h: col('--bk-h') }));
  currentArt = artOf(deck);
  setArtDeck(currentArt);
  // A deck stores names by card id; on screen the word to replace is the card's printed name ("Forced Trade").
  setNames(Object.fromEntries(Object.entries(deck.names || {}).map(([k, v]) => [DEF?.CARDS[k]?.name || k, v])));
  drawRoom();
}
// Lighten (+) or darken (-) a #rrggbb colour.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16), ch = (v) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
}
let fetchingDeck = null;
async function fetchRemoteDeck(id) {
  if (fetchingDeck === id) return;
  fetchingDeck = id;
  const out = local ? local.api('getdeck', { code: session.code }) : await fetch('api/getdeck', { method: 'POST', body: JSON.stringify({ code: session.code }) }).then((r) => r.json()).catch(() => ({}));
  const d = cleanDeck(out.deck);
  if (d && d.id === id) { remoteDeck = d; lookKey = ''; render(); }
  else fetchingDeck = null;
}

// ---------- the Deck Maker: your own names, photos, symbols and colours ----------
const mk = { id: null };
const mkDeck = () => myDecks.find((d) => d.id === mk.id);
function newDeck() {
  const d = { id: `custom-${Math.random().toString(36).slice(2, 10)}`, name: `My deck ${myDecks.length + 1}`, rev: Date.now(), colors: { back: '#1b1e42', line: '#ffd23f', paper: '#f7eed6' }, names: {}, icons: {}, art: {} };
  myDecks.push(d); mk.id = d.id; saveDecks();
  return d;
}
function makerScreen() {
  const d = mkDeck() || myDecks[0] || newDeck();
  mk.id = d.id;
  const val = (v) => esc(v || '');
  const tile = (key, label, isRes) => `<div class="mktile">
      <div class="pv">${(isRes ? resCard({ id: 0, type: key, worth: 1 }).replace(/data-insp="[^"]*"/, '') : playCard(key, 0).replace(/data-cid="[^"]*"/, '')).replace(`>${label}<`, `>${esc(d.names[key] || label)}<`)}</div>
      <div class="lbl">Was: ${label}</div>
      <input class="field" data-mk="n:${key}" maxlength="${isRes ? 12 : 16}" placeholder="${label}" value="${val(d.names[key])}">
      ${isRes ? `<input class="field" data-mk="i:${key}" maxlength="4" placeholder="Symbol (an emoji), or leave empty" value="${val(d.icons[key])}">` : ''}
      <div class="row"><label class="btn sm">${d.art[key] ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" data-mkfile="${key}" hidden></label>${d.art[key] ? `<button class="btn ghost sm" data-do="mkNoPhoto" data-id="${key}">Remove photo</button>` : ''}</div>
    </div>`;
  return `<div class="shop maker" data-noskin>
    <div class="head"><div class="logo sm">Deck Maker</div><button class="btn ghost" data-do="homeBack">Done</button></div>
    <h3>1 · Pick a deck to edit</h3>
    <div class="row wrap">${myDecks.map((x) => `<button class="btn sm ${x.id === d.id ? '' : 'ghost'}" data-do="mkPick" data-id="${x.id}">${esc(x.name)}</button>`).join('')}<button class="btn ghost sm" data-do="mkNew">+ New deck</button></div>
    <h3>2 · Name and colours</h3>
    <div class="row wrap mkbar">
      <label>Deck name <input class="field" data-mk="name" maxlength="24" value="${val(d.name)}"></label>
      <label>Card back <input type="color" data-mk="c:back" value="${d.colors.back || '#1b1e42'}"></label>
      <label>Back trim <input type="color" data-mk="c:line" value="${d.colors.line || '#ffd23f'}"></label>
      <label>Card paper <input type="color" data-mk="c:paper" value="${d.colors.paper || '#f7eed6'}"></label>
      <div class="pv back">${resCard({ id: 0, type: null, worth: 1 }, { preview: true })}</div>
    </div>
    <h3>3 · The five resources <small>Give each a name, a photo and a symbol. Leave any box empty to keep the original.</small></h3>
    <div class="mkgrid">${DEF.TYPES.map((t) => tile(t, t, true)).join('')}</div>
    <h3>4 · Action and Boost cards <small>Optional. Rename them or give them your own photo.</small></h3>
    <div class="mkgrid">${Object.entries(DEF.CARDS).map(([k, c]) => tile(k, c.name, false)).join('')}</div>
    <h3>5 · Use it</h3>
    <p class="fine">Your deck is saved as you go. Pick it under "Deck skin" when you set up a bot game, or in the lobby when you host friends, and everyone at the table sees it. Photos are shrunk to fit a card and are sent to the other players in your game.</p>
    <div class="row"><button class="btn danger sm" data-do="mkDelete">Delete this deck</button></div>
  </div>`;
}
// Shrink a chosen photo to card size (400x300, cropped to fill) so a whole deck stays small.
function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const W = 400, H = 300, c = document.createElement('canvas');
      c.width = W; c.height = H;
      const k = Math.max(W / img.width, H / img.height), w = img.width * k, h = img.height * k;
      c.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}
const mkTouch = (d) => { d.rev = Date.now(); return saveDecks(); };
// Typing in the Deck Maker saves straight away; the previews refresh when you leave the box.
document.addEventListener('input', (e) => {
  const key = e.target.dataset?.mk, d = mkDeck();
  if (!key || !d) return;
  const v = e.target.value;
  if (key === 'name') d.name = v.slice(0, 24) || 'My deck';
  else if (key.startsWith('c:') && HEX.test(v)) d.colors[key.slice(2)] = v;
  else if (key.startsWith('n:')) { const t = v.replace(/[<>&]/g, '').trim(); if (t) d.names[key.slice(2)] = t; else delete d.names[key.slice(2)]; }
  else if (key.startsWith('i:')) { const t = v.replace(/[<>&]/g, '').trim(); if (t) d.icons[key.slice(2)] = t; else delete d.icons[key.slice(2)]; }
  mkTouch(d);
  if (key.startsWith('c:')) applyLook(); // colours show live
});
document.addEventListener('change', async (e) => {
  const d = mkDeck();
  if (!d) return;
  const fileKey = e.target.dataset?.mkfile;
  if (fileKey && e.target.files?.[0]) {
    try { d.art[fileKey] = await readPhoto(e.target.files[0]); }
    catch { toast('That file could not be read as a picture. Try a JPG or PNG.'); sfx.error(); return; }
    if (!mkTouch(d)) delete d.art[fileKey];
    render();
  } else if (e.target.dataset?.mk && !e.target.dataset.mk.startsWith('c:')) render();
});

// ---------- setting up a game against bots ----------
const SETUP_DEFAULT = { bots: 3, difficulty: 1, winTarget: 2, speed: 1, clock: 1, whistle: 1, lawsuit: 1, marks: 'all', theme: 'backroom', deck: 'classic', bg: 'none' };
let setup = { ...SETUP_DEFAULT, ...JSON.parse(localStorage.getItem('handland-setup') || '{}') };
let homeView = 'main';
// Whether the game remembers cards for you. Rows are never rearranged, so a card seen once can be followed; this
// setting decides whether the game puts a small symbol on it or leaves the remembering to you, as at a real table.
const MARKS = [['all', 'Marked'], ['looks', 'My looks only'], ['none', 'Not marked']];
const MARK_HINT = { all: 'Every card you have seen keeps a small symbol on it.', looks: 'Only cards you looked at with Espionage or Audit keep a symbol.', none: 'No symbols. Remember what you saw, as at a real table.' };
const SETUP = [
  { key: 'bots', name: 'Opponents', opts: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], hint: (v) => `${v + 1} players at the table. More players means more trades and more bluffs to watch.` },
  { key: 'difficulty', name: 'Difficulty', opts: [[0, 'Easy'], [1, 'Normal'], [2, 'Hard'], [3, 'Insane']], hint: (v) => ['Bots rarely call your bluffs, lie less, and often forget to use their cards.', 'Bots bluff, call bluffs, and start to notice when you go quiet.', 'Bots watch how you play: stop trading or calling and they will suspect a monopoly.', 'Bots remember every card they have seen and read your habits. Go quiet and they come for you.'][v] },
  { key: 'winTarget', name: 'Game length', opts: [[1, 'Short'], [2, 'Standard'], [3, 'Long']], hint: (v) => [`First to 1 Monopoly token wins. About 5 minutes.`, 'First to 2 Monopoly tokens wins. About 15 minutes.', 'First to 3 Monopoly tokens wins. About 25 minutes.'][v - 1] },
  { key: 'speed', name: 'Bot speed', opts: [[1.8, 'Relaxed'], [1, 'Normal'], [0.5, 'Fast']], hint: (v) => ({ 1.8: 'Bots take their time, so every move is easy to follow.', 1: 'Bots move at a steady pace.', 0.5: 'Bots move quickly. Best once you know the game.' })[v] },
  { key: 'clock', name: 'Your thinking time', opts: [[4, 'No rush'], [2, 'Relaxed'], [1, 'Normal'], [0.5, 'Quick']], hint: (v) => `You get ${Math.round(15 * v)} seconds to call a bluff and ${Math.round(75 * v)} seconds to answer a trade.` },
  { key: 'whistle', name: 'Whistleblower cards', opts: [[1, 'In the deck'], [0, 'Left out']], hint: (v) => (v ? 'Anyone can blow the whistle on five of a kind, at any time.' : 'No Whistleblower cards. A held monopoly can only be broken by taking cards.') },
  { key: 'marks', name: 'Seen cards', opts: MARKS, hint: (v) => MARK_HINT[v] },
  { key: 'lawsuit', name: 'Lawsuit cards', opts: [[1, 'In the deck'], [0, 'Left out']], hint: (v) => (v ? 'A right call with a Lawsuit also takes an extra card from the liar.' : 'No Lawsuit cards. Call-outs only win what is on the table.') },
];
function setupScreen() {
  const label = (key) => SETUP.find((x) => x.key === key).opts.find((o) => o[0] === setup[key])?.[1];
  const lk = myLook(), nm = (list, id) => (list.find((x) => x.id === id) || myDecks.find((x) => x.id === id))?.name || '';
  return `<div class="menu setup">
      <div class="logo sm">Bot game</div>
      <div class="tag">Set up your table, then deal.</div>
      ${SETUP.map((r, i) => `<div class="opt"><div class="oname"><span class="n">${i + 1}</span>${r.name}</div>
        <div class="seg">${r.opts.map(([val, text]) => `<button class="btn sm ${setup[r.key] === val ? '' : 'ghost'}" data-do="setOpt" data-id="${r.key}:${val}">${esc(String(text))}</button>`).join('')}</div>
        <div class="ohint">${r.hint(setup[r.key])}</div></div>`).join('')}
      <div class="opt look"><div class="oname"><span class="n">${SETUP.length + 1}</span>Look</div>
        <div class="lookline"><span>${esc(nm(THEMES, lk.theme))} · ${esc(nm(BACKDROPS, lk.bg))} · ${esc(nm(DECKS, lk.deck))}</span><button class="btn ghost sm" data-do="custom">Customize</button></div></div>
      <div class="setupfoot"><button class="btn big" data-do="startBots"><span>Deal the cards</span><small>${setup.bots} ${label('difficulty').toLowerCase()} bot${setup.bots === 1 ? '' : 's'} · ${label('winTarget').toLowerCase()} game</small></button>
      <div class="row"><button class="btn ghost sm" data-do="homeBack">Back</button><button class="btn ghost sm" data-do="setupReset">Reset to normal</button><button class="btn ghost sm" data-do="shop">Shop · ${tok(wallet.tokens)}</button></div></div>
    </div>`;
}

// ---------- Customize: everything about how you and your table look, set once before any game ----------
let customFrom = 'main';
function customScreen() {
  const lk = myLook(), a = myAvatar || { style: 'badge', hat: 0, skin: 0, extra: 0, suit: 0 };
  const face = a.style === 'face';
  const opt = (key, n, label) => `<div class="avline"><span class="avlbl">${label}</span><div class="avrow">${Array.from({ length: n }, (_, i) => `<button class="avopt ${a[key] === i ? 'on' : ''}" data-do="avSet" data-id="${key}:${i}">${drawCrest(myName, 0, false, { ...a, style: 'face', [key]: i })}</button>`).join('')}</div></div>`;
  const tile = (it, kind, cur, body) => `<button class="good pick ${cur === it.id ? 'sel' : ''} ${owns(it.id) ? '' : 'locked'}" data-do="pref" data-id="${kind}:${it.id}">${body}
      <div class="nm">${esc(it.name)}</div><div class="have">${cur === it.id ? 'In use' : owns(it.id) ? 'Use this' : `In the shop · ${tok(it.price)}`}</div></button>`;
  return `<div class="shop custom" data-noskin>
    <div class="head"><div class="logo sm">Customize</div><div class="wallet">${tok(wallet.tokens)} <small>Shop Tokens</small></div><button class="btn ghost" data-do="shop">Shop</button><button class="btn" data-do="customDone">Done</button></div>
    <h3>1 · You <small>How you look to everyone at the table.</small></h3>
    <div class="avbox">
      <div class="avbig">${drawCrest(myName, 0, false, face ? a : null)}<div class="nm">${esc(myName || 'Player')}</div></div>
      <div class="avopts">
        <div class="avline"><span class="avlbl">Portrait</span><div class="avrow"><button class="btn sm ${face ? 'ghost' : ''}" data-do="avStyle" data-id="badge">Badge with my initial</button><button class="btn sm ${face ? '' : 'ghost'}" data-do="avStyle" data-id="face">A face</button></div></div>
        ${face ? opt('hat', AVATAR_OPTIONS.hats, 'Hat') + opt('skin', AVATAR_OPTIONS.skins, 'Skin') + opt('extra', AVATAR_OPTIONS.extras, 'Extra') + opt('suit', AVATAR_OPTIONS.suits, 'Suit') : ''}
      </div>
    </div>
    <h3>2 · Table theme <small>Felt, rail and lighting.</small></h3>
    <div class="goods">${THEMES.map((t) => tile(t, 'theme', lk.theme, `<div class="swatch" data-theme="${t.id}"></div>`)).join('')}</div>
    <h3>3 · Backdrop <small>The room around the table.</small></h3>
    <div class="goods">${BACKDROPS.map((b) => tile(b, 'bg', lk.bg, bgThumb(b.id))).join('')}</div>
    <h3>4 · Cards <small>The deck everyone plays with.</small></h3>
    <div class="goods">${[...DECKS, ...myDecks].map((d) => tile(d, 'deck', lk.deck, `<div class="deckshow" data-deck="${isCustom(d.id) ? 'custom' : d.id}">${resCard({ id: 0, type: null, worth: 1 }, { preview: true })}${withArt(artOf(d), () => resCard({ id: 0, type: 'Oil', worth: 1 })).replace(/data-insp="[^"]*"/, '').replace('>Oil<', `>${esc(d.names?.Oil || 'Oil')}<`)}</div>`)).join('')}</div>
    <div class="row" style="margin-top:calc(var(--u) * 1.4)"><button class="btn ghost" data-do="maker">Make your own deck</button><button class="btn" data-do="customDone">Done</button></div>
    <p class="fine">Your choices are saved. Your portrait shows in every game you join; the table, backdrop and cards apply to games you host.</p>
  </div>`;
}

function home() {
  const room = new URLSearchParams(location.search).get('room') || '';
  const invited = /^[A-Za-z]{4}$/.test(room) && (!local || wantsNet()); // opened from a friend's link or QR code
  if (homeView === 'shop') return shopScreen();
  if (homeView === 'maker') return makerScreen();
  if (homeView === 'custom') return customScreen();
  if (homeView === 'bots') {
    return `<div class="corner"><button class="btn ghost sm" data-do="toggleSound">${audio.prefs.sound ? 'Sound on' : 'Sound off'}</button><button class="btn ghost sm" data-do="toggleMusic">${audio.prefs.music ? 'Music on' : 'Music off'}</button></div>
  <div class="home"><div class="hero"><div class="tiltbox">${['Livestock', 'Weapons', 'Oil', 'Workers', 'Farmland'].map((t) => resFace(t)).join('')}</div></div>${setupScreen()}</div>`;
  }
  return `<div class="corner"><button class="btn ghost sm" data-do="toggleSound">${audio.prefs.sound ? 'Sound on' : 'Sound off'}</button><button class="btn ghost sm" data-do="toggleMusic">${audio.prefs.music ? 'Music on' : 'Music off'}</button></div>
  <div class="home">
    <div class="hero"><div class="tiltbox">${['Livestock', 'Weapons', 'Oil', 'Workers', 'Farmland'].map((t) => resFace(t)).join('')}</div></div>
    <div class="menu">
      <div class="logo">Handland</div>
      <div class="tag">Trade face down. Lie if you dare. Corner the market.</div>
      <div class="lbl">Your name</div>
      <input class="field" id="name" maxlength="16" placeholder="Type your name" value="${esc(myName)}">
      ${invited ? `<button class="btn big" data-do="join"><span>Join game ${esc(room.toUpperCase())}</span><small>You were invited. Type your name, then tap here</small></button>` : ''}
      <div class="lbl">Play</div>
      <button class="btn big ${invited ? 'ghost' : ''}" data-do="botMenu"><span>Play against bots</span><small>Pick difficulty, length and more</small></button>
      <button class="btn big calm" data-do="tutorial"><span>Tutorial round</span><small>Learn by playing, about 5 minutes</small></button>
      ${local ? '' : '<button class="btn big ghost" data-do="host"><span>Host on this Wi-Fi</span><small>Friends in the same place join by code</small></button>'}
      <button class="btn big ghost" data-do="hostNet"><span>Host a game online</span><small>Friends anywhere join by link</small></button>
      <button class="btn big ghost" data-do="custom"><span>Customize</span><small>Your player, table, backdrop and cards</small></button>
      ${`<div class="lbl">Join a friend</div>
      <div class="row"><input class="field" id="code" placeholder="4-letter code, or paste their link" style="flex:1;width:auto" value="${esc(room)}"><button class="btn" data-do="join">Join</button><button class="btn ghost" data-do="watch" title="Show the game on this screen without playing. Good for a TV.">Watch</button></div>`}
      <p></p><div class="row"><button class="btn ghost sm" data-do="openRules">How to play</button><button class="btn ghost sm" data-do="shop">Shop · ${tok(wallet.tokens)}</button></div>
    </div>
  </div>`;
}

// A QR code for a link, or nothing if the link would not work from another device (no network) or is too long.
function qrFor(link) {
  if (/\/\/(localhost|127\.)/.test(link)) return '';
  try { return qrSvg(link); } catch { return ''; }
}
function lobbyScreen() {
  const isHost = P.you === P.host, tv = P.spectator;
  const online = !!(hosting || remote);
  const join = online ? `${inviteBase()}?room=${P.code}&net=1` : `${P.lan}/?room=${P.code}`, qr = P.seats.length < 6 ? qrFor(join) : '';
  return `<div class="lobby ${tv ? 'tv' : ''}"><div class="inner">
    <div class="logo sm" style="text-align:center">Handland</div>
    <div class="box joinbox ${qr ? '' : 'noqr'}">
      ${qr ? `<div class="joinqr" data-noskin>${qr}<b>Scan to join</b><span>Point a phone camera here.${online ? '' : ' Same Wi-Fi.'}</span></div>` : ''}
      <div class="joinway"><div class="lbl" style="margin-top:0">Game code</div><div class="code">${P.code}</div>
        <p class="small">${online ? 'Send friends this link. It works from anywhere:' : `${qr ? 'Or type' : 'Friends on the same Wi-Fi type'} the code into Handland, or open this in a browser:`}</p><div class="link">${join}</div>
        ${hosting ? '<p class="small"><b>Keep this page open.</b> The game runs here; if you close it, the game ends for everyone.</p>' : ''}
        ${tv ? '' : `<p class="small">To show the game on a TV, open this on the TV. It watches without playing and shows nobody's hidden cards:</p><div class="link">${join}&amp;watch=1</div>`}
        ${qr ? '' : P.seats.length >= 6 ? '<p class="small">The table is full.</p>' : /localhost/.test(P.lan) ? '<p class="small">This computer is not on a network, so other devices cannot reach it yet.</p>' : ''}</div>
    </div>
    <div class="box"><div class="lbl" style="margin-top:0">Players · ${P.seats.length} of 6</div>
      ${P.seats.map((s, i) => `<div class="seat">${crest(s.name, i, s.isBot)}<span>${esc(s.name)}${i === P.you ? ' (you)' : ''}</span><span class="small">${i === P.host ? 'Host' : s.isBot ? 'Bot' : s.online ? 'Ready' : 'Away'}</span></div>`).join('')}
      ${isHost ? `<div class="row" style="margin-top:calc(var(--u) * 1)"><button class="btn ghost sm" data-do="addBot">Add a bot</button><button class="btn ghost sm" data-do="removeBot">Remove a bot</button></div>` : ''}
    </div>
    <div class="box"><div class="lbl" style="margin-top:0">Seen cards${isHost ? '' : ' · chosen by the host'}</div><div class="chips">${MARKS.map(([val, text]) => `<button class="chip ${P.marks === val ? 'on' : ''}" data-do="setMarks" data-id="${val}" ${isHost ? '' : 'disabled'}>${text}</button>`).join('')}</div><p class="small">${MARK_HINT[P.marks] || ''}</p></div>
    <div class="box"><div class="lbl" style="margin-top:0">Monopoly tokens needed to win</div><div class="chips">${[1, 2, 3].map((n) => `<button class="chip ${P.winTarget === n ? 'on' : ''}" data-do="target" data-id="${n}" ${isHost ? '' : 'disabled'}>${n} · ${n === 1 ? 'quick' : n === 2 ? 'standard' : 'long'}</button>`).join('')}</div></div>
    <div class="box"><div class="lbl" style="margin-top:0">Table theme, cards and backdrop${isHost ? '' : ' · chosen by the host'}</div>
      <div class="chips">${THEMES.filter((t) => isHost ? owns(t.id) : t.id === P.look.theme).map((t) => `<button class="chip ${P.look.theme === t.id ? 'on' : ''}" data-do="setLook" data-id="theme:${t.id}" ${isHost ? '' : 'disabled'}>${t.name}</button>`).join('')}</div>
      <div class="chips" style="margin-top:calc(var(--u) * .6)">${(isHost ? [...DECKS, ...myDecks].filter((t) => owns(t.id)) : [deckById(P.look.deck) || { id: P.look.deck, name: 'Custom deck' }]).map((t) => `<button class="chip ${P.look.deck === t.id ? 'on' : ''}" data-do="setLook" data-id="deck:${t.id}" ${isHost ? '' : 'disabled'}>${esc(t.name)}</button>`).join('')}</div>
      <div class="chips" style="margin-top:calc(var(--u) * .6)">${(isHost ? BACKDROPS.filter((t) => owns(t.id)) : BACKDROPS.filter((t) => t.id === P.look.bg)).map((t) => `<button class="chip ${P.look.bg === t.id ? 'on' : ''}" data-do="setLook" data-id="bg:${t.id}" ${isHost ? '' : 'disabled'}>${esc(t.name)}</button>`).join('')}</div>
      ${isHost ? '<p class="small">Everyone at the table sees your choice.</p>' : ''}</div>
    ${isHost ? `<button class="btn big" data-do="start" style="justify-content:center">Start the game</button>` : `<p class="small" style="text-align:center">Waiting for the host to start…</p>`}
    <div class="row" style="justify-content:center;margin-top:calc(var(--u) * 1)"><button class="btn ghost sm" data-do="openRules">How to play</button><button class="btn ghost sm" data-do="leave">Leave</button></div>
  </div></div>`;
}

// ---------- the middle of the table: what is being played right now ----------

function stage(v) {
  const name = (id) => (id === v.you ? 'You' : esc(v.players[id].name));
  const c = v.pending;
  const down = (id, type) => resCard({ id, type, known: !!type, worth: 1 }, { cls: 'stage sm' });
  if (v.phase === 'over') {
    return `<div class="idle">${crest(v.players[v.winner].name, v.winner, v.players[v.winner].isBot)}<div class="big">${v.winner === v.you ? 'You win!' : `${name(v.winner)} wins`}</div><div class="sub">The market is cornered</div></div>`;
  }
  if (c?.kind === 'cost') {
    return `<div class="stagerow">
      <div class="slot">${playCard(c.card, c.cardId, { cls: 'stage prop', attrs: `data-insp="pc:${c.card}"` })}<div class="by">${name(c.player)} ${c.player === v.you ? 'play' : 'plays'} this</div></div>
      <div class="slot"><span class="says">Paid: ${c.cost.map(typeLabel).join(' + ')}</span><div class="stagerow" style="gap:calc(var(--u) * .5)">${c.paid.map((r) => down(r.id, r.type)).join('')}</div><div class="by">Face down. True?</div></div>
    </div>${c.x.target !== undefined ? `<div class="target">Aimed at ${c.x.target === v.you ? 'you' : name(c.x.target)}</div>` : ''}`;
  }
  if (c?.kind === 'alibi') {
    return `<div class="idle"><div class="big sm">${name(c.caller)} ${c.caller === v.you ? 'call' : 'calls'} it</div><div class="sub">${c.site === 'whistle' ? 'Whistleblower' : `the ${esc(c.what)}`} · ${name(c.accused)} ${c.accused === v.you ? 'answer' : 'answers'}</div></div>`;
  }
  if (c?.kind === 'dup') return `<div class="idle"><div class="big sm">${name(c.player)}: Duplicator</div><div class="sub">Its card is gone · moving it under another</div></div>`;
  if (c?.kind === 'tip') {
    if (!c.cards) return `<div class="idle"><div class="big sm">${name(c.player)}: Insider Tip</div><div class="sub">Two cards, one to keep</div></div>`;
    return `<div class="stagerow build tiprow">${c.cards.map((k) => `<button class="slot tippick" data-do="tipKeep" data-id="${k.id}">${playCard(k.kind, k.id, { cls: 'stage', attrs: `data-insp="pc:${k.kind}"` }).replace(/data-cid="[^"]*"/, '')}<div class="by">Keep this</div></button>`).join('')}</div>`;
  }
  if (c?.kind === 'power') { // the power that comes with a scored monopoly
    const pw = DEF.POWERS[c.res];
    if (!c.cards?.length) return `<div class="idle"><div class="big sm">${name(c.player)}: ${pw.name}</div><div class="sub">${c.cards ? 'Three cards, one to keep' : `${typeLabel(c.res)} monopoly power`}</div></div>`;
    const kept = harvest.n === c.n ? harvest.keep : undefined;
    return `<div class="stagerow build tiprow">${c.cards.map((k) => `<button class="slot tippick ${k.id === kept ? 'kept' : ''}" data-do="harvest" data-id="${k.id}">${resCard({ id: k.id, type: k.type, worth: 1 }, { cls: 'stage', mine: true }).replace(/data-cid="[^"]*"/, '')}<div class="by">${kept === undefined ? 'Keep this' : k.id === kept ? 'Keeping' : 'Back on top'}</div></button>`).join('')}</div>`;
  }
  if (c?.kind === 'whistle') {
    return `<div class="idle"><div class="big sm">${name(c.caller)} blew the whistle</div><div class="sub">${name(c.accused)} ${c.accused === v.you ? 'have' : 'has'} five of a kind</div></div>`;
  }
  if (c?.kind === 'trade' && !involvesMe(v) && !P.spectator) { // two others trading: it plays out in their own panels
    if (c.open && c.stage === 'response') return `<div class="idle"><div class="big sm">${name(c.from)}: open offer</div><div class="sub">Says ${c.offerClaim} · wants ${c.ask} · ${name(c.to)} is answering${c.queue.includes(v.you) ? ' · you are in line' : ''}</div></div>`;
    return `<div class="idle"><div class="big sm">${name(c.from)} ⇄ ${name(c.to)}</div><div class="sub">Trading between themselves</div></div>`;
  }
  if (c?.kind === 'trade') {
    return `<div class="stagerow">
      <div class="slot"><span class="says">"${typeLabel(c.offerClaim)}"</span>${down(c.offerId, c.offerType)}<div class="by">${name(c.from)}</div></div>
      <div class="vs">⇄</div>
      <div class="slot">${c.replyId ? `<span class="says">"${typeLabel(c.replyClaim)}"</span>${down(c.replyId, c.replyType)}` : `<span class="says">Wants ${typeLabel(c.ask)}</span>${c.to === v.you && ui.stake ? spot('stake', 'Your card', true) : `<div class="ghostcard">${c.to === v.you ? '<small>Drag a card here</small>' : '?'}</div>`}`}<div class="by">${name(c.to)}</div></div>
    </div>${c.to === v.you && c.stage === 'response' && !(P.coach && P.coach.next) ? tokRow('claim', 'Say it is') : ''}`;
  }
  if (isMyFreeTurn(v) && ui.mode) { const b = buildStage(v); if (b) return b; }
  const last = lastLine(v);
  return `<div class="idle"><div class="big">${v.turn === v.you ? 'Your turn' : `${name(v.turn)}'s turn`}</div><div class="sub">Round ${Math.ceil(v.turnNumber / v.players.length)} · first to ${v.winTarget} token${v.winTarget === 1 ? '' : 's'}</div></div>${last ? `<div class="lastline">${esc(last)}</div>` : ''}`;
}

// A place on the felt for one choice: an outline until it is filled, then a face-down card.
function spot(key, label, filled, tag = '') {
  return filled
    ? `<button class="spot full" data-do="unslot" data-id="${key}" title="Click to take it back"><div class="card back"><div class="cardface"></div></div>${tag}</button>`
    : `<div class="spot"><div class="ghostcard"><small>${label}</small></div></div>`;
}
// Five claim tokens lying on the table: pick one to say a resource out loud.
const tokRow = (key, label) => `<div class="tokrow"><span class="tl">${label}</span>${DEF.TYPES.map((t) => `<button class="rtok t-${t} ${ui[key] === t ? 'on' : ''}" data-set="${key}" data-val='"${t}"' title="${t}">${ico(t)}<i>${t}</i></button>`).join('')}</div>`;
const who = (v, pid) => (pid === 'open' ? '<div class="spot who all"><span>ALL</span></div>' : `<div class="spot who">${crest(v.players[pid].name, pid, v.players[pid].isBot)}</div>`);

function buildStage(v) {
  const me = v.players[v.you];
  const typeOf = (rid) => me.res.find((r) => r.id === rid)?.type;
  const by = (t) => `<div class="by">${t}</div>`;
  if (ui.mode === 'trade') {
    const lie = ui.give && ui.claim && typeOf(ui.give) !== ui.claim;
    return `<div class="stagerow build">
      <div class="slot">${ui.to !== undefined ? who(v, ui.to) : '<div class="spot"><div class="ghostcard"><small>Click a player</small></div></div>'}${by(ui.to === 'open' ? 'Everyone, in turn' : ui.to !== undefined ? esc(v.players[ui.to].name) : 'Trade with')}</div>
      <div class="slot">${spot('give', 'Drag a card here', !!ui.give, lie ? '<span class="tag lie">Scam</span>' : '')}${by('You give')}</div>
      <div class="tokcol">${tokRow('claim', 'Say it is')}${tokRow('ask', 'Ask for')}</div>
    </div>`;
  }
  if (ui.mode !== 'play') return '';
  const h = me.hand.find((x) => x.id === ui.card);
  if (!h || PASSIVE.includes(h.kind)) return '';
  const d = DEF.CARDS[h.kind];
  const payOk = payCheck(d.cost, d.cost.map((_, i) => typeOf(ui['pay' + i])));
  let slots = d.cost.map((t, i) => {
    const got = typeOf(ui['pay' + i]);
    const fine = payOk[i];
    return `<div class="slot">${spot('pay' + i, `${ico(t)} Drag a card here`, !!got, got ? `<span class="tag ${fine ? '' : 'lie'}">${fine ? 'Honest' : 'Bluff'}</span>` : '')}${by(`Pay ${t}`)}</div>`;
  }).join('');
  if (TARGETED.includes(h.kind)) {
    const verb = h.kind === 'strike' ? 'Remove' : h.kind === 'espionage' ? 'Peek at' : 'Steal';
    slots += `<div class="slot">${ui.target !== undefined ? who(v, ui.target) : `<div class="spot"><div class="ghostcard"><small>Click a player's ${h.kind === 'strike' ? 'Boost' : 'card'}</small></div></div>`}${by(ui.target !== undefined ? `${verb}: ${esc(v.players[ui.target].name)}${ui.their ? '' : ' · pick a card'}` : verb)}</div>`;
  }
  if (SEATED.includes(h.kind)) {
    slots += `<div class="slot">${ui.target !== undefined ? who(v, ui.target) : '<div class="spot"><div class="ghostcard"><small>Click a player</small></div></div>'}${by(ui.target !== undefined ? `${h.kind === 'audit' ? 'Audit' : 'Stop'}: ${esc(v.players[ui.target].name)}` : h.kind === 'audit' ? 'Audit who?' : 'Stop who?')}</div>`;
  }
  if (h.kind === 'writeoff') {
    slots += `<div class="slot"><div class="ntoks">${[1, 2, 3].map((n) => `<button class="ntok ${ui.wo === n ? 'on' : ''}" data-set="wo" data-val="${n}" ${n > me.res.length ? 'disabled' : ''}>${n}</button>`).join('')}</div>${by(ui.wo ? `Write off ${ui.wo}` : 'How many?')}</div>`;
  }
  if (NEEDS_MINE.includes(h.kind) && !(h.kind === 'expansion' && expansionDraws(me))) {
    const label = h.kind === 'duplicator' ? 'Double' : h.kind === 'expansion' ? 'Expand' : 'You give';
    slots += `<div class="slot">${h.kind === 'expansion' ? `<div class="spot"><div class="ghostcard ${ui.mine ? 'ok' : ''}"><small>${ui.mine ? 'Boost picked' : 'Click one of your Boosts'}</small></div></div>` : spot('mine', 'Drag a card here', !!ui.mine)}${by(label)}</div>`;
  }
  return `<div class="stagerow build"><div class="slot">${playCard(h.kind, h.id, { cls: 'stage prop', attrs: `data-insp="pc:${h.kind}"` })}${by(playReady(me) ? 'Ready' : 'Your card')}</div>${slots}</div>`;
}

function coachBox() {
  const c = P.coach;
  if (!c) return '';
  return `<div class="coach">${crest('Coach Sterling', 1, true)}<div style="flex:1"><div class="hd">Coach Sterling · tutorial ${Math.min(c.step + 1, c.total)} of ${c.total}</div>
    <div>${c.text ? rich(c.text) : 'Watch what I do…'}</div>
    ${c.done ? '<div class="actions"><button class="btn" data-do="quick">Play a real game</button><button class="btn ghost" data-do="leaveNow">Main menu</button></div>' : c.next ? '<div class="actions"><button class="btn" data-do="tutNext">Next</button></div>' : ''}</div></div>`;
}

// ---------- the prompt panel: always says whose move it is and what to click ----------

function panel(v, me, myFreeTurn) {
  const name = (id) => esc(v.players[id].name);
  const clock = '<span class="clock" id="clock"></span>';
  const hasLawsuit = me.hand.some((h) => h.kind === 'lawsuit');
  const hasSpy = me.hand.some((h) => h.kind === 'espionage');

  if (v.phase === 'over') {
    const won = v.winner === v.you;
    // Now that it is over, everyone's lies come out.
    const most = (f) => { const top = Math.max(...v.players.map(f)); const ids = v.players.filter((p) => f(p) === top).map((p) => p.id); return top > 0 && ids.length <= 2 ? ids : []; }; // an award shared by half the table means nothing
    const liars = most((p) => p.stats.lies), eyes = most((p) => p.stats.right), clean = v.players.filter((p) => p.stats.lies === 0).map((p) => p.id);
    const award = (p) => [liars.includes(p.id) ? '<span class="award red">Biggest liar</span>' : '', eyes.includes(p.id) ? '<span class="award">Sharpest eye</span>' : '', clean.includes(p.id) ? '<span class="award green">Never lied</span>' : ''].join('');
    return `<h2>${won ? 'You cornered the market' : `${name(v.winner)} cornered the market`}</h2>
      <table class="stats"><tr><th>Player</th><th>Tokens</th><th>Lies told</th><th>Times caught</th><th>Calls right</th><th>Calls wrong</th></tr>
      ${v.players.map((p) => `<tr class="${p.id === v.winner ? 'win' : ''}"><td>${esc(p.name)}${p.id === v.you ? ' (you)' : ''}${award(p)}</td><td>${p.banked.length}</td><td>${p.stats.lies}</td><td>${p.stats.caught}</td><td>${p.stats.right}</td><td>${p.stats.wrong}</td></tr>`).join('')}</table>
      ${earnedHtml(settle(v))}
      <div class="actions">${P.you === P.host ? `<button class="btn" data-do="rematch">Play again</button><button class="btn ghost" data-do="toLobby">Back to lobby</button>` : '<span class="note">Waiting for the host…</span>'}</div>`;
  }

  const c = v.pending;
  if (c?.kind === 'alibi') {
    const thing = c.site === 'whistle' ? 'blows the whistle on you' : `calls your ${esc(c.what)}`;
    if (c.accused === v.you) {
      return `<h2>${name(c.caller)} ${thing}</h2><p>You hold an <b>Alibi</b>. Play it and the call is cancelled: nothing is turned over.</p>
        <div class="actions"><button class="btn calm" data-do="alibiYes">Play Alibi</button><button class="btn ghost" data-do="alibiNo">Let the call happen</button>${clock}</div>`;
    }
    return `<h2>${c.caller === v.you ? 'You called it' : `${name(c.caller)} called it`}</h2><p>Waiting for <b>${name(c.accused)}</b>… ${clock}</p>`;
  }
  if (c?.kind === 'power') {
    const pw = DEF.POWERS[c.res];
    if (c.player !== v.you) return `<h2>${name(c.player)}: ${pw.name}</h2><p>${pw.text}</p><p>Waiting… ${clock}</p>`;
    if (c.cards) { const kept = harvest.n === c.n && harvest.keep !== undefined; return `<h2>Harvest</h2>${todo([['On the table, click the card you keep', kept], ['Click which of the other two goes back on top', false]])}<div class="actions">${clock}</div>`; }
    const who = v.players.filter((o) => o.id !== v.you && (c.res !== 'Weapons' || o.res.length));
    return `<h2>${pw.name}</h2><p>Your ${typeLabel(c.res)} monopoly power. ${pw.text}</p>
      <div class="actions">${pw.target ? who.map((o) => `<button class="btn go" data-do="powerUse" data-id="${o.id}">${esc(o.name)}</button>`).join('') : `<button class="btn go" data-do="powerUse">Use ${pw.name}</button>`}<button class="btn ghost" data-do="powerSkip">Skip it</button>${clock}</div>`;
  }
  if (c?.kind === 'dup') {
    if (c.player !== v.you) return `<h2>${name(c.player)} moves a Duplicator</h2><p>The card it was under is gone, so it goes under another of their cards. Waiting… ${clock}</p>`;
    return `<h2>Move your Duplicator</h2><p>The card it was under is gone.</p>${todo([['Click one of your resources to tuck it under', false]])}<div class="actions">${clock}</div>`;
  }
  if (c?.kind === 'tip') {
    if (c.player === v.you) return `<h2>Insider Tip</h2>${todo([['On the table, click the card you keep. The other is discarded', false]])}<div class="actions">${clock}</div>`;
    return `<h2>${name(c.player)} reads an Insider Tip</h2><p>Waiting… ${clock}</p>`;
  }
  if (c?.kind === 'whistle') {
    if (c.caller === v.you) {
      const n = (ui.wp || []).length;
      return `<h2>You were right!</h2><p><b>${name(c.accused)}</b> was holding.</p>
        ${todo([[`Click ${c.need} of their cards to take · ${n} picked`, n === c.need]])}
        <div class="actions"><button class="btn ${n === c.need ? 'go' : ''}" data-do="whistleGo">Take them</button>${clock}</div>`;
    }
    if (c.accused === v.you) return `<h2>Caught holding!</h2><p><b>${name(c.caller)}</b> is taking ${c.need} of your cards… ${clock}</p>`;
    return `<h2>Whistleblower!</h2><p><b>${name(c.caller)}</b> caught <b>${name(c.accused)}</b> holding and is taking ${c.need} cards… ${clock}</p>`;
  }
  if (ui.wb) {
    return `<h2>Whistleblower</h2>
      ${todo([['Click the player you accuse', false]])}
      <div class="actions"><button class="btn ghost" data-do="cancel">Take it back</button></div>`;
  }
  if (c?.kind === 'cost') {
    const d = DEF.CARDS[c.card];
    const on = c.x.target !== undefined ? ` on <b>${c.x.target === v.you ? 'you' : name(c.x.target)}</b>` : '';
    if (c.waiting[0] === v.you) {
      return `<h2>Do you believe ${name(c.player)}?</h2>
        <p>Plays <b>${d.name}</b>${on}. Says they paid <b>${costText(c.cost)}</b>.</p>${burnNote(me)}
        <div class="actions"><button class="btn calm" data-do="costPass">Let it through</button>
          <button class="btn danger" data-do="costCall">Call the bluff!</button>
          ${hasLawsuit ? '<button class="btn danger" data-do="costCallLaw">Call + Lawsuit</button>' : ''}${clock}</div>
        <p class="note">Right: you take the payment. Wrong: lose 1 Cover or gain 1 Heat.</p>`;
    }
    const turnNote = `<b>${name(c.waiting[0])}</b> decides now${c.waiting.length > 1 ? `, then ${c.waiting.slice(1).map((id) => (id === v.you ? '<b>you</b>' : name(id))).join(', then ')}` : ''}.`;
    if (c.player === v.you) return `<h2>You played ${d.name}</h2><p>${turnNote} ${clock}</p>`;
    return `<h2>${name(c.player)} plays ${d.name}</h2><p>Paid <b>${costText(c.cost)}</b>, they say. ${turnNote} ${clock}</p>`;
  }

  if (c?.kind === 'trade') {
    if (c.stage === 'response' && c.to === v.you) {
      const peeked = c.offerType ? `<p class="priv">You peeked: it is really <b>${c.offerType}</b>.</p>` : '';
      return `<h2>${c.open ? `${name(c.from)}'s open offer reaches you` : `${name(c.from)} offers you a trade`}</h2>
        <p>They say it is <b>${c.offerClaim}</b> and want <b>${c.ask}</b>.</p>${peeked}
        ${todo([['Drag one of your cards to the middle', !!ui.stake], ['Pick what you say it is. You can lie', !!ui.claim]])}
        <div class="actions"><button class="btn calm" data-do="tradeGo">Trade</button>
          <button class="btn danger" data-do="tradeCall">Call scam!</button>
          ${hasLawsuit ? '<button class="btn danger" data-do="tradeCallLaw">Call + Lawsuit</button>' : ''}
          ${hasSpy && !c.offerType ? '<button class="btn ghost" data-do="peek">Peek (Espionage)</button>' : ''}
          <button class="btn ghost" data-do="tradeNo">${c.open ? 'Pass it on' : 'No thanks'}</button>${clock}</div>
        ${c.open ? `<p class="note">If you pass, ${c.queue.length ? `${name(c.queue[0])} is next` : 'the card goes back'}.</p>` : ''}
        <p class="note">Call scam: whoever is wrong loses both cards.</p>`;
    }
    if (c.stage === 'decision' && c.from === v.you) {
      const peeked = c.replyType ? `<p class="priv">You peeked: it is really <b>${c.replyType}</b>.</p>` : '';
      return `<h2>${name(c.to)} put a card down</h2>
        <p>They say it is <b>${c.replyClaim}</b>. You asked for ${c.ask}.${c.replyClaim !== c.ask ? ' That is not what you asked for, so you may call it off.' : ''}</p>${peeked}${burnNote(me)}
        <div class="actions"><button class="btn calm" data-do="finishOk">Swap cards</button>
          ${c.replyClaim !== c.ask ? '<button class="btn ghost" data-do="finishCancel">Call it off</button>' : ''}
          <button class="btn danger" data-do="finishCall">Call scam!</button>
          ${hasLawsuit ? '<button class="btn danger" data-do="finishCallLaw">Call + Lawsuit</button>' : ''}
          ${hasSpy && !c.replyType ? '<button class="btn ghost" data-do="peek">Peek (Espionage)</button>' : ''}${clock}</div>`;
    }
    const waitingOn = c.stage === 'response' ? c.to : c.from;
    if (c.open && c.stage === 'response') {
      const line = c.queue.map((id) => (id === v.you ? '<b>you</b>' : name(id))).join(', then ');
      return `<h2>${c.from === v.you ? 'Your open offer' : `${name(c.from)}'s open offer`}</h2><p>A card said to be <b>${c.offerClaim}</b>, for <b>${c.ask}</b>. <b>${name(c.to)}</b> is answering${line ? `, then ${line}` : ''}. ${clock}</p>`;
    }
    return `<h2>${name(c.from)} and ${name(c.to)} are trading</h2><p>Waiting for ${waitingOn === v.you ? 'you' : name(waitingOn)}… ${clock}</p>`;
  }

  if (!myFreeTurn) return `<h2>${v.turn === v.you ? 'Your turn' : `${name(v.turn)}'s turn`}</h2>`;

  if (ui.mode === 'trade') return tradePanel(v, me);
  if (ui.mode === 'play') return playPanel(v, me);
  if (ui.mode === 'discard') return discardPanel(me);

  const counts = DEF.TYPES.map((t) => [t, me.res.filter((r) => r.type === t).reduce((n, r) => n + r.worth, 0)]).sort((a, b) => b[1] - a[1]);
  const [best, n] = counts[0];
  return `<h2>Your turn</h2>
    <div class="howto">
      <div><span class="n">1</span><b>Trade:</b> ${me.traded ? 'offered this turn ✓' : 'drag one of your resources onto a player'}</div>
      <div><span class="n">2</span><b>Play:</b> drag a card from your hand onto the table</div>
      <div><span class="n">3</span><b>Done?</b> End your turn</div>
    </div>
    <div class="actions"><button class="btn calm" data-do="endTurn">End turn</button><button class="btn ghost" data-do="modeTrade" ${me.traded ? 'disabled' : ''}>Offer a trade</button></div>
    <p class="note">${n >= 5 ? `5 ${best}. End your turn and hold them for one round to score.` : `Best so far: ${n} ${best}. You need 5.`}</p>`;
}

// A short checklist of what to do on the table. The first unfinished line is the one to do now.
function todo(items) {
  const now = items.findIndex((x) => !x[1]);
  return `<div class="todo">${items.map(([t, ok], i) => `<div class="${ok ? 'ok' : i === now ? 'now' : ''}"><span class="n">${ok ? '✓' : i + 1}</span>${t}</div>`).join('')}</div>`;
}

function tradePanel(v, me) {
  const card = me.res.find((r) => r.id === ui.give);
  const lying = card && ui.claim && card.type !== ui.claim;
  const ready = ui.to !== undefined && ui.give && ui.claim && ui.ask;
  return `<h2>Offer a trade</h2>
    ${todo([[ui.to === 'open' ? 'Open offer: first player to answer gets it' : 'Click a player, or "Offer to everyone"', ui.to !== undefined], ['Drag the card you give to the middle', !!ui.give], ['Pick what you SAY it is. You can lie', !!ui.claim], ['Pick what you ask for', !!ui.ask]])}
    <div class="actions"><button class="btn ${ready ? 'go' : ''}" data-do="sendTrade">Send offer</button>${v.players.length > 2 ? `<button class="btn ghost" data-do="toAll">${ui.to === 'open' ? 'To everyone ✓' : 'Offer to everyone'}</button>` : ''}<button class="btn ghost" data-do="cancel">Take it back</button>
      ${lying ? '<span class="warn">This is a scam. If they call it, they keep both cards.</span>' : ''}</div>`;
}

function playPanel(v, me) {
  const h = me.hand.find((x) => x.id === ui.card);
  const d = DEF.CARDS[h.kind];
  if (h.kind === 'lawsuit') {
    return `<h2>Lawsuit</h2><p class="note">Use the "Call + Lawsuit" button when you call someone out.</p>
      <div class="actions"><button class="btn ghost" data-do="cancel">OK</button></div>`;
  }
  if (h.kind === 'alibi') {
    return `<h2>Alibi</h2><p class="note">Keep it. When someone calls you out or blows the whistle on you, you are asked whether to play it.</p>
      <div class="actions"><button class="btn ghost" data-do="cancel">OK</button></div>`;
  }
  const typeOf = (rid) => me.res.find((r) => r.id === rid)?.type;
  const items = d.cost.map((t, i) => [`Pay ${t}: drag a card to the middle. Any other card is a bluff`, !!ui['pay' + i]]);
  if (h.kind === 'strike') items.push(['Click the Boost to remove', !!ui.their]);
  else if (TARGETED.includes(h.kind)) items.push([`Click the card to ${h.kind === 'espionage' ? 'peek at' : 'steal'}`, !!ui.their]);
  if (h.kind === 'duplicator') items.push(['Click the card of yours to double', !!ui.mine]);
  if (h.kind === 'writeoff') items.push(['Pick 1, 2 or 3. They come off the right end', !!ui.wo]);
  if (h.kind === 'expansion') items.push(expansionDraws(me) ? ['No Boost to expand: you draw 2 cards instead', true] : ['Click one of your Boosts', !!ui.mine]);
  if (h.kind === 'audit') items.push(['Click the player whose cards you want to see', ui.target !== undefined]);
  if (h.kind === 'injunction') items.push(['Click the player to stop from scoring next turn', ui.target !== undefined]);
  const bluff = payCheck(d.cost, d.cost.map((_, i) => typeOf(ui['pay' + i]))).some((ok, i) => !ok && ui['pay' + i]);
  return `<h2>Play ${d.name}</h2>${todo(items)}
    <div class="actions"><button class="btn ${playReady(me) ? 'go' : ''}" data-do="playGo">Play ${d.name}</button><button class="btn ghost" data-do="cancel">Take it back</button>
      ${bluff ? '<span class="warn">You are bluffing the payment. Anyone can call it.</span>' : ''}</div>`;
}

function discardPanel(me) {
  const overR = Math.max(0, me.res.length - me.slotLimit), overH = Math.max(0, me.hand.length - me.handLimit);
  const dr = ui.dr || [], dh = ui.dh || [];
  const items = [];
  if (overR) items.push([`Click ${overR} of your resources to throw away, or drag ${overR > 1 ? 'them' : 'it'} to the piles · ${dr.length} picked`, dr.length === overR]);
  if (overH) items.push([`Click ${overH} card${overH > 1 ? 's' : ''} in your hand to throw away · ${dh.length} picked`, dh.length === overH]);
  return `<h2>Too many cards</h2>${todo(items)}
    <div class="actions"><button class="btn calm" data-do="discardGo" ${dr.length === overR && dh.length === overH ? '' : 'disabled'}>Discard and end turn</button><button class="btn ghost" data-do="cancel">Back</button></div>`;
}

// ---------- reactions: sound, particles, banners ----------

const seatEl = (id) => $(`seat-${id}`)?.querySelector('.crest');
const seatBox = (id) => $(`seat-${id}`);
// A line of news that slides up inside one player's own panel.
const strip = (pid, html, ms = 2600) => seatFx(seatBox(pid)?.querySelector('.tent') || seatBox(pid), `<div class="strip">${html}</div>`, ms, seatColor(pid));

// Big, whole-screen moments are kept for things that happen to me. Whatever the other
// players do to each other is shown inside their own panels.
function playFx(v) {
  if (lastFx === null) { lastFx = v.fx.length ? v.fx[v.fx.length - 1].n : 0; return; }
  const nm = (id) => (id === v.you ? 'you' : esc(v.players[id].name));
  for (const f of v.fx) {
    if (f.n <= lastFx) continue;
    lastFx = f.n;
    const mine = f.p === v.you, atMe = f.target === v.you;
    switch (f.type) {
      case 'turn': if (mine && v.phase === 'main') { sfx.turn(); } break;
      case 'offer':
        sfx.offer();
        if (mine) streak(seatEl(f.p), seatEl(f.target), 'spark');
        else { puff(seatEl(f.p), 'spark', 8); say(v, f.p, 'offer', f, f.n); }
        break;
      case 'reply': sfx.slide(); say(v, f.p, 'reply', f, f.n); break;
      case 'swap':
        sfx.swap();
        if (mine || atMe) burstAt($('stage'), 'spark', 26);
        else { strip(f.p, `Traded with <b>${nm(f.target)}</b>`); strip(f.target, `Traded with <b>${nm(f.p)}</b>`); }
        break;
      case 'decline':
        sfx.decline();
        if (mine || v.turn === v.you) burstAt($('stage'), 'smoke', 10);
        if (!mine) { say(v, f.p, 'decline', {}, f.n); if (v.turn !== v.you) strip(f.p, 'Turned the trade down', 2000); }
        break;
      case 'call':
        say(v, f.caller, 'call', {}, f.n); say(v, f.accused, f.lie ? 'caught' : 'honest', {}, f.n, 3500);
        setMood(f.caller, 'angry', 1300); setMood(f.accused, f.lie ? 'shock' : 'smug', 3200, 1300); setMood(f.caller, f.lie ? 'smug' : 'sad', 3200, 1300);
        break;
      case 'scammed': sfx.scammed(); banner('Scammed!', '', 'red'); shake($('app'), 7); camKick(5); break;
      case 'play': {
        sfx.play();
        const d = DEF.CARDS[f.kind];
        if (mine) {
          burstAt($('stage'), 'spark', 30);
          if (f.target !== undefined) setTimeout(() => streak($('stage'), seatEl(f.target), 'ember'), 250);
        } else {
          puff(seatEl(f.p), 'spark', 10);
          strip(f.p, `Plays <b>${d.name}</b>${f.target !== undefined ? ` on ${nm(f.target)}` : ''}`);
          if (d.cost.length) say(v, f.p, 'pay', {}, f.n, 500);
        }
        break;
      }
      case 'bust':
        sfx.bust(); setMood(f.p, 'angry', 3000, 300);
        if (mine) { burstAt($('stage'), 'smoke', 34); burstAt($('stage'), 'ember', 20); }
        else { puff(seatEl(f.p), 'smoke', 10); strip(f.p, `<b>${DEF.CARDS[f.kind].name}</b> wasted: caught bluffing`); }
        break;
      case 'whistle': {
        sfx.whistle(); setMood(f.p, f.right ? 'smug' : 'sad', 3200, 400); setMood(f.target, f.right ? 'shock' : 'smug', 3200, 200);
        if (f.why === 'quiet') say(v, f.p, 'read', {}, f.n);
        if (mine) {
          if (f.right) { banner('Caught them!'); camKick(-6); burstAt(seatEl(f.target), 'spark', 40); }
          else { banner('Wrong!', '', 'red'); shake($('app'), 7); camKick(5); }
        } else if (atMe) {
          if (f.right) { banner('Whistle blown!', '', 'red'); shake($('app'), 9); camKick(6); }
          else strip(f.p, 'Whistleblower on you: <b>wrong</b>', 3000);
        } else {
          strip(f.p, f.right ? `Whistleblower: caught <b>${nm(f.target)}</b> holding` : `Whistleblower on ${nm(f.target)}: <b>wrong</b>, 2 Heat penalty`, 3200);
          puff(seatEl(f.p), f.right ? 'spark' : 'ember', 10);
        }
        break;
      }
      case 'alibi':
        sfx.cover(); setMood(f.p, 'smug', 3000); setMood(f.target, 'angry', 2600, 300);
        if (mine) burstAt($('stage'), 'shield', 30); else { puff(seatEl(f.p), 'shield', 12); strip(f.p, '<b>Alibi</b>: the call is cancelled', 3000); }
        break;
      case 'burn': sfx.heat(); sfx.broken(); if (mine) { shake($('app'), 8); burstAt(seatEl(f.p), 'ember', 46); banner('Burned!', '', 'red'); } else puff(seatEl(f.p), 'ember', 14); setMood(f.p, 'sad', 3000); strip(f.p, `Too hot: lost ${typeLabel(f.resType)}`, 3200); break;
      case 'calloff': sfx.slide(); if (!mine) { say(v, f.p, 'decline', {}, f.n); strip(f.p, 'Called the trade off', 2200); } break;
      case 'dupmove': sfx.resolve(); puff(seatEl(f.p), 'mist', 12); break;
      case 'left': sfx.slide(); setMood(f.p, 'sad', 2600); strip(f.p, 'Left · a bot plays on', 4200); break;
      case 'whistled': sfx.steal(); if (mine || atMe) burstAt(seatEl(f.target), 'smoke', 24); else puff(seatEl(f.target), 'smoke', 9); break;
      case 'power': sfx.chime?.(); setMood(f.p, 'smug', 2600); if (f.target !== undefined) { setMood(f.target, 'shock', 2600, 200); puff(seatEl(f.target), 'smoke', 12); } if (mine) burstAt(seatEl(f.p), 'spark', 26); else puff(seatEl(f.p), 'spark', 10); if (!mine) strip(f.p, `<b>${DEF.POWERS[f.res].name}</b>`, 2600); break;
      case 'peek': sfx.peek(); if (mine) burstAt(seatEl(f.p), 'mist', 18); else puff(seatEl(f.p), 'mist', 9); break;
      case 'discard': sfx.slide(); break;
      case 'hold': sfx.hold(); burstAt(seatEl(v.you), 'spark', 40); break;
      case 'broken': sfx.broken(); banner('Hold broken', '', 'red'); shake($('app'), 7); camKick(5); break;
      case 'token': {
        sfx.token(); setMood(f.p, 'smug', 4000); for (const o of v.players) if (o.id !== f.p) setMood(o.id, 'shock', 2200, 200);
        const el = seatEl(f.p);
        if (mine) {
          scoreShow(f.resType, $(`seat-${v.you}`)?.querySelector('[data-tok="score"]')); setTimeout(() => banner('Monopoly!'), 2350); camKick(-6);
          if (el) { const [x, y] = centerOf(el); burst(x, y, 'coin', 70, 2.4, -Math.PI / 2); burst(x, y, 'spark', 40); }
        } else {
          seatFx(seatBox(f.p), `<div class="wash"><div class="big">Monopoly!</div><div class="sm">${f.resType} held a full round · token scored</div></div>`, 3000, seatColor(f.p));
          puff(el, 'coin', 14);
          say(v, f.p, 'token', {}, f.n, 3000);
        }
        break;
      }
      case 'win': if (mine) { sfx.win(); rain('confetti', 5); } else sfx.lose(); for (const o of v.players) setMood(o.id, o.id === f.p ? 'smug' : 'sad', 60000); break;
      case 'resolve': {
        const who = seatEl(f.p), tgt = f.target !== undefined ? seatEl(f.target) : null;
        const big = mine || atMe; // otherwise it stays a small puff in their panel
        const fxAt = (el, kind, n) => (big ? burstAt(el, kind, n) : puff(el, kind, Math.ceil(n / 3)));
        if (tgt && (f.kind === 'strike' || f.kind === 'forcedTrade')) { setMood(f.target, 'angry', 2800, 200); setMood(f.p, 'smug', 2200, 200); }
        if (f.kind === 'strike') { sfx.strike(); fxAt(tgt, 'shard', 34); fxAt(tgt, 'smoke', 14); if (atMe) shake(seatBox(v.you), 7); }
        else if (f.kind === 'bribe') { sfx.coin(); fxAt(who, 'coin', 22); }
        else if (f.kind === 'forcedTrade') { sfx.steal(); if (mine) streak(who, tgt, 'ember'); else fxAt(tgt, 'ember', 18); if (atMe) shake(seatBox(v.you), 7); }
        else if (f.kind === 'espionage') { sfx.peek(); fxAt(tgt, 'mist', 22); }
        else if (f.kind === 'writeoff') { sfx.shuffle(); fxAt(who, 'mist', 16); }
        else if (f.kind === 'audit') { sfx.peek(); fxAt(tgt, 'mist', 26); }
        else if (f.kind === 'injunction') { sfx.lawsuit(); fxAt(tgt, 'smoke', 16); if (tgt) { setMood(f.target, 'angry', 2600, 200); } if (atMe) shake(seatBox(v.you), 6); }
        else if (f.kind === 'tip') { sfx.deal(); fxAt(who, 'spark', 12); }
        else if (f.kind === 'duplicator') { sfx.resolve(); fxAt(who, 'mist', 34); }
        else { sfx.resolve(); fxAt(who, 'spark', 30); }
        if (!mine && atMe) strip(v.you, `${nm(f.p)} used <b>${DEF.CARDS[f.kind].name}</b> on you`, 3000);
        break;
      }
      default: break;
    }
  }
}

// Heat, Cover and score counters pop when they change.
function tokenChanges(v) {
  const now = Object.fromEntries(v.players.map((p) => [p.id, { heat: p.heat, cover: p.cover, score: p.banked.length }]));
  if (prevTokens) {
    for (const p of v.players) {
      const was = prevTokens[p.id];
      if (!was) continue;
      for (const k of ['heat', 'cover', 'score']) {
        if (was[k] === now[p.id][k]) continue;
        const el = $(`seat-${p.id}`)?.querySelector(`[data-tok="${k}"]`);
        if (!el) continue;
        el.classList.add('bump');
        const up = now[p.id][k] > was[k];
        for (let i = 0; i < Math.min(3, Math.abs(now[p.id][k] - was[k])); i++) setTimeout(() => chipFly(k, el, up, p.id === v.you), i * 180);
        if (k === 'heat') { burstAt(el, 'ember', up ? 26 : 10); if (up) setTimeout(() => sfx.heat(), 1500); }
        if (k === 'cover') { burstAt(el, 'shield', 22); if (up) setTimeout(() => sfx.cover(), 1500); }
      }
    }
  }
  prevTokens = now;
}

function showReveal(v) {
  const r = v.reveal;
  if (shownReveal === null) { shownReveal = r ? r.n : 0; return; }
  if (!r || r.n <= shownReveal) return;
  shownReveal = r.n;
  const name = (id) => (id === v.you ? 'You' : esc(v.players[id].name));
  const you = r.caller === v.you;
  const flipper = `<div class="flipper"><div class="inner">${backCard('', '')}${resFace(r.type, 'front')}</div>`;
  // A cost of two cards turns both over, each marked right or wrong.
  const many = r.cards?.length > 1 ? `<div class="flips">${r.cards.map((c) => `<div class="flipper ${c.ok ? 'good' : 'wrong'}"><div class="inner">${backCard('', '')}${resFace(c.type, 'front')}</div><span class="mark">${c.ok ? '✓' : '✕'}</span></div>`).join('')}</div>` : '';
  if (!you && r.accused !== v.you && !P.spectator) { // between two other players: it plays out inside the accused's panel
    seatFx(seatBox(r.accused), `<div class="mini">${flipper}</div><div class="txt"><div class="l"><b>${name(r.caller)}</b> calls the ${esc(r.what)}</div><div class="l">Said ${r.cost ? r.cost.map(typeLabel).join(' + ') : typeLabel(r.claim)}</div><div class="stamp ${r.lie ? 'lie' : 'ok'}">${r.lie ? 'LIAR!' : 'HONEST'}</div></div></div>`, 3300);
    sfx.call();
    setTimeout(() => sfx.flip(), 650);
    setTimeout(() => { if (r.lie) sfx.liar(); else sfx.honest(); puff(seatEl(r.accused), r.lie ? 'ember' : 'shield', 10); }, 1150);
    return;
  }
  const el = $('reveal');
  el.innerHTML = `<div class="rv">
    <div class="line"><b>${name(r.caller)}</b> ${you ? 'call' : 'calls'} out <b>${r.accused === v.you ? 'your' : name(r.accused) + "'s"}</b> ${esc(r.what)}</div>
    <div class="claim"><span class="says">${r.accused === v.you ? 'You' : 'They'} said: ${r.cost ? r.cost.map(typeLabel).join(' + ') : typeLabel(r.claim)}</span></div>
    ${many ? `<div class="flipwrap">${many}<div class="stamp ${r.lie ? 'lie' : 'ok'}">${r.lie ? 'LIAR!' : 'HONEST'}</div></div>` : `${flipper}<div class="stamp ${r.lie ? 'lie' : 'ok'}">${r.lie ? 'LIAR!' : 'HONEST'}</div></div>`}
    <div class="out">${r.lie ? `${name(r.caller)} ${you ? 'win' : 'wins'} the call.` : `${name(r.caller)} ${you ? 'take' : 'takes'} the penalty.`}${r.lawsuit ? (r.lie ? ' The Lawsuit pays out.' : ' The Lawsuit is thrown out.') : ''}</div></div>`;
  el.classList.remove('hidden');
  sfx.call();
  setTimeout(() => sfx.hold(), 250); // a heartbeat while the card turns
  setTimeout(() => sfx.flip(), 800);
  setTimeout(() => {
    const [x, y] = [window.innerWidth / 2, window.innerHeight / 2];
    el.querySelector('.rv')?.classList.add('hit'); // the stamp lands: the card jolts under it
    if (r.lie) { sfx.liar(); shake($('reveal'), 14); burst(x, y, 'ember', 70); burst(x, y, 'smoke', 20); }
    else { sfx.honest(); burst(x, y, 'spark', 60); burst(x, y, 'shield', 30); }
    if (r.lawsuit) setTimeout(() => sfx.lawsuit(), 350);
  }, 1380);
  clearTimeout(showReveal.t);
  showReveal.t = setTimeout(() => el.classList.add('hidden'), 3400);
}

function tickClock() {
  const el = $('clock');
  if (!el) return;
  if (!deadlineAt) { el.textContent = ''; return; }
  const s = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
  el.textContent = `${s}s`;
  if (s <= 5 && s !== lastTick) { lastTick = s; sfx.tick(); }
}
setInterval(tickClock, 250);

// ---------- clicks ----------

const need = (ok, msg) => { if (!ok) { toast(msg); sfx.error(); } return ok; };
const getName = () => { myName = ($('name')?.value || myName || 'Player').trim(); localStorage.setItem('handland-name', myName); return myName; };

// A link with &net=1 is an invitation to an online game (hosted in someone's page, not on this network).
const wantsNet = () => new URLSearchParams(location.search).get('net') === '1';
const lostHost = (link) => () => { if (remote === link) { toast('The host left, or the connection was lost.'); leaveGame(); } };
// Connect to an online game by its code and take a seat (or just watch).
async function joinNet(code, route) {
  toast('Connecting…');
  let link;
  try { link = await joinRoom(code, () => lostHost(link)()); } catch (e) { return { error: e.message }; }
  const out = await link.api(route, route === 'join' ? { name: getName(), avatar: myAvatar } : {});
  if (out.error || !out.token) { link.close(); return { error: out.error || 'Could not join that game.' }; }
  remote = link;
  enter(out);
  return out;
}
const DO = {
  zoomClose: () => hideZoom(),
  zoomGo: () => { const el = zoomFor && document.querySelector(zoomFor); hideZoom(); if (el) { zoomBypass = true; el.click(); zoomBypass = false; } },
  menu: () => { menuOpen = true; drawMenu(); },
  sheetClose: () => { menuOpen = false; $('sheet').classList.add('hidden'); },
  menuRules: () => { DO.sheetClose(); DO.openRules(); },
  menuLeave: () => { DO.sheetClose(); DO.leave(); },
  openRules: () => $('rules').classList.remove('hidden'),
  closeRules: () => $('rules').classList.add('hidden'),
  toggleSound: () => { audio.toggleSound(); render(); },
  toggleMusic: () => { audio.toggleMusic(); render(); },
  cycleGfx: () => { gfxPref = gfxPref === 'auto' ? 'high' : gfxPref === 'high' ? 'low' : 'auto'; localStorage.setItem('handland-gfx', gfxPref); if (gfxPref === 'auto') localStorage.removeItem('handland-gfx-auto'); applyGfx(); render(); },
  toggleView: () => { flatView = !flatView; localStorage.setItem('handland-view', flatView ? '2d' : '3d'); document.body.classList.toggle('flat', flatView); render(); },
  botMenu: () => { getName(); homeView = 'bots'; render(); },
  homeBack: () => { homeView = homeView === 'maker' ? 'custom' : 'main'; render(); },
  setupReset: () => { setup = { ...SETUP_DEFAULT }; localStorage.setItem('handland-setup', JSON.stringify(setup)); render(); },
  setOpt: (id) => {
    const [key, val] = String(id).split(':');
    setup[key] = Number.isNaN(Number(val)) ? val : Number(val);
    localStorage.setItem('handland-setup', JSON.stringify(setup)); render();
  },
  shop: () => { homeView = 'shop'; render(); },
  custom: () => { getName(); if (homeView !== 'shop' && homeView !== 'maker') customFrom = homeView; homeView = 'custom'; render(); },
  customDone: () => { homeView = customFrom === 'bots' ? 'bots' : 'main'; render(); },
  pref: (id) => {
    const [key, val] = String(id).split(':');
    if (!owns(val)) { toast('You do not own that yet. It is in the Shop.'); sfx.error(); return; }
    setup[key] = val; localStorage.setItem('handland-setup', JSON.stringify(setup)); sfx.select(); render();
  },
  avStyle: (id) => { myAvatar = id === 'face' ? { style: 'face', hat: 0, skin: 0, extra: 0, suit: 0, ...(myAvatar || {}), style: 'face' } : null; saveAvatar(); sfx.select(); render(); },
  avSet: (id) => { const [key, val] = String(id).split(':'); myAvatar = { style: 'face', hat: 0, skin: 0, extra: 0, suit: 0, ...(myAvatar || {}), [key]: Number(val) }; saveAvatar(); sfx.chip(); render(); },
  maker: () => { mk.id = mkDeck()?.id || myDecks[0]?.id || newDeck().id; homeView = 'maker'; render(); },
  mkPick: (id) => { mk.id = id; render(); },
  mkNew: () => { newDeck(); render(); },
  mkNoPhoto: (id) => { const d = mkDeck(); if (d) { delete d.art[id]; mkTouch(d); render(); } },
  mkDelete: () => {
    const d = mkDeck();
    if (!d) return;
    modal = { title: `Delete ${esc(d.name)}?`, html: 'Its names, colours and photos are removed from this computer. This cannot be undone.', yes: 'Delete it', onYes: () => { myDecks = myDecks.filter((x) => x.id !== d.id); mk.id = myDecks[0]?.id || null; if (setup.deck === d.id) setup.deck = 'classic'; saveDecks(); if (!myDecks.length) homeView = 'shop'; } };
    render();
  },
  modalNo: () => { modal = null; render(); },
  modalYes: () => { const f = modal?.onYes; modal = null; f?.(); render(); },
  buyItem: (id) => {
    const it = [...THEMES, ...DECKS, ...BACKDROPS].find((x) => x.id === id);
    if (!it || owns(id)) return;
    if (wallet.tokens < it.price) { modal = { title: 'Not enough Shop Tokens', html: `<b>${it.name}</b> costs ${tok(it.price)} and you have ${tok(wallet.tokens)}. Earn more by playing (see "1 · Earn Shop Tokens" at the top of the Shop), or buy them under "2".` }; sfx.error(); render(); return; }
    modal = { title: `Buy ${it.name}?`, html: `This spends ${tok(it.price)} of your ${tok(wallet.tokens)}. It is yours to keep.`, yes: `Buy for ${it.price}`, onYes: () => { wallet.tokens -= it.price; wallet.owned.push(id); saveWallet(); sfx.token(); toast(`${it.name} is yours. Pick it when you set up a game.`); } };
    render();
  },
  // Real money is not connected in this build. When a store bridge exists (window.handlandPay, e.g. Steam), it is used;
  // until then the purchase is clearly marked as a test and charges nothing.
  buyPack: async (id) => {
    const p = PACKS.find((x) => x.id === id);
    if (!p) return;
    const grant = () => { wallet.tokens += p.tokens; saveWallet(); sfx.coin(); toast(`${p.tokens} Shop Tokens added.`); render(); };
    if (window.handlandPay) { if (await window.handlandPay(p)) grant(); return; }
    modal = { title: 'Test purchase', html: `Payments are not connected in this build, so <b>no money is charged</b>. In the released game this pack would cost ${p.price}.<br><br>Add ${tok(p.tokens)} for free to try the shop?`, yes: 'Add tokens', onYes: grant };
    render();
  },
  setLook: async (id) => {
    const [key, val] = String(id).split(':');
    if (!owns(val)) { toast('You do not own that yet. It is in the Shop.'); sfx.error(); return; }
    if (isCustom(val) && !(await post('deck', { code: session.code, token: session.token, deck: deckById(val) })).ok) return; // the table needs the photos first
    lobby('look', { ...P.look, [key]: val });
  },
  startBots: async () => {
    stream?.close();
    const without = [...(setup.whistle ? [] : ['whistleblower']), ...(setup.lawsuit ? [] : ['lawsuit'])];
    homeView = 'main';
    enter(await post('create', { name: getName(), avatar: myAvatar, bots: setup.bots, start: true, look: myLook(), customDeck: isCustom(myLook().deck) ? deckById(myLook().deck) : undefined, opts: { difficulty: setup.difficulty, winTarget: setup.winTarget, speed: setup.speed, clock: setup.clock, marks: setup.marks, without } }));
  },
  tutorial: async () => enter(await post('create', { name: getName(), avatar: myAvatar, tutorial: true })),
  // Host a game that friends anywhere can join: the game runs in this page and their pages connect to it.
  hostNet: async () => {
    const name = getName();
    toast('Opening an online table…');
    let mod;
    try { mod = local || await import('./game/room.js'); } catch { toast('This copy of the game cannot host online.'); sfx.error(); return; }
    const restore = !local;
    for (let tries = 0; tries < 3; tries++) {
      const out = mod.api('create', JSON.parse(JSON.stringify({ name, avatar: myAvatar, bots: 0, look: myLook(), customDeck: isCustom(myLook().deck) ? deckById(myLook().deck) : undefined, opts: { marks: setup.marks } })));
      try {
        hosting = await hostRoom(mod, out.code);
        hosting.restore = restore; local = mod;
        enter(out);
        return;
      } catch (e) {
        mod.api('leave', { code: out.code, token: out.token });
        if (e.message !== 'taken') { toast(e.message); sfx.error(); return; } // 'taken': that code is in use online, so try another
      }
    }
    toast('Could not open an online table. Try again.'); sfx.error();
  },
  host: async () => enter(await post('create', { name: getName(), avatar: myAvatar, bots: 0, look: myLook(), customDeck: isCustom(myLook().deck) ? deckById(myLook().deck) : undefined })),
  join: async () => {
    const raw = $('code').value.trim();
    if (/^https?:\/\//i.test(raw)) { getName(); location.href = raw; return; } // a friend's invite link
    const code = raw.toUpperCase();
    if (!need(code.length === 4, 'Type the 4-letter game code, or paste the invite link.')) return;
    const name = getName();
    if (!local && !wantsNet()) { // a game on this network comes first
      const out = await post('join', { name, avatar: myAvatar, code }, true);
      if (out.token) { enter(out); return; }
      if (!/No game/.test(out.error || '')) { toast(out.error); sfx.error(); return; }
    }
    const out = await joinNet(code, 'join');
    if (out.error) { toast(out.error); sfx.error(); }
  },
  watch: async () => {
    const raw = $('code').value.trim(), m = raw.match(/[?&]room=([A-Za-z]{4})/);
    const code = (m ? m[1] : raw).toUpperCase();
    if (!need(code.length === 4, 'Type the 4-letter game code of the game you want to watch.')) return;
    if (!local && !wantsNet()) {
      const out = await post('watch', { code }, true);
      if (out.token) { enter(out); return; }
      if (!/No game/.test(out.error || '')) { toast(out.error); sfx.error(); return; }
    }
    const out = await joinNet(code, 'watch');
    if (out.error) { toast(out.error); sfx.error(); }
  },
  leave: () => { if (confirm('Leave this game?')) leaveGame(); },
  leaveNow: () => leaveGame(),
  tutNext: () => lobby('tutNext'),
  addBot: () => lobby('addBot'), removeBot: () => lobby('removeBot'), start: () => lobby('start'),
  target: (id) => lobby('target', id), setMarks: (id) => lobby('marks', id), rematch: () => lobby('rematch'), toLobby: () => lobby('toLobby'),

  modeTrade: () => { ui = { key: ui.key, mode: 'trade' }; renderLocal(); },
  cancel: () => { ui = { key: ui.key }; renderLocal(); },
  alibiYes: () => act({ type: 'alibiResponse', use: true }),
  alibiNo: () => act({ type: 'alibiResponse', use: false }),
  tipKeep: (id) => act({ type: 'tipPick', keep: id }),
  powerUse: (id) => act({ type: 'power', use: true, target: typeof id === 'number' ? id : undefined }),
  powerSkip: () => act({ type: 'power', use: false }),
  // Harvest takes two clicks: the card to keep, then which of the other two goes back on top. Clicking the kept card again undoes it.
  harvest: (id) => {
    const c = P.view.pending;
    if (c?.kind !== 'power' || !c.cards) return;
    if (harvest.n !== c.n || harvest.keep === undefined) harvest = { n: c.n, keep: id };
    else if (id === harvest.keep) harvest = {};
    else { act({ type: 'power', keep: harvest.keep, top: id }); return; }
    render();
  },
  whistleGo: () => { const c = P.view.pending; if (c?.kind === 'whistle' && need((ui.wp || []).length === c.need, `Click ${c.need} of their cards first.`)) act({ type: 'whistlePick', resIds: ui.wp }); },
  unslot: (key) => { delete ui[key]; renderLocal(); },
  pickCard: (id) => {
    const v = P.view;
    if (!(v.phase === 'main' && v.turn === v.you && !v.pending)) return;
    ui = { key: ui.key, mode: 'play', card: id }; renderLocal();
  },
  toAll: () => { if (ui.to === 'open') delete ui.to; else ui.to = 'open'; sfx.select(); renderLocal(); },
  sendTrade: () => {
    if (!need(ui.to !== undefined, 'Step 1: click a player, or press "Offer to everyone".') || !need(ui.give, 'Step 2: drag the card you give to the middle.') || !need(ui.claim, 'Step 3: on the table, pick what you say it is.') || !need(ui.ask, 'Step 4: on the table, pick what you ask for.')) return;
    act({ type: 'offerTrade', to: ui.to, cardId: ui.give, claim: ui.claim, ask: ui.ask });
  },
  tradeGo: () => { if (need(ui.stake, 'Step 1: drag one of your cards to the middle.') && need(ui.claim, 'Step 2: on the table, pick what you say it is.')) act({ type: 'respondTrade', choice: 'trade', cardId: ui.stake, claim: ui.claim }); },
  tradeCall: (_, lawsuit = false) => { if (need(ui.stake, 'First drag one of your cards to the middle. It is at stake if you are wrong.')) act({ type: 'respondTrade', choice: 'call', cardId: ui.stake, lawsuit }); },
  tradeCallLaw: () => DO.tradeCall(null, true),
  tradeNo: () => act({ type: 'respondTrade', choice: 'decline' }),
  peek: () => act({ type: 'peekTrade' }),
  finishOk: () => act({ type: 'finishTrade', choice: 'accept' }),
  finishCancel: () => act({ type: 'finishTrade', choice: 'cancel' }),
  finishCall: () => act({ type: 'finishTrade', choice: 'call' }),
  finishCallLaw: () => act({ type: 'finishTrade', choice: 'call', lawsuit: true }),
  costPass: () => act({ type: 'costResponse', choice: 'pass' }),
  costCall: () => act({ type: 'costResponse', choice: 'call' }),
  costCallLaw: () => act({ type: 'costResponse', choice: 'call', lawsuit: true }),
  playGo: () => {
    const me = P.view.players[P.view.you];
    const h = me.hand.find((x) => x.id === ui.card);
    const d = DEF.CARDS[h.kind];
    const payment = d.cost.map((_, i) => ui['pay' + i]);
    if (!need(payment.every(Boolean), 'Drag a card of yours to the middle to pay.')) return;
    const a = { type: 'playCard', cardId: h.id, payment };
    if (['espionage', 'forcedTrade', 'strike'].includes(h.kind)) {
      if (!need(ui.target !== undefined && ui.their, h.kind === 'strike' ? 'Click the Boost you want removed.' : 'Click one of another player\'s cards.')) return;
      a.target = ui.target;
      if (h.kind === 'espionage') a.resId = ui.their;
      if (h.kind === 'forcedTrade') a.theirId = ui.their;
      if (h.kind === 'strike') a.boostId = ui.their;
    }
    if (h.kind === 'writeoff') { if (!need(ui.wo, 'On the table, pick how many cards to write off.')) return; a.count = ui.wo; }
    if (SEATED.includes(h.kind)) { if (!need(ui.target !== undefined, 'Click a player.')) return; a.target = ui.target; }
    if (['duplicator', 'expansion'].includes(h.kind) && !(h.kind === 'expansion' && expansionDraws(me))) {
      if (!need(ui.mine, h.kind === 'expansion' ? 'Click one of your Boosts.' : 'Click one of your own cards.')) return;
      if (h.kind === 'duplicator') a.resId = ui.mine;
      if (h.kind === 'expansion') a.boostId = ui.mine;
    }
    act(a);
  },
  endTurn: () => {
    const me = P.view.players[P.view.you];
    if (me.res.length > me.slotLimit || me.hand.length > me.handLimit) { ui = { key: ui.key, mode: 'discard', dr: [], dh: [] }; renderLocal(); }
    else act({ type: 'endTurn' });
  },
  togR: (id) => { const me = P.view.players[P.view.you]; toggle('dr', id, me.res.length - me.slotLimit); },
  togH: (id) => { const me = P.view.players[P.view.you]; toggle('dh', id, me.hand.length - me.handLimit); },
  discardGo: async () => { const r = await act({ type: 'discard', resIds: ui.dr, cardIds: ui.dh }); if (r.ok) act({ type: 'endTurn' }); },
};
function toggle(key, id, max) {
  const list = ui[key] || [];
  if (list.includes(id)) ui[key] = list.filter((x) => x !== id);
  else if (list.length < max) ui[key] = [...list, id];
  else ui[key] = [...list.slice(1), id];
  renderLocal();
}

document.addEventListener('pointerdown', (e) => { lastPointer = forcePhone ? 'touch' : e.pointerType || 'mouse'; audio.unlock(); }, { capture: true });
document.addEventListener('click', (e) => {
  if (performance.now() - ateClick < 350) return; // that was the end of a drag, not a click
  if (!$('zoom').classList.contains('hidden') && !e.target.closest('#zoom [data-do]')) { hideZoom(); return; } // a tap anywhere else puts the big card away
  if (e.target.id === 'sheet') { DO.sheetClose(); return; }
  const tapped = e.target.closest('.card[data-insp]');
  // Harvest is a two-tap pick (keep one, then which goes back on top), so its cards pick straight away like other multi-card picks.
  if (tapped && lastPointer === 'touch' && P?.started && !zoomBypass && !tapped.matches('.pickable, .picked') && !tapped.closest('#zoom, #inspect, [data-do="harvest"]') && showZoom(tapped)) return;
  if (P?.spectator && !e.target.closest('[data-do]')) return; // watching only: nothing on the table is clickable
  const set = e.target.closest('[data-set]');
  if (set) {
    const key = set.dataset.set;
    ui[key] = JSON.parse(set.dataset.val);
    if (key === 'target') delete ui.their;
    if (set.classList.contains('rtok') || set.classList.contains('ntok')) sfx.chip(); else sfx.select();
    renderLocal();
    return;
  }
  const card = e.target.closest('.table .card[data-zone]');
  if (card && P?.started && card.dataset.zone === 'hand' && Number(card.dataset.owner) === P.view.you && ui.mode !== 'discard' && isWhistle(P.view.players[P.view.you], Number(card.dataset.id))) {
    if (!canWhistle(P.view)) { toast(P.coach ? 'Whistleblower is not part of the tutorial.' : 'Wait for the current Whistleblower to finish.'); sfx.error(); return; }
    ui = ui.wb ? { key: ui.key } : { key: ui.key, wb: true, stake: ui.stake, claim: ui.claim };
    sfx.select(); renderLocal();
    return;
  }
  if (card && P?.started && clickable(P.view, P.view.players[P.view.you], Number(card.dataset.owner), card.dataset.zone)) { cardClick(Number(card.dataset.owner), card.dataset.zone, Number(card.dataset.id)); return; }
  const seat = e.target.closest('.seatbox.opp');
  if (seat && P?.started) {
    const v = P.view, pid = Number(seat.id.slice(5));
    if (ui.wb) { delete ui.wb; act({ type: 'whistle', target: pid }); return; }
    if (seatPickable(v, v.players[v.you], pid)) {
      if (ui.mode === 'trade') ui.to = pid; else { ui.target = pid; delete ui.their; }
      sfx.select(); renderLocal();
    }
    return;
  }
  const b = e.target.closest('[data-do]');
  if (!b || b.disabled) return;
  sfx.click();
  const id = b.dataset.id;
  DO[b.dataset.do]?.(id !== undefined && /^\d+$/.test(id) ? Number(id) : id);
  if (menuOpen) drawMenu(); // the menu's own buttons show what they are set to
});
const TILT = '.mine .cards .card, .hand .card';
document.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  const c = e.target.closest?.(TILT); if (c) tilt(c, e);
  const px = e.clientX / window.innerWidth - 0.5, py = e.clientY / window.innerHeight - 0.5;
  camLook(px, py);
  const hero = document.querySelector('.hero .tiltbox');
  if (hero) { hero.style.setProperty('--hx', `${(px * 26 - 6).toFixed(1)}deg`); hero.style.setProperty('--hy', `${(6 - py * 18).toFixed(1)}deg`); }
});
document.addEventListener('mouseover', (e) => {
  const insp = e.target.closest?.('.card[data-insp]');
  if (insp && !insp.contains(e.relatedTarget) && !drag?.on) {
    clearTimeout(inspTimer);
    const wait = insp.closest('.hand') ? 130 : insp.closest('.mine') ? 480 : 240;
    inspTimer = setTimeout(() => { if (!drag?.on) showInspect(insp); }, wait);
  }
  const c = e.target.closest?.(`${TILT}, .btn, .chip`);
  if (c && !c.contains(e.relatedTarget)) sfx.hover();
});
document.addEventListener('mouseout', (e) => {
  const insp = e.target.closest?.('.card[data-insp]');
  if (insp && !insp.contains(e.relatedTarget)) hideInspect();
  const c = e.target.closest?.(TILT);
  if (c && !c.contains(e.relatedTarget)) untilt(c);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('rules').classList.contains('hidden')) $('rules').classList.add('hidden');
  else if (drag) dragEnd(false);
  else if (ui.mode) DO.cancel();
});

// ---------- dragging cards ----------
// Pick a card up and put it where it goes: a hand card onto the table (or onto a player) to
// play it, one of my resources onto a player to offer it, or into the middle to pay with it.

let drag = null, ateClick = 0;

function dragKind(el) {
  const v = P?.view;
  if (!v || !P.started || v.phase !== 'main' || Number(el.dataset.owner) !== v.you) return null;
  const zone = el.dataset.zone, c = v.pending;
  if (zone === 'hand' && canWhistle(v) && isWhistle(v.players[v.you], Number(el.dataset.id))) return 'hand';
  if (c?.kind === 'trade' && c.stage === 'response' && c.to === v.you && !(P.coach && P.coach.next)) return zone === 'res' ? 'res' : null;
  if (!isMyFreeTurn(v)) return null;
  return zone === 'hand' || zone === 'res' ? zone : null;
}
const dragSrc = () => drag && document.querySelector(`.table .card[data-owner="${P.view.you}"][data-zone="${drag.zone}"][data-id="${drag.id}"]`);

// Where this card may be dropped right now.
function dropTargets() {
  const v = P.view, me = v.players[v.you], out = [];
  const seats = (ok) => { for (const s of document.querySelectorAll('.seatbox.opp')) if (ok(v.players[Number(s.id.slice(5))])) out.push(s); };
  const stageEl = $('stage');
  if (drag.zone === 'hand') {
    const kind = me.hand.find((h) => h.id === drag.id)?.kind;
    if (kind === 'whistleblower') { seats(() => true); if (ui.mode === 'discard') out.push(document.querySelector('.piles')); return out; }
    if (ui.mode === 'discard') { out.push(document.querySelector('.piles')); return out; }
    if (PASSIVE.includes(kind)) return out;
    out.push(stageEl);
    if (TARGETED.includes(kind)) seats((p) => (kind === 'strike' ? p.boosts.length : p.res.length));
    if (SEATED.includes(kind)) seats((p) => kind === 'injunction' || p.res.length);
    return out;
  }
  if (v.pending || ui.mode === 'play') { out.push(stageEl); return out; }
  if (ui.mode === 'discard') { out.push(document.querySelector('.piles')); return out; }
  if (!me.traded) { out.push(stageEl); seats((p) => p.res.length); }
  return out;
}

function dragRefresh() {
  document.querySelectorAll('.dragsrc, .drop, .over').forEach((e) => e.classList.remove('dragsrc', 'drop', 'over'));
  if (!drag?.on) return;
  const src = dragSrc();
  if (!src || dragKind(src) !== drag.zone) { dragEnd(false); return; } // the table changed under the card
  src.classList.add('dragsrc');
  for (const t of dropTargets()) t?.classList.add('drop');
}

function dragStart(e) {
  const src = dragSrc();
  if (!src) { drag = null; return; }
  const r = src.getBoundingClientRect();
  const g = document.createElement('div');
  g.className = 'dragghost';
  const copy = src.cloneNode(true);
  copy.removeAttribute('data-cid'); copy.removeAttribute('style');
  copy.classList.remove('sel', 'can', 'picked', 'pickable', 'out');
  copy.querySelectorAll('.rolebadge, .eye').forEach((x) => x.remove());
  copy.style.setProperty('--cw', `calc(var(--u) * ${drag.zone === 'hand' ? 11.8 : 8.4})`);
  g.appendChild(copy);
  document.body.appendChild(g);
  Object.assign(drag, { on: true, ghost: g, home: [r.left + r.width / 2, r.top + r.height / 2], lean: 0, lx: e.clientX });
  document.body.classList.add('dragging');
  hideInspect(); untilt(src);
  sfx.slide();
  dragRefresh();
  dragMove(e);
}

function dragMove(e) {
  const g = drag.ghost;
  drag.lean = Math.max(-16, Math.min(16, drag.lean * 0.8 + (e.clientX - drag.lx) * 0.9)); drag.lx = e.clientX;
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const flat = under && !under.closest('.handcol, .dock, .seatbox.me'); // over the table the card lies back, ready to be put down
  g.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  g.firstChild.style.transform = `translate(-50%, -50%) rotateX(${flat && !flatView ? 32 : 0}deg) rotateZ(${drag.lean.toFixed(1)}deg) scale(${flat ? (drag.zone === 'hand' ? 0.86 : 1.04) : 1.06})`;
  const hot = under?.closest('.drop');
  if (hot !== drag.hot) { drag.hot?.classList.remove('over'); hot?.classList.add('over'); drag.hot = hot; if (hot) sfx.hover(); }
}

function dragEnd(done, to = null) {
  const d = drag; drag = null;
  if (!d) return;
  document.body.classList.remove('dragging');
  document.querySelectorAll('.dragsrc, .drop, .over').forEach((e) => e.classList.remove('dragsrc', 'drop', 'over'));
  if (!d.on) return;
  ateClick = performance.now();
  const g = d.ghost;
  g.style.transition = 'transform .2s cubic-bezier(.2,.8,.2,1), opacity .2s';
  if (done) { g.style.opacity = '0'; if (to) g.style.transform = `translate(${to[0]}px, ${to[1]}px) scale(.6)`; }
  else { g.style.transform = `translate(${d.home[0]}px, ${d.home[1]}px)`; g.style.opacity = '.4'; }
  setTimeout(() => g.remove(), 210);
}

// Put the dragged card down. Returns true when it landed somewhere that means something.
function dropAt(x, y) {
  const v = P.view, me = v.players[v.you], d = drag;
  const under = document.elementFromPoint(x, y);
  if (!under) return false;
  const onTable = !under.closest('.handcol, .dock, .seatbox.me');
  const seat = under.closest('.seatbox.opp'), pid = seat ? Number(seat.id.slice(5)) : null;
  const over = under.closest('.table .card[data-zone]');
  const fresh = { key: ui.key };

  if (d.zone === 'hand') {
    const kind = me.hand.find((h) => h.id === d.id)?.kind;
    if (kind === 'whistleblower' && pid !== null) { delete ui.wb; act({ type: 'whistle', target: pid }); return true; }
    if (kind === 'whistleblower' && ui.mode !== 'discard') { if (onTable) { toast('Drop Whistleblower on the player you accuse.'); sfx.error(); } return false; }
    if (ui.mode === 'discard') { if (!onTable || me.hand.length <= me.handLimit) return false; if (!(ui.dh || []).includes(d.id)) DO.togH(d.id); return true; }
    if (!onTable) { if (ui.mode === 'play' && ui.card === d.id) DO.cancel(); return false; }
    if (kind === 'lawsuit') { toast('Lawsuit is not played on its own. When you call someone out, use "Call + Lawsuit".'); sfx.error(); return false; }
    if (kind === 'alibi') { toast('Keep Alibi in your hand. You are asked to play it when someone calls you out.'); sfx.error(); return false; }
    ui = ui.mode === 'play' && ui.card === d.id ? ui : { ...fresh, mode: 'play', card: d.id };
    if (pid !== null && seatPickable(v, me, pid)) {
      ui.target = pid; delete ui.their;
      if (over && Number(over.dataset.owner) === pid && over.dataset.zone === (kind === 'strike' ? 'boost' : 'res')) ui.their = Number(over.dataset.id);
    }
    if (over && Number(over.dataset.owner) === v.you) {
      if (kind === 'duplicator' && over.dataset.zone === 'res') ui.mine = Number(over.dataset.id);
      if (kind === 'expansion' && over.dataset.zone === 'boost' && !me.boosts.find((b) => b.id === Number(over.dataset.id))?.expanded) ui.mine = Number(over.dataset.id);
    }
    sfx.select();
    if (playReady(me) && !DEF.CARDS[kind].cost.length) DO.playGo(); // nothing to pay and nothing left to choose: it is played
    renderLocal();
    return true;
  }

  // one of my resources
  const type = me.res.find((r) => r.id === d.id)?.type;
  if (!onTable || under.closest('.mine')) return false;
  if (v.pending) { ui.stake = d.id; ui.claim ??= type; sfx.select(); renderLocal(); return true; }
  if (ui.mode === 'discard') { if (me.res.length <= me.slotLimit) return false; if (!(ui.dr || []).includes(d.id)) DO.togR(d.id); return true; }
  if (ui.mode === 'play') {
    const used = Object.entries(ui).some(([k, val]) => (k.startsWith('pay') || k === 'mine') && val === d.id);
    if (used || !clickable(v, me, v.you, 'res')) return false;
    cardClick(v.you, 'res', d.id);
    return true;
  }
  if (me.traded) { toast('You already offered a trade this turn.'); sfx.error(); return false; }
  if (pid !== null && !v.players[pid].res.length) { toast('They have no cards to trade.'); sfx.error(); return false; }
  ui = { ...fresh, mode: 'trade', to: pid ?? (ui.mode === 'trade' ? ui.to : undefined), give: d.id, claim: ui.mode === 'trade' && ui.give === d.id ? ui.claim : type, ask: ui.mode === 'trade' ? ui.ask : undefined };
  sfx.select(); renderLocal();
  return true;
}

// Holding a finger on any card opens it large, the same as a tap does for cards that are not being picked from.
let holdTimer = null, held = false, holdAt = null;
document.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  held = false;
  const el = e.target.closest?.('.card[data-insp]:not(#zoom *)');
  clearTimeout(holdTimer);
  if (!el) return;
  holdAt = [e.clientX, e.clientY];
  holdTimer = setTimeout(() => { if (!drag?.on) { held = true; ateClick = performance.now() + 400; showZoom(el); } }, 430);
}, { capture: true });
document.addEventListener('pointermove', (e) => { if (holdAt && e.pointerType === 'touch' && Math.hypot(e.clientX - holdAt[0], e.clientY - holdAt[1]) > 10) { clearTimeout(holdTimer); holdAt = null; } }, { capture: true });
document.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') { clearTimeout(holdTimer); holdAt = null; if (held) ateClick = performance.now(); } }, { capture: true });
document.addEventListener('pointercancel', () => { clearTimeout(holdTimer); holdAt = null; }, { capture: true });

document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || drag) return;
  const el = e.target.closest?.('.table .card[data-zone]');
  const zone = el && dragKind(el);
  if (zone) drag = { zone, id: Number(el.dataset.id), x0: e.clientX, y0: e.clientY, on: false };
});
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.on) { if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 7) dragStart(e); return; }
  dragMove(e);
});
document.addEventListener('pointerup', (e) => {
  if (!drag) return;
  if (!drag.on) { drag = null; return; }
  const hot = drag.hot?.getBoundingClientRect();
  const ok = dropAt(e.clientX, e.clientY);
  dragEnd(ok, ok && hot ? [hot.left + hot.width / 2, hot.top + hot.height / 2] : [e.clientX, e.clientY]);
});
document.addEventListener('pointercancel', () => dragEnd(false));

// ---------- start ----------

// The room around the table.
const POSTERS = ['Oil', 'Livestock', 'Farmland', 'Weapons', 'Workers', 'espionage'];
$('room').innerHTML = `<div class="world"><div class="rplane">
  <div class="floor"></div>
  <div class="wall"><div class="lit"></div>${POSTERS.map((k, i) => `<div class="poster" style="left:calc(var(--u) * ${96 + i * 27})">${art(k)}</div>`).join('')}<div class="wains"></div></div>
  <div class="lamp"><i class="glow"></i><i class="cord"></i><i class="shade"></i><i class="rim"></i></div>
</div></div>`;
// When the deck changes, the posters on the wall are redrawn to match the cards. When the backdrop changes, its
// layers are rebuilt: some hang on the back wall, one stands on the floor in front of it (see backdrops.js).
function drawRoom() {
  document.querySelectorAll('#room .poster').forEach((el, i) => { el.innerHTML = art(POSTERS[i]); });
  const wall = document.querySelector('#room .wall'), plane = document.querySelector('#room .rplane'), bg = document.body.dataset.bg || 'none';
  if (!wall || wall.dataset.bg === bg) return; // same backdrop as before: leave it running
  wall.dataset.bg = bg;
  document.querySelectorAll('#room .bgl, #room .bgfront').forEach((el) => el.remove());
  const set = backdropLayers(bg);
  wall.insertAdjacentHTML('beforeend', set.wall);
  plane.insertAdjacentHTML('beforeend', set.front);
}

// Ask the server for the rules. No server (a plain web page, or ?solo=1 to try that here): load the game into the page.
async function loadRules() {
  if (new URLSearchParams(location.search).get('solo') !== '1') {
    try { const r = await fetch('api/rules'); if (r.ok && /json/.test(r.headers.get('content-type') || '')) return await r.json(); } catch { /* no server here */ }
  }
  local = await import('./game/room.js');
  soloSite = true;
  document.body.classList.add('solo');
  return JSON.parse(JSON.stringify(local.rulesData()));
}
Promise.all([loadRules(), document.fonts?.ready]).then(([d]) => {
  DEF = d;
  $('powerlist').innerHTML = `<table>${Object.entries(d.POWERS).map(([res, pw]) => `<tr><td><b>${pw.name}</b><br><i>${typeLabel(res)}</i></td><td>${pw.text}</td></tr>`).join('')}</table>`;
  $('cardlist').innerHTML = `<table>${Object.values(d.CARDS).map((c) => `<tr><td><b>${c.name}</b><br><i>${c.kind === 'boost' ? 'Boost' : 'Action'}</i></td><td style="white-space:nowrap">${costPips(c.cost) || 'Free'}</td><td>${c.text}</td></tr>`).join('')}</table>`;
  // A link ending in &watch=1 opens straight into spectator view (handy for a TV's browser).
  const q = new URLSearchParams(location.search);
  if (!session && q.get('watch') === '1' && /^[A-Za-z]{4}$/.test(q.get('room') || '')) {
    const code = q.get('room').toUpperCase();
    (wantsNet() || local ? joinNet(code, 'watch') : post('watch', { code })).then((out) => { if (out.token) { if (!remote) enter(out); } else { if (out.error && (wantsNet() || local)) toast(out.error); render(); } });
    return;
  }
  if (session?.net) { // this page was a guest in an online game and was reloaded: go back to the same seat
    render();
    let link;
    joinRoom(session.code, () => lostHost(link)()).then((l) => { link = l; remote = l; connect(); }).catch(() => leaveGame());
    return;
  }
  if (session) connect(); else render();
});
