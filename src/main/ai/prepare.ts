import type { AISettings, ScrapedConversation, ScrapedMessage } from '../../shared/types';
import { DEFAULT_REDACTION_PREFS } from '../../shared/types';
import { buildSystemPrompt } from './prompts';
import { applyRedaction } from './redact';

export interface PreparedMessage {
  role: 'user' | 'assistant'; // user = inbound from contact, assistant = user's own past message
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

function findLastInboundIndex(messages: ScrapedMessage[]): number | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === 'in' && messages[i].text) return i;
  }
  return null;
}

export function prepareGeneration(
  settings: AISettings,
  conv: ScrapedConversation,
  memory: string,
): PreparedPayload {
  const redaction = settings.redaction ?? DEFAULT_REDACTION_PREFS;
  const cats = new Set<string>();
  let total = 0;
  const redactOne = (s: string) => {
    const r = applyRedaction(s, redaction);
    total += r.count;
    r.categories.forEach((c) => cats.add(c));
    return r;
  };

  const trimmed = conv.messages.slice(-Math.max(3, settings.contextMessages));
  const lastInboundIndex = findLastInboundIndex(trimmed);
  const lastInbound = lastInboundIndex !== null ? trimmed[lastInboundIndex] : null;

  const aboutMeR = redactOne(settings.aboutMe || '');
  const memoryR = redactOne(memory);

  // For the system prompt's "last inbound" call-out, use redacted text too
  const lastInboundForPrompt = lastInbound
    ? { ...lastInbound, text: redactOne(lastInbound.text).text }
    : null;

  const systemPrompt = buildSystemPrompt({
    settings,
    chatTitle: conv.chatTitle || 'this chat',
    isGroup: conv.isGroup,
    lastInbound: lastInboundForPrompt,
    aboutMe: aboutMeR.text,
    memory: memoryR.text,
  });

  const messages: PreparedMessage[] = trimmed
    .filter((m) => m.text && m.text.trim().length > 0)
    .map((m): PreparedMessage => {
      const r = redactOne(m.text);
      const senderTag = conv.isGroup && m.sender && m.direction === 'in' ? `${m.sender}: ` : '';
      const content = senderTag + r.text;
      const original = senderTag + m.text;
      return {
        role: m.direction === 'in' ? 'user' : 'assistant',
        content,
        originalContent: original,
        redacted: r.count > 0,
        direction: m.direction,
        sender: m.sender,
      };
    });

  const finalNudge =
    '[GChat] Now write the single best reply for me to send next. Output reply text only — no quotes, no preamble.';

  return {
    systemPrompt,
    messages,
    finalNudge,
    model: settings.model,
    redactionSummary: { total, categories: Array.from(cats) },
    meta: {
      chatTitle: conv.chatTitle,
      isGroup: conv.isGroup,
      lastInboundIndex,
    },
  };
}
