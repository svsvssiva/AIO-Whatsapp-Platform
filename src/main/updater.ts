import { app, BrowserWindow, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC } from '../shared/ipc';
import type { UpdateStatus } from '../shared/types';

// Where users download a new build. The app is unsigned, so macOS won't let
// electron-updater silently self-install — instead we surface the banner and
// send users here to grab the new DMG.
const RELEASES_URL = 'https://github.com/svsvssiva/AIO-Whatsapp-Platform/releases/latest';

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

  // Unsigned builds can't be self-installed by Squirrel.Mac, so don't download
  // in the background — just detect and let the banner link to the DMG.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
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

// Open the GitHub releases page so the user can download the new DMG manually.
export function openDownloadPage(): void {
  shell.openExternal(RELEASES_URL).catch((e) => {
    console.warn('[gchat-updater] openExternal failed:', e?.message);
  });
}

export function checkNow(): void {
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates().catch(() => {});
}
