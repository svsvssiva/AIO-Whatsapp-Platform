import React, { useEffect, useState } from 'react';
import { X, Bell, HardDrive, Info, Image as ImageIcon, RotateCcw, Trash2, Sparkles, NotebookPen } from 'lucide-react';
import { SettingsAiTab } from './SettingsAiTab';
import { SettingsMemoryTab } from './SettingsMemoryTab';
import type { AccountStorageInfo, AppSettings, NotificationPrefs } from '../../shared/types';
import { DEFAULT_NOTIFICATION_PREFS } from '../../shared/types';
import { useAccountsStore } from '../stores/accountsStore';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenMemory?: (accountId: string, chatKey: string) => void;
}

type Tab = 'notifications' | 'storage' | 'ai' | 'memory' | 'about';

function fmt(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function relTime(ts: number): string {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const SettingsPanel: React.FC<Props> = ({ open, onClose, onOpenMemory }) => {
  const { accounts } = useAccountsStore();
  const [tab, setTab] = useState<Tab>('notifications');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [storage, setStorage] = useState<AccountStorageInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refreshStorage = async () => {
    const s = await window.gchat.getStorage();
    setStorage(s);
  };

  useEffect(() => {
    if (!open) return;
    window.gchat.getSettings().then(setSettings);
    refreshStorage();
  }, [open]);

  if (!open || !settings) return open ? <div /> : null;

  const totalBytes = storage.reduce((a, s) => a + s.bytes, 0);

  const updatePrefs = async (id: string, patch: Partial<NotificationPrefs>) => {
    await window.gchat.setNotifPrefs(id, patch);
    // sync local store
    const list = await window.gchat.listAccounts();
    useAccountsStore.getState().setAccounts(list);
  };

  const updateSettings = async (patch: Partial<AppSettings>) => {
    const next = await window.gchat.setSettings(patch);
    setSettings(next);
  };

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
          width: 420,
          background: 'var(--titlebar-bg)',
          backdropFilter: 'blur(40px)',
          borderLeft: '1px solid var(--rail-divider)',
        }}
      >
        <header className="flex items-center justify-between h-[42px] px-4 border-b" style={{ borderColor: 'var(--rail-divider)' }}>
          <span className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
            Settings
          </span>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close">
            <X size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </header>

        <nav className="flex border-b" style={{ borderColor: 'var(--rail-divider)' }}>
          {([
            ['notifications', Bell, 'Notifications'],
            ['storage', HardDrive, 'Storage'],
            ['ai', Sparkles, 'AI'],
            ['memory', NotebookPen, 'Memory'],
            ['about', Info, 'About'],
          ] as Array<[Tab, typeof Bell, string]>).map(([key, Icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium"
              style={{
                color: tab === key ? 'var(--text)' : 'var(--text-muted)',
                borderBottom: tab === key ? '2px solid #0A84FF' : '2px solid transparent',
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'notifications' && (
            <div className="space-y-4">
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                Each account gets its own notification prefix and behavior. macOS Focus / Do Not Disturb still applies globally.
              </p>
              {accounts.length === 0 && (
                <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  Add an account first.
                </div>
              )}
              {accounts.map((a) => {
                const p = { ...DEFAULT_NOTIFICATION_PREFS, ...a.notifications };
                return (
                  <div key={a.id} className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: a.color }} />
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                        {a.label}
                      </span>
                    </div>
                    <Toggle
                      label="Show notifications"
                      checked={p.enabled}
                      onChange={(v) => updatePrefs(a.id, { enabled: v })}
                    />
                    <Toggle
                      label="Show message preview"
                      checked={p.showPreview}
                      disabled={!p.enabled}
                      onChange={(v) => updatePrefs(a.id, { showPreview: v })}
                    />
                    <Toggle
                      label="Play sound"
                      checked={p.sound}
                      disabled={!p.enabled}
                      onChange={(v) => updatePrefs(a.id, { sound: v })}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'storage' && (
            <div className="space-y-4">
              <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                    Total used
                  </span>
                  <span className="text-[13px] tabular-nums" style={{ color: 'var(--text)' }}>
                    {fmt(totalBytes)}
                  </span>
                </div>
                {storage.map((s) => {
                  const acc = accounts.find((a) => a.id === s.accountId);
                  if (!acc) return null;
                  return (
                    <div key={s.accountId} className="flex items-center gap-2 py-1.5">
                      <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: acc.color }} />
                      <span className="flex-1 text-[13px]" style={{ color: 'var(--text)' }}>
                        {acc.label}
                      </span>
                      <span className="text-[12px] tabular-nums mr-2" style={{ color: 'var(--text-muted)' }}>
                        {fmt(s.bytes)}
                      </span>
                      <button
                        onClick={async () => {
                          setBusy(s.accountId);
                          await window.gchat.clearStorageCache(s.accountId);
                          await refreshStorage();
                          setBusy(null);
                        }}
                        disabled={busy === s.accountId}
                        className="text-[11px] px-2 py-1 rounded-md"
                        style={{ background: 'rgba(10,132,255,0.15)', color: '#0A84FF' }}
                        title={`Last cleaned ${relTime(s.lastCleanedAt)}`}
                      >
                        {busy === s.accountId ? 'Clearing…' : 'Clear Cache'}
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={refreshStorage}
                  className="text-[11px] mt-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Refresh
                </button>
              </div>

              <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
                <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text)' }}>
                  Auto-cleanup
                </div>
                <Toggle
                  label="Enable automatic cleanup"
                  checked={settings.autoCleanEnabled}
                  onChange={(v) => updateSettings({ autoCleanEnabled: v })}
                />
                <Row label="Clear when account exceeds">
                  <select
                    value={settings.autoCleanMaxBytes}
                    disabled={!settings.autoCleanEnabled}
                    onChange={(e) => updateSettings({ autoCleanMaxBytes: parseInt(e.target.value, 10) })}
                    className="bg-transparent text-[12px]"
                    style={{ color: 'var(--text)' }}
                  >
                    <option value={200 * 1024 * 1024}>200 MB</option>
                    <option value={500 * 1024 * 1024}>500 MB</option>
                    <option value={1024 * 1024 * 1024}>1 GB</option>
                    <option value={2 * 1024 * 1024 * 1024}>2 GB</option>
                    <option value={5 * 1024 * 1024 * 1024}>5 GB</option>
                  </select>
                </Row>
                <Row label="Or last cleaned over">
                  <select
                    value={settings.autoCleanMaxAgeDays}
                    disabled={!settings.autoCleanEnabled}
                    onChange={(e) => updateSettings({ autoCleanMaxAgeDays: parseInt(e.target.value, 10) })}
                    className="bg-transparent text-[12px]"
                    style={{ color: 'var(--text)' }}
                  >
                    <option value={14}>14 days ago</option>
                    <option value={30}>30 days ago</option>
                    <option value={60}>60 days ago</option>
                    <option value={90}>90 days ago</option>
                  </select>
                </Row>
                <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  Auto-cleanup only clears media cache. Your sign-in is never touched.
                </p>
              </div>

              <details className="rounded-lg p-3" style={{ background: 'rgba(255,69,58,0.06)' }}>
                <summary className="text-[13px] font-semibold cursor-pointer" style={{ color: '#FF453A' }}>
                  Danger zone
                </summary>
                <div className="mt-2 space-y-2">
                  {accounts.map((a) => (
                    <button
                      key={a.id}
                      onClick={async () => {
                        if (!window.confirm(`Wipe ALL data for "${a.label}"? You'll need to re-scan the QR.`)) return;
                        await window.gchat.clearStorageAll(a.id);
                        await refreshStorage();
                      }}
                      className="w-full text-left text-[12px] px-2 py-1.5 rounded-md flex items-center gap-2"
                      style={{ background: 'rgba(255,69,58,0.1)', color: '#FF453A' }}
                    >
                      <Trash2 size={12} />
                      Wipe all data for {a.label}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          )}

          {tab === 'ai' && <SettingsAiTab />}

          {tab === 'memory' && (
            <SettingsMemoryTab
              onOpen={(accountId, chatKey) => {
                onClose();
                onOpenMemory?.(accountId, chatKey);
              }}
            />
          )}

          {tab === 'about' && (
            <div className="space-y-3 text-[13px]" style={{ color: 'var(--text)' }}>
              <div className="font-semibold text-[16px]">GChat</div>
              <div style={{ color: 'var(--text-muted)' }}>
                Multi-account WhatsApp Web for macOS. Each account runs in an isolated browser session.
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                Tip: right-click any account tile for rename, icon, color, reload, log out, or remove.
              </div>
              <div className="pt-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                Version 0.1.0 · Internal use only
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

const Toggle: React.FC<{ label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }> = ({
  label,
  checked,
  disabled,
  onChange,
}) => (
  <label
    className="flex items-center justify-between py-1.5"
    style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
  >
    <span className="text-[12px]" style={{ color: 'var(--text)' }}>
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

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
      {label}
    </span>
    {children}
  </div>
);
