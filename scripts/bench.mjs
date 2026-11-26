// Speed check: plays a 6-player bot game in a real (hidden, unthrottled) window and reports how long screen
// redraws take and how many frames a second the table holds. Run with:
//   npx electron scripts/bench.mjs [high|low] [seconds] [cpu slowdown, e.g. 4]
// BENCH_ROOT=<folder with src/ and public/> measures another copy of the game (an older build, say) the same way.
// BENCH_BG=<backdrop id> plays in that backdrop (none, castle, ship, underwater, space).
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.env.BENCH_ROOT ? path.resolve(process.env.BENCH_ROOT) : path.resolve(import.meta.dirname, '..');
const { start } = await import(pathToFileURL(path.join(root, 'src', 'server.js')).href);

const level = process.argv[2] === 'low' ? 'low' : 'high';
const seconds = Number(process.argv[3]) || 25;
const slow = Number(process.argv[4]) || 1;
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.whenReady().then(async () => {
  const port = await start({ anyPort: true });
  const win = new BrowserWindow({ width: 1440, height: 900, show: false, useContentSize: true, webPreferences: { backgroundThrottling: false, offscreen: true } });
  win.webContents.setFrameRate(60);
  win.webContents.on('paint', () => {}); // offscreen windows only produce frames while someone listens
  await win.loadURL(`http://127.0.0.1:${port}/`);
  const run = (js) => win.webContents.executeJavaScript(js, true);
  if (slow > 1) { win.webContents.debugger.attach('1.3'); await win.webContents.debugger.sendCommand('Emulation.setCPUThrottlingRate', { rate: slow }); } // stands in for a slower device
  await run(`localStorage.setItem('handland-gfx', '${level}'); localStorage.setItem('handland-wallet', JSON.stringify({ tokens: 0, owned: ['castle', 'ship', 'underwater', 'space'] })); localStorage.setItem('handland-setup', JSON.stringify({ bots: 5, difficulty: 1, winTarget: 3, speed: 0.5, clock: 0.5, whistle: 1, lawsuit: 1, theme: 'backroom', deck: 'classic', bg: '${process.env.BENCH_BG || 'none'}' })); location.reload(); true`);
  await new Promise((r) => setTimeout(r, 2500));
  await run(`document.querySelector('[data-do="botMenu"]').click(); new Promise((r) => setTimeout(r, 400)).then(() => { document.querySelector('[data-do="startBots"]').click(); return true; })`);
  await new Promise((r) => setTimeout(r, 4000)); // sit down, deal in
  const out = await run(`(async () => {
    const p = window.__perf || { renders: 0, ms: 0, worst: 0, snap: 0, html: 0, anim: 0, rest: 0 }; Object.keys(p).forEach((k) => { p[k] = 0; });
    let frames = 0, slow = 0, last = performance.now(), on = true; const gaps = [];
    const tick = (t) => { frames++; gaps.push(t - last); if (t - last > 34) slow++; last = t; if (on) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const auto = setInterval(() => {
      for (const d of ['costPass', 'tradeNo', 'finishOk']) { const x = document.querySelector('[data-do="' + d + '"]'); if (x) { x.click(); return; } }
      const h = document.querySelector('.prompt h2')?.innerText || '';
      if (h === 'Your turn') document.querySelector('[data-do="endTurn"]')?.click();
      else if (/Too many/.test(h)) { (document.querySelector('.mine .card.pickable:not(.picked)') || document.querySelector('.hand .card:not(.picked)'))?.click(); document.querySelector('[data-do="discardGo"]')?.click(); }
    }, 300);
    await new Promise((r) => setTimeout(r, ${seconds * 1000}));
    clearInterval(auto); on = false;
    const n = Math.max(1, p.renders);
    return { build: document.title, bg: document.body.dataset.bg, cpuSlowdown: ${slow}, level: document.body.classList.contains('lite') ? 'low' : 'high', seconds: ${seconds}, redraws: p.renders, avgRedrawMs: +(p.ms / n).toFixed(1), worstRedrawMs: +p.worst.toFixed(1),
      parts: { snapshot: +(p.snap / n).toFixed(1), html: +(p.html / n).toFixed(1), motion: +(p.anim / n).toFixed(1), rest: +(p.rest / n).toFixed(1) },
      fps: +(frames / ${seconds}).toFixed(1), framesOver34ms: slow, worstFrameMs: +Math.max(...gaps).toFixed(0), p99FrameMs: +gaps.sort((a, b) => a - b)[Math.floor(gaps.length * 0.99)].toFixed(0), elements: document.querySelectorAll('#app *').length };
  })()`);
  console.log('BENCH', JSON.stringify(out));
  app.quit();
});
