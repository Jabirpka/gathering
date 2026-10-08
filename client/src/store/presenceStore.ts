import { create } from 'zustand';
import { usersApi } from '../services/api';

/**
 * Who among my people is "available now". Seeded from GET /users/presence and
 * kept live by `presence:update` socket events (wired in App.tsx).
 */
interface PresenceState {
  online: Set<string>;
  setOnline: (ids: string[]) => void;
  update: (userId: string, online: boolean) => void;
  fetch: () => Promise<void>;
  isOnline: (userId: string) => boolean;
  clear: () => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  online: new Set<string>(),
  setOnline: (ids) => set({ online: new Set(ids) }),
  update: (userId, online) =>
    set((state) => {
      const next = new Set(state.online);
      if (online) next.add(userId);
      else next.delete(userId);
      return { online: next };
    }),
  fetch: async () => {
    try {
      const res = await usersApi.presence();
      set({ online: new Set<string>(res.data.online ?? []) });
    } catch {}
  },
  isOnline: (userId) => get().online.has(userId),
  clear: () => set({ online: new Set<string>() }),
}));
