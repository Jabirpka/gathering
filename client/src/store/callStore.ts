import { create } from 'zustand';

export interface ActiveCallInfo {
  roomName: string;
  /** Group call membership (token via group). */
  groupId?: string;
  /** DM call — token is scoped to the thread instead of a group. */
  threadId?: string;
  roomId: string;
  roomLabel: string;
  displayName: string;
  /** Voice call — join with the camera off (WhatsApp-style audio call). */
  audioOnly?: boolean;
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
    // Don't touch mountNode here — RoomPage's ref callback runs before this
    // effect and has already set it to the room's mount point (or left it
    // null if we're joining from elsewhere, which correctly starts minimized).
    set({ call: info });
  },
  leaveCall: () => set({ call: null, mountNode: null }),
  setMountNode: (node) => set({ mountNode: node }),
}));
