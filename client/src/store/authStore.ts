import { create } from 'zustand';
import { User } from '../types';
import { authApi, usersApi } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  setToken: (token: string) => void;
  fetchUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: true,

  setToken: (token: string) => {
    localStorage.setItem('token', token);
    set({ token });
  },

  fetchUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ loading: false, user: null });
      return;
    }
    try {
      const res = await authApi.me();
      const userData = res.data.user || res.data;
      // Fetch strike points
      try {
        const strikeRes = await usersApi.myStrikes();
        userData.strikePoints = strikeRes.data.strikePoints ?? 0;
      } catch {}
      set({ user: userData, loading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, loading: false });
    }
  },

  updateUser: (data: Partial<User>) => {
    set((state) => ({ user: state.user ? { ...state.user, ...data } : null }));
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
