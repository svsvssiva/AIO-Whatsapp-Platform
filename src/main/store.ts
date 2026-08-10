import Store from 'electron-store';
import { randomUUID } from 'crypto';
import {
  ACCOUNT_COLORS,
  AISettings,
  Account,
  AppSettings,
  DEFAULT_AI_SETTINGS,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PILL_PREFS,
  DEFAULT_SETTINGS,
  NotificationPrefs,
  PillPrefs,
  WindowState,
} from '../shared/types';

interface Schema {
  accounts: Account[];
  windowState: WindowState;
  settings: AppSettings;
}

const store = new Store<Schema>({
  name: 'gchat',
  defaults: {
    accounts: [],
    windowState: { width: 1280, height: 840 },
    settings: DEFAULT_SETTINGS,
  },
}) as unknown as {
  get<K extends keyof Schema>(k: K): Schema[K];
  set<K extends keyof Schema>(k: K, v: Schema[K]): void;
};

export const getAccounts = (): Account[] => store.get('accounts');

export const saveAccounts = (a: Account[]) => store.set('accounts', a);

export const addAccount = (label?: string): Account => {
  const list = getAccounts();
  const used = new Set(list.map((a) => a.color));
  const color = ACCOUNT_COLORS.find((c) => !used.has(c)) ?? ACCOUNT_COLORS[list.length % ACCOUNT_COLORS.length];
  const acc: Account = {
    id: randomUUID(),
    label: label ?? `Account ${list.length + 1}`,
    color,
    createdAt: Date.now(),
  };
  saveAccounts([...list, acc]);
  return acc;
};

export const removeAccount = (id: string) => {
  saveAccounts(getAccounts().filter((a) => a.id !== id));
};

export const updateAccount = (id: string, patch: Partial<Pick<Account, 'label' | 'color'>>) => {
  saveAccounts(getAccounts().map((a) => (a.id === id ? { ...a, ...patch } : a)));
};

export const getWindowState = (): WindowState => store.get('windowState');
export const saveWindowState = (s: WindowState) => store.set('windowState', s);

export const getSettings = (): AppSettings => {
  const raw = store.get('settings') as Partial<AppSettings> | undefined;

  // Migration: the AI-reply and chat-memory features were removed. Rebuild the
  // ai block from known keys only, so leftovers from that era (aboutMe, tone,
  // length, language, redaction, contextMessages) — which could hold personal
  // text — are dropped from the config file on the next save.
  const rawAi = (raw?.ai ?? {}) as Record<string, unknown>;
  const ai: AISettings = {
    enabled: typeof rawAi.enabled === 'boolean' ? rawAi.enabled : DEFAULT_AI_SETTINGS.enabled,
    hasApiKey: false, // always computed at call time, never persisted
    model: typeof rawAi.model === 'string' ? rawAi.model : DEFAULT_AI_SETTINGS.model,
    variantCount:
      typeof rawAi.variantCount === 'number'
        ? Math.max(1, Math.min(3, rawAi.variantCount))
        : DEFAULT_AI_SETTINGS.variantCount,
  };

  const { aiLockouts: _dropped, ...rest } = (raw ?? {}) as Partial<AppSettings> & {
    aiLockouts?: unknown;
  };

  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    ai,
    pills: { ...DEFAULT_PILL_PREFS, ...(raw?.pills ?? {}) },
    chatPins: raw?.chatPins ?? {},
  };
};

export const getPillPrefs = (): PillPrefs => getSettings().pills;
export const savePillPrefs = (p: Partial<PillPrefs>) => {
  const cur = getSettings();
  saveSettings({ pills: { ...cur.pills, ...p } });
};

export const getChatPins = (accountId: string): string[] => {
  return getSettings().chatPins[accountId] ?? [];
};
export const setChatPins = (accountId: string, pins: string[]) => {
  const cur = getSettings();
  saveSettings({ chatPins: { ...cur.chatPins, [accountId]: pins } });
};
export const toggleChatPin = (accountId: string, chatKey: string): string[] => {
  const cur = getChatPins(accountId);
  const next = cur.includes(chatKey) ? cur.filter((c) => c !== chatKey) : [...cur, chatKey];
  setChatPins(accountId, next);
  return next;
};

export const saveSettings = (s: Partial<AppSettings>) => {
  store.set('settings', { ...getSettings(), ...s });
};

export const getAiSettings = (): AISettings => getSettings().ai;

export const saveAiSettings = (patch: Partial<AISettings>) => {
  const cur = getSettings();
  saveSettings({ ai: { ...cur.ai, ...patch } });
};

export const setAvatar = (id: string, ext?: string) => {
  const list = getAccounts();
  saveAccounts(
    list.map((a) =>
      a.id === id ? { ...a, avatarExt: ext, avatarUpdatedAt: ext ? Date.now() : undefined } : a,
    ),
  );
};

export const setNotificationPrefs = (id: string, prefs: Partial<NotificationPrefs>) => {
  const list = getAccounts();
  saveAccounts(
    list.map((a) =>
      a.id === id
        ? { ...a, notifications: { ...DEFAULT_NOTIFICATION_PREFS, ...a.notifications, ...prefs } }
        : a,
    ),
  );
};

export const markAccountCleaned = (id: string) => {
  const s = getSettings();
  saveSettings({ perAccountLastCleanAt: { ...s.perAccountLastCleanAt, [id]: Date.now() } });
};
