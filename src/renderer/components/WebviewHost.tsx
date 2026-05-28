import React, { useEffect, useRef } from 'react';
import type { Account } from '../../shared/types';
import { WA_URL, WA_USER_AGENT, partitionFor } from '../../shared/types';
import { AiReply } from './AiReply';

interface Props {
  account: Account;
  active: boolean;
  reloadKey: number;
}

export const WebviewPane: React.FC<Props> = ({ account, active, reloadKey }) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const wv = ref.current as HTMLElement & {
      reload?: () => void;
      getWebContentsId?: () => number;
      addEventListener: HTMLElement['addEventListener'];
    };
    if (reloadKey > 0 && wv.reload) wv.reload();

    const onDomReady = () => {
      try {
        const id = wv.getWebContentsId?.();
        if (typeof id === 'number') {
          window.gchat.registerWebview(id, account.id);
          wcIdByAccount.set(account.id, id);
        }
      } catch {
        /* ignore */
      }
    };
    wv.addEventListener('dom-ready', onDomReady as EventListener);
    return () => wv.removeEventListener('dom-ready', onDomReady as EventListener);
  }, [reloadKey, account.id]);

  return React.createElement('webview', {
    ref,
    src: WA_URL,
    partition: partitionFor(account.id),
    useragent: WA_USER_AGENT,
    allowpopups: 'true',
    style: {
      display: active ? 'inline-flex' : 'none',
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      background: '#0b141a',
    } as React.CSSProperties,
  });
};

// Map of accountId -> webContents id, populated as webviews attach
export const wcIdByAccount = new Map<string, number>();

interface HostProps {
  accounts: Account[];
  activeId: string | null;
  reloadKeys: Record<string, number>;
  onOpenSettings: () => void;
  aiReplyRef?: React.MutableRefObject<{ trigger: () => void } | null>;
}

export const WebviewHost: React.FC<HostProps> = ({
  accounts,
  activeId,
  reloadKeys,
  onOpenSettings,
  aiReplyRef,
}) => {
  return (
    <div className="relative flex-1">
      {accounts.map((a) => (
        <WebviewPane
          key={a.id}
          account={a}
          active={a.id === activeId}
          reloadKey={reloadKeys[a.id] ?? 0}
        />
      ))}
      <AiReply onOpenSettings={onOpenSettings} triggerRef={aiReplyRef} />
    </div>
  );
};
