// Renders public/icon.html to build/icon.png (1024x1024, transparent corners). Run with: npx electron scripts/icon.mjs
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import { start } from '../src/server.js';

app.whenReady().then(async () => {
  const port = await start({ anyPort: true });
  const win = new BrowserWindow({ width: 1024, height: 1024, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadURL(`http://127.0.0.1:${port}/icon.html`);
  await new Promise((r) => setTimeout(r, 1500));
  const img = await win.webContents.capturePage();
  fs.writeFileSync('build/icon.png', img.resize({ width: 1024, height: 1024 }).toPNG());
  console.log('icon', img.getSize());
  app.quit();
});
