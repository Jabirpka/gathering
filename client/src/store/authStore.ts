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

/**
 * Read the iOS PWA bridge cookie (set by AuthCallback after OAuth in Safari).
 * Consumes it immediately so it cannot be replayed.
 */
function consumeAuthCookie(): string | null {
  const match = document.cookie.match(/(?:^|; )gathering_auth=([^;]*)/);
  if (!match) return null;
  // Clear the cookie right away
  document.cookie = 'gathering_auth=; path=/; max-age=0; SameSite=Lax';
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

// Initialize: prefer cookie bridge (iOS PWA) → native Preferences → localStorage
(async () => {
  const cookieToken = consumeAuthCookie();
  if (cookieToken) {
    // Token just arrived from Safari via cookie — persist it properly
    await writeToken(cookieToken);
    localStorage.setItem('token', cookieToken);
    useAuthStore.setState({ token: cookieToken });
    return;
  }
  const token = await readToken();
  if (token) {
    localStorage.setItem('token', token);
    useAuthStore.setState({ token });
  }
})();
