import { app, BrowserWindow, ipcMain, shell, nativeTheme } from 'electron';
import { join } from 'path';
import { IPC } from '../shared/ipc';
import {
  addAccount,
  getAccounts,
  getAiLockouts,
  getAiSettings,
  getChatPins,
  getPillPrefs,
  getSettings,
  getWindowState,
  isAiLocked,
  removeAccount,
  saveAiSettings,
  savePillPrefs,
  saveSettings,
  saveWindowState,
  setChatPins,
  setNotificationPrefs,
  toggleAiLockout,
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
import { AIError, generateFromPayload, generateReply, prepareGeneration, testKey as aiTestKey } from './ai';
import type { PreparedPayload } from './ai';
import { clearKey as aiClearKey, hasKey as aiHasKey, saveKey as aiSaveKey } from './ai/keys';
import { syncChatToMemory } from './ai/sync';
import * as mem from './memory';
import { checkNow as updateCheckNow, getCurrentStatus as getUpdateStatus, installUpdateNow, openDownloadPage, startUpdater } from './updater';
import type { AISettings, ScrapedConversation } from '../shared/types';

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

    const accountId = wcAccountId.get(wc.id) ?? '';
    const inject = () => {
      injectDebugHelper(wc);
      injectWaTweaks(wc, {
        prefs: getPillPrefs(),
        chatPins: getChatPins(accountId),
        accountId,
        aiLockouts: getAiLockouts(accountId),
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

// AI_PREPARE: build the exact prompt + redacted message array for the user to review
ipcMain.handle(
  IPC.AI_PREPARE,
  async (_e, payload: { conversation: ScrapedConversation; accountId?: string }) => {
    try {
      const settings = getAiSettings();
      if (!(await aiHasKey())) {
        return { ok: false, code: 'no-key', error: 'No API key configured.' };
      }
      if (payload.accountId && payload.conversation?.chatTitle) {
        if (isAiLocked(payload.accountId, payload.conversation.chatTitle)) {
          return {
            ok: false,
            code: 'locked',
            error: 'AI is disabled for this chat. Unlock via the shield icon in the chat header.',
          };
        }
      }
      let memory = '';
      if (payload.accountId && payload.conversation?.chatTitle) {
        memory = await mem.getMemory(payload.accountId, payload.conversation.chatTitle);
      }
      const prepared = prepareGeneration(settings, payload.conversation, memory);
      return { ok: true, payload: prepared };
    } catch (e) {
      return { ok: false, code: 'unknown', error: (e as Error).message };
    }
  },
);

// Lockout IPC
ipcMain.handle(IPC.AI_LOCKOUT_GET, (_e, accountId: string) => getAiLockouts(accountId));
ipcMain.handle(IPC.AI_LOCKOUT_IS_LOCKED, (_e, accountId: string, chatKey: string) =>
  isAiLocked(accountId, chatKey),
);

// Send a (possibly user-edited) prepared payload to OpenAI
ipcMain.handle(
  IPC.AI_GENERATE_FROM_PAYLOAD,
  async (_e, payload: PreparedPayload) => {
    try {
      const settings = getAiSettings();
      if (!(await aiHasKey())) {
        return { ok: false, code: 'no-key', error: 'No API key configured.' };
      }
      const text = await generateFromPayload(settings, payload);
      return { ok: true, text };
    } catch (e) {
      if (e instanceof AIError) return { ok: false, code: e.code, error: e.message };
      return { ok: false, code: 'unknown', error: (e as Error).message };
    }
  },
);

ipcMain.handle(
  IPC.AI_GENERATE,
  async (_e, payload: { conversation: ScrapedConversation; accountId?: string }) => {
    try {
      const settings = getAiSettings();
      if (!(await aiHasKey())) {
        return { ok: false, code: 'no-key', error: 'No API key configured.' };
      }
      // Resolve memory for (accountId, chatTitle)
      let memory = '';
      if (payload.accountId && payload.conversation?.chatTitle) {
        memory = await mem.getMemory(payload.accountId, payload.conversation.chatTitle);
      }
      const text = await generateReply(settings, payload.conversation, memory);
      return { ok: true, text };
    } catch (e) {
      if (e instanceof AIError) {
        return { ok: false, code: e.code, error: e.message };
      }
      return { ok: false, code: 'unknown', error: (e as Error).message };
    }
  },
);

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
    if (wc) injectWaTweaks(wc, { prefs, chatPins: getChatPins(aid), accountId: aid, aiLockouts: getAiLockouts(aid) });
  }
  return prefs;
});

// Chat pins IPC
ipcMain.handle(IPC.CHAT_PINS_GET, (_e, accountId: string) => getChatPins(accountId));

ipcMain.handle(IPC.CHAT_PINS_TOGGLE, (_e, accountId: string, chatKey: string) => {
  const next = toggleChatPin(accountId, chatKey);
  // Re-inject to apply re-sort + pin icon state
  const wc = findWcForAccount(accountId);
  if (wc) injectWaTweaks(wc, { prefs: getPillPrefs(), chatPins: next, accountId, aiLockouts: getAiLockouts(accountId) });
  return next;
});

// Poll pending pin toggles + memory-open requests from all WA webviews every 500ms
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
        injectWaTweaks(wc, { prefs: getPillPrefs(), chatPins: next, accountId: aid, aiLockouts: getAiLockouts(aid) });
      }
      // Memory open requests
      try {
        const memKey = (await wc.executeJavaScript(
          `(function(){ var k = window.__gchatPendingMemoryOpen; window.__gchatPendingMemoryOpen = null; return k || null; })();`,
          true,
        )) as string | null;
        if (memKey && win) {
          win.show();
          win.focus();
          win.webContents.send(IPC.MEMORY_OPEN_DRAWER, aid, memKey);
        }
      } catch {
        /* ignore */
      }
      // AI lockout toggles
      try {
        const lockKey = (await wc.executeJavaScript(
          `(function(){ var k = window.__gchatPendingLockToggle; window.__gchatPendingLockToggle = null; return k || null; })();`,
          true,
        )) as string | null;
        if (lockKey) {
          const next = toggleAiLockout(aid, lockKey);
          injectWaTweaks(wc, {
            prefs: getPillPrefs(),
            chatPins: getChatPins(aid),
            accountId: aid,
            aiLockouts: next,
          });
          if (win) win.webContents.send(IPC.AI_LOCKOUT_CHANGED, aid, lockKey, next.includes(lockKey));
        }
      } catch {
        /* ignore */
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

const SCRAPE_SCRIPT = `
(function() {
  function getChatTitle() {
    var headerName =
      document.querySelector('header [data-testid="conversation-info-header-chat-title"]') ||
      document.querySelector('header span[dir="auto"][title]') ||
      document.querySelector('header span[title]') ||
      document.querySelector('#main header span[dir="auto"]');
    var title = ((headerName && (headerName.getAttribute('title') || headerName.textContent)) || '').trim();
    var isGroup = false;
    var subEl = document.querySelector('header [aria-label]');
    var sub = subEl ? subEl.getAttribute('aria-label') || '' : '';
    if (/group/i.test(sub)) isGroup = true;
    if (!isGroup) {
      var firstBubble = document.querySelector('div.copyable-text');
      var pre = firstBubble ? firstBubble.getAttribute('data-pre-plain-text') || '' : '';
      if (/]\\s*[^:]+:\\s*$/.test(pre)) isGroup = true;
    }
    return { title: title || 'this chat', isGroup: isGroup };
  }

  function parseBubble(bubble) {
    var direction = 'in';
    var ancestor = bubble.closest('.message-in, .message-out');
    if (ancestor && ancestor.classList.contains('message-out')) direction = 'out';
    else if (ancestor && ancestor.classList.contains('message-in')) direction = 'in';
    else {
      var cur = bubble;
      while (cur && cur !== document.body) {
        if (cur.classList && cur.classList.contains('message-out')) { direction = 'out'; break; }
        if (cur.classList && cur.classList.contains('message-in')) { direction = 'in'; break; }
        cur = cur.parentElement;
      }
    }
    var textNode =
      bubble.querySelector('.selectable-text.copyable-text') ||
      bubble.querySelector('span.selectable-text') ||
      bubble.querySelector('[data-lexical-text="true"]');
    var text = (textNode && textNode.textContent || '').trim();
    if (!text) {
      if (bubble.querySelector('[data-icon="media-play"], [data-icon="audio-play"]')) text = '[voice note]';
      else if (bubble.querySelector('img[src^="blob:"], img[src^="data:"]')) text = '[image]';
      else if (bubble.querySelector('[data-icon="document"]')) text = '[document]';
      else if (bubble.querySelector('video')) text = '[video]';
      else if (bubble.querySelector('[data-icon="sticker"]')) text = '[sticker]';
      else return null;
    }
    var sender, ts;
    var pre = bubble.getAttribute('data-pre-plain-text') || '';
    if (pre) {
      var m = pre.match(/^\\[([^\\]]+)\\]\\s*([^:]+):\\s*$/);
      if (m) { ts = m[1].trim(); sender = m[2].trim(); }
    }
    return { direction: direction, text: text, sender: sender, ts: ts };
  }

  try {
    var info = getChatTitle();
    var msgs = [];
    var bubbles = document.querySelectorAll('div.copyable-text');
    for (var i = 0; i < bubbles.length; i++) {
      var m = parseBubble(bubbles[i]);
      if (m && m.text) msgs.push(m);
    }
    var recent = msgs.slice(-50);
    return { ok: true, data: { chatTitle: info.title, isGroup: info.isGroup, messages: recent } };
  } catch (err) {
    return { ok: false, error: (err && err.message) || String(err) };
  }
})();
`;

ipcMain.handle(IPC.AI_SCRAPE_ACTIVE, async (_e, accountId: string) => {
  const target = findWcForAccount(accountId);
  if (!target) {
    console.warn('[gchat-main] AI_SCRAPE_ACTIVE: no webview for', accountId);
    return { ok: false, error: 'No webview for this account. Try reloading it.' };
  }
  try {
    console.log('[gchat-main] AI_SCRAPE_ACTIVE via executeJavaScript on wc', target.id);
    const res = (await target.executeJavaScript(SCRAPE_SCRIPT, true)) as {
      ok: boolean;
      data?: { chatTitle?: string; isGroup?: boolean; messages?: Array<{ direction: string; text: string; sender?: string }> };
      error?: string;
    };
    const msgs = res?.data?.messages || [];
    console.log(
      '[gchat-main] SCRAPE result ok=', res?.ok,
      'chat=', res?.data?.chatTitle,
      'group=', res?.data?.isGroup,
      'msgCount=', msgs.length,
    );
    if (msgs.length > 0) {
      const last3 = msgs.slice(-3).map((m) => `[${m.direction}] ${m.text.slice(0, 60)}`).join(' | ');
      console.log('[gchat-main] last 3:', last3);
    }
    return res || { ok: false, error: 'No response from webview.' };
  } catch (err) {
    console.error('[gchat-main] AI_SCRAPE_ACTIVE error:', err);
    return { ok: false, error: (err as Error).message };
  }
});

ipcMain.handle(IPC.AI_INSERT_TEXT, async (_e, accountId: string, text: string) => {
  const target = findWcForAccount(accountId);
  if (!target) return { ok: false, error: 'No webview for this account.' };
  try {
    const script = `
(function() {
  var text = ${JSON.stringify(text)};
  var compose =
    document.querySelector('footer div[contenteditable="true"][role="textbox"]') ||
    document.querySelector('footer div[contenteditable="true"]') ||
    document.querySelector('[data-testid="conversation-compose-box-input"]') ||
    document.querySelector('div[role="textbox"][contenteditable="true"]');
  if (!compose) return { ok: false, error: 'compose-not-found' };
  compose.focus();
  try {
    var sel = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(compose);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (e) {}
  try {
    var ok = document.execCommand('insertText', false, text);
    if (ok) return { ok: true };
  } catch (e) {}
  try {
    compose.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
    compose.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
})();
`;
    const res = (await target.executeJavaScript(script, true)) as { ok: boolean; error?: string };
    return res || { ok: false, error: 'No response' };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
});

// Show the suggested reply as a bar inside the WhatsApp page, in normal flow
// directly above the compose footer. Because it's inserted as a flex sibling of
// the footer, the message list shrinks to make room — no messages are hidden.
ipcMain.handle(IPC.AI_SHOW_SUGGESTION, async (_e, accountId: string, text: string) => {
  const target = findWcForAccount(accountId);
  if (!target) return { ok: false, error: 'No webview for this account.' };
  try {
    const script = `
(function() {
  try {
    var TEXT = ${JSON.stringify(text)};
    var BARID = 'gchat-suggestion-bar';
    function findCompose() {
      return document.querySelector('footer div[contenteditable="true"][role="textbox"]')
        || document.querySelector('footer div[contenteditable="true"]')
        || document.querySelector('[data-testid="conversation-compose-box-input"]')
        || document.querySelector('div[role="textbox"][contenteditable="true"]');
    }
    function findFooter() {
      var c = findCompose();
      if (c) { var f = c.closest('footer'); if (f) return f; }
      return document.querySelector('#main footer') || document.querySelector('footer');
    }
    function insertIntoCompose(t) {
      var compose = findCompose();
      if (!compose) return false;
      compose.focus();
      try { var sel = window.getSelection(); var r = document.createRange(); r.selectNodeContents(compose); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); } catch (e) {}
      try { if (document.execCommand('insertText', false, t)) return true; } catch (e) {}
      try {
        compose.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: t }));
        compose.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: t }));
        return true;
      } catch (e) { return false; }
    }
    function clickSend() {
      var tries = 0;
      (function attempt() {
        tries++;
        var icon = document.querySelector('footer [data-icon="send"]') || document.querySelector('footer span[data-icon="send"]');
        var btn = icon ? (icon.closest('button') || icon.parentElement)
          : (document.querySelector('footer button[aria-label="Send"]') || document.querySelector('footer [data-testid="send"]'));
        if (btn) { btn.click(); return; }
        if (tries < 15) setTimeout(attempt, 50);
      })();
    }
    var obs = null;
    function removeBar() {
      if (obs) { try { obs.disconnect(); } catch (e) {} obs = null; }
      var ex = document.getElementById(BARID);
      if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
    }
    function chatTitle() {
      var t = document.querySelector('#main header span[dir="auto"][title]')
        || document.querySelector('#main header span[title]')
        || document.querySelector('#main header span[dir="auto"]');
      return t ? (t.getAttribute('title') || t.textContent || '') : '';
    }

    removeBar();
    var footer = findFooter();
    if (!footer || !footer.parentNode) return { ok: false, error: 'compose-not-found' };

    var dark = (document.body && document.body.classList.contains('dark')) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var bg = dark ? '#1f2c33' : '#ffffff';
    var border = dark ? '#2a3942' : '#e9edef';
    var fg = dark ? '#e9edef' : '#111b21';
    var sub = dark ? '#8696a0' : '#667781';
    var chip = dark ? '#2a3942' : '#f0f2f5';

    var bar = document.createElement('div');
    bar.id = BARID;
    bar.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:8px 14px;width:100%;box-sizing:border-box;background:' + bg + ';border-top:1px solid ' + border + ';color:' + fg + ';flex:0 0 auto;position:relative;z-index:5;';

    var label = document.createElement('div');
    label.textContent = '✨';
    label.style.cssText = 'font-size:16px;line-height:22px;flex:0 0 auto;';

    var textWrap = document.createElement('div');
    textWrap.style.cssText = 'flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;';
    var cap = document.createElement('div');
    cap.textContent = 'Suggested reply — click text to edit before sending';
    cap.style.cssText = 'font-size:11px;color:' + sub + ';';
    var body = document.createElement('div');
    body.textContent = TEXT;
    body.title = 'Click to drop this into the message box for editing';
    body.style.cssText = 'font-size:14px;line-height:1.4;color:' + fg + ';white-space:pre-wrap;word-break:break-word;max-height:84px;overflow-y:auto;cursor:text;';
    textWrap.appendChild(cap); textWrap.appendChild(body);

    function mkBtn(t, primary) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = t;
      b.style.cssText = 'flex:0 0 auto;border:none;border-radius:16px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;' + (primary ? 'background:#0A84FF;color:#fff;' : 'background:' + chip + ';color:' + fg + ';');
      return b;
    }
    var editBtn = mkBtn('Edit', false);
    var sendBtn = mkBtn('Send', true);
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button'; closeBtn.textContent = '✕'; closeBtn.title = 'Dismiss';
    closeBtn.style.cssText = 'flex:0 0 auto;border:none;background:transparent;color:' + sub + ';font-size:15px;cursor:pointer;padding:6px 8px;line-height:1;';

    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;align-items:center;gap:6px;flex:0 0 auto;align-self:center;';
    btns.appendChild(editBtn); btns.appendChild(sendBtn); btns.appendChild(closeBtn);

    bar.appendChild(label); bar.appendChild(textWrap); bar.appendChild(btns);

    // Keep clicks from reaching WhatsApp's own handlers.
    bar.addEventListener('mousedown', function(e){ e.stopPropagation(); });
    editBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); insertIntoCompose(TEXT); removeBar(); });
    sendBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); var ok = insertIntoCompose(TEXT); removeBar(); if (ok) clickSend(); });
    closeBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); removeBar(); });
    body.addEventListener('click', function(e){ e.stopPropagation(); insertIntoCompose(TEXT); removeBar(); });

    footer.parentNode.insertBefore(bar, footer);

    // Auto-dismiss if the user switches to a different chat (WhatsApp reuses the
    // same footer DOM across chats, so a stale suggestion must not linger — its
    // Send button would otherwise fire into the wrong conversation).
    var sig0 = chatTitle();
    var mainEl = document.querySelector('#main');
    if (mainEl && window.MutationObserver) {
      obs = new MutationObserver(function() { if (chatTitle() !== sig0) removeBar(); });
      try { obs.observe(mainEl, { subtree: true, childList: true, characterData: true }); } catch (e) {}
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
})();
`;
    const res = (await target.executeJavaScript(script, true)) as { ok: boolean; error?: string };
    return res || { ok: false, error: 'No response' };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
});

ipcMain.handle(IPC.AI_CLEAR_SUGGESTION, async (_e, accountId: string) => {
  const target = findWcForAccount(accountId);
  if (!target) return { ok: false };
  try {
    await target.executeJavaScript(
      `(function(){var b=document.getElementById('gchat-suggestion-bar');if(b&&b.parentNode)b.parentNode.removeChild(b);return {ok:true};})();`,
      true,
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

// -------------------- MEMORY --------------------

ipcMain.handle(IPC.MEMORY_GET, async (_e, accountId: string, chatKey: string) => {
  const content = await mem.getMemory(accountId, chatKey);
  return { ok: true, content, exists: content.length > 0 };
});

ipcMain.handle(
  IPC.MEMORY_SAVE,
  async (_e, accountId: string, chatKey: string, content: string) => {
    const info = await mem.saveMemory(accountId, chatKey, content);
    return { ok: true, ...info };
  },
);

ipcMain.handle(IPC.MEMORY_DELETE, async (_e, accountId: string, chatKey: string) => {
  await mem.deleteMemory(accountId, chatKey);
  return { ok: true };
});

ipcMain.handle(IPC.MEMORY_CREATE, async (_e, accountId: string, chatKey: string) => {
  const content = await mem.createMemoryIfMissing(accountId, chatKey);
  return { ok: true, content };
});

ipcMain.handle(IPC.MEMORY_LIST_FOR_ACCOUNT, async (_e, accountId: string) => {
  return mem.listForAccount(accountId);
});

ipcMain.handle(IPC.MEMORY_LIST_ALL, async () => {
  const accountIds = getAccounts().map((a) => a.id);
  return mem.listAll(accountIds);
});

ipcMain.handle(IPC.MEMORY_REVEAL, async () => {
  await mem.revealMemoryFolder();
  return { ok: true };
});

ipcMain.handle(IPC.MEMORY_OPEN_FILE, async (_e, accountId: string, chatKey: string) => {
  await mem.openMemoryFile(accountId, chatKey);
  return { ok: true };
});

ipcMain.handle(IPC.MEMORY_AI_SYNC, async (_e, accountId: string) => {
  const target = findWcForAccount(accountId);
  if (!target) return { ok: false, error: 'No webview for account.' };
  const scraped = (await target.executeJavaScript(SCRAPE_SCRIPT, true)) as {
    ok: boolean;
    data?: { chatTitle?: string; isGroup?: boolean; messages?: Array<{ direction: string; text: string; sender?: string }> };
    error?: string;
  };
  if (!scraped?.ok || !scraped.data) {
    return { ok: false, error: scraped?.error || 'Could not read chat.' };
  }
  const conv = scraped.data as ScrapedConversation;
  if (!conv.chatTitle) return { ok: false, error: 'No open chat.' };
  return syncChatToMemory(accountId, conv.chatTitle, getAiSettings(), conv);
});

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
