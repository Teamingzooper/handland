// Handland rules engine. Pure game logic: no networking, no timers.
// The server owns one state object per room and feeds it actions.

export const TYPES = ['Oil', 'Livestock', 'Farmland', 'Weapons', 'Workers'];

export const RULES = {
  baseSlots: 5,
  baseHand: 3,
  heatCap: 5,
  coverCap: 3,
  copiesPerType: 14,
  extraDraw: 0, // extra resources drawn each turn after refilling empty slots (0 keeps trading the main way to improve)
  playDraw: 1, // action/boost cards drawn each turn
  winTarget: 2, // banked monopolies needed to win
};

// `text` is the full rule (shown when you hover a card and on the rules page); `short` is what fits on the card itself.
export const CARDS = {
  espionage: {
    name: 'Espionage', kind: 'action', cost: [], copies: 5,
    short: 'Look at one face-down resource.',
    text: 'Secretly look at one face-down resource card. Free. Can also be used to peek at a card offered to you in a trade.',
  },
  lawsuit: {
    name: 'Lawsuit', kind: 'action', cost: [], copies: 3,
    short: 'Play with a call. If right, take 1 more card.',
    text: 'Play together with a call-out. If you are right, you also take one extra resource from the liar. Free.',
  },
  writeoff: {
    name: 'Write-Off', kind: 'action', cost: [], copies: 12,
    short: 'Discard up to 3 from your right. Draw as many.',
    text: 'Discard up to 3 of your resources, starting from the right end of your row, and draw that many new ones. Free.',
  },
  tip: {
    name: 'Insider Tip', kind: 'action', cost: [], copies: 4,
    short: 'Draw 2 cards. Keep 1.',
    text: 'Draw 2 Action or Boost cards, look at them, keep one and discard the other. Free.',
  },
  alibi: {
    name: 'Alibi', kind: 'action', cost: [], copies: 3,
    short: 'When you are called out: cancel it.',
    text: 'Not played on your turn. When someone calls your trade card or your payment, or blows the whistle on you, play this to cancel it: nothing is turned over and nobody takes a penalty. Free.',
  },
  audit: {
    name: 'Audit', kind: 'action', cost: ['Workers'], copies: 4,
    short: 'Look at 3 of a player\'s cards.',
    text: 'Look at up to three of one player\'s face-down resources, starting with ones you have not seen. Only you see them.',
  },
  injunction: {
    name: 'Injunction', kind: 'action', cost: ['Oil'], copies: 4,
    short: 'A player cannot score next turn.',
    text: 'Pick a player. A monopoly they are holding cannot score at the start of their next turn. They keep the cards, so they can still score a round later if nobody breaks it up.',
  },
  forcedTrade: {
    name: 'Forced Trade', kind: 'action', cost: ['Weapons'], copies: 8,
    short: 'Steal one resource from a player.',
    text: 'Steal one of another player\'s resources. They cannot refuse and get nothing back.',
  },
  whistleblower: {
    name: 'Whistleblower', kind: 'action', cost: [], copies: 6,
    short: 'Any time: accuse a player of having five of a kind. Right: take 2.',
    text: 'Play at any time, even when it is not your turn. Accuse a player of having five of a kind right now. If you are right, you see their cards and take two of them for yourself. If you are wrong, you take the same penalty as a wrong call: lose 1 Cover, or gain 1 Heat. Free.',
  },
  strike: {
    name: 'Strike', kind: 'action', cost: ['Workers'], copies: 5,
    short: 'Remove a player\'s Boost.',
    text: 'Remove one of another player\'s Boost cards, including a Duplicator tucked under a card.',
  },
  bribe: {
    name: 'Bribe', kind: 'action', cost: ['Workers'], copies: 4,
    short: 'Lose 1 Heat, or gain 1 Cover.',
    text: 'Remove 1 of your Heat. If you have no Heat, gain 1 Cover instead.',
  },
  warehouse: {
    name: 'Warehouse', kind: 'boost', cost: ['Farmland'], copies: 4,
    short: '+1 resource slot.',
    text: 'Stays in play. +1 resource slot (+2 if Expanded).',
  },
  expansion: {
    name: 'Expansion', kind: 'boost', cost: ['Oil'], copies: 2,
    short: '+1 to one of your Boosts. No Boost? Draw 2 cards.',
    text: 'Attach to one of your other Boosts to add +1 to its effect. One per Boost. If you have no Boost that can take it, you draw 2 cards instead.',
  },
  duplicator: {
    name: 'Duplicator', kind: 'boost', cost: ['Livestock'], copies: 4,
    short: 'One resource counts as 2.',
    text: 'Tuck it under one of your resources: that card counts as 2 (3 if Expanded). If another player takes or destroys that card, you move the Duplicator under another of your resources. If you give the card up yourself, the Duplicator goes with it. A Strike destroys it.',
  },
  front: {
    name: 'Front Company', kind: 'boost', cost: ['Weapons'], copies: 2,
    short: 'Hide 1 card from your Heat.',
    text: 'Stays in play. Hides 1 card that your Heat would reveal (2 if Expanded).',
  },
};

// ---------- small helpers ----------

function rnd(s) {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function randInt(s, n) { return Math.floor(rnd(s) * n); }
export function chance(s, p) { return rnd(s) < p; }
function shuffle(s, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function log(s, text, to = null) {
  s.log.push({ n: ++s.logN, t: text, to });
  if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
}
const nm = (s, pid) => s.players[pid].name;
// Moments the screen should react to (sound, particles). `to` limits who hears about it.
function fx(s, type, data = {}, to = null) {
  s.fx.push({ n: ++s.fxN, type, ...data, to });
  if (s.fx.length > 60) s.fx.shift();
}

function drawRes(s) {
  if (!s.resDeck.length && s.resDiscard.length) { s.resDeck = shuffle(s, s.resDiscard); s.resDiscard = []; }
  const type = s.resDeck.length ? s.resDeck.pop() : TYPES[randInt(s, TYPES.length)];
  return { id: s.nextId++, type };
}
function drawPlay(s) {
  if (!s.playDeck.length && s.playDiscard.length) { s.playDeck = shuffle(s, s.playDiscard); s.playDiscard = []; }
  const keys = Object.keys(CARDS).filter((k) => !s.without?.includes(k));
  const kind = s.playDeck.length ? s.playDeck.pop() : keys[randInt(s, keys.length)];
  return { id: s.nextId++, kind };
}

const boostPower = (b) => 1 + (b.expanded ? 1 : 0);

export function slotLimit(p) {
  let n = RULES.baseSlots;
  for (const b of p.boosts) if (b.kind === 'warehouse') n += boostPower(b);
  return n;
}
export function handLimit() {
  return RULES.baseHand;
}
export function shownHeat(p) {
  let h = p.heat;
  for (const b of p.boosts) if (b.kind === 'front') h -= boostPower(b);
  return Math.max(0, h);
}
export function cardWorth(p, card) {
  const d = p.boosts.find((b) => b.kind === 'duplicator' && b.on === card.id);
  return 1 + (d ? boostPower(d) : 0);
}
export function countType(p, type) {
  let n = 0;
  for (const c of p.res) if (c.type === type) n += cardWorth(p, c);
  return n;
}
export function isFaceUp(p, idx) {
  return placeOf(p, idx) < shownHeat(p); // a card out in a trade still holds its place, so nothing else turns over meanwhile
}

// Three ways to come to know a card:
//   learn   you looked at it yourself with a card of yours (Espionage, Audit, a right Whistleblower)
//   witness it was turned over for the whole table (a call, a scored monopoly)
//   recall  it passed through your own hands (you traded it away, it was taken from you)
// Rows are never rearranged, so a card seen once can be followed for as long as it lies face down. Whether the game
// does that remembering for you is a game setting, `s.marks`:
//   'all'   every card you have come to know keeps a small mark on screen (the default)
//   'looks' only cards you looked at yourself are marked; the rest is up to your own memory
//   'none'  nothing is marked: remember it yourself, as at a real table
// `known` is what gets marked for a seat; `mem` is everything it has ever seen, kept for the Insane bots, which never forget.
function learn(s, pid, card) { const p = s.players[pid]; p.known[card.id] = card.type; p.mem[card.id] = card.type; }
function recall(s, pid, card) { const p = s.players[pid]; p.mem[card.id] = card.type; if (s.marks === 'all') p.known[card.id] = card.type; }
function witness(s, card) { card.pub = true; for (const p of s.players) recall(s, p.id, card); } // pub: the whole table has seen this card

// ---------- a card's place in the row ----------
// Rows are never rearranged. A card put into a trade is only out for the moment: its place stays empty (`p.gaps` lists
// the empty places, counted from the left) and it goes back there if the trade falls through.
const placeOf = (p, i) => { let at = i; for (const g of p.gaps) if (g <= at) at++; return at; };
// Take a resource card out of a player's row for good. `taken` = another player took or destroyed it (a steal, a
// Stampede, a burn): then a Duplicator under it comes loose and its owner moves it. If the owner gave the card up
// (paid with it, traded it, discarded it, scored it) the Duplicator goes with the card.
function takeRes(s, p, id, taken = false) {
  const i = p.res.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const at = placeOf(p, i);
  const [card] = p.res.splice(i, 1);
  p.gaps = p.gaps.map((g) => (g > at ? g - 1 : g)); // the row closes up; the empty places keep their neighbours
  dropDuplicator(s, p, id, taken);
  return card;
}
function dropDuplicator(s, p, id, taken) {
  const d = p.boosts.findIndex((b) => b.kind === 'duplicator' && b.on === id);
  if (d < 0) return;
  if (taken) { p.boosts[d].on = null; log(s, `${p.name}'s Duplicator comes loose.`); return; } // settleLoose() asks its owner where it goes
  const [b] = p.boosts.splice(d, 1);
  s.playDiscard.push('duplicator');
  if (b.expanded) s.playDiscard.push('expansion');
  log(s, `${p.name}'s Duplicator goes with the card.`);
}
// Out of the row for the moment (into a trade): the place is kept, and so is a Duplicator under it.
function lift(p, id) {
  const i = p.res.findIndex((c) => c.id === id), at = placeOf(p, i);
  const [card] = p.res.splice(i, 1);
  p.gaps = [...p.gaps, at].sort((a, b) => a - b);
  card.home = { pid: p.id, at };
  return card;
}
// The trade fell through: back to the place it came from.
function putBack(s, card) {
  const p = s.players[card.home.pid], at = card.home.at;
  p.gaps = p.gaps.filter((g, k) => k !== p.gaps.indexOf(at));
  p.res.splice(Math.min(p.res.length, at - p.gaps.filter((g) => g < at).length), 0, card);
  delete card.home;
}
// The trade went through (or the card was lost in a call): it is not coming back, so its place closes up.
function release(s, card) {
  const p = s.players[card.home.pid], at = card.home.at;
  p.gaps = p.gaps.filter((g, k) => k !== p.gaps.indexOf(at)).map((g) => (g > at ? g - 1 : g));
  dropDuplicator(s, p, card.id, false);
  delete card.home;
  return card;
}
// A Duplicator that came loose: its owner tucks it under another of their resources (their choice). With no resource
// to put it under, it is discarded. Asked after whatever was happening, which then carries on.
function settleLoose(s) {
  if (s.phase === 'over' || s.pending?.kind === 'dup') return;
  for (const p of s.players) {
    const b = p.boosts.find((x) => x.kind === 'duplicator' && x.on === null);
    if (!b) continue;
    if (!p.res.some((c) => !p.boosts.some((x) => x.kind === 'duplicator' && x.on === c.id))) {
      p.boosts.splice(p.boosts.indexOf(b), 1);
      s.playDiscard.push('duplicator');
      if (b.expanded) s.playDiscard.push('expansion');
      log(s, `${p.name} has no card to put the Duplicator under. It is discarded.`);
      continue;
    }
    s.pending = { kind: 'dup', n: ++s.pendingN, player: p.id, boostId: b.id, prev: s.pending };
    return;
  }
}

// ---------- tells: how someone has been playing, as the whole table can see it ----------
// Nothing hidden is kept here: only what was said or done in the open (offers, calls, passes, quiet turns), the
// same things a person at a real table would notice. Bots read it (bots.js) to guess who is sitting on a monopoly.
//   turns / offers: turns taken, and how many of them included a trade offer
//   calls / passes: call-outs made, and chances to call or trade that were let go
//   quiet: how many chances in a row were let go, up to now
//   still: how many of their own turns in a row went by with no offer and nothing spent
//   asks / gave: how often they asked for each resource, and how often they said they were giving each one up
//   fresh: the turn number when they last scored (their row is new cards after that)
function newTell() { return { turns: 0, offers: 0, calls: 0, passes: 0, quiet: 0, still: 0, busy: false, asks: {}, gave: {}, fresh: 0 }; }
const bump = (tally, type) => { tally[type] = (tally[type] || 0) + 1; };
const letGo = (p) => { p.tell.passes++; p.tell.quiet++; };
const spoke = (p) => { p.tell.calls++; p.tell.quiet = 0; };

// ---------- monopoly powers ----------
// Scoring a monopoly lets its owner use that resource's power once, straight away, before anything else that turn.
// It is free (so there is nothing to call) and optional. `target` marks the ones that are aimed at one player.
export const POWERS = {
  Oil: { name: 'Fracking', text: 'Draw 2 extra Action or Boost cards.' },
  Livestock: { name: 'Stampede', text: 'Every other player discards the rightmost card of their row and draws a new one.' },
  Farmland: { name: 'Harvest', text: 'Look at the top 3 resource cards. Put one in your row and the other two back on top in any order.' },
  Weapons: { name: 'Shakedown', text: 'Take one resource from a player of your choice, unseen.', target: true },
  Workers: { name: 'Boycott', text: 'Pick a player. They cannot play Action cards on their next turn.', target: true },
};

function checkMonopolies(s) {
  for (const p of s.players) {
    // A hold is secret, so only its owner hears that it broke.
    if (p.holding && countType(p, p.holding) < 5) {
      log(s, `Your ${p.holding} monopoly was broken before it could score.`, p.id);
      fx(s, 'broken', { p: p.id }, p.id);
      p.holding = null;
    }
  }
}

// ---------- setup ----------

// difficulty: 0 easy, 1 normal, 2 hard, 3 insane (how sharp the bots are). without: card kinds left out of the deck.
export function newGame({ names, bots = [], seed = Date.now() & 0x7fffffff, winTarget = RULES.winTarget, difficulty = 1, without = [], marks = 'all' }) {
  const s = {
    marks: ['all', 'looks', 'none'].includes(marks) ? marks : 'all',
    rng: seed | 0, nextId: 1, logN: 0, log: [], fx: [], fxN: 0,
    players: [], turn: 0, turnNumber: 0, phase: 'main', winner: null, winTarget,
    pending: null, pendingN: 0, reveal: null, revealN: 0,
    resDeck: [], resDiscard: [], playDeck: [], playDiscard: [],
    stats: { calls: 0, rightCalls: 0, trades: 0, plays: 0, lies: 0 },
  };
  for (const t of TYPES) for (let i = 0; i < RULES.copiesPerType; i++) s.resDeck.push(t);
  s.without = without.filter((k) => CARDS[k]);
  for (const [k, def] of Object.entries(CARDS)) if (!s.without.includes(k)) for (let i = 0; i < def.copies; i++) s.playDeck.push(k);
  shuffle(s, s.resDeck); shuffle(s, s.playDeck);
  names.forEach((name, id) => {
    const p = {
      id, name, isBot: !!bots[id], res: [], hand: [], boosts: [], heat: 0, cover: 0,
      banked: [], holding: null, enjoined: false, stats: { lies: 0, caught: 0, right: 0, wrong: 0 }, traded: false, known: {}, mem: {}, gaps: [], rowSig: '', caught: 0, cleared: 0, tell: newTell(),
      bot: { liar: (0.25 + rnd(s) * 0.4) * [0.7, 1, 1, 0.9][difficulty], sus: (0.7 + rnd(s) * 0.8) * [0.45, 1, 1.2, 1.3][difficulty], skill: difficulty },
    };
    for (let i = 0; i < RULES.baseSlots; i++) p.res.push(drawRes(s));
    for (let i = 0; i < RULES.baseHand; i++) p.hand.push(drawPlay(s));
    s.players.push(p);
  });
  s.turn = randInt(s, names.length);
  log(s, `The game begins. First to ${winTarget} Monopoly token${winTarget === 1 ? '' : 's'} wins.`);
  startTurn(s);
  return s;
}

function startTurn(s) {
  const p = s.players[s.turn];
  s.turnNumber++;
  p.traded = false;
  p.tell.busy = false;
  if (p.enjoined) {
    // An Injunction: whatever they hold cannot score this turn. The table is not told whether there was anything to stop.
    if (p.holding) log(s, `The Injunction stops your ${p.holding} monopoly from scoring this turn. Keep all five and it can score next round.`, p.id);
    log(s, `The Injunction on ${p.name} runs out.`);
    p.enjoined = false;
  } else if (p.holding) bankMonopoly(s, p);
  if (s.phase === 'over') return;
  while (p.res.length < slotLimit(p)) p.res.push(drawRes(s));
  for (let i = 0; i < RULES.extraDraw; i++) p.res.push(drawRes(s));
  for (let i = 0; i < RULES.playDraw; i++) p.hand.push(drawPlay(s));
  log(s, `— ${p.name}'s turn —`);
  fx(s, 'turn', { p: p.id });
}

function bankMonopoly(s, p) {
  const type = p.holding;
  // Bank the fewest cards that still add up to 5, most valuable first.
  const cards = p.res.filter((c) => c.type === type).sort((a, b) => cardWorth(p, b) - cardWorth(p, a));
  let total = 0;
  for (const c of cards) {
    if (total >= 5) break;
    total += cardWorth(p, c);
    s.resDiscard.push(takeRes(s, p, c.id).type);
  }
  p.holding = null;
  p.tell.fresh = s.turnNumber; p.tell.still = 0; p.tell.quiet = 0; p.tell.asks = {}; // a new row of cards: old habits say nothing about it
  p.banked.push(type);
  p.res.forEach((c) => witness(s, c)); // scoring means showing your whole hand
  fx(s, 'token', { p: p.id, resType: type });
  log(s, `${p.name} reveals a MONOPOLY on ${type}, held for a full round, and scores a token! (${p.banked.length}/${s.winTarget})`);
  if (p.banked.length >= s.winTarget) {
    s.phase = 'over';
    s.winner = p.id;
    s.pending = null;
    log(s, `${p.name} wins the game!`);
    fx(s, 'win', { p: p.id });
    return;
  }
  // The power of the resource just scored: theirs to use now or give up.
  s.pending = { kind: 'power', n: ++s.pendingN, player: p.id, res: type };
}

// ---------- call-outs ----------

function rightCall(s, p) {
  if (p.heat > 0) p.heat--;
  else p.cover = Math.min(RULES.coverCap, p.cover + 1);
}
// Wrong call: spend a Cover; with none, gain a Heat; already at the most Heat there is, lose the leftmost card instead.
function wrongCall(s, p) {
  if (p.cover > 0) p.cover--;
  else if (p.heat < RULES.heatCap) p.heat++;
  else if (p.res.length) {
    const c = takeRes(s, p, p.res[0].id, true);
    s.resDiscard.push(c.type);
    log(s, `${p.name} is already at ${RULES.heatCap} Heat: their leftmost card, ${c.type}, is destroyed.`);
    fx(s, 'burn', { p: p.id, resType: c.type });
  }
}

// Returns true when the accused lied. `shown` is the card flipped for the table.
function resolveCall(s, callerId, accusedId, lie, shown, claim, useLawsuit, what) {
  const caller = s.players[callerId], accused = s.players[accusedId];
  s.stats.calls++;
  if (useLawsuit) {
    const i = caller.hand.findIndex((c) => c.kind === 'lawsuit');
    caller.hand.splice(i, 1);
    s.playDiscard.push('lawsuit');
  }
  let lawsuitCard = null;
  if (lie) {
    s.stats.rightCalls++;
    accused.caught++; accused.stats.caught++; caller.stats.right++;
    rightCall(s, caller);
    log(s, `${caller.name} calls ${accused.name}'s ${what} — it's a LIE! Said ${claim}, was ${shown.type}.`);
    if (useLawsuit && accused.res.length) {
      lawsuitCard = takeRes(s, accused, accused.res[randInt(s, accused.res.length)].id, true);
      caller.res.push(lawsuitCard);
      recall(s, callerId, lawsuitCard);
      log(s, `Lawsuit! ${caller.name} also takes a resource from ${accused.name}.`);
    }
  } else {
    accused.cleared++; caller.stats.wrong++;
    wrongCall(s, caller);
    log(s, `${caller.name} calls ${accused.name}'s ${what} — but it was HONEST (${shown.type}). ${caller.name} takes the penalty.`);
    if (useLawsuit) log(s, `${caller.name}'s Lawsuit is thrown out.`);
  }
  fx(s, 'call', { caller: callerId, accused: accusedId, lie, lawsuit: !!useLawsuit });
  s.reveal = { n: ++s.revealN, caller: callerId, accused: accusedId, lie, type: shown.type, claim, what, lawsuit: !!useLawsuit };
  return lie;
}

// ---------- actions ----------

// Does a payment cover a cost? The order the cards were put down in does not matter: a Weapons + Oil cost is paid by
// one Weapons and one Oil, whichever was laid first. Returns one true/false per paid card (false = that card is a bluff).
export function payCheck(cost, types) {
  const need = [...cost], ok = types.map(() => false);
  const take = (t) => { const i = need.indexOf(t); if (i < 0) return false; need.splice(i, 1); return true; };
  types.forEach((t, i) => { if (cost[i] === t) ok[i] = take(t); });
  types.forEach((t, i) => { if (!ok[i]) ok[i] = take(t); });
  return ok;
}

const hasAlibi = (p) => p.hand.some((c) => c.kind === 'alibi');
export const hasFive = (p) => TYPES.some((ty) => countType(p, ty) >= 5);

// Every call-out, and every Whistleblower, goes through here. If the accused holds an Alibi the game pauses for them
// (they may play it to cancel the call); otherwise the call resolves at once.
// call = { site: 'offer' | 'reply' | 'cost' | 'whistle', caller, accused, lawsuit, stakeId, what }
function raiseCall(s, call) {
  if (hasAlibi(s.players[call.accused])) { s.pending = { kind: 'alibi', n: ++s.pendingN, ...call, under: s.pending }; return; }
  finishCall(s, call);
}
// The call goes ahead. s.pending is whatever was being called (a trade, a payment) or, for a Whistleblower, whatever it interrupted.
function finishCall(s, call) {
  const p = s.players[call.caller], accused = s.players[call.accused];
  if (call.site === 'offer') {
    const t = s.pending;
    s.pending = null;
    witness(s, t.offer);
    const lie = resolveCall(s, p.id, t.from, t.offer.type !== t.offerClaim, t.offer, t.offerClaim, call.lawsuit, 'trade offer');
    if (lie) p.res.push(release(s, t.offer)); // the caller's stake never left its place
    else {
      putBack(s, t.offer); // back where it came from, and the stake joins it
      const stake = takeRes(s, p, call.stakeId);
      if (stake) { accused.res.push(stake); recall(s, accused.id, stake); }
    }
    log(s, `${(lie ? p : accused).name} keeps both cards.`);
  } else if (call.site === 'reply') {
    const t = s.pending;
    s.pending = null;
    witness(s, t.reply);
    const lie = resolveCall(s, p.id, t.to, t.reply.type !== t.replyClaim, t.reply, t.replyClaim, call.lawsuit, 'trade card');
    const winner = lie ? p : accused;
    // the winner's own card goes back to its place; the other one joins the right end of their row
    if (lie) { putBack(s, t.offer); p.res.push(release(s, t.reply)); } else { putBack(s, t.reply); accused.res.push(release(s, t.offer)); recall(s, accused.id, t.offer); }
    log(s, `${winner.name} keeps both cards.`);
  } else if (call.site === 'cost') {
    const c = s.pending, def = CARDS[c.card.kind];
    s.pending = null;
    // Every payment card is turned over and checked, not just the first.
    const okFlags = payCheck(def.cost, c.paid.map((r) => r.type));
    const wrongIdx = okFlags.indexOf(false);
    const lie = wrongIdx >= 0;
    const shownIdx = lie ? wrongIdx : 0;
    c.paid.forEach((r) => witness(s, r));
    resolveCall(s, p.id, c.player, lie, c.paid[shownIdx], def.cost.join(' + '), call.lawsuit, `${def.name} payment`);
    s.reveal.cards = c.paid.map((r, i) => ({ type: r.type, ok: okFlags[i] }));
    s.reveal.cost = def.cost;
    s.playDiscard.push(c.card.kind);
    if (lie) {
      p.res.push(...c.paid);
      log(s, `${accused.name}'s ${def.name} is BUSTED. ${p.name} takes the payment.`);
      fx(s, 'bust', { p: c.player, kind: c.card.kind });
    } else {
      for (const r of c.paid) s.resDiscard.push(r.type);
      // the card was already pushed to discard; resolvePlay must not discard again
      resolvePlay(s, c, true);
    }
  } else { // whistle
    // Right if they have five of a kind at this moment, even one picked up since their last turn ended.
    if (!hasFive(accused)) {
      wrongCall(s, p); // the same penalty as any wrong call: Cover first, otherwise 1 Heat
      p.stats.wrong++;
      log(s, `${p.name} blows the whistle on ${accused.name}, but ${accused.name} does not have five of a kind. ${p.name} takes the penalty.`);
      fx(s, 'whistle', { p: p.id, target: accused.id, right: false, why: call.why });
      return;
    }
    p.stats.right++;
    accused.res.forEach((c) => learn(s, p.id, c));
    log(s, `${p.name} blows the whistle on ${accused.name}, and ${accused.name} DOES have five of a kind! ${p.name} gets to take two of their cards.`);
    fx(s, 'whistle', { p: p.id, target: accused.id, right: true, why: call.why });
    const need = Math.min(2, accused.res.length);
    if (need) s.pending = { kind: 'whistle', n: ++s.pendingN, caller: p.id, accused: accused.id, need, prev: s.pending };
  }
}
// An Alibi was played: the call never happened. Nothing is turned over and nobody takes a penalty.
function cancelCall(s, call) {
  if (call.site === 'offer') ACTIONS.respondTrade(s, call.caller, { choice: 'decline' }); // as if they had said no (an open offer moves on)
  else if (call.site === 'reply') {
    const t = s.pending;
    putBack(s, t.offer); putBack(s, t.reply);
    s.pending = null;
    log(s, 'The trade is called off. Both cards go back.');
  } else if (call.site === 'cost') ACTIONS.costResponse(s, call.caller, { choice: 'pass' }); // as if they had let it through
  // a cancelled Whistleblower: the card is spent and nothing else happens
}

class Bad extends Error {}
const bad = (m) => { throw new Bad(m); };

export function applyAction(s, pid, a) {
  try {
    if (s.phase === 'over') bad('The game is over.');
    const fn = ACTIONS[a?.type];
    if (!fn) bad('Unknown action.');
    fn(s, pid, a);
    settleLoose(s);
    checkMonopolies(s);
    return { ok: true };
  } catch (e) {
    if (e instanceof Bad) return { error: e.message };
    throw e;
  }
}

function myFreeTurn(s, pid) {
  if (s.turn !== pid) bad('It is not your turn.');
  if (s.pending) bad('Wait for the current play to finish.');
  return s.players[pid];
}
const isType = (t) => TYPES.includes(t);
const hasLawsuit = (p) => p.hand.some((c) => c.kind === 'lawsuit');

const ACTIONS = {
  offerTrade(s, pid, a) {
    const p = myFreeTurn(s, pid);
    if (p.traded) bad('You already offered a trade this turn.');
    // An open offer goes round the table clockwise from the offerer's left. The first player to answer gets the trade;
    // each one may trade, call it a scam, or pass it on. (Turn order, not speed, so it plays the same at a real table.)
    const open = a.to === 'open';
    const queue = open ? s.players.map((_, i) => (pid + 1 + i) % s.players.length).filter((id) => id !== pid && s.players[id].res.length) : [];
    if (open && !queue.length) bad('Nobody else has a card to trade.');
    const to = s.players[open ? queue.shift() : a.to];
    if (!to || to.id === pid) bad('Pick another player.');
    if (!to.res.length) bad('That player has no resources.');
    if (!isType(a.claim) || !isType(a.ask)) bad('Pick resource types.');
    if (!p.res.some((c) => c.id === a.cardId)) bad('Pick one of your resources.');
    const offer = lift(p, a.cardId);
    p.traded = true;
    p.tell.offers++; p.tell.busy = true; p.tell.quiet = 0; bump(p.tell.asks, a.ask); bump(p.tell.gave, a.claim);
    s.stats.trades++;
    if (offer.type !== a.claim) { s.stats.lies++; p.stats.lies++; }
    s.pending = { kind: 'trade', n: ++s.pendingN, from: pid, to: to.id, open, queue, offer, offerClaim: a.claim, ask: a.ask, stage: 'response', reply: null, replyClaim: null };
    fx(s, 'offer', { p: pid, target: to.id, open, claim: a.claim, ask: a.ask });
    log(s, open ? `${p.name} makes an open offer to the table: a card they say is ${a.claim}, for ${a.ask}. ${to.name} answers first.` : `${p.name} offers ${to.name} a card, says it's ${a.claim}, wants ${a.ask}.`);
  },

  respondTrade(s, pid, a) {
    const t = s.pending;
    if (!t || t.kind !== 'trade' || t.stage !== 'response' || t.to !== pid) bad('Nothing to respond to.');
    const p = s.players[pid], from = s.players[t.from];
    if (a.choice === 'decline' && t.open) {
      // pass the open offer to the next player who still has a card to trade
      const next = t.queue.find((id) => s.players[id].res.length);
      letGo(p);
      fx(s, 'decline', { p: pid, open: true });
      if (next !== undefined) {
        t.queue = t.queue.slice(t.queue.indexOf(next) + 1);
        t.to = next; t.n = ++s.pendingN;
        log(s, `${p.name} passes on the open offer. ${s.players[next].name} is next.`);
        return;
      }
      putBack(s, t.offer);
      s.pending = null;
      log(s, `Nobody takes ${from.name}'s open offer. The card goes back.`);
      return;
    }
    if (a.choice === 'decline') {
      letGo(p);
      putBack(s, t.offer);
      s.pending = null;
      log(s, `${p.name} declines the trade.`);
      fx(s, 'decline', { p: pid });
      return;
    }
    if (a.choice !== 'trade' && a.choice !== 'call') bad('Unknown choice.');
    if (!p.res.some((c) => c.id === a.cardId)) bad('Pick one of your resources to put down.');
    if (a.choice === 'trade') {
      if (!isType(a.claim)) bad('Say what your card is.');
      t.reply = lift(p, a.cardId);
      t.replyClaim = a.claim;
      p.tell.quiet = 0; bump(p.tell.gave, a.claim);
      t.stage = 'decision';
      t.n = ++s.pendingN;
      if (t.reply.type !== a.claim) { s.stats.lies++; p.stats.lies++; }
      log(s, `${p.name} puts down a card, says it's ${a.claim}.`);
      fx(s, 'reply', { p: pid, claim: a.claim });
      return;
    }
    if (a.lawsuit && !hasLawsuit(p)) bad('You have no Lawsuit.');
    spoke(p);
    raiseCall(s, { site: 'offer', caller: pid, accused: t.from, stakeId: a.cardId, lawsuit: !!a.lawsuit, what: 'trade offer' });
  },

  finishTrade(s, pid, a) {
    const t = s.pending;
    if (!t || t.kind !== 'trade' || t.stage !== 'decision' || t.from !== pid) bad('Nothing to decide.');
    const p = s.players[pid], to = s.players[t.to];
    if (a.choice === 'cancel') {
      // They changed the terms: you asked for one thing and they say they are giving another. You may call it off.
      if (t.replyClaim === t.ask) bad('They offered what you asked for: swap, or call it.');
      s.pending = null;
      putBack(s, t.offer); putBack(s, t.reply);
      log(s, `${p.name} calls the trade off. Both cards go back.`);
      fx(s, 'calloff', { p: pid, target: to.id });
      return;
    }
    if (a.choice === 'accept') {
      s.pending = null;
      p.res.push(release(s, t.reply)); to.res.push(release(s, t.offer));
      recall(s, pid, t.reply); recall(s, pid, t.offer);
      recall(s, to.id, t.offer); recall(s, to.id, t.reply);
      log(s, `${p.name} and ${to.name} swap cards.`);
      fx(s, 'swap', { p: pid, target: to.id });
      if (t.reply.type !== t.replyClaim) fx(s, 'scammed', { p: pid }, pid);
      if (t.offer.type !== t.offerClaim) fx(s, 'scammed', { p: to.id }, to.id);
      if (t.reply.type !== t.replyClaim) log(s, `You got scammed: ${to.name} said ${t.replyClaim} but gave you ${t.reply.type}.`, pid);
      if (t.offer.type !== t.offerClaim) log(s, `You got scammed: ${p.name} said ${t.offerClaim} but gave you ${t.offer.type}.`, to.id);
      return;
    }
    if (a.choice !== 'call') bad('Unknown choice.');
    if (a.lawsuit && !hasLawsuit(p)) bad('You have no Lawsuit.');
    spoke(p);
    raiseCall(s, { site: 'reply', caller: pid, accused: t.to, lawsuit: !!a.lawsuit, what: 'trade card' });
  },

  // Espionage used as a reaction: peek at the card the other side put down.
  peekTrade(s, pid) {
    const t = s.pending;
    if (!t || t.kind !== 'trade') bad('No trade to peek at.');
    const p = s.players[pid];
    const card = t.stage === 'response' && t.to === pid ? t.offer : t.stage === 'decision' && t.from === pid ? t.reply : null;
    if (!card) bad('You cannot peek right now.');
    const i = p.hand.findIndex((c) => c.kind === 'espionage');
    if (i < 0) bad('You have no Espionage.');
    p.hand.splice(i, 1);
    s.playDiscard.push('espionage');
    learn(s, pid, card);
    if (card === t.offer) t.seenOffer = pid; else t.seenReply = true; // an open offer moves on: only the player who peeked has seen it
    log(s, `${p.name} uses Espionage on the trade.`);
    fx(s, 'peek', { p: pid });
    log(s, `You peek: the card is really ${card.type}.`, pid);
  },

  // Whistleblower: the one card that can be played at any moment, by anyone.
  whistle(s, pid, a) {
    const p = s.players[pid], t = s.players[a.target];
    if (!p) bad('You are not in this game.');
    const i = p.hand.findIndex((c) => c.kind === 'whistleblower');
    if (i < 0) bad('You have no Whistleblower.');
    if (['whistle', 'alibi', 'tip', 'power', 'dup'].includes(s.pending?.kind)) bad('Wait a moment for the current card to finish.');
    if (!t || t.id === pid) bad('Pick another player to accuse.');
    p.hand.splice(i, 1);
    s.playDiscard.push('whistleblower');
    s.stats.plays++;
    spoke(p);
    raiseCall(s, { site: 'whistle', why: a.why === 'quiet' ? 'quiet' : undefined, caller: pid, accused: t.id, what: 'Whistleblower' });
  },

  // The accused answers a call: play the Alibi, or let the call go ahead.
  alibiResponse(s, pid, a) {
    const w = s.pending;
    if (!w || w.kind !== 'alibi' || w.accused !== pid) bad('Nothing to answer.');
    const p = s.players[pid], i = p.hand.findIndex((c) => c.kind === 'alibi');
    if (a.use && i < 0) bad('You have no Alibi.');
    s.pending = w.under || null; // back to what was being called
    if (s.pending) s.pending.n = ++s.pendingN;
    if (!a.use) { finishCall(s, w); return; }
    p.hand.splice(i, 1);
    s.playDiscard.push('alibi');
    s.stats.plays++;
    log(s, `${p.name} has an Alibi. ${s.players[w.caller].name}'s call on the ${w.what} is cancelled.`);
    fx(s, 'alibi', { p: pid, target: w.caller });
    cancelCall(s, w);
  },

  // The power that comes with a scored monopoly (see POWERS). { use: false } gives it up.
  power(s, pid, a) {
    const w = s.pending;
    if (!w || w.kind !== 'power' || w.player !== pid) bad('Nothing to use.');
    const p = s.players[pid], def = POWERS[w.res];
    if (w.cards) { // Harvest, second step: keep one, put the other two back
      const keep = w.cards.find((c) => c.id === a.keep);
      if (!keep) bad('Pick one of the three cards to keep.');
      const rest = w.cards.filter((c) => c !== keep);
      if (a.top === rest[0].id) rest.reverse(); // the deck is drawn from its end, so the card named `top` goes back last
      for (const c of rest) s.resDeck.push(c.type);
      p.res.push(keep);
      s.pending = null;
      log(s, `${p.name} keeps one card from the Harvest and puts two back.`);
      return;
    }
    if (!a.use) { s.pending = null; log(s, `${p.name} does not use ${def.name}.`); return; }
    const others = s.players.filter((o) => o.id !== pid);
    const t = def.target ? s.players[a.target] : null;
    if (def.target && (!t || t.id === pid)) bad('Pick another player.');
    if (w.res === 'Oil') {
      for (let i = 0; i < 2; i++) p.hand.push(drawPlay(s));
      log(s, `${p.name} uses Fracking and draws 2 cards.`);
    } else if (w.res === 'Livestock') {
      for (const o of others) {
        if (!o.res.length) continue;
        s.resDiscard.push(takeRes(s, o, o.res[o.res.length - 1].id, true).type);
        o.res.push(drawRes(s));
      }
      log(s, `${p.name} starts a Stampede: everyone else loses their rightmost card and draws a new one.`);
    } else if (w.res === 'Farmland') {
      w.cards = [drawRes(s), drawRes(s), drawRes(s)];
      w.n = ++s.pendingN;
      log(s, `${p.name} brings in the Harvest: three cards to look at, one to keep.`);
      fx(s, 'power', { p: pid, res: w.res });
      return;
    } else if (w.res === 'Weapons') {
      if (!t.res.length) bad('That player has no resources.');
      const c = takeRes(s, t, t.res.some((r) => r.id === a.resId) ? a.resId : t.res[randInt(s, t.res.length)].id, true);
      p.res.push(c); recall(s, pid, c);
      log(s, `${p.name} shakes down ${t.name} and takes a card.`);
    } else {
      t.boycott = true;
      log(s, `${p.name} calls a Boycott on ${t.name}: no Action cards for them next turn.`);
    }
    s.pending = null;
    fx(s, 'power', { p: pid, res: w.res, target: t?.id });
  },

  // A Duplicator that came loose goes under another of its owner's resources.
  moveDup(s, pid, a) {
    const w = s.pending;
    if (!w || w.kind !== 'dup' || w.player !== pid) bad('Nothing to move.');
    const p = s.players[pid], b = p.boosts.find((x) => x.id === w.boostId);
    const c = p.res.find((x) => x.id === a.resId);
    if (!c) bad('Pick one of your resources.');
    if (p.boosts.some((x) => x.kind === 'duplicator' && x.on === c.id)) bad('That card already has a Duplicator.');
    b.on = c.id;
    s.pending = w.prev || null; // carry on with whatever was happening
    if (s.pending) s.pending.n = ++s.pendingN;
    log(s, `${p.name} moves the Duplicator under another card.`);
    fx(s, 'dupmove', { p: pid });
  },

  // Insider Tip: keep one of the two cards drawn.
  tipPick(s, pid, a) {
    const w = s.pending;
    if (!w || w.kind !== 'tip' || w.player !== pid) bad('Nothing to pick.');
    const keep = w.cards.find((c) => c.id === a.keep);
    if (!keep) bad('Pick one of the two cards.');
    const p = s.players[pid];
    p.hand.push(keep);
    for (const c of w.cards) if (c !== keep) s.playDiscard.push(c.kind);
    s.pending = null;
    log(s, `${p.name} keeps one card from the Insider Tip.`);
  },

  whistlePick(s, pid, a) {
    const w = s.pending;
    if (!w || w.kind !== 'whistle' || w.caller !== pid) bad('Nothing to pick.');
    const t = s.players[w.accused], ids = [...new Set(a.resIds || [])];
    if (ids.length !== w.need || ids.some((id) => !t.res.some((c) => c.id === id))) bad(`Pick ${w.need} of ${t.name}'s cards.`);
    const p = s.players[pid];
    for (const id of ids) { const c = takeRes(s, t, id, true); p.res.push(c); recall(s, pid, c); }
    log(s, `${p.name} takes ${ids.length} of ${t.name}'s cards.`);
    fx(s, 'whistled', { p: pid, target: t.id });
    // carry on with whatever was happening when the whistle blew
    s.pending = w.prev || null;
    if (s.pending) s.pending.n = ++s.pendingN;
  },

  playCard(s, pid, a) {
    if (s.players[pid]?.hand.find((c) => c.id === a.cardId)?.kind === 'whistleblower') return ACTIONS.whistle(s, pid, a);
    const p = myFreeTurn(s, pid);
    const card = p.hand.find((c) => c.id === a.cardId);
    if (!card) bad('That card is not in your hand.');
    const def = CARDS[card.kind];
    if (card.kind === 'lawsuit') bad('Lawsuit is played together with a call-out.');
    if (card.kind === 'alibi') bad('Alibi is played when someone calls you out.');
    if (p.boycott && def.kind === 'action') bad('You are being boycotted: no Action cards this turn.');
    const payment = a.payment || [];
    if (payment.length !== def.cost.length || new Set(payment).size !== payment.length) bad(`Pick ${def.cost.length} resource card(s) to pay with.`);
    if (payment.some((id) => !p.res.some((c) => c.id === id))) bad('Pay with your own resources.');
    const x = validatePlay(s, p, card.kind, a, payment);
    // commit
    p.hand.splice(p.hand.indexOf(card), 1);
    const paid = payment.map((id) => takeRes(s, p, id));
    if (def.cost.length || card.kind === 'writeoff') { p.tell.busy = true; p.tell.quiet = 0; for (const t of def.cost) bump(p.tell.gave, t); }
    s.stats.plays++;
    const lying = payCheck(def.cost, paid.map((c) => c.type)).includes(false);
    if (lying) { s.stats.lies++; p.stats.lies++; }
    const play = { player: pid, card, paid, x };
    fx(s, 'play', { p: pid, kind: card.kind, target: x.target });
    if (!def.cost.length) {
      log(s, `${p.name} plays ${def.name}${describeTarget(s, card.kind, x)}.`);
      resolvePlay(s, play);
      return;
    }
    log(s, `${p.name} plays ${def.name}${describeTarget(s, card.kind, x)}, paying "${def.cost.join(' + ')}".`);
    s.pending = { kind: 'cost', n: ++s.pendingN, ...play, waiting: s.players.map((_, i) => (pid + 1 + i) % s.players.length).filter((id) => id !== pid) };
  },

  costResponse(s, pid, a) {
    const c = s.pending;
    // Calls go clockwise from the payer's left, one player at a time (seat order, not speed, so it plays the same at a real table).
    if (!c || c.kind !== 'cost' || !c.waiting.includes(pid)) bad('Nothing to respond to.');
    if (c.waiting[0] !== pid) bad('Wait for your turn to pass or call.');
    const p = s.players[pid], def = CARDS[c.card.kind];
    if (a.choice === 'pass') {
      letGo(p);
      c.waiting = c.waiting.filter((id) => id !== pid);
      c.n = ++s.pendingN;
      if (!c.waiting.length) {
        s.pending = null;
        for (const r of c.paid) s.resDiscard.push(r.type);
        resolvePlay(s, c);
      }
      return;
    }
    if (a.choice !== 'call') bad('Unknown choice.');
    if (a.lawsuit && !hasLawsuit(p)) bad('You have no Lawsuit.');
    spoke(p);
    raiseCall(s, { site: 'cost', caller: pid, accused: c.player, lawsuit: !!a.lawsuit, what: `${def.name} payment` });
  },

  discard(s, pid, a) {
    const p = myFreeTurn(s, pid);
    const res = a.resIds || [], cards = a.cardIds || [];
    if (res.length > Math.max(0, p.res.length - slotLimit(p))) bad('You can only discard down to your slot limit.');
    if (cards.length > Math.max(0, p.hand.length - handLimit(p))) bad('You can only discard down to your hand limit.');
    if (res.some((id) => !p.res.some((c) => c.id === id)) || cards.some((id) => !p.hand.some((c) => c.id === id))) bad('Pick your own cards.');
    for (const id of new Set(res)) s.resDiscard.push(takeRes(s, p, id).type);
    for (const id of new Set(cards)) {
      const i = p.hand.findIndex((c) => c.id === id);
      s.playDiscard.push(p.hand.splice(i, 1)[0].kind);
    }
    if (res.length + cards.length) fx(s, 'discard', { p: pid });
    if (res.length + cards.length) log(s, `${p.name} discards ${res.length + cards.length} card(s).`);
  },

  endTurn(s, pid) {
    const p = myFreeTurn(s, pid);
    if (p.res.length > slotLimit(p)) bad(`Discard down to ${slotLimit(p)} resources first.`);
    if (p.hand.length > handLimit(p)) bad(`Discard down to ${handLimit(p)} hand cards first.`);
    p.boycott = false;
    p.tell.turns++;
    if (p.tell.busy) p.tell.still = 0; else { p.tell.still++; p.tell.quiet++; }
    // Ending your turn with 5 of a kind starts the secret one-round hold.
    p.holding = TYPES.find((ty) => countType(p, ty) >= 5) || null;
    if (p.holding) fx(s, 'hold', { p: pid }, pid);
    if (p.holding) log(s, `You hold a monopoly on ${p.holding}. Keep it until your next turn to score.`, pid);
    s.turn = (s.turn + 1) % s.players.length;
    startTurn(s);
  },

  // Server-only: the clock ran out on whoever was being waited for.
  timeout(s) {
    const c = s.pending;
    if (!c) return;
    if (c.kind === 'whistle') {
      const t = s.players[c.accused];
      const five = TYPES.find((ty) => countType(t, ty) >= 5);
      const order = [...t.res].sort((a, b) => (b.type === five) - (a.type === five));
      ACTIONS.whistlePick(s, c.caller, { resIds: order.slice(0, c.need).map((r) => r.id) });
    } else if (c.kind === 'alibi') ACTIONS.alibiResponse(s, c.accused, { use: false });
    else if (c.kind === 'tip') ACTIONS.tipPick(s, c.player, { keep: c.cards[0].id });
    else if (c.kind === 'dup') { const p = s.players[c.player]; ACTIONS.moveDup(s, c.player, { resId: p.res.find((x) => !p.boosts.some((b) => b.kind === 'duplicator' && b.on === x.id)).id }); }
    else if (c.kind === 'power') ACTIONS.power(s, c.player, c.cards ? { keep: c.cards[0].id } : { use: false });
    else if (c.kind === 'cost') ACTIONS.costResponse(s, c.waiting[0], { choice: 'pass' });
    else if (c.stage === 'response') ACTIONS.respondTrade(s, c.to, { choice: 'decline' });
    else ACTIONS.finishTrade(s, c.from, { choice: c.replyClaim !== c.ask ? 'cancel' : 'accept' }); // changed terms are not accepted for you
  },
};

function validatePlay(s, p, kind, a, payment) {
  const other = () => {
    const t = s.players[a.target];
    if (!t || t.id === p.id) bad('Pick another player.');
    return t;
  };
  switch (kind) {
    case 'espionage': {
      const t = other();
      if (!t.res.some((c) => c.id === a.resId)) bad('Pick one of their resource cards.');
      return { target: t.id, resId: a.resId };
    }
    case 'forcedTrade': {
      const t = other();
      if (!t.res.some((c) => c.id === a.theirId)) bad('Pick one of their resource cards.');
      return { target: t.id, theirId: a.theirId };
    }
    case 'strike': {
      const t = other();
      if (!t.boosts.some((b) => b.id === a.boostId)) bad('Pick one of their Boost cards.');
      return { target: t.id, boostId: a.boostId };
    }
    case 'writeoff': {
      const n = Number(a.count);
      if (!Number.isInteger(n) || n < 1 || n > 3) bad('Choose 1, 2 or 3 cards to write off.');
      if (n > p.res.length) bad('You do not have that many resources.');
      return { count: n };
    }
    case 'expansion': {
      if (!p.boosts.some((b) => !b.expanded)) return { draw: true }; // nothing to attach it to: it becomes two cards
      const b = p.boosts.find((b) => b.id === a.boostId);
      if (!b || b.expanded) bad('Pick one of your Boosts that is not already Expanded.');
      return { boostId: b.id };
    }
    case 'audit': {
      const t = other();
      if (!t.res.length) bad('That player has no resources to look at.');
      return { target: t.id };
    }
    case 'injunction':
      return { target: other().id };
    case 'duplicator': {
      const c = p.res.find((c) => c.id === a.resId);
      if (!c || payment.includes(c.id)) bad('Pick one of your resources (not one you are paying with).');
      if (p.boosts.some((b) => b.kind === 'duplicator' && b.on === c.id)) bad('That card already has a Duplicator.');
      return { resId: c.id };
    }
    default:
      return {};
  }
}

function describeTarget(s, kind, x) {
  if (kind === 'strike') {
    const b = s.players[x.target].boosts.find((b) => b.id === x.boostId);
    return ` on ${nm(s, x.target)}'s ${CARDS[b.kind].name}`;
  }
  if (x.target !== undefined) return ` on ${nm(s, x.target)}`;
  return '';
}

function resolvePlay(s, play, alreadyDiscarded = false) {
  const p = s.players[play.player], kind = play.card.kind, x = play.x;
  fx(s, 'resolve', { p: p.id, kind, target: x.target });
  const def = CARDS[kind];
  const toDiscard = () => { if (!alreadyDiscarded) s.playDiscard.push(kind); };
  switch (kind) {
    case 'espionage': {
      toDiscard();
      const t = s.players[x.target];
      const c = t.res.find((c) => c.id === x.resId);
      if (c) { learn(s, p.id, c); log(s, `You peek: ${t.name}'s card is ${c.type}.`, p.id); }
      break;
    }
    case 'forcedTrade': {
      toDiscard();
      const t = s.players[x.target];
      if (!t.res.some((c) => c.id === x.theirId)) { log(s, 'The Forced Trade fizzles.'); break; }
      const theirs = takeRes(s, t, x.theirId, true);
      p.res.push(theirs);
      recall(s, p.id, theirs); recall(s, t.id, theirs);
      log(s, `${p.name} steals a card from ${t.name}.`);
      log(s, `You stole ${theirs.type}.`, p.id);
      log(s, `${p.name} stole your ${theirs.type}.`, t.id);
      break;
    }
    case 'strike': {
      toDiscard();
      const t = s.players[x.target];
      const i = t.boosts.findIndex((b) => b.id === x.boostId);
      if (i < 0) { log(s, 'The Strike fizzles.'); break; }
      const [b] = t.boosts.splice(i, 1);
      s.playDiscard.push(b.kind);
      if (b.expanded) s.playDiscard.push('expansion');
      log(s, `Strike! ${t.name} loses their ${CARDS[b.kind].name}.`);
      break;
    }
    case 'writeoff': {
      toDiscard();
      // Rows never get rearranged (Heat turns cards up from the left), so the cards that go are the rightmost ones,
      // and the new ones join at the right.
      const n = Math.min(x.count, p.res.length);
      for (let i = 0; i < n; i++) s.resDiscard.push(takeRes(s, p, p.res[p.res.length - 1].id).type);
      for (let i = 0; i < n; i++) p.res.push(drawRes(s));
      log(s, `${p.name} writes off ${n} card${n === 1 ? '' : 's'} and draws ${n} new.`);
      break;
    }
    case 'bribe':
      toDiscard();
      if (p.heat > 0) { p.heat--; log(s, `${p.name} bribes away 1 Heat.`); }
      else { p.cover = Math.min(RULES.coverCap, p.cover + 1); log(s, `${p.name} buys 1 Cover.`); }
      break;
    case 'warehouse':
    case 'front':
      if (alreadyDiscarded) s.playDiscard.splice(s.playDiscard.lastIndexOf(kind), 1);
      p.boosts.push({ id: play.card.id, kind, expanded: false, on: null });
      log(s, `${p.name} builds a ${def.name}.`);
      break;
    case 'duplicator':
      if (alreadyDiscarded) s.playDiscard.splice(s.playDiscard.lastIndexOf(kind), 1);
      if (!p.res.some((c) => c.id === x.resId)) { s.playDiscard.push(kind); log(s, 'The Duplicator fizzles.'); break; }
      p.boosts.push({ id: play.card.id, kind, expanded: false, on: x.resId });
      log(s, `${p.name} puts a Duplicator on a resource.`);
      break;
    case 'tip': {
      toDiscard();
      const cards = [drawPlay(s), drawPlay(s)];
      s.pending = { kind: 'tip', n: ++s.pendingN, player: p.id, cards };
      log(s, `${p.name} reads an Insider Tip: two cards, one to keep.`);
      break;
    }
    case 'audit': {
      toDiscard();
      const t = s.players[x.target];
      // up to three face-down cards, ones the auditor has not seen first, left to right
      const hidden = t.res.filter((c, i) => !isFaceUp(t, i));
      const pickN = [...hidden.filter((c) => p.known[c.id] === undefined), ...hidden.filter((c) => p.known[c.id] !== undefined)].slice(0, 3);
      for (const c of pickN) learn(s, p.id, c);
      log(s, `${p.name} audits ${t.name} and looks at ${pickN.length} of their cards.`);
      log(s, `Audit: ${t.name} has ${pickN.map((c) => c.type).join(', ') || 'nothing hidden'}.`, p.id);
      break;
    }
    case 'injunction': {
      toDiscard();
      const t = s.players[x.target];
      t.enjoined = true;
      log(s, `${p.name} serves an Injunction on ${t.name}: nothing of theirs can score on their next turn.`);
      break;
    }
    case 'expansion': {
      if (x.draw) {
        toDiscard();
        p.hand.push(drawPlay(s), drawPlay(s));
        log(s, `${p.name} has no Boost to expand and draws 2 cards instead.`);
        break;
      }
      const b = p.boosts.find((b) => b.id === x.boostId);
      if (!b || b.expanded) { toDiscard(); log(s, 'The Expansion fizzles.'); break; }
      if (alreadyDiscarded) s.playDiscard.splice(s.playDiscard.lastIndexOf(kind), 1);
      b.expanded = true;
      log(s, `${p.name} expands their ${CARDS[b.kind].name}.`);
      break;
    }
  }
}

// ---------- who must act, and what each player may see ----------

// A player has left for good. The table is told, and from now on the computer plays that seat.
export function playerLeft(s, pid) {
  const p = s.players[pid];
  if (!p || p.isBot) return;
  p.isBot = true;
  log(s, `${p.name} left the game. A bot plays on in their seat.`);
  fx(s, 'left', { p: pid });
}

export function actors(s) {
  if (s.phase === 'over') return [];
  const c = s.pending;
  if (!c) return [s.turn];
  if (c.kind === 'whistle') return [c.caller];
  if (c.kind === 'alibi') return [c.accused];
  if (c.kind === 'tip' || c.kind === 'power' || c.kind === 'dup') return [c.player];
  if (c.kind === 'cost') return [c.waiting[0]];
  return [c.stage === 'response' ? c.to : c.from];
}

export function viewFor(s, pid) {
  const me = s.players[pid];
  const c = s.pending;
  let pending = null;
  if (c?.kind === 'trade') {
    pending = {
      kind: 'trade', n: c.n, open: !!c.open, queue: c.queue || [], offerId: c.offer.id, replyId: c.reply?.id ?? null, from: c.from, to: c.to, stage: c.stage, offerClaim: c.offerClaim, ask: c.ask, replyClaim: c.replyClaim,
      // A card put down in a trade is hidden from the other side, even one they have seen before.
      // Only Espionage played on this trade shows it.
      offerType: pid === c.from || (pid === c.to && c.seenOffer === pid) ? c.offer.type : null,
      replyType: c.reply ? (pid === c.to || (pid === c.from && c.seenReply) ? c.reply.type : null) : null,
    };
  } else if (c?.kind === 'alibi') {
    pending = { kind: 'alibi', n: c.n, accused: c.accused, caller: c.caller, what: c.what, site: c.site };
  } else if (c?.kind === 'tip') {
    pending = { kind: 'tip', n: c.n, player: c.player, cards: pid === c.player ? c.cards.map((x) => ({ id: x.id, kind: x.kind })) : null };
  } else if (c?.kind === 'power') {
    pending = { kind: 'power', n: c.n, player: c.player, res: c.res, cards: c.cards ? (pid === c.player ? c.cards.map((x) => ({ id: x.id, type: x.type })) : []) : null };
  } else if (c?.kind === 'whistle') {
    pending = { kind: 'whistle', n: c.n, caller: c.caller, accused: c.accused, need: c.need };
  } else if (c?.kind === 'cost') {
    pending = { kind: 'cost', n: c.n, cardId: c.card.id, paid: c.paid.map((r) => ({ id: r.id, type: pid === c.player ? r.type : null })), player: c.player, card: c.card.kind, cost: CARDS[c.card.kind].cost, x: c.x, waiting: c.waiting };
  } else if (c?.kind === 'dup') {
    pending = { kind: 'dup', n: c.n, player: c.player, boostId: c.boostId };
  }
  return {
    you: pid, turn: s.turn, turnNumber: s.turnNumber, phase: s.phase, winner: s.winner, winTarget: s.winTarget, marks: s.marks,
    pending, reveal: s.reveal, decks: { res: s.resDeck.length, play: s.playDeck.length },
    fx: s.fx.filter((f) => f.to === null || f.to === pid),
    log: s.log.filter((l) => l.to === null || l.to === pid).slice(-80),
    players: s.players.map((p) => ({
      id: p.id, name: p.name, isBot: p.isBot, heat: p.heat, cover: p.cover, shownHeat: shownHeat(p),
      banked: p.banked, holding: p.id === pid ? p.holding : null, traded: p.traded, enjoined: !!p.enjoined, boycott: !!p.boycott,
      stats: s.phase === 'over' ? p.stats : null,
      gaps: p.gaps, // empty places in the row: cards that are out in a trade and may come back
      slotLimit: slotLimit(p), handLimit: handLimit(p), handCount: p.hand.length, handIds: p.hand.map((h) => h.id),
      hand: p.id === pid ? p.hand.map((h) => ({ id: h.id, kind: h.kind })) : null,
      res: p.res.map((r, i) => {
        const faceUp = isFaceUp(p, i);
        const mine = p.id === pid;
        const known = !mine && !faceUp && s.marks !== 'none' && me?.known[r.id] !== undefined;
        return { id: r.id, faceUp, known, worth: cardWorth(p, r), type: mine || faceUp || known ? r.type : null };
      }),
      boosts: p.boosts.map((b) => ({ id: b.id, kind: b.kind, expanded: b.expanded, on: b.on })),
    })),
  };
}
