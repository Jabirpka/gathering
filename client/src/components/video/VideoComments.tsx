import { useState } from 'react';
import { Send, MessageSquare, Clock } from 'lucide-react';
import { useGroupStore } from '../../store/groupStore';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../hooks/useSocket';
import { VideoSession } from '../../types';

interface Props {
  session: VideoSession;
  roomId: string;
  currentTime: number;
}

function formatTimestamp(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoComments({ session, roomId, currentTime }: Props) {
  const { videoComments } = useGroupStore();
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState('');
  const socket = getSocket();

  const send = () => {
    const content = input.trim();
    if (!content || !socket) return;
    socket.emit('video:comment', {
      sessionId: session.id,
      roomId,
      content,
      timestamp: Math.floor(currentTime),
    });
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-surface-1 border-l border-white/5">
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 shrink-0">
        <MessageSquare size={15} className="text-slate-500" />
        <span className="text-sm font-medium text-slate-300">Video Comments</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {videoComments.length === 0 && (
          <p className="text-center text-slate-600 text-sm pt-8">No comments yet.<br />Comment at any timestamp!</p>
        )}
        {videoComments.map((c) => (
          <div key={c.id} className="flex gap-2 text-sm">
            <button className="text-brand-light font-mono text-xs shrink-0 mt-0.5 hover:underline">
              {formatTimestamp(c.timestamp)}
            </button>
            <div>
              <span className="text-slate-400 font-medium mr-1.5">{c.user.name}</span>
              <span className="text-slate-300">{c.content}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-white/5 shrink-0">
        <p className="text-[10px] text-slate-600 mb-1.5 flex items-center gap-1">
          <Clock size={10} />
          Commenting at {formatTimestamp(currentTime)}
        </p>
        <div className="flex gap-2">
          <input
            className="input text-sm"
            placeholder="Add a comment…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button onClick={send} disabled={!input.trim()} className="w-9 h-9 rounded-xl bg-brand hover:bg-brand-light disabled:opacity-40 flex items-center justify-center transition-colors shrink-0">
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
