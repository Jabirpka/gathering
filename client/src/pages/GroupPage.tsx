import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../hooks/useSocket';
import { Users, Video, Copy, Check, Settings, UserCheck, Hash, Headphones, LogOut, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { GroupMember, Room } from '../types';
import MemberApproval from '../components/groups/MemberApproval';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function RoomCard({ room, groupId }: { room: Room; groupId: string }) {
  const navigate = useNavigate();
  const icons = { VIDEO_CALL: Video, VIDEO_WATCH: Hash, AUDIO_CALL: Headphones };
  const Icon = icons[room.type] ?? Video;
  const labels = { VIDEO_CALL: 'Video Call', VIDEO_WATCH: 'Watch Party', AUDIO_CALL: 'Audio Call' };

  return (
    <button
      onClick={() => navigate(`/groups/${groupId}/rooms/${room.id}`)}
      className="card p-4 flex items-center gap-3 w-full text-left hover:border-brand/30 transition-all group"
    >
      <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
        <Icon size={17} className="text-brand-light" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white text-sm">{room.name}</p>
        <p className="text-xs text-slate-500">{labels[room.type]}</p>
      </div>
      <span className="text-xs text-slate-600 group-hover:text-brand-light transition-colors">Join →</span>
    </button>
  );
}

function MemberRow({ member, isOwner, groupId }: { member: GroupMember; isOwner: boolean; groupId: string }) {
  const roleColors: Record<string, string> = {
    OWNER: 'bg-amber-500/15 text-amber-400',
    ADMIN: 'bg-blue-500/15 text-blue-400',
    MEMBER: 'bg-slate-500/15 text-slate-400',
  };

  return (
    <div className="flex items-center gap-3 py-2">
      {member.user.avatar ? (
        <img src={member.user.avatar} className="w-8 h-8 rounded-full object-cover" alt={member.user.name} />
      ) : (
        <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-xs font-semibold text-brand-light">
          {member.user.name[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{member.user.name}</p>
      </div>
      <span className={`badge ${roleColors[member.role]}`}>{member.role}</span>
    </div>
  );
}

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { activeGroup, fetchGroup, loading } = useGroupStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [tab, setTab] = useState<'rooms' | 'members'>('rooms');

  useEffect(() => {
    if (groupId) {
      fetchGroup(groupId);
      const socket = getSocket();
      socket?.emit('group:join', { groupId });
      return () => { socket?.emit('group:leave', { groupId }); };
    }
  }, [groupId]);

  if (loading || !activeGroup) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 bg-white/5 rounded-xl w-48" />
        <div className="h-4 bg-white/5 rounded w-64" />
        <div className="grid grid-cols-2 gap-3 mt-6">
          {[1, 2].map((i) => <div key={i} className="h-20 bg-white/5 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const myMember = activeGroup.members.find((m) => m.userId === user?.id);
  const isOwnerOrAdmin = myMember?.role === 'OWNER' || myMember?.role === 'ADMIN';
  const approvedMembers = activeGroup.members.filter((m) => m.status === 'APPROVED');
  const pendingCount = activeGroup.members.filter((m) => m.status === 'PENDING').length;

  const copyCode = () => {
    navigator.clipboard.writeText(activeGroup.code);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand/40 to-accent/20 flex items-center justify-center text-2xl font-bold text-white shrink-0">
          {activeGroup.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white mb-1">{activeGroup.name}</h1>
          {activeGroup.description && <p className="text-slate-400 text-sm mb-2">{activeGroup.description}</p>}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Users size={12} />{approvedMembers.length} members</span>
            <span>·</span>
            <span className={`badge ${activeGroup.isPublic ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
              {activeGroup.isPublic ? 'Public' : 'Private'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={copyCode} className="btn-secondary text-xs gap-1.5">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {activeGroup.code}
          </button>
          <button onClick={() => navigate(`/groups/${groupId}/schedule`)} className="btn-ghost p-2">
            <Calendar size={16} />
          </button>
          {isOwnerOrAdmin && (
            <button className="btn-ghost p-2" title="Settings">
              <Settings size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Pending approval banner */}
      {isOwnerOrAdmin && pendingCount > 0 && (
        <button
          onClick={() => setShowApproval(true)}
          className="w-full card p-3 flex items-center gap-3 mb-5 border-amber-500/20 hover:border-amber-500/40 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <UserCheck size={16} className="text-amber-400" />
          </div>
          <p className="text-sm text-slate-300 flex-1 text-left">
            <span className="font-semibold text-amber-400">{pendingCount}</span> pending join request{pendingCount !== 1 ? 's' : ''}
          </p>
          <span className="text-xs text-slate-500">Review →</span>
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-surface-1 p-1 rounded-xl w-fit">
        {(['rooms', 'members'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize', tab === t ? 'bg-brand text-white shadow' : 'text-slate-400 hover:text-slate-200')}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'rooms' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeGroup.rooms?.map((room) => (
            <RoomCard key={room.id} room={room} groupId={activeGroup.id} />
          ))}
        </div>
      )}

      {tab === 'members' && (
        <div className="card divide-y divide-white/5">
          {approvedMembers.map((member) => (
            <div key={member.id} className="px-4">
              <MemberRow member={member} isOwner={myMember?.role === 'OWNER'} groupId={activeGroup.id} />
            </div>
          ))}
        </div>
      )}

      {showApproval && groupId && (
        <MemberApproval groupId={groupId} onClose={() => { setShowApproval(false); fetchGroup(groupId); }} />
      )}
    </div>
  );
}
