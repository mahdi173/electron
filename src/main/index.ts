
import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { startServer } from './server/server';

const isDev = !app.isPackaged;
let serverHandle: { close: () => void } | null = null;

function resolvePreloadPath() {
  const candidates = [
    path.join(__dirname, '../preload/index.js'),
    path.join(__dirname, '../../preload/index.js'),
    path.join(__dirname, 'preload', 'index.js'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

function injectDevCSP() {
  if (!isDev) return;
  const csp = [
    "default-src 'self'",
    "connect-src 'self' http://127.0.0.1:3900 http://localhost:3900 ws://127.0.0.1:3900 ws://localhost:3900 ws://localhost:5173",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "font-src 'self' data:",
    "frame-src 'none'",
  ].join('; ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders, 'Content-Security-Policy': [csp] };
    callback({ responseHeaders: headers });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: resolvePreloadPath(),
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  const dbDir = path.join(app.getPath('userData'), 'chat-db');
  serverHandle = startServer(dbDir);
  injectDevCSP();
  createWindow();
});

app.on('before-quit', () => serverHandle?.close());
app.on('window-all-closed', () => {
  serverHandle?.close();
  if (process.platform !== 'darwin') app.quit();
});
