// Card usage report: plays many bot games and records what happens to every Action and Boost card.
// Run with:  node scripts/cardstats.mjs [games] [difficulty 0-3] [players]
import { newGame, applyAction, actors, CARDS } from '../src/engine.js';
import { botAction, safeAction } from '../src/bots.js';

const games = Number(process.argv[2]) || 1500, difficulty = Number(process.argv[3] ?? 1), players = Number(process.argv[4]) || 4;
const K = Object.keys(CARDS), z = () => Object.fromEntries(K.map((k) => [k, 0]));
const drawn = z(), played = z(), worked = z(), busted = z(), discarded = z(), leftInHand = z(), dwell = z();
let rounds = 0, holds = 0, broken = 0, tokens = 0, whistleRight = 0, whistleWrong = 0, lawsuitRight = 0, lawsuitWrong = 0, calls = 0, callsRight = 0, trades = 0, openOffers = 0, finished = 0;
const names = Array.from({ length: players }, (_, i) => `P${i}`);
for (let g = 0; g < games; g++) {
  const s = newGame({ names, bots: names.map(() => true), seed: 7000 + g, difficulty });
  const seen = new Set(); let lastFx = 0;
  const scan = () => { for (const p of s.players) for (const c of p.hand) if (!seen.has(c.id)) { seen.add(c.id); drawn[c.kind]++; } };
  scan();
  for (let i = 0; i < 20000 && s.phase !== 'over'; i++) {
    const id = actors(s)[0], a = botAction(s, id), me = s.players[id];
    if (a.type === 'discard') for (const cid of a.cardIds || []) { const c = me.hand.find((h) => h.id === cid); if (c) discarded[c.kind]++; }
    if (a.type === 'endTurn') for (const c of me.hand) dwell[c.kind]++;
    if ((a.type === 'costResponse' || a.type === 'respondTrade' || a.type === 'finishTrade') && a.choice === 'call' && a.lawsuit) me.suing = true;
    if (a.type === 'offerTrade') { trades++; if (a.to === 'open') openOffers++; }
    if (applyAction(s, id, a).error) applyAction(s, id, safeAction(s, id));
    for (const f of s.fx) {
      if (f.n <= lastFx) continue;
      lastFx = f.n;
      if (f.type === 'play') played[f.kind]++;
      if (f.type === 'resolve') worked[f.kind]++;
      if (f.type === 'bust') busted[f.kind]++;
      if (f.type === 'whistle') { played.whistleblower++; if (f.right) whistleRight++; else whistleWrong++; }
      if (f.type === 'alibi') played.alibi++;
      if (f.type === 'hold') holds++;
      if (f.type === 'broken') broken++;
      if (f.type === 'token') tokens++;
      if (f.type === 'call') { calls++; if (f.lie) callsRight++; if (f.lawsuit) { played.lawsuit++; if (f.lie) lawsuitRight++; else lawsuitWrong++; } }
    }
    scan();
  }
  if (s.phase === 'over') finished++;
  rounds += s.turnNumber / players;
  for (const p of s.players) for (const c of p.hand) leftInHand[c.kind]++;
}
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');
console.log(`${games} games, ${players} players, difficulty ${difficulty}: ${finished} finished, ${(rounds / games).toFixed(1)} rounds on average`);
console.log(`holds started ${(holds / games).toFixed(2)}/game, broken ${pct(broken, holds)}, tokens ${(tokens / games).toFixed(2)}/game | calls ${(calls / games).toFixed(1)}/game, ${pct(callsRight, calls)} right | trades ${(trades / games).toFixed(1)}/game, ${pct(openOffers, trades)} open`);
console.log(`Whistleblower: right ${pct(whistleRight, whistleRight + whistleWrong)} of ${((whistleRight + whistleWrong) / games).toFixed(2)}/game | Lawsuit: right ${pct(lawsuitRight, lawsuitRight + lawsuitWrong)} of ${((lawsuitRight + lawsuitWrong) / games).toFixed(2)}/game`);
console.log('card            copies  drawn/game  played   busted  discarded  turns in hand per draw');
for (const k of K) console.log(`${CARDS[k].name.padEnd(15)} ${String(CARDS[k].copies).padStart(4)}   ${(drawn[k] / games).toFixed(1).padStart(7)}     ${pct(played[k], drawn[k]).padStart(5)}   ${(CARDS[k].cost.length ? pct(busted[k], played[k]) : '-').padStart(5)}   ${pct(discarded[k], drawn[k]).padStart(6)}     ${(dwell[k] / Math.max(1, drawn[k])).toFixed(2)}`);
