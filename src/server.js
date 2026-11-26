// Handland game server. No dependencies: plain HTTP, with Server-Sent Events pushing each player their own view of
// the table. The game itself lives in room.js; this file only puts the network in front of it and serves the files.
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, attach, sweep, setLan, rulesData } from './room.js';

let PORT = Number(process.env.PORT || 8790);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.md': 'text/plain; charset=utf-8' };

function lanUrl() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) return `http://${i.address}:${PORT}`;
  }
  return `http://localhost:${PORT}`;
}
setLan(lanUrl);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/api/events') {
    // the response is only opened once the room has something to say, so an unknown room can still get a 404
    let open = false;
    const sink = { write: (d) => { if (!open) { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); open = true; } res.write(d); }, end: () => res.end() };
    const stop = attach(url.searchParams.get('code'), url.searchParams.get('token'), sink);
    if (!stop) { res.writeHead(404).end(); return; }
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(ping); stop(); });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/rules') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(rulesData()));
    return;
  }
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    let raw = '';
    // Ordinary requests are tiny; only a custom deck (photos for card art) is allowed to be big.
    const cap = /^\/api\/(create|deck)$/.test(url.pathname) ? 6_000_000 : 20000;
    req.on('data', (d) => { raw += d; if (raw.length > cap) req.destroy(); });
    req.on('end', () => {
      let out;
      try { out = api(url.pathname.slice(5), JSON.parse(raw || '{}')); }
      catch (e) { console.error(e); out = { error: 'Something went wrong on the server.' }; }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out));
    });
    return;
  }
  // The page can also run the game by itself (no server). Those files are served too, so that mode can be tried here
  // with ?solo=1.
  const fromSrc = /^\/game\/(engine|bots|tutorial|room)\.js$/.test(url.pathname);
  const base = fromSrc ? path.join(ROOT, 'src') : PUBLIC;
  const file = path.normalize(path.join(base, fromSrc ? url.pathname.slice(6) : url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
  });
});

setInterval(sweep, 600e3).unref();

// Start listening. With `anyPort`, fall back to a free port if the usual one is taken.
export function start({ anyPort = false } = {}) {
  return new Promise((resolve, reject) => {
    server.once('error', (e) => {
      if (e.code === 'EADDRINUSE' && anyPort) { server.listen(0, () => { PORT = server.address().port; resolve(PORT); }); }
      else reject(e);
    });
    server.listen(PORT, () => { PORT = server.address().port; resolve(PORT); });
  });
}
export const lan = () => lanUrl();
