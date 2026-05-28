import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  X,
  Copy,
  RefreshCw,
  Send,
  AlertTriangle,
  Settings as SettingsIcon,
  Eye,
  Shield,
} from 'lucide-react';
import { useAccountsStore } from '../stores/accountsStore';
import type { AISettings, PreparedPayload, ScrapedConversation } from '../../shared/types';

interface Props {
  onOpenSettings: () => void;
  triggerRef?: React.MutableRefObject<{ trigger: () => void } | null>;
}

type State =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'preview'; payload: PreparedPayload }
  | { kind: 'loading' }
  | { kind: 'ready'; text: string }
  | { kind: 'error'; code?: string; message: string };

export const AiReply: React.FC<Props> = ({ onOpenSettings, triggerRef }) => {
  const { activeId } = useAccountsStore();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [editable, setEditable] = useState(false);
  const lastConvRef = useRef<ScrapedConversation | null>(null);

  useEffect(() => {
    window.gchat.ai.getSettings().then(setSettings);
  }, [activeId]);

  useEffect(() => {
    if (!triggerRef) return;
    triggerRef.current = { trigger: () => handlePillClick() };
    return () => {
      if (triggerRef.current) triggerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerRef, activeId, settings]);

  const prepare = async () => {
    if (!activeId) return;
    setOpen(true);
    setState({ kind: 'preparing' });

    let conv = lastConvRef.current;
    if (!conv) {
      const scrape = await window.gchat.ai.scrapeActive(activeId);
      if (!scrape.ok || !scrape.data) {
        setState({ kind: 'error', message: scrape.error || 'Could not read this chat.' });
        return;
      }
      conv = scrape.data;
      lastConvRef.current = conv;
    }
    const prep = await window.gchat.ai.prepare(conv, activeId);
    if (!prep.ok) {
      setState({ kind: 'error', code: prep.code, message: prep.error });
      return;
    }
    setState({ kind: 'preview', payload: prep.payload });
  };

  const send = async (payload: PreparedPayload) => {
    setState({ kind: 'loading' });
    const res = await window.gchat.ai.generateFromPayload(payload);
    if (res.ok) setState({ kind: 'ready', text: res.text });
    else setState({ kind: 'error', code: res.code, message: res.error });
  };

  const handlePillClick = async () => {
    const s = settings ?? (await window.gchat.ai.getSettings());
    setSettings(s);
    if (!s.enabled || !s.hasApiKey) {
      setOpen(true);
      setState({ kind: 'error', code: 'no-key', message: 'AI reply is not configured yet.' });
      return;
    }
    lastConvRef.current = null;
    prepare();
  };

  const onInsert = async () => {
    if (state.kind !== 'ready' || !activeId) return;
    const res = await window.gchat.ai.insertText(activeId, state.text);
    if (!res.ok) {
      try {
        await navigator.clipboard.writeText(state.text);
        setState({
          kind: 'error',
          message: 'Could not type into WhatsApp. Copied to clipboard — press ⌘V to paste.',
        });
      } catch {
        setState({ kind: 'error', message: res.error || 'Could not insert.' });
      }
      return;
    }
    setOpen(false);
    setState({ kind: 'idle' });
  };

  const onCopy = async () => {
    if (state.kind !== 'ready') return;
    await navigator.clipboard.writeText(state.text);
  };

  const onDiscard = () => {
    setOpen(false);
    setState({ kind: 'idle' });
  };

  const onRegenerate = () => {
    if (state.kind === 'ready' || state.kind === 'error') {
      lastConvRef.current = null;
      prepare();
    }
  };

  if (!activeId) return null;

  const isPreview = state.kind === 'preview';
  const popoverWidth = isPreview ? 520 : 360;

  return (
    <>
      <button
        onClick={handlePillClick}
        title="Generate AI reply (⌘⇧R)"
        aria-label="Generate AI reply"
        style={{
          position: 'absolute',
          right: 16,
          bottom: 88,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--titlebar-bg)',
          backdropFilter: 'blur(40px)',
          border: '1px solid var(--rail-divider)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
          cursor: 'pointer',
        }}
      >
        <Sparkles size={17} style={{ color: '#0A84FF' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 16,
            bottom: 138,
            width: popoverWidth,
            maxHeight: 540,
            background: 'var(--titlebar-bg)',
            backdropFilter: 'blur(40px)',
            border: '1px solid var(--rail-divider)',
            borderRadius: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
            zIndex: 31,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <header
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: 'var(--rail-divider)' }}
          >
            <div className="flex items-center gap-1.5">
              {isPreview ? (
                <Eye size={13} style={{ color: '#0A84FF' }} />
              ) : (
                <Sparkles size={13} style={{ color: '#0A84FF' }} />
              )}
              <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                {isPreview ? 'Review before sending to OpenAI' : 'Suggested reply'}
              </span>
              {settings && !isPreview && (
                <span
                  className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(10,132,255,0.15)', color: '#0A84FF' }}
                >
                  {capitalize(settings.tone)} · {capitalize(settings.length)}
                </span>
              )}
            </div>
            <button
              onClick={onDiscard}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close"
            >
              <X size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto" style={{ minHeight: 80 }}>
            {state.kind === 'preparing' && (
              <div className="p-3">
                <Skeleton />
              </div>
            )}
            {state.kind === 'loading' && (
              <div className="p-3">
                <Skeleton />
              </div>
            )}
            {state.kind === 'preview' && (
              <PreviewBody
                payload={state.payload}
                onChange={(p) => setState({ kind: 'preview', payload: p })}
                onSend={() => send(state.payload)}
                onCancel={onDiscard}
              />
            )}
            {state.kind === 'ready' && (
              <div className="p-3">
                <textarea
                  value={state.text}
                  onChange={(e) => setState({ kind: 'ready', text: e.target.value })}
                  onFocus={() => setEditable(true)}
                  className="w-full bg-transparent outline-none resize-none text-[14px]"
                  style={{ color: 'var(--text)', minHeight: 80, lineHeight: 1.5 }}
                  rows={Math.min(10, Math.max(3, state.text.split('\n').length + 1))}
                  readOnly={!editable}
                  onClick={() => setEditable(true)}
                />
              </div>
            )}
            {state.kind === 'error' && (
              <div className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} style={{ color: '#FF453A', marginTop: 2 }} />
                  <div className="text-[13px]" style={{ color: 'var(--text)' }}>
                    {state.message}
                  </div>
                </div>
                {(state.code === 'no-key' || state.code === 'auth') && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      onOpenSettings();
                    }}
                    className="text-[12px] px-2 py-1 rounded-md font-medium text-white"
                    style={{ background: '#0A84FF' }}
                  >
                    <SettingsIcon size={11} className="inline mr-1" />
                    Open AI settings
                  </button>
                )}
              </div>
            )}
          </div>

          {state.kind === 'ready' && (
            <footer
              className="flex items-center justify-end gap-1 px-2 py-2 border-t"
              style={{ borderColor: 'var(--rail-divider)' }}
            >
              <FooterBtn icon={<RefreshCw size={12} />} label="Regenerate" onClick={onRegenerate} />
              <FooterBtn icon={<Copy size={12} />} label="Copy" onClick={onCopy} />
              <FooterBtn icon={<Send size={12} />} label="Insert" primary onClick={onInsert} />
            </footer>
          )}
        </div>
      )}
    </>
  );
};

const PreviewBody: React.FC<{
  payload: PreparedPayload;
  onChange: (p: PreparedPayload) => void;
  onSend: () => void;
  onCancel: () => void;
}> = ({ payload, onChange, onSend, onCancel }) => {
  const [confirmed, setConfirmed] = useState(false);
  const [showSystem, setShowSystem] = useState(false);

  const updateMessage = (idx: number, content: string) => {
    const next = payload.messages.slice();
    next[idx] = { ...next[idx], content };
    onChange({ ...payload, messages: next });
  };

  const updateSystem = (s: string) => onChange({ ...payload, systemPrompt: s });

  return (
    <div className="px-3 py-2 space-y-2">
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px]"
        style={{
          background:
            payload.redactionSummary.total > 0
              ? 'rgba(48,209,88,0.10)'
              : 'rgba(255,159,10,0.10)',
          color: payload.redactionSummary.total > 0 ? '#30D158' : '#FF9F0A',
        }}
      >
        <Shield size={12} />
        {payload.redactionSummary.total > 0 ? (
          <span>
            <strong>{payload.redactionSummary.total}</strong> item(s) auto-redacted
            {payload.redactionSummary.categories.length > 0 && (
              <> · {payload.redactionSummary.categories.join(', ')}</>
            )}
          </span>
        ) : (
          <span>
            No automatic redactions matched. Check each message below for unlabeled credentials
            (e.g. <code>alex, asdf@1231</code>) and edit them out manually.
          </span>
        )}
      </div>

      <details
        open={showSystem}
        onToggle={(e) => setShowSystem((e.target as HTMLDetailsElement).open)}
        className="rounded-md"
        style={{ background: 'rgba(0,0,0,0.04)' }}
      >
        <summary
          className="cursor-pointer px-2 py-1.5 text-[12px]"
          style={{ color: 'var(--text-muted)' }}
        >
          System prompt ({payload.systemPrompt.length} chars)
        </summary>
        <textarea
          value={payload.systemPrompt}
          onChange={(e) => updateSystem(e.target.value)}
          spellCheck={false}
          className="w-full bg-transparent outline-none resize-y px-2 py-1.5"
          style={{
            color: 'var(--text-muted)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11,
            lineHeight: 1.4,
            minHeight: 100,
            maxHeight: 200,
            border: '1px solid var(--rail-divider)',
          }}
        />
      </details>

      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Conversation being sent ({payload.messages.length} message{payload.messages.length === 1 ? '' : 's'}):
      </div>

      <div className="space-y-1.5">
        {payload.messages.map((m, i) => (
          <MessageRow
            key={i}
            content={m.content}
            direction={m.direction}
            sender={m.sender}
            redacted={m.redacted}
            onChange={(v) => updateMessage(i, v)}
          />
        ))}
      </div>

      <label
        className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer mt-2"
        style={{ background: 'rgba(0,0,0,0.04)' }}
      >
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span className="text-[12px]" style={{ color: 'var(--text)' }}>
          I've reviewed the messages above and confirm no credentials remain.
        </span>
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-[12px]"
          style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text)' }}
        >
          Cancel
        </button>
        <button
          onClick={onSend}
          disabled={!confirmed}
          className="px-3 py-1.5 rounded-md text-[12px] font-medium text-white flex items-center gap-1"
          style={{ background: '#0A84FF', opacity: confirmed ? 1 : 0.5 }}
        >
          <Send size={11} />
          Send to OpenAI
        </button>
      </div>
    </div>
  );
};

const MessageRow: React.FC<{
  content: string;
  direction: 'in' | 'out';
  sender?: string;
  redacted: boolean;
  onChange: (v: string) => void;
}> = ({ content, direction, sender, redacted, onChange }) => {
  const [editing, setEditing] = useState(false);
  const tagBg = direction === 'in' ? 'rgba(10,132,255,0.18)' : 'rgba(48,209,88,0.16)';
  const tagFg = direction === 'in' ? '#0A84FF' : '#30D158';
  return (
    <div
      className="rounded-md px-2 py-1.5"
      style={{
        background: 'rgba(0,0,0,0.04)',
        border: redacted ? '1px solid rgba(255,159,10,0.4)' : '1px solid transparent',
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold"
          style={{ background: tagBg, color: tagFg, letterSpacing: 0.4 }}
        >
          {direction === 'in' ? 'them' : 'you'}
        </span>
        {sender && direction === 'in' && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {sender}
          </span>
        )}
        {redacted && (
          <span className="text-[10px]" style={{ color: '#FF9F0A' }}>
            ● contains redactions
          </span>
        )}
        <span className="flex-1" />
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)' }}
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      {editing ? (
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="w-full bg-transparent outline-none resize-y"
          style={{
            color: 'var(--text)',
            fontSize: 13,
            lineHeight: 1.45,
            minHeight: 50,
            border: '1px solid var(--rail-divider)',
            padding: 6,
            borderRadius: 4,
          }}
        />
      ) : (
        <div
          className="text-[13px] whitespace-pre-wrap"
          style={{ color: 'var(--text)', lineHeight: 1.45 }}
        >
          <HighlightRedactions text={content} />
        </div>
      )}
    </div>
  );
};

const HighlightRedactions: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\[REDACTED:[a-z]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[REDACTED:[a-z]+\]$/.test(p) ? (
          <span
            key={i}
            style={{
              background: 'rgba(255,159,10,0.25)',
              color: '#FF9F0A',
              padding: '1px 4px',
              borderRadius: 3,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
            }}
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
};

const FooterBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}> = ({ icon, label, onClick, primary, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium"
    style={{
      background: primary ? '#0A84FF' : 'rgba(0,0,0,0.05)',
      color: primary ? '#fff' : 'var(--text)',
      opacity: disabled ? 0.5 : 1,
    }}
  >
    {icon}
    {label}
  </button>
);

const Skeleton: React.FC = () => (
  <div className="space-y-2 animate-pulse">
    <div style={{ height: 12, width: '90%', background: 'rgba(0,0,0,0.08)', borderRadius: 4 }} />
    <div style={{ height: 12, width: '75%', background: 'rgba(0,0,0,0.08)', borderRadius: 4 }} />
    <div style={{ height: 12, width: '60%', background: 'rgba(0,0,0,0.08)', borderRadius: 4 }} />
  </div>
);

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
