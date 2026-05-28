import { app, session } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { partitionFor, AccountStorageInfo } from '../shared/types';
import { getAccounts, getSettings, markAccountCleaned } from './store';

function partitionDir(accountId: string): string {
  return join(app.getPath('userData'), 'Partitions', `persist%3Awa-${accountId}`);
}

async function dirSize(p: string): Promise<number> {
  let total = 0;
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    await Promise.all(
      entries.map(async (e) => {
        const full = join(p, e.name);
        if (e.isDirectory()) total += await dirSize(full);
        else {
          try {
            const st = await fs.stat(full);
            total += st.size;
          } catch {
            /* ignore */
          }
        }
      }),
    );
  } catch {
    /* missing dir */
  }
  return total;
}

export async function getAllStorageInfo(): Promise<AccountStorageInfo[]> {
  const accs = getAccounts();
  const settings = getSettings();
  const out: AccountStorageInfo[] = [];
  for (const a of accs) {
    const bytes = await dirSize(partitionDir(a.id));
    out.push({
      accountId: a.id,
      bytes,
      lastCleanedAt: settings.perAccountLastCleanAt[a.id] ?? 0,
    });
  }
  return out;
}

export async function clearCache(accountId: string): Promise<void> {
  const ses = session.fromPartition(partitionFor(accountId));
  await ses.clearCache();
  // also clear non-auth caches that bloat: shaders, GPU, code caches via storage:
  await ses.clearStorageData({
    storages: ['shadercache', 'serviceworkers', 'cachestorage'],
  });
  markAccountCleaned(accountId);
}

export async function clearAllData(accountId: string): Promise<void> {
  const ses = session.fromPartition(partitionFor(accountId));
  await ses.clearStorageData();
  await ses.clearCache();
  markAccountCleaned(accountId);
}

export async function runAutoCleanIfDue(): Promise<{ cleaned: string[] }> {
  const s = getSettings();
  if (!s.autoCleanEnabled) return { cleaned: [] };

  const now = Date.now();
  const ageMs = s.autoCleanMaxAgeDays * 24 * 60 * 60 * 1000;
  const cleaned: string[] = [];
  const info = await getAllStorageInfo();
  for (const i of info) {
    const overSize = i.bytes > s.autoCleanMaxBytes;
    const lastClean = i.lastCleanedAt || 0;
    const overAge = lastClean > 0 && now - lastClean > ageMs;
    const neverCleanedAndOld = lastClean === 0 && i.bytes > s.autoCleanMaxBytes / 2;
    if (overSize || overAge || neverCleanedAndOld) {
      try {
        await clearCache(i.accountId);
        cleaned.push(i.accountId);
      } catch {
        /* ignore */
      }
    }
  }
  return { cleaned };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
