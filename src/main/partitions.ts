import { session, app } from 'electron';
import { partitionFor, WA_USER_AGENT } from '../shared/types';
import { promises as fs } from 'fs';
import { join } from 'path';

export function configurePartition(accountId: string) {
  const ses = session.fromPartition(partitionFor(accountId));

  ses.setUserAgent(WA_USER_AGENT);

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
