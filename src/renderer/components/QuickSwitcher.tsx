import React, { useEffect, useRef, useState } from 'react';
import { useAccountsStore } from '../stores/accountsStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const QuickSwitcher: React.FC<Props> = ({ open, onClose }) => {
  const { accounts, unread, setActive } = useAccountsStore();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  const filtered = accounts.filter((a) => a.label.toLowerCase().includes(q.toLowerCase()));

  const select = (id: string) => {
    setActive(id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-24 z-50"
      style={{ background: 'rgba(0,0,0,0.32)' }}
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--titlebar-bg)', backdropFilter: 'blur(40px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') setIdx((i) => Math.min(i + 1, filtered.length - 1));
            if (e.key === 'ArrowUp') setIdx((i) => Math.max(i - 1, 0));
            if (e.key === 'Enter' && filtered[idx]) select(filtered[idx].id);
          }}
          placeholder="Switch account…"
          className="w-full px-4 py-3 bg-transparent outline-none text-[15px]"
          style={{ color: 'var(--text)', borderBottom: '1px solid var(--rail-divider)' }}
        />
        <div className="max-h-80 overflow-y-auto">
          {filtered.map((a, i) => (
            <button
              key={a.id}
              onClick={() => select(a.id)}
              onMouseEnter={() => setIdx(i)}
              className="w-full flex items-center gap-3 px-4 py-2 text-left"
              style={{
                background: i === idx ? 'rgba(10,132,255,0.18)' : 'transparent',
                color: 'var(--text)',
              }}
            >
              <span
                className="inline-block rounded-full"
                style={{ width: 10, height: 10, background: a.color }}
              />
              <span className="flex-1 text-[14px]">{a.label}</span>
              {(unread[a.id] ?? 0) > 0 && (
                <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {unread[a.id]} unread
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              No matches
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
