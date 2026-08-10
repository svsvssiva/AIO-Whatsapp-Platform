import { session, app } from 'electron';
import { partitionFor, WA_USER_AGENT } from '../shared/types';
import { promises as fs } from 'fs';
import { join } from 'path';

export function configurePartition(accountId: string) {
  const ses = session.fromPartition(partitionFor(accountId));

  ses.setUserAgent(WA_USER_AGENT);

  // Spell checking for the WhatsApp composer. On macOS this delegates to the
  // system spell checker, which auto-detects language and uses the user's own
  // learned words — so we must NOT call setSpellCheckerLanguages there (it is
  // unsupported on darwin and throws).
  try {
    ses.spellCheckerEnabled = true;
  } catch {
    /* older Electron without the property — spellcheck webPreference still applies */
  }

  ses.setPermissionRequestHandler((_wc, permission, cb) => {
    const allow = new Set(['notifications', 'media', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen']);
    cb(allow.has(permission));
  });

  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    details.requestHeaders['User-Agent'] = WA_USER_AGENT;
    cb({ requestHeaders: details.requestHeaders });
  });
}

export async function clearPartitionStorage(accountId: string) {
  const ses = session.fromPartition(partitionFor(accountId));
  await ses.clearStorageData();
  await ses.clearCache();
}

export async function clearPartitionCache(accountId: string) {
  const ses = session.fromPartition(partitionFor(accountId));
  await ses.clearCache();
}

export async function deletePartitionFolder(accountId: string) {
  try {
    const root = join(app.getPath('userData'), 'Partitions', `persist%3Awa-${accountId}`);
    await fs.rm(root, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
