import { create } from 'zustand';
import { Group, Message, VideoSession, VideoComment, PresenceEvent } from '../types';
import { groupsApi } from '../services/api';

interface GroupState {
  groups: Group[];
  activeGroup: Group | null;
  onlineUsers: Record<string, boolean>;
  messages: Message[];
  videoSession: VideoSession | null;
  videoComments: VideoComment[];
  loading: boolean;

  fetchGroups: () => Promise<void>;
  fetchGroup: (id: string) => Promise<void>;
  setActiveGroup: (group: Group | null) => void;
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;

  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;

  setVideoSession: (session: VideoSession | null) => void;
  addVideoComment: (comment: VideoComment) => void;

  handlePresence: (event: PresenceEvent) => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  activeGroup: null,
  onlineUsers: {},
  messages: [],
  videoSession: null,
  videoComments: [],
  loading: false,

  fetchGroups: async () => {
    set({ loading: true });
    try {
      const res = await groupsApi.list();
      set({ groups: res.data, loading: false });
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

  setActiveGroup: (group) => set({ activeGroup: group, messages: [], videoSession: null, videoComments: [] }),

  addGroup: (group) => set((state) => ({ groups: [group, ...state.groups] })),

  updateGroup: (group) =>
    set((state) => ({
      groups: state.groups.map((g) => (g.id === group.id ? group : g)),
      activeGroup: state.activeGroup?.id === group.id ? group : state.activeGroup,
    })),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  setVideoSession: (session) => set({ videoSession: session, videoComments: [] }),

  addVideoComment: (comment) =>
    set((state) => ({ videoComments: [...state.videoComments, comment] })),

  handlePresence: ({ userId, online }) =>
    set((state) => ({ onlineUsers: { ...state.onlineUsers, [userId]: online } })),
}));
