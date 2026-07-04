import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, X, Search } from 'lucide-react';
import { useGroupStore } from '../../store/groupStore';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../hooks/useSocket';
import { groupsApi } from '../../services/api';
import { Message } from '../../types';
import MessageBubble from './MessageBubble';
import VoiceRecorderButton from './VoiceRecorderButton';
import clsx from 'clsx';

interface Props {
  groupId: string;
  roomId?: string;
  /** Show the left divider — on by default for the in-call side panel; turn off
   *  when the panel stands alone (e.g. the group Chat tab). */
  bordered?: boolean;
}

function SenderAvatar({ message }: { message: Message }) {
  return message.user.avatar ? (
    <img src={message.user.avatar} className="w-6 h-6 rounded-full object-cover shrink-0 mb-0.5" alt={message.user.name} />
  ) : (
    <div className="w-6 h-6 rounded-full bg-brand-dim flex items-center justify-center text-[10px] font-bold text-brand shrink-0 mb-0.5">
      {message.user.name[0]}
    </div>
  );
}

export default function ChatPanel({ groupId, roomId, bordered = true }: Props) {
  const { messages } = useGroupStore();
  const activeGroup = useGroupStore((s) => s.activeGroup);
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; at: number }>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socket = getSocket();

  // Debounced in-conversation search (group chat only — room chat is ephemeral).
  const runSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim() || roomId) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await groupsApi.searchMessages(groupId, q.trim());
        setSearchResults(res.data);
      } catch { setSearchResults([]); }
    }, 300);
  };

  // ✓✓ when every other approved member has read past the message. Only
  // group-level chat tracks lastReadAt, so room (in-call) chat shows no ticks.
  const readStateFor = (msg: Message): 'sent' | 'read' | undefined => {
    if (roomId || msg.userId !== user?.id) return undefined;
    const others = activeGroup?.members.filter((m) => m.status === 'APPROVED' && m.userId !== user?.id) ?? [];
    if (others.length === 0) return 'sent';
    const allRead = others.every((m) => m.lastReadAt && new Date(m.lastReadAt) >= new Date(msg.createdAt));
    return allRead ? 'read' : 'sent';
  };

  useEffect(() => {
    socket?.emit('chat:history', { groupId, roomId });
  }, [groupId, roomId]);

  // Show "X is typing…" — track senders and expire them after a short pause.
  useEffect(() => {
    if (!socket) return;
    const onTyping = ({ userId, name }: { userId: string; name: string }) => {
      setTypingUsers((p) => ({ ...p, [userId]: { name, at: Date.now() } }));
    };
    socket.on('chat:typing', onTyping);
    const sweep = setInterval(() => {
      setTypingUsers((p) => {
        const now = Date.now();
        const alive = Object.fromEntries(Object.entries(p).filter(([, v]) => now - v.at < 2500));
        return Object.keys(alive).length === Object.keys(p).length ? p : alive;
      });
    }, 800);
    return () => {
      socket.off('chat:typing', onTyping);
      clearInterval(sweep);
    };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const content = input.trim();
    if (!content || !socket) return;
    socket.emit('chat:send', { groupId, roomId, content, replyToId: replyingTo?.id });
    setInput('');
    setReplyingTo(null);
  };

  const deleteMessage = (msg: Message) => {
    socket?.emit('chat:delete', { messageId: msg.id });
  };

  const react = (msg: Message, emoji: string) => {
    socket?.emit('chat:react', { messageId: msg.id, emoji });
  };

  const sendVoice = (dataUrl: string, seconds: number) => {
    socket?.emit('chat:send', {
      groupId, roomId, content: dataUrl, kind: 'VOICE', duration: seconds, replyToId: replyingTo?.id,
    });
    setReplyingTo(null);
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
    <div className={clsx('flex flex-col h-full', bordered ? 'glass-panel border-l border-white/10' : 'bg-transparent')}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 shrink-0">
        <MessageSquare size={15} className="text-slate-400" />
        <span className="text-sm font-medium text-slate-200 flex-1">Chat</span>
        {!roomId && (
          <button
            onClick={() => { setSearchOpen((v) => !v); setSearchQuery(''); setSearchResults([]); }}
            className={`p-1.5 rounded-lg transition-colors ${searchOpen ? 'bg-brand-dim text-brand' : 'text-slate-500 hover:text-slate-200'}`}
            title="Search messages"
          >
            <Search size={14} />
          </button>
        )}
      </div>

      {/* Search */}
      {searchOpen && (
        <div className="px-3 py-2 border-b border-white/10 shrink-0 space-y-2">
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
                    <span className="font-semibold text-brand mr-1.5">{m.user.name.split(' ')[0]}</span>
                    <span className="text-slate-200">{m.content}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {roomMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center pt-8">
            <MessageSquare size={28} className="text-slate-600 mb-2" />
            <p className="text-slate-400 text-sm">No messages yet.<br />Say hello!</p>
          </div>
        )}
        {roomMessages.map((msg) => {
          const isOwn = msg.userId === user?.id;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={isOwn}
              senderName={!isOwn ? msg.user.name : undefined}
              avatar={!isOwn ? <SenderAvatar message={msg} /> : undefined}
              readState={readStateFor(msg)}
              myId={user?.id}
              onReply={setReplyingTo}
              onDelete={deleteMessage}
              onReact={react}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {Object.keys(typingUsers).length > 0 && (
        <div className="px-4 pb-1 text-[11px] text-brand animate-pulse shrink-0">
          {Object.values(typingUsers).map((t) => t.name.split(' ')[0]).join(', ')}{' '}
          {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing…
        </div>
      )}

      {/* Reply preview */}
      {replyingTo && (
        <div className="px-3 pt-2 shrink-0">
          <div className="flex items-center gap-2 bg-surface-2 rounded-xl px-3 py-1.5 border-l-2 border-brand">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-brand">
                Replying to {replyingTo.userId === user?.id ? 'yourself' : replyingTo.user.name}
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
      <div className="p-3 border-t border-white/10 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            className="input resize-none text-sm min-h-[38px] max-h-24"
            placeholder="Message…"
            value={input}
            onChange={(e) => { setInput(e.target.value); handleTyping(); }}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          {input.trim() ? (
            <button
              onClick={send}
              className="w-9 h-9 rounded-xl bg-brand hover:bg-brand-light flex items-center justify-center transition-colors shrink-0"
            >
              <Send size={15} className="text-white" />
            </button>
          ) : (
            <VoiceRecorderButton onSend={sendVoice} />
          )}
        </div>
      </div>
    </div>
  );
}
