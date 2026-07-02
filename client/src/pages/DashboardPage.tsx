import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useAuthStore } from '../store/authStore';
import { Users, Calendar, Plus, LogIn, MessageSquare } from 'lucide-react';
import { format, isToday, formatDistanceToNow } from 'date-fns';
import { Group } from '../types';
import CreateGroupModal from '../components/groups/CreateGroupModal';
import JoinGroupModal from '../components/groups/JoinGroupModal';
import { motion } from 'framer-motion';

/** WhatsApp-style timestamp: clock time today, short date otherwise. */
function chatTime(iso: string) {
  const d = new Date(iso);
  return isToday(d) ? format(d, 'h:mm a') : format(d, 'MMM d');
}

function ChatRow({ group, onClick }: { group: Group; onClick: () => void }) {
  const unread = useGroupStore((s) => s.unreadByGroup[group.id] ?? 0);
  const myId = useAuthStore((s) => s.user?.id);
  const last = group.lastMessage;
  const sender = last ? (last.userId === myId ? 'You' : (last.user.nickname || last.user.name).split(' ')[0]) : null;

  return (
    <motion.div whileTap={{ scale: 0.98 }} onClick={onClick}
      className="card px-3.5 py-3 cursor-pointer hover:border-brand/30 transition-all flex items-center gap-3">
      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
        {group.avatar ? (
          <img src={group.avatar} className="w-full h-full object-cover" alt={group.name} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-lg font-bold text-white">
            {group.name[0].toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold text-slate-900 text-sm truncate">{group.name}</h3>
          <span className={`text-[11px] shrink-0 ${unread > 0 ? 'text-brand font-semibold' : 'text-slate-400'}`}>
            {last ? chatTime(last.createdAt) : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-xs truncate ${unread > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
            {last ? `${sender}: ${last.content}` : 'No messages yet — say hello!'}
          </p>
          {unread > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { groups, loading } = useGroupStore();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const upcoming = groups
    .flatMap((g) => (g.scheduledEvents ?? []).map((e) => ({ ...e, groupName: g.name, groupId: g.id })))
    .filter((e) => new Date(e.scheduledAt) > new Date())
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
    .slice(0, 3);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-0.5">
          Hey, {user?.nickname || user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 text-sm">Hang out with your people.</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => setShowCreate(true)}
          className="card p-4 flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 hover:border-brand/30 transition-colors text-left active:scale-[0.97]">
          <div className="w-10 h-10 rounded-xl bg-brand-dim flex items-center justify-center shrink-0">
            <Plus size={20} className="text-brand" />
          </div>
          <div>
            <p className="font-medium text-slate-900 text-sm">Create</p>
            <p className="text-xs text-slate-500 hidden sm:block">New group</p>
          </div>
        </button>
        <button onClick={() => setShowJoin(true)}
          className="card p-4 flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 hover:border-brand/30 transition-colors text-left active:scale-[0.97]">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <LogIn size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900 text-sm">Join</p>
            <p className="text-xs text-slate-500 hidden sm:block">Enter code</p>
          </div>
        </button>
      </div>

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <Calendar size={12} />Upcoming
          </h2>
          <div className="space-y-2">
            {upcoming.map((e) => (
              <div key={e.id} onClick={() => navigate(`/groups/${e.groupId}/schedule`)}
                className="card px-3.5 py-3 flex items-center gap-3 cursor-pointer hover:border-brand/20 transition-colors active:scale-[0.98]">
                <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center shrink-0">
                  <Calendar size={13} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{e.title}</p>
                  <p className="text-xs text-slate-500">{e.groupName}</p>
                </div>
                <span className="text-xs text-slate-500 shrink-0 hidden sm:block">
                  {formatDistanceToNow(new Date(e.scheduledAt), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chats — WhatsApp-style conversation list, most recent first */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
          <MessageSquare size={12} />Chats
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card px-3.5 py-3 flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-slate-100 shrink-0" />
                <div className="flex-1">
                  <div className="h-3.5 bg-slate-100 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="card p-10 text-center">
            <Users size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-700 font-medium mb-1">No chats yet</p>
            <p className="text-slate-500 text-sm mb-4">Create a group or join one with a code.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto">
              <Plus size={15} />Create group
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {[...groups]
              .sort((a, b) =>
                +new Date(b.lastMessage?.createdAt ?? b.updatedAt) - +new Date(a.lastMessage?.createdAt ?? a.updatedAt)
              )
              .map((g) => (
                <ChatRow key={g.id} group={g} onClick={() => navigate(`/groups/${g.id}`)} />
              ))}
          </div>
        )}
      </div>

      <CreateGroupModal open={showCreate} onClose={() => setShowCreate(false)} />
      <JoinGroupModal open={showJoin} onClose={() => setShowJoin(false)} />
    </div>
  );
}
