// Checks, in the app's own runtime (Electron), that cards you point at on the table never sink under the felt.
// It deals a bot game, plays an Insider Tip (two cards to choose from in the middle of the table), moves the
// pointer onto a choice card and off again, and records how high the card sits above the felt on every frame.
// Any frame below the felt is a fault. It also saves pictures of the hovered card and of the moment after choosing.
// Run with:  npx electron scripts/hovercheck.mjs <out folder>
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
process.env.HANDLAND_DEV = '1';
const { start } = await import('../src/server.js');

const out = path.resolve(process.argv[2] || 'build/hover');
fs.mkdirSync(out, { recursive: true });
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.whenReady().then(async () => {
  const port = await start({ anyPort: true });
  const win = new BrowserWindow({ width: 1920, height: 1200, show: false, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.setFrameRate(60);
  win.webContents.on('paint', () => {});
  await win.loadURL(`http://127.0.0.1:${port}/`);
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = async (name) => { fs.writeFileSync(path.join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG()); };
  const move = (x, y) => win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) });
  await run(`localStorage.setItem('handland-gfx', 'high'); localStorage.setItem('handland-setup', JSON.stringify({ bots: 3, difficulty: 1, winTarget: 2, speed: 0.5, clock: 0, whistle: 1, lawsuit: 1, theme: 'backroom', deck: 'classic', bg: '${process.argv[3] || 'none'}' })); location.reload(); true`);
  await wait(2500);
  await run(`document.querySelector('[data-do="botMenu"]').click(); new Promise((r) => setTimeout(r, 400)).then(() => { document.querySelector('[data-do="startBots"]').click(); return true; })`);
  await wait(6000);
  const api = (route, body) => run(`(async () => { const s = JSON.parse(sessionStorage.getItem('handland')); const r = await fetch('/api/${route}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: s.code, token: s.token, ...${JSON.stringify(body)} }) }); return r.json(); })()`);
  // Wait for my turn, waving through anything the bots ask in the meantime.
  for (let i = 0; i < 300; i++) {
    const mine = await run(`(() => { for (const d of ['costPass', 'tradeNo', 'finishOk']) { const x = document.querySelector('[data-do="' + d + '"]'); if (x) { x.click(); return false; } } return (document.querySelector('.prompt h2')?.innerText || '') === 'Your turn'; })()`);
    if (mine) break;
    await wait(300);
  }
  await api('rig', { hand: ['tip', 'strike'] });
  await wait(800);
  const cardId = await run(`Number([...document.querySelectorAll('.hand .card')].find((c) => /Insider/.test(c.textContent))?.dataset.cid.slice(1))`);
  console.log('play tip', JSON.stringify(await api('act', { action: { type: 'playCard', cardId, payment: [] } })));
  await wait(1800);
  const spots = await run(`[...document.querySelectorAll('.tippick .card')].map((c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height]; })`);
  console.log('choice cards at', JSON.stringify(spots));
  if (!spots.length) { await snap('no-tip'); console.log('NO TIP CARDS SHOWN'); app.quit(); return; }
  await snap('1-rest');
  // Record, on every frame, how far the lowest corner of the card is from the felt (below zero = under the table).
  const watch = (sel) => run(`window.__z = []; window.__on = true; (function tick() { const c = document.querySelector(${JSON.stringify(sel)}); if (c) { const cs = getComputedStyle(c), m = new DOMMatrix(cs.transform), [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat), w = c.offsetWidth, h = c.offsetHeight; let low = Infinity; for (const x of [-ox, w - ox]) for (const y of [-oy, h - oy]) low = Math.min(low, m.m13 * x + m.m23 * y + m.m43); window.__z.push(+low.toFixed(2)); } if (window.__on) requestAnimationFrame(tick); })(); true`);
  const report = async (label) => { const zs = await run(`window.__on = false; window.__z`); console.log('HOVER', label, JSON.stringify({ frames: zs.length, lowestCornerPx: Math.min(...zs), framesUnderFelt: zs.filter((v) => v < -0.01).length })); };
  await watch('.tippick .card');
  move(spots[0][0], spots[0][1]); await wait(60); move(spots[0][0] + 6, spots[0][1] + 4);
  await wait(600); await snap('2-hovered');
  move(300, 700); // off the card, onto empty felt
  await wait(700);
  await report('insider tip choice');
  // The same for one of my own resource cards.
  const mine = await run(`(() => { const r = document.querySelector('.mine .cards .card').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await watch('.mine .cards .card');
  move(mine[0], mine[1]); await wait(60); move(mine[0] + 5, mine[1] + 5); await wait(600); await snap('3-resource-hovered');
  move(300, 700); await wait(700);
  await report('my resource card');
  // Choose the card and watch it leave.
  move(spots[0][0], spots[0][1]); await wait(400);
  win.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(spots[0][0]), y: Math.round(spots[0][1]), button: 'left', clickCount: 1 });
  win.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(spots[0][0]), y: Math.round(spots[0][1]), button: 'left', clickCount: 1 });
  for (let i = 0; i < 8; i++) { await wait(70); await snap(`5-chosen-${i}`); }
  app.quit();
});
