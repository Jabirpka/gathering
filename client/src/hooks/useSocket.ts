import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useGroupStore } from '../store/groupStore';
import { Message, VideoComment, VideoSession, VideoSyncEvent, PresenceEvent } from '../types';

let socketInstance: Socket | null = null;

export function getSocket(): Socket | null {
  return socketInstance;
}

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const { addMessage, setMessages, setVideoSession, addVideoComment, handlePresence } = useGroupStore();
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

    socketInstance.on('video:started', ({ session }: { session: VideoSession }) => setVideoSession(session));
    socketInstance.on('video:stopped', () => setVideoSession(null));
    socketInstance.on('video:comment', (comment: VideoComment) => addVideoComment(comment));

    socketInstance.on('group:presence', (event: PresenceEvent) => handlePresence(event));

    return () => {
      socketInstance?.disconnect();
      socketInstance = null;
      initialized.current = false;
    };
  }, [token]);

  return socketInstance;
}

export function useVideoSync(
  roomId: string | null,
  onSync: (event: VideoSyncEvent) => void,
  onState: (state: { isPlaying: boolean; currentTime: number; timestamp: number }) => void
) {
  useEffect(() => {
    if (!socketInstance || !roomId) return;

    socketInstance.on('video:sync', onSync);
    socketInstance.on('video:state', onState);

    return () => {
      socketInstance?.off('video:sync', onSync);
      socketInstance?.off('video:state', onState);
    };
  }, [roomId, onSync, onState]);
}
