import { useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDmStore } from '../store/dmStore';
import { useCallStore } from '../store/callStore';

/** Minimize (go back to the chat) without cutting the call: pop the call page
 *  off history, or replace if there's nothing behind us. The call keeps running
 *  and shrinks into the floating pill. */
function popOrReplace(navigate: ReturnType<typeof useNavigate>, fallback: string) {
  const idx = (window.history.state && (window.history.state as any).idx) ?? 0;
  if (idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}

/**
 * 1:1 DM call. Mirrors RoomPage but scoped to a DM thread: it joins the DM call
 * room (which rings the other person, handled in callStore), and hands
 * CallManager a mount point to portal the live call into.
 */
export default function DmCallPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const [params] = useSearchParams();
  const type = params.get('type') === 'audio' ? 'audio' : 'video';
  const user = useAuthStore((s) => s.user);
  const { threads, fetchThreads } = useDmStore();
  const { joinCall, setMountNode, call } = useCallStore();
  const navigate = useNavigate();
  const joinedRef = useRef(false);

  const thread = threads.find((t) => t.id === threadId);
  const partner = thread?.partner;
  const partnerName = partner ? (partner.nickname || partner.name) : 'Call';

  useEffect(() => { if (!thread) fetchThreads(); }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    // callStore emits the ring (dmcall:join) and, on leaveCall(), the cancel —
    // so navigating away here just minimizes; it never ends the call.
    joinCall({
      roomName: `dm-${threadId}`,
      threadId,
      roomId: `dm-${threadId}`,
      roomLabel: partnerName,
      displayName: user?.name ?? 'You',
      audioOnly: type === 'audio',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // When the call ends (Leave pressed), return to the conversation.
  useEffect(() => {
    if (call) joinedRef.current = true;
    else if (joinedRef.current) popOrReplace(navigate, `/dm/${threadId}`);
  }, [call, threadId, navigate]);

  const setCallMount = useCallback((node: HTMLDivElement | null) => setMountNode(node), [setMountNode]);

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-call">
      {/* Live call fills the screen (CallManager portals in here). */}
      <div ref={setCallMount} className="absolute inset-0" />

      {/* Immersive top overlay: back · partner */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-2.5 px-3 pb-8 pointer-events-none bg-gradient-to-b from-black/70 via-black/30 to-transparent"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button onClick={() => popOrReplace(navigate, `/dm/${threadId}`)}
          className="pointer-events-auto w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white shrink-0" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        {partner?.avatar ? (
          <img src={partner.avatar} className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-white/20" alt={partnerName} />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-brand flex items-center justify-center text-sm font-bold text-white shrink-0">
            {partnerName[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate drop-shadow">{partnerName}</p>
          <p className="text-[11px] text-white/70">{type === 'audio' ? 'Voice call' : 'Video call'}</p>
        </div>
      </div>
    </div>
  );
}
