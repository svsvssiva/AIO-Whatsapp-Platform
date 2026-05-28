import { app, Menu, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc';
import { getAccounts } from './store';

export function rebuildDockMenu(win: BrowserWindow, unreadByAccount: Map<string, number>) {
  if (!app.dock) return;
  const accounts = getAccounts();
  const template = accounts.map((a) => {
    const unread = unreadByAccount.get(a.id) ?? 0;
    return {
      label: unread > 0 ? `${a.label}  •  ${unread}` : a.label,
      click: () => {
        if (!win.isVisible()) win.show();
        win.focus();
        win.webContents.send(IPC.MENU_SWITCH_ACCOUNT, a.id);
      },
    };
  });
  app.dock.setMenu(Menu.buildFromTemplate(template.length ? template : [{ label: 'No accounts', enabled: false }]));
}
