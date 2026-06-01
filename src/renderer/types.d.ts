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

interface GChatAPI {
  listAccounts: () => Promise<Account[]>;
  addAccount: (label?: string) => Promise<Account>;
  removeAccount: (id: string) => Promise<Account[]>;
  renameAccount: (id: string, label: string) => Promise<Account[]>;
  recolorAccount: (id: string, color: string) => Promise<Account[]>;
  clearCache: (id: string) => Promise<boolean>;
  logoutAccount: (id: string) => Promise<boolean>;
  showTileMenu: (id: string) => void;
  pickAvatar: (id: string) => Promise<boolean>;
  resetAvatar: (id: string) => Promise<boolean>;
  registerWebview: (wcId: number, accountId: string) => void;
  inspectWebview: (wcId: number) => void;
  getStorage: () => Promise<AccountStorageInfo[]>;
  clearStorageCache: (id: string) => Promise<boolean>;
  clearStorageAll: (id: string) => Promise<boolean>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  setNotifPrefs: (id: string, prefs: Partial<NotificationPrefs>) => Promise<Account[]>;
  isDark: () => Promise<boolean>;
  onThemeChanged: (cb: (isDark: boolean) => void) => () => void;
  onUnreadUpdated: (cb: (id: string, count: number) => void) => () => void;
  onMenuAddAccount: (cb: () => void) => () => void;
  onMenuSwitchAccount: (cb: (id: string) => void) => () => void;
  onMenuReloadActive: (cb: () => void) => () => void;
  onMenuQuickSwitch: (cb: () => void) => () => void;
  onMenuInspectActive: (cb: () => void) => () => void;

  ai: {
    getSettings: () => Promise<AISettings>;
    setSettings: (patch: Partial<AISettings>) => Promise<AISettings>;
    setKey: (key: string) => Promise<{ ok: boolean; error?: string }>;
    clearKey: () => Promise<{ ok: boolean }>;
    testKey: () => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
    scrapeActive: (
      accountId: string,
    ) => Promise<{ ok: boolean; data?: ScrapedConversation; error?: string }>;
    generate: (
      conversation: ScrapedConversation,
      accountId?: string,
    ) => Promise<{ ok: true; text: string } | { ok: false; code: string; error: string }>;
    prepare: (
      conversation: ScrapedConversation,
      accountId?: string,
    ) => Promise<{ ok: true; payload: PreparedPayload } | { ok: false; code: string; error: string }>;
    generateFromPayload: (
      payload: PreparedPayload,
    ) => Promise<{ ok: true; text: string } | { ok: false; code: string; error: string }>;
    insertText: (accountId: string, text: string) => Promise<{ ok: boolean; error?: string }>;
    showSuggestion: (accountId: string, text: string) => Promise<{ ok: boolean; error?: string }>;
    clearSuggestion: (accountId: string) => Promise<{ ok: boolean }>;
  };

  pills: {
    getPrefs: () => Promise<PillPrefs>;
    list: (accountId: string) => Promise<string[]>;
    setPrefs: (patch: Partial<PillPrefs>) => Promise<PillPrefs>;
  };

  memory: {
    get: (accountId: string, chatKey: string) => Promise<{ ok: boolean; content: string; exists: boolean }>;
    save: (accountId: string, chatKey: string, content: string) => Promise<{ ok: boolean; bytes: number; updatedAt: number }>;
    create: (accountId: string, chatKey: string) => Promise<{ ok: boolean; content: string }>;
    delete: (accountId: string, chatKey: string) => Promise<{ ok: boolean }>;
    listForAccount: (accountId: string) => Promise<ChatMemoryMeta[]>;
    listAll: () => Promise<ChatMemoryMeta[]>;
    reveal: () => Promise<{ ok: boolean }>;
    openFile: (accountId: string, chatKey: string) => Promise<{ ok: boolean }>;
    aiSync: (
      accountId: string,
    ) => Promise<{ ok: true; added: number; content: string } | { ok: false; error: string; code?: string }>;
    onOpenDrawer: (cb: (accountId: string, chatKey: string) => void) => () => void;
  };

  aiLockout: {
    get: (accountId: string) => Promise<string[]>;
    isLocked: (accountId: string, chatKey: string) => Promise<boolean>;
    onChanged: (cb: (accountId: string, chatKey: string, locked: boolean) => void) => () => void;
  };

  update: {
    getInfo: () => Promise<{ version: string; status: UpdateStatus; isPackaged: boolean }>;
    check: () => Promise<{ ok: true }>;
    install: () => Promise<{ ok: true }>;
    openDownload: () => Promise<{ ok: true }>;
    onStatus: (cb: (status: UpdateStatus) => void) => () => void;
  };
  onOpenSettings: (cb: () => void) => () => void;
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
  ) => () => void;
}

declare global {
  interface Window {
    gchat: GChatAPI;
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          partition?: string;
          allowpopups?: string | boolean;
          useragent?: string;
          webpreferences?: string;
          ref?: React.Ref<HTMLElement>;
        },
        HTMLElement
      >;
    }
  }
}

export {};
