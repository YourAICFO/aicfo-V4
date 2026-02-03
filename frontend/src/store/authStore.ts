import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  selectedCompanyId: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  setSelectedCompany: (companyId: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      selectedCompanyId: null,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false, selectedCompanyId: null }),
      setSelectedCompany: (companyId) => set({ selectedCompanyId: companyId }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
