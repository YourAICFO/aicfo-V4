import { create } from 'zustand';
import { subscriptionApi } from '../services/api';

export type SubscriptionStatus = 'trial' | 'active' | 'expired';

interface SubscriptionState {
  status: SubscriptionStatus | null;
  trialEndDate: string | null;
  trialEndsInDays: number | null;
  accountLocked: boolean;
  loading: boolean;
  error: string | null;
  isPaidUser: boolean;
  isTrial: boolean;
  isExpired: boolean;
  refresh: () => Promise<void>;
  reset: () => void;
}

const deriveFlags = (status: SubscriptionStatus | null) => ({
  isPaidUser: status === 'active' || status === 'trial',
  isTrial: status === 'trial',
  isExpired: status === 'expired'
});

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  status: null,
  trialEndDate: null,
  trialEndsInDays: null,
  accountLocked: false,
  loading: false,
  error: null,
  isPaidUser: false,
  isTrial: false,
  isExpired: false,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const response = await subscriptionApi.getStatus();
      const data = response.data?.data || response.data;
      const status = (data?.status || null) as SubscriptionStatus | null;
      const trialEndDate = data?.trialEndDate || null;
      const trialEndsInDays = data?.trialEndsInDays ?? null;
      const accountLocked = Boolean(data?.accountLocked);
      const flags = deriveFlags(status);
      set({
        status,
        trialEndDate,
        trialEndsInDays,
        accountLocked,
        ...flags
      });
    } catch (error: any) {
      set({ error: error?.message || 'Failed to load subscription status' });
    } finally {
      set({ loading: false });
    }
  },
  reset: () => {
    const flags = deriveFlags(null);
    set({
      status: null,
      trialEndDate: null,
      trialEndsInDays: null,
      accountLocked: false,
      loading: false,
      error: null,
      ...flags
    });
  }
}));
