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

// AI is used for ONE thing only: rephrasing text the user has typed themselves.
// Conversations are never read or sent anywhere.
export interface AISettings {
  enabled: boolean;
  hasApiKey: boolean; // computed view, never the key itself
  model: string;
  variantCount: number; // how many rephrase options to return
}

export interface RephraseVariant {
  label: string; // e.g. "Minimal fix"
  text: string;
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number; version?: string }
  | { state: 'ready'; version: string }
  | { state: 'error'; error: string }
  | { state: 'disabled-dev' };

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  hasApiKey: false,
  model: 'gpt-4o-mini',
  variantCount: 3,
};

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
  ai: AISettings;
  pills: PillPrefs;
  chatPins: Record<string, string[]>; // accountId → list of pinned chat keys
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoCleanEnabled: true,
  autoCleanMaxBytes: 1024 * 1024 * 1024,
  autoCleanMaxAgeDays: 60,
  lastAutoCleanAt: 0,
  perAccountLastCleanAt: {},
  ai: DEFAULT_AI_SETTINGS,
  pills: DEFAULT_PILL_PREFS,
  chatPins: {},
};

export const AI_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', hint: 'Fast & cheap — recommended' },
  { id: 'gpt-4o', label: 'GPT-4o', hint: 'Smartest, ~10× the cost' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', hint: 'Older flagship' },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', hint: 'Legacy, cheapest' },
] as const;

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
