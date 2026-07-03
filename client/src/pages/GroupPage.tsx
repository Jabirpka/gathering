import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useDmStore } from '../store/dmStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../hooks/useSocket';
import { Users, Video, Phone, Copy, Check, Settings, UserCheck, Zap, Share2, Camera, Loader2, Crown, Trash2, MessageSquare } from 'lucide-react';
import { GroupMember, Message } from '../types';
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
    OWNER: 'bg-amber-100 text-amber-700',
    ADMIN: 'bg-blue-100 text-blue-600',
    MEMBER: 'bg-slate-200 text-slate-600',
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
      {member.user.avatar ? (
        <img src={member.user.avatar} className="w-9 h-9 rounded-full object-cover shrink-0" alt={member.user.name} />
      ) : (
        <div className="w-9 h-9 rounded-full bg-brand-dim flex items-center justify-center text-sm font-semibold text-brand shrink-0">
          {member.user.name[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{member.user.name}</p>
      </div>
      <span className={`badge text-[10px] ${roleColors[member.role]}`}>{member.role}</span>
      {member.userId !== currentUserId && (
        <>
          <button onClick={handleMessage} title="Message"
            className="p-2 rounded-lg hover:bg-brand-dim text-slate-400 hover:text-brand transition-colors active:scale-90">
            <MessageSquare size={14} />
          </button>
          <button onClick={handlePoke} disabled={poking} title="Poke"
            className="p-2 rounded-lg hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-colors disabled:opacity-50 active:scale-90">
            <Zap size={14} />
          </button>
        </>
      )}
    </div>
  );
}

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { activeGroup, fetchGroup, loading, updateGroup, clearUnread, setActiveChatGroup } = useGroupStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  // Chat-first (WhatsApp-style): opening a group lands in its conversation.
  const [tab, setTab] = useState<'chat' | 'members'>('chat');
  const [callStarting, setCallStarting] = useState<'video' | 'audio' | null>(null);
  const [showOwnerMenu, setShowOwnerMenu] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const avatarRef = useRef<HTMLInputElement>(null);
  const tabRef = useRef(tab);

  useEffect(() => {
    if (groupId) {
      fetchGroup(groupId);
      const socket = getSocket();
      socket?.emit('group:join', { groupId });
      return () => { socket?.emit('group:leave', { groupId }); };
    }
  }, [groupId]);

  // Keep the latest tab in a ref so the socket handler below reads it without
  // needing to re-subscribe every time the active tab changes.
  useEffect(() => { tabRef.current = tab; }, [tab]);

  // Opening the Chat tab marks group chat as read — locally, in the sidebar
  // badge store, and persisted on the server.
  useEffect(() => {
    if (!groupId) return;
    if (tab === 'chat') {
      setUnreadChat(0);
      clearUnread(groupId);
      setActiveChatGroup(groupId);
      groupsApi.markRead(groupId).catch(() => {});
    } else {
      setActiveChatGroup(null);
    }
  }, [tab, groupId]);

  // Persist read state and release the active-chat lock when leaving the page.
  useEffect(() => {
    return () => {
      if (tabRef.current === 'chat' && groupId) groupsApi.markRead(groupId).catch(() => {});
      setActiveChatGroup(null);
    };
  }, [groupId]);

  // Count group-level chat messages that arrive while the Chat tab isn't open,
  // so we can badge it like a messaging app. Room-scoped messages are ignored.
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !groupId) return;
    const onMessage = (msg: Message) => {
      if (msg.roomId || msg.groupId !== groupId || msg.userId === user?.id) return;
      if (tabRef.current === 'chat') return;
      setUnreadChat((n) => n + 1);
    };
    socket.on('chat:message', onMessage);
    return () => { socket.off('chat:message', onMessage); };
  }, [groupId, user?.id]);

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
      <div className="p-4 sm:p-6 animate-pulse space-y-4">
        <div className="flex gap-4"><div className="w-16 h-16 rounded-2xl bg-slate-100" /><div className="flex-1 space-y-2"><div className="h-6 bg-slate-100 rounded w-40" /><div className="h-4 bg-slate-100 rounded w-24" /></div></div>
        <div className="grid grid-cols-2 gap-3 mt-4">{[1,2].map((i)=><div key={i} className="h-16 bg-slate-100 rounded-2xl" />)}</div>
      </div>
    );
  }

  const myMember = activeGroup.members.find((m) => m.userId === user?.id);
  const isOwner = myMember?.role === 'OWNER';
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
              <div className="w-full h-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-2xl font-bold text-white">
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1 truncate">{activeGroup.name}</h1>
          {activeGroup.description && <p className="text-slate-500 text-xs sm:text-sm mb-2 line-clamp-2">{activeGroup.description}</p>}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Users size={11} />{approvedMembers.length} members</span>
            <span className={`badge text-[10px] ${activeGroup.isPublic ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
              {activeGroup.isPublic ? 'Public' : 'Private'}
            </span>
          </div>
        </div>

        {/* Action buttons — WhatsApp-style call buttons front and center */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => startCall('video')}
            disabled={!!callStarting}
            className="w-10 h-10 rounded-full bg-brand-dim text-brand hover:bg-brand hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 active:scale-90"
            title="Video call"
          >
            {callStarting === 'video' ? <Loader2 size={17} className="animate-spin" /> : <Video size={17} />}
          </button>
          <button
            onClick={() => startCall('audio')}
            disabled={!!callStarting}
            className="w-10 h-10 rounded-full bg-brand-dim text-brand hover:bg-brand hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 active:scale-90"
            title="Voice call"
          >
            {callStarting === 'audio' ? <Loader2 size={17} className="animate-spin" /> : <Phone size={16} />}
          </button>
          <button onClick={copyCode} className="btn-ghost p-2 hidden sm:flex" title={`Copy code ${activeGroup.code}`}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
          <button onClick={handleShare} className="btn-ghost p-2" title="Share invite">
            <Share2 size={15} />
          </button>
          {isOwner && (
            <div className="relative">
              <button onClick={() => setShowOwnerMenu((v) => !v)} className="btn-ghost p-2" title="Group settings">
                <Settings size={15} />
              </button>
              {showOwnerMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowOwnerMenu(false)} />
                  <div className="absolute right-0 top-11 z-20 w-52 card shadow-xl overflow-hidden py-1">
                    <button
                      onClick={() => { setShowOwnerMenu(false); setShowTransfer(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-black/5 transition-colors text-left"
                    >
                      <Crown size={14} /> Transfer ownership
                    </button>
                    <button
                      onClick={() => { setShowOwnerMenu(false); setShowDelete(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      <Trash2 size={14} /> Delete group
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pending approval banner */}
      {isOwnerOrAdmin && pendingCount > 0 && (
        <button onClick={() => setShowApproval(true)}
          className="w-full card p-3 flex items-center gap-3 mb-4 border-amber-300 hover:border-amber-400 transition-colors active:scale-[0.99]">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <UserCheck size={15} className="text-amber-600" />
          </div>
          <p className="text-sm text-slate-700 flex-1 text-left">
            <span className="font-semibold text-amber-600">{pendingCount}</span> pending request{pendingCount !== 1 ? 's' : ''}
          </p>
          <span className="text-xs text-slate-500">Review →</span>
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 glass p-1 rounded-xl w-fit">
        {(['chat', 'members'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize flex items-center gap-1.5', t === tab ? 'bg-brand text-white shadow' : 'text-slate-500 hover:text-slate-900')}>
            {t}
            {t === 'chat' && unreadChat > 0 && (
              <span className={clsx('text-[10px] font-bold leading-none min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center',
                tab === 'chat' ? 'bg-white/25 text-white' : 'bg-brand text-white')}>
                {unreadChat > 9 ? '9+' : unreadChat}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="card overflow-hidden h-[calc(100dvh-15rem)] min-h-[420px]">
          <ChatPanel groupId={activeGroup.id} bordered={false} />
        </div>
      )}

      {tab === 'members' && (
        <div className="card divide-y divide-black/5">
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
