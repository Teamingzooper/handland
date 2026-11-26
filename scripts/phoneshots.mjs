// Pictures of the game at phone size, in the app's own runtime (Electron), with the phone layout switched on.
// It plays to my turn, gives me a four-card hand, and saves: the table, a card opened large by tapping it,
// the Menu sheet, and a report of anything that overlaps or hangs off the screen.
// Run with:  npx electron scripts/phoneshots.mjs <out folder> [width] [height]
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
process.env.HANDLAND_DEV = '1';
const { start } = await import('../src/server.js');

const out = path.resolve(process.argv[2] || 'build/phone');
const W = Number(process.argv[3]) || 730, H = Number(process.argv[4]) || 338;
fs.mkdirSync(out, { recursive: true });
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.whenReady().then(async () => {
  const port = await start({ anyPort: true });
  // The window is twice the size and zoomed 2x, so the page sees a W x H screen and the pictures come out sharp.
  const win = new BrowserWindow({ width: W * 2, height: H * 2, show: false, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false, zoomFactor: 2 } });
  win.webContents.setFrameRate(30);
  win.webContents.on('paint', () => {});
  await win.loadURL(`http://127.0.0.1:${port}/?phone=1`);
  win.webContents.setZoomFactor(2);
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = async (name) => { await wait(350); fs.writeFileSync(path.join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG()); };
  const tap = async (sel) => { const at = await run(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + Math.min(r.height / 2, 14)]; })()`); if (!at) { console.log('nothing to tap:', sel); return; } for (const type of ['mouseDown', 'mouseUp']) win.webContents.sendInputEvent({ type, x: Math.round(at[0] * 2), y: Math.round(at[1] * 2), button: 'left', clickCount: 1 }); await wait(250); };
  await run(`localStorage.setItem('handland-wallet', JSON.stringify({ tokens: 0, owned: ['castle', 'ship', 'underwater', 'space'] })); localStorage.setItem('handland-setup', JSON.stringify({ bots: 3, difficulty: 1, winTarget: 2, speed: 0.5, clock: 0, whistle: 1, lawsuit: 1, theme: 'backroom', deck: 'medieval', bg: 'space' })); location.reload(); true`);
  await wait(2500); await snap('1-home');
  await run(`document.querySelector('[data-do="botMenu"]').click(); true`); await snap('2-setup');
  await run(`document.querySelector('[data-do="startBots"]').click(); true`);
  await wait(6000);
  for (let i = 0; i < 300; i++) {
    const mine = await run(`(() => { for (const d of ['costPass', 'tradeNo', 'finishOk']) { const x = document.querySelector('[data-do="' + d + '"]'); if (x) { x.click(); return false; } } return (document.querySelector('.prompt h2')?.innerText || '') === 'Your turn'; })()`);
    if (mine) break;
    await wait(300);
  }
  const api = (route, body) => run(`(async () => { const s = JSON.parse(sessionStorage.getItem('handland')); const r = await fetch('/api/${route}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: s.code, token: s.token, ...${JSON.stringify(body)} }) }); return r.json(); })()`);
  await api('rig', { hand: ['whistleblower', 'tip', 'audit', 'audit'] });
  await wait(900); await snap('3-table');
  // Anything overlapping or off the screen?
  const report = await run(`(() => { const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { s, l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
    const zones = ['.dock', '.handcol', '.seatbox.me', '.mine .cards', '#stage', '.piles', '.opps'].map(box).filter(Boolean), bad = [];
    for (const z of zones) if (z.l < -1 || z.t < -1 || z.r > innerWidth + 1 || z.b > innerHeight + 1) bad.push(z.s + ' hangs off the screen ' + JSON.stringify(z));
    for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) { const a = zones[i], b = zones[j], w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t); if (w > 4 && h > 4 && !(a.s === '.opps' || b.s === '.opps')) bad.push(a.s + ' overlaps ' + b.s + ' by ' + w + 'x' + h); }
    const hand = [...document.querySelectorAll('.hand .card')].map((c) => Math.round(c.getBoundingClientRect().bottom)), heads = [...document.querySelectorAll('.opp .bust')].map((c) => Math.round(c.getBoundingClientRect().top));
    return { size: innerWidth + 'x' + innerHeight, hud: getComputedStyle(document.body).getPropertyValue('--hud'), classes: document.body.className, problems: bad, lowestHandCard: Math.max(...hand), highestHead: Math.min(...heads) }; })()`);
  console.log('PHONE', JSON.stringify(report));
  await tap('.hand .hslot:nth-child(3) .card'); await snap('4-card-opened');
  await run(`document.querySelector('#zoom [data-do="zoomClose"]')?.click(); true`);
  await tap('.mine .cards .card'); await snap('5-resource-opened');
  await run(`document.querySelector('#zoom [data-do="zoomClose"]')?.click(); true`);
  await tap('.handcol [data-do="menu"]'); await snap('6-menu');
  await run(`document.querySelector('[data-do="sheetClose"]')?.click(); true`);
  // Insider Tip: tap it, play it from the big card, then open one of the two choices
  await tap('.hand .hslot:nth-child(2) .card');
  console.log('tip button:', await run(`document.querySelector('#zoom [data-do="zoomGo"]')?.innerText || 'none'`));
  await run(`document.querySelector('#zoom [data-do="zoomGo"]')?.click(); true`); await wait(600);
  await run(`document.querySelector('[data-do="playGo"], .prompt .btn.go')?.click(); true`); await wait(1500); await snap('7-after-play');
  await tap('.tippick .card'); await snap('8-tip-choice-opened');
  console.log('choice button:', await run(`document.querySelector('#zoom [data-do="zoomGo"]')?.innerText || 'none'`));
  await run(`document.querySelector('#zoom [data-do="zoomGo"]')?.click(); true`); await wait(1200); await snap('9-kept');
  app.quit();
});
