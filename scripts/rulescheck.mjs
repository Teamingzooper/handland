// Pictures of the 0.19 rule changes in the app's own runtime (Electron): the Duplicator tucked under its card (mine
// and another player's), the empty place a card leaves while it is out in a trade, the "Call it off" button when the
// other side changes the terms, the prompt to move a loose Duplicator, and the setting for seen-card marks.
// Run with:  npx electron scripts/rulescheck.mjs <out folder>
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
process.env.HANDLAND_DEV = '1';
const { start } = await import('../src/server.js');
const out = path.resolve(process.argv[2] || 'build/rules');
fs.mkdirSync(out, { recursive: true });
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.whenReady().then(async () => {
  const port = await start({ anyPort: true });
  const win = new BrowserWindow({ width: 1920, height: 1200, show: false, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.setFrameRate(30); win.webContents.on('paint', () => {});
  win.webContents.on('console-message', (e, level, msg) => { if (level >= 2 && !/Security Warning/.test(msg)) console.log('PAGE', msg.slice(0, 300)); });
  await win.loadURL(`http://127.0.0.1:${port}/`);
  const run = (js) => win.webContents.executeJavaScript(js, true).catch((e) => { console.log('RUN FAILED', String(e).slice(0, 200)); return null; });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = async (name) => { await wait(500); fs.writeFileSync(path.join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG()); console.log('shot', name); };
  await run(`localStorage.setItem('handland-gfx', 'high'); localStorage.setItem('handland-setup', JSON.stringify({ bots: 2, difficulty: 1, winTarget: 3, speed: 1.8, clock: 4, whistle: 0, lawsuit: 1, marks: 'all', theme: 'backroom', deck: 'classic', bg: 'none' })); location.reload(); true`);
  await wait(2500);
  await run(`document.querySelector('[data-do="botMenu"]').click(); true`); await snap('1-setup');
  await run(`document.querySelector('[data-do="startBots"]').click(); true`);
  await wait(6500);
  const api = (route, body) => run(`(async () => { const s = JSON.parse(sessionStorage.getItem('handland')); const r = await fetch('/api/${route}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: s.code, token: s.token, ...${JSON.stringify(body)} }) }); return r.json(); })()`);
  const head = () => run(`document.querySelector('.prompt h2')?.innerText || ''`);
  const myTurn = async () => { for (let i = 0; i < 300; i++) { const h = await run(`(() => { for (const d of ['costPass', 'tradeNo']) { const x = document.querySelector('[data-do="' + d + '"]'); if (x) { x.click(); return ''; } } return document.querySelector('.prompt h2')?.innerText || ''; })()`); if (h === 'Your turn') return true; await wait(300); } return false; };
  const myRes = () => run(`[...document.querySelectorAll('.mine .cards .card[data-zone="res"]')].map((c) => Number(c.dataset.id))`);
  await myTurn();
  // 1. Duplicators under cards: mine (second card) and the first opponent's (their third card), my Heat at 2
  await api('rig', { hand: [], res: ['Oil', 'Oil', 'Farmland', 'Livestock', 'Workers'], dup: 1, theirDup: { seat: 1, at: 2 }, heat: 2 });
  await wait(900); await snap('2-duplicators');
  // 2. offer my doubled card in a trade: its place stays empty
  let ids = await myRes();
  console.log('offer', JSON.stringify(await api('act', { action: { type: 'offerTrade', to: 1, cardId: ids[1], claim: 'Oil', ask: 'Weapons' } })));
  await wait(700); await snap('3-place-kept');
  console.log('gaps drawn:', await run(`document.querySelectorAll('.mine .cards .card.gap').length`), 'cards in my row:', (await myRes()).length);
  // 3. wait for the answer; if they changed the terms the Call it off button is there
  for (let i = 0; i < 40; i++) { const h = await head(); if (/put a card down|Your turn/.test(h)) break; await wait(300); }
  console.log('after answer:', JSON.stringify(await head()), 'call-off button:', await run(`!!document.querySelector('[data-do="finishCancel"]')`));
  await snap('4-their-answer');
  if (await run(`!!document.querySelector('[data-do="finishCancel"]')`)) { await run(`document.querySelector('[data-do="finishCancel"]').click(); true`); await wait(900); }
  else if (await run(`!!document.querySelector('[data-do="finishOk"]')`)) { await run(`document.querySelector('[data-do="finishOk"]').click(); true`); await wait(900); }
  console.log('row after:', JSON.stringify(await run(`[...document.querySelectorAll('.mine .cards .card[data-zone="res"] .ttl')].map((e) => e.innerText)`)), 'gaps:', await run(`document.querySelectorAll('.mine .cards .card.gap').length`));
  await snap('5-back-in-place');
  // 4. a loose Duplicator: the owner is asked where it goes
  await api('rig', { dup: 'loose' });
  await api('act', { action: { type: 'discard', resIds: [], cardIds: [] } });
  await wait(900); await snap('6-move-duplicator');
  console.log('prompt:', JSON.stringify(await head()));
  ids = await myRes();
  await run(`document.querySelector('.mine .cards .card[data-zone="res"][data-id="${ids[0]}"]').click(); true`); await wait(900);
  console.log('after move:', JSON.stringify(await head()), 'tucked under cards:', await run(`document.querySelectorAll('.mine .cards .card > .card.dup').length`));
  await snap('7-moved');
  app.quit();
});
