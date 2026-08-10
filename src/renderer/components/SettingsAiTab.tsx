import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, AlertCircle, Check, ShieldCheck } from 'lucide-react';
import { AI_MODELS, AISettings } from '../../shared/types';

export const SettingsAiTab: React.FC = () => {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [testState, setTestState] = useState<
    { kind: 'idle' } | { kind: 'testing' } | { kind: 'ok' } | { kind: 'err'; msg: string }
  >({ kind: 'idle' });
  const [savingKey, setSavingKey] = useState(false);

  const refresh = async () => setSettings(await window.gchat.ai.getSettings());

  useEffect(() => {
    refresh();
  }, []);

  if (!settings) {
    return (
      <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }

  const update = async (patch: Partial<AISettings>) => setSettings(await window.gchat.ai.setSettings(patch));

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    setSavingKey(true);
    const res = await window.gchat.ai.setKey(keyInput.trim());
    setSavingKey(false);
    if (!res.ok) {
      setTestState({ kind: 'err', msg: res.error || 'Could not save key.' });
      return;
    }
    setKeyInput('');
    await refresh();
    setTestState({ kind: 'testing' });
    const t = await window.gchat.ai.testKey();
    setTestState(t.ok ? { kind: 'ok' } : { kind: 'err', msg: t.error });
  };

  const clearKey = async () => {
    await window.gchat.ai.clearKey();
    setTestState({ kind: 'idle' });
    await refresh();
  };

  const runTest = async () => {
    setTestState({ kind: 'testing' });
    const t = await window.gchat.ai.testKey();
    setTestState(t.ok ? { kind: 'ok' } : { kind: 'err', msg: t.error });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
        <Toggle
          label="Enable Rephrase"
          checked={settings.enabled}
          onChange={(v) => update({ enabled: v })}
        />
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Adds a <strong>Rephrase</strong> button next to the WhatsApp message box. Type a message,
          click it, and pick from a few corrected versions. Shortcut: ⌘⇧R.
        </p>
      </div>

      {/* What actually leaves the machine — stated plainly. */}
      <div
        className="rounded-lg p-3 flex items-start gap-2"
        style={{ background: 'rgba(48,209,88,0.10)' }}
      >
        <ShieldCheck size={14} style={{ color: '#30D158', marginTop: 1, flexShrink: 0 }} />
        <div className="text-[11px]" style={{ color: 'var(--text)', lineHeight: 1.5 }}>
          <strong>Your chats are never sent anywhere.</strong> Only the message you have typed into
          the box is sent to OpenAI, and only when you click Rephrase. Conversation history,
          contacts and received messages are never read.
        </div>
      </div>

      {/* API key */}
      <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
            OpenAI API key
          </span>
          {settings.hasApiKey ? (
            <StatusPill kind={testState.kind === 'err' ? 'err' : 'ok'}>
              {testState.kind === 'err' ? 'Invalid' : 'Configured'}
            </StatusPill>
          ) : (
            <StatusPill kind="muted">Not set</StatusPill>
          )}
        </div>

        {settings.hasApiKey ? (
          <div className="flex items-center gap-2">
            <code
              className="flex-1 text-[12px] px-2 py-1.5 rounded-md font-mono"
              style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)' }}
            >
              sk-…••••••••
            </code>
            <button
              onClick={runTest}
              className="text-[12px] px-2 py-1.5 rounded-md font-medium"
              style={{ background: 'rgba(10,132,255,0.15)', color: '#0A84FF' }}
            >
              {testState.kind === 'testing' ? 'Testing…' : 'Test'}
            </button>
            <button
              onClick={clearKey}
              className="text-[12px] px-2 py-1.5 rounded-md"
              style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text)' }}
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={keyVisible ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveKey()}
                placeholder="sk-..."
                className="w-full text-[13px] px-2 py-1.5 pr-8 rounded-md outline-none"
                style={{
                  background: 'rgba(0,0,0,0.06)',
                  color: 'var(--text)',
                  border: '1px solid var(--rail-divider)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={() => setKeyVisible((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1"
                aria-label={keyVisible ? 'Hide' : 'Show'}
              >
                {keyVisible ? (
                  <EyeOff size={13} style={{ color: 'var(--text-muted)' }} />
                ) : (
                  <Eye size={13} style={{ color: 'var(--text-muted)' }} />
                )}
              </button>
            </div>
            <button
              onClick={saveKey}
              disabled={!keyInput.trim() || savingKey}
              className="text-[12px] px-2.5 py-1.5 rounded-md font-medium text-white"
              style={{ background: '#0A84FF', opacity: !keyInput.trim() || savingKey ? 0.5 : 1 }}
            >
              {savingKey ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        {testState.kind === 'ok' && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px]" style={{ color: '#30D158' }}>
            <Check size={12} /> Key works.
          </div>
        )}
        {testState.kind === 'err' && (
          <div className="flex items-start gap-1.5 mt-2 text-[11px]" style={{ color: '#FF453A' }}>
            <AlertCircle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
            {testState.msg}
          </div>
        )}
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
          Stored in your macOS Keychain. Get one at platform.openai.com/api-keys.
        </p>
      </div>

      {/* Model */}
      <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
        <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text)' }}>
          Model
        </div>
        <select
          value={settings.model}
          onChange={(e) => update({ model: e.target.value })}
          className="w-full text-[12px] px-2 py-1.5 rounded-md bg-transparent"
          style={{ color: 'var(--text)', border: '1px solid var(--rail-divider)' }}
        >
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — {m.hint}
            </option>
          ))}
        </select>
      </div>

      {/* Variant count */}
      <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
            Options per rephrase
          </span>
          <span className="text-[13px] tabular-nums" style={{ color: 'var(--text)' }}>
            {settings.variantCount}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={1}
          value={settings.variantCount}
          onChange={(e) => update({ variantCount: parseInt(e.target.value, 10) })}
          className="w-full"
        />
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          How many rewrites to show: minimal fix, smoother, then clearer. Each keeps your meaning,
          tone and language — it corrects the writing rather than restyling it.
        </p>
      </div>
    </div>
  );
};

const StatusPill: React.FC<{ kind: 'ok' | 'err' | 'muted'; children: React.ReactNode }> = ({
  kind,
  children,
}) => {
  const map = {
    ok: { bg: 'rgba(48,209,88,0.15)', fg: '#30D158' },
    err: { bg: 'rgba(255,69,58,0.15)', fg: '#FF453A' },
    muted: { bg: 'rgba(120,120,128,0.15)', fg: 'var(--text-muted)' },
  }[kind];
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
      style={{ background: map.bg, color: map.fg }}
    >
      {children}
    </span>
  );
};

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label,
  checked,
  onChange,
}) => (
  <label className="flex items-center justify-between py-0.5 cursor-pointer">
    <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
      {label}
    </span>
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 34,
        height: 20,
        borderRadius: 10,
        background: checked ? '#30D158' : 'rgba(120,120,128,0.32)',
        position: 'relative',
        transition: 'background 160ms',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          transition: 'left 160ms',
        }}
      />
    </button>
  </label>
);
