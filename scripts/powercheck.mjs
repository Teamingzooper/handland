// Checks the monopoly-power screens in the app's own runtime (Electron): deals a bot game, gives me five of one
// resource, ends my turn, waits for it to score, and saves pictures of the power prompt (and Harvest's card choice).
// Run with:  npx electron scripts/powercheck.mjs <out folder> [resource, default Farmland] [phone]
// With `phone` it runs at phone size with the phone layout on, and picks the Harvest cards with real taps.
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
process.env.HANDLAND_DEV = '1';
const { start } = await import('../src/server.js');
const out = path.resolve(process.argv[2] || 'build/power'), res = process.argv[3] || 'Farmland', phone = process.argv[4] === 'phone', k = phone ? 2 : 1;
fs.mkdirSync(out, { recursive: true });
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.whenReady().then(async () => {
  const port = await start({ anyPort: true });
  const win = new BrowserWindow({ width: phone ? 1460 : 1920, height: phone ? 676 : 1200, show: false, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false, zoomFactor: k } });
  win.webContents.setFrameRate(30); win.webContents.on('paint', () => {});
  win.webContents.on('console-message', (e, level, msg) => { if (level >= 2 && !/Security Warning/.test(msg)) console.log('PAGE', msg.slice(0, 300)); });
  await win.loadURL(`http://127.0.0.1:${port}/${phone ? '?phone=1' : ''}`);
  if (phone) win.webContents.setZoomFactor(2);
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = async (name) => { await wait(700); fs.writeFileSync(path.join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG()); console.log('shot', name); };
  await run(`localStorage.setItem('handland-gfx', 'high'); localStorage.setItem('handland-setup', JSON.stringify({ bots: 2, difficulty: 0, winTarget: 3, speed: 0.5, clock: 0, whistle: 0, lawsuit: 1, theme: 'backroom', deck: 'classic', bg: 'none' })); location.reload(); true`);
  await wait(2500);
  await run(`document.querySelector('[data-do="botMenu"]').click(); new Promise((r) => setTimeout(r, 400)).then(() => { document.querySelector('[data-do="startBots"]').click(); return true; })`);
  await wait(6000);
  const api = (route, body) => run(`(async () => { const s = JSON.parse(sessionStorage.getItem('handland')); const r = await fetch('/api/${route}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: s.code, token: s.token, ...${JSON.stringify(body)} }) }); return r.json(); })()`);
  const head = () => run(`document.querySelector('.prompt h2')?.innerText || ''`);
  const myTurn = async () => { for (let i = 0; i < 400; i++) { const h = await run(`(() => { for (const d of ['costPass', 'tradeNo', 'finishOk']) { const x = document.querySelector('[data-do="' + d + '"]'); if (x) { x.click(); return ''; } } return document.querySelector('.prompt h2')?.innerText || ''; })()`); if (h === 'Your turn' || /Fracking|Stampede|Harvest|Shakedown|Boycott/.test(h)) return h; await wait(300); } return 'timeout'; };
  for (let tries = 0; tries < 4; tries++) {
    await myTurn();
    await api('rig', { hand: [], res: [res, res, res, res, res] });
    console.log('end turn', JSON.stringify(await api('act', { action: { type: 'endTurn' } })));
    await wait(1500);
    const h = await myTurn();
    console.log('back to me:', h);
    if (h !== 'Your turn' && h !== 'timeout') break; // the power prompt is up (otherwise a bot broke the hold: try again)
  }
  await wait(3500); await snap('1-power-prompt');
  console.log('prompt:', JSON.stringify(await run(`document.querySelector('.prompt').innerText`)));
  await run(`document.querySelector('[data-do="powerUse"]').click(); true`);
  await snap('2-after-use');
  if (res === 'Farmland') {
    // On a phone the cards are tapped for real (a tap on a card normally opens it large; Harvest cards must pick instead).
    const tap = async (n) => { const at = await run(`(() => { const r = document.querySelectorAll('[data-do="harvest"] .card')[${n}].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`); for (const type of ['mouseDown', 'mouseUp']) win.webContents.sendInputEvent({ type, x: Math.round(at[0] * k), y: Math.round(at[1] * k), button: 'left', clickCount: 1 }); await wait(400); };
    if (phone) await tap(1); else await run(`document.querySelectorAll('[data-do="harvest"]')[1].click(); true`);
    await snap('3-harvest-kept');
    console.log('kept marked:', await run(`document.querySelectorAll('.tippick.kept').length`), 'big card open:', await run(`!document.getElementById('zoom').classList.contains('hidden')`));
    if (phone) await tap(2); else await run(`document.querySelectorAll('[data-do="harvest"]')[2].click(); true`);
    await snap('4-harvest-done');
  }
  console.log('after:', JSON.stringify(await head()), 'boycott badges:', await run(`document.querySelectorAll('.inj.boy').length`));
  app.quit();
});
