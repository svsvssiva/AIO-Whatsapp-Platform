import { app, dialog, BrowserWindow, protocol, net } from 'electron';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { pathToFileURL } from 'url';
import { setAvatar, getAccounts } from './store';

const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function avatarsDir() {
  return join(app.getPath('userData'), 'avatars');
}

async function ensureDir() {
  await fs.mkdir(avatarsDir(), { recursive: true });
}

export async function pickAndSaveAvatar(win: BrowserWindow, accountId: string): Promise<boolean> {
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose account icon',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  });
  if (res.canceled || res.filePaths.length === 0) return false;

  const src = res.filePaths[0];
  const ext = extname(src).toLowerCase().replace('.', '');
  if (!ALLOWED.has('.' + ext)) {
    dialog.showErrorBox('Unsupported', 'Pick a PNG, JPG, WebP, or GIF.');
    return false;
  }

  await ensureDir();
  // remove any existing avatar files for this id (different extensions)
  for (const e of ['png', 'jpg', 'jpeg', 'webp', 'gif']) {
    await fs.rm(join(avatarsDir(), `${accountId}.${e}`), { force: true });
  }
  const dest = join(avatarsDir(), `${accountId}.${ext}`);
  await fs.copyFile(src, dest);
  setAvatar(accountId, ext);
  return true;
}

export async function resetAvatar(accountId: string) {
  for (const e of ['png', 'jpg', 'jpeg', 'webp', 'gif']) {
    await fs.rm(join(avatarsDir(), `${accountId}.${e}`), { force: true });
  }
  setAvatar(accountId, undefined);
}

export async function deleteAvatarFiles(accountId: string) {
  await resetAvatar(accountId);
}

export function registerAvatarProtocol() {
  // gchat-avatar://<accountId>
  protocol.handle('gchat-avatar', async (req) => {
    try {
      const url = new URL(req.url);
      const id = url.hostname || url.pathname.replace(/^\//, '');
      const acc = getAccounts().find((a) => a.id === id);
      if (!acc?.avatarExt) return new Response(null, { status: 404 });
      const file = join(avatarsDir(), `${id}.${acc.avatarExt}`);
      return net.fetch(pathToFileURL(file).toString());
    } catch {
      return new Response(null, { status: 500 });
    }
  });
}

// Register the custom scheme as privileged so it works inside the renderer
export function registerAvatarSchemePrivileged() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'gchat-avatar',
      privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, stream: true },
    },
  ]);
}
