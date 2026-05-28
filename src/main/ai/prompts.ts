import type { AISettings, ScrapedConversation, ScrapedMessage } from '../../shared/types';

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
  brief: '1 sentence, ~15 words max.',
  medium: '2 to 3 sentences.',
  detailed: 'A short paragraph (3 to 5 sentences).',
};

export interface SystemPromptOpts {
  settings: AISettings;
  chatTitle: string;
  isGroup: boolean;
  lastInbound: ScrapedMessage | null;
  aboutMe: string;
  memory: string;
}

export function buildSystemPrompt(opts: SystemPromptOpts): string {
  const { settings: s, chatTitle, isGroup, lastInbound, aboutMe, memory } = opts;

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

  const groupHint = isGroup
    ? '\nThis is a GROUP chat. Address whichever member sent the most recent message you need to reply to.'
    : '';

  const targetBlock = lastInbound
    ? `\n\nMESSAGE YOU MUST REPLY TO (most recent inbound):
${lastInbound.sender ? `From ${lastInbound.sender}: ` : ''}"${lastInbound.text}"

Your reply must directly address this exact message above. Use the earlier conversation only for context (style, prior topic, agreements made, etc.).`
    : `\n\nThere is no recent inbound message. The conversation either has only your past messages or is empty. Suggest a natural follow-up that moves things forward.`;

  // Blocks prepended in order: identity → chat-specific memory → voice rules → target.
  const blocks: string[] = [];

  if (aboutMe && aboutMe.trim()) {
    blocks.push(`WHO I AM (the user you are writing for — always honor):
----
${aboutMe.trim()}
----`);
  }

  if (memory && memory.trim()) {
    blocks.push(`MEMORY (notes the user wrote about this specific chat — treat as ground truth, more reliable than the live conversation):
----
${memory.trim()}
----`);
  }

  blocks.push(`You are writing a WhatsApp reply ON BEHALF OF the user.

Current chat: ${chatTitle}${groupHint}

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
- Output ONLY the reply text — no quotes, no preamble like "Sure," / "Of course," / "Here is", no markdown, no explanations.${targetBlock}`);

  return blocks.join('\n\n');
}
