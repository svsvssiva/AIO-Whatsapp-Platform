import React, { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, AlertCircle, Sparkles } from 'lucide-react';
import {
  AI_LANGUAGES,
  AI_MODELS,
  AI_TONES,
  AISettings,
  AITone,
  AILength,
  RedactionPrefs,
  DEFAULT_REDACTION_PREFS,
} from '../../shared/types';

export const SettingsAiTab: React.FC = () => {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [testState, setTestState] = useState<
    { kind: 'idle' } | { kind: 'testing' } | { kind: 'ok' } | { kind: 'err'; msg: string }
  >({ kind: 'idle' });
  const [savingKey, setSavingKey] = useState(false);

  const refresh = async () => {
    const s = await window.gchat.ai.getSettings();
    setSettings(s);
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!settings) return <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

  const update = async (patch: Partial<AISettings>) => {
    const next = await window.gchat.ai.setSettings(patch);
    setSettings(next);
  };

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
    // Auto-test
    setTestState({ kind: 'testing' });
    const t = await window.gchat.ai.testKey();
    if (t.ok) setTestState({ kind: 'ok' });
    else setTestState({ kind: 'err', msg: t.error });
  };

  const clearKey = async () => {
    await window.gchat.ai.clearKey();
    setTestState({ kind: 'idle' });
    await refresh();
  };

  const runTest = async () => {
    setTestState({ kind: 'testing' });
    const t = await window.gchat.ai.testKey();
    if (t.ok) setTestState({ kind: 'ok' });
    else setTestState({ kind: 'err', msg: t.error });
  };

  return (
    <div className="space-y-4">
      {/* Master toggle */}
      <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
        <Toggle
          label="Enable AI reply"
          checked={settings.enabled}
          onChange={(v) => update({ enabled: v, acknowledgedPrivacy: settings.acknowledgedPrivacy || v })}
        />
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Adds a floating sparkle button to each chat. Tap it to draft a reply.
        </p>
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
              className="text-[12px] px-3 py-1.5 rounded-md font-medium text-white"
              style={{ background: '#0A84FF', opacity: keyInput.trim() && !savingKey ? 1 : 0.5 }}
            >
              {savingKey ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        {testState.kind === 'err' && (
          <div className="flex items-start gap-1.5 mt-2">
            <AlertCircle size={12} style={{ color: '#FF453A', marginTop: 2 }} />
            <span className="text-[11px]" style={{ color: '#FF453A' }}>
              {testState.msg}
            </span>
          </div>
        )}
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
          Stored encrypted in your macOS Keychain. Never sent anywhere except OpenAI.
        </p>
      </div>

      {/* About Me */}
      <Section title="About me (used in every AI reply)">
        <textarea
          value={settings.aboutMe ?? ''}
          onChange={(e) => update({ aboutMe: e.target.value })}
          placeholder="I am Alex, Account Manager at Acme Corp. I sign off as 'Cheers, Alex'. I prefer polite, concise replies in English unless the contact writes in another language."
          className="w-full text-[13px] px-2 py-1.5 rounded-md outline-none resize-none"
          style={{
            background: 'rgba(0,0,0,0.06)',
            color: 'var(--text)',
            border: '1px solid var(--rail-divider)',
            minHeight: 120,
            fontFamily: 'inherit',
            lineHeight: 1.5,
          }}
        />
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
          Always sent as part of the AI prompt. Add your name, role, voice quirks, signature, language preference.
        </p>
      </Section>

      {/* Model */}
      <Section title="Model">
        <select
          value={settings.model}
          onChange={(e) => update({ model: e.target.value })}
          className="w-full bg-transparent text-[13px] outline-none"
          style={{
            color: 'var(--text)',
            border: '1px solid var(--rail-divider)',
            borderRadius: 6,
            padding: '6px 8px',
          }}
        >
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — {m.hint}
            </option>
          ))}
        </select>
      </Section>

      {/* Tone */}
      <Section title="Tone">
        <div className="flex flex-wrap gap-1.5">
          {AI_TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => update({ tone: t.id })}
              className="text-[12px] px-2.5 py-1 rounded-full"
              style={{
                background: settings.tone === t.id ? '#0A84FF' : 'rgba(0,0,0,0.06)',
                color: settings.tone === t.id ? '#fff' : 'var(--text)',
                border: '1px solid transparent',
              }}
              title={t.blurb}
            >
              {t.label}
            </button>
          ))}
        </div>
        {settings.tone === 'custom' && (
          <textarea
            value={settings.customTone ?? ''}
            onChange={(e) => update({ customTone: e.target.value })}
            placeholder="Describe your tone — e.g. 'witty, dry, never uses exclamation marks'"
            className="w-full text-[13px] mt-2 px-2 py-1.5 rounded-md outline-none resize-none"
            style={{
              background: 'rgba(0,0,0,0.06)',
              color: 'var(--text)',
              border: '1px solid var(--rail-divider)',
              minHeight: 60,
            }}
          />
        )}
      </Section>

      {/* Length */}
      <Section title="Length">
        <div
          className="inline-flex rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--rail-divider)' }}
        >
          {(['brief', 'medium', 'detailed'] as AILength[]).map((l) => (
            <button
              key={l}
              onClick={() => update({ length: l })}
              className="text-[12px] px-3 py-1.5"
              style={{
                background: settings.length === l ? '#0A84FF' : 'transparent',
                color: settings.length === l ? '#fff' : 'var(--text)',
              }}
            >
              {l[0].toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
      </Section>

      {/* Context */}
      <Section title={`Send last ${settings.contextMessages} messages`}>
        <input
          type="range"
          min={5}
          max={50}
          step={1}
          value={settings.contextMessages}
          onChange={(e) => update({ contextMessages: parseInt(e.target.value, 10) })}
          className="w-full"
        />
        <div className="flex justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span>5</span>
          <span>50</span>
        </div>
      </Section>

      {/* Custom instructions */}
      <Section title="Custom instructions">
        <textarea
          value={settings.customInstructions ?? ''}
          onChange={(e) => update({ customInstructions: e.target.value })}
          placeholder="e.g. always sign off with 'Cheers, Alex'"
          className="w-full text-[13px] px-2 py-1.5 rounded-md outline-none resize-none"
          style={{
            background: 'rgba(0,0,0,0.06)',
            color: 'var(--text)',
            border: '1px solid var(--rail-divider)',
            minHeight: 70,
          }}
        />
      </Section>

      {/* Language */}
      <Section title="Reply language">
        <select
          value={settings.language}
          onChange={(e) => update({ language: e.target.value })}
          className="w-full bg-transparent text-[13px] outline-none"
          style={{
            color: 'var(--text)',
            border: '1px solid var(--rail-divider)',
            borderRadius: 6,
            padding: '6px 8px',
          }}
        >
          {AI_LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </Section>

      {/* Redaction (credential filter) */}
      <Section title="Redaction (don't send credentials to AI)">
        <RedactionEditor
          value={{ ...DEFAULT_REDACTION_PREFS, ...(settings.redaction ?? {}) }}
          onChange={(r) => update({ redaction: r })}
        />
      </Section>

      {/* Privacy */}
      <details className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
        <summary className="text-[12px] font-semibold cursor-pointer" style={{ color: 'var(--text)' }}>
          Privacy
        </summary>
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
          When you tap the AI button on a chat, GChat reads the last{' '}
          <strong>{settings.contextMessages}</strong> messages from that conversation and sends them
          to OpenAI to draft a reply. WhatsApp's end-to-end encryption protects messages in transit
          between you and contacts; this AI feature is a separate channel from your Mac to OpenAI.
          You can turn it off at the top of this tab any time, or clear your key.
        </p>
      </details>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
    <div className="text-[12px] font-semibold mb-1.5" style={{ color: 'var(--text)' }}>
      {title}
    </div>
    {children}
  </div>
);

const StatusPill: React.FC<{ kind: 'ok' | 'err' | 'muted'; children: React.ReactNode }> = ({
  kind,
  children,
}) => {
  const colors =
    kind === 'ok'
      ? { bg: 'rgba(48,209,88,0.15)', fg: '#30D158' }
      : kind === 'err'
      ? { bg: 'rgba(255,69,58,0.15)', fg: '#FF453A' }
      : { bg: 'rgba(0,0,0,0.08)', fg: 'var(--text-muted)' };
  return (
    <span
      className="text-[11px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{ background: colors.bg, color: colors.fg }}
    >
      {kind === 'ok' && <Check size={10} />}
      {children}
    </span>
  );
};

const RedactionEditor: React.FC<{ value: RedactionPrefs; onChange: (v: RedactionPrefs) => void }> = ({ value, onChange }) => {
  const set = <K extends keyof RedactionPrefs>(k: K, v: RedactionPrefs[K]) =>
    onChange({ ...value, [k]: v });

  const ROWS: Array<{ key: keyof RedactionPrefs; label: string; hint: string }> = [
    { key: 'apiKeys', label: 'API keys', hint: 'sk-…, AKIA…, ghp_…, xox_, AIza…, JWT, etc.' },
    { key: 'tokens', label: 'Tokens & passwords', hint: '"password: …", "token: …", Bearer tokens' },
    { key: 'otpCodes', label: 'OTP / verification codes', hint: '"OTP: 1234", "verification code 567890"' },
    { key: 'creditCards', label: 'Credit cards', hint: 'Luhn-valid 13–19 digit numbers' },
    { key: 'iban', label: 'Bank IBANs', hint: 'Country-prefix IBAN format' },
    { key: 'emails', label: 'Email addresses', hint: 'Off by default — emails are often valid context' },
    { key: 'phones', label: 'Phone numbers', hint: 'Off by default — many WA chats reference numbers' },
    { key: 'longNumbers', label: 'Any 10+ digit number', hint: 'Aggressive catch-all (IC, bank acct, etc.)' },
  ];

  return (
    <div className="space-y-1.5">
      <Toggle label="Enable redaction" checked={value.enabled} onChange={(v) => set('enabled', v)} />
      <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>
        Each message is scanned before being sent to OpenAI. Matches become <code>[REDACTED:…]</code> in the prompt.
        The original messages in WhatsApp are NOT changed.
      </p>
      <div className="rounded-md p-2" style={{ background: 'rgba(0,0,0,0.04)', opacity: value.enabled ? 1 : 0.5 }}>
        {ROWS.map((r) => (
          <div key={r.key} className="py-1">
            <Toggle
              label={r.label}
              checked={!!value[r.key]}
              disabled={!value.enabled}
              onChange={(v) => set(r.key, v as never)}
            />
            <p className="text-[11px] ml-1" style={{ color: 'var(--text-muted)' }}>
              {r.hint}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <span className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>
          Custom patterns
        </span>
        <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>
          One regex per line. Case-insensitive. Invalid patterns are silently ignored.
        </p>
        <textarea
          value={(value.customPatterns ?? []).join('\n')}
          onChange={(e) => set('customPatterns', e.target.value.split('\n'))}
          placeholder={'\\bMYR\\s?\\d{4,}\\b\nproject-codename-x'}
          className="w-full text-[12px] px-2 py-1.5 rounded-md outline-none resize-none"
          style={{
            background: 'rgba(0,0,0,0.06)',
            color: 'var(--text)',
            border: '1px solid var(--rail-divider)',
            minHeight: 70,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        />
      </div>
    </div>
  );
};

const Toggle: React.FC<{ label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }> = ({
  label,
  checked,
  disabled,
  onChange,
}) => (
  <label
    className="flex items-center justify-between"
    style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
  >
    <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
      <Sparkles size={13} style={{ color: '#0A84FF' }} />
      {label}
    </span>
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 34,
        height: 20,
        borderRadius: 10,
        background: checked ? '#30D158' : 'rgba(120,120,128,0.32)',
        position: 'relative',
        transition: 'background 160ms',
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
