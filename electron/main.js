// Handland as a standalone app: runs the game server inside the app and shows it in a window.
import { app, BrowserWindow, Menu, shell } from 'electron';
import fs from 'node:fs';
import { start } from '../src/server.js';

let home = null;

async function createWindow() {
  const port = await start({ anyPort: true });
  home = `http://127.0.0.1:${port}/`;
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    backgroundColor: '#071a14', title: 'Handland', show: !process.env.HANDLAND_SHOT,
    webPreferences: { contextIsolation: true, autoplayPolicy: 'no-user-gesture-required' },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  await win.loadURL(home + (process.env.HANDLAND_PAGE || ''));

  // Self-test / icon rendering: save a picture of the window and quit.
  if (process.env.HANDLAND_SHOT) {
    await new Promise((r) => setTimeout(r, 2500));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(process.env.HANDLAND_SHOT, img.toPNG());
    const title = await win.webContents.executeJavaScript('document.querySelector(".logo")?.textContent || document.title');
    console.log(`SELFTEST ${JSON.stringify({ port, title, size: img.getSize() })}`);
    app.quit();
  }
}

Menu.setApplicationMenu(Menu.buildFromTemplate([
  { role: 'appMenu' },
  { label: 'Game', submenu: [
    { label: 'Main Menu (this Mac\'s games)', accelerator: 'CmdOrCtrl+H', click: () => BrowserWindow.getAllWindows()[0]?.loadURL(home) },
    { role: 'togglefullscreen' },
    { type: 'separator' },
    { role: 'reload' },
  ] },
  { role: 'editMenu' },
  { role: 'windowMenu' },
]));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
