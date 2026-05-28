import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, Eye, EyeOff, RotateCcw, RefreshCw } from 'lucide-react';
import { useAccountsStore } from '../stores/accountsStore';
import type { PillPrefs } from '../../shared/types';

interface Row {
  label: string;
  hidden: boolean;
}

export const SettingsPinsTab: React.FC = () => {
  const { activeId, accounts } = useAccountsStore();
  const [prefs, setPrefs] = useState<PillPrefs | null>(null);
  const [detected, setDetected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const refresh = async () => {
    setLoading(true);
    const p = await window.gchat.pills.getPrefs();
    setPrefs(p);
    if (activeId) {
      const list = await window.gchat.pills.list(activeId);
      setDetected(list);
    } else {
      setDetected([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  if (!prefs) return <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

  // Merge: items in saved order first, then any detected ones not yet in order
  const orderedLabels = [...prefs.order];
  for (const d of detected) if (!orderedLabels.includes(d)) orderedLabels.push(d);

  const rows: Row[] = orderedLabels.map((label) => ({
    label,
    hidden: prefs.hidden.includes(label),
  }));

  const commit = async (newOrder: string[], newHidden: string[]) => {
    const next = await window.gchat.pills.setPrefs({ order: newOrder, hidden: newHidden });
    setPrefs(next);
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const labels = rows.map((r) => r.label);
    const [moved] = labels.splice(from, 1);
    labels.splice(to, 0, moved);
    commit(labels, prefs.hidden);
  };

  const toggleHidden = (label: string) => {
    const newHidden = prefs.hidden.includes(label)
      ? prefs.hidden.filter((l) => l !== label)
      : [...prefs.hidden, label];
    commit(rows.map((r) => r.label), newHidden);
  };

  const reset = async () => {
    const next = await window.gchat.pills.setPrefs({ order: [], hidden: [] });
    setPrefs(next);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Drag the handles to reorder the chat-list filter chips that appear in WhatsApp. Toggle the eye
          to hide chips you never use. Order applies to every account; refresh below if a chip is missing.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          {rows.length === 0 ? 'No chips detected yet' : `${rows.length} chip${rows.length === 1 ? '' : 's'}`}
          {activeId && accounts.length > 0 && (
            <> · detected from <strong>{accounts.find((a) => a.id === activeId)?.label}</strong></>
          )}
        </span>
        <div className="flex gap-1">
          <button
            onClick={refresh}
            disabled={loading}
            className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1"
            style={{ background: 'rgba(10,132,255,0.15)', color: '#0A84FF' }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={reset}
            className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1"
            style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text)' }}
            title="Reset to WhatsApp's default order, show all"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.04)' }}>
        {rows.length === 0 && (
          <div className="px-3 py-4 text-[12px] text-center" style={{ color: 'var(--text-muted)' }}>
            Open a chat list in any account, then click Refresh.
          </div>
        )}
        {rows.map((r, i) => (
          <div
            key={r.label}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragEnter={() => setDropIdx(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setDropIdx(i);
            }}
            onDragEnd={() => {
              if (dragIdx !== null && dropIdx !== null) reorder(dragIdx, dropIdx);
              setDragIdx(null);
              setDropIdx(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx !== null) reorder(dragIdx, i);
              setDragIdx(null);
              setDropIdx(null);
            }}
            className="flex items-center gap-2 px-2 py-2 border-b last:border-b-0 select-none"
            style={{
              borderColor: 'var(--rail-divider)',
              background:
                dropIdx === i && dragIdx !== null && dragIdx !== i ? 'rgba(10,132,255,0.10)' : 'transparent',
              opacity: r.hidden ? 0.5 : 1,
              cursor: 'grab',
            }}
          >
            <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span className="flex-1 text-[13px] truncate" style={{ color: 'var(--text)' }}>
              {r.label}
            </span>
            <button
              onClick={() => toggleHidden(r.label)}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
              aria-label={r.hidden ? 'Show' : 'Hide'}
              title={r.hidden ? 'Show this chip' : 'Hide this chip'}
            >
              {r.hidden ? (
                <EyeOff size={13} style={{ color: 'var(--text-muted)' }} />
              ) : (
                <Eye size={13} style={{ color: 'var(--text-muted)' }} />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
