import type { AISettings, ScrapedMessage } from '../../shared/types';

const TONE_DESC: Record<string, string> = {
  friendly: 'Warm and casual. Use contractions and light emoji where natural.',
  professional: 'Polite and business-appropriate. Complete sentences, no slang, sparing emoji.',
  casual: 'Chill and informal. Contractions welcome. Lowercase-friendly.',
  formal: 'Full sentences, no contractions, respectful address. No slang.',
  concise: 'Minimum words. No fluff. No emoji.',
  empathetic: 'Acknowledge the other person’s feelings before responding.',
  apologetic: 'Own the issue clearly and propose a fix.',
};

const LENGTH_DESC: Record<string, string> = {
  brief: 'Short and straightforward — 1 sentence, ~15 words max.',
  medium: '2 to 3 sentences.',
  detailed: 'A short paragraph (3 to 5 sentences).',
};

// Placeholders the scraper (webview-wa.ts) emits for non-text bubbles. These
// are NOT real text — the model can't reply to them — so they are dropped from
// the transcript, the conversation turns, and the "last inbound" call-out.
const MEDIA_PLACEHOLDERS = new Set([
  '[image]',
  '[video]',
  '[sticker]',
  '[gif]',
  '[voice note]',
  '[audio]',
  '[document]',
  '[contact]',
  '[location]',
  '[poll]',
]);

/** True when the whole message is just a media placeholder (image/sticker/video/etc.). */
export function isMediaPlaceholder(text: string): boolean {
  return MEDIA_PLACEHOLDERS.has(text.trim().toLowerCase());
}

/** Keep only real text messages — drops empties and media placeholders, order preserved. */
export function textOnly(messages: ScrapedMessage[]): ScrapedMessage[] {
  return messages.filter(
    (m) => !!m.text && m.text.trim().length > 0 && !isMediaPlaceholder(m.text),
  );
}

/** Most recent inbound text message (skips media), or null. Expects oldest→newest order. */
export function lastTextInbound(messages: ScrapedMessage[]): ScrapedMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.direction === 'in' && !!m.text && m.text.trim() && !isMediaPlaceholder(m.text)) return m;
  }
  return null;
}

/** Render the conversation as a timestamped transcript, one line per message. */
function formatTranscript(messages: ScrapedMessage[], chatTitle: string, isGroup: boolean): string {
  return messages
    .map((m) => {
      const who =
        m.direction === 'out'
          ? 'Me'
          : m.sender?.trim() || (isGroup ? 'Member' : chatTitle || 'Them');
      const stamp = m.ts && m.ts.trim() ? `[${m.ts.trim()}] ` : '';
      return `${stamp}${who}: ${m.text.trim()}`;
    })
    .join('\n');
}

export interface SystemPromptOpts {
  settings: AISettings;
  chatTitle: string;
  isGroup: boolean;
  /** Conversation to embed — already redacted + text-only, oldest→newest. */
  transcript: ScrapedMessage[];
  /** Most recent inbound text message (already redacted), or null. */
  lastInbound: ScrapedMessage | null;
  aboutMe: string;
  memory: string;
}

export function buildSystemPrompt(opts: SystemPromptOpts): string {
  const { settings: s, chatTitle, isGroup, transcript, lastInbound, aboutMe, memory } = opts;

  const toneLine =
    s.tone === 'custom' && s.customTone
      ? `Tone: ${s.customTone}`
      : `Tone: ${TONE_DESC[s.tone] ?? TONE_DESC.friendly}`;

  const langLine =
    s.language === 'auto'
      ? 'Language: Reply in the SAME language as the most recent message you are replying to.'
      : `Language: Reply in ${s.language}.`;

  const lengthLine = `Length: ${LENGTH_DESC[s.length] ?? LENGTH_DESC.medium}`;

  const styleNote = s.customInstructions
    ? `\nUser style notes (always honor): ${s.customInstructions}`
    : '';

  const chatTypeLine = isGroup
    ? 'This is a GROUP chat. Address whichever member sent the most recent message you need to reply to. Understand the context of who is asking and answering.'
    : 'This is an INDIVIDUAL (1-to-1) chat. Understand the context of the questions and answers.';

  const transcriptText = formatTranscript(transcript, chatTitle, isGroup);
  const transcriptBlock = transcriptText
    ? `\n\nCONVERSATION SO FAR (oldest first, most recent last — text messages only; images, stickers, videos, voice notes and documents are omitted):
----
${transcriptText}
----`
    : `\n\nCONVERSATION SO FAR: no text messages yet — the recent messages were media only.`;

  const fromName = lastInbound
    ? lastInbound.sender?.trim() || (isGroup ? '' : chatTitle)
    : '';
  const targetBlock = lastInbound
    ? `\n\nMESSAGE YOU MUST REPLY TO (most recent inbound text):
${fromName ? `From ${fromName}: ` : ''}"${lastInbound.text}"

Your reply must directly address this exact message above. Use the earlier conversation only for context (style, prior topic, agreements made, etc.).`
    : `\n\nThere is no recent inbound text message to reply to (the latest messages were media only, or the chat is empty). Suggest a natural follow-up that moves things forward.`;

  // Blocks prepended in order: identity → chat-specific memory → voice rules → transcript → target.
  const blocks: string[] = [];

  if (aboutMe && aboutMe.trim()) {
    blocks.push(`WHO I AM (the user you are writing for — always honor):
----
${aboutMe.trim()}
You're writing the reply on behalf of this person.
----`);
  }

  if (memory && memory.trim()) {
    blocks.push(`MEMORY (notes the user wrote about this specific chat — treat as ground truth, more reliable than the live conversation):
----
${memory.trim()}
----`);
  }

  blocks.push(`You are writing a WhatsApp reply ON BEHALF OF the user.

Current chat name: ${chatTitle}. No need to mention the name unless it's needed — mostly it isn't.
${chatTypeLine}

VOICE
- ${toneLine}
- ${lengthLine}
- ${langLine}${styleNote}

RULES
- Read the FULL prior conversation as context — past topics, agreements, questions already answered, the user's writing style and emoji habits.
- If the most recent inbound contains a question, ANSWER that question directly.
- Match the formality, vocabulary, and emoji density the user has used in their own prior replies.
- Never invent facts you don't have. If a question requires info you don't know, ask ONE short clarifying question instead of guessing.
- Do NOT roleplay the other party. You write AS the user replying to the other party.
- Output ONLY the reply text — no quotes, no preamble like "Sure," / "Of course," / "Here is", no markdown, no explanations.${transcriptBlock}${targetBlock}`);

  return blocks.join('\n\n');
}
