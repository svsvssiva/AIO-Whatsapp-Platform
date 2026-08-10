import { ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';

// accountId arrives via additionalArguments set in main's will-attach-webview
const arg = process.argv.find((a) => a.startsWith('--gchat-account-id='));
const accountId = arg ? arg.substring('--gchat-account-id='.length) : '';

let lastReported = -1;

function parseTitleUnread(title: string): number {
  // Matches: "(3) WhatsApp", "WhatsApp (3)", "(3 new messages) WhatsApp", "(99+) WhatsApp"
  const m = title.match(/\((\d+)\+?(?:\s+new\s+message[s]?)?\)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function findRowAncestor(el: Element): Element | null {
  // Walk up looking for a chat-row-like container
  let cur: Element | null = el;
  for (let i = 0; cur && i < 12; i++) {
    if (cur.getAttribute('role') === 'listitem' || cur.getAttribute('role') === 'row') return cur;
    if (cur.hasAttribute('data-id')) return cur;
    cur = cur.parentElement;
  }
  return el.parentElement;
}

function isMutedRow(row: Element | null): boolean {
  if (!row) return false;
  if (row.querySelector('[data-icon="muted"]')) return true;
  if (row.querySelector('[data-icon*="muted" i]')) return true;
  const al = row.getAttribute('aria-label') || '';
  if (/\bmuted\b/i.test(al)) return true;
  return false;
}

function scanDomUnread(): number {
  let total = 0;
  const counted = new WeakSet<Element>(); // dedupe per row

  try {
    // Find every element whose aria-label contains "unread", regardless of role/structure.
    const candidates = document.querySelectorAll('[aria-label*="unread" i]');
    candidates.forEach((el) => {
      const al = (el.getAttribute('aria-label') || '').toLowerCase();
      const m = al.match(/(\d+)\s+unread/);
      if (!m) return;
      const n = parseInt(m[1], 10);
      if (!Number.isFinite(n) || n <= 0) return;

      const row = findRowAncestor(el) ?? el;
      if (counted.has(row)) return;
      if (isMutedRow(row)) return;
      counted.add(row);
      total += n;
    });
  } catch {
    /* ignore */
  }

  return total;
}

function report() {
  let count = scanDomUnread();
  if (count === 0) count = parseTitleUnread(document.title);
  if (count !== lastReported) {
    lastReported = count;
    if (accountId) ipcRenderer.send(IPC.UNREAD_REPORT, accountId, count);
    try {
      console.debug('[gchat] unread =', count, 'title=', JSON.stringify(document.title));
    } catch {
      /* ignore */
    }
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
(window as unknown as { __gchatScan?: () => number; __gchatTitleScan?: () => number }).__gchatScan = scanDomUnread;
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
        console.log('[gchat] DOM-based unread:', e.detail.dom);
        console.log('[gchat] Title-based unread:', e.detail.title);
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

  new MutationObserver(scheduleReport).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  setInterval(report, 6000);

  // Bridge debug call from main-world helper → run scanner in isolated world
  document.addEventListener('gchat:debug-request', () => {
    const dom = scanDomUnread();
    const title = parseTitleUnread(document.title);
    document.dispatchEvent(
      new CustomEvent('gchat:debug-response', {
        detail: { dom, title, reporting: dom || title, lastReported },
      }),
    );
  });

  // Forward notification clicks from page (main-world) to main process
  document.addEventListener('gchat:notification-click', (e: Event) => {
    const detail = (e as CustomEvent).detail as { accountId?: string } | undefined;
    const id = detail?.accountId || accountId;
    if (id) ipcRenderer.send(IPC.NOTIF_CLICKED, id);
  });

});

console.log('[gchat-wa] preload loaded; accountId =', accountId);
