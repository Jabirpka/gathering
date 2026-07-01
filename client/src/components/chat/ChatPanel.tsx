import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useGroupStore } from '../../store/groupStore';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../hooks/useSocket';
import { Message } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

interface Props {
  groupId: string;
  roomId?: string;
  /** Show the left divider — on by default for the in-call side panel; turn off
   *  when the panel stands alone (e.g. the group Chat tab). */
  bordered?: boolean;
}

function ChatMessage({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <div className={clsx('flex gap-2.5 items-end', isOwn && 'flex-row-reverse')}>
      {!isOwn && (
        message.user.avatar ? (
          <img src={message.user.avatar} className="w-6 h-6 rounded-full object-cover shrink-0 mb-0.5" alt={message.user.name} />
        ) : (
          <div className="w-6 h-6 rounded-full bg-brand-dim flex items-center justify-center text-[10px] font-bold text-brand shrink-0 mb-0.5">
            {message.user.name[0]}
          </div>
        )
      )}
      <div className={clsx('max-w-[75%]', isOwn && 'items-end flex flex-col')}>
        {!isOwn && (
          <p className="text-[10px] text-slate-500 mb-0.5 ml-1">{message.user.name}</p>
        )}
        <div className={clsx('px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
          isOwn ? 'bg-brand text-white rounded-br-sm' : 'bg-surface-2 text-slate-700 rounded-bl-sm')}>
          {message.content}
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5 mx-1">
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

export default function ChatPanel({ groupId, roomId, bordered = true }: Props) {
  const { messages, addMessage } = useGroupStore();
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const socket = getSocket();

  useEffect(() => {
    socket?.emit('chat:history', { groupId, roomId });
  }, [groupId, roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const content = input.trim();
    if (!content || !socket) return;
    socket.emit('chat:send', { groupId, roomId, content });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleTyping = () => {
    socket?.emit('chat:typing', { groupId, roomId });
  };

  const roomMessages = roomId
    ? messages.filter((m) => m.roomId === roomId)
    : messages.filter((m) => !m.roomId);

  return (
    <div className={clsx('flex flex-col h-full', bordered ? 'glass-panel border-l border-white/50' : 'bg-transparent')}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2 shrink-0">
        <MessageSquare size={15} className="text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {roomMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center pt-8">
            <MessageSquare size={28} className="text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">No messages yet.<br />Say hello!</p>
          </div>
        )}
        {roomMessages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} isOwn={msg.userId === user?.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-black/5 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            className="input resize-none text-sm min-h-[38px] max-h-24"
            placeholder="Message…"
            value={input}
            onChange={(e) => { setInput(e.target.value); handleTyping(); }}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="w-9 h-9 rounded-xl bg-brand hover:bg-brand-light disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
