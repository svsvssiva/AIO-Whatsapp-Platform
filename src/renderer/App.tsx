import React, { useEffect, useRef, useState } from 'react';
import { TitleBar } from './components/TitleBar';
import { AccountRail } from './components/AccountRail';
import { WebviewHost, wcIdByAccount } from './components/WebviewHost';
import { EmptyState } from './components/EmptyState';
import { QuickSwitcher } from './components/QuickSwitcher';
import { SettingsPanel } from './components/SettingsPanel';
import { MemoryDrawer } from './components/MemoryDrawer';
import { RenameDialog } from './components/RenameDialog';
import { UpdateBanner } from './components/UpdateBanner';
import { useAccountsStore } from './stores/accountsStore';

export const App: React.FC = () => {
  const { accounts, activeId, setAccounts, setActive, setUnread } = useAccountsStore();
  const [reloadKeys, setReloadKeys] = useState<Record<string, number>>({});
  const [quickOpen, setQuickOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; label: string } | null>(null);
  const [memoryTarget, setMemoryTarget] = useState<{ accountId: string; chatKey: string } | null>(null);
  const aiReplyRef = useRef<{ trigger: () => void } | null>(null);

  const refresh = async () => {
    const list = await window.gchat.listAccounts();
    setAccounts(list);
  };

  const handleAdd = async () => {
    const acc = await window.gchat.addAccount();
    await refresh();
    setActive(acc.id);
  };

  const bumpReload = (id: string) => {
    setReloadKeys((s) => ({ ...s, [id]: (s[id] ?? 0) + 1 }));
  };

  useEffect(() => {
    refresh();
    const offUnread = window.gchat.onUnreadUpdated((id, count) => setUnread(id, count));
    const offAdd = window.gchat.onMenuAddAccount(handleAdd);
    const offSwitch = window.gchat.onMenuSwitchAccount((id) => setActive(id));
    const offReload = window.gchat.onMenuReloadActive(() => {
      const cur = useAccountsStore.getState().activeId;
      if (cur) bumpReload(cur);
    });
    const offQuick = window.gchat.onMenuQuickSwitch(() => setQuickOpen(true));
    const offCtx = window.gchat.onContextAction(async (action, id, payload) => {
      switch (action) {
        case 'remove':
          await window.gchat.removeAccount(id);
          await refresh();
          break;
        case 'rename': {
          const cur = useAccountsStore.getState().accounts.find((a) => a.id === id);
          setRenameTarget({ id, label: cur?.label ?? '' });
          break;
        }
        case 'reload':
          bumpReload(id);
          break;
        case 'clear-cache':
          await window.gchat.clearCache(id);
          bumpReload(id);
          break;
        case 'logout':
          if (window.confirm('Log out this account? You will need to scan the QR again.')) {
            await window.gchat.logoutAccount(id);
            bumpReload(id);
          }
          break;
        case 'recolor':
          if (typeof payload === 'string') {
            await window.gchat.recolorAccount(id, payload);
            await refresh();
          }
          break;
        case 'change-icon':
          await window.gchat.pickAvatar(id);
          await refresh();
          break;
        case 'reset-icon':
          await window.gchat.resetAvatar(id);
          await refresh();
          break;
      }
    });
    const offOpenSettings = window.gchat.onOpenSettings(() => setSettingsOpen(true));
    const offMemOpen = window.gchat.memory.onOpenDrawer((accountId, chatKey) => {
      setMemoryTarget({ accountId, chatKey });
    });
    const offInspect = window.gchat.onMenuInspectActive(() => {
      const cur = useAccountsStore.getState().activeId;
      if (!cur) return;
      const wcId = wcIdByAccount.get(cur);
      if (typeof wcId === 'number') window.gchat.inspectWebview(wcId);
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && quickOpen) setQuickOpen(false);
      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const a = useAccountsStore.getState().accounts[idx];
        if (a) {
          e.preventDefault();
          setActive(a.id);
        }
      }
      // ⌘⇧R — generate AI reply for active account
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        aiReplyRef.current?.trigger();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      offUnread();
      offAdd();
      offSwitch();
      offReload();
      offQuick();
      offCtx();
      offOpenSettings();
      offInspect();
      offMemOpen();
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full flex flex-col">
      <UpdateBanner />
      <TitleBar onQuickSwitch={() => setQuickOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />
      <div className="flex-1 flex overflow-hidden">
        <AccountRail onAdd={handleAdd} onOpenSettings={() => setSettingsOpen(true)} />
        {accounts.length === 0 ? (
          <EmptyState onAdd={handleAdd} />
        ) : (
          <WebviewHost
            accounts={accounts}
            activeId={activeId}
            reloadKeys={reloadKeys}
            onOpenSettings={() => setSettingsOpen(true)}
            aiReplyRef={aiReplyRef}
          />
        )}
      </div>
      <QuickSwitcher open={quickOpen} onClose={() => setQuickOpen(false)} />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenMemory={(accountId, chatKey) => setMemoryTarget({ accountId, chatKey })}
      />
      <MemoryDrawer
        open={!!memoryTarget}
        accountId={memoryTarget?.accountId ?? ''}
        chatKey={memoryTarget?.chatKey ?? ''}
        onClose={() => setMemoryTarget(null)}
      />
      <RenameDialog
        open={!!renameTarget}
        initialValue={renameTarget?.label ?? ''}
        onClose={() => setRenameTarget(null)}
        onConfirm={async (name) => {
          if (renameTarget) {
            await window.gchat.renameAccount(renameTarget.id, name);
            await refresh();
          }
        }}
      />
    </div>
  );
};
