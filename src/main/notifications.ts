import type { WebContents } from 'electron';
import { DEFAULT_NOTIFICATION_PREFS } from '../shared/types';
import { getAccounts } from './store';

export function injectDebugHelper(wc: WebContents) {
  // Exposes __gchatDebugUnread() in the page's main-world console.
  // Uses Object.defineProperty + globalThis so it resists overwrites from
  // page reloads / framework re-hydration.
  const script = `
(function() {
  try {
    var fn = function() {
      return new Promise(function(resolve) {
        var done = false;
        function handler(e) {
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
        setTimeout(function() {
          if (!done) {
            done = true;
            console.warn('[gchat] no response from isolated-world preload within 1.5s');
            resolve(null);
          }
        }, 1500);
      });
    };
    try { Object.defineProperty(window, '__gchatDebugUnread', { value: fn, configurable: true, writable: true }); } catch (e) {}
    try { Object.defineProperty(globalThis, '__gchatDebugUnread', { value: fn, configurable: true, writable: true }); } catch (e) {}
    console.log('%c[gchat] debug helper ready — call __gchatDebugUnread()', 'color:#0A84FF;font-weight:bold');
    return 'GCHAT_INSTALLED_OK';
  } catch (err) {
    console.error('[gchat] inject failed:', err);
    return 'GCHAT_INSTALLED_FAIL:' + (err && err.message ? err.message : String(err));
  }
})();
`;
  wc.executeJavaScript(script, true)
    .then((result) => {
      console.log('[gchat-main] injectDebugHelper →', result);
    })
    .catch((err) => {
      console.error('[gchat-main] injectDebugHelper threw:', err);
    });
}

export function injectNotificationPatch(wc: WebContents, accountId: string) {
  const acc = getAccounts().find((a) => a.id === accountId);
  if (!acc) return;
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...acc.notifications };
  const label = acc.label;

  const script = `
(function() {
  if (window.__gchatNotifPatched) {
    window.__gchatNotifConfig = ${JSON.stringify({ enabled: prefs.enabled, showPreview: prefs.showPreview, silent: !prefs.sound, label, accountId })};
    return;
  }
  window.__gchatNotifPatched = true;
  window.__gchatNotifConfig = ${JSON.stringify({ enabled: prefs.enabled, showPreview: prefs.showPreview, silent: !prefs.sound, label, accountId })};
  const Orig = window.Notification;
  if (!Orig) return;
  function GChatNotification(title, opts) {
    const cfg = window.__gchatNotifConfig || {};
    if (cfg.enabled === false) {
      const dummy = { close: () => {}, addEventListener: () => {}, removeEventListener: () => {}, onclick: null };
      return dummy;
    }
    const prefix = cfg.label ? '[' + cfg.label + '] ' : '';
    const newTitle = prefix + (title || '');
    const newOpts = Object.assign({}, opts || {});
    if (cfg.showPreview === false) {
      newOpts.body = 'New message';
    }
    if (cfg.silent) newOpts.silent = true;
    const n = new Orig(newTitle, newOpts);
    const fireClick = () => {
      try {
        document.dispatchEvent(new CustomEvent('gchat:notification-click', { detail: { accountId: cfg.accountId } }));
      } catch (e) {}
    };
    n.addEventListener('click', fireClick);
    return n;
  }
  GChatNotification.prototype = Orig.prototype;
  Object.defineProperty(GChatNotification, 'permission', { get() { return Orig.permission; } });
  GChatNotification.requestPermission = Orig.requestPermission.bind(Orig);
  window.Notification = GChatNotification;
})();
`;

  wc.executeJavaScript(script).catch(() => {});
}
