import type { WebContents } from 'electron';
import type { PillPrefs } from '../shared/types';

interface InjectOpts {
  prefs: PillPrefs; // unused now, kept for API stability
  chatPins: string[];
  accountId: string;
}

// Injected into the WhatsApp page (main world):
//  - chat pin overlay + reorder
//  - forces spellcheck="true" on the compose box (WA ships it disabled)
//  - the Rephrase bar that sits above the compose box
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
    /* ---- Rephrase bar (sits in normal flow directly above the compose footer) ---- */
    '#__gchat-rephrase-bar {',
    '  display:flex; align-items:center; gap:8px;',
    '  padding:6px 14px; width:100%; box-sizing:border-box;',
    '  background:var(--panel-header-background, #202c33);',
    '  border-top:1px solid rgba(255,255,255,0.06);',
    '  flex:0 0 auto; position:relative; z-index:5;',
    '  font-size:13px; color:#e9edef;',
    '}',
    '.__gchat-rp-btn {',
    '  display:inline-flex; align-items:center; gap:5px;',
    '  border:none; border-radius:15px; padding:5px 12px;',
    '  background:rgba(0,168,132,0.18); color:#00d8a0;',
    '  font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap;',
    '  transition:background 140ms, transform 80ms;',
    '}',
    '.__gchat-rp-btn:hover { background:rgba(0,168,132,0.30); }',
    '.__gchat-rp-btn:active { transform:scale(0.96); }',
    '.__gchat-rp-btn[disabled] { opacity:0.55; cursor:default; }',
    '.__gchat-rp-btn svg { width:13px; height:13px; }',
    '.__gchat-rp-opts { display:flex; flex-direction:column; gap:4px; flex:1 1 auto; min-width:0; }',
    '.__gchat-rp-opt {',
    '  display:flex; align-items:baseline; gap:8px; width:100%;',
    '  text-align:left; border:1px solid rgba(255,255,255,0.08);',
    '  background:rgba(255,255,255,0.04); color:#e9edef;',
    '  border-radius:8px; padding:6px 10px; cursor:pointer;',
    '  font-size:13px; line-height:1.35;',
    '  transition:background 120ms, border-color 120ms;',
    '}',
    '.__gchat-rp-opt:hover { background:rgba(0,168,132,0.14); border-color:rgba(0,168,132,0.45); }',
    '.__gchat-rp-tag {',
    '  flex:0 0 auto; font-size:10px; text-transform:uppercase; letter-spacing:0.4px;',
    '  color:#8696a0; font-weight:700; min-width:74px;',
    '}',
    '.__gchat-rp-text { flex:1 1 auto; white-space:pre-wrap; word-break:break-word; }',
    '.__gchat-rp-note { color:#8696a0; font-size:12px; flex:1 1 auto; }',
    '.__gchat-rp-err { color:#f15c6d; font-size:12px; flex:1 1 auto; }',
    '.__gchat-rp-x {',
    '  flex:0 0 auto; border:none; background:transparent; color:#8696a0;',
    '  font-size:15px; cursor:pointer; padding:4px 6px; line-height:1;',
    '}',
    '.__gchat-rp-x:hover { color:#e9edef; }',
    '@keyframes __gchat-spin { to { transform:rotate(360deg); } }',
    '.__gchat-spin { animation:__gchat-spin 900ms linear infinite; }',
  ].join('\\n');
  (document.head || document.documentElement).appendChild(style);

  var PIN_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 9V4l1.5-1.5a1 1 0 0 0-.71-1.71h-9.58a1 1 0 0 0-.71 1.71L8 4v5l-2 2v2h5.2v6l1 1 1-1v-6H18v-2l-2-2z"/></svg>';
  var WAND_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg>';
  var SPIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="__gchat-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';

  // ================= compose helpers =================
  function findCompose() {
    return document.querySelector('footer div[contenteditable="true"][role="textbox"]')
      || document.querySelector('footer div[contenteditable="true"]')
      || document.querySelector('[data-testid="conversation-compose-box-input"]')
      || document.querySelector('div[role="textbox"][contenteditable="true"]');
  }

  function findFooter() {
    var c = findCompose();
    if (c) { var f = c.closest('footer'); if (f) return f; }
    return document.querySelector('#main footer') || document.querySelector('footer');
  }

  function getComposeText() {
    var el = findCompose();
    return el ? (el.innerText || el.textContent || '').replace(/\\u200b/g, '').trim() : '';
  }

  function setComposeText(text) {
    var el = findCompose();
    if (!el) return false;
    el.focus();
    try {
      // Select everything already in the box so insertText replaces it.
      var sel = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}
    try {
      if (document.execCommand('insertText', false, text)) return true;
    } catch (e) {}
    try {
      el.dispatchEvent(new InputEvent('beforeinput', { bubbles:true, cancelable:true, inputType:'insertReplacementText', data:text }));
      el.dispatchEvent(new InputEvent('input', { bubbles:true, cancelable:true, inputType:'insertReplacementText', data:text }));
      return true;
    } catch (e) { return false; }
  }

  // WhatsApp ships the composer with spellcheck disabled, which suppresses the
  // macOS spell checker entirely. Force it on (and keep it on — WA re-renders).
  function forceSpellcheck() {
    var boxes = document.querySelectorAll('div[contenteditable="true"]');
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].getAttribute('spellcheck') !== 'true') boxes[i].setAttribute('spellcheck', 'true');
    }
  }

  // ================= rephrase bar =================
  var rpState = { mode: 'idle', variants: [], error: '' };

  function removeBar() {
    var b = document.getElementById('__gchat-rephrase-bar');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  function resetRephrase() {
    rpState = { mode: 'idle', variants: [], error: '' };
  }

  function runRephrase() {
    var text = getComposeText();
    if (!text) return;
    rpState = { mode: 'loading', variants: [], error: '' };
    renderBar();
    document.dispatchEvent(new CustomEvent('gchat:rephrase-request', { detail: { text: text } }));
  }

  document.addEventListener('gchat:rephrase-result', function(e) {
    var d = (e && e.detail) || {};
    if (d.ok && d.variants && d.variants.length) {
      rpState = { mode: 'results', variants: d.variants, error: '' };
    } else {
      rpState = { mode: 'error', variants: [], error: d.error || 'Rephrase failed.' };
    }
    renderBar();
  });

  function renderBar() {
    var footer = findFooter();
    // Only show the bar when there is something to act on.
    var hasText = getComposeText().length > 0;
    if (!footer || !footer.parentNode || (!hasText && rpState.mode === 'idle')) {
      removeBar();
      return;
    }

    var bar = document.getElementById('__gchat-rephrase-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = '__gchat-rephrase-bar';
      bar.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
      footer.parentNode.insertBefore(bar, footer);
    } else if (bar.nextSibling !== footer) {
      // WA re-rendered the footer — re-anchor so we stay directly above it.
      footer.parentNode.insertBefore(bar, footer);
    }

    // Signature avoids rebuilding (and stealing focus) on every 500ms tick.
    var sig = rpState.mode + '|' + rpState.error + '|' + rpState.variants.map(function(v){ return v.label + ':' + v.text; }).join('|');
    if (bar.getAttribute('data-sig') === sig) return;
    bar.setAttribute('data-sig', sig);
    bar.innerHTML = '';

    if (rpState.mode === 'results') {
      var opts = document.createElement('div');
      opts.className = '__gchat-rp-opts';
      rpState.variants.forEach(function(v) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = '__gchat-rp-opt';
        b.title = 'Use this version';
        var tag = document.createElement('span');
        tag.className = '__gchat-rp-tag';
        tag.textContent = v.label || 'Option';
        var tx = document.createElement('span');
        tx.className = '__gchat-rp-text';
        tx.textContent = v.text;
        b.appendChild(tag); b.appendChild(tx);
        b.addEventListener('click', function(ev) {
          ev.preventDefault(); ev.stopPropagation();
          setComposeText(v.text);
          resetRephrase();
          renderBar();
        });
        opts.appendChild(b);
      });
      bar.appendChild(opts);

      var x = document.createElement('button');
      x.type = 'button'; x.className = '__gchat-rp-x'; x.textContent = '\\u2715';
      x.title = 'Dismiss';
      x.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); resetRephrase(); renderBar(); });
      bar.appendChild(x);
      return;
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = '__gchat-rp-btn';

    if (rpState.mode === 'loading') {
      btn.disabled = true;
      btn.innerHTML = SPIN_SVG + '<span>Rephrasing\\u2026</span>';
      bar.appendChild(btn);
      return;
    }

    btn.innerHTML = WAND_SVG + '<span>Rephrase</span>';
    btn.title = 'Rewrite what you typed (\\u2318\\u21e7R)';
    btn.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); runRephrase(); });
    bar.appendChild(btn);

    if (rpState.mode === 'error') {
      var er = document.createElement('span');
      er.className = '__gchat-rp-err';
      er.textContent = rpState.error;
      bar.appendChild(er);
      var x2 = document.createElement('button');
      x2.type = 'button'; x2.className = '__gchat-rp-x'; x2.textContent = '\\u2715';
      x2.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); resetRephrase(); renderBar(); });
      bar.appendChild(x2);
    }
  }

  // ⌘⇧R anywhere in the page → rephrase the current draft.
  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
      if (getComposeText()) { e.preventDefault(); e.stopPropagation(); runRephrase(); }
    }
  }, true);

  // Reset when the user switches chats so stale options can't be applied later.
  var lastChatSig = '';
  function chatSignature() {
    var t = document.querySelector('#main header span[title]') || document.querySelector('#main header span[dir="auto"]');
    return t ? (t.getAttribute('title') || t.textContent || '') : '';
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
    var sig = chatSignature();
    if (sig !== lastChatSig) { lastChatSig = sig; resetRephrase(); }
    renderBar();
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

  console.log('[gchat-wa-tweaks] installed (pins + spellcheck + rephrase)');
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
