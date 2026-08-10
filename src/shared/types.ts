export interface NotificationPrefs {
  enabled: boolean;
  showPreview: boolean;
  sound: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  showPreview: true,
  sound: true,
};

export interface Account {
  id: string;
  label: string;
  color: string;
  createdAt: number;
  avatarExt?: string; // 'png' | 'jpg' | 'webp' — file at avatars/<id>.<ext>
  avatarUpdatedAt?: number; // cache-bust query param
  notifications?: NotificationPrefs;
}


export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number; version?: string }
  | { state: 'ready'; version: string }
  | { state: 'error'; error: string }
  | { state: 'disabled-dev' };

export interface PillPrefs {
  order: string[]; // labels in desired left-to-right order
  hidden: string[]; // labels to hide entirely
}

export const DEFAULT_PILL_PREFS: PillPrefs = { order: [], hidden: [] };

export interface AppSettings {
  autoCleanEnabled: boolean;
  autoCleanMaxBytes: number;
  autoCleanMaxAgeDays: number;
  lastAutoCleanAt: number;
  perAccountLastCleanAt: Record<string, number>;
  pills: PillPrefs;
  chatPins: Record<string, string[]>; // accountId → list of pinned chat keys
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoCleanEnabled: true,
  autoCleanMaxBytes: 1024 * 1024 * 1024,
  autoCleanMaxAgeDays: 60,
  lastAutoCleanAt: 0,
  perAccountLastCleanAt: {},
  pills: DEFAULT_PILL_PREFS,
  chatPins: {},
};

export interface AccountStorageInfo {
  accountId: string;
  bytes: number;
  lastCleanedAt: number;
}

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export const ACCOUNT_COLORS = [
  '#FF453A',
  '#FF9F0A',
  '#FFD60A',
  '#30D158',
  '#64D2FF',
  '#0A84FF',
  '#BF5AF2',
  '#FF375F',
] as const;

export const COLOR_NAMES: Record<string, string> = {
  '#FF453A': 'Red',
  '#FF9F0A': 'Orange',
  '#FFD60A': 'Yellow',
  '#30D158': 'Green',
  '#64D2FF': 'Sky',
  '#0A84FF': 'Blue',
  '#BF5AF2': 'Purple',
  '#FF375F': 'Pink',
};

export const WA_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

export const WA_URL = 'https://web.whatsapp.com/';

export const partitionFor = (accountId: string) => `persist:wa-${accountId}`;
