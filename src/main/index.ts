import { app, BrowserWindow, ipcMain, shell, nativeTheme, Menu, MenuItem } from 'electron';
import { join } from 'path';
import { IPC } from '../shared/ipc';
import {
  addAccount,
  getAccounts,
  getAiSettings,
  getChatPins,
  getPillPrefs,
  getSettings,
  getWindowState,
  removeAccount,
  saveAiSettings,
  savePillPrefs,
  saveSettings,
  saveWindowState,
  setChatPins,
  setNotificationPrefs,
  toggleChatPin,
  updateAccount,
} from './store';
import {
  clearPartitionStorage,
  configurePartition,
  deletePartitionFolder,
} from './partitions';
import { buildAppMenu } from './menu';
import { rebuildDockMenu } from './dockMenu';
import { showTileMenu } from './tileMenu';
import { WA_USER_AGENT } from '../shared/types';
import {
  deleteAvatarFiles,
  pickAndSaveAvatar,
  registerAvatarProtocol,
  registerAvatarSchemePrivileged,
  resetAvatar,
} from './avatars';
import { clearAllData, clearCache, getAllStorageInfo, runAutoCleanIfDue } from './storage';
import { injectDebugHelper, injectNotificationPatch } from './notifications';
import { detectPillsInWebview, injectWaTweaks, pollPendingPinToggle } from './wa-tweaks';
import type { PillPrefs } from '../shared/types';
import { AIError, rephrase, testKey as aiTestKey } from './ai';
import { clearKey as aiClearKey, hasKey as aiHasKey, saveKey as aiSaveKey } from './ai/keys';
import { checkNow as updateCheckNow, getCurrentStatus as getUpdateStatus, installUpdateNow, openDownloadPage, startUpdater } from './updater';
import type { AISettings } from '../shared/types';

registerAvatarSchemePrivileged();

app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

let win: BrowserWindow | null = null;
const unreadByAccount = new Map<string, number>();
const wcAccountId = new Map<number, string>(); // webContents.id -> accountId

function recomputeBadge() {
  let total = 0;
  for (const n of unreadByAccount.values()) total += n;
  if (app.dock) app.dock.setBadge(total > 0 ? String(total) : '');
}

function ensurePartitionsForAll() {
  for (const a of getAccounts()) configurePartition(a.id);
}

function createWindow() {
  const ws = getWindowState();

  win = new BrowserWindow({
    width: ws.width,
    height: ws.height,
    x: ws.x,
    y: ws.y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 12 },
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/shell.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  win.once('ready-to-show', () => win?.show());

  win.on('resize', () => {
    if (!win) return;
    const [width, height] = win.getSize();
    const [x, y] = win.getPosition();
    saveWindowState({ width, height, x, y });
  });
  win.on('move', () => {
    if (!win) return;
    const [x, y] = win.getPosition();
    const [width, height] = win.getSize();
    saveWindowState({ width, height, x, y });
  });

  win.on('close', (e) => {
    if (!(app as unknown as { isQuitting?: boolean }).isQuitting) {
      e.preventDefault();
      win?.hide();
    }
  });

  win.webContents.on('will-attach-webview', (_e, webPreferences, params) => {
    webPreferences.preload = join(__dirname, '../preload/webview-wa.js');
    webPreferences.contextIsolation = true;
    webPreferences.nodeIntegration = false;
    // Red squiggles in the WhatsApp composer. On macOS this routes to the OS
    // (NSSpellChecker), so it follows the languages configured in System Settings.
    webPreferences.spellcheck = true;
    params.useragent = WA_USER_AGENT;
    const partition = params.partition ?? '';
    const m = partition.match(/^persist:wa-(.+)$/);
    const accountId = m ? m[1] : '';
    (webPreferences as unknown as { additionalArguments?: string[] }).additionalArguments = [
      `--gchat-account-id=${accountId}`,
    ];
  });

  win.webContents.on('did-attach-webview', (_e, wc) => {
    wc.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
    wc.on('will-navigate', (e, url) => {
      if (!url.startsWith('https://web.whatsapp.com') && !url.startsWith('https://www.whatsapp.com')) {
        e.preventDefault();
        shell.openExternal(url);
      }
    });

    // Electron ships no default context menu, so right-clicking a misspelled
    // word would otherwise offer nothing. Build one with the OS suggestions.
    wc.on('context-menu', (_ev, params) => {
      const menu = new Menu();

      if (params.misspelledWord) {
        for (const suggestion of params.dictionarySuggestions) {
          menu.append(
            new MenuItem({ label: suggestion, click: () => wc.replaceMisspelling(suggestion) }),
          );
        }
        if (params.dictionarySuggestions.length === 0) {
          menu.append(new MenuItem({ label: 'No guesses found', enabled: false }));
        }
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(
          new MenuItem({
            label: 'Learn Spelling',
            click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord),
          }),
        );
        menu.append(new MenuItem({ type: 'separator' }));
      }

      const f = params.editFlags;
      if (params.isEditable || params.selectionText) {
        if (params.isEditable) {
          menu.append(new MenuItem({ label: 'Undo', role: 'undo', enabled: f.canUndo }));
          menu.append(new MenuItem({ label: 'Redo', role: 'redo', enabled: f.canRedo }));
          menu.append(new MenuItem({ type: 'separator' }));
          menu.append(new MenuItem({ label: 'Cut', role: 'cut', enabled: f.canCut }));
        }
        menu.append(new MenuItem({ label: 'Copy', role: 'copy', enabled: f.canCopy }));
        if (params.isEditable) {
          menu.append(new MenuItem({ label: 'Paste', role: 'paste', enabled: f.canPaste }));
          menu.append(
            new MenuItem({
              label: 'Paste and Match Style',
              role: 'pasteAndMatchStyle',
              enabled: f.canPaste,
            }),
          );
          menu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }));
        }
      }

      if (menu.items.length > 0) menu.popup({ window: win ?? undefined });
    });

    const accountId = wcAccountId.get(wc.id) ?? '';
    const inject = () => {
      injectDebugHelper(wc);
      injectWaTweaks(wc, {
        prefs: getPillPrefs(),
        chatPins: getChatPins(accountId),
        accountId,
      });
      if (accountId) injectNotificationPatch(wc, accountId);
    };
    wc.on('dom-ready', inject);
    wc.on('did-finish-load', inject);
    wc.on('did-navigate-in-page', inject);
    wc.on('destroyed', () => wcAccountId.delete(wc.id));
  });

  buildAppMenu(win);
  rebuildDockMenu(win, unreadByAccount);
  startUpdater(win);
}

app.whenReady().then(() => {
  registerAvatarProtocol();
  ensurePartitionsForAll();
  createWindow();

  nativeTheme.on('updated', () => {
    win?.webContents.send(IPC.THEME_CHANGED, nativeTheme.shouldUseDarkColors);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else win?.show();
  });
});

app.on('before-quit', () => {
  (app as unknown as { isQuitting?: boolean }).isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle(IPC.ACCOUNTS_LIST, () => getAccounts());

ipcMain.handle(IPC.ACCOUNTS_ADD, (_e, label?: string) => {
  const acc = addAccount(label);
  configurePartition(acc.id);
  if (win) {
    buildAppMenu(win);
    rebuildDockMenu(win, unreadByAccount);
  }
  return acc;
});

ipcMain.handle(IPC.ACCOUNTS_REMOVE, async (_e, id: string) => {
  await clearPartitionStorage(id);
  removeAccount(id);
  unreadByAccount.delete(id);
  await deletePartitionFolder(id);
  await deleteAvatarFiles(id);
  if (win) {
    buildAppMenu(win);
    rebuildDockMenu(win, unreadByAccount);
  }
  recomputeBadge();
  return getAccounts();
});

ipcMain.handle(IPC.ACCOUNTS_RENAME, (_e, id: string, label: string) => {
  updateAccount(id, { label });
  if (win) {
    buildAppMenu(win);
    rebuildDockMenu(win, unreadByAccount);
  }
  return getAccounts();
});

ipcMain.handle(IPC.ACCOUNTS_RECOLOR, (_e, id: string, color: string) => {
  updateAccount(id, { color });
  return getAccounts();
});

ipcMain.handle(IPC.ACCOUNTS_CLEAR_CACHE, async (_e, id: string) => {
  await clearCache(id);
  return true;
});

ipcMain.handle(IPC.ACCOUNTS_LOGOUT, async (_e, id: string) => {
  await clearPartitionStorage(id);
  return true;
});

ipcMain.on(IPC.UNREAD_REPORT, (e, accountId: string, count: number) => {
  unreadByAccount.set(accountId, Math.max(0, count | 0));
  recomputeBadge();
  if (win) {
    rebuildDockMenu(win, unreadByAccount);
    win.webContents.send(IPC.UNREAD_UPDATED, accountId, count);
  }
});

ipcMain.on(IPC.TILE_MENU, (_e, accountId: string) => {
  if (win) showTileMenu(win, accountId);
});

ipcMain.handle(IPC.THEME_GET, () => nativeTheme.shouldUseDarkColors);

ipcMain.on(IPC.WINDOW_HIDE, () => win?.hide());
ipcMain.on(IPC.WINDOW_MINIMIZE, () => win?.minimize());

// Inspect a specific webview's DevTools by webContents id
ipcMain.on(IPC.INSPECT_WEBVIEW, (_e, wcId: number) => {
  const allWcs = require('electron').webContents.getAllWebContents() as Electron.WebContents[];
  const wc = allWcs.find((w) => w.id === wcId);
  if (wc) wc.openDevTools({ mode: 'detach' });
});

// Webview registration: renderer tells us which webContents belongs to which account
ipcMain.on(IPC.WEBVIEW_REGISTER, (_e, wcId: number, accountId: string) => {
  wcAccountId.set(wcId, accountId);
  // If already attached and dom-ready, inject now
  const allWcs = require('electron').webContents.getAllWebContents() as Electron.WebContents[];
  const wc = allWcs.find((w) => w.id === wcId);
  if (wc && !wc.isLoading()) {
    injectDebugHelper(wc);
    injectNotificationPatch(wc, accountId);
  }
});

// Avatar IPC
ipcMain.handle(IPC.AVATAR_PICK, async (_e, id: string) => {
  if (!win) return false;
  return pickAndSaveAvatar(win, id);
});
ipcMain.handle(IPC.AVATAR_RESET, async (_e, id: string) => {
  await resetAvatar(id);
  return true;
});

// Storage IPC
ipcMain.handle(IPC.STORAGE_GET_ALL, async () => getAllStorageInfo());
ipcMain.handle(IPC.STORAGE_CLEAR_CACHE, async (_e, id: string) => {
  await clearCache(id);
  return true;
});
ipcMain.handle(IPC.STORAGE_CLEAR_ALL, async (_e, id: string) => {
  await clearAllData(id);
  return true;
});

// Settings IPC
ipcMain.handle(IPC.SETTINGS_GET, () => getSettings());
ipcMain.handle(IPC.SETTINGS_SET, (_e, patch) => {
  saveSettings(patch);
  return getSettings();
});

// Per-account notification prefs
ipcMain.handle(IPC.NOTIF_SET_PREFS, (_e, id: string, prefs) => {
  setNotificationPrefs(id, prefs);
  // re-inject on all wcs of that account
  const allWcs = require('electron').webContents.getAllWebContents() as Electron.WebContents[];
  for (const [wcId, aid] of wcAccountId.entries()) {
    if (aid === id) {
      const wc = allWcs.find((w) => w.id === wcId);
      if (wc) injectNotificationPatch(wc, id);
    }
  }
  return getAccounts();
});

// Notification click bubbled from webview
ipcMain.on(IPC.NOTIF_CLICKED, (_e, accountId: string) => {
  if (!win) return;
  if (!win.isVisible()) win.show();
  win.focus();
  win.webContents.send(IPC.MENU_SWITCH_ACCOUNT, accountId);
});

// -------------------- AI --------------------

ipcMain.handle(IPC.AI_GET_SETTINGS, async () => {
  const s = getAiSettings();
  return { ...s, hasApiKey: await aiHasKey() } as AISettings;
});

ipcMain.handle(IPC.AI_SET_SETTINGS, async (_e, patch: Partial<AISettings>) => {
  // Strip hasApiKey — that's computed
  const { hasApiKey: _ignore, ...rest } = patch as Partial<AISettings> & { hasApiKey?: boolean };
  saveAiSettings(rest);
  const s = getAiSettings();
  return { ...s, hasApiKey: await aiHasKey() } as AISettings;
});

ipcMain.handle(IPC.AI_SET_KEY, async (_e, key: string) => {
  const trimmed = (key || '').trim();
  if (!trimmed) return { ok: false, error: 'Empty key.' };
  try {
    await aiSaveKey(trimmed);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
});

ipcMain.handle(IPC.AI_CLEAR_KEY, async () => {
  await aiClearKey();
  return { ok: true };
});

ipcMain.handle(IPC.AI_TEST_KEY, async () => aiTestKey());

// Rephrase: the ONLY place this app sends anything to OpenAI. `draft` is the
// text the user typed into the compose box — no chat history is read.
ipcMain.on(IPC.REPHRASE_RUN, async (e, _accountId: string, draft: string) => {
  const reply = (payload: unknown) => {
    if (!e.sender.isDestroyed()) e.sender.send(IPC.REPHRASE_RESULT, payload);
  };
  try {
    const settings = getAiSettings();
    if (!settings.enabled) {
      reply({ ok: false, error: 'Rephrase is turned off in Settings → Rephrase.' });
      return;
    }
    if (!(await aiHasKey())) {
      reply({ ok: false, error: 'No OpenAI API key set — add one in Settings → Rephrase.' });
      return;
    }
    const variants = await rephrase(settings, draft);
    reply({ ok: true, variants });
  } catch (err) {
    const msg =
      err instanceof AIError
        ? err.code === 'auth'
          ? 'API key rejected — check it in Settings → Rephrase.'
          : err.code === 'rate'
            ? 'OpenAI rate limit or quota exceeded.'
            : err.message
        : (err as Error).message;
    reply({ ok: false, error: msg });
  }
});

// PILLS IPC: detect + customize WA filter pills order
ipcMain.handle(IPC.PILLS_GET_PREFS, () => getPillPrefs());

ipcMain.handle(IPC.PILLS_LIST, async (_e, accountId: string) => {
  const target = findWcForAccount(accountId);
  if (!target) return [] as string[];
  return detectPillsInWebview(target);
});

ipcMain.handle(IPC.PILLS_SET_PREFS, (_e, patch: Partial<PillPrefs>) => {
  savePillPrefs(patch);
  // Re-inject tweaks across all WA webviews so the new order applies live
  const allWcs = require('electron').webContents.getAllWebContents() as Electron.WebContents[];
  const prefs = getPillPrefs();
  for (const [wcId, aid] of wcAccountId.entries()) {
    const wc = allWcs.find((w) => w.id === wcId);
    if (wc) injectWaTweaks(wc, { prefs, chatPins: getChatPins(aid), accountId: aid });
  }
  return prefs;
});

// Chat pins IPC
ipcMain.handle(IPC.CHAT_PINS_GET, (_e, accountId: string) => getChatPins(accountId));

ipcMain.handle(IPC.CHAT_PINS_TOGGLE, (_e, accountId: string, chatKey: string) => {
  const next = toggleChatPin(accountId, chatKey);
  // Re-inject to apply re-sort + pin icon state
  const wc = findWcForAccount(accountId);
  if (wc) injectWaTweaks(wc, { prefs: getPillPrefs(), chatPins: next, accountId });
  return next;
});

// Poll pending pin toggles from all WA webviews every 500ms
function startInjectionPoller() {
  setInterval(async () => {
    const allWcs = require('electron').webContents.getAllWebContents() as Electron.WebContents[];
    for (const [wcId, aid] of wcAccountId.entries()) {
      const wc = allWcs.find((w) => w.id === wcId);
      if (!wc) continue;
      // Pin toggles
      const key = await pollPendingPinToggle(wc);
      if (key) {
        const next = toggleChatPin(aid, key);
        injectWaTweaks(wc, { prefs: getPillPrefs(), chatPins: next, accountId: aid });
      }
    }
  }, 500);
}
setTimeout(startInjectionPoller, 3000);

function findWcForAccount(accountId: string): Electron.WebContents | undefined {
  const allWcs = require('electron').webContents.getAllWebContents() as Electron.WebContents[];
  for (const [wcId, aid] of wcAccountId.entries()) {
    if (aid === accountId) {
      const wc = allWcs.find((w) => w.id === wcId);
      if (wc) return wc;
    }
  }
  // Fallback: match by partition path
  const partKey = `persist%3Awa-${accountId}`;
  return allWcs.find((w) => {
    try {
      const sp = (w.session as unknown as { storagePath?: string }).storagePath || '';
      return sp.includes(partKey);
    } catch {
      return false;
    }
  });
}

// -------- Auto-update IPC --------
ipcMain.handle(IPC.UPDATE_GET_VERSION, () => ({
  version: app.getVersion(),
  status: getUpdateStatus(),
  isPackaged: app.isPackaged,
}));
ipcMain.handle(IPC.UPDATE_CHECK, () => {
  updateCheckNow();
  return { ok: true };
});
ipcMain.handle(IPC.UPDATE_INSTALL, () => {
  installUpdateNow();
  return { ok: true };
});
ipcMain.handle(IPC.UPDATE_DOWNLOAD, () => {
  openDownloadPage();
  return { ok: true };
});

// Auto-clean on startup + every 24h
async function scheduleAutoClean() {
  try {
    await runAutoCleanIfDue();
  } catch {
    /* ignore */
  }
  setTimeout(scheduleAutoClean, 24 * 60 * 60 * 1000);
}
setTimeout(scheduleAutoClean, 30 * 1000); // 30s after boot
