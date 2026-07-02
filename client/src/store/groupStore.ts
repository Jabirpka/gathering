import { create } from 'zustand';
import { Group, Message, PresenceEvent } from '../types';
import { groupsApi } from '../services/api';

interface GroupState {
  groups: Group[];
  activeGroup: Group | null;
  onlineUsers: Record<string, boolean>;
  messages: Message[];
  loading: boolean;
  unreadByGroup: Record<string, number>;
  // The group whose chat is currently open — live unread signals for it are
  // ignored so its badge doesn't tick up while the user is reading.
  activeChatGroupId: string | null;

  fetchGroups: () => Promise<void>;
  fetchGroup: (id: string) => Promise<void>;
  setActiveGroup: (group: Group | null) => void;
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
  removeGroup: (id: string) => void;

  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;

  incrementUnread: (groupId: string) => void;
  clearUnread: (groupId: string) => void;
  setActiveChatGroup: (groupId: string | null) => void;
  updateGroupPreview: (groupId: string, message: NonNullable<Group['lastMessage']>) => void;

  handlePresence: (event: PresenceEvent) => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  activeGroup: null,
  onlineUsers: {},
  messages: [],
  loading: false,
  unreadByGroup: {},
  activeChatGroupId: null,

  fetchGroups: async () => {
    set({ loading: true });
    try {
      const res = await groupsApi.list();
      const groups: Group[] = res.data;
      const unreadByGroup: Record<string, number> = {};
      groups.forEach((g) => { unreadByGroup[g.id] = g.unreadCount ?? 0; });
      set({ groups, unreadByGroup, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchGroup: async (id: string) => {
    set({ loading: true });
    try {
      const res = await groupsApi.get(id);
      set({ activeGroup: res.data, loading: false });
      const groups = get().groups;
      const idx = groups.findIndex((g) => g.id === id);
      if (idx >= 0) {
        const updated = [...groups];
        updated[idx] = res.data;
        set({ groups: updated });
      }
    } catch {
      set({ loading: false });
    }
  },

  setActiveGroup: (group) => set({ activeGroup: group, messages: [] }),

  addGroup: (group) => set((state) => ({ groups: [group, ...state.groups] })),

  updateGroup: (group) =>
    set((state) => ({
      groups: state.groups.map((g) => (g.id === group.id ? group : g)),
      activeGroup: state.activeGroup?.id === group.id ? group : state.activeGroup,
    })),

  removeGroup: (id) =>
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== id),
      activeGroup: state.activeGroup?.id === id ? null : state.activeGroup,
      messages: state.activeGroup?.id === id ? [] : state.messages,
    })),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  incrementUnread: (groupId) =>
    set((state) => {
      // Skip if the user is currently reading this group's chat.
      if (state.activeChatGroupId === groupId) return {};
      return { unreadByGroup: { ...state.unreadByGroup, [groupId]: (state.unreadByGroup[groupId] ?? 0) + 1 } };
    }),

  clearUnread: (groupId) =>
    set((state) => ({ unreadByGroup: { ...state.unreadByGroup, [groupId]: 0 } })),

  setActiveChatGroup: (groupId) => set({ activeChatGroupId: groupId }),

  // Keep the chats-list row (preview + ordering) fresh as messages arrive.
  updateGroupPreview: (groupId, message) =>
    set((state) => ({
      groups: state.groups.map((g) => (g.id === groupId ? { ...g, lastMessage: message } : g)),
    })),

  handlePresence: ({ userId, online }) =>
    set((state) => ({ onlineUsers: { ...state.onlineUsers, [userId]: online } })),
}));
