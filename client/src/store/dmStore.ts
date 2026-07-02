import { create } from 'zustand';
import { DmThread, Message } from '../types';
import { dmsApi } from '../services/api';

interface DmState {
  threads: DmThread[];
  unreadByThread: Record<string, number>;
  /** Thread whose chat screen is open — its live messages skip the unread count. */
  activeThreadId: string | null;
  /** Messages for the currently open thread only. */
  messages: Message[];

  fetchThreads: () => Promise<void>;
  openThread: (userId: string) => Promise<DmThread>;
  setActiveThread: (threadId: string | null) => void;
  setMessages: (messages: Message[]) => void;
  handleIncoming: (message: Message, myId?: string) => void;
  clearUnread: (threadId: string) => void;
  bumpThread: (threadId: string, message: Message) => void;
}

export const useDmStore = create<DmState>((set, get) => ({
  threads: [],
  unreadByThread: {},
  activeThreadId: null,
  messages: [],

  fetchThreads: async () => {
    try {
      const res = await dmsApi.list();
      const threads: DmThread[] = res.data;
      const unreadByThread: Record<string, number> = {};
      threads.forEach((t) => { unreadByThread[t.id] = t.unreadCount ?? 0; });
      set({ threads, unreadByThread });
    } catch {}
  },

  openThread: async (userId) => {
    const res = await dmsApi.open(userId);
    const thread: DmThread = res.data;
    set((state) => ({
      threads: state.threads.some((t) => t.id === thread.id)
        ? state.threads
        : [thread, ...state.threads],
    }));
    return thread;
  },

  setActiveThread: (threadId) => set({ activeThreadId: threadId, ...(threadId ? {} : { messages: [] }) }),

  setMessages: (messages) => set({ messages }),

  // A dm:message arrived (mine or the partner's, any thread).
  handleIncoming: (message, myId) => {
    const { activeThreadId } = get();
    const threadId = message.threadId!;
    set((state) => {
      const inActive = threadId === activeThreadId;
      return {
        messages: inActive ? [...state.messages, message] : state.messages,
        unreadByThread:
          !inActive && message.userId !== myId
            ? { ...state.unreadByThread, [threadId]: (state.unreadByThread[threadId] ?? 0) + 1 }
            : state.unreadByThread,
      };
    });
    get().bumpThread(threadId, message);
    // Brand-new conversation started by the partner — pull the thread list so
    // the new row (with their name/avatar) appears.
    if (!get().threads.some((t) => t.id === threadId)) {
      get().fetchThreads();
    }
  },

  clearUnread: (threadId) =>
    set((state) => ({ unreadByThread: { ...state.unreadByThread, [threadId]: 0 } })),

  // Refresh the thread's preview + move it to the top of the chats list.
  bumpThread: (threadId, message) =>
    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === threadId
          ? {
              ...t,
              updatedAt: message.createdAt,
              lastMessage: { content: message.content, createdAt: message.createdAt, userId: message.userId },
            }
          : t
      ),
    })),
}));
