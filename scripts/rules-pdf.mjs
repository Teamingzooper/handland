// Turns print/rules-sheet.html into print/Handland-rules.pdf (US Letter). Run with: npx electron scripts/rules-pdf.mjs
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL(pathToFileURL(path.join(root, 'print', 'rules-sheet.html')).href);
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  const pdf = await win.webContents.printToPDF({ pageSize: 'Letter', printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(path.join(root, 'print', 'Handland-rules.pdf'), pdf);
  console.log('pdf bytes', pdf.length);
  app.quit();
});
