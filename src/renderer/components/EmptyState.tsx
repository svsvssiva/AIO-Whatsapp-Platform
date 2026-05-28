import React from 'react';
import { MessageSquarePlus } from 'lucide-react';

interface Props {
  onAdd: () => void;
}

export const EmptyState: React.FC<Props> = ({ onAdd }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <div
        className="flex items-center justify-center mb-6"
        style={{ width: 84, height: 84, borderRadius: '50%', background: 'rgba(10,132,255,0.12)' }}
      >
        <MessageSquarePlus size={40} style={{ color: '#0A84FF' }} />
      </div>
      <h1 className="text-[24px] font-semibold mb-2" style={{ color: 'var(--text)' }}>
        Add your first WhatsApp account
      </h1>
      <p className="text-[14px] mb-6 text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>
        Each account runs in an isolated session. Scan the QR with your phone to link a device.
      </p>
      <button
        onClick={onAdd}
        className="px-4 py-2 rounded-lg font-medium text-[14px] text-white"
        style={{ background: '#0A84FF' }}
      >
        Scan QR Code
      </button>
    </div>
  );
};
