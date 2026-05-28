import { app, shell } from 'electron';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import type { ChatMemoryMeta } from '../../shared/types';

function rootDir(): string {
  return join(app.getPath('userData'), 'memory');
}

function accountDir(accountId: string): string {
  return join(rootDir(), accountId);
}

export function safeFilename(chatKey: string): string {
  // Replace anything filesystem-unfriendly with `-`, trim to 80, suffix short hash if it got mangled.
  const cleaned = chatKey
    .replace(/[\\/:*?"<>|\n\r\t]/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 80);
  // If cleaning changed it materially, add hash so we don't collide
  if (cleaned !== chatKey) {
    const h = createHash('sha1').update(chatKey).digest('hex').slice(0, 6);
    return `${cleaned}__${h}.md`;
  }
  return `${cleaned}.md`;
}

function filePathFor(accountId: string, chatKey: string): string {
  return join(accountDir(accountId), safeFilename(chatKey));
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

export function skeleton(chatKey: string): string {
  return `# ${chatKey}

> Auto-managed by GChat — edit freely. This file is the AI's ground-truth memory for this chat.

## About me in this chat


## Project / topic


## People


## Notes
`;
}

export async function getMemory(accountId: string, chatKey: string): Promise<string> {
  try {
    const buf = await fs.readFile(filePathFor(accountId, chatKey), 'utf8');
    return buf;
  } catch {
    return '';
  }
}

export async function hasMemory(accountId: string, chatKey: string): Promise<boolean> {
  try {
    const st = await fs.stat(filePathFor(accountId, chatKey));
    return st.size > 0;
  } catch {
    return false;
  }
}

export async function saveMemory(
  accountId: string,
  chatKey: string,
  content: string,
): Promise<{ path: string; bytes: number; updatedAt: number }> {
  await ensureDir(accountDir(accountId));
  const path = filePathFor(accountId, chatKey);
  await fs.writeFile(path, content, { encoding: 'utf8', mode: 0o644 });
  const st = await fs.stat(path);
  return { path, bytes: st.size, updatedAt: st.mtimeMs };
}

export async function createMemoryIfMissing(
  accountId: string,
  chatKey: string,
): Promise<string> {
  const existing = await getMemory(accountId, chatKey);
  if (existing) return existing;
  const content = skeleton(chatKey);
  await saveMemory(accountId, chatKey, content);
  return content;
}

export async function deleteMemory(accountId: string, chatKey: string): Promise<void> {
  try {
    await fs.rm(filePathFor(accountId, chatKey), { force: true });
  } catch {
    /* ignore */
  }
}

export async function appendUnderNotes(
  accountId: string,
  chatKey: string,
  bullets: string,
): Promise<string> {
  let content = await getMemory(accountId, chatKey);
  if (!content) content = skeleton(chatKey);
  const cleanBullets = bullets.trim();
  if (!cleanBullets) return content;

  if (/^## Notes\b/m.test(content)) {
    // append after the `## Notes` heading
    content = content.replace(/(^## Notes[^\n]*\n)/m, `$1${cleanBullets}\n`);
  } else {
    content = content.trimEnd() + `\n\n## Notes\n${cleanBullets}\n`;
  }
  await saveMemory(accountId, chatKey, content);
  return content;
}

export async function listForAccount(accountId: string): Promise<ChatMemoryMeta[]> {
  try {
    const dir = accountDir(accountId);
    const names = await fs.readdir(dir);
    const out: ChatMemoryMeta[] = [];
    for (const name of names) {
      if (!name.endsWith('.md')) continue;
      try {
        const full = join(dir, name);
        const st = await fs.stat(full);
        const buf = await fs.readFile(full, 'utf8');
        const firstLine = buf.split('\n').find((l) => l.startsWith('# ')) || name.replace(/\.md$/, '');
        const chatKey = firstLine.replace(/^#\s+/, '').trim() || name.replace(/\.md$/, '');
        const preview = buf
          .replace(/^#.*$/gm, '')
          .replace(/^>.*$/gm, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 140);
        out.push({
          accountId,
          chatKey,
          filename: name,
          bytes: st.size,
          updatedAt: st.mtimeMs,
          preview,
        });
      } catch {
        /* skip broken file */
      }
    }
    out.sort((a, b) => b.updatedAt - a.updatedAt);
    return out;
  } catch {
    return [];
  }
}

export async function listAll(allAccountIds: string[]): Promise<ChatMemoryMeta[]> {
  const lists = await Promise.all(allAccountIds.map(listForAccount));
  return lists.flat().sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function revealMemoryFolder(): Promise<void> {
  const dir = rootDir();
  await ensureDir(dir);
  shell.openPath(dir);
}

export async function openMemoryFile(accountId: string, chatKey: string): Promise<void> {
  const p = filePathFor(accountId, chatKey);
  try {
    await fs.access(p);
    shell.openPath(p);
  } catch {
    // doesn't exist; create skeleton first
    await createMemoryIfMissing(accountId, chatKey);
    shell.openPath(p);
  }
}
