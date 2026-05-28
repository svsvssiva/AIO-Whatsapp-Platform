import { Menu, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc';
import { ACCOUNT_COLORS, COLOR_NAMES } from '../shared/types';
import { getAccounts } from './store';

export function showTileMenu(win: BrowserWindow, accountId: string) {
  const send = (channel: string, ...args: unknown[]) => win.webContents.send(channel, accountId, ...args);
  const current = getAccounts().find((a) => a.id === accountId);

  const colorSubmenu = ACCOUNT_COLORS.map((c) => ({
    label: COLOR_NAMES[c] ?? c,
    type: 'checkbox' as const,
    checked: current?.color === c,
    click: () => win.webContents.send(IPC.ACCOUNTS_RECOLOR, accountId, c),
  }));

  const menu = Menu.buildFromTemplate([
    { label: 'Rename…', click: () => send('tile:rename-prompt') },
    { label: 'Change Icon…', click: () => win.webContents.send(IPC.TILE_CHANGE_ICON, accountId) },
    { label: 'Reset Icon', click: () => win.webContents.send(IPC.TILE_RESET_ICON, accountId) },
    { label: 'Change Color', submenu: colorSubmenu },
    { type: 'separator' },
    { label: 'Reload', click: () => win.webContents.send(IPC.ACCOUNTS_RELOAD, accountId) },
    { label: 'Clear Cache', click: () => win.webContents.send(IPC.ACCOUNTS_CLEAR_CACHE, accountId) },
    { label: 'Log Out (clear session)', click: () => win.webContents.send(IPC.ACCOUNTS_LOGOUT, accountId) },
    { type: 'separator' },
    { label: 'Remove Account', click: () => win.webContents.send(IPC.ACCOUNTS_REMOVE, accountId) },
  ]);
  menu.popup({ window: win });
}
