import { useState } from 'react';
import { Check, CheckCheck, Reply, Trash2, Ban } from 'lucide-react';
import { Message } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

interface Props {
  message: Message;
  isOwn: boolean;
  /** Sender label above the bubble (group chats). */
  senderName?: string;
  /** Avatar element rendered beside other people's bubbles (optional). */
  avatar?: React.ReactNode;
  /** Read state for my own messages: 'read' → blue ✓✓, 'sent' → gray ✓. */
  readState?: 'sent' | 'read';
  /** My user id, for highlighting my own reaction. */
  myId?: string;
  onReply: (message: Message) => void;
  onDelete: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
}

// Reaction set tuned to the app's purple/glass theme (💜 = brand).
const REACTIONS = ['💜', '🔥', '😂', '😮', '😢', '👍'];

/**
 * WhatsApp-style bubble: tap to reveal Reply / Delete actions, quoted
 * reply block above the text, ✓/✓✓ ticks on own messages, and an italic
 * placeholder once a message is deleted for everyone.
 */
export default function MessageBubble({ message, isOwn, senderName, avatar, readState, myId, onReply, onDelete, onReact }: Props) {
  const [showActions, setShowActions] = useState(false);
  const deleted = !!message.deletedAt;

  // Group identical emojis into chips: emoji → count + whether I reacted.
  const reactionChips = Object.entries(
    (message.reactions ?? []).reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
      acc[r.emoji] = acc[r.emoji] || { count: 0, mine: false };
      acc[r.emoji].count += 1;
      if (r.userId === myId) acc[r.emoji].mine = true;
      return acc;
    }, {})
  );

  return (
    <div className={clsx('flex gap-2.5 items-end', isOwn && 'flex-row-reverse')}>
      {avatar}
      <div className={clsx('max-w-[75%]', isOwn && 'items-end flex flex-col')}>
        {senderName && <p className="text-[10px] text-slate-400 mb-0.5 ml-1">{senderName}</p>}

        <div
          onClick={() => !deleted && setShowActions((v) => !v)}
          className={clsx(
            'px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
            !deleted && 'cursor-pointer',
            isOwn
              // 1b own bubble: magenta→violet gradient, tail at the top-right, magenta glow.
              ? 'bg-gradient-to-br from-accent to-brand text-white rounded-tr-sm shadow-lg shadow-accent/40'
              // 1b received bubble: glassy magenta-tinted sheet with a neon edge, tail top-left.
              : 'bg-accent/[0.08] border border-accent/20 text-slate-100 rounded-tl-sm backdrop-blur-sm'
          )}
        >
          {message.replyTo && !deleted && (
            <div className={clsx(
              'mb-1.5 px-2 py-1 rounded-lg border-l-2 text-xs',
              isOwn ? 'bg-white/15 border-white/60' : 'bg-white/[0.06] border-brand'
            )}>
              <p className={clsx('font-semibold', isOwn ? 'text-white/90' : 'text-brand')}>
                {message.replyTo.user.name}
              </p>
              <p className={clsx('truncate', isOwn ? 'text-white/75' : 'text-slate-400')}>
                {message.replyTo.deletedAt
                  ? 'Message deleted'
                  : message.replyTo.kind === 'VOICE'
                    ? '🎤 Voice message'
                    : message.replyTo.content}
              </p>
            </div>
          )}

          {deleted ? (
            <span className={clsx('italic flex items-center gap-1.5', isOwn ? 'text-white/70' : 'text-slate-500')}>
              <Ban size={12} /> This message was deleted
            </span>
          ) : message.kind === 'VOICE' ? (
            <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <audio controls preload="metadata" src={message.content} className="max-w-[200px] h-9" />
              {message.duration != null && (
                <span className={clsx('text-[10px]', isOwn ? 'text-white/75' : 'text-slate-400')}>
                  {Math.floor(message.duration / 60)}:{(message.duration % 60).toString().padStart(2, '0')}
                </span>
              )}
            </span>
          ) : (
            message.content
          )}
        </div>

        {/* Reaction chips */}
        {reactionChips.length > 0 && (
          <div className={clsx('flex flex-wrap gap-1 -mt-1.5 relative z-[1]', isOwn && 'justify-end')}>
            {reactionChips.map(([emoji, info]) => (
              <button
                key={emoji}
                onClick={() => onReact(message, emoji)}
                className={clsx(
                  'flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border backdrop-blur transition-all',
                  info.mine
                    ? 'bg-brand-dim border-brand/40 text-brand font-semibold'
                    : 'bg-white/10 border-white/15 text-slate-200'
                )}
              >
                <span className="text-[13px] leading-none">{emoji}</span>
                {info.count > 1 && info.count}
              </button>
            ))}
          </div>
        )}

        {/* Tap actions */}
        {showActions && !deleted && (
          <div className={clsx('flex flex-col gap-1 mt-1', isOwn && 'items-end')}>
            {/* Themed reaction picker */}
            <div className="flex gap-0.5 px-1.5 py-1 rounded-full glass shadow-lg">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { setShowActions(false); onReact(message, emoji); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-base hover:bg-brand-dim hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className={clsx('flex gap-1', isOwn && 'justify-end')}>
              <button
                onClick={() => { setShowActions(false); onReply(message); }}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-slate-300 hover:text-brand transition-colors"
              >
                <Reply size={11} /> Reply
              </button>
              {isOwn && (
                <button
                  onClick={() => { setShowActions(false); onDelete(message); }}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-slate-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={11} /> Delete
                </button>
              )}
            </div>
          </div>
        )}

        <p className="text-[10px] text-slate-500 mt-0.5 mx-1 flex items-center gap-1">
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          {isOwn && !deleted && readState && (
            readState === 'read'
              ? <CheckCheck size={13} className="text-sky-400" />
              : <Check size={13} className="text-slate-400" />
          )}
        </p>
      </div>
    </div>
  );
}
