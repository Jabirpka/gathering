import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../hooks/useSocket';
import { Users, Video, Copy, Check, Settings, UserCheck, Hash, Headphones, Calendar, Zap, Share2, Camera, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { GroupMember, Room } from '../types';
import MemberApproval from '../components/groups/MemberApproval';
import { usersApi, groupsApi } from '../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function RoomCard({ room, groupId }: { room: Room; groupId: string }) {
  const navigate = useNavigate();
  const icons = { VIDEO_CALL: Video, VIDEO_WATCH: Hash, AUDIO_CALL: Headphones };
  const Icon = icons[room.type] ?? Video;
  const labels = { VIDEO_CALL: 'Video Call', VIDEO_WATCH: 'Watch Party', AUDIO_CALL: 'Audio Call' };
  const colors = { VIDEO_CALL: 'text-blue-400', VIDEO_WATCH: 'text-brand-light', AUDIO_CALL: 'text-emerald-400' };

  return (
    <button onClick={() => navigate(`/groups/${groupId}/rooms/${room.id}`)}
      className="card p-4 flex items-center gap-3 w-full text-left hover:border-brand/30 transition-all group active:scale-[0.98]">
      <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
        <Icon size={18} className={colors[room.type]} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white text-sm">{room.name}</p>
        <p className="text-xs text-slate-500">{labels[room.type]}</p>
      </div>
      <span className="text-xs text-slate-600 group-hover:text-brand-light transition-colors shrink-0">Join →</span>
    </button>
  );
}

function MemberRow({ member, currentUserId, groupId }: { member: GroupMember; currentUserId?: string; groupId: string }) {
  const [poking, setPoking] = useState(false);
  const roleColors: Record<string, string> = {
    OWNER: 'bg-amber-500/15 text-amber-400',
    ADMIN: 'bg-blue-500/15 text-blue-400',
    MEMBER: 'bg-slate-500/15 text-slate-400',
  };

  const handlePoke = async () => {
    setPoking(true);
    try {
      await usersApi.poke(member.userId);
      toast.success(`Poked ${member.user.name}! 👉`, { icon: '⚡' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to poke');
    } finally {
      setPoking(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-2.5">
      {member.user.avatar ? (
        <img src={member.user.avatar} className="w-9 h-9 rounded-full object-cover shrink-0" alt={member.user.name} />
      ) : (
        <div className="w-9 h-9 rounded-full bg-brand/20 flex items-center justify-center text-sm font-semibold text-brand-light shrink-0">
          {member.user.name[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{member.user.name}</p>
      </div>
      <span className={`badge text-[10px] ${roleColors[member.role]}`}>{member.role}</span>
      {member.userId !== currentUserId && (
        <button onClick={handlePoke} disabled={poking} title="Poke"
          className="p-2 rounded-lg hover:bg-amber-500/15 text-slate-600 hover:text-amber-400 transition-colors disabled:opacity-50 active:scale-90">
          <Zap size={14} />
        </button>
      )}
    </div>
  );
}

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { activeGroup, fetchGroup, loading, updateGroup } = useGroupStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [tab, setTab] = useState<'rooms' | 'members'>('rooms');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (groupId) {
      fetchGroup(groupId);
      const socket = getSocket();
      socket?.emit('group:join', { groupId });
      return () => { socket?.emit('group:leave', { groupId }); };
    }
  }, [groupId]);

  const handleShare = async () => {
    const text = `Join "${activeGroup?.name}" on Gathering! Code: ${activeGroup?.code}\nhttps://gathering-client-six.vercel.app`;
    if (navigator.share) {
      try { await navigator.share({ title: `Join ${activeGroup?.name}`, text }); }
      catch {}
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Invite link copied!');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(activeGroup?.code ?? '');
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !groupId) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await groupsApi.update(groupId, { avatar: reader.result as string });
        updateGroup(res.data);
        toast.success('Group photo updated!');
      } catch { toast.error('Failed to update photo'); }
      finally { setUploadingAvatar(false); }
    };
    reader.readAsDataURL(file);
  };

  if (loading || !activeGroup) {
    return (
      <div className="p-4 sm:p-6 animate-pulse space-y-4">
        <div className="flex gap-4"><div className="w-16 h-16 rounded-2xl bg-white/5" /><div className="flex-1 space-y-2"><div className="h-6 bg-white/5 rounded w-40" /><div className="h-4 bg-white/5 rounded w-24" /></div></div>
        <div className="grid grid-cols-2 gap-3 mt-4">{[1,2].map((i)=><div key={i} className="h-16 bg-white/5 rounded-2xl" />)}</div>
      </div>
    );
  }

  const myMember = activeGroup.members.find((m) => m.userId === user?.id);
  const isOwnerOrAdmin = myMember?.role === 'OWNER' || myMember?.role === 'ADMIN';
  const approvedMembers = activeGroup.members.filter((m) => m.status === 'APPROVED');
  const pendingCount = activeGroup.members.filter((m) => m.status === 'PENDING').length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3 sm:gap-4 mb-5">
        {/* Group avatar with upload */}
        <div className="relative shrink-0 group">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden">
            {activeGroup.avatar ? (
              <img src={activeGroup.avatar} className="w-full h-full object-cover" alt={activeGroup.name} />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-brand/40 to-accent/20 flex items-center justify-center text-2xl font-bold text-white">
                {activeGroup.name[0]}
              </div>
            )}
          </div>
          {isOwnerOrAdmin && (
            <button onClick={() => avatarRef.current?.click()}
              className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {uploadingAvatar ? <Loader2 size={16} className="animate-spin text-white" /> : <Camera size={16} className="text-white" />}
            </button>
          )}
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 truncate">{activeGroup.name}</h1>
          {activeGroup.description && <p className="text-slate-400 text-xs sm:text-sm mb-2 line-clamp-2">{activeGroup.description}</p>}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Users size={11} />{approvedMembers.length} members</span>
            <span className={`badge text-[10px] ${activeGroup.isPublic ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
              {activeGroup.isPublic ? 'Public' : 'Private'}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={copyCode} className="btn-secondary text-xs gap-1.5 py-1.5 px-2.5">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span className="font-mono hidden sm:inline">{activeGroup.code}</span>
          </button>
          <button onClick={handleShare} className="btn-ghost p-2" title="Share invite">
            <Share2 size={15} />
          </button>
          <button onClick={() => navigate(`/groups/${groupId}/schedule`)} className="btn-ghost p-2">
            <Calendar size={15} />
          </button>
        </div>
      </div>

      {/* Pending approval banner */}
      {isOwnerOrAdmin && pendingCount > 0 && (
        <button onClick={() => setShowApproval(true)}
          className="w-full card p-3 flex items-center gap-3 mb-4 border-amber-500/20 hover:border-amber-500/40 transition-colors active:scale-[0.99]">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
            <UserCheck size={15} className="text-amber-400" />
          </div>
          <p className="text-sm text-slate-300 flex-1 text-left">
            <span className="font-semibold text-amber-400">{pendingCount}</span> pending request{pendingCount !== 1 ? 's' : ''}
          </p>
          <span className="text-xs text-slate-500">Review →</span>
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-surface-1 p-1 rounded-xl w-fit">
        {(['rooms', 'members'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize', t === tab ? 'bg-brand text-white shadow' : 'text-slate-400 hover:text-slate-200')}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'rooms' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeGroup.rooms?.map((room) => <RoomCard key={room.id} room={room} groupId={activeGroup.id} />)}
        </div>
      )}

      {tab === 'members' && (
        <div className="card divide-y divide-white/5">
          {approvedMembers.map((member) => (
            <div key={member.id} className="px-4">
              <MemberRow member={member} currentUserId={user?.id} groupId={activeGroup.id} />
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
