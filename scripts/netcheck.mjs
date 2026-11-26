// Tries online play end to end with the web version (site/): one window hosts a game, a second window joins it by
// the invite link, the host starts, both play a few moves, the guest reloads and gets its seat back, and the host
// leaves. The two windows find each other through the public PeerJS broker, so this needs an internet connection.
// Run with:  npx electron scripts/netcheck.mjs <out folder>
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..', 'site'), out = path.resolve(process.argv[2] || 'build/net');
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = path.join(root, url.pathname === '/handland/' ? 'index.html' : url.pathname.slice(10));
  fs.readFile(file, (err, data) => { if (err || !url.pathname.startsWith('/handland/')) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(data); });
});
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.whenReady().then(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}/handland/`;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const open = async (name, url) => {
    const win = new BrowserWindow({ width: 1440, height: 900, show: false, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false, partition: `test-${name}` } });
    win.webContents.setFrameRate(20); win.webContents.on('paint', () => {});
    win.webContents.on('console-message', (e, level, msg) => { if (level >= 2 && !/Security Warning/.test(msg)) console.log(`PAGE(${name})`, msg.slice(0, 240)); });
    await win.loadURL(url);
    const run = (js) => win.webContents.executeJavaScript(js, true).catch((e) => { console.log(`RUN FAILED(${name})`, String(e).slice(0, 200)); return null; });
    const snap = async (file) => { await wait(400); fs.writeFileSync(path.join(out, `${file}.png`), (await win.webContents.capturePage()).toPNG()); };
    const until = async (js, ms = 30000) => { for (let t = 0; t < ms; t += 400) { const v = await run(js); if (v) return v; await wait(400); } return null; };
    return { win, run, snap, until };
  };
  const host = await open('host', base);
  await wait(2500);
  await host.run(`document.getElementById('name').value = 'Hosty'; document.querySelector('[data-do="hostNet"]').click(); true`);
  const link = await host.until(`document.querySelector('.lobby .link')?.innerText`);
  console.log('host lobby link:', link, '| toast:', await host.run(`document.getElementById('toast').innerText`));
  if (!link) { await host.snap('0-host-failed'); app.quit(); return; }
  await host.snap('1-host-lobby');
  const guest = await open('guest', link);
  await wait(2500);
  console.log('guest sees invite button:', await guest.run(`document.querySelector('[data-do="join"].big')?.innerText.replace(/\\n/g, ' ')`));
  await guest.run(`document.getElementById('name').value = 'Guesty'; document.querySelector('[data-do="join"].big').click(); true`);
  const seats = await guest.until(`document.querySelectorAll('.lobby .seat').length >= 2 && [...document.querySelectorAll('.lobby .seat')].map((e) => e.innerText.replace(/\\n/g, ' ')).join(' | ')`);
  console.log('guest lobby seats:', seats, '| toast:', await guest.run(`document.getElementById('toast').innerText`));
  await guest.snap('2-guest-lobby');
  console.log('host lobby seats:', await host.run(`[...document.querySelectorAll('.lobby .seat')].map((e) => e.innerText.replace(/\\n/g, ' ')).join(' | ')`));
  await host.run(`document.querySelector('[data-do="addBot"]').click(); true`); await wait(500);
  await host.run(`document.querySelector('[data-do="start"]').click(); true`);
  console.log('guest at the table:', !!(await guest.until(`!!document.querySelector('.plane')`)), '| host at the table:', !!(await host.until(`!!document.querySelector('.plane')`)));
  await wait(6000);
  // both play on: pass what is asked, end turns
  const playOn = `(() => { if (/Too many/.test(document.querySelector('.prompt h2')?.innerText || '')) { (document.querySelector('.mine .card.pickable:not(.picked)') || document.querySelector('.hand .card:not(.picked)'))?.click(); document.querySelector('[data-do="discardGo"]')?.click(); return 'discard'; } for (const d of ['costPass', 'tradeNo', 'finishOk', 'powerSkip', 'endTurn']) { const x = document.querySelector('[data-do="' + d + '"]'); if (x && !x.disabled) { x.click(); return d; } } return ''; })()`;
  const did = { host: [], guest: [] };
  for (let i = 0; i < 60; i++) { const a = await host.run(playOn), b = await guest.run(playOn); if (a) did.host.push(a); if (b) did.guest.push(b); await wait(500); }
  console.log('moves made  host:', did.host.length, ' guest:', did.guest.length, [...new Set(did.guest)].join(','), '| guest round text:', await guest.run(`document.querySelector('#stage .sub')?.innerText || document.querySelector('.prompt h2')?.innerText`));
  await guest.snap('3-guest-table'); await host.snap('3-host-table');
  // the guest reloads: it should come back to the same seat
  await guest.win.webContents.reload(); await wait(1500);
  console.log('guest back at the table after a reload:', !!(await guest.until(`!!document.querySelector('.plane')`, 25000)));
  // the host leaves: the guest is told and sent home
  await host.run(`window.confirm = () => true; document.querySelector('[data-do="leave"]').click(); true`);
  console.log('guest sent home after the host left:', !!(await guest.until(`!!document.querySelector('[data-do="botMenu"]')`, 20000)), '| toast:', await guest.run(`document.getElementById('toast').innerText`));
  app.quit();
});
