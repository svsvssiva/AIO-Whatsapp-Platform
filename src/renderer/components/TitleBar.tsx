import React from 'react';
import { Search, Settings } from 'lucide-react';
import { useAccountsStore } from '../stores/accountsStore';

interface Props {
  onQuickSwitch: () => void;
  onOpenSettings: () => void;
}

export const TitleBar: React.FC<Props> = ({ onQuickSwitch, onOpenSettings }) => {
  const { accounts, activeId } = useAccountsStore();
  const active = accounts.find((a) => a.id === activeId);

  return (
    <div
      className="app-drag flex items-center h-[38px] px-3 border-b"
      style={{ borderColor: 'var(--rail-divider)', background: 'var(--titlebar-bg)' }}
    >
      <div className="w-[64px]" />
      <div className="flex-1 flex items-center justify-center text-[13px] font-medium" style={{ color: 'var(--text)' }}>
        {active ? active.label : 'GChat'}
      </div>
      <div className="app-no-drag flex items-center gap-1">
        <button
          onClick={onQuickSwitch}
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Quick switch"
          title="Quick switch (⌘K)"
        >
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Settings"
          title="Settings (⌘,)"
        >
          <Settings size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    </div>
  );
};
