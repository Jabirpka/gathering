import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useDmStore } from '../store/dmStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../hooks/useSocket';
import { ArrowLeft, Video, Phone, MoreVertical, Search, ChevronDown, ChevronUp, Copy, Check, UserCheck, Zap, Share2, UserPlus, Camera, Loader2, Crown, Trash2, MessageSquare, LogOut } from 'lucide-react';
import { GroupMember } from '../types';
import MemberApproval from '../components/groups/MemberApproval';
import ChatPanel from '../components/chat/ChatPanel';
import TransferOwnershipModal from '../components/groups/TransferOwnershipModal';
import DeleteGroupModal from '../components/groups/DeleteGroupModal';
import { usersApi, groupsApi } from '../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function MemberRow({ member, currentUserId, groupId }: { member: GroupMember; currentUserId?: string; groupId: string }) {
  const [poking, setPoking] = useState(false);
  const navigate = useNavigate();
  const openThread = useDmStore((s) => s.openThread);
  const roleColors: Record<string, string> = {
    OWNER: 'bg-amber-500/15 text-amber-300',
    ADMIN: 'bg-blue-500/15 text-blue-300',
    MEMBER: 'bg-white/10 text-slate-300',
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

  const handleMessage = async () => {
    try {
      const thread = await openThread(member.userId);
      navigate(`/dm/${thread.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not open chat');
    }
  };

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div onClick={() => navigate(`/u/${member.userId}`)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
        {member.user.avatar ? (
          <img src={member.user.avatar} className="w-9 h-9 rounded-xl object-cover shrink-0" alt={member.user.name} />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-brand-dim flex items-center justify-center text-sm font-semibold text-brand shrink-0">
            {member.user.name[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{member.user.name}</p>
        </div>
      </div>
      <span className={`badge text-[10px] ${roleColors[member.role]}`}>{member.role}</span>
      {member.userId !== currentUserId && (
        <>
          <button onClick={handleMessage} title="Message"
            className="p-2 rounded-lg hover:bg-brand-dim text-slate-500 hover:text-brand transition-colors active:scale-90">
            <MessageSquare size={14} />
          </button>
          <button onClick={handlePoke} disabled={poking} title="Poke"
            className="p-2 rounded-lg hover:bg-amber-500/15 text-slate-500 hover:text-amber-300 transition-colors disabled:opacity-50 active:scale-90">
            <Zap size={14} />
          </button>
        </>
      )}
    </div>
  );
}

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { activeGroup, fetchGroup, loading, updateGroup, removeGroup, clearUnread, setActiveChatGroup } = useGroupStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  // Chat-first (WhatsApp-style): a group opens straight into its conversation;
  // the member list slides in from the header title.
  const [showMembers, setShowMembers] = useState(false);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [callStarting, setCallStarting] = useState<'video' | 'audio' | null>(null);
  const [showOwnerMenu, setShowOwnerMenu] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
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

  // Viewing a group means viewing its chat: mark it read locally, in the sidebar
  // badge store, and on the server, and hold the active-chat lock (which mutes
  // unread counting) for as long as the page is open.
  useEffect(() => {
    if (!groupId) return;
    setActiveChatGroup(groupId);
    clearUnread(groupId);
    groupsApi.markRead(groupId).catch(() => {});
    return () => {
      groupsApi.markRead(groupId).catch(() => {});
      setActiveChatGroup(null);
    };
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

  // Leave the group (non-owners; owners must transfer or delete instead).
  const handleExitGroup = async () => {
    if (!groupId) return;
    if (!window.confirm(`Exit "${activeGroup?.name}"? You'll need an invite code to rejoin.`)) return;
    try {
      await groupsApi.leave(groupId);
      removeGroup(groupId);
      toast.success('You left the group');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to exit group');
    }
  };

  // WhatsApp-style call buttons: resolve the group's call room of that type
  // and jump in — joining rings everyone else in the group.
  const startCall = async (type: 'video' | 'audio') => {
    if (!groupId || callStarting) return;
    setCallStarting(type);
    try {
      const res = await groupsApi.startCall(groupId, type);
      navigate(`/groups/${groupId}/rooms/${res.data.id}`);
    } catch {
      toast.error('Could not start the call');
    } finally {
      setCallStarting(null);
    }
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
      <div className="h-full flex flex-col">
        <div className="h-14 shrink-0 border-b border-white/10 glass-panel flex items-center px-3 gap-2 animate-pulse">
          <div className="w-9 h-9 rounded-xl bg-white/5" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-white/5 rounded w-32" />
            <div className="h-2.5 bg-white/5 rounded w-20" />
          </div>
        </div>
        <div className="flex-1" />
      </div>
    );
  }

  const myMember = activeGroup.members.find((m) => m.userId === user?.id);
  const isOwner = myMember?.role === 'OWNER';
  const isOwnerOrAdmin = myMember?.role === 'OWNER' || myMember?.role === 'ADMIN';
  const approvedMembers = activeGroup.members.filter((m) => m.status === 'APPROVED');
  const pendingCount = activeGroup.members.filter((m) => m.status === 'PENDING').length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Compact chat header */}
      <div className="h-14 shrink-0 border-b border-white/10 glass-panel flex items-center px-2 sm:px-3 gap-1.5 sm:gap-2">
        <button onClick={() => navigate('/dashboard')} className="btn-ghost p-1.5" title="Back">
          <ArrowLeft size={18} />
        </button>

        {/* Group avatar (squircle) with upload for admins */}
        <div className="relative shrink-0 group">
          <div className="w-9 h-9 rounded-xl overflow-hidden">
            {activeGroup.avatar ? (
              <img src={activeGroup.avatar} className="w-full h-full object-cover" alt={activeGroup.name} />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent to-brand flex items-center justify-center text-sm font-bold text-white">
                {activeGroup.name[0]}
              </div>
            )}
          </div>
          {isOwnerOrAdmin && (
            <button onClick={() => avatarRef.current?.click()}
              className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {uploadingAvatar ? <Loader2 size={13} className="animate-spin text-white" /> : <Camera size={13} className="text-white" />}
            </button>
          )}
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* Tappable title → toggles the member panel */}
        <button onClick={() => setShowMembers((v) => !v)} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-white truncate">{activeGroup.name}</p>
          <p className="text-[11px] text-brand flex items-center gap-1">
            {approvedMembers.length} member{approvedMembers.length !== 1 ? 's' : ''}
            {showMembers ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </p>
        </button>

        {/* Search */}
        <button
          onClick={() => setChatSearchOpen((v) => !v)}
          className={clsx('p-2 rounded-lg transition-colors shrink-0', chatSearchOpen ? 'bg-brand-dim text-brand' : 'text-slate-500 hover:text-slate-200')}
          title="Search messages"
        >
          <Search size={16} />
        </button>

        {/* WhatsApp-style call buttons */}
        <button onClick={() => startCall('video')} disabled={!!callStarting} title="Video call"
          className="w-9 h-9 rounded-full bg-brand-dim text-brand hover:bg-brand hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 active:scale-90 shrink-0">
          {callStarting === 'video' ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
        </button>
        <button onClick={() => startCall('audio')} disabled={!!callStarting} title="Voice call"
          className="w-9 h-9 rounded-full bg-brand-dim text-brand hover:bg-brand hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 active:scale-90 shrink-0">
          {callStarting === 'audio' ? <Loader2 size={16} className="animate-spin" /> : <Phone size={15} />}
        </button>

        {/* More menu */}
        <div className="relative shrink-0">
          <button onClick={() => setShowOwnerMenu((v) => !v)} className="btn-ghost p-2" title="Group options">
            <MoreVertical size={16} />
          </button>
          {showOwnerMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowOwnerMenu(false)} />
              <div className="absolute right-0 top-11 z-20 w-52 card shadow-xl overflow-hidden py-1">
                <button onClick={() => { setShowOwnerMenu(false); copyCode(); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 transition-colors text-left">
                  {copied ? <Check size={14} /> : <Copy size={14} />} Copy invite code
                </button>
                <button onClick={() => { setShowOwnerMenu(false); handleShare(); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 transition-colors text-left">
                  <Share2 size={14} /> Share invite
                </button>
                <div className="my-1 border-t border-white/10" />
                {isOwner ? (
                  <>
                    <button onClick={() => { setShowOwnerMenu(false); setShowTransfer(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 transition-colors text-left">
                      <Crown size={14} /> Transfer ownership
                    </button>
                    <button onClick={() => { setShowOwnerMenu(false); setShowDelete(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left">
                      <Trash2 size={14} /> Delete group
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setShowOwnerMenu(false); handleExitGroup(); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left">
                    <LogOut size={14} /> Exit group
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Members panel — slides in from the header title */}
      {showMembers && (
        <div className="shrink-0 max-h-[45%] overflow-y-auto glass-panel border-b border-white/10 animate-slide-up">
          {isOwnerOrAdmin && pendingCount > 0 && (
            <button onClick={() => setShowApproval(true)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/10 hover:bg-white/5 transition-colors text-left">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <UserCheck size={16} className="text-amber-300" />
              </div>
              <p className="text-sm text-slate-200 flex-1">
                <span className="font-semibold text-amber-300">{pendingCount}</span> pending request{pendingCount !== 1 ? 's' : ''}
              </p>
              <span className="text-xs text-slate-400">Review →</span>
            </button>
          )}
          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-[0.2em] text-slate-500">MEMBERS</p>
          <div className="px-4 pb-1 divide-y divide-white/5">
            {approvedMembers.map((member) => (
              <MemberRow key={member.id} member={member} currentUserId={user?.id} groupId={activeGroup.id} />
            ))}
          </div>
          <button onClick={handleShare}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
            <div className="w-9 h-9 rounded-xl bg-brand-dim border border-dashed border-brand/60 flex items-center justify-center shrink-0">
              <UserPlus size={16} className="text-brand" />
            </div>
            <span className="text-sm text-brand font-medium">Add member</span>
          </button>
        </div>
      )}

      {/* Conversation fills the rest; composer pins to the bottom */}
      <div className="flex-1 overflow-hidden">
        <ChatPanel
          groupId={activeGroup.id}
          bordered={false}
          hideHeader
          searchOpen={chatSearchOpen}
          onSearchOpenChange={setChatSearchOpen}
        />
      </div>

      {showApproval && groupId && (
        <MemberApproval groupId={groupId} onClose={() => { setShowApproval(false); fetchGroup(groupId); }} />
      )}

      <TransferOwnershipModal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        groupId={activeGroup.id}
        members={approvedMembers.filter((m) => m.userId !== user?.id)}
      />

      <DeleteGroupModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        group={activeGroup}
      />
    </div>
  );
}
