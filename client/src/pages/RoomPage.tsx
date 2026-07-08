import { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { ArrowLeft, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

/** Go back to the chat without cutting the call: pop the call page off history
 *  (so it doesn't linger as a duplicate entry) or replace if there's nothing
 *  behind us. The call keeps running and shrinks into the floating pill. */
function popOrReplace(navigate: ReturnType<typeof useNavigate>, fallback: string) {
  const idx = (window.history.state && (window.history.state as any).idx) ?? 0;
  if (idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}

export default function RoomPage() {
  const { groupId, roomId } = useParams<{ groupId: string; roomId: string }>();
  const { activeGroup, fetchGroup } = useGroupStore();
  const user = useAuthStore((s) => s.user);
  const { joinCall, setMountNode, call } = useCallStore();
  const navigate = useNavigate();
  const joinedRef = useRef(false);

  const room = activeGroup?.rooms?.find((r) => r.id === roomId);

  useEffect(() => {
    if (groupId) fetchGroup(groupId);
  }, [groupId]);

  // Join the persistent call when entering the room. CallManager keeps the
  // LiveKit connection alive across navigation; the ring lifecycle now lives in
  // callStore (join on start, leave on end) so leaving this page just minimizes.
  useEffect(() => {
    if (!groupId || !roomId) return;
    joinCall({
      roomName: `${groupId}-${roomId}`,
      groupId,
      roomId,
      roomLabel: room?.name ?? 'Call',
      displayName: user?.name ?? 'Participant',
      audioOnly: room?.type === 'AUDIO_CALL',
    });
  }, [groupId, roomId, room?.type]);

  // When the call ends (Leave pressed anywhere), return to the group.
  useEffect(() => {
    if (call) joinedRef.current = true;
    else if (joinedRef.current) popOrReplace(navigate, `/groups/${groupId}`);
  }, [call, groupId, navigate]);

  // Hand the mount point to CallManager so it can portal the full call UI here.
  const setCallMount = useCallback((node: HTMLDivElement | null) => {
    setMountNode(node);
  }, [setMountNode]);

  // Invite others into the call: copy the group's invite code to share.
  const inviteToCall = () => {
    const code = activeGroup?.code;
    if (!code) return;
    navigator.clipboard?.writeText(code).catch(() => {});
    toast.success('Invite code copied — share it to bring people in');
  };

  if (!room || !groupId || !roomId) {
    return <div className="flex items-center justify-center h-full"><p className="text-slate-400">Room not found</p></div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header — back minimizes the call (keeps it running) */}
      <div className="h-14 shrink-0 border-b border-white/10 glass-panel flex items-center px-3 gap-2">
        <button onClick={() => popOrReplace(navigate, `/groups/${groupId}`)} className="btn-ghost p-1.5">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{activeGroup?.name ?? room.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium text-emerald-400">Live</span>
            <span className="text-[11px] text-slate-500">· {room.type === 'AUDIO_CALL' ? 'Voice' : 'Video'} call</span>
          </div>
        </div>
        <button onClick={inviteToCall}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-brand bg-brand-dim border border-brand/30 active:scale-95 transition-transform">
          <UserPlus size={13} /> Invite
        </button>
      </div>

      {/* CallManager portals the live call UI into this div */}
      <div ref={setCallMount} className="flex-1 relative bg-black" />
    </div>
  );
}
