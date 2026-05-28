import type { AISettings, ScrapedConversation, ScrapedMessage } from '../../shared/types';
import { DEFAULT_REDACTION_PREFS } from '../../shared/types';
import { buildSystemPrompt } from './prompts';
import { AIError, generate as openaiGenerate, ping as openaiPing, OpenAIMessage } from './providers/openai';
import { loadKey } from './keys';
import { applyRedaction } from './redact';
import type { PreparedPayload } from './prepare';

export { prepareGeneration } from './prepare';
export type { PreparedPayload, PreparedMessage } from './prepare';

export { AIError };

export async function testKey(): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const key = await loadKey();
  if (!key) return { ok: false, error: 'No key configured.' };
  try {
    await openaiPing(key, 'gpt-4o-mini');
    return { ok: true };
  } catch (e) {
    if (e instanceof AIError) return { ok: false, error: e.message, code: e.code };
    return { ok: false, error: (e as Error).message };
  }
}

function findLastInbound(messages: ScrapedMessage[]): ScrapedMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === 'in' && messages[i].text) return messages[i];
  }
  return null;
}

export async function generateReply(
  settings: AISettings,
  conv: ScrapedConversation,
  memory: string = '',
): Promise<string> {
  const key = await loadKey();
  if (!key) throw new AIError('auth', 'No API key configured.');

  const redaction = settings.redaction ?? DEFAULT_REDACTION_PREFS;
  let totalRedacted = 0;
  const redactedCats = new Set<string>();
  const redact = (s: string) => {
    const r = applyRedaction(s, redaction);
    totalRedacted += r.count;
    r.categories.forEach((c) => redactedCats.add(c));
    return r.text;
  };

  const trimmedRaw: ScrapedMessage[] = conv.messages.slice(-Math.max(3, settings.contextMessages));
  const trimmed: ScrapedMessage[] = trimmedRaw.map((m) => ({ ...m, text: redact(m.text) }));
  const lastInbound = findLastInbound(trimmed);

  const aboutMeRedacted = redact(settings.aboutMe || '');
  const memoryRedacted = redact(memory);

  const sys = buildSystemPrompt({
    settings,
    chatTitle: conv.chatTitle || 'this chat',
    isGroup: conv.isGroup,
    lastInbound,
    aboutMe: aboutMeRedacted,
    memory: memoryRedacted,
  });

  // Real conversation array — the model sees turns as a proper dialogue.
  // From OpenAI's POV: 'user' = the OTHER person (incoming), 'assistant' = our user (outgoing).
  const convoMessages: OpenAIMessage[] = trimmed
    .filter((m) => m.text && m.text.trim().length > 0)
    .map<OpenAIMessage>((m) => {
      if (m.direction === 'in') {
        const senderTag = conv.isGroup && m.sender ? `${m.sender}: ` : '';
        return { role: 'user', content: senderTag + m.text };
      }
      return { role: 'assistant', content: m.text };
    });

  // Final nudge so the model produces a NEW reply (not just echo prior assistant)
  convoMessages.push({
    role: 'user',
    content:
      '[GChat] Now write the single best reply for me to send next. Output reply text only — no quotes, no preamble.',
  });

  const lengthBudget = settings.length === 'brief' ? 80 : settings.length === 'medium' ? 220 : 500;

  console.log(
    '[gchat-ai] generating with',
    convoMessages.length,
    'turns; last inbound =',
    lastInbound ? `"${lastInbound.text.slice(0, 80)}"` : 'NONE',
    '; redacted',
    totalRedacted,
    'item(s) [',
    Array.from(redactedCats).join(', '),
    ']',
  );

  return openaiGenerate(
    key,
    settings.model,
    [{ role: 'system', content: sys }, ...convoMessages],
    { maxTokens: lengthBudget, temperature: 0.7 },
  );
}

// Generate from a user-reviewed prepared payload. Sends the EXACT content
// the user saw in the preview (after any edits they made).
export async function generateFromPayload(
  settings: AISettings,
  payload: PreparedPayload,
): Promise<string> {
  const key = await loadKey();
  if (!key) throw new AIError('auth', 'No API key configured.');

  const lengthBudget = settings.length === 'brief' ? 80 : settings.length === 'medium' ? 220 : 500;

  const convoMessages: OpenAIMessage[] = payload.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  convoMessages.push({ role: 'user', content: payload.finalNudge });

  console.log(
    '[gchat-ai] generating from payload:',
    convoMessages.length,
    'turns; chat =',
    payload.meta.chatTitle,
    '; redactions seen in preview:',
    payload.redactionSummary.total,
  );

  return openaiGenerate(
    key,
    payload.model || settings.model,
    [{ role: 'system', content: payload.systemPrompt }, ...convoMessages],
    { maxTokens: lengthBudget, temperature: 0.7 },
  );
}
