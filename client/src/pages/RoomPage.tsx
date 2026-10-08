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
    return <div className="flex items-center justify-center h-full"><p className="text-muted">Room not found</p></div>;
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-call">
      {/* The live call UI fills the whole screen (CallManager portals into this). */}
      <div ref={setCallMount} className="absolute inset-0" />

      {/* Immersive top overlay: back · title · invite */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-2 px-3 pb-8 pointer-events-none bg-gradient-to-b from-black/70 via-black/30 to-transparent"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button onClick={() => popOrReplace(navigate, `/groups/${groupId}`)}
          className="pointer-events-auto w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white shrink-0" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate drop-shadow">{activeGroup?.name ?? room.name}</div>
          <div className="text-[11px] text-white/70">{room.type === 'AUDIO_CALL' ? 'Voice call' : 'Video call'}</div>
        </div>
        <button onClick={inviteToCall}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full px-3.5 h-9 text-xs font-semibold text-white bg-white/12 hover:bg-white/20 backdrop-blur border border-white/15 active:scale-95 transition shrink-0">
          <UserPlus size={14} /> Invite
        </button>
      </div>
    </div>
  );
}
