import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useDmStore } from '../store/dmStore';
import { useAuthStore } from '../store/authStore';
import { Users, Plus, X, ChevronRight } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { Group, DmThread } from '../types';
import { profileCompletion } from '../utils/profile';
import clsx from 'clsx';
import { motion } from 'framer-motion';

/** WhatsApp-style timestamp: clock time today, short date otherwise. */
function chatTime(iso: string) {
  const d = new Date(iso);
  return isToday(d) ? format(d, 'h:mm a') : format(d, 'MMM d');
}

/** Flat conversation row (dark neon): rounded-square gradient avatar.
 *  onAvatarClick (DMs) opens the other person's profile instead of the chat. */
function Row({ name, avatar, gradient, preview, time, unread, onClick, onAvatarClick }: {
  name: string; avatar?: string | null; gradient: boolean; preview: string; time: string; unread: number; onClick: () => void; onAvatarClick?: () => void;
}) {
  return (
    <motion.div whileTap={{ scale: 0.98 }} onClick={onClick}
      className="px-2 py-2.5 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-3">
      <div
        onClick={onAvatarClick ? (e) => { e.stopPropagation(); onAvatarClick(); } : undefined}
        className={clsx('w-12 h-12 rounded-2xl overflow-hidden shrink-0', onAvatarClick && 'cursor-pointer')}
      >
        {avatar ? (
          <img src={avatar} className="w-full h-full object-cover" alt={name} />
        ) : (
          <div className={clsx('w-full h-full flex items-center justify-center text-lg font-bold text-white',
            gradient ? 'bg-gradient-to-br from-brand to-accent' : 'bg-brand-dim !text-brand')}>
            {name[0].toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold text-white text-sm truncate">{name}</h3>
          <span className={clsx('text-[11px] shrink-0', unread > 0 ? 'text-brand font-semibold' : 'text-slate-500')}>{time}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={clsx('text-xs truncate', unread > 0 ? 'text-slate-200 font-medium' : 'text-slate-400')}>{preview}</p>
          {unread > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-lg bg-brand text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ChatRow({ group, onClick }: { group: Group; onClick: () => void }) {
  const unread = useGroupStore((s) => s.unreadByGroup[group.id] ?? 0);
  const myId = useAuthStore((s) => s.user?.id);
  const last = group.lastMessage;
  const sender = last ? (last.userId === myId ? 'You' : (last.user.nickname || last.user.name).split(' ')[0]) : null;
  return (
    <Row name={group.name} avatar={group.avatar} gradient preview={last ? `${sender}: ${last.content}` : 'No messages yet — say hello!'}
      time={last ? chatTime(last.createdAt) : ''} unread={unread} onClick={onClick} />
  );
}

function DmRow({ thread, onClick, onAvatarClick }: { thread: DmThread; onClick: () => void; onAvatarClick: () => void }) {
  const unread = useDmStore((s) => s.unreadByThread[thread.id] ?? 0);
  const myId = useAuthStore((s) => s.user?.id);
  const name = thread.partner.nickname || thread.partner.name;
  const last = thread.lastMessage;
  return (
    <Row name={name} avatar={thread.partner.avatar} gradient={false}
      preview={last ? `${last.userId === myId ? 'You: ' : ''}${last.content}` : 'New conversation'}
      time={last ? chatTime(last.createdAt) : ''} unread={unread} onClick={onClick} onAvatarClick={onAvatarClick} />
  );
}

type Filter = 'group' | 'dm';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { groups, loading, fetchGroups } = useGroupStore();
  const { threads, fetchThreads } = useDmStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('group');
  const [hideNudge, setHideNudge] = useState(false);
  // The Join/Create sheet is hosted in Layout; open it via this event.
  const openSheet = (t: 'join' | 'create') => window.dispatchEvent(new CustomEvent('open-group-sheet', { detail: { tab: t } }));

  useEffect(() => { fetchGroups(); fetchThreads(); }, []);

  // Merge groups and DMs into one list, newest activity first, then filter.
  const chatItems = [
    ...groups.map((g) => ({ kind: 'group' as const, id: `g-${g.id}`, at: +new Date(g.lastMessage?.createdAt ?? g.updatedAt), group: g })),
    ...threads.map((t) => ({ kind: 'dm' as const, id: `d-${t.id}`, at: +new Date(t.lastMessage?.createdAt ?? t.updatedAt), thread: t })),
  ]
    .filter((i) => i.kind === filter)
    .sort((a, b) => b.at - a.at);

  const firstName = user?.nickname || user?.name?.split(' ')[0];
  const completion = profileCompletion(user);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-fade-in pb-28">
      {/* Greeting (the GATHERING wordmark lives in the top bar now) */}
      <h1 className="text-lg font-bold text-white mb-3">Hey, {firstName} <span className="text-brand">✦</span></h1>

      {/* Complete-your-profile nudge (shown until the profile is 100% done) */}
      {completion < 100 && !hideNudge && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="relative mb-4 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/15 to-accent/10 p-3.5">
          <button onClick={() => setHideNudge(true)} className="absolute top-2 right-2 text-slate-400 hover:text-white" aria-label="Dismiss">
            <X size={14} />
          </button>
          <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 text-left pr-5">
            <div className="relative w-11 h-11 shrink-0">
              <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="#e879f9" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${(completion / 100) * 94.2} 94.2`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">{completion}%</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Complete your profile</p>
              <p className="text-xs text-slate-300">Answer a few questions so people get to know you.</p>
            </div>
            <ChevronRight size={18} className="text-brand shrink-0" />
          </button>
        </motion.div>
      )}

      {/* Group / DM segmented filter */}
      <div className="flex gap-1 p-1 rounded-2xl glass mb-4">
        {([['group', 'Groups'], ['dm', 'DMs']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={clsx('flex-1 py-1.5 rounded-xl text-sm font-medium transition-all',
              filter === key ? 'bg-gradient-to-br from-brand to-accent text-white shadow-lg shadow-brand/30' : 'text-slate-400 hover:text-white')}>
            {label}
          </button>
        ))}
      </div>

      <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-1.5 px-2">Chats</h2>

      {loading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="px-2 py-2.5 flex items-center gap-3 animate-pulse">
              <div className="w-12 h-12 rounded-2xl bg-white/5 shrink-0" />
              <div className="flex-1">
                <div className="h-3.5 bg-white/5 rounded w-1/3 mb-2" />
                <div className="h-3 bg-white/5 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : chatItems.length === 0 ? (
        <div className="card p-10 text-center mt-2">
          <Users size={36} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-200 font-medium mb-1">No chats yet</p>
          <p className="text-slate-400 text-sm mb-4">Create a group or join one with a code.</p>
          <button onClick={() => openSheet('create')} className="btn-primary mx-auto">
            <Plus size={15} />Create group
          </button>
        </div>
      ) : (
        <div className="space-y-0.5">
          {chatItems.map((item) =>
            item.kind === 'group' ? (
              <ChatRow key={item.id} group={item.group} onClick={() => navigate(`/groups/${item.group.id}`)} />
            ) : (
              <DmRow key={item.id} thread={item.thread}
                onClick={() => navigate(`/dm/${item.thread.id}`)}
                onAvatarClick={() => navigate(`/u/${item.thread.partner.id}`)} />
            )
          )}
        </div>
      )}
    </div>
  );
}
