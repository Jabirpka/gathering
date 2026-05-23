import { create } from 'zustand';
import { User } from '../types';
import { authApi, usersApi } from '../services/api';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const TOKEN_KEY = 'gathering_token';

// Read token — native Preferences on device, localStorage on web
async function readToken(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value;
  }
  return localStorage.getItem('token');
}

async function writeToken(token: string) {
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key: TOKEN_KEY, value: token });
  }
  localStorage.setItem('token', token);
}

async function clearToken() {
  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key: TOKEN_KEY });
  }
  localStorage.removeItem('token');
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  setToken: (token: string) => Promise<void>;
  fetchUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'), // sync init from localStorage
  loading: true,

  setToken: async (token: string) => {
    await writeToken(token);
    set({ token });
  },

  fetchUser: async () => {
    const token = await readToken();
    if (!token) {
      set({ loading: false, user: null });
      return;
    }
    // Make sure token is in localStorage for axios interceptor
    localStorage.setItem('token', token);
    try {
      const res = await authApi.me();
      const userData = res.data.user || res.data;
      try {
        const strikeRes = await usersApi.myStrikes();
        userData.strikePoints = strikeRes.data.strikePoints ?? 0;
      } catch {}
      set({ user: userData, token, loading: false });
    } catch {
      await clearToken();
      set({ user: null, token: null, loading: false });
    }
  },

  updateUser: (data: Partial<User>) => {
    set((state) => ({ user: state.user ? { ...state.user, ...data } : null }));
  },

  logout: async () => {
    await clearToken();
    set({ user: null, token: null });
  },
}));

// Initialize: read token from native storage on startup
(async () => {
  const token = await readToken();
  if (token) {
    localStorage.setItem('token', token);
    useAuthStore.setState({ token });
  }
})();
