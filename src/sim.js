// Bots play each other many times. Used to tune game length and catch engine bugs.
import { newGame, applyAction, actors } from './engine.js';
import { botAction, safeAction } from './bots.js';

export function playOut(seed, nPlayers = 4, winTarget = 2, maxSteps = 20000) {
  const names = Array.from({ length: nPlayers }, (_, i) => `Bot${i + 1}`);
  const s = newGame({ names, bots: names.map(() => true), seed, winTarget });
  let steps = 0, rejected = 0;
  while (s.phase !== 'over' && steps++ < maxSteps) {
    const pid = actors(s)[0];
    const r = applyAction(s, pid, botAction(s, pid));
    if (r.error) {
      rejected++;
      const r2 = applyAction(s, pid, safeAction(s, pid));
      if (r2.error) throw new Error(`stuck: ${r.error} / ${r2.error}`);
    }
  }
  return { s, steps, rejected, finished: s.phase === 'over' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const games = Number(process.argv[2] || 500);
  for (const [n, target] of [[2, 2], [3, 2], [4, 2], [6, 2], [4, 1]]) {
    let rounds = 0, unfinished = 0, rejected = 0;
    const st = { calls: 0, rightCalls: 0, trades: 0, plays: 0, lies: 0 };
    const wins = Array(n).fill(0);
    for (let g = 0; g < games; g++) {
      const { s, finished, rejected: rj } = playOut(1000 + g, n, target);
      if (!finished) { unfinished++; continue; }
      rounds += s.turnNumber / n;
      rejected += rj;
      wins[s.winner]++;
      for (const k in st) st[k] += s.stats[k];
    }
    const done = games - unfinished;
    console.log(`${n} players, first to ${target}: avg ${(rounds / done).toFixed(1)} rounds | unfinished ${unfinished} | rejected ${rejected}`
      + ` | per game: trades ${(st.trades / done).toFixed(1)}, plays ${(st.plays / done).toFixed(1)}, lies ${(st.lies / done).toFixed(1)}, calls ${(st.calls / done).toFixed(1)} (${Math.round(100 * st.rightCalls / Math.max(1, st.calls))}% right) | wins by seat ${wins.join('/')}`);
  }
}
