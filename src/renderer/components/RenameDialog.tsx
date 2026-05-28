import React, { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  initialValue: string;
  title?: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}

export const RenameDialog: React.FC<Props> = ({ open, initialValue, title = 'Rename account', onClose, onConfirm }) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
    }
  }, [open, initialValue]);

  if (!open) return null;

  const submit = () => {
    const v = value.trim();
    if (v) onConfirm(v);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-32"
      style={{ background: 'rgba(0,0,0,0.32)' }}
      onClick={onClose}
    >
      <div
        className="w-[380px] rounded-xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--titlebar-bg)', backdropFilter: 'blur(40px)', border: '1px solid var(--rail-divider)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </div>
        <div className="px-4 pb-3">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') onClose();
            }}
            className="w-full px-3 py-2 rounded-md text-[14px] outline-none"
            style={{
              background: 'rgba(0,0,0,0.06)',
              color: 'var(--text)',
              border: '1px solid var(--rail-divider)',
            }}
            placeholder="Account name"
            maxLength={40}
          />
        </div>
        <div className="px-4 pb-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[13px]"
            style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text)' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="px-3 py-1.5 rounded-md text-[13px] font-medium text-white"
            style={{ background: '#0A84FF', opacity: value.trim() ? 1 : 0.5 }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
