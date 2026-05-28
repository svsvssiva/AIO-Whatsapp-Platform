import React from 'react';
import { Plus, Settings as SettingsIcon } from 'lucide-react';
import { AccountTile } from './AccountTile';
import { useAccountsStore } from '../stores/accountsStore';

interface Props {
  onAdd: () => void;
  onOpenSettings: () => void;
}

export const AccountRail: React.FC<Props> = ({ onAdd, onOpenSettings }) => {
  const { accounts, activeId, unread, setActive } = useAccountsStore();

  return (
    <div
      className="flex flex-col items-center py-2.5 border-r"
      style={{ width: 64, borderColor: 'var(--rail-divider)' }}
    >
      <div className="flex-1 flex flex-col items-center gap-3 overflow-y-auto w-full">
        {accounts.map((a) => (
          <AccountTile
            key={a.id}
            account={a}
            active={a.id === activeId}
            unread={unread[a.id] ?? 0}
            onClick={() => setActive(a.id)}
            onContextMenu={() => window.gchat.showTileMenu(a.id)}
          />
        ))}
      </div>
      <div className="w-8 h-px my-2" style={{ background: 'var(--rail-divider)' }} />
      <button
        onClick={onAdd}
        className="tile flex items-center justify-center mb-2"
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '1.5px dashed var(--text-muted)',
          color: 'var(--text-muted)',
        }}
        aria-label="Add account"
        title="Add account (⌘N)"
      >
        <Plus size={18} />
      </button>
      <button
        onClick={onOpenSettings}
        className="tile flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          color: 'var(--text-muted)',
        }}
        aria-label="Settings"
        title="Settings"
      >
        <SettingsIcon size={16} />
      </button>
    </div>
  );
};
