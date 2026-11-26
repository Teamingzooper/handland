// Builds the illustrated rulebook: print/rulebook.html and print/Handland-rulebook.pdf (US Letter, 8 pages).
// The pictures are the game's own cards, drawn by the same code the game uses (public/art.js) and styled by the
// game's own stylesheet, so the rulebook always shows the cards as they are. Card names, costs, counts and texts
// come straight from the rules (src/engine.js), so they cannot drift apart.
// Run with:  npx electron scripts/rulebook.mjs
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARDS, POWERS, RULES, TYPES } from '../src/engine.js';
import { art, ico, CARD_BACK } from '../public/art.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

// ---------- cards, drawn as in the game ----------
const pip = (t) => `<span class="pip p-${t}">${ico(t)}</span>`;
const play = (kind, cw, style = '') => { const d = CARDS[kind]; return `<div class="card pc ${d.kind} ${d.name.length > 9 ? 'longname' : ''}" style="--cw:${cw}pt;${style}"><div class="cardface"><div class="ttl"><span>${d.name}</span><span class="pips">${d.cost.map(pip).join('')}</span></div>${art(kind)}<div class="typ">${d.kind === 'boost' ? 'Boost' : 'Action'} · ${d.cost.length ? d.cost.join(' + ') : 'Free'}</div><div class="txt">${d.short}</div></div></div>`; };
const res = (type, cw, style = '', extra = '') => `<div class="card res t-${type}" style="--cw:${cw}pt;${style}"><div class="cardface"><div class="ttl">${type}</div>${art(type)}<div class="typ">Resource</div></div>${extra}</div>`;
const back = (cw, style = '') => `<div class="card back" style="--cw:${cw}pt;${style}"><div class="cardface">${CARD_BACK}</div></div>`;
const gap = (cw) => `<div class="card gap" style="--cw:${cw}pt"></div>`;
const TOK = {
  heat: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1c.5 2.6 3.6 4 3.6 7.6A3.6 3.6 0 0 1 8 15a3.6 3.6 0 0 1-3.6-3.6c0-1.6.8-2.6 1.6-3.4.2 1 .7 1.6 1.2 1.8C6.6 7 7 3.6 8 1Z"/></svg>',
  cover: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1 14 3v4.6c0 3.6-2.6 6.2-6 7.4-3.4-1.2-6-3.8-6-7.4V3Z"/></svg>',
  score: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 5 5 8l3-5 3 5 3.5-3-1.4 8H2.9Z"/></svg>',
};
const tok = (k, label) => `<span class="rtok k-${k}">${TOK[k]}<b>${label}</b></span>`;
const say = (text, cls = '') => `<span class="bubble ${cls}">${text}</span>`;
const step = (n, title, body) => `<div class="step"><span class="num">${n}</span><div><h4>${title}</h4>${body}</div></div>`;
const h2 = (n, title) => `<h2><span class="num">${n}</span>${title}</h2>`;
const foot = (n) => `<div class="foot"><span>Handland rulebook</span><span>${n}</span></div>`;
const order = ['writeoff', 'forcedTrade', 'whistleblower', 'espionage', 'strike', 'audit', 'injunction', 'tip', 'bribe', 'lawsuit', 'alibi', 'warehouse', 'duplicator', 'expansion', 'front'];
const entry = (k) => { const d = CARDS[k]; return `<div class="entry">${play(k, 88)}<div><h4>${d.name}</h4><div class="meta"><span class="tag ${d.kind}">${d.kind === 'boost' ? 'Boost' : 'Action'}</span><span>${d.cost.length ? `${d.cost.map(pip).join('')} ${d.cost.join(' + ')}` : 'Free'}</span><span>${d.copies} in the deck</span></div><p>${d.text.replace(/ Free\.$/, '')}</p></div></div>`; };
const total = Object.values(CARDS).reduce((n, c) => n + c.copies, 0);

const pages = [
  // ---------- 1. cover ----------
  `<div class="pg cover">
    <div class="fan">${['Livestock', 'Weapons', 'Oil', 'Workers', 'Farmland'].map((t, i) => res(t, 128, `rotate:${(i - 2) * 11}deg;translate:${(i - 2) * 6}pt ${Math.abs(i - 2) * 16}pt;z-index:${i === 2 ? 3 : 2 - Math.abs(i - 2)}`)).join('')}</div>
    <div class="logo">Handland</div>
    <div class="tagline">Trade face down. Lie if you dare. Corner the market.</div>
    <div class="strip"><b>Rulebook</b><span>2 to 6 players</span><span>15 to 30 minutes</span><span>Version ${version}</span></div>
  </div>`,

  // ---------- 2. the idea, the box, setting up ----------
  `<div class="pg">
    ${h2(1, 'The idea')}
    <p class="lead">Everyone is trying to corner one market: to hold <b>five of the same resource</b> and keep them for a full round. Nobody can see anybody else's cards, every trade is made face down, and anything you say about a card may be a lie. Catch a liar and you profit. Accuse an honest player and you pay for it.</p>
    <p>The first player to score the agreed number of <b>Monopoly tokens</b> wins: 1 for a quick game, 2 for a normal one, 3 for a long one.</p>
    ${h2(2, 'What is in the box')}
    <div class="box2">
      <div><div class="row tight">${TYPES.map((t) => res(t, 56)).join('')}</div><p class="cap"><b>70 resource cards</b>: 14 each of Oil, Livestock, Farmland, Weapons and Workers.</p></div>
      <div><div class="row tight">${play('forcedTrade', 56)}${play('espionage', 56)}${play('warehouse', 56)}${back(56)}</div><p class="cap"><b>${total} Action and Boost cards.</b> Actions are used once. Boosts stay in front of you.</p></div>
    </div>
    <div class="tokens">${tok('heat', '30 Heat')}${tok('cover', '18 Cover')}${tok('score', '13 Monopoly tokens')}<span class="marker">HOLDING</span><span class="marker off">NOT HOLDING</span><span class="marker boy">BOYCOTT</span></div>
    <p class="cap">Tokens for Heat, Cover and Monopolies. One HOLDING and one NOT HOLDING marker per player. Two Boycott markers.</p>
    ${h2(3, 'Setting up')}
    <div class="setup">
      <div><div class="row tight">${[0, 1, 2, 3, 4].map(() => back(54)).join('')}</div><p class="cap"><b>Your row:</b> 5 resource cards, face down, in a line. You may look at your own at any time.</p></div>
      <div><div class="row tight">${play('writeoff', 54)}${play('tip', 54)}${play('bribe', 54)}</div><p class="cap"><b>Your hand:</b> 3 Action and Boost cards, kept secret.</p></div>
    </div>
    <div class="note"><b>The one rule people forget:</b> you may <b>never rearrange your row</b>. New cards always join at the right-hand end. Everything about Heat depends on it.</div>
    <p>Shuffle the two decks separately. Everyone starts with no Heat and no Cover. Pick a first player at random; play goes clockwise.</p>
    ${foot(2)}
  </div>`,

  // ---------- 3. your turn, trading ----------
  `<div class="pg">
    ${h2(4, 'Your turn')}
    <div class="steps3">
      ${step(1, 'Start', '<p>If you held five of a kind for the whole round, <b>score it</b> (page 5). Then fill any empty places in your row from the deck and draw 1 card into your hand.</p>')}
      ${step(2, 'Main', '<p>In any order: offer <b>one trade</b>, and play <b>as many cards</b> from your hand as you like.</p>')}
      ${step(3, 'End', '<p>Discard down to 5 resources (more with a Warehouse) and 3 hand cards. Place a HOLDING or NOT HOLDING marker face down.</p>')}
    </div>
    ${h2(5, 'Trading')}
    <p>There is no free way to swap cards. You change your row by trading, by paying for cards, and by winning calls.</p>
    <div class="scene">
      <div class="side"><div class="who">You</div>${back(78)}${say('It\'s Oil. I want Farmland.')}</div>
      <div class="swap">⇄</div>
      <div class="side"><div class="who">Them</div>${back(78)}${say('Here\'s your Farmland.', 'r')}</div>
    </div>
    <ol class="tight">
      <li>Pick a player. Put one resource face down in the middle, <b>say what it is</b> (you may lie) and say what you want back.</li>
      <li>They <b>decline</b> (your card goes back), or <b>trade</b> (they put a card down and say what it is, and they may lie too), or <b>call scam</b> on your card, putting one of their own cards down as a stake.</li>
      <li>If they traded, you <b>swap</b> the two cards unseen, or <b>call scam</b> on theirs.</li>
    </ol>
    <div class="two">
      <div class="out bad"><b>The card was a lie</b>The caller keeps both cards.</div>
      <div class="out good"><b>The card was honest</b>The accused keeps both cards, and the caller takes the wrong-call penalty.</div>
    </div>
    <div class="two">
      <div class="tip"><h4>Calling it off</h4><p>If they say they are giving you something <b>other than what you asked for</b>, you may call the trade off instead. Both cards go back and nobody is penalised.</p></div>
      <div class="tip"><h4>Gaps</h4><div class="row tight mini">${back(32)}${gap(32)}${back(32)}${back(32)}${back(32)}</div><p>A card in a trade leaves its place empty. If it comes back, it goes back into that place.</p></div>
    </div>
    <div class="tip wide"><h4>Open offers</h4><p>Instead of naming a player you may offer your card <b>to the table</b>. It goes clockwise from your left; each player may trade, call scam or pass, and the first to answer gets the trade. If everyone passes the card returns to you. Either way it was your one trade.</p></div>
    ${foot(3)}
  </div>`,

  // ---------- 4. paying, heat and cover ----------
  `<div class="pg">
    ${h2(6, 'Paying for cards')}
    <div class="payrow">
      <div class="scene small"><div class="side">${play('warehouse', 92)}</div><div class="swap">+</div><div class="side">${back(72)}${say('Paid: Farmland.', 'r')}</div></div>
      <div>
        <p>Most cards cost a particular resource, shown at the top of the card. You pay <b>face down</b> and say you paid the right thing. If you do not have it, you can pay with something else and <b>bluff</b>.</p>
        <p>Going clockwise from your left, each other player says <b>pass</b> or <b>call</b>. The first to call makes the call, and the payment is turned over.</p>
      </div>
    </div>
    <div class="three">
      <div class="out bad"><b>Caught lying</b>Your card is wasted and the caller takes your payment.</div>
      <div class="out good"><b>Called, but honest</b>Your card works and the caller takes the wrong-call penalty.</div>
      <div class="out"><b>Nobody calls</b>Your card works. The payment is discarded unseen.</div>
    </div>
    <p class="cap">Free cards need no payment, so nobody can call them.</p>
    ${h2(7, 'Heat and Cover')}
    <p>Heat and Cover are two ends of one scale. <b>Nobody ever has both.</b></p>
    <div class="two">
      <div class="out good">${tok('cover', '')}<b>You called and were right</b>Remove 1 Heat. With no Heat, gain 1 Cover (at most ${RULES.coverCap}).</div>
      <div class="out bad">${tok('heat', '')}<b>You called and were wrong</b>Spend 1 Cover. With no Cover, gain 1 Heat (at most ${RULES.heatCap}).</div>
    </div>
    <div class="heatrow">
      <div class="row tight">${res('Livestock', 66)}${res('Oil', 66)}${back(66)}${back(66)}${back(66)}</div>
      <div><h4>Heat exposes you</h4><p>For each Heat you have, one of your resources lies <b>face up</b> for everyone, starting from the <b>left</b>. Here: 2 Heat. If a face-up card leaves, the next one turns over.</p><p><b>Cover</b> does nothing by itself. It soaks up your next wrong calls.</p></div>
    </div>
    <div class="note hot"><b>At ${RULES.heatCap} Heat</b> you cannot get any hotter. Every further wrong call <b>destroys the leftmost card of your row</b> instead.</div>
    ${foot(4)}
  </div>`,

  // ---------- 5. monopolies ----------
  `<div class="pg">
    ${h2(8, 'Monopolies')}
    <div class="monorow">
      <div class="row tight">${[0, 1, 2, 3, 4].map((i) => res('Oil', 68, `rotate:${(i - 2) * 2}deg`)).join('')}</div>
      <div class="arrow">→</div>
      <div class="bigtok">${TOK.score}<b>1</b></div>
    </div>
    <ol class="tight">
      <li><b>End your turn with five of one resource</b> and a secret hold begins. Place your HOLDING marker face down. Nobody is told.</li>
      <li><b>Keep all five until your next turn starts.</b> Then turn the marker over, show your row, discard the five, take a <b>Monopoly token</b> and refill your row.</li>
      <li><b>Drop below five at any moment</b> (a trade, a steal, a lost call) and the hold is broken. Say nothing. There is no penalty.</li>
    </ol>
    <div class="whistle">
      ${play('whistleblower', 96, 'rotate:-4deg')}
      <div><h4>The Whistleblower</h4><p>Anyone may play it <b>at any moment</b>, even in the middle of someone else's trade. Name a player.</p>
      <p><b>Right:</b> they have five of a kind <b>right now</b>. They show you their whole row and you take any two cards for yourself.</p>
      <p><b>Wrong:</b> you take the wrong-call penalty. Then the game carries on from where it stopped.</p></div>
    </div>
    ${h2(9, 'Monopoly powers')}
    <p>When you score, you may use that resource's power <b>once, right then</b>. It is free, nobody can call it, and you may skip it. The token that wins the game has no power.</p>
    <div class="powers">${TYPES.map((t) => `<div class="power">${res(t, 76)}<h4>${POWERS[t].name}</h4><p>${POWERS[t].text}</p></div>`).join('')}</div>
    ${foot(5)}
  </div>`,

  // ---------- 6 and 7. the cards ----------
  `<div class="pg">
    ${h2(10, 'The cards')}
    <p><b>Action</b> cards are used once and discarded. <b>Boost</b> cards stay on the table in front of you. The coloured symbol at the top of a card is what it costs.</p>
    <div class="entries">${order.slice(0, 8).map(entry).join('')}</div>
    ${foot(6)}
  </div>`,
  `<div class="pg">
    <div class="entries">${order.slice(8).map(entry).join('')}</div>
    <div class="note"><b>The Duplicator</b> lies tucked under the card it doubles. If another player takes or destroys that card, you move the Duplicator under another of your cards straight away. If you give the card up yourself, by paying with it, trading it, discarding it or scoring it, the Duplicator goes with it.</div>
    ${foot(7)}
  </div>`,

  // ---------- 8. summary ----------
  `<div class="pg last">
    <div class="logo sm">Handland</div>
    <div class="summary">
      <h3>Your turn at a glance</h3>
      ${step(1, 'Start', '<p>Score a held monopoly and use its power · refill your row · draw 1 card</p>')}
      ${step(2, 'Main', '<p>One trade · any number of cards</p>')}
      ${step(3, 'End', '<p>Discard to your limits · place a Hold marker</p>')}
      <div class="anytime">Any time, anyone: <b>Whistleblower</b></div>
    </div>
    <div class="two">
      <div class="card3"><h3>Calls</h3><p><b>Right:</b> lose 1 Heat, else gain 1 Cover.</p><p><b>Wrong:</b> lose 1 Cover, else gain 1 Heat. At ${RULES.heatCap} Heat, lose your leftmost card.</p><p>Each Heat turns one of your cards face up, from the left.</p></div>
      <div class="card3"><h3>Remember</h3><p>Never rearrange your row. New cards join on the right.</p><p>You can only lie about what a card <b>is</b>, never about the rules.</p><p>Five of a kind, kept for a full round, scores.</p></div>
    </div>
    <div class="two">
      <div class="card3"><h3>At a real table</h3><p>There are no timers. Calls on a payment go clockwise from the payer's left.</p><p>Slide a traded card forward out of the row instead of closing the row up.</p><p>A boycotted player keeps a Boycott marker until their next turn ends; Boosts, the Whistleblower and the Alibi are still allowed.</p></div>
      <div class="card3"><h3>On screen</h3><p>The host can choose whether cards you have seen keep a small symbol: all of them, only ones you looked at yourself, or none.</p><p>Bots come in four difficulties. The harder ones read how you play as well as what you show.</p></div>
    </div>
    <div class="fan sm">${['Livestock', 'Weapons', 'Oil', 'Workers', 'Farmland'].map((t, i) => res(t, 62, `rotate:${(i - 2) * 9}deg;translate:0 ${Math.abs(i - 2) * 7}pt;z-index:${i === 2 ? 3 : 2 - Math.abs(i - 2)}`)).join('')}</div>
    <div class="credit">Card art and rules are part of Handland. Sounds and textures are free-to-use (CC0) recordings and photographs; see the credits files in the game.</div>
  </div>`,
];

const css = `
  @page { size: letter; margin: 0; }
  html, body { height: auto !important; overflow: visible !important; margin: 0; background: #fff !important; user-select: auto; }
  body::before, body::after { display: none !important; }
  body { font: 400 11pt/1.44 'Barlow', Helvetica, Arial, sans-serif; color: #1c1a2a; --u: 6pt; }
  .pg { width: 8.5in; height: 11in; padding: .62in .68in .7in; position: relative; overflow: hidden; break-after: page; background: #f7eed6; }
  .pg::before { content: ''; position: absolute; inset: .3in; border: 1pt solid #14121f22; border-radius: 10pt; pointer-events: none; }
  .pg.cover::before, .pg.last::before { border-color: #ffd23f33; }
  .pg:last-child { break-after: auto; }
  .card { flex: none; box-shadow: 0 0 0 .11em #14121f, .22em .3em 0 .11em #14121f40; transform: none !important; animation: none !important; }
  .card .txt { display: grid !important; }
  .card.back .cardface { background: #14173a; }
  .card.gap { background: none; box-shadow: none; border: 1.2pt dashed #14121f80; opacity: 1; }
  .card.gap::after { display: none; }
  h2 { font: 400 23pt/1.05 'Abril Fatface', Georgia, serif; color: #14121f; margin: 20pt 0 9pt; display: flex; align-items: center; gap: 8pt; border-bottom: 2.4pt solid #14121f; padding-bottom: 5pt; }
  h2:first-child { margin-top: 0; }
  h3 { font: 400 14pt/1.1 'Abril Fatface', Georgia, serif; margin: 0 0 5pt; }
  h4 { font: 700 10.4pt/1.15 'Barlow Condensed', sans-serif; letter-spacing: .1em; text-transform: uppercase; margin: 0 0 2pt; }
  p { margin: 0 0 6pt; }
  b { font-weight: 700; color: inherit; }
  .num { display: inline-grid; place-items: center; flex: none; width: 21pt; height: 21pt; border-radius: 50%; background: #ffd23f; border: 1.6pt solid #14121f; font: 700 11pt/1 'Barlow Condensed', sans-serif; color: #14121f; }
  .lead { font-size: 12.6pt; line-height: 1.42; }
  .cap { font-size: 9.4pt; line-height: 1.32; color: #3b3850; margin-top: 4pt; }
  .row { display: flex; gap: 6pt; align-items: flex-end; }
  .row.tight { gap: 4pt; }
  .box2, .setup, .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14pt; }
  .three { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 9pt; margin: 8pt 0 2pt; }
  .tokens { display: flex; flex-wrap: wrap; gap: 7pt; align-items: center; margin-top: 8pt; }
  .rtok { display: inline-flex; align-items: center; gap: 4pt; background: #14121f; color: #ffd23f; border-radius: 20pt; padding: 3pt 9pt 3pt 6pt; font: 700 9.4pt/1 'Barlow Condensed', sans-serif; letter-spacing: .08em; text-transform: uppercase; }
  .rtok svg { width: 11pt; height: 11pt; } .rtok.k-heat { color: #ff8a2b; } .rtok.k-cover { color: #6cc0ff; }
  .rtok b:empty { display: none; }
  .marker { font: 700 8.6pt/1 'Barlow Condensed', sans-serif; letter-spacing: .12em; border: 1.4pt solid #14121f; border-radius: 3pt; padding: 4pt 7pt; background: #35d08a; }
  .marker.off { background: #fff; } .marker.boy { background: #1f86e6; color: #fff; }
  .note { background: #14173a; color: #f7eed6; border-radius: 7pt; padding: 9pt 12pt; margin: 9pt 0; border: 1.6pt solid #14121f; box-shadow: 3pt 3pt 0 #14121f; }
  .note b { color: #ffd23f; } .note.hot b { color: #ff8a2b; }
  .card3 b, .summary b { color: inherit; }
  .steps3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 11pt; }
  .step { display: flex; gap: 7pt; align-items: flex-start; }
  .step p { margin: 0; font-size: 10.2pt; line-height: 1.36; }
  .scene { display: flex; justify-content: center; align-items: center; gap: 22pt; margin: 6pt 0 9pt; padding: 12pt; background: #1f3a8a; background-image: radial-gradient(ellipse at 50% 40%, #2a4bb0, #152a66); border: 1.8pt solid #14121f; border-radius: 9pt; box-shadow: 3pt 3pt 0 #14121f; }
  .scene.small { padding: 10pt; gap: 12pt; margin: 0; }
  .scene .side { display: flex; align-items: center; gap: 9pt; position: relative; }
  .scene .who { font: 700 8.6pt/1 'Barlow Condensed', sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #f7eed6; writing-mode: vertical-rl; rotate: 180deg; }
  .scene .swap { font: 400 24pt/1 'Abril Fatface', serif; color: #ffd23f; }
  .bubble { background: #f7eed6; border: 1.5pt solid #14121f; border-radius: 9pt 9pt 9pt 2pt; padding: 5pt 9pt; font: 600 10pt/1.2 'Barlow', sans-serif; box-shadow: 2pt 2pt 0 #14121f; max-width: 104pt; }
  .bubble.r { border-radius: 9pt 9pt 2pt 9pt; }
  ol.tight { margin: 0 0 8pt; padding-left: 16pt; } ol.tight li { margin-bottom: 3pt; }
  .out { border: 1.6pt solid #14121f; border-radius: 6pt; padding: 8pt 10pt; background: #fffaf0; font-size: 10pt; line-height: 1.34; box-shadow: 2pt 2pt 0 #14121f; position: relative; }
  .out b { display: block; color: #14121f; font: 700 10.2pt/1.15 'Barlow Condensed', sans-serif; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 2pt; }
  .out.bad { background: #ffe1dc; } .out.good { background: #dcf5e6; }
  .out .rtok { position: absolute; right: 6pt; top: 6pt; padding: 3pt 5pt; }
  .tip { margin-top: 11pt; } .tip p { font-size: 10pt; line-height: 1.36; margin: 0; } .tip.wide { border-top: 1.2pt dashed #14121f80; padding-top: 8pt; }
  .tip .row.mini { margin: 2pt 0 5pt; }
  .payrow { display: grid; grid-template-columns: auto 1fr; gap: 14pt; align-items: center; }
  .heatrow { display: grid; grid-template-columns: auto 1fr; gap: 14pt; align-items: center; margin-top: 10pt; }
  .heatrow p { font-size: 10.2pt; margin-bottom: 5pt; }
  .monorow { display: flex; align-items: center; justify-content: center; gap: 16pt; margin: 4pt 0 10pt; }
  .arrow { font: 400 26pt/1 'Abril Fatface', serif; }
  .bigtok { display: grid; place-items: center; width: 62pt; height: 62pt; border-radius: 50%; background: #ffd23f; border: 2.4pt solid #14121f; box-shadow: 3pt 3pt 0 #14121f; position: relative; }
  .bigtok svg { width: 34pt; height: 34pt; color: #14121f; } .bigtok b { position: absolute; right: -6pt; bottom: -6pt; background: #14121f; color: #ffd23f; border-radius: 50%; width: 20pt; height: 20pt; display: grid; place-items: center; font: 700 11pt/1 'Barlow Condensed', sans-serif; }
  .whistle { display: grid; grid-template-columns: auto 1fr; gap: 16pt; align-items: center; background: #fff3c4; border: 1.8pt solid #14121f; border-radius: 9pt; padding: 11pt 13pt 6pt; box-shadow: 3pt 3pt 0 #14121f; margin: 6pt 0 2pt; }
  .whistle p { font-size: 10.2pt; margin-bottom: 5pt; }
  .powers { display: grid; grid-template-columns: repeat(5, 1fr); gap: 9pt; margin-top: 8pt; }
  .power { text-align: center; } .power .card { margin: 0 auto 7pt; } .power p { font-size: 9.2pt; line-height: 1.3; margin: 0; }
  .entries { display: grid; grid-template-columns: 1fr 1fr; gap: 15pt 18pt; margin-top: 10pt; }
  .entry { display: grid; grid-template-columns: auto 1fr; gap: 10pt; align-items: start; break-inside: avoid; }
  .entry p { font-size: 9.5pt; line-height: 1.32; margin: 0; }
  .entry h4 { font: 400 13pt/1.1 'Abril Fatface', Georgia, serif; letter-spacing: 0; text-transform: none; margin-bottom: 3pt; }
  .meta { display: flex; flex-wrap: wrap; gap: 4pt 8pt; align-items: center; font: 700 8.2pt/1 'Barlow Condensed', sans-serif; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 4pt; }
  .meta .pip { font-size: 7pt; vertical-align: middle; }
  .tag { background: #14121f; color: #f7eed6; padding: 2.4pt 5pt; border-radius: 3pt; } .tag.boost { background: #5ef2d0; color: #14121f; }
  .foot { position: absolute; left: .68in; right: .68in; bottom: .34in; display: flex; justify-content: space-between; font: 700 8pt/1 'Barlow Condensed', sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #3b3850; border-top: 1pt solid #14121f60; padding-top: 5pt; }
  /* cover and back page: the game's own night-blue */
  .pg.cover, .pg.last { background: radial-gradient(ellipse at 50% 38%, #232a6e, #14173a 62%, #0c0e26); color: #f7eed6; }
  .cover { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .fan { display: flex; justify-content: center; margin: 0 0 54pt; }
  .fan.sm { margin: 8pt 0 0; } .fan.sm .card { margin: 0 -9pt !important; }
  .fan .card { margin: 0 -22pt; box-shadow: 0 0 0 .11em #14121f, 0 8pt 18pt #0008; }
  .logo { font: 400 92pt/0.95 'Abril Fatface', Georgia, serif; color: #ffd23f; text-shadow: 4pt 4pt 0 #e3263e; letter-spacing: -1pt; }
  .logo.sm { font-size: 46pt; text-shadow: 2.5pt 2.5pt 0 #e3263e; text-align: center; margin-bottom: 16pt; }
  .tagline { font: 700 13pt/1.3 'Barlow Condensed', sans-serif; letter-spacing: .3em; text-transform: uppercase; margin-top: 16pt; }
  .strip { position: absolute; left: 0; right: 0; bottom: .7in; display: flex; justify-content: center; gap: 20pt; font: 700 10.4pt/1 'Barlow Condensed', sans-serif; letter-spacing: .18em; text-transform: uppercase; }
  .strip b { background: #ffd23f; color: #14121f; padding: 5pt 10pt; border-radius: 3pt; } .strip span { padding: 5pt 0; }
  .summary { background: #f7eed6; color: #1c1a2a; border: 2pt solid #14121f; border-radius: 10pt; padding: 14pt 16pt; box-shadow: 4pt 4pt 0 #05060f; margin-bottom: 14pt; }
  .summary .step { margin-bottom: 7pt; } .summary .step p { font-size: 10.4pt; }
  .anytime { margin-top: 4pt; padding-top: 8pt; border-top: 1.2pt dashed #14121f80; font: 700 10.4pt/1 'Barlow Condensed', sans-serif; letter-spacing: .12em; text-transform: uppercase; }
  .card3 { background: #1c2046; border: 1.6pt solid #5a62b0; border-radius: 9pt; padding: 12pt 14pt 7pt; margin-bottom: 14pt; }
  .card3 h3 { color: #ffd23f; } .card3 p { font-size: 9.8pt; line-height: 1.36; }
  .credit { position: absolute; left: .68in; right: .68in; bottom: .45in; text-align: center; font-size: 8.4pt; color: #bfc4f0; }
`;
// The game's stylesheet is linked for the cards, and it has classes of its own called .scene, .row, .tip and so on.
// Every class that belongs to the rulebook's layout is given an rb- prefix here so the two never collide.
const MINE = new Set('pg cover last fan logo sm tagline strip lead box2 row tight mini cap tokens rtok marker off boy setup note hot steps3 step num scene small side who swap bubble r two three out bad good tip wide payrow heatrow monorow arrow bigtok whistle powers power entries entry meta tag foot summary anytime card3 credit k-heat k-cover k-score'.split(' '));
const prefixHtml = (h) => h.replace(/class="([^"]*)"/g, (m, list) => `class="${list.split(/\s+/).filter(Boolean).map((c) => (MINE.has(c) ? `rb-${c}` : c)).join(' ')}"`);
const prefixCss = (c) => c.replace(/\.([a-zA-Z][\w-]*)/g, (m, name) => (MINE.has(name) ? `.rb-${name}` : m));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Handland rulebook</title><link rel="stylesheet" href="../public/style.css"><style>${prefixCss(css)}</style></head><body>${prefixHtml(pages.join('\n'))}</body></html>`;
fs.writeFileSync(path.join(root, 'print', 'rulebook.html'), html);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 816, height: 1056, webPreferences: { offscreen: true } });
  await win.loadURL(pathToFileURL(path.join(root, 'print', 'rulebook.html')).href);
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 600)))');
  const pdf = await win.webContents.printToPDF({ pageSize: 'Letter', printBackground: true, preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  fs.writeFileSync(path.join(root, 'print', 'Handland-rulebook.pdf'), pdf);
  console.log('rulebook pdf bytes', pdf.length);
  app.quit();
});
