// Checks that finishing a game pays Shop Tokens, in the app's own runtime (Electron): plays a short game against one
// Insane bot, gives me five of a kind so I win, and prints the wallet before and after, the payout shown, and the
// feats ticked off in the Shop. Also checks that looking at the same finished game again does not pay twice.
// Run with:  npx electron scripts/earncheck.mjs <out folder>
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
process.env.HANDLAND_DEV = '1';
const { start } = await import('../src/server.js');
const out = path.resolve(process.argv[2] || 'build/earn');
fs.mkdirSync(out, { recursive: true });
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.whenReady().then(async () => {
  const port = await start({ anyPort: true });
  const win = new BrowserWindow({ width: 1920, height: 1200, show: false, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false, partition: 'earncheck' } });
  win.webContents.setFrameRate(30); win.webContents.on('paint', () => {});
  win.webContents.on('console-message', (e, level, msg) => { if (level >= 2 && !/Security Warning/.test(msg)) console.log('PAGE', msg.slice(0, 300)); });
  await win.loadURL(`http://127.0.0.1:${port}/`);
  const run = (js) => win.webContents.executeJavaScript(js, true).catch((e) => { console.log('RUN FAILED', String(e).slice(0, 200)); return null; });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = async (name) => { await wait(600); fs.writeFileSync(path.join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG()); console.log('shot', name); };
  const wallet = () => run(`JSON.parse(localStorage.getItem('handland-wallet') || '{"tokens":0}').tokens`);
  await run(`localStorage.clear(); localStorage.setItem('handland-setup', JSON.stringify({ bots: 1, difficulty: 3, winTarget: 1, speed: 0.5, clock: 4, whistle: 0, lawsuit: 1, marks: 'all', theme: 'backroom', deck: 'classic', bg: 'none' })); location.reload(); true`);
  await wait(2500);
  console.log('wallet before:', await wallet());
  await run(`document.querySelector('[data-do="botMenu"]').click(); new Promise((r) => setTimeout(r, 400)).then(() => { document.querySelector('[data-do="startBots"]').click(); return true; })`);
  await wait(6000);
  const api = (route, body) => run(`(async () => { const s = JSON.parse(sessionStorage.getItem('handland')); const r = await fetch('api/${route}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: s.code, token: s.token, ...${JSON.stringify(body)} }) }); return r.json(); })()`);
  const head = () => run(`document.querySelector('.prompt h2')?.innerText || ''`);
  const until = async (test, ms = 60000) => { for (let t = 0; t < ms; t += 300) { const h = await run(`(() => { for (const d of ['costPass', 'tradeNo', 'powerSkip']) { const x = document.querySelector('[data-do="' + d + '"]'); if (x) { x.click(); return ''; } } return document.querySelector('.prompt h2')?.innerText || ''; })()`); if (h && test(h)) return h; await wait(300); } return null; };
  for (let tries = 0; tries < 5; tries++) {
    await until((h) => h === 'Your turn' || /cornered/.test(h));
    if (/cornered/.test(await head())) break;
    await api('rig', { hand: [], res: ['Oil', 'Oil', 'Oil', 'Oil', 'Oil'] });
    await api('act', { action: { type: 'endTurn' } });
    const h = await until((x) => x === 'Your turn' || /cornered/.test(x));
    if (/cornered/.test(h || '')) break;
  }
  await wait(2500);
  console.log('ending:', JSON.stringify(await head()));
  console.log('payout shown:', JSON.stringify(await run(`[...document.querySelectorAll('.earned .etot, .earned .el')].map((e) => e.innerText.replace(/\\n/g, ' '))`)));
  console.log('wallet after:', await wallet());
  await snap('1-game-over');
  await win.webContents.reload(); await wait(3500);
  console.log('wallet after looking again (reload):', await wallet(), '| panel still shows:', await run(`!!document.querySelector('.earned')`));
  await run(`window.confirm = () => true; document.querySelector('[data-do="leave"]').click(); true`); await wait(900);
  await run(`document.querySelector('[data-do="shop"]').click(); true`); await wait(600);
  console.log('feats done in the shop:', JSON.stringify(await run(`[...document.querySelectorAll('.feats .feat.done b')].map((e) => e.innerText)`)), 'of', await run(`document.querySelectorAll('.feats .feat').length`));
  await snap('2-shop-feats');
  app.quit();
});
