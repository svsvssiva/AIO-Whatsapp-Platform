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

export type AITone =
  | 'friendly'
  | 'professional'
  | 'casual'
  | 'formal'
  | 'concise'
  | 'empathetic'
  | 'apologetic'
  | 'custom';

export type AILength = 'brief' | 'medium' | 'detailed';

export interface RedactionPrefs {
  enabled: boolean;
  apiKeys: boolean;
  tokens: boolean;
  otpCodes: boolean;
  creditCards: boolean;
  iban: boolean;
  emails: boolean;
  phones: boolean;
  longNumbers: boolean;
  customPatterns: string[];
}

export const DEFAULT_REDACTION_PREFS: RedactionPrefs = {
  enabled: true,
  apiKeys: true,
  tokens: true,
  otpCodes: true,
  creditCards: true,
  iban: true,
  emails: false,
  phones: false,
  longNumbers: false,
  customPatterns: [],
};

export interface AISettings {
  enabled: boolean;
  hasApiKey: boolean; // computed view, never the key itself
  model: string;
  tone: AITone;
  customTone?: string;
  length: AILength;
  contextMessages: number;
  customInstructions?: string;
  language: string; // 'auto' | 'en' | 'ms' | 'ta' | 'zh' | other
  acknowledgedPrivacy: boolean;
  aboutMe?: string; // global profile prepended to every AI generation
  redaction?: RedactionPrefs; // strip credentials before sending to OpenAI
}

export interface ChatMemoryMeta {
  accountId: string;
  chatKey: string;
  filename: string;
  bytes: number;
  updatedAt: number;
  preview: string;
}

export interface PreparedMessage {
  role: 'user' | 'assistant';
  content: string;
  originalContent: string;
  redacted: boolean;
  direction: 'in' | 'out';
  sender?: string;
}

export interface PreparedPayload {
  systemPrompt: string;
  messages: PreparedMessage[];
  finalNudge: string;
  model: string;
  redactionSummary: { total: number; categories: string[] };
  meta: {
    chatTitle: string;
    isGroup: boolean;
    lastInboundIndex: number | null;
  };
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
  tone: 'friendly',
  length: 'medium',
  contextMessages: 20,
  language: 'auto',
  acknowledgedPrivacy: false,
  aboutMe: '',
  redaction: DEFAULT_REDACTION_PREFS,
};

export interface ScrapedMessage {
  direction: 'in' | 'out';
  text: string;
  sender?: string;
  ts?: string;
}

export interface ScrapedConversation {
  chatTitle: string;
  isGroup: boolean;
  messages: ScrapedMessage[];
}

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
  aiLockouts: Record<string, string[]>; // accountId → list of chat keys with AI disabled
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
  aiLockouts: {},
};

export const AI_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', hint: 'Fast & cheap — recommended' },
  { id: 'gpt-4o', label: 'GPT-4o', hint: 'Smartest, ~10× the cost' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', hint: 'Older flagship' },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', hint: 'Legacy, cheapest' },
] as const;

export const AI_TONES: Array<{ id: AITone; label: string; blurb: string }> = [
  { id: 'friendly', label: 'Friendly', blurb: 'Warm, casual, light emoji' },
  { id: 'professional', label: 'Professional', blurb: 'Polite, business-appropriate' },
  { id: 'casual', label: 'Casual', blurb: 'Chill, contractions, informal' },
  { id: 'formal', label: 'Formal', blurb: 'Full sentences, respectful' },
  { id: 'concise', label: 'Concise', blurb: 'Minimum words, no fluff' },
  { id: 'empathetic', label: 'Empathetic', blurb: 'Acknowledge feelings first' },
  { id: 'apologetic', label: 'Apologetic', blurb: 'Own the issue, propose a fix' },
  { id: 'custom', label: 'Custom', blurb: 'Describe your own voice' },
];

export const AI_LANGUAGES = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'en', label: 'English' },
  { id: 'ms', label: 'Malay' },
  { id: 'ta', label: 'Tamil' },
  { id: 'zh', label: 'Chinese' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'hi', label: 'Hindi' },
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
