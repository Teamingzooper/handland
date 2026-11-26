// Takes screenshots of the game in the same runtime the packaged app uses (Electron), not in a desktop browser.
// The two do not always lay things out the same way, so screens are checked here before a build is handed over.
// Run with:  npx electron scripts/shot.mjs <out folder> [width] [height]
// It walks the menus (home, bot setup, Customize, Shop, Deck Maker), a hosted lobby and a bot game, saving one PNG per screen.
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { start } from '../src/server.js';

const out = path.resolve(process.argv[2] || 'build/shots');
const W = Number(process.argv[3]) || 1920, H = Number(process.argv[4]) || 1200;
fs.mkdirSync(out, { recursive: true });
app.whenReady().then(async () => {
  const port = await start({ anyPort: true });
  const win = new BrowserWindow({ width: W, height: H, show: false, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.setFrameRate(30);
  await win.loadURL(`http://127.0.0.1:${port}/`);
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = async (name) => { await wait(500); fs.writeFileSync(path.join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG()); console.log('shot', name); };
  const click = (sel) => run(`document.querySelector(${JSON.stringify(sel)})?.click(); true`);
  await run(`localStorage.setItem('handland-gfx', 'high'); localStorage.setItem('handland-wallet', JSON.stringify({ tokens: 300, owned: ['emerald', 'castle', 'reef'] })); localStorage.setItem('handland-setup', JSON.stringify({ bots: 3, difficulty: 1, winTarget: 2, speed: 1, clock: 1, whistle: 1, lawsuit: 1, theme: 'backroom', deck: 'classic', bg: 'castle' })); location.reload(); true`);
  await wait(2500);
  console.log('chrome', process.versions.chrome, 'electron', process.versions.electron);
  await snap('1-home');
  await click('[data-do="botMenu"]'); await snap('2-setup');
  await click('[data-do="custom"]'); await snap('3-customize-top');
  await run(`document.querySelector('.shop.custom').scrollTop = 520; true`); await snap('4-customize-tiles');
  await click('[data-do="shop"]'); await snap('5-shop-top');
  await run(`document.querySelector('.shop').scrollTop = 700; true`); await snap('6-shop-lower');
  await click('[data-do="maker"]'); await snap('7-deck-maker');
  await click('[data-do="homeBack"]'); await click('[data-do="customDone"]');
  await click('[data-do="homeBack"]'); await wait(300); // from the bot setup back to the front page
  await click('[data-do="host"]'); await wait(1200); await snap('8-lobby');
  await run(`window.confirm = () => true; document.querySelector('[data-do="leave"]')?.click(); true`); await wait(1200);
  await click('[data-do="botMenu"]'); await wait(300); await click('[data-do="startBots"]');
  await wait(6000); await snap('9-table');
  app.quit();
});
