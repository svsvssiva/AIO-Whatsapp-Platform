import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type {
  Account,
  AccountStorageInfo,
  AISettings,
  AppSettings,
  ChatMemoryMeta,
  NotificationPrefs,
  PillPrefs,
  PreparedPayload,
  ScrapedConversation,
  UpdateStatus,
} from '../shared/types';

const api = {
  listAccounts: (): Promise<Account[]> => ipcRenderer.invoke(IPC.ACCOUNTS_LIST),
  addAccount: (label?: string): Promise<Account> => ipcRenderer.invoke(IPC.ACCOUNTS_ADD, label),
  removeAccount: (id: string): Promise<Account[]> => ipcRenderer.invoke(IPC.ACCOUNTS_REMOVE, id),
  renameAccount: (id: string, label: string): Promise<Account[]> => ipcRenderer.invoke(IPC.ACCOUNTS_RENAME, id, label),
  recolorAccount: (id: string, color: string): Promise<Account[]> => ipcRenderer.invoke(IPC.ACCOUNTS_RECOLOR, id, color),
  clearCache: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.ACCOUNTS_CLEAR_CACHE, id),
  logoutAccount: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.ACCOUNTS_LOGOUT, id),

  showTileMenu: (id: string) => ipcRenderer.send(IPC.TILE_MENU, id),

  pickAvatar: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.AVATAR_PICK, id),
  resetAvatar: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.AVATAR_RESET, id),

  registerWebview: (wcId: number, accountId: string) =>
    ipcRenderer.send(IPC.WEBVIEW_REGISTER, wcId, accountId),

  inspectWebview: (wcId: number) => ipcRenderer.send(IPC.INSPECT_WEBVIEW, wcId),

  getStorage: (): Promise<AccountStorageInfo[]> => ipcRenderer.invoke(IPC.STORAGE_GET_ALL),
  clearStorageCache: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.STORAGE_CLEAR_CACHE, id),
  clearStorageAll: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.STORAGE_CLEAR_ALL, id),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, patch),

  setNotifPrefs: (id: string, prefs: Partial<NotificationPrefs>): Promise<Account[]> =>
    ipcRenderer.invoke(IPC.NOTIF_SET_PREFS, id, prefs),

  isDark: (): Promise<boolean> => ipcRenderer.invoke(IPC.THEME_GET),
  onThemeChanged: (cb: (isDark: boolean) => void) => {
    const listener = (_: unknown, isDark: boolean) => cb(isDark);
    ipcRenderer.on(IPC.THEME_CHANGED, listener);
    return () => ipcRenderer.removeListener(IPC.THEME_CHANGED, listener);
  },

  onUnreadUpdated: (cb: (id: string, count: number) => void) => {
    const listener = (_: unknown, id: string, count: number) => cb(id, count);
    ipcRenderer.on(IPC.UNREAD_UPDATED, listener);
    return () => ipcRenderer.removeListener(IPC.UNREAD_UPDATED, listener);
  },

  onMenuAddAccount: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on(IPC.MENU_ADD_ACCOUNT, listener);
    return () => ipcRenderer.removeListener(IPC.MENU_ADD_ACCOUNT, listener);
  },
  onMenuSwitchAccount: (cb: (id: string) => void) => {
    const listener = (_: unknown, id: string) => cb(id);
    ipcRenderer.on(IPC.MENU_SWITCH_ACCOUNT, listener);
    return () => ipcRenderer.removeListener(IPC.MENU_SWITCH_ACCOUNT, listener);
  },
  onMenuReloadActive: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on(IPC.MENU_RELOAD_ACTIVE, listener);
    return () => ipcRenderer.removeListener(IPC.MENU_RELOAD_ACTIVE, listener);
  },
  onMenuQuickSwitch: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on(IPC.MENU_QUICK_SWITCH, listener);
    return () => ipcRenderer.removeListener(IPC.MENU_QUICK_SWITCH, listener);
  },
  onMenuInspectActive: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on(IPC.MENU_INSPECT_ACTIVE, listener);
    return () => ipcRenderer.removeListener(IPC.MENU_INSPECT_ACTIVE, listener);
  },

  onContextAction: (
    cb: (
      action:
        | 'remove'
        | 'rename'
        | 'reload'
        | 'clear-cache'
        | 'logout'
        | 'recolor'
        | 'change-icon'
        | 'reset-icon',
      id: string,
      payload?: unknown,
    ) => void,
  ) => {
    const handlers: Array<[string, (..._a: unknown[]) => void]> = [
      [IPC.ACCOUNTS_REMOVE, (_e, id) => cb('remove', id as string)],
      [IPC.ACCOUNTS_RELOAD, (_e, id) => cb('reload', id as string)],
      [IPC.ACCOUNTS_CLEAR_CACHE, (_e, id) => cb('clear-cache', id as string)],
      [IPC.ACCOUNTS_LOGOUT, (_e, id) => cb('logout', id as string)],
      [IPC.ACCOUNTS_RECOLOR, (_e, id, color) => cb('recolor', id as string, color)],
      [IPC.TILE_CHANGE_ICON, (_e, id) => cb('change-icon', id as string)],
      [IPC.TILE_RESET_ICON, (_e, id) => cb('reset-icon', id as string)],
      ['tile:rename-prompt', (_e, id) => cb('rename', id as string)],
    ];
    handlers.forEach(([ch, h]) => ipcRenderer.on(ch, h));
    return () => handlers.forEach(([ch, h]) => ipcRenderer.removeListener(ch, h));
  },

  onOpenSettings: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on(IPC.MENU_OPEN_SETTINGS, listener);
    return () => ipcRenderer.removeListener(IPC.MENU_OPEN_SETTINGS, listener);
  },

  ai: {
    getSettings: (): Promise<AISettings> => ipcRenderer.invoke(IPC.AI_GET_SETTINGS),
    setSettings: (patch: Partial<AISettings>): Promise<AISettings> =>
      ipcRenderer.invoke(IPC.AI_SET_SETTINGS, patch),
    setKey: (key: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.AI_SET_KEY, key),
    clearKey: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.AI_CLEAR_KEY),
    testKey: (): Promise<{ ok: true } | { ok: false; error: string; code?: string }> =>
      ipcRenderer.invoke(IPC.AI_TEST_KEY),
    scrapeActive: (
      accountId: string,
    ): Promise<{ ok: boolean; data?: ScrapedConversation; error?: string }> =>
      ipcRenderer.invoke(IPC.AI_SCRAPE_ACTIVE, accountId),
    generate: (
      conversation: ScrapedConversation,
      accountId?: string,
    ): Promise<{ ok: true; text: string } | { ok: false; code: string; error: string }> =>
      ipcRenderer.invoke(IPC.AI_GENERATE, { conversation, accountId }),
    prepare: (
      conversation: ScrapedConversation,
      accountId?: string,
    ): Promise<{ ok: true; payload: PreparedPayload } | { ok: false; code: string; error: string }> =>
      ipcRenderer.invoke(IPC.AI_PREPARE, { conversation, accountId }),
    generateFromPayload: (
      payload: PreparedPayload,
    ): Promise<{ ok: true; text: string } | { ok: false; code: string; error: string }> =>
      ipcRenderer.invoke(IPC.AI_GENERATE_FROM_PAYLOAD, payload),
    insertText: (accountId: string, text: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.AI_INSERT_TEXT, accountId, text),
    showSuggestion: (accountId: string, text: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.AI_SHOW_SUGGESTION, accountId, text),
    clearSuggestion: (accountId: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke(IPC.AI_CLEAR_SUGGESTION, accountId),
  },

  pills: {
    getPrefs: (): Promise<PillPrefs> => ipcRenderer.invoke(IPC.PILLS_GET_PREFS),
    list: (accountId: string): Promise<string[]> => ipcRenderer.invoke(IPC.PILLS_LIST, accountId),
    setPrefs: (patch: Partial<PillPrefs>): Promise<PillPrefs> =>
      ipcRenderer.invoke(IPC.PILLS_SET_PREFS, patch),
  },

  memory: {
    get: (accountId: string, chatKey: string): Promise<{ ok: boolean; content: string; exists: boolean }> =>
      ipcRenderer.invoke(IPC.MEMORY_GET, accountId, chatKey),
    save: (accountId: string, chatKey: string, content: string): Promise<{ ok: boolean; bytes: number; updatedAt: number }> =>
      ipcRenderer.invoke(IPC.MEMORY_SAVE, accountId, chatKey, content),
    create: (accountId: string, chatKey: string): Promise<{ ok: boolean; content: string }> =>
      ipcRenderer.invoke(IPC.MEMORY_CREATE, accountId, chatKey),
    delete: (accountId: string, chatKey: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke(IPC.MEMORY_DELETE, accountId, chatKey),
    listForAccount: (accountId: string): Promise<ChatMemoryMeta[]> =>
      ipcRenderer.invoke(IPC.MEMORY_LIST_FOR_ACCOUNT, accountId),
    listAll: (): Promise<ChatMemoryMeta[]> => ipcRenderer.invoke(IPC.MEMORY_LIST_ALL),
    reveal: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.MEMORY_REVEAL),
    openFile: (accountId: string, chatKey: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke(IPC.MEMORY_OPEN_FILE, accountId, chatKey),
    aiSync: (
      accountId: string,
    ): Promise<{ ok: true; added: number; content: string } | { ok: false; error: string; code?: string }> =>
      ipcRenderer.invoke(IPC.MEMORY_AI_SYNC, accountId),
    onOpenDrawer: (cb: (accountId: string, chatKey: string) => void) => {
      const listener = (_: unknown, accountId: string, chatKey: string) => cb(accountId, chatKey);
      ipcRenderer.on(IPC.MEMORY_OPEN_DRAWER, listener);
      return () => ipcRenderer.removeListener(IPC.MEMORY_OPEN_DRAWER, listener);
    },
  },

  aiLockout: {
    get: (accountId: string): Promise<string[]> => ipcRenderer.invoke(IPC.AI_LOCKOUT_GET, accountId),
    isLocked: (accountId: string, chatKey: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.AI_LOCKOUT_IS_LOCKED, accountId, chatKey),
    onChanged: (cb: (accountId: string, chatKey: string, locked: boolean) => void) => {
      const listener = (_: unknown, accountId: string, chatKey: string, locked: boolean) =>
        cb(accountId, chatKey, locked);
      ipcRenderer.on(IPC.AI_LOCKOUT_CHANGED, listener);
      return () => ipcRenderer.removeListener(IPC.AI_LOCKOUT_CHANGED, listener);
    },
  },

  update: {
    getInfo: (): Promise<{ version: string; status: UpdateStatus; isPackaged: boolean }> =>
      ipcRenderer.invoke(IPC.UPDATE_GET_VERSION),
    check: (): Promise<{ ok: true }> => ipcRenderer.invoke(IPC.UPDATE_CHECK),
    install: (): Promise<{ ok: true }> => ipcRenderer.invoke(IPC.UPDATE_INSTALL),
    openDownload: (): Promise<{ ok: true }> => ipcRenderer.invoke(IPC.UPDATE_DOWNLOAD),
    onStatus: (cb: (status: UpdateStatus) => void) => {
      const listener = (_: unknown, status: UpdateStatus) => cb(status);
      ipcRenderer.on(IPC.UPDATE_STATUS, listener);
      return () => ipcRenderer.removeListener(IPC.UPDATE_STATUS, listener);
    },
  },
};

contextBridge.exposeInMainWorld('gchat', api);

export type GChatAPI = typeof api;
