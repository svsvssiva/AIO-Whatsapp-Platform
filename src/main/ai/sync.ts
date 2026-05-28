import type { AISettings, ScrapedConversation } from '../../shared/types';
import { DEFAULT_REDACTION_PREFS } from '../../shared/types';
import { AIError, generate as openaiGenerate } from './providers/openai';
import { loadKey } from './keys';
import { appendUnderNotes, getMemory } from '../memory';
import { applyRedaction } from './redact';

const SYNC_PROMPT = `You maintain a notes file (markdown) about a WhatsApp chat. Below is the CURRENT notes file, then the RECENT conversation.

Task: Identify any new durable facts not yet captured anywhere in the current notes — people's names + roles, project / topic, agreements made, deadlines, decisions, the user's own role in this chat. Be very conservative: do NOT include casual chit-chat, do NOT invent facts, do NOT restate facts already present.

Output: an append-only list of new bullet points. Each bullet starts with "[ai] YYYY-MM-DD: " (use today's date). One fact per bullet, max ~20 words.

Output ONLY the new bullets, one per line, no headings, no preamble, no closing remarks. If there is nothing new worth saving, output the single word: NOTHING.`;

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export async function syncChatToMemory(
  accountId: string,
  chatKey: string,
  settings: AISettings,
  conv: ScrapedConversation,
): Promise<{ ok: true; added: number; content: string } | { ok: false; error: string; code?: string }> {
  const key = await loadKey();
  if (!key) return { ok: false, error: 'No API key configured.', code: 'no-key' };

  const redaction = settings.redaction ?? DEFAULT_REDACTION_PREFS;
  const redact = (s: string) => applyRedaction(s, redaction).text;

  const current = redact(await getMemory(accountId, chatKey));

  const transcript = conv.messages
    .slice(-30)
    .map((m) => `[${m.direction}]${m.sender ? ' ' + m.sender + ':' : ''} ${redact(m.text)}`)
    .join('\n');

  const userMessage = `CURRENT NOTES FILE:
----
${current || '(empty)'}
----

RECENT CONVERSATION (chat: "${conv.chatTitle}"${conv.isGroup ? ', GROUP' : ''}):
----
${transcript || '(no messages)'}
----

Today's date: ${today()}.

Now output new bullets to append (or the word NOTHING).`;

  try {
    const result = await openaiGenerate(
      key,
      settings.model,
      [
        { role: 'system', content: SYNC_PROMPT },
        { role: 'user', content: userMessage },
      ],
      { maxTokens: 400, temperature: 0.2, timeoutMs: 20000 },
    );
    const trimmed = result.trim();
    if (!trimmed || /^nothing\.?$/i.test(trimmed)) {
      return { ok: true, added: 0, content: current };
    }
    const content = await appendUnderNotes(accountId, chatKey, trimmed);
    const added = trimmed.split('\n').filter((l) => l.trim()).length;
    return { ok: true, added, content };
  } catch (e) {
    if (e instanceof AIError) return { ok: false, error: e.message, code: e.code };
    return { ok: false, error: (e as Error).message };
  }
}
