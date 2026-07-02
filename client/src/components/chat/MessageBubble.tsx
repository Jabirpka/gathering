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
  onReply: (message: Message) => void;
  onDelete: (message: Message) => void;
}

/**
 * WhatsApp-style bubble: tap to reveal Reply / Delete actions, quoted
 * reply block above the text, ✓/✓✓ ticks on own messages, and an italic
 * placeholder once a message is deleted for everyone.
 */
export default function MessageBubble({ message, isOwn, senderName, avatar, readState, onReply, onDelete }: Props) {
  const [showActions, setShowActions] = useState(false);
  const deleted = !!message.deletedAt;

  return (
    <div className={clsx('flex gap-2.5 items-end', isOwn && 'flex-row-reverse')}>
      {avatar}
      <div className={clsx('max-w-[75%]', isOwn && 'items-end flex flex-col')}>
        {senderName && <p className="text-[10px] text-slate-500 mb-0.5 ml-1">{senderName}</p>}

        <div
          onClick={() => !deleted && setShowActions((v) => !v)}
          className={clsx(
            'px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
            !deleted && 'cursor-pointer',
            isOwn ? 'bg-brand text-white rounded-br-sm' : 'bg-surface-2 text-slate-700 rounded-bl-sm'
          )}
        >
          {message.replyTo && !deleted && (
            <div className={clsx(
              'mb-1.5 px-2 py-1 rounded-lg border-l-2 text-xs',
              isOwn ? 'bg-white/15 border-white/60' : 'bg-black/5 border-brand'
            )}>
              <p className={clsx('font-semibold', isOwn ? 'text-white/90' : 'text-brand')}>
                {message.replyTo.user.name}
              </p>
              <p className={clsx('truncate', isOwn ? 'text-white/75' : 'text-slate-500')}>
                {message.replyTo.deletedAt
                  ? 'Message deleted'
                  : message.replyTo.kind === 'VOICE'
                    ? '🎤 Voice message'
                    : message.replyTo.content}
              </p>
            </div>
          )}

          {deleted ? (
            <span className={clsx('italic flex items-center gap-1.5', isOwn ? 'text-white/70' : 'text-slate-400')}>
              <Ban size={12} /> This message was deleted
            </span>
          ) : message.kind === 'VOICE' ? (
            <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <audio controls preload="metadata" src={message.content} className="max-w-[200px] h-9" />
              {message.duration != null && (
                <span className={clsx('text-[10px]', isOwn ? 'text-white/75' : 'text-slate-500')}>
                  {Math.floor(message.duration / 60)}:{(message.duration % 60).toString().padStart(2, '0')}
                </span>
              )}
            </span>
          ) : (
            message.content
          )}
        </div>

        {/* Tap actions */}
        {showActions && !deleted && (
          <div className={clsx('flex gap-1 mt-1', isOwn && 'justify-end')}>
            <button
              onClick={() => { setShowActions(false); onReply(message); }}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-slate-600 hover:text-brand transition-colors"
            >
              <Reply size={11} /> Reply
            </button>
            {isOwn && (
              <button
                onClick={() => { setShowActions(false); onDelete(message); }}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-slate-600 hover:text-red-500 transition-colors"
              >
                <Trash2 size={11} /> Delete
              </button>
            )}
          </div>
        )}

        <p className="text-[10px] text-slate-400 mt-0.5 mx-1 flex items-center gap-1">
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          {isOwn && !deleted && readState && (
            readState === 'read'
              ? <CheckCheck size={13} className="text-blue-500" />
              : <Check size={13} className="text-slate-400" />
          )}
        </p>
      </div>
    </div>
  );
}
