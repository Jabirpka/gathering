import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useAuthStore } from '../store/authStore';
import { Users, Video, Calendar, Plus, LogIn, ArrowRight, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Group } from '../types';
import CreateGroupModal from '../components/groups/CreateGroupModal';
import JoinGroupModal from '../components/groups/JoinGroupModal';
import { motion } from 'framer-motion';

function GroupCard({ group, onClick }: { group: Group; onClick: () => void }) {
  const approvedCount = group.members?.filter((m) => m.status === 'APPROVED').length ?? 0;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="card p-5 cursor-pointer hover:border-brand/30 transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand/30 to-accent/20 flex items-center justify-center text-lg font-bold text-white">
          {group.name[0].toUpperCase()}
        </div>
        <span className={`badge ${group.isPublic ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
          {group.isPublic ? 'Public' : 'Private'}
        </span>
      </div>

      <h3 className="font-semibold text-white mb-1 group-hover:text-brand-light transition-colors">{group.name}</h3>
      {group.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{group.description}</p>}

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Users size={12} />
          {approvedCount} member{approvedCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <Video size={12} />
          {group.rooms?.length ?? 0} room{(group.rooms?.length ?? 0) !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <Clock size={12} />
          {formatDistanceToNow(new Date(group.updatedAt), { addSuffix: true })}
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-xs text-slate-600">Code: <span className="font-mono text-slate-400">{group.code}</span></span>
        <ArrowRight size={14} className="text-slate-600 group-hover:text-brand-light transition-colors" />
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
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-400 text-sm">Hang out with your people, wherever they are.</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => setShowCreate(true)}
          className="card p-5 flex items-center gap-4 hover:border-brand/30 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center">
            <Plus size={20} className="text-brand-light" />
          </div>
          <div>
            <p className="font-medium text-white text-sm">Create a group</p>
            <p className="text-xs text-slate-500">Start a new watch party or hangout</p>
          </div>
        </button>
        <button
          onClick={() => setShowJoin(true)}
          className="card p-5 flex items-center gap-4 hover:border-brand/30 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
            <LogIn size={20} className="text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-white text-sm">Join a group</p>
            <p className="text-xs text-slate-500">Enter an invite code to join friends</p>
          </div>
        </button>
      </div>

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Calendar size={14} />
            Upcoming Events
          </h2>
          <div className="space-y-2">
            {upcoming.map((e) => (
              <div
                key={e.id}
                onClick={() => navigate(`/groups/${e.groupId}/schedule`)}
                className="card px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-brand/20 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                  <Calendar size={14} className="text-brand-light" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{e.title}</p>
                  <p className="text-xs text-slate-500">{e.groupName}</p>
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  {formatDistanceToNow(new Date(e.scheduledAt), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Groups */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users size={14} />
          Your Groups
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 h-36 animate-pulse">
                <div className="w-11 h-11 rounded-xl bg-white/5 mb-4" />
                <div className="h-4 bg-white/5 rounded w-2/3 mb-2" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="card p-12 text-center">
            <Users size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium mb-1">No groups yet</p>
            <p className="text-slate-500 text-sm mb-4">Create a group or join one with an invite code.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto">
              <Plus size={16} />
              Create your first group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} onClick={() => navigate(`/groups/${g.id}`)} />
            ))}
          </div>
        )}
      </div>

      <CreateGroupModal open={showCreate} onClose={() => setShowCreate(false)} />
      <JoinGroupModal open={showJoin} onClose={() => setShowJoin(false)} />
    </div>
  );
}
