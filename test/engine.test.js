import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction, viewFor, actors, payCheck, CARDS, POWERS, countType, slotLimit, handLimit } from '../src/engine.js';
import { playOut } from '../src/sim.js';
import { botAction, holdRead, tellSigns } from '../src/bots.js';

function game(n = 3) {
  const s = newGame({ names: ['A', 'B', 'C'].slice(0, n), seed: 42 });
  s.turn = 0; s.pending = null;
  s.players.forEach((p) => { p.traded = false; });
  return s;
}
const setRes = (s, pid, types) => { s.players[pid].res = types.map((type) => ({ id: s.nextId++, type })); };
const ok = (r) => assert.deepEqual(r, { ok: true });

test('honest trade swaps cards', () => {
  const s = game();
  setRes(s, 0, ['Oil', 'Oil', 'Oil', 'Oil', 'Workers']); setRes(s, 1, ['Oil', 'Farmland', 'Farmland', 'Farmland', 'Farmland']);
  const give = s.players[0].res[4].id, back = s.players[1].res[0].id;
  ok(applyAction(s, 0, { type: 'offerTrade', to: 1, cardId: give, claim: 'Workers', ask: 'Oil' }));
  ok(applyAction(s, 1, { type: 'respondTrade', choice: 'trade', cardId: back, claim: 'Oil' }));
  ok(applyAction(s, 0, { type: 'finishTrade', choice: 'accept' }));
  assert.equal(countType(s.players[0], 'Oil'), 5);
  assert.equal(countType(s.players[1], 'Workers'), 1);
  assert.match(applyAction(s, 0, { type: 'offerTrade', to: 1, cardId: s.players[0].res[0].id, claim: 'Oil', ask: 'Oil' }).error, /already/);
});

test('calling a scam correctly: caller keeps both cards and gains Cover', () => {
  const s = game();
  setRes(s, 0, ['Livestock', 'Oil']); setRes(s, 1, ['Farmland', 'Farmland']);
  ok(applyAction(s, 0, { type: 'offerTrade', to: 1, cardId: s.players[0].res[0].id, claim: 'Oil', ask: 'Farmland' }));
  ok(applyAction(s, 1, { type: 'respondTrade', choice: 'call', cardId: s.players[1].res[0].id }));
  assert.equal(s.players[1].res.length, 3);
  assert.equal(s.players[0].res.length, 1);
  assert.equal(s.players[1].cover, 1);
  assert.equal(s.reveal.lie, true);
});

test('calling an honest trade: trader keeps both, caller gains Heat, Heat reveals a card', () => {
  const s = game();
  setRes(s, 0, ['Oil', 'Oil']); setRes(s, 1, ['Farmland', 'Farmland']);
  ok(applyAction(s, 0, { type: 'offerTrade', to: 1, cardId: s.players[0].res[0].id, claim: 'Oil', ask: 'Farmland' }));
  ok(applyAction(s, 1, { type: 'respondTrade', choice: 'call', cardId: s.players[1].res[0].id }));
  assert.equal(s.players[0].res.length, 3);
  assert.equal(s.players[1].heat, 1);
  const seen = viewFor(s, 2).players[1].res;
  assert.equal(seen[0].faceUp, true);
  assert.equal(seen[0].type, 'Farmland');
});

test('hidden cards stay hidden from other players', () => {
  const s = game();
  const v = viewFor(s, 2);
  assert.ok(v.players[0].res.every((r) => r.type === null));
  assert.equal(v.players[0].hand, null);
  assert.ok(v.players[2].res.every((r) => r.type !== null));
});

test('cost bluff: a caught lie busts the play; an uncalled lie works', () => {
  const s = game();
  setRes(s, 0, ['Oil', 'Oil', 'Oil']);
  s.players[0].hand = [{ id: 900, kind: 'warehouse' }, { id: 901, kind: 'warehouse' }];
  ok(applyAction(s, 0, { type: 'playCard', cardId: 900, payment: [s.players[0].res[0].id] }));
  ok(applyAction(s, 1, { type: 'costResponse', choice: 'call' }));
  assert.equal(s.players[0].boosts.length, 0);
  assert.equal(s.players[1].cover, 1);
  ok(applyAction(s, 0, { type: 'playCard', cardId: 901, payment: [s.players[0].res[0].id] }));
  ok(applyAction(s, 1, { type: 'costResponse', choice: 'pass' }));
  ok(applyAction(s, 2, { type: 'costResponse', choice: 'pass' }));
  assert.equal(s.players[0].boosts.length, 1);
  assert.equal(slotLimit(s.players[0]), 6);
});

test('monopoly: secret one-round hold scores a token, no perks, wins at target', () => {
  const s = game(2);
  s.winTarget = 1;
  setRes(s, 0, ['Oil', 'Oil', 'Oil', 'Oil', 'Oil']);
  s.players[0].hand = []; s.players[1].hand = [];
  ok(applyAction(s, 0, { type: 'endTurn' }));
  assert.equal(s.players[0].holding, 'Oil');
  assert.equal(slotLimit(s.players[0]), 5);
  assert.equal(handLimit(s.players[0]), 3);
  assert.equal(viewFor(s, 1).players[0].holding, null, 'the hold is secret');
  assert.ok(viewFor(s, 1).players[0].res.every((r) => r.type === null));
  setRes(s, 1, ['Farmland']); s.players[1].hand = [];
  ok(applyAction(s, 1, { type: 'endTurn' }));
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 0);
});

test('scoring discards the 5 cards and draws back up; Forced Trade breaks a hold', () => {
  const s = game(2);
  setRes(s, 0, ['Oil', 'Oil', 'Oil', 'Oil', 'Oil']); s.players[0].hand = [];
  ok(applyAction(s, 0, { type: 'endTurn' }));
  setRes(s, 1, ['Weapons', 'Oil', 'Farmland']);
  s.players[1].hand = [{ id: 950, kind: 'forcedTrade' }];
  const [w, o, f] = s.players[1].res.map((c) => c.id);
  ok(applyAction(s, 1, { type: 'playCard', cardId: 950, payment: [w], target: 0, theirId: s.players[0].res[0].id }));
  ok(applyAction(s, 0, { type: 'costResponse', choice: 'pass' }));
  assert.equal(s.players[0].holding, null);
  assert.equal(s.players[0].banked.length, 0);

  const g = game(2);
  setRes(g, 0, ['Oil', 'Oil', 'Oil', 'Oil', 'Oil']); g.players[0].hand = [];
  ok(applyAction(g, 0, { type: 'endTurn' }));
  setRes(g, 1, ['Farmland']); g.players[1].hand = [];
  ok(applyAction(g, 1, { type: 'endTurn' }));
  assert.deepEqual(g.players[0].banked, ['Oil']);
  assert.equal(g.players[0].res.length, 5); // 5 new cards
  assert.equal(g.phase, 'main');
});

test('Duplicator counts double and goes with its card when the owner trades the card away', () => {
  const s = game();
  setRes(s, 0, ['Oil', 'Oil', 'Oil', 'Oil', 'Livestock']);
  s.players[0].hand = [{ id: 960, kind: 'duplicator' }];
  const r = s.players[0].res;
  ok(applyAction(s, 0, { type: 'playCard', cardId: 960, payment: [r[4].id], resId: r[0].id }));
  ok(applyAction(s, 1, { type: 'costResponse', choice: 'pass' }));
  ok(applyAction(s, 2, { type: 'costResponse', choice: 'pass' }));
  assert.equal(countType(s.players[0], 'Oil'), 5);
  // Put into a trade it is only out for the moment: the Duplicator waits. Traded away for good, it goes with the card.
  setRes(s, 1, ['Farmland', 'Farmland']);
  ok(applyAction(s, 0, { type: 'offerTrade', to: 1, cardId: s.players[0].res[0].id, claim: 'Oil', ask: 'Farmland' }));
  assert.equal(s.players[0].boosts.length, 1);
  ok(applyAction(s, 1, { type: 'respondTrade', choice: 'trade', cardId: s.players[1].res[0].id, claim: 'Farmland' }));
  ok(applyAction(s, 0, { type: 'finishTrade', choice: 'accept' }));
  assert.equal(s.players[0].boosts.length, 0);
});

test('bots always finish a game with no rejected moves', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const { finished, rejected } = playOut(seed, 2 + (seed % 5), 1 + (seed % 2));
    assert.ok(finished, `seed ${seed} did not finish`);
    assert.equal(rejected, 0, `seed ${seed} had rejected bot moves`);
  }
});

test('lie counts stay secret until the game is over', () => {
  const s = game();
  setRes(s, 0, ['Livestock', 'Oil']); setRes(s, 1, ['Farmland', 'Farmland']);
  ok(applyAction(s, 0, { type: 'offerTrade', to: 1, cardId: s.players[0].res[0].id, claim: 'Oil', ask: 'Farmland' }));
  assert.equal(s.players[0].stats.lies, 1);
  assert.equal(viewFor(s, 1).players[0].stats, null);
  s.phase = 'over';
  assert.equal(viewFor(s, 1).players[0].stats.lies, 1);
});

test('Forced Trade steals a card and gives nothing back', () => {
  const s = game(2);
  setRes(s, 0, ['Weapons', 'Oil', 'Farmland']); setRes(s, 1, ['Workers', 'Workers']);
  s.players[0].hand = [{ id: 960, kind: 'forcedTrade' }];
  const [w, o] = s.players[0].res.map((c) => c.id), theirs = s.players[1].res[0].id;
  ok(applyAction(s, 0, { type: 'playCard', cardId: 960, payment: [w], target: 1, theirId: theirs }));
  ok(applyAction(s, 1, { type: 'costResponse', choice: 'pass' }));
  assert.deepEqual(s.players[0].res.map((c) => c.type), ['Oil', 'Farmland', 'Workers']);
  void o;
  assert.equal(s.players[1].res.length, 1);
});

test('Whistleblower: right call takes two cards and breaks the hold; wrong call costs 1 Heat', () => {
  const s = game(3);
  setRes(s, 0, ['Oil', 'Oil', 'Oil', 'Oil', 'Oil']); s.players[0].hand = [];
  ok(applyAction(s, 0, { type: 'endTurn' }));
  assert.equal(s.players[0].holding, 'Oil');
  // player 2 plays it out of turn (it is player 1's turn)
  s.players[2].hand = [{ id: 970, kind: 'whistleblower' }, { id: 971, kind: 'whistleblower' }];
  ok(applyAction(s, 2, { type: 'whistle', target: 0 }));
  assert.equal(s.pending.kind, 'whistle');
  assert.deepEqual(actors(s), [2]);
  assert.ok(applyAction(s, 1, { type: 'endTurn' }).error, 'everyone waits for the pick');
  assert.ok(viewFor(s, 2).players[0].res.every((r) => r.type === 'Oil'), 'the caller sees the cards');
  ok(applyAction(s, 2, { type: 'whistlePick', resIds: s.players[0].res.slice(0, 2).map((c) => c.id) }));
  assert.equal(s.pending, null);
  assert.equal(s.players[0].res.length, 3);
  assert.equal(s.players[0].holding, null);
  assert.equal(s.players[2].res.filter((c) => c.type === 'Oil').length >= 2, true, 'the caller keeps the two cards');
  // second one, now nobody is holding
  ok(applyAction(s, 2, { type: 'whistle', target: 0 }));
  assert.equal(s.players[2].heat, 1);
  assert.equal(s.pending, null);
  assert.ok(applyAction(s, 2, { type: 'whistle', target: 0 }).error, 'no card left');
});

test('Whistleblower can interrupt a trade, which then carries on', () => {
  const s = game(3);
  setRes(s, 0, ['Oil', 'Oil', 'Oil', 'Oil', 'Oil']); s.players[0].hand = [];
  ok(applyAction(s, 0, { type: 'endTurn' }));
  setRes(s, 1, ['Farmland', 'Workers']); setRes(s, 2, ['Weapons']);
  ok(applyAction(s, 1, { type: 'offerTrade', to: 2, cardId: s.players[1].res[0].id, claim: 'Farmland', ask: 'Weapons' }));
  s.players[2].hand = [{ id: 980, kind: 'whistleblower' }];
  ok(applyAction(s, 2, { type: 'playCard', cardId: 980, target: 0 }));
  ok(applyAction(s, -1, { type: 'timeout' }));
  assert.equal(s.pending.kind, 'trade');
  assert.equal(s.players[0].res.length, 3);
  ok(applyAction(s, 2, { type: 'respondTrade', choice: 'decline' }));
});

test('a card offered in a trade stays hidden from the other side, even if they saw it before, until Espionage is used', () => {
  const s = game(2);
  setRes(s, 0, ['Oil', 'Workers']); setRes(s, 1, ['Farmland']);
  const give = s.players[0].res[0];
  s.players[1].known[give.id] = give.type; // player 1 has seen this card earlier in the game
  ok(applyAction(s, 0, { type: 'offerTrade', to: 1, cardId: give.id, claim: 'Weapons', ask: 'Farmland' }));
  assert.equal(viewFor(s, 1).pending.offerType, null);
  assert.equal(viewFor(s, 0).pending.offerType, 'Oil');
  s.players[1].hand = [{ id: 990, kind: 'espionage' }];
  ok(applyAction(s, 1, { type: 'peekTrade' }));
  assert.equal(viewFor(s, 1).pending.offerType, 'Oil');
});

test('a wrong Whistleblower costs one step on the Heat/Cover scale: Cover first, so nobody holds both', () => {
  for (const [cover, wantCover, wantHeat] of [[2, 1, 0], [1, 0, 0], [0, 0, 1]]) {
    const s = game(2);
    s.players[0].hand = [{ id: 995, kind: 'whistleblower' }]; s.players[0].cover = cover; s.players[0].heat = 0;
    ok(applyAction(s, 0, { type: 'whistle', target: 1 }));
    assert.deepEqual([s.players[0].cover, s.players[0].heat], [wantCover, wantHeat]);
  }
});

test('an open offer goes clockwise; the first player to answer gets the trade, and a pass moves it on', () => {
  const s = game(3);
  setRes(s, 0, ['Oil', 'Workers']); setRes(s, 1, ['Farmland']); setRes(s, 2, ['Weapons']);
  const give = s.players[0].res[0].id;
  ok(applyAction(s, 0, { type: 'offerTrade', to: 'open', cardId: give, claim: 'Oil', ask: 'Weapons' }));
  assert.deepEqual(actors(s), [1]);
  assert.ok(applyAction(s, 2, { type: 'respondTrade', choice: 'decline' }).error, 'player 2 must wait their turn');
  ok(applyAction(s, 1, { type: 'respondTrade', choice: 'decline' }));
  assert.deepEqual(actors(s), [2]);
  ok(applyAction(s, 2, { type: 'respondTrade', choice: 'trade', cardId: s.players[2].res[0].id, claim: 'Weapons' }));
  ok(applyAction(s, 0, { type: 'finishTrade', choice: 'accept' }));
  assert.deepEqual(s.players[0].res.map((c) => c.type).sort(), ['Weapons', 'Workers']);
  assert.deepEqual(s.players[2].res.map((c) => c.type), ['Oil']);

  const g = game(3);
  setRes(g, 0, ['Oil']); setRes(g, 1, ['Farmland']); setRes(g, 2, ['Weapons']);
  ok(applyAction(g, 0, { type: 'offerTrade', to: 'open', cardId: g.players[0].res[0].id, claim: 'Oil', ask: 'Weapons' }));
  ok(applyAction(g, -1, { type: 'timeout' })); ok(applyAction(g, -1, { type: 'timeout' }));
  assert.equal(g.pending, null);
  assert.equal(g.players[0].res.length, 1, 'nobody took it, so the card comes back');
});

test('payment calls go clockwise: only the next player in seat order may pass or call', () => {
  const s = game(3);
  setRes(s, 0, ['Farmland', 'Oil']); s.players[0].hand = [{ id: 901, kind: 'warehouse' }];
  ok(applyAction(s, 0, { type: 'playCard', cardId: 901, payment: [s.players[0].res[0].id] }));
  assert.deepEqual(actors(s), [1]);
  assert.ok(applyAction(s, 2, { type: 'costResponse', choice: 'call' }).error, 'player 2 is not next yet');
  ok(applyAction(s, 1, { type: 'costResponse', choice: 'pass' }));
  assert.deepEqual(actors(s), [2]);
  ok(applyAction(s, 2, { type: 'costResponse', choice: 'pass' }));
  assert.equal(s.players[0].boosts.length, 1);
});

test('rows are never rearranged, so a peeked card stays marked while it lies there', () => {
  const s = game(2);
  setRes(s, 0, ['Oil', 'Workers']); setRes(s, 1, ['Farmland', 'Weapons']);
  s.players[0].hand = [{ id: 902, kind: 'espionage' }];
  const target = s.players[1].res[0];
  ok(applyAction(s, 0, { type: 'playCard', cardId: 902, payment: [], target: 1, resId: target.id }));
  ok(applyAction(s, 0, { type: 'endTurn' })); // player 1 refills; the peeked card has not moved
  assert.equal(viewFor(s, 0).players[1].res[0].known, true);
});

test('Write-Off discards from the right end of the row and draws the same number', () => {
  const s = game(2);
  setRes(s, 0, ['Oil', 'Oil', 'Farmland', 'Weapons', 'Workers']);
  s.players[0].hand = [{ id: 903, kind: 'writeoff' }, { id: 904, kind: 'writeoff' }];
  const keep = s.players[0].res.slice(0, 3).map((c) => c.id), gone = s.players[0].res.slice(3).map((c) => c.id);
  assert.ok(applyAction(s, 0, { type: 'playCard', cardId: 903, payment: [], count: 4 }).error, 'three at most');
  ok(applyAction(s, 0, { type: 'playCard', cardId: 903, payment: [], count: 2 }));
  assert.equal(s.pending, null, 'it is free, so nobody can call it');
  assert.deepEqual(s.players[0].res.slice(0, 3).map((c) => c.id), keep, 'the left cards stay where they were');
  assert.equal(s.players[0].res.length, 5);
  assert.ok(s.players[0].res.every((c) => !gone.includes(c.id)), 'the two rightmost cards are gone');
});

test('a two-card cost checks both cards, in any order', () => {
  const was = CARDS.forcedTrade.cost; CARDS.forcedTrade.cost = ['Weapons', 'Oil']; // no card costs two at the moment; the rule still has to hold
  // Weapons + Oil paid as Oil then Weapons is honest
  let s = game(2);
  setRes(s, 0, ['Oil', 'Weapons', 'Farmland']); setRes(s, 1, ['Workers', 'Workers']);
  s.players[0].hand = [{ id: 910, kind: 'forcedTrade' }];
  let [o, w] = s.players[0].res.map((c) => c.id);
  ok(applyAction(s, 0, { type: 'playCard', cardId: 910, payment: [o, w], target: 1, theirId: s.players[1].res[0].id }));
  ok(applyAction(s, 1, { type: 'costResponse', choice: 'call' }));
  assert.equal(s.reveal.lie, false, 'both cards are there, so the caller is wrong');
  assert.deepEqual(s.reveal.cards.map((c) => c.type).sort(), ['Oil', 'Weapons']);
  // first card right, second card wrong: still a lie, and the reveal shows both
  s = game(2);
  setRes(s, 0, ['Weapons', 'Farmland', 'Farmland']); setRes(s, 1, ['Workers', 'Workers']);
  s.players[0].hand = [{ id: 911, kind: 'forcedTrade' }];
  const [w2, f2] = s.players[0].res.map((c) => c.id);
  ok(applyAction(s, 0, { type: 'playCard', cardId: 911, payment: [w2, f2], target: 1, theirId: s.players[1].res[0].id }));
  ok(applyAction(s, 1, { type: 'costResponse', choice: 'call' }));
  assert.equal(s.reveal.lie, true);
  assert.deepEqual(s.reveal.cards, [{ type: 'Weapons', ok: true }, { type: 'Farmland', ok: false }]);
  // two of the same when one of each is needed is a lie
  assert.deepEqual(payCheck(['Weapons', 'Oil'], ['Oil', 'Oil']), [false, true]);
  CARDS.forcedTrade.cost = was;
});

test('a spectator sees no hidden cards, no hands and no secret holds', () => {
  const s = game(3);
  setRes(s, 0, ['Oil', 'Oil', 'Oil', 'Oil', 'Oil']); s.players[0].hand = [];
  ok(applyAction(s, 0, { type: 'endTurn' }));
  assert.equal(s.players[0].holding, 'Oil');
  const v = viewFor(s, -1);
  assert.ok(v.players.every((p) => p.hand === null), 'no hands');
  assert.ok(v.players.every((p) => p.res.every((r) => r.type === null || r.faceUp)), 'face-down cards stay face down');
  assert.ok(v.players.every((p) => p.holding === null), 'holds stay secret');
});

test('Insane bots play whole games without an illegal move', () => {
  for (let g = 0; g < 12; g++) {
    const s = newGame({ names: ['a', 'b', 'c', 'd'], bots: [true, true, true, true], seed: 300 + g, difficulty: 3 });
    for (let i = 0; i < 20000 && s.phase !== 'over'; i++) { const id = actors(s)[0]; assert.deepEqual(applyAction(s, id, botAction(s, id)), { ok: true }); }
    assert.equal(s.phase, 'over');
  }
});

test('Alibi cancels a call on a payment: nothing is revealed, nobody is penalised, and the card still works', () => {
  const s = game(2);
  setRes(s, 0, ['Oil', 'Oil']); setRes(s, 1, ['Workers']);
  s.players[0].hand = [{ id: 920, kind: 'warehouse' }, { id: 921, kind: 'alibi' }];
  ok(applyAction(s, 0, { type: 'playCard', cardId: 920, payment: [s.players[0].res[0].id] })); // a bluff: Warehouse costs Farmland
  ok(applyAction(s, 1, { type: 'costResponse', choice: 'call' }));
  assert.equal(s.pending.kind, 'alibi');
  assert.deepEqual(actors(s), [0]);
  ok(applyAction(s, 0, { type: 'alibiResponse', use: true }));
  assert.equal(s.pending, null);
  assert.equal(s.players[0].boosts.length, 1, 'the Warehouse was built');
  assert.equal(s.players[0].heat + s.players[1].heat + s.players[0].cover + s.players[1].cover, 0, 'no penalty either way');
  assert.equal(s.reveal, null, 'nothing was turned over');
  assert.equal(s.players[0].hand.some((c) => c.kind === 'alibi'), false);
});

test('without an Alibi a call resolves at once; holding one but declining lets it go ahead', () => {
  const s = game(2);
  setRes(s, 0, ['Oil', 'Oil']); setRes(s, 1, ['Workers']);
  s.players[0].hand = [{ id: 922, kind: 'warehouse' }, { id: 923, kind: 'alibi' }];
  ok(applyAction(s, 0, { type: 'playCard', cardId: 922, payment: [s.players[0].res[0].id] }));
  ok(applyAction(s, 1, { type: 'costResponse', choice: 'call' }));
  ok(applyAction(s, 0, { type: 'alibiResponse', use: false }));
  assert.equal(s.reveal.lie, true);
  assert.equal(s.players[0].boosts.length, 0);
});

test('Alibi cancels a Whistleblower; the interrupted play carries on', () => {
  const s = game(3);
  setRes(s, 0, ['Oil', 'Oil', 'Oil', 'Oil', 'Oil']); s.players[0].hand = [{ id: 924, kind: 'alibi' }];
  ok(applyAction(s, 0, { type: 'endTurn' }));
  s.players[2].hand = [{ id: 925, kind: 'whistleblower' }];
  ok(applyAction(s, 2, { type: 'whistle', target: 0 }));
  assert.equal(s.pending.kind, 'alibi');
  ok(applyAction(s, 0, { type: 'alibiResponse', use: true }));
  assert.equal(s.pending, null);
  assert.equal(s.players[0].res.length, 5, 'the hold is untouched');
  assert.equal(s.players[2].heat, 0);
});

test('Injunction stops a held monopoly from scoring for one turn, then it scores', () => {
  const s = game(2);
  setRes(s, 0, ['Oil', 'Oil', 'Oil', 'Oil', 'Oil']); s.players[0].hand = [];
  ok(applyAction(s, 0, { type: 'endTurn' }));
  setRes(s, 1, ['Oil', 'Farmland']); s.players[1].hand = [{ id: 926, kind: 'injunction' }];
  ok(applyAction(s, 1, { type: 'playCard', cardId: 926, payment: [s.players[1].res[0].id], target: 0 }));
  ok(applyAction(s, 0, { type: 'costResponse', choice: 'pass' }));
  assert.equal(viewFor(s, 1).players[0].enjoined, true);
  s.players[1].hand = [];
  ok(applyAction(s, 1, { type: 'endTurn' }));
  assert.equal(s.players[0].banked.length, 0, 'not this turn');
  assert.equal(s.players[0].enjoined, false);
  s.players[0].hand = [];
  ok(applyAction(s, 0, { type: 'endTurn' }));
  s.players[1].hand = [];
  ok(applyAction(s, 1, { type: 'endTurn' }));
  assert.equal(s.players[0].banked.length, 1, 'it scores a round later');
});

test('Audit shows up to three hidden cards to the auditor only; Insider Tip keeps one of two', () => {
  const s = game(3);
  setRes(s, 0, ['Workers', 'Oil']); setRes(s, 1, ['Farmland', 'Farmland', 'Weapons', 'Oil']);
  s.players[0].hand = [{ id: 927, kind: 'audit' }, { id: 928, kind: 'tip' }];
  ok(applyAction(s, 0, { type: 'playCard', cardId: 927, payment: [s.players[0].res[0].id], target: 1 }));
  ok(applyAction(s, 1, { type: 'costResponse', choice: 'pass' }));
  ok(applyAction(s, 2, { type: 'costResponse', choice: 'pass' }));
  assert.equal(viewFor(s, 0).players[1].res.filter((r) => r.known).length, 3);
  assert.equal(viewFor(s, 2).players[1].res.filter((r) => r.known).length, 0);
  ok(applyAction(s, 0, { type: 'playCard', cardId: 928, payment: [] }));
  assert.equal(s.pending.kind, 'tip');
  assert.equal(viewFor(s, 0).pending.cards.length, 2);
  assert.equal(viewFor(s, 1).pending.cards, null, 'the others do not see the two cards');
  const before = s.players[0].hand.length;
  ok(applyAction(s, 0, { type: 'tipPick', keep: s.pending.cards[1].id }));
  assert.equal(s.players[0].hand.length, before + 1);
  assert.equal(s.pending, null);
});

test('Expansion with no Boost to expand draws two cards instead', () => {
  const s = game(2);
  setRes(s, 0, ['Oil', 'Workers']); setRes(s, 1, ['Farmland']);
  s.players[0].hand = [{ id: 929, kind: 'expansion' }];
  ok(applyAction(s, 0, { type: 'playCard', cardId: 929, payment: [s.players[0].res[0].id] }));
  ok(applyAction(s, 1, { type: 'costResponse', choice: 'pass' }));
  assert.equal(s.players[0].hand.length, 2);
});

test('the table sees how someone plays: quiet turns and passed-up calls are counted, activity resets them', () => {
  const s = game();
  s.players.forEach((p) => { p.hand = []; });
  setRes(s, 0, ['Oil', 'Oil', 'Oil', 'Oil', 'Workers']); setRes(s, 1, ['Farmland', 'Farmland', 'Farmland', 'Livestock', 'Livestock']);
  ok(applyAction(s, 0, { type: 'offerTrade', to: 1, cardId: s.players[0].res[4].id, claim: 'Workers', ask: 'Oil' }));
  ok(applyAction(s, 1, { type: 'respondTrade', choice: 'decline' }));
  assert.deepEqual([s.players[0].tell.offers, s.players[0].tell.asks.Oil, s.players[0].tell.gave.Workers], [1, 1, 1]);
  assert.equal(s.players[1].tell.quiet, 1); // B let the offer go
  s.players[0].hand = []; ok(applyAction(s, 0, { type: 'endTurn' }));
  assert.equal(s.players[0].tell.still, 0); // A did something this turn
  s.players[1].hand = []; s.players[1].res = s.players[1].res.slice(0, 5);
  ok(applyAction(s, 1, { type: 'endTurn' }));
  assert.equal(s.players[1].tell.still, 1); // B's whole turn went by with no offer and nothing spent
  assert.equal(s.players[1].tell.quiet, 2);
});

test('bots read a quiet player as more likely to be holding, by difficulty, and never when the cards rule it out', () => {
  const s = game();
  const me = s.players[0], o = s.players[1];
  me.bot = { skill: 3, liar: 0.3, sus: 1 };
  setRes(s, 1, ['Oil', 'Oil', 'Oil', 'Oil', 'Oil']);
  o.tell.turns = 2;
  const calm = holdRead(s, me, o, 3);
  o.tell.still = 1; o.tell.quiet = 3;
  const quiet = holdRead(s, me, o, 3);
  assert.ok(quiet > calm + 0.25, `quiet ${quiet} should be well above calm ${calm}`);
  assert.ok(holdRead(s, me, o, 2) < quiet && holdRead(s, me, o, 1) < holdRead(s, me, o, 2)); // Hard reads less into it, Normal less again
  assert.equal(holdRead(s, me, o, 0), holdRead({ ...s }, me, { ...o, tell: { ...o.tell, still: 0, quiet: 0 } }, 0)); // Easy does not read behaviour at all
  // I have seen three of their cards and they are three different things: five of a kind is impossible
  o.res.forEach((c, i) => { c.type = ['Oil', 'Farmland', 'Workers', 'Oil', 'Oil'][i]; });
  for (const c of o.res.slice(0, 3)) me.mem[c.id] = c.type;
  assert.equal(tellSigns(s, me, o).possible, false);
  assert.equal(holdRead(s, me, o, 3), 0);
});

test('an Insane bot blows the whistle on a player who has gone quiet, and says why', () => {
  const s = game();
  const me = s.players[0], o = s.players[1];
  me.bot = { skill: 3, liar: 0.3, sus: 1 };
  me.hand = [{ id: s.nextId++, kind: 'whistleblower' }];
  setRes(s, 0, ['Livestock', 'Livestock', 'Livestock', 'Livestock', 'Livestock']);
  setRes(s, 1, ['Oil', 'Oil', 'Oil', 'Oil', 'Oil']); o.holding = 'Oil'; o.hand = []; // no Alibi to hide behind
  o.tell.turns = 3; o.tell.still = 2; o.tell.quiet = 4;
  const a = botAction(s, 0);
  assert.deepEqual([a.type, a.target, a.why], ['whistle', 1, 'quiet']);
  ok(applyAction(s, 0, a));
  assert.equal(s.pending.kind, 'whistle'); // right: it now picks two of their cards
  assert.equal(s.fx.find((f) => f.type === 'whistle').why, 'quiet');
});

// Player 0 ends a turn holding five of `type`; the others pass their turns; play comes back round and it scores.
function scoreMonopoly(type, target = 2) {
  const s = game(); s.winTarget = target;
  s.players.forEach((p) => { p.hand = []; });
  setRes(s, 0, [type, type, type, type, type]);
  for (let i = 0; i < 3; i++) { const p = s.players[s.turn]; p.hand = []; p.res = p.res.slice(0, slotLimit(p)); ok(applyAction(s, s.turn, { type: 'endTurn' })); }
  return s;
}

test('scoring a monopoly offers that resource\'s power: Fracking draws two, and giving it up is allowed', () => {
  const s = scoreMonopoly('Oil');
  assert.deepEqual([s.pending.kind, s.pending.res, actors(s)], ['power', 'Oil', [0]]);
  assert.match(applyAction(s, 0, { type: 'endTurn' }).error, /Wait/); // nothing else until the power is used or given up
  const before = s.players[0].hand.length;
  ok(applyAction(s, 0, { type: 'power', use: true }));
  assert.equal(s.players[0].hand.length, before + 2);
  assert.equal(s.pending, null);
  const t = scoreMonopoly('Oil'); const h = t.players[0].hand.length;
  ok(applyAction(t, 0, { type: 'power', use: false }));
  assert.deepEqual([t.pending, t.players[0].hand.length], [null, h]);
  assert.equal(scoreMonopoly('Oil', 1).pending, null); // the winning token ends the game: no power
  assert.equal(Object.keys(POWERS).length, 5);
});

test('Stampede swaps everyone else\'s rightmost card; Shakedown takes a card; Boycott stops Action cards for one turn', () => {
  let s = scoreMonopoly('Livestock');
  const last = [1, 2].map((i) => s.players[i].res.at(-1).id), n = [1, 2].map((i) => s.players[i].res.length);
  ok(applyAction(s, 0, { type: 'power', use: true }));
  [1, 2].forEach((i, k) => { assert.equal(s.players[i].res.length, n[k]); assert.ok(!s.players[i].res.some((c) => c.id === last[k])); });

  s = scoreMonopoly('Weapons');
  const mine = s.players[0].res.length, theirs = s.players[1].res.length;
  assert.match(applyAction(s, 0, { type: 'power', use: true }).error, /Pick another player/);
  ok(applyAction(s, 0, { type: 'power', use: true, target: 1 }));
  assert.deepEqual([s.players[0].res.length, s.players[1].res.length], [mine + 1, theirs - 1]);

  s = scoreMonopoly('Workers');
  ok(applyAction(s, 0, { type: 'power', use: true, target: 1 }));
  assert.equal(viewFor(s, 2).players[1].boycott, true);
  s.players[0].res = s.players[0].res.slice(0, 5); s.players[0].hand = [];
  ok(applyAction(s, 0, { type: 'endTurn' }));
  s.players[1].hand = [{ id: s.nextId++, kind: 'espionage' }, { id: s.nextId++, kind: 'whistleblower' }];
  assert.match(applyAction(s, 1, { type: 'playCard', cardId: s.players[1].hand[0].id, payment: [], target: 0, resId: s.players[0].res[0].id }).error, /boycotted/);
  ok(applyAction(s, 1, { type: 'whistle', target: 2 })); // the whistle is not an Action played on your turn
  s.pending = null; s.players[1].hand = []; s.players[1].res = s.players[1].res.slice(0, 5);
  ok(applyAction(s, 1, { type: 'endTurn' }));
  assert.equal(s.players[1].boycott, false);
});

test('Harvest shows three cards to its owner only; one is kept and the other two go back on top in the chosen order', () => {
  const s = scoreMonopoly('Farmland');
  ok(applyAction(s, 0, { type: 'power', use: true }));
  const cards = s.pending.cards;
  assert.equal(viewFor(s, 0).pending.cards.length, 3);
  assert.deepEqual(viewFor(s, 1).pending.cards, []);
  const row = s.players[0].res.length, deck = s.resDeck.length;
  ok(applyAction(s, 0, { type: 'power', keep: cards[1].id, top: cards[2].id }));
  assert.equal(s.players[0].res.length, row + 1);
  assert.equal(s.players[0].res.at(-1).id, cards[1].id);
  assert.deepEqual(s.resDeck.slice(-2), [cards[0].type, cards[2].type]); // drawn from the end: cards[2] comes off first
  assert.equal(s.resDeck.length, deck + 2);
});

test('a card put into a trade leaves its place empty and goes back to that place', () => {
  const s = game();
  setRes(s, 0, ['Oil', 'Livestock', 'Farmland', 'Weapons']); setRes(s, 1, ['Workers', 'Workers']);
  s.players[0].heat = 2; // the two leftmost places are face up
  const row = () => s.players[0].res.map((c) => c.type);
  ok(applyAction(s, 0, { type: 'offerTrade', to: 1, cardId: s.players[0].res[1].id, claim: 'Livestock', ask: 'Workers' }));
  assert.deepEqual(row(), ['Oil', 'Farmland', 'Weapons']);
  assert.deepEqual(viewFor(s, 0).players[0].gaps, [1]);
  assert.deepEqual(viewFor(s, 1).players[0].res.map((r) => r.faceUp), [true, false, false], 'the empty place still counts: no extra card turns over');
  ok(applyAction(s, 1, { type: 'respondTrade', choice: 'decline' }));
  assert.deepEqual(row(), ['Oil', 'Livestock', 'Farmland', 'Weapons'], 'back where it was, not at the end');
  assert.deepEqual(s.players[0].gaps, []);
});

test('the offerer may call a trade off when the terms were changed, and both cards go back to their places', () => {
  const s = game();
  setRes(s, 0, ['Oil', 'Livestock', 'Farmland']); setRes(s, 1, ['Workers', 'Weapons', 'Oil']);
  ok(applyAction(s, 0, { type: 'offerTrade', to: 1, cardId: s.players[0].res[0].id, claim: 'Oil', ask: 'Workers' }));
  ok(applyAction(s, 1, { type: 'respondTrade', choice: 'trade', cardId: s.players[1].res[1].id, claim: 'Weapons' })); // not what was asked for
  ok(applyAction(s, 0, { type: 'finishTrade', choice: 'cancel' }));
  assert.deepEqual(s.players[0].res.map((c) => c.type), ['Oil', 'Livestock', 'Farmland']);
  assert.deepEqual(s.players[1].res.map((c) => c.type), ['Workers', 'Weapons', 'Oil']);
  assert.equal(s.pending, null);
  assert.equal(s.players[0].heat + s.players[1].heat, 0);
  // offered exactly what was asked for: swap or call, no backing out
  const t = game();
  setRes(t, 0, ['Oil', 'Livestock']); setRes(t, 1, ['Workers', 'Weapons']);
  ok(applyAction(t, 0, { type: 'offerTrade', to: 1, cardId: t.players[0].res[0].id, claim: 'Oil', ask: 'Workers' }));
  ok(applyAction(t, 1, { type: 'respondTrade', choice: 'trade', cardId: t.players[1].res[0].id, claim: 'Workers' }));
  assert.match(applyAction(t, 0, { type: 'finishTrade', choice: 'cancel' }).error, /asked for/);
});

test('a Duplicator whose card is stolen comes loose and its owner moves it; Strike destroys it', () => {
  const s = game(2);
  setRes(s, 0, ['Oil', 'Oil', 'Farmland']); setRes(s, 1, ['Weapons', 'Workers']);
  const [a, b, f] = s.players[0].res;
  s.players[0].boosts = [{ id: 970, kind: 'duplicator', expanded: false, on: a.id }];
  s.players[0].hand = []; s.players[1].hand = [{ id: 971, kind: 'forcedTrade' }, { id: 972, kind: 'strike' }];
  s.turn = 1;
  ok(applyAction(s, 1, { type: 'playCard', cardId: 971, payment: [s.players[1].res[0].id], target: 0, theirId: a.id }));
  ok(applyAction(s, 0, { type: 'costResponse', choice: 'pass' }));
  assert.deepEqual([s.pending.kind, actors(s)], ['dup', [0]], 'the owner is asked where it goes');
  assert.equal(countType(s.players[0], 'Oil'), 1, 'loose, it doubles nothing');
  assert.match(applyAction(s, 1, { type: 'endTurn' }).error, /Wait/);
  ok(applyAction(s, 0, { type: 'moveDup', resId: b.id }));
  assert.equal(countType(s.players[0], 'Oil'), 2);
  assert.equal(s.pending, null);
  ok(applyAction(s, 1, { type: 'playCard', cardId: 972, payment: [s.players[1].res[0].id], target: 0, boostId: 970 }));
  ok(applyAction(s, 0, { type: 'costResponse', choice: 'pass' }));
  assert.equal(s.players[0].boosts.length, 0);
  void f;
});

test('at five Heat a wrong call destroys the leftmost card instead', () => {
  const s = game(2);
  setRes(s, 0, ['Farmland', 'Oil']); setRes(s, 1, ['Workers', 'Weapons', 'Oil']);
  s.players[0].hand = [{ id: 975, kind: 'warehouse' }]; s.players[1].hand = [];
  s.players[1].heat = 5;
  ok(applyAction(s, 0, { type: 'playCard', cardId: 975, payment: [s.players[0].res[0].id] })); // honest: Warehouse costs Farmland
  ok(applyAction(s, 1, { type: 'costResponse', choice: 'call' }));
  assert.equal(s.players[1].heat, 5);
  assert.deepEqual(s.players[1].res.map((c) => c.type), ['Weapons', 'Oil'], 'the leftmost card is gone');
  assert.ok(s.fx.some((f) => f.type === 'burn' && f.p === 1));
});

test('seen-card marks are a game setting: everything, only my own looks, or nothing', () => {
  const play = (marks) => {
    const s = newGame({ names: ['A', 'B', 'C'], seed: 42, marks });
    s.turn = 0; s.pending = null;
    setRes(s, 0, ['Oil', 'Livestock']); setRes(s, 1, ['Workers', 'Farmland']);
    s.players.forEach((p) => { p.hand = []; p.traded = false; });
    s.players[0].hand = [{ id: 980, kind: 'espionage' }];
    // A trades a card to B (it passes through A's hands), then looks at B's other card with Espionage
    ok(applyAction(s, 0, { type: 'offerTrade', to: 1, cardId: s.players[0].res[0].id, claim: 'Oil', ask: 'Workers' }));
    ok(applyAction(s, 1, { type: 'respondTrade', choice: 'trade', cardId: s.players[1].res[0].id, claim: 'Workers' }));
    ok(applyAction(s, 0, { type: 'finishTrade', choice: 'accept' }));
    ok(applyAction(s, 0, { type: 'playCard', cardId: 980, payment: [], target: 1, resId: s.players[1].res[0].id }));
    return viewFor(s, 0).players[1].res.map((r) => r.known);
  };
  assert.deepEqual(play('all'), [true, true], 'the card looked at and the card handed over are both marked');
  assert.deepEqual(play('looks'), [true, false], 'only the card looked at');
  assert.deepEqual(play('none'), [false, false], 'nothing: remember it yourself');
});

test('Whistleblower is right on five of a kind even before the hold has formally begun', () => {
  const s = game(2);
  setRes(s, 0, ['Livestock', 'Farmland']); setRes(s, 1, ['Oil', 'Oil', 'Oil', 'Oil', 'Oil']);
  s.players[0].hand = [{ id: 985, kind: 'whistleblower' }]; s.players[1].hand = [];
  assert.equal(s.players[1].holding, null); // they have not ended a turn with these five
  ok(applyAction(s, 0, { type: 'whistle', target: 1 }));
  assert.equal(s.pending.kind, 'whistle');
  assert.equal(s.players[0].heat, 0);
});

test('a game keeps count of right Whistleblowers and of the monopoly powers used, for the end-of-game payout', () => {
  const s = game(2);
  setRes(s, 0, ['Livestock', 'Farmland']); setRes(s, 1, ['Oil', 'Oil', 'Oil', 'Oil', 'Oil']);
  s.players[0].hand = [{ id: 990, kind: 'whistleblower' }]; s.players[1].hand = [];
  ok(applyAction(s, 0, { type: 'whistle', target: 1 }));
  assert.equal(s.players[0].stats.whistles, 1);
  const t = scoreMonopoly('Oil', 3);
  ok(applyAction(t, 0, { type: 'power', use: true }));
  assert.deepEqual(t.players[0].stats.powers, ['Oil']);
  const u = scoreMonopoly('Oil', 3);
  ok(applyAction(u, 0, { type: 'power', use: false }));
  assert.deepEqual(u.players[0].stats.powers, [], 'a power that was skipped does not count');
  assert.equal(typeof viewFor(t, 0).gid, 'number');
});
