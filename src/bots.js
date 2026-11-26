// Bot players. A bot only uses what a human in its seat could know:
// its own cards, face-up cards, and cards it has seen (p.known).
import { TYPES, CARDS, countType, slotLimit, handLimit, isFaceUp, chance, randInt, payCheck, cardWorth, hasFive } from './engine.js';

const pick = (s, arr) => arr[randInt(s, arr.length)];

function goalType(p) {
  if (p.holding) return p.holding;
  let best = TYPES[0], n = -1;
  for (const t of TYPES) { const c = countType(p, t); if (c > n) { n = c; best = t; } }
  return best;
}
// Cards the bot is happy to lose: anything off-goal, plus goal cards beyond what it needs.
function junk(p) {
  const g = goalType(p);
  const off = p.res.filter((c) => c.type !== g);
  if (off.length) return off;
  return countType(p, g) > 5 ? p.res.slice(-1) : [];
}
// What the bot can see of another player's card right now (face up, or just peeked and not yet moved).
function seen(me, other, i) {
  const c = other.res[i];
  return isFaceUp(other, i) ? c.type : me.known[c.id];
}
// What the bot believes a player holds: face-up cards plus cards it remembers them having, wherever they now lie.
function believed(me, other) {
  const tally = {}, seenBefore = me.bot?.skill === 3 ? me.mem : me.known; // only Insane remembers cards that were merely flipped in front of it
  other.res.forEach((c, i) => { const ty = isFaceUp(other, i) ? c.type : seenBefore[c.id]; if (ty) (tally[ty] ||= []).push(c.id); });
  return tally;
}
// `claim` is the type they say the card is. A sharp bot doubts a claim more when it is sitting on that type itself.
function suspicion(me, other, claim = null) {
  let base = 0.1 + 0.12 * other.caught - 0.04 * other.cleared;
  if (me.bot.skill === 2 && claim) base *= 1 + 0.3 * countType(me, claim);
  const risk = me.heat >= 3 ? 0.4 : me.cover > 0 ? 1.3 : 1;
  return Math.max(0.03, Math.min(0.6, base * me.bot.sus * risk));
}
const lawsuit = (p) => p.hand.some((c) => c.kind === 'lawsuit');

// ---------- reading the table ----------
// A hidden monopoly changes how its owner plays: they stop offering trades, turn offers down, and stop calling
// bluffs (a wrong call means Heat, and Heat turns their cards face up). Everyone can see that happen. These are
// the signs a seat can read off another player: their public record (engine.js keeps it as `tell`) plus whatever
// this seat has itself seen of their cards.
export function tellSigns(s, me, o) {
  const t = o.tell, per = {};
  let unknown = 0;
  const seenBefore = me.bot?.skill === 3 ? me.mem : me.known;
  o.res.forEach((c, i) => { const ty = isFaceUp(o, i) ? c.type : seenBefore[c.id]; if (ty) per[ty] = (per[ty] || 0) + cardWorth(o, c); else unknown += cardWorth(o, c); });
  const known = Math.max(0, ...Object.values(per));
  return {
    still: t.still, quiet: t.quiet, known, cards: o.res.length,
    possible: known + unknown >= 5, // could they have five of a kind at all, given what I have seen?
    fresh: t.fresh > 0 && s.turnNumber - t.fresh <= s.players.length, // scored within the last round: a brand-new row
    callsUsually: t.calls / Math.max(1, t.calls + t.passes), // someone who never calls anyway gives nothing away by not calling
  };
}
export const signVector = (g) => [1, g.still === 1 ? 1 : 0, g.still >= 2 ? 1 : 0, Math.min(g.quiet, 4) / 4, Math.min(g.known, 3) / 3, g.known === 4 ? 1 : 0, g.known >= 5 ? 1 : 0, g.cards >= 5 ? 1 : 0, g.cards <= 3 ? 1 : 0, g.fresh ? 1 : 0];
// Weights fitted to bot games with scripts/tells.mjs (it prints a fresh set). Same order as signVector.
const READ = [-0.97, 1.25, 1.85, 0.5, 1.52, 0.5, 3.2, -1.3, 1.1, -1.75];
const PRIOR = 0.24; // how often a player who could be holding really is, before looking at any signs
// How likely is `o` to be holding a monopoly right now? `skill` decides how much of the read gets used:
// Insane (3) trusts all of it, Hard (2) three quarters, Normal (1) half, Easy (0) none.
export function holdRead(s, me, o, skill = me.bot?.skill ?? 0) {
  const g = tellSigns(s, me, o);
  if (!g.possible) return 0;
  const z = signVector(g).reduce((sum, x, i) => sum + x * READ[i], 0);
  const full = g.known >= 5 ? 0.92 : 1 / (1 + Math.exp(-z)); // five of a kind seen with my own eyes needs no reading
  const trust = [0, 0.5, 0.75, 1][skill];
  return PRIOR + (full - PRIOR) * trust;
}

// How often does this player call, compared with letting things go? null until there is enough to go on.
const callRate = (o) => (o.tell.calls + o.tell.passes >= 5 ? o.tell.calls / (o.tell.calls + o.tell.passes) : null);
// The resource a player seems to be collecting, judged by what they keep asking for.
const asksFor = (o) => { const a = o.tell.asks, top = Object.keys(a).sort((x, y) => a[y] - a[x])[0]; return top && a[top] >= 2 ? top : null; };
// Whoever most looks like they are holding, as this seat reads it. Someone who has not had a turn yet cannot be.
function topRead(s, me, others) {
  let best = null;
  for (const o of others) { if (o.res.length < 3 || !o.tell.turns) continue; const p = holdRead(s, me, o); if (!best || p > best.p) best = { o, p }; }
  return best;
}
// Lie more to a table that lets things go, less to one that calls. Hard and Insane adjust fully, Normal half, Easy not at all.
function nerve(me, watchers) {
  const rates = watchers.map(callRate).filter((r) => r !== null);
  if (!rates.length || !me.bot.skill) return 1;
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  const k = avg < 0.08 ? 1.5 : avg < 0.15 ? 1.2 : avg > 0.3 ? 0.55 : avg > 0.22 ? 0.8 : 1;
  return 1 + (k - 1) * [0, 0.5, 1, 1][me.bot.skill];
}

// ---------- Insane bots ----------
// They cheat at nothing: they simply never forget. Rows are never rearranged, so a card seen once can be followed for the
// rest of the game, including when it is paid or traded. Everything below uses only what that seat has legitimately seen.
const insane = (me) => me.bot.skill === 3;
// How likely is this unseen card to be a lie? Built from the player's record at this table and from what the claim implies.
function lieOdds(s, me, other, claim) {
  let p = (other.caught + 1) / (other.caught + other.cleared + 4); // starts near 25%, moves with what they have been caught at
  // every copy of a type that I can account for elsewhere makes the claim less likely
  let seen = countType(me, claim);
  for (const o of s.players) if (o.id !== me.id && o.id !== other.id) seen += (believed(me, o)[claim] || []).length;
  if (seen >= 14) return 1;
  p += seen * 0.03;
  // people rarely hand over, or pay with, the type they are visibly collecting
  const b = believed(me, other);
  const top = Object.keys(b).sort((x, y) => b[y].length - b[x].length)[0];
  if (top === claim && b[top].length >= 2) p += 0.25;
  else if (asksFor(other) === claim) p += 0.2; // ...or the type they keep asking the table for
  return Math.min(0.95, p);
}
// Call only when it pays: a wrong call costs Heat (which exposes my cards), a right one wins cards.
function worthCalling(me, odds, stakes = 1) {
  const need = me.heat >= 3 ? 0.8 : me.heat >= 1 ? 0.62 : me.cover > 0 ? 0.48 : 0.55;
  return odds > need - Math.min(0.12, stakes * 0.04);
}

export function botAction(s, pid) {
  const me = s.players[pid];
  const c = s.pending;
  if (c?.kind === 'whistle') return whistlePick(s, c);
  if (c?.kind === 'alibi') return alibiAnswer(s, me, c);
  if (c?.kind === 'tip') return tipPick(me, c);
  if (c?.kind === 'dup') return { type: 'moveDup', resId: dupSpot(me).id };
  if (c?.kind === 'power') return usePower(s, me, c);
  if (c?.kind === 'cost') return costResponse(s, me, c);
  if (c?.kind === 'trade') return c.stage === 'response' ? tradeResponse(s, me, c) : tradeDecision(s, me, c);
  return takeTurn(s, me);
}

// Called out while holding an Alibi: play it only when the call would actually land. If the bot was honest, let the caller pay.
function alibiAnswer(s, me, w) {
  const u = w.under;
  const guilty = w.site === 'offer' ? u.offer.type !== u.offerClaim
    : w.site === 'reply' ? u.reply.type !== u.replyClaim
    : w.site === 'cost' ? payCheck(CARDS[u.card.kind].cost, u.paid.map((r) => r.type)).includes(false)
    : hasFive(me);
  return { type: 'alibiResponse', use: guilty };
}
// A Duplicator that came loose goes under a card of what it collects, if it can.
function dupSpot(me) {
  const free = me.res.filter((c) => !me.boosts.some((b) => b.kind === 'duplicator' && b.on === c.id)), g = goalType(me);
  return free.find((c) => c.type === g) || free[0];
}
// Insider Tip: keep the card it values more.
const CARD_WORTH = { lawsuit: 2, espionage: 2, tip: 3, bribe: 2, front: 2, expansion: 2, alibi: 4, audit: 3, strike: 3, whistleblower: 3, writeoff: 3, injunction: 4, duplicator: 5, warehouse: 5, forcedTrade: 6 };
function tipPick(me, w) {
  const best = [...w.cards].sort((a, b) => (CARD_WORTH[b.kind] || 0) - (CARD_WORTH[a.kind] || 0))[0];
  return { type: 'tipPick', keep: best.id };
}

// The power that comes with a scored monopoly. Aimed ones go at whoever is ahead, or looks closest to scoring next.
function usePower(s, me, w) {
  if (w.cards) { // Harvest: keep what it collects (its row is new, so that is whatever it now has most of), leave the better card on top
    const g = goalType(me), keep = w.cards.find((c) => c.type === g) || w.cards[0];
    return { type: 'power', keep: keep.id };
  }
  const others = s.players.filter((o) => o.id !== me.id);
  const threat = (o) => o.banked.length * 3 + Math.max(0, ...Object.values(believed(me, o)).map((x) => x.length)) + (me.bot.skill ? holdRead(s, me, o) * 4 : 0);
  if (w.res === 'Weapons') {
    const t = others.filter((o) => o.res.length).sort((a, b) => threat(b) - threat(a))[0];
    if (!t) return { type: 'power', use: false };
    const g = goalType(me), want = t.res.find((c, i) => seen(me, t, i) === g); // a card it knows it wants, else pot luck
    return { type: 'power', use: true, target: t.id, resId: want?.id };
  }
  if (w.res === 'Workers') return { type: 'power', use: true, target: [...others].sort((a, b) => threat(b) - threat(a) || b.hand.length - a.hand.length)[0].id };
  return { type: 'power', use: true };
}

// A right Whistleblower call: take two cards. Ones I collect come first, then whatever they have the most of.
function whistlePick(s, c) {
  const t = s.players[c.accused], g = goalType(s.players[c.caller]);
  const order = [...t.res].sort((a, b) => (b.type === g) - (a.type === g) || countType(t, b.type) - countType(t, a.type));
  return { type: 'whistlePick', resIds: order.slice(0, c.need).map((r) => r.id) };
}

function costResponse(s, me, c) {
  const payer = s.players[c.player];
  // Sitting on a monopoly: a wrong call means Heat, and Heat turns those cards face up. Sharp bots stay out of it unless they know.
  const guarded = me.holding && me.bot.skill >= 2;
  if (insane(me)) {
    const cost = CARDS[c.card.kind].cost, types = c.paid.map((r) => me.mem[r.id]);
    const call = { type: 'costResponse', choice: 'call', lawsuit: lawsuit(me) }, pass = { type: 'costResponse', choice: 'pass' };
    if (types.every((t) => t !== undefined)) return payCheck(cost, types).includes(false) ? call : pass; // it has seen every card being paid
    if (types.some((t, i) => t !== undefined && !cost.includes(t))) return call; // one card it knows cannot be part of this payment
    if (guarded) return pass;
    const odds = Math.max(...cost.map((t) => lieOdds(s, me, payer, t)));
    return worthCalling(me, odds * (c.x.target === me.id ? 1.15 : 1), c.paid.length) ? { ...call, lawsuit: lawsuit(me) && odds > 0.7 } : pass;
  }
  if (guarded && !chance(s, 0.15)) return { type: 'costResponse', choice: 'pass' };
  let p = suspicion(me, payer, CARDS[c.card.kind].cost[0]) * 0.6;
  if (c.x.target === me.id) p *= 2.2;
  if (payer.banked.length) p *= 1.3;
  return chance(s, Math.min(0.55, p)) ? { type: 'costResponse', choice: 'call', lawsuit: lawsuit(me) && chance(s, 0.6) } : { type: 'costResponse', choice: 'pass' };
}

function tradeResponse(s, me, t) {
  const from = s.players[t.from];
  const g = goalType(me);
  const spare = junk(me);
  if (!spare.length) return { type: 'respondTrade', choice: 'decline' };
  const give = pick(s, spare);
  if (insane(me)) {
    const real = me.mem[t.offer.id]; // it may have seen this very card earlier
    if (real !== undefined && real !== t.offerClaim) return { type: 'respondTrade', choice: 'call', cardId: give.id, lawsuit: lawsuit(me) };
    if (real === undefined && worthCalling(me, lieOdds(s, me, from, t.offerClaim), 2)) return { type: 'respondTrade', choice: 'call', cardId: give.id, lawsuit: lawsuit(me) };
    const want = (real ?? t.offerClaim) === g;
    if (!want) return { type: 'respondTrade', choice: 'decline' }; // never helps someone else for nothing
    const honest = spare.find((x) => x.type === t.ask);
    if (honest) return { type: 'respondTrade', choice: 'trade', cardId: honest.id, claim: honest.type };
    // lie only with a card the table has never seen, and only while its own record is clean enough to be believed
    const hidden = spare.filter((x) => !x.pub && !isFaceUp(me, me.res.indexOf(x)));
    if (hidden.length && me.caught <= 1 && chance(s, 0.7)) return { type: 'respondTrade', choice: 'trade', cardId: pick(s, hidden).id, claim: t.ask };
    return { type: 'respondTrade', choice: 'decline' };
  }
  const knownType = t.seenOffer === me.id ? t.offer.type : undefined; // same rule as people: only Espionage on this trade shows the card
  if (knownType !== undefined && knownType !== t.offerClaim) return { type: 'respondTrade', choice: 'call', cardId: give.id, lawsuit: lawsuit(me) };
  if (knownType === undefined && chance(s, suspicion(me, from, t.offerClaim))) return { type: 'respondTrade', choice: 'call', cardId: give.id, lawsuit: lawsuit(me) && chance(s, 0.5) };
  const wants = t.offerClaim === g;
  if (!wants && !chance(s, 0.3)) return { type: 'respondTrade', choice: 'decline' };
  // Hard bots notice who keeps asking for the same thing and is nearly there, and stop feeding them.
  if (me.bot.skill >= 2 && asksFor(from) === t.ask && ((believed(me, from)[t.ask] || []).length >= 3 || from.banked.length >= s.winTarget - 1) && chance(s, 0.75)) return { type: 'respondTrade', choice: 'decline' };
  const honest = spare.find((x) => x.type === t.ask);
  if (honest) return { type: 'respondTrade', choice: 'trade', cardId: honest.id, claim: honest.type };
  const lie = chance(s, me.bot.liar * nerve(me, [from]));
  return { type: 'respondTrade', choice: 'trade', cardId: give.id, claim: lie ? t.ask : give.type };
}

function tradeDecision(s, me, t) {
  const to = s.players[t.to];
  // They are not giving what was asked for. Unless it happens to be useful anyway, call the trade off.
  const seenReply = insane(me) ? me.mem[t.reply.id] : t.seenReply ? t.reply.type : undefined;
  if (t.replyClaim !== t.ask && (seenReply ?? t.replyClaim) !== goalType(me)) return { type: 'finishTrade', choice: 'cancel' };
  if (insane(me)) {
    const real = me.mem[t.reply.id];
    if (real !== undefined) return real !== t.replyClaim ? { type: 'finishTrade', choice: 'call', lawsuit: lawsuit(me) } : { type: 'finishTrade', choice: 'accept' };
    return worthCalling(me, lieOdds(s, me, to, t.replyClaim), 2) ? { type: 'finishTrade', choice: 'call', lawsuit: lawsuit(me) } : { type: 'finishTrade', choice: 'accept' };
  }
  const knownType = t.seenReply ? t.reply.type : undefined;
  if (knownType !== undefined && knownType !== t.replyClaim) return { type: 'finishTrade', choice: 'call', lawsuit: lawsuit(me) };
  if (knownType === undefined && t.replyClaim === t.ask && chance(s, suspicion(me, to, t.replyClaim))) return { type: 'finishTrade', choice: 'call', lawsuit: lawsuit(me) && chance(s, 0.5) };
  return { type: 'finishTrade', choice: 'accept' };
}

// Choose resource cards to pay a cost with. Honest when it has the right card to spare, otherwise maybe a bluff.
// Returns { payment } or null (cannot or will not pay).
function payFor(s, me, cost, reserved = []) {
  const pool = junk(me).filter((c) => !reserved.includes(c.id));
  const out = [];
  for (const t of cost) {
    const left = pool.filter((c) => !out.includes(c.id));
    const honest = left.find((c) => c.type === t);
    if (honest) { out.push(honest.id); continue; }
    if (!left.length || !chance(s, (me.bot.liar + 0.25) * nerve(me, s.players.filter((o) => o.id !== me.id)))) return null;
    out.push(pick(s, left).id);
  }
  return { payment: out };
}

function planCard(s, me, card) {
  const g = goalType(me);
  const others = s.players.filter((o) => o.id !== me.id);
  for (let i = others.length - 1; i > 0; i--) { const j = randInt(s, i + 1); [others[i], others[j]] = [others[j], others[i]]; } // no seat favouritism
  const def = CARDS[card.kind];
  const base = { type: 'playCard', cardId: card.id };
  if (me.boycott && def.kind === 'action' && card.kind !== 'whistleblower') return null; // boycotted: Boosts and the whistle only
  switch (card.kind) {
    case 'espionage': {
      if (!insane(me) && !chance(s, 0.5)) return null; // an insane bot never wastes a free look
      const opts = [];
      for (const o of others) o.res.forEach((c, i) => { if (seen(me, o, i) === undefined) opts.push({ target: o.id, resId: c.id }); });
      if (insane(me) && opts.length) { // look at whoever is ahead, is showing the most of one kind, or has gone suspiciously quiet
        const worth = (o) => o.banked.length * 10 + Math.max(0, ...Object.values(believed(me, o)).map((x) => x.length)) + Math.round(holdRead(s, me, o) * 6);
        const top = Math.max(...others.map(worth)), best = opts.filter((x) => worth(s.players[x.target]) === top);
        return { ...base, payment: [], ...pick(s, best.length ? best : opts) };
      }
      return opts.length ? { ...base, payment: [], ...pick(s, opts) } : null;
    }
    case 'whistleblower': {
      // Holds are secret. Accuse on cards seen (four or five of a kind), on how someone has been playing, or, rarely, on a hunch.
      const skill = me.bot.skill;
      if (skill === 0) { // an easy bot only goes by cards it can see
        let best = null;
        for (const o of others) { const n = Math.max(0, ...Object.values(believed(me, o)).map((ids) => ids.length)); if (!best || n > best.n) best = { o, n }; }
        return best && best.o.res.length >= 3 && best.n >= 4 && chance(s, 0.85) ? { type: 'whistle', target: best.o.id } : null;
      }
      const read = topRead(s, me, others);
      if (!read) return null;
      const need = [1, 0.47, 0.47, 0.5][skill] + (me.heat >= 3 ? 0.1 : 0); // already hot: only when surer
      if (read.p >= need) return { type: 'whistle', target: read.o.id, why: tellSigns(s, me, read.o).known <= 3 ? 'quiet' : undefined };
      return skill === 1 && me.heat <= 1 && chance(s, 0.03) ? { type: 'whistle', target: read.o.id } : null; // a Normal bot still guesses now and then
    }
    case 'tip':
      return me.hand.length <= 4 ? { ...base, payment: [] } : null; // free cards: always worth a look
    case 'audit': {
      // look at whoever is furthest ahead, or whoever it knows least about
      const t = [...others].filter((o) => o.res.length).sort((a, b) => (b.banked.length * 4 + b.res.filter((c, i) => seen(me, b, i) === undefined).length) - (a.banked.length * 4 + a.res.filter((c, i) => seen(me, a, i) === undefined).length))[0];
      if (!t || !t.res.some((c, i) => seen(me, t, i) === undefined) || !chance(s, 0.7)) return null;
      const pay = payFor(s, me, def.cost);
      return pay ? { ...base, ...pay, target: t.id } : null;
    }
    case 'injunction': {
      // stop whoever looks closest to scoring: the most cards of one type that it knows of, with the leader breaking ties
      const score = (o) => Math.max(0, ...Object.values(believed(me, o)).map((x) => x.length)) * 2 + o.banked.length * 3;
      const read = me.bot.skill ? topRead(s, me, others.filter((o) => !o.enjoined)) : null;
      if (read && read.p >= 0.3) { const pay = payFor(s, me, def.cost); return pay ? { ...base, ...pay, target: read.o.id } : null; } // someone has gone quiet: freeze them
      const t = [...others].filter((o) => !o.enjoined).sort((a, b) => score(b) - score(a))[0];
      if (!t) return null;
      const strong = Math.max(0, ...Object.values(believed(me, t)).map((x) => x.length)) >= 3 || t.banked.length >= 1;
      if (!chance(s, strong ? 0.8 : 0.2)) return null;
      const pay = payFor(s, me, def.cost);
      return pay ? { ...base, ...pay, target: t.id } : null;
    }
    case 'writeoff': {
      // Throw back the run of unwanted cards at the right end of the row (never a card it is collecting).
      const keep = new Set(junk(me).map((c) => c.id));
      let n = 0;
      for (let i = me.res.length - 1; i >= 0 && n < 3 && keep.has(me.res[i].id); i--) n++;
      return n && chance(s, 0.75) ? { ...base, payment: [], count: n } : null;
    }
    case 'forcedTrade': {
      let hit = null;
      // Holds are secret, so go by what we can see: break up anyone showing 3+ of a kind,
      // otherwise grab a visible card of the type we collect.
      for (const o of others) {
        const big = Object.values(believed(me, o)).sort((a, b) => b.length - a.length)[0];
        // It knows they have three of something, but only a card it can still see is a sure hit; otherwise it grabs blind.
        const sure = big?.find((id) => { const i = o.res.findIndex((c) => c.id === id); return seen(me, o, i) !== undefined; });
        if (big && big.length >= 3 && (!hit || big.length > hit.n)) hit = { target: o.id, theirId: sure ?? pick(s, o.res).id, n: big.length };
      }
      const read = me.bot.skill ? topRead(s, me, others) : null;
      if (read && read.p >= [1, 0.45, 0.38, 0.33][me.bot.skill]) { // they look like they are holding: any card taken from them breaks it
        const tops = Object.values(believed(me, read.o)).sort((a, b) => b.length - a.length)[0];
        const sure = tops?.find((id) => seen(me, read.o, read.o.res.findIndex((c) => c.id === id)) !== undefined);
        hit = { target: read.o.id, theirId: sure ?? pick(s, read.o.res).id };
      }
      else if (insane(me) && countType(me, g) >= 3) { // close to five: take the exact card it remembers, from whoever is furthest ahead
        const lead = [...others].sort((a, b) => b.banked.length - a.banked.length);
        for (const o of lead) { const c = o.res.find((x, i) => seen(me, o, i) === g); if (c) { hit = { target: o.id, theirId: c.id }; break; } }
      }
      if (!hit) for (const o of others) o.res.forEach((c, i) => { if (!hit && seen(me, o, i) === g) hit = { target: o.id, theirId: c.id }; });
      if (hit) delete hit.n;
      if (!hit) return null;
      const pay = payFor(s, me, def.cost);
      return pay ? { ...base, ...pay, ...hit } : null;
    }
    case 'strike': {
      const targets = others.filter((o) => o.boosts.length).sort((a, b) => b.banked.length - a.banked.length);
      if (!targets.length) return null;
      const pay = payFor(s, me, def.cost);
      return pay ? { ...base, ...pay, target: targets[0].id, boostId: pick(s, targets[0].boosts).id } : null;
    }
    case 'bribe': {
      if (me.heat === 0 && !chance(s, 0.3)) return null;
      const pay = payFor(s, me, def.cost);
      return pay ? { ...base, ...pay } : null;
    }
    case 'warehouse':
    case 'front': {
      if (card.kind === 'front' && me.heat === 0 && !chance(s, 0.25)) return null;
      const pay = payFor(s, me, def.cost);
      return pay ? { ...base, ...pay } : null;
    }
    case 'expansion': {
      const b = me.boosts.find((b) => !b.expanded);
      const pay = payFor(s, me, def.cost);
      if (!pay) return null;
      return b ? { ...base, ...pay, boostId: b.id } : { ...base, ...pay }; // no Boost: it turns into two cards
    }
    case 'duplicator': {
      const c = me.res.find((c) => c.type === g && !me.boosts.some((b) => b.on === c.id));
      if (!c || countType(me, g) >= 5) return null;
      const pay = payFor(s, me, def.cost, [c.id]);
      return pay ? { ...base, ...pay, resId: c.id } : null;
    }
    default:
      return null;
  }
}

function takeTurn(s, me) {
  const g = goalType(me);

  // An easy bot often forgets to use its cards.
  const lazy = me.bot.skill === 0 && chance(s, 0.4);
  for (const card of lazy ? [] : me.hand) {
    const plan = planCard(s, me, card);
    if (plan) return plan;
  }

  const spare = junk(me);
  const partners = s.players.filter((o) => o.id !== me.id && o.res.length);
  if (!me.traded && spare.length && partners.length && chance(s, me.bot.skill === 0 ? 0.6 : 0.85)) {
    let to = pick(s, partners);
    if (insane(me)) { const holders = partners.filter((o) => (believed(me, o)[g] || []).length); if (holders.length) to = holders.sort((a, b) => believed(me, b)[g].length - believed(me, a)[g].length)[0]; }
    const card = pick(s, spare);
    let claim = card.type;
    // An insane bot does not lie about a card the table has already seen, or while it is hot enough to be watched.
    const exposed = insane(me) && (card.pub || isFaceUp(me, me.res.indexOf(card)) || me.heat >= 2 || me.caught >= 2);
    if (!exposed && chance(s, me.bot.liar * nerve(me, [to]))) {
      // Lie about it: claim whatever this partner seems to be collecting.
      const counts = believed(me, to);
      const guess = Object.keys(counts).sort((a, b) => counts[b].length - counts[a].length)[0];
      claim = guess || (me.bot.skill ? asksFor(to) : null) || pick(s, TYPES);
    }
    // With a bigger table, sometimes throw the offer open to everyone instead of picking one partner.
    const open = partners.length >= 2 && chance(s, insane(me) && (believed(me, to)[g] || []).length ? 0 : 0.35);
    return { type: 'offerTrade', to: open ? 'open' : to.id, cardId: card.id, claim, ask: g };
  }

  // End of turn: throw away what we need least.
  const overRes = me.res.length - slotLimit(me), overHand = me.hand.length - handLimit(me);
  if (overRes > 0 || overHand > 0) {
    const order = [...me.res].sort((a, b) => countType(me, a.type) - countType(me, b.type));
    const hand = [...me.hand].sort((a, b) => (CARD_WORTH[a.kind] || 0) - (CARD_WORTH[b.kind] || 0));
    return {
      type: 'discard',
      resIds: order.slice(0, Math.max(0, overRes)).map((c) => c.id),
      cardIds: hand.slice(0, Math.max(0, overHand)).map((c) => c.id),
    };
  }
  return { type: 'endTurn' };
}

// What to do when a bot's choice is rejected (should not happen; keeps games moving).
export function safeAction(s, pid) {
  const c = s.pending;
  if (c?.kind === 'whistle') return { type: 'whistlePick', resIds: s.players[c.accused].res.slice(0, c.need).map((r) => r.id) };
  if (c?.kind === 'alibi') return { type: 'alibiResponse', use: false };
  if (c?.kind === 'tip') return { type: 'tipPick', keep: c.cards[0].id };
  if (c?.kind === 'dup') { const p = s.players[c.player]; return { type: 'moveDup', resId: p.res.find((x) => !p.boosts.some((b) => b.kind === 'duplicator' && b.on === x.id)).id }; }
  if (c?.kind === 'power') return c.cards ? { type: 'power', keep: c.cards[0].id } : { type: 'power', use: false };
  if (c?.kind === 'cost') return { type: 'costResponse', choice: 'pass' };
  if (c?.kind === 'trade') return c.stage === 'response' ? { type: 'respondTrade', choice: 'decline' } : { type: 'finishTrade', choice: 'accept' };
  const me = s.players[pid];
  const overRes = me.res.length - slotLimit(me), overHand = me.hand.length - handLimit(me);
  if (overRes > 0 || overHand > 0) {
    return { type: 'discard', resIds: me.res.slice(0, Math.max(0, overRes)).map((c) => c.id), cardIds: me.hand.slice(0, Math.max(0, overHand)).map((c) => c.id) };
  }
  return { type: 'endTurn' };
}
