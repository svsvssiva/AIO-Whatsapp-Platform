import React, { useEffect, useState } from 'react';
import { FolderOpen, RefreshCw, Search } from 'lucide-react';
import type { ChatMemoryMeta } from '../../shared/types';
import { useAccountsStore } from '../stores/accountsStore';

interface Props {
  onOpen: (accountId: string, chatKey: string) => void;
}

function relTime(ts: number): string {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

export const SettingsMemoryTab: React.FC<Props> = ({ onOpen }) => {
  const { accounts } = useAccountsStore();
  const [items, setItems] = useState<ChatMemoryMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  const refresh = async () => {
    setLoading(true);
    const list = await window.gchat.memory.listAll();
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const accountLabel = (id: string) => accounts.find((a) => a.id === id)?.label || id.slice(0, 6);
  const accountColor = (id: string) => accounts.find((a) => a.id === id)?.color || '#8E8E93';

  const filtered = q
    ? items.filter(
        (i) =>
          i.chatKey.toLowerCase().includes(q.toLowerCase()) ||
          i.preview.toLowerCase().includes(q.toLowerCase()),
      )
    : items;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={13}
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search memories…"
            className="w-full text-[13px] pl-7 pr-2 py-1.5 rounded-md outline-none"
            style={{
              background: 'rgba(0,0,0,0.06)',
              color: 'var(--text)',
              border: '1px solid var(--rail-divider)',
            }}
          />
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-[11px] px-2 py-1.5 rounded-md flex items-center gap-1"
          style={{ background: 'rgba(10,132,255,0.15)', color: '#0A84FF' }}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
        <button
          onClick={() => window.gchat.memory.reveal()}
          className="text-[11px] px-2 py-1.5 rounded-md flex items-center gap-1"
          style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text)' }}
          title="Open the memory folder in Finder"
        >
          <FolderOpen size={11} />
          Folder
        </button>
      </div>

      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Each chat's memory is a markdown file at{' '}
        <code style={{ background: 'rgba(0,0,0,0.05)', padding: '0 4px', borderRadius: 4 }}>
          ~/Library/Application Support/gchat/memory/
        </code>
        . Editable in any external editor. AI reads these on every reply.
      </p>

      <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.04)' }}>
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-[12px] text-center" style={{ color: 'var(--text-muted)' }}>
            {q ? 'No matches' : 'No memories yet. Open a chat and tap the notebook icon in its header.'}
          </div>
        )}
        {filtered.map((it) => (
          <button
            key={`${it.accountId}::${it.filename}`}
            onClick={() => onOpen(it.accountId, it.chatKey)}
            className="w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            style={{ borderColor: 'var(--rail-divider)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-block rounded-full"
                style={{ width: 8, height: 8, background: accountColor(it.accountId) }}
              />
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {accountLabel(it.accountId)}
              </span>
              <span className="flex-1" />
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {fmtBytes(it.bytes)} · {relTime(it.updatedAt)}
              </span>
            </div>
            <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>
              {it.chatKey}
            </div>
            {it.preview && (
              <div className="text-[12px] mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                {it.preview}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
