// Pictures of every backdrop in the app's own runtime (Electron): one with the pointer in the middle, one leaning
// left and one leaning right (to see the layers slide), plus a second moment a few seconds later (to see things move).
// Run with:  npx electron scripts/bgshots.mjs <out folder> [width] [height] [ids, comma separated] [low]
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { start } from '../src/server.js';

const out = path.resolve(process.argv[2] || 'build/bg');
const W = Number(process.argv[3]) || 1920, H = Number(process.argv[4]) || 1200;
const ids = (process.argv[5] || 'none,castle,ship,underwater,space').split(',');
const gfx = process.argv[6] === 'low' ? 'low' : 'high';
fs.mkdirSync(out, { recursive: true });
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.whenReady().then(async () => {
  const port = await start({ anyPort: true });
  const win = new BrowserWindow({ width: W, height: H, show: false, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.setFrameRate(60);
  win.webContents.on('paint', () => {});
  win.webContents.on('console-message', (e, level, msg) => { if (level >= 2) console.log('PAGE', msg); });
  const run = (js) => win.webContents.executeJavaScript(js, true);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = async (name) => { fs.writeFileSync(path.join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG()); };
  const move = (x, y) => win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) });
  for (const id of ids) {
    await win.loadURL(`http://127.0.0.1:${port}/`);
    await run(`sessionStorage.clear(); localStorage.setItem('handland-gfx', '${gfx}'); localStorage.setItem('handland-wallet', JSON.stringify({ tokens: 0, owned: ['castle', 'ship', 'underwater', 'space'] })); localStorage.setItem('handland-setup', JSON.stringify({ bots: 3, difficulty: 1, winTarget: 2, speed: 2, clock: 0, whistle: 1, lawsuit: 1, theme: 'backroom', deck: 'classic', bg: '${id}' })); location.reload(); true`);
    await wait(2200);
    await run(`document.querySelector('[data-do="botMenu"]').click(); new Promise((r) => setTimeout(r, 400)).then(() => { document.querySelector('[data-do="startBots"]').click(); return true; })`);
    await wait(1100); await snap(`${id}-0-arriving`);
    await wait(5200);
    move(W * 0.45, H * 0.5); await wait(900); await snap(`${id}-1-middle`);
    move(4, H * 0.3); await wait(1200); await snap(`${id}-2-lean-left`);
    move(W - 4, H * 0.3); await wait(1200); await snap(`${id}-3-lean-right`);
    move(W * 0.45, H * 0.5); await wait(3000); await snap(`${id}-4-later`);
    const info = await run(`({ bg: document.body.dataset.bg, layers: document.querySelectorAll('#room .bgl, #room .bgfront').length, sprites: document.querySelectorAll('#room .spr').length, running: document.getAnimations().filter((a) => a.playState === 'running').length, lite: document.body.classList.contains('lite') })`);
    console.log(id, JSON.stringify(info));
  }
  app.quit();
});
