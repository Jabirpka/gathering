import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useGroupStore } from '../store/groupStore';
import { Message, PresenceEvent } from '../types';

let socketInstance: Socket | null = null;

export function getSocket(): Socket | null {
  return socketInstance;
}

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const { addMessage, setMessages, handlePresence, incrementUnread } = useGroupStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (!token || initialized.current) return;
    initialized.current = true;

    const serverUrl = import.meta.env.VITE_API_URL ?? window.location.origin;
    socketInstance = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => console.log('Socket connected'));
    socketInstance.on('disconnect', () => console.log('Socket disconnected'));
    socketInstance.on('connect_error', (err) => console.error('Socket error', err.message));

    socketInstance.on('chat:message', (msg: Message) => addMessage(msg));
    socketInstance.on('chat:history', (msgs: Message[]) => setMessages(msgs));

    // App-wide unread signal for group chat, delivered to this user's personal
    // room regardless of which group they're viewing.
    socketInstance.on('chat:unread', ({ groupId }: { groupId: string }) => incrementUnread(groupId));

    socketInstance.on('group:presence', (event: PresenceEvent) => handlePresence(event));

    return () => {
      socketInstance?.disconnect();
      socketInstance = null;
      initialized.current = false;
    };
  }, [token]);

  return socketInstance;
}
