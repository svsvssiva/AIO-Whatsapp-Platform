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

// ---------- AI: conversation scrape ----------

interface ScrapedMsg {
  direction: 'in' | 'out';
  text: string;
  sender?: string;
  ts?: string;
}

function getChatTitle(): { title: string; isGroup: boolean } {
  // Header is at top of main pane
  // Selectors fall back across builds:
  const headerNameEl =
    document.querySelector('header [data-testid="conversation-info-header-chat-title"]') ||
    document.querySelector('header span[dir="auto"][title]') ||
    document.querySelector('header span[title]') ||
    document.querySelector('#main header span[dir="auto"]');
  const title = (headerNameEl?.getAttribute('title') || headerNameEl?.textContent || '').trim();

  // Group detection: presence of "click here for group info" or aria-label hint
  let isGroup = false;
  const sub = document.querySelector('header [aria-label]')?.getAttribute('aria-label') || '';
  if (/group/i.test(sub)) isGroup = true;
  // Heuristic: if any message bubble has a sender name span, it's likely group
  if (!isGroup && document.querySelector('div.copyable-text [data-pre-plain-text]')) {
    const pre = document.querySelector('div.copyable-text')?.getAttribute('data-pre-plain-text') ?? '';
    // data-pre-plain-text in groups looks like "[10:00, 5/22/2026] John Doe: "
    if (/]\s*[^:]+:\s*$/.test(pre)) isGroup = true;
  }

  return { title: title || 'this chat', isGroup };
}

function parseMessageBubble(bubble: Element): ScrapedMsg | null {
  // direction
  const inOut = bubble.closest('.message-in, .message-out');
  let direction: 'in' | 'out' = 'in';
  if (inOut?.classList.contains('message-out')) direction = 'out';
  else if (inOut?.classList.contains('message-in')) direction = 'in';
  else {
    // fallback: look up tree for known direction attribute
    let cur: Element | null = bubble;
    while (cur && cur !== document.body) {
      if (cur.classList?.contains('message-out')) {
        direction = 'out';
        break;
      }
      if (cur.classList?.contains('message-in')) {
        direction = 'in';
        break;
      }
      cur = cur.parentElement;
    }
  }

  // text — `.copyable-text` carries data-pre-plain-text with metadata, and the
  // inner `.selectable-text` span holds the message body.
  const textNode =
    bubble.querySelector('.selectable-text.copyable-text') ||
    bubble.querySelector('span.selectable-text') ||
    bubble.querySelector('[data-lexical-text="true"]');
  let text = (textNode?.textContent || '').trim();

  // Media placeholders if no text
  if (!text) {
    if (bubble.querySelector('[data-icon="media-play"], [data-icon="audio-play"]')) text = '[voice note]';
    else if (bubble.querySelector('img[src^="blob:"], img[src^="data:"]')) text = '[image]';
    else if (bubble.querySelector('[data-icon="document"]')) text = '[document]';
    else if (bubble.querySelector('video')) text = '[video]';
    else if (bubble.querySelector('[data-icon="sticker"]')) text = '[sticker]';
    else return null;
  }

  // Metadata: timestamp + sender from data-pre-plain-text
  let sender: string | undefined;
  let ts: string | undefined;
  const pre = bubble.getAttribute('data-pre-plain-text') || '';
  if (pre) {
    // Format: "[10:00 PM, 5/22/2026] John Doe: "
    const m = pre.match(/^\[([^\]]+)\]\s*([^:]+):\s*$/);
    if (m) {
      ts = m[1].trim();
      sender = m[2].trim();
    }
  }

  return { direction, text, sender, ts };
}

function scrapeConversation(maxMessages = 50): {
  chatTitle: string;
  isGroup: boolean;
  messages: ScrapedMsg[];
} {
  const { title, isGroup } = getChatTitle();
  const messages: ScrapedMsg[] = [];

  // Bubbles each contain a .copyable-text wrapper. Walk in DOM order to preserve time order.
  const bubbles = Array.from(document.querySelectorAll('div.copyable-text'));
  for (const b of bubbles) {
    const msg = parseMessageBubble(b);
    if (msg && msg.text) messages.push(msg);
  }

  // Truncate from end (most recent)
  const recent = messages.slice(-maxMessages);
  return { chatTitle: title, isGroup, messages: recent };
}

// ---------- AI: type into compose ----------

function typeIntoCompose(text: string): boolean {
  // Footer compose box is contenteditable. Try several selectors across builds.
  const compose =
    (document.querySelector('footer div[contenteditable="true"][role="textbox"]') as HTMLElement | null) ||
    (document.querySelector('footer div[contenteditable="true"]') as HTMLElement | null) ||
    (document.querySelector('[data-testid="conversation-compose-box-input"]') as HTMLElement | null) ||
    (document.querySelector('div[role="textbox"][contenteditable="true"]') as HTMLElement | null);

  if (!compose) return false;

  compose.focus();
  // Place caret at end
  try {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(compose);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  } catch {
    /* ignore */
  }

  // Use clipboard paste simulation — most reliable across Lexical (WA's editor):
  // 1) try execCommand insertText (fires beforeinput/input events the editor listens to)
  try {
    const ok = document.execCommand('insertText', false, text);
    if (ok) return true;
  } catch {
    /* fallthrough */
  }

  // 2) Synthesize InputEvent with inputType=insertText
  try {
    const ev = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    });
    compose.dispatchEvent(ev);
    // also dispatch input
    compose.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

// Expose scrapers / inserters on isolated-world window — main-world bridge
// (installed by installMainWorldHelper) calls them via CustomEvent.
(window as unknown as { __gchatScrape?: () => unknown }).__gchatScrape = () => scrapeConversation();
(window as unknown as { __gchatType?: (t: string) => boolean }).__gchatType = (t) => typeIntoCompose(t);

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

  // AI bridge via DOM CustomEvents (works across isolated/main worlds).
  // main-world script injected by main process dispatches 'gchat:ai-scrape-request',
  // we (isolated world) compute and dispatch 'gchat:ai-scrape-response'.
  document.addEventListener('gchat:ai-scrape-request', () => {
    try {
      const data = scrapeConversation();
      console.log('[gchat-wa] ai scrape via event:', data.messages.length, 'messages');
      document.dispatchEvent(
        new CustomEvent('gchat:ai-scrape-response', { detail: { ok: true, data } }),
      );
    } catch (err) {
      document.dispatchEvent(
        new CustomEvent('gchat:ai-scrape-response', {
          detail: { ok: false, error: (err as Error).message },
        }),
      );
    }
  });

  document.addEventListener('gchat:ai-type-request', (e: Event) => {
    const detail = (e as CustomEvent).detail as { text?: string };
    if (!detail?.text) return;
    try {
      const ok = typeIntoCompose(detail.text);
      document.dispatchEvent(
        new CustomEvent('gchat:ai-type-response', { detail: { ok } }),
      );
    } catch (err) {
      document.dispatchEvent(
        new CustomEvent('gchat:ai-type-response', {
          detail: { ok: false, error: (err as Error).message },
        }),
      );
    }
  });
});

// ---------- AI IPC handlers (from main) ----------

console.log('[gchat-wa] preload loaded; AI handlers ready, accountId =', accountId);
// Heartbeat to main so we can confirm IPC routing works post-load
ipcRenderer.send('ai:preload-loaded', accountId, Date.now());

ipcRenderer.on('ai:scrape-request', (_e, replyChannel: string) => {
  console.log('[gchat-wa] ai:scrape-request received, replyChannel =', replyChannel);
  try {
    const data = scrapeConversation();
    console.log('[gchat-wa] scraped', data.messages.length, 'messages for', data.chatTitle);
    ipcRenderer.send(replyChannel, { ok: true, data });
  } catch (err) {
    console.error('[gchat-wa] scrape failed:', err);
    ipcRenderer.send(replyChannel, { ok: false, error: (err as Error).message });
  }
});

ipcRenderer.on(IPC.AI_INSERT_TEXT, (_e, text: string) => {
  console.log('[gchat-wa] ai:insert-text received, len =', text.length);
  try {
    const ok = typeIntoCompose(text);
    if (!ok) console.warn('[gchat-wa] typeIntoCompose returned false (compose box not found)');
  } catch (err) {
    console.error('[gchat-wa] insert failed:', err);
  }
});
