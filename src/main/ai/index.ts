import type { AISettings, RephraseVariant } from '../../shared/types';
import { AIError, generate as openaiGenerate, ping as openaiPing } from './providers/openai';
import { loadKey } from './keys';

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

// The three rewrite angles, strongest-fidelity first. Every one of them must
// keep the user's meaning, language and register — this is a grammar fixer, not
// a tone changer.
const VARIANT_SPECS = [
  {
    label: 'Minimal fix',
    brief:
      'Correct only what is actually wrong (grammar, spelling, word order, articles, tense). Change as few words as possible — if the draft is already correct, return it essentially unchanged.',
  },
  {
    label: 'Smoother',
    brief:
      'Same tone and length, but phrased the way a fluent speaker would naturally say it. Fix awkward constructions.',
  },
  {
    label: 'Clearer',
    brief:
      'Same tone, tightened so the point is unmistakable. You may reorder the sentence, but do not add or drop information.',
  },
];

function buildPrompt(count: number): string {
  const specs = VARIANT_SPECS.slice(0, Math.max(1, Math.min(count, VARIANT_SPECS.length)));
  const list = specs.map((v, i) => `${i + 1}. "${v.label}" — ${v.brief}`).join('\n');

  return `You are a writing assistant that fixes the language of short chat messages before they are sent.

You will be given ONE draft message. Rewrite it ${specs.length} different ways.

HARD RULES — these override everything else:
- Preserve the meaning exactly. Never add facts, names, numbers, dates, prices, promises or commitments that are not already in the draft. Never remove any.
- Write in the SAME language the draft is written in. If it is romanised Tamil, Malay, Tanglish or a mix, keep that same language and mix — do not translate it into English.
- Preserve the writer's register. Casual stays casual. Do NOT make it corporate or formal, and do NOT add greetings, sign-offs, or pleasantries that were not there.
- Keep any emoji the writer used, in a natural position.
- Do NOT answer, continue or reply to the message. You are only rewriting the draft itself.
- If the draft is a question, the rewrite stays a question.

Produce exactly these variants, in this order:
${list}

Respond with JSON only, in this shape:
{"variants":[{"label":"<label>","text":"<rewritten message>"}]}`;
}

// Exported for unit testing.
export function coerceVariants(raw: string, count: number): RephraseVariant[] {
  const out: RephraseVariant[] = [];
  try {
    // Tolerate a fenced ```json block even though we ask for raw JSON.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned) as { variants?: Array<{ label?: string; text?: string }> };
    for (const v of parsed.variants ?? []) {
      const text = (v.text ?? '').trim();
      if (!text) continue;
      out.push({ label: (v.label ?? '').trim() || VARIANT_SPECS[out.length]?.label || 'Option', text });
    }
  } catch {
    /* fall through to the line-based fallback below */
  }

  if (out.length === 0) {
    // Model ignored the JSON contract — salvage non-empty lines so the user
    // still gets something usable rather than an error.
    const lines = raw
      .split('\n')
      .map((l) => l.replace(/^\s*(?:[-*\d.)]+\s*)?/, '').trim())
      .filter((l) => l.length > 0 && !/^\{|^\}|^"variants"/.test(l));
    lines.slice(0, count).forEach((text, i) => {
      out.push({ label: VARIANT_SPECS[i]?.label || `Option ${i + 1}`, text });
    });
  }

  // Drop duplicates — the model often returns the same text when the draft is
  // already correct, and three identical buttons is just noise.
  const seen = new Set<string>();
  return out.filter((v) => {
    const k = v.text.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Rephrase a single draft message. The `draft` is text the user typed into the
 * compose box — no conversation history, contacts or chat content is involved.
 */
export async function rephrase(settings: AISettings, draft: string): Promise<RephraseVariant[]> {
  const key = await loadKey();
  if (!key) throw new AIError('auth', 'No API key configured.');

  const text = draft.trim();
  if (!text) throw new AIError('unknown', 'Nothing to rephrase — the message box is empty.');
  if (text.length > 2000) throw new AIError('unknown', 'That message is too long to rephrase (2000 character limit).');

  const count = Math.max(1, Math.min(settings.variantCount || 3, VARIANT_SPECS.length));

  const raw = await openaiGenerate(
    key,
    settings.model,
    [
      { role: 'system', content: buildPrompt(count) },
      { role: 'user', content: text },
    ],
    {
      // Room for N rewrites of a chat-length message plus JSON scaffolding.
      maxTokens: Math.min(1200, 220 * count + 200),
      temperature: 0.4,
      jsonMode: true,
    },
  );

  const variants = coerceVariants(raw, count);
  if (variants.length === 0) throw new AIError('unknown', 'Could not read a rewrite from the model. Try again.');
  return variants.slice(0, count);
}
