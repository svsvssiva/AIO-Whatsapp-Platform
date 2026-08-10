export const IPC = {
  ACCOUNTS_LIST: 'accounts:list',
  ACCOUNTS_ADD: 'accounts:add',
  ACCOUNTS_REMOVE: 'accounts:remove',
  ACCOUNTS_RENAME: 'accounts:rename',
  ACCOUNTS_RECOLOR: 'accounts:recolor',
  ACCOUNTS_CLEAR_CACHE: 'accounts:clear-cache',
  ACCOUNTS_LOGOUT: 'accounts:logout',
  ACCOUNTS_RELOAD: 'accounts:reload',

  UNREAD_REPORT: 'unread:report',
  UNREAD_UPDATED: 'unread:updated',

  TILE_MENU: 'tile:menu',

  THEME_GET: 'theme:get',
  THEME_CHANGED: 'theme:changed',

  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_HIDE: 'window:hide',

  MENU_ADD_ACCOUNT: 'menu:add-account',
  MENU_SWITCH_ACCOUNT: 'menu:switch-account',
  MENU_RELOAD_ACTIVE: 'menu:reload-active',
  MENU_QUICK_SWITCH: 'menu:quick-switch',
  MENU_OPEN_SETTINGS: 'menu:open-settings',

  AVATAR_PICK: 'avatar:pick',
  AVATAR_RESET: 'avatar:reset',
  TILE_CHANGE_ICON: 'tile:change-icon',
  TILE_RESET_ICON: 'tile:reset-icon',

  STORAGE_GET_ALL: 'storage:get-all',
  STORAGE_CLEAR_CACHE: 'storage:clear-cache',
  STORAGE_CLEAR_ALL: 'storage:clear-all',

  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  NOTIF_SET_PREFS: 'notif:set-prefs',
  NOTIF_CLICKED: 'notif:clicked',

  WEBVIEW_REGISTER: 'webview:register',
  MENU_INSPECT_ACTIVE: 'menu:inspect-active',
  INSPECT_WEBVIEW: 'inspect:webview',

  PILLS_LIST: 'pills:list',
  PILLS_SET_PREFS: 'pills:set-prefs',
  PILLS_GET_PREFS: 'pills:get-prefs',

  CHAT_PINS_GET: 'chat-pins:get',
  CHAT_PINS_TOGGLE: 'chat-pins:toggle',
  CHAT_PINS_REQUEST_TOGGLE: 'chat-pins:request-toggle',

  UPDATE_STATUS: 'update:status',
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_GET_VERSION: 'update:get-version',
} as const;
