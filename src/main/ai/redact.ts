import type { RedactionPrefs } from '../../shared/types';

const RX = {
  apiKeys: [
    /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,        // Anthropic
    /\bsk-[A-Za-z0-9_-]{20,}\b/g,            // OpenAI & generic sk- keys
    /\bAKIA[0-9A-Z]{16}\b/g,                  // AWS access key id
    /\bASIA[0-9A-Z]{16}\b/g,                  // AWS temp credential
    /\bAIza[A-Za-z0-9_-]{30,}\b/g,            // Google API key
    /\bya29\.[A-Za-z0-9_-]{20,}\b/g,          // Google OAuth token
    /\bghp_[A-Za-z0-9]{30,}\b/g,              // GitHub personal token
    /\bgho_[A-Za-z0-9]{30,}\b/g,              // GitHub OAuth
    /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,      // Slack tokens
    /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, // SendGrid
    /\bSK[a-z0-9]{32}\b/g,                    // Twilio
  ],
  tokens: [
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,  // JWT
    /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gi,
    /(\b(?:password|passwd|pwd|secret|token|api[_-]?key|auth[_-]?token|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*)([^\s"'`,;]{6,})/gi,
  ],
  otpCodes: [
    /\b(?:OTP|PIN|TAC|verification\s*code|verifikasi)\s*[:#-]?\s*\d{3,8}\b/gi,
    /\b\d{4,8}\b(?=\s*(?:is\s+your|verification|one[- ]time))/gi,
  ],
  // CC candidates (Luhn-checked below)
  cardLike: /\b(?:\d[ -]?){13,19}\b/g,
  emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  phones: /(?<!\d)\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?!\d)/g,
  longNumbers: /(?<!\d)\d{10,}(?!\d)/g,
  iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g,
};

function luhnValid(s: string): boolean {
  const digits = s.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export interface RedactionResult {
  text: string;
  count: number;
  categories: string[];
}

export function applyRedaction(text: string, prefs: RedactionPrefs): RedactionResult {
  const empty: RedactionResult = { text: text ?? '', count: 0, categories: [] };
  if (!prefs.enabled || !text) return empty;

  let out = text;
  let count = 0;
  const hit = new Set<string>();

  const sub = (re: RegExp, label: string, category: string) => {
    out = out.replace(re, (...args) => {
      const groups = args.slice(1, -2) as string[];
      // For the "password: ..." pattern, group 1 is the prefix to keep.
      if (groups.length > 0 && groups[0]) {
        count++;
        hit.add(category);
        return groups[0] + label;
      }
      count++;
      hit.add(category);
      return label;
    });
  };

  if (prefs.apiKeys) RX.apiKeys.forEach((re) => sub(re, '[REDACTED:apikey]', 'apiKeys'));
  if (prefs.tokens) RX.tokens.forEach((re) => sub(re, '[REDACTED:token]', 'tokens'));
  if (prefs.otpCodes) RX.otpCodes.forEach((re) => sub(re, '[REDACTED:otp]', 'otpCodes'));
  if (prefs.creditCards) {
    out = out.replace(RX.cardLike, (m) => {
      if (luhnValid(m)) {
        count++;
        hit.add('creditCards');
        return '[REDACTED:card]';
      }
      return m;
    });
  }
  if (prefs.iban) sub(RX.iban, '[REDACTED:iban]', 'iban');
  if (prefs.emails) sub(RX.emails, '[REDACTED:email]', 'emails');
  if (prefs.phones) sub(RX.phones, '[REDACTED:phone]', 'phones');
  if (prefs.longNumbers) sub(RX.longNumbers, '[REDACTED:number]', 'longNumbers');

  if (prefs.customPatterns && prefs.customPatterns.length > 0) {
    for (const p of prefs.customPatterns) {
      const trimmed = (p || '').trim();
      if (!trimmed) continue;
      try {
        const re = new RegExp(trimmed, 'gi');
        sub(re, '[REDACTED:custom]', 'custom');
      } catch {
        /* invalid user regex — skip */
      }
    }
  }

  return { text: out, count, categories: Array.from(hit) };
}
