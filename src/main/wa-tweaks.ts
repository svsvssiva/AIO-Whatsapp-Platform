import type { WebContents } from 'electron';
import type { PillPrefs } from '../shared/types';

interface InjectOpts {
  prefs: PillPrefs; // unused now, kept for API stability
  chatPins: string[];
  accountId: string;
  aiLockouts: string[];
}

// Chat pin overlay + reorder. No filter-row tweaks (WA UI left as-is).
export function injectWaTweaks(wc: WebContents, opts: InjectOpts) {
  const pins = JSON.stringify(opts.chatPins || []);
  const lockouts = JSON.stringify(opts.aiLockouts || []);
  const accountId = JSON.stringify(opts.accountId || '');

  const script = `
(function() {
  window.__gchatChatPins = ${pins};
  window.__gchatAiLockouts = ${lockouts};
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
    /* Memory button in WA chat header */
    '.__gchat-mem-btn {',
    '  display:inline-flex;',
    '  align-items:center;',
    '  justify-content:center;',
    '  width:32px; height:32px;',
    '  margin-right:6px;',
    '  border-radius:8px;',
    '  background:transparent;',
    '  color:rgba(233,237,239,0.65);',
    '  cursor:pointer;',
    '  border:none;',
    '  padding:0;',
    '  transition:background 140ms, color 140ms, transform 80ms;',
    '}',
    '.__gchat-mem-btn:hover { background:rgba(0,168,132,0.18); color:#00d8a0; }',
    '.__gchat-mem-btn:active { transform:scale(0.94); }',
    '.__gchat-mem-btn svg { width:18px; height:18px; }',
    /* AI lockout (shield) button in WA chat header */
    '.__gchat-lock-btn {',
    '  display:inline-flex; align-items:center; justify-content:center;',
    '  width:32px; height:32px; margin-right:6px; border-radius:8px;',
    '  background:transparent; color:rgba(233,237,239,0.65);',
    '  cursor:pointer; border:none; padding:0;',
    '  transition:background 140ms, color 140ms, transform 80ms;',
    '}',
    '.__gchat-lock-btn:hover { background:rgba(255,159,10,0.18); color:#FF9F0A; }',
    '.__gchat-lock-btn:active { transform:scale(0.94); }',
    '.__gchat-lock-btn svg { width:17px; height:17px; }',
    '.__gchat-lock-btn.locked { color:#FF453A; }',
    '.__gchat-lock-btn.locked:hover { background:rgba(255,69,58,0.18); color:#FF6961; }',
  ].join('\\n');
  (document.head || document.documentElement).appendChild(style);

  var PIN_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 9V4l1.5-1.5a1 1 0 0 0-.71-1.71h-9.58a1 1 0 0 0-.71 1.71L8 4v5l-2 2v2h5.2v6l1 1 1-1v-6H18v-2l-2-2z"/></svg>';
  var MEM_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6a2 2 0 0 1 2-2h11a3 3 0 0 1 3 3v13H5a3 3 0 0 1-3-3z"/><path d="M2 14h16"/><path d="M2 10h16"/><path d="M6 4v16"/></svg>';
  var SHIELD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  var SHIELD_OFF_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.69 14a6.9 6.9 0 0 0 .31-2V5l-8-3-3.16 1.18"/><path d="M4.73 4.73 4 5v7c0 6 8 10 8 10a20.3 20.3 0 0 0 5.62-4.38"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function getActiveChatTitleFromHeader() {
    var headerName =
      document.querySelector('#main header span[title]') ||
      document.querySelector('#main header span[dir="auto"][title]') ||
      document.querySelector('header [data-testid="conversation-info-header-chat-title"]') ||
      document.querySelector('#main header span[dir="auto"]');
    if (!headerName) return '';
    return (headerName.getAttribute('title') || headerName.textContent || '').trim();
  }

  function injectLockButton() {
    var header = document.querySelector('#main header');
    if (!header) return;
    var chatTitle = getActiveChatTitleFromHeader();
    if (!chatTitle) return;
    var existing = header.querySelector('.__gchat-lock-btn');
    var isLocked = (window.__gchatAiLockouts || []).indexOf(chatTitle) !== -1;

    if (existing) {
      existing.classList.toggle('locked', isLocked);
      existing.setAttribute('aria-label', isLocked ? 'AI disabled for this chat' : 'Disable AI for this chat');
      existing.title = isLocked ? 'AI disabled for this chat (click to enable)' : 'Disable AI for this chat (click to lock)';
      existing.innerHTML = isLocked ? SHIELD_OFF_SVG : SHIELD_SVG;
      return;
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = '__gchat-lock-btn' + (isLocked ? ' locked' : '');
    btn.setAttribute('aria-label', isLocked ? 'AI disabled for this chat' : 'Disable AI for this chat');
    btn.title = isLocked ? 'AI disabled for this chat (click to enable)' : 'Disable AI for this chat (click to lock)';
    btn.innerHTML = isLocked ? SHIELD_OFF_SVG : SHIELD_SVG;
    btn.addEventListener('mousedown', function(e){ e.preventDefault(); e.stopPropagation(); }, true);
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      window.__gchatPendingLockToggle = getActiveChatTitleFromHeader();
    }, true);
    // Insert before memory button if present, otherwise as first
    var memBtn = header.querySelector('.__gchat-mem-btn');
    if (memBtn && memBtn.parentElement) {
      memBtn.parentElement.insertBefore(btn, memBtn);
    } else {
      var actionsArea = header.querySelector('div[role="button"][aria-label*="Menu" i]') ||
                        header.querySelector('button[aria-label*="Menu" i]') ||
                        null;
      if (actionsArea && actionsArea.parentElement) {
        actionsArea.parentElement.insertBefore(btn, actionsArea);
      } else {
        header.appendChild(btn);
      }
    }
  }

  function injectMemoryButton() {
    var header = document.querySelector('#main header');
    if (!header) return;
    if (header.querySelector('.__gchat-mem-btn')) return;
    var chatTitle = getActiveChatTitleFromHeader();
    if (!chatTitle) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = '__gchat-mem-btn';
    btn.setAttribute('aria-label', 'Chat memory (GChat)');
    btn.title = 'Chat memory (GChat)';
    btn.innerHTML = MEM_SVG;
    btn.addEventListener('mousedown', function(e){ e.preventDefault(); e.stopPropagation(); }, true);
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      window.__gchatPendingMemoryOpen = getActiveChatTitleFromHeader();
    }, true);
    // Insert at the END of the header so it sits before search/menu icons or as first action
    // Find the trailing controls area; fallback to header itself.
    var actionsArea = header.querySelector('div[role="button"][aria-label*="Menu" i]') ||
                      header.querySelector('button[aria-label*="Menu" i]') ||
                      null;
    if (actionsArea && actionsArea.parentElement) {
      actionsArea.parentElement.insertBefore(btn, actionsArea);
    } else {
      header.appendChild(btn);
    }
  }

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

    // Build desired order: pinned first (saved order), then rest (WA order)
    var desired = [];
    pinned.forEach(function(p) { desired.push(p.r); });
    rest.forEach(function(r) { desired.push(r); });

    // Only reorder if current differs
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
    injectMemoryButton();
    injectLockButton();
  }

  window.__gchatRetweak = tick;
  window.__gchatPendingPinToggle = window.__gchatPendingPinToggle || null;
  window.__gchatPendingMemoryOpen = window.__gchatPendingMemoryOpen || null;
  window.__gchatPendingLockToggle = window.__gchatPendingLockToggle || null;

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

  console.log('[gchat-wa-tweaks] chat-pin installed, pins=', pins);
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
