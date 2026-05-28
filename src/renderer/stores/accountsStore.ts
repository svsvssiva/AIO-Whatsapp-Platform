import { create } from 'zustand';
import type { Account } from '../../shared/types';

interface AccountsState {
  accounts: Account[];
  activeId: string | null;
  unread: Record<string, number>;
  setAccounts: (a: Account[]) => void;
  setActive: (id: string | null) => void;
  setUnread: (id: string, count: number) => void;
}

export const useAccountsStore = create<AccountsState>((set) => ({
  accounts: [],
  activeId: null,
  unread: {},
  setAccounts: (accounts) =>
    set((s) => ({
      accounts,
      activeId: s.activeId && accounts.some((a) => a.id === s.activeId)
        ? s.activeId
        : accounts[0]?.id ?? null,
    })),
  setActive: (activeId) => set({ activeId }),
  setUnread: (id, count) => set((s) => ({ unread: { ...s.unread, [id]: count } })),
}));
