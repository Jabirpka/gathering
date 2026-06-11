import { create } from 'zustand';

export interface ActiveCallInfo {
  roomName: string;
  groupId: string;
  roomId: string;
  roomLabel: string;
  displayName: string;
}

interface CallStore {
  call: ActiveCallInfo | null;
  /** DOM node (rendered by RoomPage) the full call UI should be portaled into. */
  mountNode: HTMLElement | null;
  joinCall: (info: ActiveCallInfo) => void;
  leaveCall: () => void;
  setMountNode: (node: HTMLElement | null) => void;
}

export const useCallStore = create<CallStore>((set, get) => ({
  call: null,
  mountNode: null,
  joinCall: (info) => {
    const current = get().call;
    if (current?.roomId === info.roomId) return;
    set({ call: info, mountNode: null });
  },
  leaveCall: () => set({ call: null, mountNode: null }),
  setMountNode: (node) => set({ mountNode: node }),
}));
