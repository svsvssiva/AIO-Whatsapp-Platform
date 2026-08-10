import type { WebContents } from 'electron';
import type { PillPrefs } from '../shared/types';

interface InjectOpts {
  prefs: PillPrefs; // unused now, kept for API stability
  chatPins: string[];
  accountId: string;
}

// Injected into the WhatsApp page (main world):
//  - chat pin overlay + reorder (WhatsApp caps its own pins at 3)
//  - forces spellcheck="true" on the composer, which WhatsApp ships disabled
export function injectWaTweaks(wc: WebContents, opts: InjectOpts) {
  const pins = JSON.stringify(opts.chatPins || []);
  const accountId = JSON.stringify(opts.accountId || '');

  const script = `
(function() {
  window.__gchatChatPins = ${pins};
  window.__gchatAccountId = ${accountId};

  if (window.__gchatWaTweaksInstalled) {
    if (typeof window.__gchatRetweak === 'function') window.__gchatRetweak();
    return 'retweak-applied';
  }
  window.__gchatWaTweaksInstalled = true;

  // -------- CSS --------
  var style = document.createElement('style');
  style.id = '__gchat-wa-tweaks';
  style.textContent = [
    '.__gchat-pin-btn {',
    '  position:absolute;',
    '  top:8px; right:10px;',
    '  width:22px; height:22px;',
    '  border-radius:50%;',
    '  display:flex !important;',
    '  align-items:center;',
    '  justify-content:center;',
    '  background:rgba(11,20,26,0.7);',
    '  color:rgba(233,237,239,0.7);',
    '  cursor:pointer;',
    '  z-index:20;',
    '  border:1px solid rgba(255,255,255,0.08);',
    '  backdrop-filter:blur(6px);',
    '  -webkit-backdrop-filter:blur(6px);',
    '  padding:0;',
    '  opacity:0;',
    '  transition:opacity 140ms, background 140ms, color 140ms, transform 80ms;',
    '}',
    '[role="listitem"]:hover .__gchat-pin-btn,',
    '[role="row"]:hover .__gchat-pin-btn { opacity:0.75 !important; }',
    '.__gchat-pin-btn:hover { opacity:1 !important; background:rgba(0,168,132,0.25); color:#00d8a0; }',
    '.__gchat-pin-btn:active { transform:scale(0.92); }',
    '.__gchat-pin-btn svg { width:11px; height:11px; }',
    '.__gchat-pin-btn.pinned {',
    '  opacity:1 !important;',
    '  background:#00a884;',
    '  color:#fff;',
    '  border-color:transparent;',
    '}',
    '.__gchat-pin-btn.pinned:hover { background:#1da183; }',
  ].join('\\n');
  (document.head || document.documentElement).appendChild(style);

  var PIN_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 9V4l1.5-1.5a1 1 0 0 0-.71-1.71h-9.58a1 1 0 0 0-.71 1.71L8 4v5l-2 2v2h5.2v6l1 1 1-1v-6H18v-2l-2-2z"/></svg>';

  // WhatsApp ships its composer with spellcheck disabled, which suppresses the
  // macOS spell checker entirely. Force it on — and keep forcing it, because WA
  // re-renders the box (on chat switch, after sending, etc).
  function forceSpellcheck() {
    var boxes = document.querySelectorAll('div[contenteditable="true"]');
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].getAttribute('spellcheck') !== 'true') boxes[i].setAttribute('spellcheck', 'true');
    }
  }

  // ================= chat pins =================
  function chatRowKey(row) {
    var titleEl = row.querySelector('span[title]');
    if (titleEl) {
      var t = (titleEl.getAttribute('title') || titleEl.textContent || '').trim();
      if (t) return t;
    }
    var firstText = row.querySelector('span[dir="auto"]');
    if (firstText) return (firstText.textContent || '').trim();
    return '';
  }

  function getChatList() {
    var pane = document.getElementById('pane-side');
    if (!pane) return null;
    return pane.querySelector('[role="grid"]') ||
           pane.querySelector('[role="list"]') ||
           pane.querySelector('[aria-label*="Chat list" i]') ||
           pane;
  }

  function ensurePinButton(row, key, isPinned) {
    var existing = row.querySelector('.__gchat-pin-btn');
    if (existing) {
      existing.classList.toggle('pinned', isPinned);
      existing.title = isPinned ? 'Unpin from GChat' : 'Pin in GChat';
      existing.setAttribute('data-gchat-key', key);
      return;
    }
    var cs = window.getComputedStyle(row);
    if (cs.position === 'static') row.style.position = 'relative';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = '__gchat-pin-btn' + (isPinned ? ' pinned' : '');
    btn.setAttribute('aria-label', isPinned ? 'Unpin from GChat' : 'Pin in GChat');
    btn.setAttribute('data-gchat-key', key);
    btn.title = isPinned ? 'Unpin from GChat' : 'Pin in GChat';
    btn.innerHTML = PIN_SVG;
    btn.addEventListener('mousedown', function(e) { e.preventDefault(); e.stopPropagation(); }, true);
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.__gchatPendingPinToggle = key;
    }, true);
    row.appendChild(btn);
  }

  function processChatList() {
    var list = getChatList();
    if (!list) return;
    var rows = list.querySelectorAll('[role="listitem"], [role="row"]');
    if (rows.length === 0) return;

    var pins = window.__gchatChatPins || [];
    var pinSet = {};
    var pinOrder = {};
    pins.forEach(function(p, idx) { pinSet[p] = true; pinOrder[p] = idx; });

    var pinned = [];
    var rest = [];

    Array.prototype.forEach.call(rows, function(r) {
      var key = chatRowKey(r);
      if (key) ensurePinButton(r, key, !!pinSet[key]);
      if (key && pinSet[key]) pinned.push({ r: r, idx: pinOrder[key] });
      else rest.push(r);
    });

    if (pinned.length === 0) return;
    pinned.sort(function(a, b) { return a.idx - b.idx; });

    var parent = rows[0].parentElement;
    if (!parent) return;

    var desired = [];
    pinned.forEach(function(p) { desired.push(p.r); });
    rest.forEach(function(r) { desired.push(r); });

    var needsReorder = false;
    for (var i = 0; i < desired.length; i++) {
      if (parent.children[i] !== desired[i]) { needsReorder = true; break; }
    }
    if (!needsReorder) return;

    var frag = document.createDocumentFragment();
    desired.forEach(function(r) { frag.appendChild(r); });
    parent.appendChild(frag);
  }

  function tick() {
    processChatList();
    forceSpellcheck();
  }

  window.__gchatRetweak = tick;
  window.__gchatPendingPinToggle = window.__gchatPendingPinToggle || null;

  tick();
  setTimeout(tick, 600);
  setTimeout(tick, 2000);

  var debounce = null;
  var mo = new MutationObserver(function() {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(tick, 250);
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // safety: re-apply periodically in case WA virtualizer fights us
  setInterval(tick, 500);

  console.log('[gchat-wa-tweaks] installed (pins + spellcheck)');
  return 'installed';
})();
`;
  wc.executeJavaScript(script, true).catch(() => {});
}

export async function detectPillsInWebview(_wc: WebContents): Promise<string[]> {
  // No longer used (filter row tweaks reverted). Stub returns empty.
  return [];
}

export async function pollPendingPinToggle(wc: WebContents): Promise<string | null> {
  try {
    const script = `(function(){ var k = window.__gchatPendingPinToggle; window.__gchatPendingPinToggle = null; return k || null; })();`;
    const r = (await wc.executeJavaScript(script, true)) as string | null;
    return r || null;
  } catch {
    return null;
  }
}
