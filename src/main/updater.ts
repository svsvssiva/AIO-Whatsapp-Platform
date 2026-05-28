import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC } from '../shared/ipc';
import type { UpdateStatus } from '../shared/types';

let lastStatus: UpdateStatus = { state: 'idle' };

function broadcast(win: BrowserWindow | null, s: UpdateStatus) {
  lastStatus = s;
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.UPDATE_STATUS, s);
  }
}

export function getCurrentStatus(): UpdateStatus {
  return lastStatus;
}

export function startUpdater(win: BrowserWindow) {
  if (!app.isPackaged) {
    lastStatus = { state: 'disabled-dev' };
    console.log('[gchat-updater] disabled in dev mode');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => {
    broadcast(win, { state: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    console.log('[gchat-updater] update available', info.version);
    broadcast(win, { state: 'available', version: String(info.version) });
  });
  autoUpdater.on('update-not-available', () => {
    broadcast(win, { state: 'idle' });
  });
  autoUpdater.on('download-progress', (p) => {
    broadcast(win, {
      state: 'downloading',
      percent: Math.round(p.percent),
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[gchat-updater] downloaded', info.version);
    broadcast(win, { state: 'ready', version: String(info.version) });
  });
  autoUpdater.on('error', (err) => {
    console.error('[gchat-updater] error:', err);
    broadcast(win, { state: 'error', error: err.message || String(err) });
  });

  // Check on launch (after a short delay so the window is up) then hourly
  const check = () => autoUpdater.checkForUpdates().catch((e) => {
    console.warn('[gchat-updater] check failed:', e?.message);
  });
  setTimeout(check, 15_000);
  setInterval(check, 60 * 60 * 1000);
}

export function installUpdateNow() {
  if (!app.isPackaged) return;
  autoUpdater.quitAndInstall(false, true);
}

export function checkNow(): void {
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates().catch(() => {});
}
