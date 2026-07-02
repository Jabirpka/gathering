import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { useDmStore } from '../store/dmStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../hooks/useSocket';
import { dmsApi } from '../services/api';
import { Message } from '../types';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

function Bubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <div className={clsx('flex items-end', isOwn && 'flex-row-reverse')}>
      <div className={clsx('max-w-[75%]', isOwn && 'items-end flex flex-col')}>
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

export default function DmPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const user = useAuthStore((s) => s.user);
  const { threads, messages, fetchThreads, setActiveThread, setMessages, clearUnread } = useDmStore();
  const [input, setInput] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socket = getSocket();

  const thread = threads.find((t) => t.id === threadId);

  // Load the thread list if we deep-linked straight here.
  useEffect(() => {
    if (!thread) fetchThreads();
  }, [threadId]);

  // Open the conversation: mark active (mutes unread counting), load history,
  // and persist read state on entry and exit.
  useEffect(() => {
    if (!threadId) return;
    setActiveThread(threadId);
    clearUnread(threadId);
    dmsApi.markRead(threadId).catch(() => {});
    socket?.emit('dm:history', { threadId });

    const onHistory = ({ threadId: tid, messages: msgs }: { threadId: string; messages: Message[] }) => {
      if (tid === threadId) setMessages(msgs);
    };
    const onTyping = ({ threadId: tid }: { threadId: string }) => {
      if (tid !== threadId) return;
      setPartnerTyping(true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setPartnerTyping(false), 2500);
    };
    socket?.on('dm:history', onHistory);
    socket?.on('dm:typing', onTyping);

    return () => {
      socket?.off('dm:history', onHistory);
      socket?.off('dm:typing', onTyping);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      dmsApi.markRead(threadId).catch(() => {});
      setActiveThread(null);
    };
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  const send = () => {
    const content = input.trim();
    if (!content || !socket || !threadId) return;
    socket.emit('dm:send', { threadId, content });
    setInput('');
  };

  const partnerName = thread ? (thread.partner.nickname || thread.partner.name) : 'Chat';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 shrink-0 border-b border-white/50 glass-panel flex items-center px-3 gap-2">
        <Link to="/dashboard" className="btn-ghost p-1.5"><ArrowLeft size={16} /></Link>
        {thread?.partner.avatar ? (
          <img src={thread.partner.avatar} className="w-9 h-9 rounded-full object-cover" alt={partnerName} />
        ) : (
          <div className="w-9 h-9 rounded-full bg-brand-dim flex items-center justify-center text-sm font-semibold text-brand">
            {partnerName[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{partnerName}</p>
          {partnerTyping && <p className="text-[11px] text-brand animate-pulse">typing…</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-slate-400 text-sm pt-10">
            Say hi to {partnerName} 👋
          </p>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} isOwn={m.userId === user?.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/50 glass-panel shrink-0">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <textarea
            className="input resize-none text-sm min-h-[40px] max-h-28"
            placeholder="Message…"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              socket?.emit('dm:typing', { threadId });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="w-10 h-10 rounded-xl bg-brand hover:bg-brand-light disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
