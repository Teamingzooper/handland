// The tutorial round: a real game against a scripted opponent with stacked cards.
// It is a list of beats. "info" beats wait for Next, "you" beats wait for one specific
// move from the player, "coach" beats are moves the opponent makes on its own.
import { newGame } from './engine.js';

export const COACH = 'Coach Sterling';

export function tutorialGame(playerName) {
  const s = newGame({ names: [playerName, COACH], bots: [false, true], seed: 7, winTarget: 1 });
  const [me, coach] = s.players;
  let id = 1000;
  const res = (types) => types.map((type) => ({ id: id++, type }));
  const hand = (kinds) => kinds.map((kind) => ({ id: id++, kind }));
  me.res = res(['Oil', 'Oil', 'Oil', 'Livestock', 'Farmland']);
  me.hand = hand(['espionage', 'duplicator', 'bribe']);
  coach.res = res(['Oil', 'Workers', 'Farmland', 'Weapons', 'Weapons']);
  coach.hand = hand(['warehouse', 'lawsuit']);
  me.known = {}; coach.known = {};
  Object.assign(s, { nextId: 2000, turn: 0, turnNumber: 1, log: [], fx: [], pending: null });
  s.playDeck.push('front', 'strike', 'expansion', 'bribe'); // the next draws, last one first
  s.log.push({ n: ++s.logN, t: 'Tutorial round. First to 1 Monopoly token wins.', to: null });
  return s;
}

const mine = (s, type) => s.players[0].res.find((c) => c.type === type);
const theirs = (s, type) => s.players[1].res.find((c) => c.type === type);
const typeOf = (s, id) => s.players[0].res.find((c) => c.id === id)?.type;
const kindOf = (s, id) => s.players[0].hand.find((c) => c.id === id)?.kind;

export const BEATS = [
  { who: 'info', text: 'Welcome to Handland. I\'m Coach Sterling, and I\'ll be your opponent for one short round.\n\nThe goal: get **5 of the same resource** and hold them for a full round to score a **Monopoly token**. Your resources are the big cards at the bottom, and your hand of Action and Boost cards is down the right side. You already have 3 Oil.' },
  { who: 'you', text: 'You can\'t just draw better cards. You have to **trade** for them.\n\n**Drag your Livestock card onto me.** It lands face down in the middle. On the table, the tokens already say **Livestock** (the truth), so just pick **Oil** in the "Ask for" row, then click **Send offer**.',
    hint: 'For this step: drag your Livestock onto me, say it is Livestock, and ask for Oil.',
    allow: (a, s) => a.type === 'offerTrade' && typeOf(s, a.cardId) === 'Livestock' && a.claim === 'Livestock' && a.ask === 'Oil' },
  { who: 'coach', act: (s) => ({ type: 'respondTrade', choice: 'trade', cardId: theirs(s, 'Oil').id, claim: 'Oil' }) },
  { who: 'you', text: 'I put a card face down and I **say** it is Oil. You can\'t see it, so you have to decide whether to believe me.\n\nI\'m being honest this time. Click **Swap cards**.',
    hint: 'I\'m honest this time. Click Swap cards.',
    allow: (a) => a.type === 'finishTrade' && a.choice === 'accept' },
  { who: 'you', text: 'That\'s 4 Oil. One more to go.\n\nYou only get one trade offer per turn, so click **End turn**.',
    hint: 'Click End turn.',
    allow: (a) => a.type === 'endTurn' },
  { who: 'coach', act: (s) => ({ type: 'offerTrade', to: 0, cardId: theirs(s, 'Workers').id, claim: 'Oil', ask: 'Farmland' }) },
  { who: 'you', text: 'My turn. I\'m offering you a card and I say it\'s **Oil**, exactly what you need. Convenient, isn\'t it?\n\nCards are face down, so I might be lying. You have an **Espionage** card. Click **Peek** to look.',
    hint: 'Click the Peek (Espionage) button first.',
    allow: (a) => a.type === 'peekTrade' },
  { who: 'you', text: 'Caught me. It\'s really **Workers**. That\'s a scam.\n\n**Drag any one of your cards to the middle** (it\'s what you would risk if you were wrong), then click **Call scam!**',
    hint: 'Drag one of your cards to the middle, then click Call scam!',
    allow: (a) => a.type === 'respondTrade' && a.choice === 'call' },
  { who: 'info', text: 'You were right, so you **keep both cards** and gain a **Cover** token 🛡.\n\nCover absorbs your next wrong call-out. With no Cover, a wrong call gives you **Heat** 🔥 instead, and every Heat flips one of your cards face up for the whole table. Call carefully.' },
  { who: 'coach', act: (s) => ({ type: 'playCard', cardId: s.players[1].hand.find((c) => c.kind === 'warehouse').id, payment: [theirs(s, 'Farmland').id] }) },
  { who: 'you', text: 'Cards cost resources, and you pay **face down** too. I\'m playing Warehouse and I say I paid Farmland.\n\nAnyone can call a payment. This one is honest, and a wrong call would cost you your Cover. Click **Let it through**.',
    hint: 'This payment is honest. Click Let it through.',
    allow: (a) => a.type === 'costResponse' && a.choice === 'pass' },
  { who: 'coach', act: () => ({ type: 'endTurn' }) },
  { who: 'you', text: 'Your turn. Now **you** bluff.\n\n**Drag the Duplicator** from your hand, on the right, onto the table. It costs Livestock, which you don\'t have. Drag that useless **Workers** card to the middle to pay, and pretend. Then click an **Oil** to double, and click **Play Duplicator**.',
    hint: 'Play Duplicator: drag Workers to the middle to pay, and click an Oil to double.',
    allow: (a, s) => a.type === 'playCard' && kindOf(s, a.cardId) === 'duplicator' && typeOf(s, a.payment?.[0]) === 'Workers' && typeOf(s, a.resId) === 'Oil' },
  { who: 'coach', act: () => ({ type: 'costResponse', choice: 'pass' }) },
  { who: 'info', text: 'I didn\'t call it, so your bluff worked, and you got rid of a junk card at the same time.\n\nOne of your Oil now counts as 2. That makes **5 Oil**.' },
  { who: 'you', text: 'Ending your turn with 5 of a kind starts a **secret hold**. Nobody is told. Keep all 5 until your next turn and you score.\n\nClick **End turn**.',
    hint: 'Click End turn to start your hold.',
    allow: (a) => a.type === 'endTurn' },
  { who: 'coach', act: (s) => ({ type: 'offerTrade', to: 0, cardId: theirs(s, 'Weapons').id, claim: 'Weapons', ask: 'Oil' }) },
  { who: 'you', text: 'Now I\'d like one of your Oil. Giving one up would **break your hold**.\n\nClick **No thanks**.',
    hint: 'Don\'t break your hold. Click No thanks.',
    allow: (a) => a.type === 'respondTrade' && a.choice === 'decline' },
  { who: 'coach', act: () => ({ type: 'endTurn' }) },
  { who: 'info', done: true, text: 'You held 5 Oil for a full round. That\'s a **Monopoly token**, and the win.\n\nThat\'s the whole game: **trade, bluff, call, hold**. In a real game there are more cards to play and more players to read. Good luck out there.' },
];
