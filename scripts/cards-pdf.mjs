// Builds the print-and-play set: print/cards.html and print/Handland-cards.pdf (US Letter; also prints on A4 at 100%).
// Every card in the box at real playing-card size (2.5 x 3.5 inches), nine to a sheet with cut marks, drawn by the
// game's own card code so they match the screen: 70 resources, the Action and Boost deck, the Hold and Boycott
// markers, sheets of card backs for the reverse side, and a sheet of tokens. Counts come from the rules (engine.js).
// Run with:  npx electron scripts/cards-pdf.mjs
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARDS, RULES, TYPES } from '../src/engine.js';
import { art, ico, CARD_BACK } from '../public/art.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RES_EACH = 14, PLAYERS = 6;

// ---------- the cards, as in the game ----------
const pip = (t) => `<span class="pip p-${t}">${ico(t)}</span>`;
const play = (kind) => { const d = CARDS[kind]; return `<div class="card pc ${d.kind} ${d.name.length > 9 ? 'longname' : ''}"><div class="cardface"><div class="ttl"><span>${d.name}</span><span class="pips">${d.cost.map(pip).join('')}</span></div>${art(kind)}<div class="typ">${d.kind === 'boost' ? 'Boost' : 'Action'} · ${d.cost.length ? d.cost.join(' + ') : 'Free'}</div><div class="txt">${d.short}</div></div></div>`; };
const res = (type) => `<div class="card res t-${type}"><div class="cardface"><div class="ttl">${type}</div>${art(type)}<div class="typ">Resource</div></div></div>`;
// The two decks get different backs. Each colour needs its own copy of the back's diamond pattern, because a pattern
// takes its colours from where it is first defined, not from the card that uses it.
const back = (cls = '') => `<div class="card back ${cls}"><div class="cardface">${cls === 'aback' ? CARD_BACK.replaceAll('bkPat', 'bkPatA') : CARD_BACK}</div></div>`;
const marker = (cls, big, small) => `<div class="card marker ${cls}"><div class="mk"><b>${big}</b><span>${small}</span></div></div>`;
const TOK = {
  heat: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1c.5 2.6 3.6 4 3.6 7.6A3.6 3.6 0 0 1 8 15a3.6 3.6 0 0 1-3.6-3.6c0-1.6.8-2.6 1.6-3.4.2 1 .7 1.6 1.2 1.8C6.6 7 7 3.6 8 1Z"/></svg>',
  cover: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1 14 3v4.6c0 3.6-2.6 6.2-6 7.4-3.4-1.2-6-3.8-6-7.4V3Z"/></svg>',
  score: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 5 5 8l3-5 3 5 3.5-3-1.4 8H2.9Z"/></svg>',
};

// ---------- what goes on which sheet ----------
const resources = TYPES.flatMap((t) => Array.from({ length: RES_EACH }, () => res(t)));
const actions = Object.keys(CARDS).flatMap((k) => Array.from({ length: CARDS[k].copies }, () => play(k)));
const markers = [
  ...Array.from({ length: PLAYERS }, () => marker('hold', 'Holding', 'I have five of a kind')),
  ...Array.from({ length: PLAYERS }, () => marker('nohold', 'Not holding', 'Nothing to see here')),
  marker('boy', 'Boycott', 'No Action cards on your next turn'), marker('boy', 'Boycott', 'No Action cards on your next turn'),
];
const tokens = [
  ...Array.from({ length: PLAYERS * RULES.heatCap }, () => `<div class="tk heat">${TOK.heat}<b>Heat</b></div>`),
  ...Array.from({ length: PLAYERS * RULES.coverCap }, () => `<div class="tk cover">${TOK.cover}<b>Cover</b></div>`),
  ...Array.from({ length: 13 }, () => `<div class="tk score">${TOK.score}<b>Monopoly</b></div>`),
];
const sheets = (cards, label) => { const out = []; for (let i = 0; i < cards.length; i += 9) out.push({ label, cards: cards.slice(i, i + 9) }); return out; };
const faces = [...sheets(resources, 'Resource cards'), ...sheets(actions, 'Action and Boost cards'), ...sheets(markers, 'Markers')];
const backs = [{ label: 'Backs for the resource cards', cards: Array.from({ length: 9 }, () => back('rback')) }, { label: 'Backs for the Action and Boost cards', cards: Array.from({ length: 9 }, () => back('aback')) }, { label: 'Backs for the markers', cards: Array.from({ length: 9 }, () => marker('mback', 'Handland', 'marker')) }];
const nRes = sheets(resources).length, nAct = sheets(actions).length, nMark = sheets(markers).length;
const total = resources.length + actions.length + markers.length;

// cut marks: short lines in the margins at every card edge, so nothing is printed across a card
const marks = (() => {
  const xs = [0, 2.5, 5, 7.5], ys = [0, 3.5, 7, 10.5]; let m = '';
  for (const x of xs) m += `<i style="left:${x}in;top:-.2in;width:0;height:.14in;border-left:.6pt solid #000"></i><i style="left:${x}in;top:${10.5 + 0.06}in;width:0;height:.14in;border-left:.6pt solid #000"></i>`;
  for (const y of ys) m += `<i style="top:${y}in;left:-.2in;height:0;width:.14in;border-top:.6pt solid #000"></i><i style="top:${y}in;left:${7.5 + 0.06}in;height:0;width:.14in;border-top:.6pt solid #000"></i>`;
  return m;
})();
const sheet = (s, n, of, note = '') => `<div class="pp-page"><div class="pp-head"><b>Handland</b><span>${s.label}</span><span>${note || `sheet ${n} of ${of}`}</span></div><div class="pp-grid">${marks}${s.cards.join('')}</div></div>`;

const intro = `<div class="pp-page pp-intro">
  <h1>Handland</h1><p class="pp-sub">Print and play</p>
  <div class="pp-cols">
    <div>
      <h2>What is here</h2>
      <table>
        <tr><td>${resources.length} resource cards (${RES_EACH} each of ${TYPES.join(', ')})</td><td>${nRes} sheets</td></tr>
        <tr><td>${actions.length} Action and Boost cards</td><td>${nAct} sheets</td></tr>
        <tr><td>${markers.length} markers (Holding and Not holding for ${PLAYERS} players, 2 Boycott)</td><td>${nMark} sheets</td></tr>
        <tr><td>Card backs: resources, Action and Boost, markers</td><td>3 sheets</td></tr>
        <tr><td>${PLAYERS * RULES.heatCap} Heat, ${PLAYERS * RULES.coverCap} Cover and 13 Monopoly tokens</td><td>1 sheet</td></tr>
      </table>
      <p>${total} cards in all, at standard playing-card size: 2.5 by 3.5 inches (63.5 by 89 mm).</p>
      <h2>Printing</h2>
      <ol>
        <li>Print at <b>100%</b> ("actual size"), not "fit to page". On A4 the cards stay the right size; the margins are just a little different.</li>
        <li>Use heavy paper or card stock (200 gsm or more) if your printer takes it.</li>
        <li><b>Easiest:</b> print the fronts only, cut them out, and slide each one into a card sleeve in front of an ordinary playing card. Use one colour of sleeve for resources and another for the Action and Boost deck.</li>
        <li><b>Double-sided:</b> print a front sheet, turn it over, and print the matching back sheet on the other side. The backs are the same in every position, so they line up whichever way the sheet is turned.</li>
        <li>Cut along the short marks in the margins. The cards touch each other, so every cut is shared.</li>
      </ol>
    </div>
    <div>
      <h2>Keep the decks apart</h2>
      <p>The game uses two decks: the <b>resource deck</b> and the <b>Action and Boost deck</b>. Their backs are different colours here so they cannot get mixed up.</p>
      <div class="pp-backs">${back('rback')}${back('aback')}</div>
      <p class="pp-cap">Blue back: resources. Red back: Action and Boost cards.</p>
      <h2>Tokens</h2>
      <p>Cut the token sheet into circles, or use coins, beads or anything else in three colours. You need at most ${RULES.heatCap} Heat and ${RULES.coverCap} Cover per player.</p>
      <h2>Rules</h2>
      <p>The rulebook is a separate file, <b>Handland-rulebook.pdf</b>. It has the full rules with pictures, every card explained, and a one-page summary.</p>
    </div>
  </div>
</div>`;
const tokenPage = `<div class="pp-page"><div class="pp-head"><b>Handland</b><span>Tokens</span><span>cut into circles</span></div><div class="pp-tokens">${tokens.join('')}</div></div>`;

const pages = [intro, ...faces.map((s, i) => sheet(s, i + 1, faces.length)), ...backs.map((s) => sheet(s, 0, 0, 'print on the reverse, as many as you need')), tokenPage];

const css = `
  @page { size: letter; margin: 0; }
  html, body { height: auto !important; overflow: visible !important; margin: 0; background: #fff !important; }
  body::before, body::after { display: none !important; }
  body { font: 400 10.5pt/1.42 'Barlow', Helvetica, Arial, sans-serif; color: #14121f; --u: 6pt; }
  .pp-page { width: 8.5in; height: 11in; position: relative; overflow: hidden; break-after: page; background: #fff; }
  .pp-page:last-child { break-after: auto; }
  .pp-head { position: absolute; left: .5in; right: .5in; top: .09in; display: flex; gap: 12pt; align-items: baseline; font: 700 7pt/1 'Barlow Condensed', sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #555; }
  .pp-head b { color: #14121f; } .pp-head span:last-child { margin-left: auto; }
  .pp-grid { position: absolute; left: .5in; top: .25in; width: 7.5in; height: 10.5in; display: grid; grid-template-columns: repeat(3, 2.5in); grid-template-rows: repeat(3, 3.5in); }
  .pp-grid > i { position: absolute; display: block; }
  /* a card fills its 2.5 x 3.5 inch cell exactly; no shadows or rounded outer corners, so a straight cut is a clean edge */
  .pp-grid .card { --cw: 2.5in; width: 2.5in; height: 3.5in; border-radius: 0; box-shadow: none !important; transform: none !important; animation: none !important; outline: .4pt solid #14121f30; outline-offset: -.2pt; }
  .card .txt { display: grid !important; }
  .card.back .cardface { background: #14173a; }
  .card.back.aback { --bk-a: #7a1626; --bk-b: #9a2233; --bk-line: #ffd23f; --bk-gem: #14173a; --bk-h: #f7eed6; }
  .card.back.aback .cardface { background: #7a1626; }
  .card.marker { background: #f7eed6; display: grid; place-items: center; }
  .card.marker .mk { width: 86%; height: 88%; border: .05in solid #14121f; border-radius: .14in; display: grid; place-content: center; text-align: center; gap: .08in; }
  .card.marker b { font: 400 .34in/1 'Abril Fatface', Georgia, serif; color: inherit; }
  .card.marker span { font: 700 .11in/1.2 'Barlow Condensed', sans-serif; letter-spacing: .14em; text-transform: uppercase; padding: 0 .2in; }
  .card.marker.hold .mk { background: #35d08a; } .card.marker.nohold .mk { background: #fff; } .card.marker.boy .mk { background: #1f86e6; color: #fff; border-color: #14121f; }
  .card.marker.mback .mk { background: #14173a; color: #ffd23f; }
  /* the first page */
  .pp-intro { padding: .7in .75in; background: #f7eed6; }
  .pp-intro h1 { font: 400 54pt/1 'Abril Fatface', Georgia, serif; margin: 0; color: #14121f; text-shadow: 2.5pt 2.5pt 0 #ffd23f; }
  .pp-sub { font: 700 13pt/1 'Barlow Condensed', sans-serif; letter-spacing: .3em; text-transform: uppercase; margin: 8pt 0 20pt; }
  .pp-cols { display: grid; grid-template-columns: 1.25fr 1fr; gap: 28pt; }
  .pp-intro h2 { font: 400 17pt/1.1 'Abril Fatface', Georgia, serif; margin: 16pt 0 6pt; border-bottom: 2pt solid #14121f; padding-bottom: 4pt; }
  .pp-intro h2:first-child { margin-top: 0; }
  .pp-intro p { margin: 0 0 7pt; } .pp-intro b { color: inherit; }
  .pp-intro ol { margin: 0; padding-left: 16pt; } .pp-intro li { margin-bottom: 6pt; }
  .pp-intro table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
  .pp-intro td { border-bottom: .6pt solid #14121f60; padding: 4pt 0; vertical-align: top; } .pp-intro td:last-child { text-align: right; white-space: nowrap; font-weight: 700; padding-left: 10pt; }
  .pp-backs { display: flex; gap: 12pt; margin: 8pt 0 4pt; } .pp-backs .card { --cw: 78pt; box-shadow: 0 0 0 .11em #14121f, 2pt 3pt 0 #14121f40 !important; transform: none !important; }
  .pp-cap { font-size: 9pt; color: #3b3850; }
  /* tokens */
  .pp-tokens { position: absolute; left: .5in; top: .4in; width: 7.5in; display: grid; grid-template-columns: repeat(7, 1fr); gap: .1in .07in; justify-items: center; }
  .tk { width: .98in; height: .98in; border-radius: 50%; border: .04in solid #14121f; display: grid; place-content: center; justify-items: center; gap: .02in; }
  .tk svg { width: .4in; height: .4in; } .tk b { font: 700 .1in/1 'Barlow Condensed', sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #14121f; }
  .tk.heat { background: #ff8a2b; color: #14121f; } .tk.cover { background: #6cc0ff; color: #14121f; } .tk.score { background: #ffd23f; color: #14121f; }
`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Handland print and play</title><link rel="stylesheet" href="../public/style.css"><style>${css}</style></head><body>${pages.join('\n')}</body></html>`;
fs.writeFileSync(path.join(root, 'print', 'cards.html'), html);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 816, height: 1056, webPreferences: { offscreen: true } });
  await win.loadURL(pathToFileURL(path.join(root, 'print', 'cards.html')).href);
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 800)))');
  const pdf = await win.webContents.printToPDF({ pageSize: 'Letter', printBackground: true, preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  fs.writeFileSync(path.join(root, 'print', 'Handland-cards.pdf'), pdf);
  console.log(`cards pdf: ${pages.length} pages, ${total} cards (${resources.length} resources, ${actions.length} action and boost, ${markers.length} markers), ${tokens.length} tokens, ${pdf.length} bytes`);
  app.quit();
});
