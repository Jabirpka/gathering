import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, X, Search, MoreVertical, Trash2, Video, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDmStore } from '../store/dmStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../hooks/useSocket';
import { dmsApi } from '../services/api';
import { Message } from '../types';
import MessageBubble from '../components/chat/MessageBubble';
import SharedMessageCard from '../components/chat/SharedMessageCard';
import VoiceRecorderButton from '../components/chat/VoiceRecorderButton';

export default function DmPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const user = useAuthStore((s) => s.user);
  const { threads, messages, fetchThreads, setActiveThread, setMessages, clearUnread, removeThread } = useDmStore();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Keep read state current while the conversation is open, so the partner's
  // ✓✓ flips live as their messages land on my screen.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (threadId && last && last.userId !== user?.id) {
      dmsApi.markRead(threadId).catch(() => {});
    }
  }, [messages.length]);

  const send = () => {
    const content = input.trim();
    if (!content || !socket || !threadId) return;
    socket.emit('dm:send', { threadId, content, replyToId: replyingTo?.id });
    setInput('');
    setReplyingTo(null);
  };

  const deleteMessage = (msg: Message) => {
    socket?.emit('chat:delete', { messageId: msg.id });
  };

  const sendVoice = (dataUrl: string, seconds: number) => {
    if (!threadId) return;
    socket?.emit('dm:send', { threadId, content: dataUrl, kind: 'VOICE', duration: seconds, replyToId: replyingTo?.id });
    setReplyingTo(null);
  };

  const readStateFor = (msg: Message): 'sent' | 'read' | undefined => {
    if (msg.userId !== user?.id) return undefined;
    const readAt = thread?.partnerLastReadAt;
    return readAt && new Date(readAt) >= new Date(msg.createdAt) ? 'read' : 'sent';
  };

  const react = (msg: Message, emoji: string) => {
    socket?.emit('chat:react', { messageId: msg.id, emoji });
  };

  const runSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim() || !threadId) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await dmsApi.searchMessages(threadId, q.trim());
        setSearchResults(res.data);
      } catch { setSearchResults([]); }
    }, 300);
  };

  // "Delete chat" — clears this conversation for me only.
  const deleteChat = async () => {
    if (!threadId) return;
    if (!window.confirm('Delete this chat? Messages are removed for you only.')) return;
    try {
      await dmsApi.remove(threadId);
      removeThread(threadId);
      toast.success('Chat deleted');
      navigate('/dashboard');
    } catch {
      toast.error('Failed to delete chat');
    }
  };

  const partnerName = thread ? (thread.partner.nickname || thread.partner.name) : 'Chat';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 shrink-0 border-b border-white/10 glass-panel flex items-center px-3 gap-2">
        <Link to="/dashboard" className="btn-ghost p-1.5"><ArrowLeft size={16} /></Link>
        {thread?.partner.avatar ? (
          <img src={thread.partner.avatar} className="w-9 h-9 rounded-xl object-cover" alt={partnerName} />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-brand-dim flex items-center justify-center text-sm font-semibold text-brand">
            {partnerName[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{partnerName}</p>
          {partnerTyping && <p className="text-[11px] text-brand animate-pulse">typing…</p>}
        </div>
        <button onClick={() => navigate(`/dm/${threadId}/call?type=video`)} title="Video call"
          className="w-9 h-9 rounded-full bg-brand-dim text-brand hover:bg-brand hover:text-white flex items-center justify-center transition-colors active:scale-90 shrink-0">
          <Video size={17} />
        </button>
        <button onClick={() => navigate(`/dm/${threadId}/call?type=audio`)} title="Voice call"
          className="w-9 h-9 rounded-full bg-brand-dim text-brand hover:bg-brand hover:text-white flex items-center justify-center transition-colors active:scale-90 shrink-0">
          <Phone size={15} />
        </button>
        <button
          onClick={() => { setSearchOpen((v) => !v); setSearchQuery(''); setSearchResults([]); }}
          className={`p-2 rounded-lg transition-colors ${searchOpen ? 'bg-brand-dim text-brand' : 'text-slate-500 hover:text-slate-200'}`}
          title="Search messages"
        >
          <Search size={16} />
        </button>
        <div className="relative">
          <button onClick={() => setShowMenu((v) => !v)} className="btn-ghost p-2" title="More">
            <MoreVertical size={16} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-11 z-20 w-44 card shadow-xl overflow-hidden py-1">
                <button
                  onClick={() => { setShowMenu(false); deleteChat(); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                >
                  <Trash2 size={14} /> Delete chat
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      {searchOpen && (
        <div className="px-3 py-2 border-b border-white/10 glass-panel shrink-0 space-y-2">
          <input
            className="input text-sm"
            placeholder="Search messages…"
            value={searchQuery}
            onChange={(e) => runSearch(e.target.value)}
            autoFocus
          />
          {searchQuery.trim() && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {searchResults.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">No matches</p>
              ) : (
                searchResults.map((m) => (
                  <div key={m.id} className="px-2.5 py-1.5 rounded-lg bg-surface-2 text-xs">
                    <span className="font-semibold text-brand mr-1.5">
                      {m.userId === user?.id ? 'You' : partnerName.split(' ')[0]}
                    </span>
                    <span className="text-slate-200">{m.content}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-slate-500 text-sm pt-10">
            Say hi to {partnerName} 👋
          </p>
        )}
        {messages.map((m) => (
          (m.kind === 'POST' || m.kind === 'PROFILE') ? (
            <SharedMessageCard key={m.id} message={m} isOwn={m.userId === user?.id} />
          ) : (
            <MessageBubble
              key={m.id}
              message={m}
              isOwn={m.userId === user?.id}
              readState={readStateFor(m)}
              myId={user?.id}
              onReply={setReplyingTo}
              onDelete={deleteMessage}
              onReact={react}
            />
          )
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview */}
      {replyingTo && (
        <div className="px-3 pt-2 shrink-0">
          <div className="flex items-center gap-2 bg-surface-2 rounded-xl px-3 py-1.5 border-l-2 border-brand max-w-3xl mx-auto w-full">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-brand">
                Replying to {replyingTo.userId === user?.id ? 'yourself' : partnerName}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {replyingTo.kind === 'VOICE' ? '🎤 Voice message' : replyingTo.content}
              </p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="btn-ghost p-1"><X size={12} /></button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-white/10 glass-panel shrink-0">
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
          {input.trim() ? (
            <button
              onClick={send}
              className="w-10 h-10 rounded-xl bg-brand hover:bg-brand-light flex items-center justify-center transition-colors shrink-0"
            >
              <Send size={16} className="text-white" />
            </button>
          ) : (
            <VoiceRecorderButton onSend={sendVoice} />
          )}
        </div>
      </div>
    </div>
  );
}
