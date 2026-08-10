import type {
  Account,
  AccountStorageInfo,
  AppSettings,
  NotificationPrefs,
  PillPrefs,
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

  pills: {
    getPrefs: () => Promise<PillPrefs>;
    list: (accountId: string) => Promise<string[]>;
    setPrefs: (patch: Partial<PillPrefs>) => Promise<PillPrefs>;
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
