import { create } from 'zustand';

interface UpgradeModalState {
  open: boolean;
  message: string;
  openModal: (message?: string) => void;
  close: () => void;
}

export const useUpgradeModalStore = create<UpgradeModalState>((set) => ({
  open: false,
  message: '',
  openModal: (message = 'Upgrade to continue.') => set({ open: true, message }),
  close: () => set({ open: false, message: '' }),
}));
