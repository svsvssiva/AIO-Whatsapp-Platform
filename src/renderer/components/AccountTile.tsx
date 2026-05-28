import React from 'react';
import type { Account } from '../../shared/types';

interface Props {
  account: Account;
  active: boolean;
  unread: number;
  onClick: () => void;
  onContextMenu: () => void;
}

function initials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export const AccountTile: React.FC<Props> = ({ account, active, unread, onClick, onContextMenu }) => {
  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu();
      }}
      className="tile relative flex items-center justify-center"
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        opacity: active ? 1 : 0.65,
        background: account.color + '22',
        boxShadow: active ? `0 0 0 2px ${account.color}` : 'none',
        color: account.color,
        fontWeight: 600,
        fontSize: 14,
      }}
      aria-label={`${account.label}${unread > 0 ? `, ${unread} unread` : ''}`}
      title={account.label}
    >
      {account.avatarExt ? (
        <img
          src={`gchat-avatar://${account.id}?v=${account.avatarUpdatedAt ?? 0}`}
          alt=""
          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
          draggable={false}
        />
      ) : (
        <span style={{ color: 'var(--text)' }}>{initials(account.label)}</span>
      )}
      {unread > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
          style={{ background: account.color, color: '#fff' }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
};
