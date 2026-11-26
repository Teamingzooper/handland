// Tries the web version (site/, built by scripts/site.sh) the way a static host serves it: plain files, no game
// server, under a sub-folder like GitHub Pages uses (/handland/). Plays a bot game and the start of the tutorial in
// the app's own runtime and saves pictures. Any failed file request or page error is printed.
// Run with:  npx electron scripts/sitecheck.mjs <out folder> [width] [height] [phone]
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..', 'site'), out = path.resolve(process.argv[2] || 'build/site');
const W = Number(process.argv[3]) || 1440, H = Number(process.argv[4]) || 900, phone = process.argv[5] === 'phone';
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const missing = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/handland/')) { missing.push(url.pathname); res.writeHead(404).end(); return; }
  const file = path.join(root, url.pathname === '/handland/' ? 'index.html' : url.pathname.slice(10));
  fs.readFile(file, (err, data) => { if (err) { missing.push(url.pathname); res.writeHead(404).end('Not found'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(data); });
});
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.whenReady().then(async () => {
  await new Promise((r) => server.listen(0, r));
  const k = phone ? 2 : 1;
  const win = new BrowserWindow({ width: W * k, height: H * k, show: false, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false, zoomFactor: k } });
  win.webContents.setFrameRate(30); win.webContents.on('paint', () => {});
  win.webContents.on('console-message', (e, level, msg) => { if (level >= 2 && !/Security Warning/.test(msg)) console.log('PAGE', msg.slice(0, 300)); });
  await win.loadURL(`http://127.0.0.1:${server.address().port}/handland/${phone ? '?phone=1' : ''}`);
  if (phone) win.webContents.setZoomFactor(2);
  const run = (js) => win.webContents.executeJavaScript(js, true).catch((e) => { console.log('RUN FAILED', String(e).slice(0, 200)); return null; });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = async (name) => { await wait(500); fs.writeFileSync(path.join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG()); console.log('shot', name); };
  await wait(2500);
  console.log('mode:', await run(`document.body.className`), '| host button:', await run(`!!document.querySelector('[data-do="host"]')`));
  await snap('1-home');
  await run(`document.querySelector('[data-do="botMenu"]').click(); true`); await wait(300);
  await run(`document.querySelector('[data-do="startBots"]').click(); true`);
  await wait(7000); await snap('2-table');
  // play on for a while: pass what is asked, end my turns
  for (let i = 0; i < 40; i++) { await run(`(() => { for (const d of ['costPass', 'tradeNo', 'finishOk', 'powerSkip', 'endTurn']) { const x = document.querySelector('[data-do="' + d + '"]'); if (x) { x.click(); return; } } })()`); await wait(450); }
  console.log('after play:', JSON.stringify(await run(`({ round: document.querySelector('#stage .sub')?.innerText || '', prompt: document.querySelector('.prompt h2')?.innerText || '', cards: document.querySelectorAll('.table .card').length })`)));
  await snap('3-later');
  await run(`window.confirm = () => true; (document.querySelector('[data-do="leave"]') || document.querySelector('[data-do="menu"]'))?.click(); true`); await wait(600);
  await run(`document.querySelector('[data-do="menuLeave"]')?.click(); true`); await wait(900);
  console.log('back home:', await run(`!!document.querySelector('[data-do="tutorial"]')`));
  await run(`document.querySelector('[data-do="tutorial"]')?.click(); true`); await wait(5000);
  console.log('tutorial:', JSON.stringify(await run(`(document.querySelector('.coach, .prompt')?.innerText || '').slice(0, 90)`)));
  await snap('4-tutorial');
  console.log('files not found:', JSON.stringify([...new Set(missing)]));
  app.quit();
});
