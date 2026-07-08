import { create } from 'zustand';
import { getSocket } from '../hooks/useSocket';

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

    // Don't touch mountNode here — the call page's ref callback runs before this
    // effect and has already set it to the page's mount point (or left it null
    // if we're joining from elsewhere, which correctly starts minimized).
    set({ call: info });

    // Announce presence so the OTHER side rings. This is tied to the call's
    // lifetime, not to any page: navigating away only minimizes the call (the
    // LiveKit connection and the ring both stay alive). Only leaveCall() below
    // tells the server the call is over.
    const socket = getSocket();
    if (info.threadId) {
      socket?.emit('dmcall:join', { threadId: info.threadId, type: info.audioOnly ? 'audio' : 'video' });
    } else if (info.groupId) {
      socket?.emit('room:join', { roomId: info.roomId, groupId: info.groupId });
    }
  },
  leaveCall: () => {
    const current = get().call;
    if (current) {
      const socket = getSocket();
      if (current.threadId) socket?.emit('dmcall:leave', { threadId: current.threadId });
      else if (current.groupId) socket?.emit('room:leave', { roomId: current.roomId });
    }
    set({ call: null, mountNode: null });
  },
  setMountNode: (node) => set({ mountNode: node }),
}));
