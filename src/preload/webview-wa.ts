import { ipcRenderer } from 'electron';
import type { IPC } from '../shared/ipc';

// This runs inside a sandboxed <webview>. A sandboxed preload only gets a
// polyfilled `require` for Electron/Node built-ins, so it has to be a single
// file: a *runtime* import of '../shared/ipc' makes electron-vite emit a shared
// chunk that this file then require()s, which throws before line one — and the
// unread badge, the only feature that lives here, silently dies with it.
// So: type-only import, local literals, typed against the shared constants so
// a rename over there breaks the typecheck here instead of the app.
const UNREAD_REPORT: (typeof IPC)['UNREAD_REPORT'] = 'unread:report';
const CHAT_PINS_REQUEST_TOGGLE: (typeof IPC)['CHAT_PINS_REQUEST_TOGGLE'] = 'chat-pins:request-toggle';
const NOTIF_CLICKED: (typeof IPC)['NOTIF_CLICKED'] = 'notif:clicked';

// Best-effort only: main resolves the account from the sending webContents.
const arg = process.argv.find((a) => a.startsWith('--gchat-account-id='));
const accountId = arg ? arg.substring('--gchat-account-id='.length) : '';

let lastReported = -1;

// "(3) WhatsApp" — WhatsApp's own count of chats with unread messages. It is
// the most reliable source: the chat list is virtualised, so a DOM scan only
// ever sees the rows currently rendered.
function parseTitleUnread(title: string): number {
  const m = title.match(/\((\d+)\+?(?:\s+new\s+message[s]?)?\)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function findRowAncestor(el: Element): Element | null {
  let cur: Element | null = el;
  for (let i = 0; cur && i < 12; i++) {
    const role = cur.getAttribute('role');
    if (role === 'listitem' || role === 'row') return cur;
    if (cur.hasAttribute('data-id')) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function isMutedRow(row: Element): boolean {
  if (row.querySelector('[data-icon="muted"], [data-icon*="muted" i]')) return true;
  return /\bmuted\b/i.test(row.getAttribute('aria-label') || '');
}

// "3 unread messages" (count badge) or a bare "unread" (marked-as-unread dot);
// deliberately not "Mark as unread" or the "Unread" filter pill.
const UNREAD_LABEL = /\d+\s+unread\b|^\s*unread\b/i;

// Number of chats with something unread — what WhatsApp's "Unread" filter and
// its dock badge count — not the number of messages. Scoped to the chat list
// so the nav-bar badge and the filter pills can't leak in.
function scanUnreadChats(): number {
  const pane = document.getElementById('pane-side');
  if (!pane) return 0;
  const rows = new Set<Element>();
  try {
    pane.querySelectorAll('[aria-label*="unread" i]').forEach((el) => {
      if (!UNREAD_LABEL.test(el.getAttribute('aria-label') || '')) return;
      const row = findRowAncestor(el);
      if (row) {
        if (!isMutedRow(row)) rows.add(row);
      } else {
        rows.add(el);
      }
    });
  } catch {
    /* ignore */
  }
  return rows.size;
}

function currentUnread(): number {
  // The title wins whenever WhatsApp provides it; the DOM scan is there for
  // the day the title format changes.
  return Math.max(parseTitleUnread(document.title), scanUnreadChats());
}

function report() {
  const count = currentUnread();
  if (count === lastReported) return;
  lastReported = count;
  ipcRenderer.send(UNREAD_REPORT, accountId, count);
  try {
    console.debug('[gchat] unread chats =', count, 'title=', JSON.stringify(document.title));
  } catch {
    /* ignore */
  }
}

let pendingTimer: number | undefined;
function scheduleReport() {
  if (pendingTimer) return;
  pendingTimer = window.setTimeout(() => {
    pendingTimer = undefined;
    report();
  }, 800);
}

// Expose scanner functions on the isolated-world window so the main-world
// shim (injected by main process) can call them via DOM event bridge.
(window as unknown as { __gchatScan?: () => number; __gchatTitleScan?: () => number }).__gchatScan = scanUnreadChats;
(window as unknown as { __gchatScan?: () => number; __gchatTitleScan?: () => number }).__gchatTitleScan = () =>
  parseTitleUnread(document.title);

function installMainWorldHelper() {
  // The preload runs in the isolated world. To expose __gchatDebugUnread() on
  // the page's main-world `window` (so it's callable from the default DevTools
  // console context), inject a <script> tag. <script> contents always execute
  // in the main world regardless of contextIsolation.
  try {
    if (document.getElementById('__gchat-helper-script')) return;
    const s = document.createElement('script');
    s.id = '__gchat-helper-script';
    s.textContent = `
(function(){
  if (window.__gchatDebugInstalled) return;
  window.__gchatDebugInstalled = true;
  window.__gchatDebugUnread = function(){
    return new Promise(function(resolve){
      var done = false;
      function handler(e){
        if (done) return;
        done = true;
        document.removeEventListener('gchat:debug-response', handler);
        console.log('[gchat] DOM-based unread chats:', e.detail.dom);
        console.log('[gchat] Title-based unread chats:', e.detail.title);
        console.log('[gchat] Last reported:', e.detail.lastReported);
        console.log('[gchat] Effective:', e.detail.reporting);
        resolve(e.detail);
      }
      document.addEventListener('gchat:debug-response', handler);
      document.dispatchEvent(new CustomEvent('gchat:debug-request'));
      setTimeout(function(){ if(!done){done=true;resolve(null);} }, 1500);
    });
  };
  console.log('%c[gchat] debug helper ready — call __gchatDebugUnread()', 'color:#0A84FF;font-weight:bold');
})();
`;
    (document.head || document.documentElement).appendChild(s);
  } catch {
    /* ignore */
  }
}

window.addEventListener('DOMContentLoaded', () => {
  installMainWorldHelper();
  report();

  const titleEl = document.querySelector('title');
  if (titleEl) {
    new MutationObserver(scheduleReport).observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  // Only the chat list can change the unread count. Observing all of <body>
  // with characterData:true made Blink allocate a mutation record for every
  // timestamp tick, typing indicator and presence change in the open
  // conversation — continuously, in every account.
  let paneObserved: Element | null = null;
  const attachPaneObserver = () => {
    const pane = document.getElementById('pane-side');
    if (!pane || pane === paneObserved) return;
    paneObserved = pane;
    new MutationObserver(scheduleReport).observe(pane, { childList: true, subtree: true });
    scheduleReport();
  };
  attachPaneObserver();

  // #pane-side is absent on the QR screen and rebuilt on logout/login.
  setInterval(attachPaneObserver, 10_000);

  // Safety net for anything the observers miss. The title observer above is
  // the primary signal and fires immediately.
  setInterval(report, 30_000);

  // Chat pin clicks are pushed from the main-world tweak script.
  document.addEventListener('gchat:pin-toggle', (e) => {
    const key = (e as CustomEvent<{ key?: string }>).detail?.key;
    if (key) ipcRenderer.send(CHAT_PINS_REQUEST_TOGGLE, accountId, key);
  });

  // Bridge debug call from main-world helper → run scanner in isolated world
  document.addEventListener('gchat:debug-request', () => {
    const dom = scanUnreadChats();
    const title = parseTitleUnread(document.title);
    document.dispatchEvent(
      new CustomEvent('gchat:debug-response', {
        detail: { dom, title, reporting: Math.max(dom, title), lastReported },
      }),
    );
  });

  // Forward notification clicks from page (main-world) to main process
  document.addEventListener('gchat:notification-click', (e: Event) => {
    const detail = (e as CustomEvent).detail as { accountId?: string } | undefined;
    ipcRenderer.send(NOTIF_CLICKED, detail?.accountId || accountId);
  });
});

console.log('[gchat-wa] preload loaded; accountId =', accountId);
