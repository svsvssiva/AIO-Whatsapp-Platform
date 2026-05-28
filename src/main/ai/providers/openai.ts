export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AIError extends Error {
  code: 'auth' | 'rate' | 'network' | 'server' | 'unknown';
  constructor(code: AIError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export async function generate(
  apiKey: string,
  model: string,
  messages: OpenAIMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const { maxTokens = 400, temperature = 0.7, timeoutMs = 20000 } = opts;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        n: 1,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(t);
    if ((err as { name?: string }).name === 'AbortError') {
      throw new AIError('network', 'Request timed out.');
    }
    throw new AIError('network', `Network error: ${(err as Error).message}`);
  }
  clearTimeout(t);

  if (res.status === 401) throw new AIError('auth', 'API key rejected.');
  if (res.status === 429) throw new AIError('rate', 'Rate limit or quota exceeded.');
  if (res.status >= 500) throw new AIError('server', `OpenAI server error (${res.status}).`);
  if (!res.ok) {
    const t2 = await res.text().catch(() => '');
    throw new AIError('unknown', `HTTP ${res.status}: ${t2.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AIError('unknown', 'Empty response from OpenAI.');
  return text;
}

export async function ping(apiKey: string, model: string): Promise<void> {
  await generate(
    apiKey,
    model,
    [
      { role: 'system', content: 'Respond with the single word: ok' },
      { role: 'user', content: 'ping' },
    ],
    { maxTokens: 5, temperature: 0, timeoutMs: 10000 },
  );
}
