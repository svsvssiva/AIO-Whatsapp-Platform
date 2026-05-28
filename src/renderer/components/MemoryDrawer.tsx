import React, { useEffect, useRef, useState } from 'react';
import { X, Save, ExternalLink, Sparkles, Trash2, Check, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  accountId: string;
  chatKey: string;
  onClose: () => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'dirty' }
  | { kind: 'error'; msg: string }
  | { kind: 'syncing' }
  | { kind: 'synced'; added: number };

function relTime(ts: number): string {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const MemoryDrawer: React.FC<Props> = ({ open, accountId, chatKey, onClose }) => {
  const [content, setContent] = useState('');
  const [exists, setExists] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialRef = useRef('');

  const load = async () => {
    if (!accountId || !chatKey) return;
    setLoading(true);
    const r = await window.gchat.memory.get(accountId, chatKey);
    setContent(r.content);
    initialRef.current = r.content;
    setExists(!!r.exists);
    setStatus({ kind: 'idle' });
    setLoading(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId, chatKey]);

  const create = async () => {
    const r = await window.gchat.memory.create(accountId, chatKey);
    setContent(r.content);
    initialRef.current = r.content;
    setExists(true);
    setStatus({ kind: 'saved', at: Date.now() });
  };

  const save = async () => {
    if (!exists && !content) return;
    setStatus({ kind: 'saving' });
    try {
      await window.gchat.memory.save(accountId, chatKey, content);
      initialRef.current = content;
      setExists(true);
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({ kind: 'error', msg: (e as Error).message });
    }
  };

  const onChangeText = (v: string) => {
    setContent(v);
    if (v !== initialRef.current) setStatus({ kind: 'dirty' });
  };

  const aiSync = async () => {
    setStatus({ kind: 'syncing' });
    const r = await window.gchat.memory.aiSync(accountId);
    if (!r.ok) {
      setStatus({ kind: 'error', msg: r.error });
      return;
    }
    setContent(r.content);
    initialRef.current = r.content;
    setExists(true);
    setStatus({ kind: 'synced', added: r.added });
  };

  const openInEditor = async () => {
    await window.gchat.memory.openFile(accountId, chatKey);
  };

  const removeMem = async () => {
    if (!window.confirm(`Delete memory for "${chatKey}"? This cannot be undone.`)) return;
    await window.gchat.memory.delete(accountId, chatKey);
    setContent('');
    initialRef.current = '';
    setExists(false);
    setStatus({ kind: 'idle' });
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current!;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = content.slice(0, start) + '  ' + content.slice(end);
      setContent(next);
      setStatus({ kind: 'dirty' });
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.18)' }}
        onClick={onClose}
      />
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 480,
          background: 'var(--titlebar-bg)',
          backdropFilter: 'blur(40px)',
          borderLeft: '1px solid var(--rail-divider)',
        }}
      >
        <header
          className="flex items-center justify-between h-[42px] px-4 border-b"
          style={{ borderColor: 'var(--rail-divider)' }}
        >
          <div className="flex flex-col">
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Memory
            </span>
            <span className="text-[13px] font-semibold truncate max-w-[380px]" style={{ color: 'var(--text)' }} title={chatKey}>
              {chatKey}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </header>

        <div
          className="flex items-center gap-1 px-3 py-2 border-b"
          style={{ borderColor: 'var(--rail-divider)' }}
        >
          <ToolBtn
            icon={<Save size={12} />}
            label={status.kind === 'saving' ? 'Saving…' : 'Save'}
            primary
            onClick={save}
            disabled={!exists || status.kind === 'saving' || status.kind === 'idle' && content === initialRef.current}
          />
          <ToolBtn icon={<Sparkles size={12} />} label={status.kind === 'syncing' ? 'Syncing…' : 'AI Sync'} onClick={aiSync} disabled={status.kind === 'syncing'} />
          <ToolBtn icon={<ExternalLink size={12} />} label="Open file" onClick={openInEditor} disabled={!exists} />
          <div className="flex-1" />
          <ToolBtn icon={<Trash2 size={12} />} label="Delete" onClick={removeMem} disabled={!exists} danger />
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-3">
          {loading ? (
            <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Loading…
            </div>
          ) : !exists ? (
            <div className="flex flex-col items-center justify-center flex-1 px-6 text-center">
              <p className="text-[14px] mb-3" style={{ color: 'var(--text)' }}>
                No memory yet for this chat.
              </p>
              <p className="text-[12px] mb-5" style={{ color: 'var(--text-muted)' }}>
                Memory is a notes file the AI reads as background context before every reply. Add your role,
                who's who, agreements, project info — anything the AI should know.
              </p>
              <button
                onClick={create}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white"
                style={{ background: '#0A84FF' }}
              >
                Create Memory
              </button>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => onChangeText(e.target.value)}
              onBlur={() => {
                if (content !== initialRef.current) save();
              }}
              onKeyDown={onKey}
              className="flex-1 w-full bg-transparent outline-none resize-none p-2"
              spellCheck={false}
              style={{
                color: 'var(--text)',
                border: '1px solid var(--rail-divider)',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.04)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            />
          )}
        </div>

        <footer
          className="flex items-center justify-between px-3 py-2 border-t text-[11px]"
          style={{ borderColor: 'var(--rail-divider)', color: 'var(--text-muted)' }}
        >
          <StatusLine status={status} />
          <span>Cmd+S to save · Esc to close</span>
        </footer>
      </aside>
    </>
  );
};

const ToolBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}> = ({ icon, label, onClick, primary, danger, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium"
    style={{
      background: primary ? '#0A84FF' : danger ? 'rgba(255,69,58,0.12)' : 'rgba(0,0,0,0.05)',
      color: primary ? '#fff' : danger ? '#FF453A' : 'var(--text)',
      opacity: disabled ? 0.5 : 1,
    }}
  >
    {icon}
    {label}
  </button>
);

const StatusLine: React.FC<{ status: Status }> = ({ status }) => {
  switch (status.kind) {
    case 'idle':
      return <span>Ready</span>;
    case 'dirty':
      return <span style={{ color: '#FF9F0A' }}>Unsaved changes</span>;
    case 'saving':
      return <span>Saving…</span>;
    case 'saved':
      return (
        <span style={{ color: '#30D158' }} className="inline-flex items-center gap-1">
          <Check size={11} /> Saved · {relTime(status.at)}
        </span>
      );
    case 'syncing':
      return <span>AI Sync running…</span>;
    case 'synced':
      return (
        <span style={{ color: '#30D158' }} className="inline-flex items-center gap-1">
          <Sparkles size={11} /> {status.added} new line{status.added === 1 ? '' : 's'} added
        </span>
      );
    case 'error':
      return (
        <span style={{ color: '#FF453A' }} className="inline-flex items-center gap-1">
          <AlertTriangle size={11} /> {status.msg}
        </span>
      );
  }
};
