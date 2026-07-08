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
    <div className="h-full flex flex-col overflow-hidden">
      <div className="h-14 shrink-0 border-b border-white/10 glass-panel flex items-center px-3 gap-2">
        {/* Back minimizes the call (keeps it running); Leave (in the controls) ends it. */}
        <button onClick={() => popOrReplace(navigate, `/dm/${threadId}`)} className="btn-ghost p-1.5">
          <ArrowLeft size={16} />
        </button>
        {partner?.avatar ? (
          <img src={partner.avatar} className="w-9 h-9 rounded-xl object-cover shrink-0" alt={partnerName} />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-brand flex items-center justify-center text-sm font-bold text-white shrink-0">
            {partnerName[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{partnerName}</p>
          <p className="text-[11px] text-emerald-400">{type === 'audio' ? 'Voice call' : 'Video call'}</p>
        </div>
      </div>
      <div ref={setCallMount} className="flex-1 relative bg-black" />
    </div>
  );
}
