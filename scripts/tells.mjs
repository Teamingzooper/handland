// How well does behaviour give away a hidden monopoly? Plays many bot games and, every time a bot starts its turn,
// looks at each other player's public record (engine.js "tells") next to the truth (are they holding?).
// Prints how often a player with each combination of signs really was holding. Used to tune the bots' read in bots.js.
// Run with:  node scripts/tells.mjs [games] [difficulty 0-3] [players]
import { newGame, applyAction, actors, isFaceUp } from '../src/engine.js';
import { botAction, safeAction, holdRead, tellSigns, signVector } from '../src/bots.js';

const games = Number(process.argv[2]) || 800, difficulty = Number(process.argv[3] ?? 1), players = Number(process.argv[4]) || 4;
const names = Array.from({ length: players }, (_, i) => `P${i}`);
const table = {}, add = (key, hold) => { const r = (table[key] ||= [0, 0]); r[0]++; if (hold) r[1]++; };
const buckets = Array.from({ length: 10 }, () => [0, 0]);
let samples = 0, holding = 0;
const X = [], Y = [], impossible = [0, 0];
for (let g = 0; g < games; g++) {
  const s = newGame({ names, bots: names.map(() => true), seed: 9000 + g, difficulty });
  for (let i = 0; i < 20000 && s.phase !== 'over'; i++) {
    const id = actors(s)[0], me = s.players[id];
    if (!s.pending && id === s.turn && !me.sampled) {
      me.sampled = s.turnNumber;
      for (const o of s.players) if (o.id !== id) {
        const t = o.tell, known = Math.max(0, ...Object.values(o.res.reduce((m, c, k) => { const ty = isFaceUp(o, k) ? c.type : me.mem[c.id]; if (ty) m[ty] = (m[ty] || 0) + 1; return m; }, {})));
        samples++; if (o.holding) holding++;
        add(`still ${Math.min(2, t.still)}`, o.holding); add(`quiet ${Math.min(4, t.quiet)}`, o.holding); add(`known ${known}`, o.holding);
        add(`still ${Math.min(2, t.still)} + quiet ${t.quiet >= 2 ? '2+' : t.quiet}`, o.holding);
        add(`still ${Math.min(2, t.still)} + known ${Math.min(3, known)}`, o.holding);
        add(`cards ${Math.min(6, o.res.length)}`, o.holding);
        const sg = tellSigns(s, me, o); if (sg.possible) { X.push(signVector(sg)); Y.push(o.holding ? 1 : 0); } else { impossible[0]++; if (o.holding) impossible[1]++; }
        if (holdRead) { const p = holdRead(s, me, o, 3); const b = buckets[Math.min(9, Math.floor(p * 10))]; b[0]++; if (o.holding) b[1]++; }
      }
    }
    if (me.sampled && me.sampled !== s.turnNumber) me.sampled = 0;
    const a = botAction(s, id);
    if (applyAction(s, id, a).error) applyAction(s, id, safeAction(s, id));
  }
}
console.log(`${games} games, difficulty ${difficulty}: ${samples} looks at another player, ${(100 * holding / samples).toFixed(1)}% were holding`);
for (const k of Object.keys(table).sort()) console.log(k.padEnd(26), String(table[k][0]).padStart(7), `${(100 * table[k][1] / table[k][0]).toFixed(1)}%`.padStart(7));
if (holdRead) { console.log('\nthe read (full strength): what it said vs how often that was true'); buckets.forEach((b, i) => { if (b[0]) console.log(`${i * 10}-${i * 10 + 10}%`.padEnd(10), String(b[0]).padStart(7), `${(100 * b[1] / b[0]).toFixed(1)}%`.padStart(7)); }); }

// Fit the weights: plain logistic regression by gradient descent.
const n = X[0].length, w = new Array(n).fill(0);
for (let it = 0; it < 4000; it++) {
  const grad = new Array(n).fill(0);
  for (let i = 0; i < X.length; i++) { let z = 0; for (let j = 0; j < n; j++) z += w[j] * X[i][j]; const e = 1 / (1 + Math.exp(-z)) - Y[i]; for (let j = 0; j < n; j++) grad[j] += e * X[i][j]; }
  for (let j = 0; j < n; j++) w[j] -= (2.5 * grad[j]) / X.length;
}
console.log(`\n"cannot be holding" (ruled out by cards seen): ${impossible[0]} looks, ${impossible[1]} wrong`);
console.log('fitted weights for READ in src/bots.js:\n[' + w.map((v) => v.toFixed(2)).join(', ') + ']');
