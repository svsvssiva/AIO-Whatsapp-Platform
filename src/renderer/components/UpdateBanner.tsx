import React, { useEffect, useState } from 'react';
import { Download, RotateCw, X, CheckCircle2 } from 'lucide-react';
import type { UpdateStatus } from '../../shared/types';

export const UpdateBanner: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    window.gchat.update.getInfo().then((info) => setStatus(info.status));
    const off = window.gchat.update.onStatus((s) => {
      setStatus(s);
      // Reset dismiss on a state change that warrants showing again
      if (s.state === 'available' || s.state === 'ready') setDismissed(false);
    });
    return off;
  }, []);

  // Hide for idle / dev / dismissed states
  if (dismissed) return null;
  if (status.state === 'idle' || status.state === 'disabled-dev' || status.state === 'checking') return null;
  if (status.state === 'error') return null; // silently retry on schedule

  const isReady = status.state === 'ready';
  const isDownloading = status.state === 'downloading';
  const isAvailable = status.state === 'available';

  const bg = isReady ? 'rgba(48,209,88,0.18)' : 'rgba(10,132,255,0.18)';
  const fg = isReady ? '#30D158' : '#0A84FF';
  const border = isReady ? 'rgba(48,209,88,0.45)' : 'rgba(10,132,255,0.40)';

  let label = '';
  if (isAvailable) label = `Update available — v${status.version} downloading…`;
  if (isDownloading) label = `Downloading update… ${status.percent}%`;
  if (isReady) label = `Update v${status.version} ready — restart to install`;

  return (
    <div
      className="app-drag flex items-center gap-2 px-3 py-1.5"
      style={{
        background: bg,
        borderBottom: `1px solid ${border}`,
        color: fg,
        fontSize: 12,
        fontWeight: 500,
        userSelect: 'none',
      }}
    >
      {isReady ? <CheckCircle2 size={13} /> : isDownloading ? <RotateCw size={13} className="animate-spin" /> : <Download size={13} />}
      <span className="flex-1">{label}</span>
      {isReady && (
        <button
          onClick={() => window.gchat.update.install()}
          className="app-no-drag px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-white"
          style={{ background: '#30D158' }}
        >
          Restart & Install
        </button>
      )}
      {(isAvailable || isDownloading) && (
        <button
          onClick={() => setDismissed(true)}
          className="app-no-drag p-0.5 rounded-md hover:bg-black/10"
          aria-label="Hide"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};
