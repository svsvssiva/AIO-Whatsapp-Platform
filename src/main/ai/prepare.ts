import type { AISettings, ScrapedConversation, ScrapedMessage } from '../../shared/types';
import { DEFAULT_REDACTION_PREFS } from '../../shared/types';
import { buildSystemPrompt, textOnly } from './prompts';
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

  // Take the last N, then keep only real text — images, stickers, videos,
  // voice notes and documents are dropped (the model can't reply to them).
  const trimmed = conv.messages.slice(-Math.max(3, settings.contextMessages));
  const textMsgs = textOnly(trimmed);

  // Redact each surviving message once; reuse the result for the transcript,
  // the conversation turns, and the redaction summary.
  const enriched = textMsgs.map((m) => {
    const r = redactOne(m.text);
    return { msg: m, redactedText: r.text, redacted: r.count > 0 };
  });

  // Transcript embedded in the system prompt — redacted, text-only, with timestamps.
  const transcript: ScrapedMessage[] = enriched.map((e) => ({ ...e.msg, text: e.redactedText }));

  // Most recent inbound text message (transcript is already media-free).
  let lastInbound: ScrapedMessage | null = null;
  let lastInboundIndex: number | null = null;
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i].direction === 'in') {
      lastInbound = transcript[i];
      lastInboundIndex = i;
      break;
    }
  }

  const aboutMeR = redactOne(settings.aboutMe || '');
  const memoryR = redactOne(memory);

  const systemPrompt = buildSystemPrompt({
    settings,
    chatTitle: conv.chatTitle || 'this chat',
    isGroup: conv.isGroup,
    transcript,
    lastInbound,
    aboutMe: aboutMeR.text,
    memory: memoryR.text,
  });

  const messages: PreparedMessage[] = enriched.map((e): PreparedMessage => {
    const m = e.msg;
    const senderTag = conv.isGroup && m.sender && m.direction === 'in' ? `${m.sender}: ` : '';
    return {
      role: m.direction === 'in' ? 'user' : 'assistant',
      content: senderTag + e.redactedText,
      originalContent: senderTag + m.text,
      redacted: e.redacted,
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
