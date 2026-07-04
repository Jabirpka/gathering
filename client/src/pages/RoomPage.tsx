import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { getSocket } from '../hooks/useSocket';
import ChatPanel from '../components/chat/ChatPanel';
import { ArrowLeft, MessageSquare, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

const EMOJIS = ['👏', '🔥', '❤️', '😂', '😮', '🎉'];

interface FloatingEmoji { id: string; emoji: string; x: number; }
interface PTTUser { userId: string; name: string; }

export default function RoomPage() {
  const { groupId, roomId } = useParams<{ groupId: string; roomId: string }>();
  const { activeGroup, fetchGroup } = useGroupStore();
  const user = useAuthStore((s) => s.user);
  const { joinCall, setMountNode } = useCallStore();
  const [chatOpen, setChatOpen] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [pttActive, setPttActive] = useState(false);
  const [pttUsers, setPttUsers] = useState<PTTUser[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socket = getSocket();

  const room = activeGroup?.rooms?.find((r) => r.id === roomId);

  useEffect(() => {
    if (groupId) fetchGroup(groupId);
  }, [groupId]);

  useEffect(() => {
    if (!roomId || !groupId) return;
    socket?.emit('room:join', { roomId, groupId });

    const onEmoji = (data: { userId: string; name: string; emoji: string }) => {
      const id = Math.random().toString(36).slice(2);
      const x = Math.random() * 70 + 10;
      setFloatingEmojis((prev) => [...prev, { id, emoji: data.emoji, x }]);
      setTimeout(() => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)), 2500);
    };
    const onPttStart = (data: PTTUser) => setPttUsers((p) => [...p.filter((u) => u.userId !== data.userId), data]);
    const onPttEnd = ({ userId }: { userId: string }) => setPttUsers((p) => p.filter((u) => u.userId !== userId));
    const onPttChunk = ({ chunk }: { chunk: ArrayBuffer }) => {
      try {
        const blob = new Blob([chunk], { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play().catch(() => {});
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch {}
    };

    socket?.on('room:emoji', onEmoji);
    socket?.on('room:ptt:start', onPttStart);
    socket?.on('room:ptt:end', onPttEnd);
    socket?.on('room:ptt:chunk', onPttChunk);

    return () => {
      socket?.emit('room:leave', { roomId });
      socket?.off('room:emoji', onEmoji);
      socket?.off('room:ptt:start', onPttStart);
      socket?.off('room:ptt:end', onPttEnd);
      socket?.off('room:ptt:chunk', onPttChunk);
    };
  }, [roomId, groupId]);

  const sendEmoji = (emoji: string) => socket?.emit('room:emoji', { roomId, emoji });

  const startPTT = useCallback(async () => {
    if (pttActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) e.data.arrayBuffer().then((buf) => socket?.emit('room:ptt:chunk', { roomId, chunk: buf }));
      };
      mr.start(200);
      setPttActive(true);
      socket?.emit('room:ptt:start', { roomId });
    } catch {}
  }, [pttActive, roomId]);

  const stopPTT = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    setPttActive(false);
    socket?.emit('room:ptt:end', { roomId });
  }, [roomId]);

  // Join the persistent call when entering the room. CallManager keeps the
  // LiveKit connection alive across navigation (see joinCall/setMountNode).
  useEffect(() => {
    if (!groupId || !roomId) return;
    joinCall({
      roomName: `${groupId}-${roomId}`,
      groupId,
      roomId,
      roomLabel: room?.name ?? 'Call',
      displayName: user?.name ?? 'Participant',
      audioOnly: room?.type === 'AUDIO_CALL',
    });
  }, [groupId, roomId, room?.type]);

  // Hand the mount point to CallManager so it can portal the full call UI here
  const setCallMount = useCallback((node: HTMLDivElement | null) => {
    setMountNode(node);
  }, [setMountNode]);

  if (!room || !groupId || !roomId) {
    return <div className="flex items-center justify-center h-full"><p className="text-slate-400">Room not found</p></div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Header */}
      <div className="h-12 shrink-0 border-b border-white/10 glass-panel flex items-center px-3 gap-2">
        <Link to={`/groups/${groupId}`} className="btn-ghost p-1.5"><ArrowLeft size={15} /></Link>
        <span className="text-sm font-medium text-slate-200 truncate">{room.name}</span>
        <span className="badge bg-surface-3 text-slate-400 text-[10px] hidden sm:inline-flex">{activeGroup?.name}</span>
        <div className="flex-1" />
        <div className="hidden sm:flex gap-1 bg-surface-2 p-0.5 rounded-lg">
          <button className="p-1.5 rounded-md transition-colors bg-brand-dim text-brand">
            <MessageSquare size={14} />
          </button>
        </div>
      </div>

      {/* PTT speaking indicator */}
      <AnimatePresence>
        {pttUsers.length > 0 && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="shrink-0 bg-emerald-500/15 border-b border-emerald-200 overflow-hidden">
            <div className="px-4 py-1.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-300">{pttUsers.map((u) => u.name).join(', ')} speaking…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <div className="flex flex-col sm:flex-row flex-1 overflow-hidden relative">
        {/* Floating emojis */}
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          <AnimatePresence>
            {floatingEmojis.map((e) => (
              <motion.div key={e.id}
                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                animate={{ opacity: 0, y: -220, scale: 1.5 }}
                transition={{ duration: 2.2, ease: 'easeOut' }}
                style={{ left: `${e.x}%`, bottom: '100px', position: 'absolute' }}
                className="text-3xl"
              >{e.emoji}</motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Main content area */}
        <div className={clsx('overflow-hidden bg-black relative', chatOpen ? 'h-[55vw] sm:h-auto sm:flex-1' : 'flex-1')}>
          {/* CallManager (mounted once near the app root) portals the live
              call UI into this div, keeping the connection alive even when
              the user navigates away (see store/callStore.ts) */}
          <div ref={setCallMount} className="w-full h-full" />

          {/* Desktop emoji + PTT bar — placed top-left so it never overlaps the
              video controls / LiveKit control bar at the bottom */}
          <div className="hidden sm:flex absolute top-3 left-3 gap-1.5 z-10">
            {EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => sendEmoji(emoji)}
                className="text-xl w-9 h-9 rounded-xl bg-black/60 backdrop-blur hover:bg-black/80 flex items-center justify-center transition-all active:scale-90">
                {emoji}
              </button>
            ))}
            <button
              onMouseDown={startPTT} onMouseUp={stopPTT} onMouseLeave={stopPTT}
              className={clsx('w-9 h-9 rounded-xl flex items-center justify-center transition-all select-none cursor-pointer',
                pttActive ? 'bg-emerald-500 text-white scale-110 shadow-lg shadow-emerald-500/40' : 'bg-black/60 backdrop-blur text-slate-600 hover:bg-black/80'
              )}
              title="Hold to talk (walky-talky)"
            >
              {pttActive ? <Mic size={15} /> : <MicOff size={15} />}
            </button>
          </div>
        </div>

        {/* Mobile bottom bar: emoji + PTT + chat toggle */}
        <div className="sm:hidden shrink-0 glass-panel border-t border-white/10 px-2 py-2 flex items-center gap-1.5">
          <div className="flex gap-1 flex-1 overflow-x-auto">
            {EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => sendEmoji(emoji)}
                className="text-xl w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/10 flex items-center justify-center shrink-0 active:scale-90">
                {emoji}
              </button>
            ))}
          </div>
          <button
            onTouchStart={startPTT} onTouchEnd={stopPTT}
            onMouseDown={startPTT} onMouseUp={stopPTT}
            className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 select-none transition-all',
              pttActive ? 'bg-emerald-500 text-white scale-110' : 'bg-surface-3 text-slate-500'
            )}
          >
            {pttActive ? <Mic size={17} /> : <MicOff size={17} />}
          </button>
          <button onClick={() => setChatOpen((v) => !v)}
            className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors',
              chatOpen ? 'bg-brand-dim text-brand' : 'bg-surface-3 text-slate-500'
            )}>
            <MessageSquare size={16} />
          </button>
        </div>

        {/* Side panel */}
        <div className={clsx('sm:w-72 sm:flex shrink-0 overflow-hidden flex-col border-t sm:border-t-0 sm:border-l border-white/10',
          chatOpen ? 'flex h-64' : 'hidden sm:flex'
        )}>
          <ChatPanel groupId={groupId} roomId={roomId} />
        </div>
      </div>
    </div>
  );
}
