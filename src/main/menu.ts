import { app, Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { IPC } from '../shared/ipc';
import { getAccounts } from './store';

export function buildAppMenu(win: BrowserWindow) {
  const accounts = getAccounts();

  const switchItems: MenuItemConstructorOptions[] = accounts.slice(0, 9).map((a, i) => ({
    label: a.label,
    accelerator: `Cmd+${i + 1}`,
    click: () => win.webContents.send(IPC.MENU_SWITCH_ACCOUNT, a.id),
  }));

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'Cmd+,',
          click: () => win.webContents.send(IPC.MENU_OPEN_SETTINGS),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', accelerator: 'Cmd+Q' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Add Account',
          accelerator: 'Cmd+N',
          click: () => win.webContents.send(IPC.MENU_ADD_ACCOUNT),
        },
        {
          label: 'Reload Active Account',
          accelerator: 'Cmd+R',
          click: () => win.webContents.send(IPC.MENU_RELOAD_ACTIVE),
        },
        {
          label: 'Quick Switch',
          accelerator: 'Cmd+K',
          click: () => win.webContents.send(IPC.MENU_QUICK_SWITCH),
        },
        { type: 'separator' },
        { label: 'Close Window', accelerator: 'Cmd+W', click: () => win.hide() },
      ],
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools', label: 'Toggle Shell DevTools' },
        {
          label: 'Inspect Active Account',
          accelerator: 'Cmd+Alt+I',
          click: () => win.webContents.send(IPC.MENU_INSPECT_ACTIVE),
        },
      ],
    },
    {
      label: 'Accounts',
      submenu: switchItems.length > 0
        ? switchItems
        : [{ label: 'No accounts yet', enabled: false }],
    },
    { label: 'Window', role: 'windowMenu' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
