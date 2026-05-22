import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { useAuthStore } from '../store/authStore';
import { getSocket } from '../hooks/useSocket';
import ChatPanel from '../components/chat/ChatPanel';
import VideoPlayer from '../components/video/VideoPlayer';
import VideoComments from '../components/video/VideoComments';
import VideoCall from '../components/call/VideoCall';
import StartVideoModal from '../components/video/StartVideoModal';
import { ArrowLeft, Film, MessageSquare, Play, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

type Panel = 'chat' | 'comments';

export default function RoomPage() {
  const { groupId, roomId } = useParams<{ groupId: string; roomId: string }>();
  const { activeGroup, fetchGroup, videoSession } = useGroupStore();
  const user = useAuthStore((s) => s.user);
  const [panel, setPanel] = useState<Panel>('chat');
  const [showStartVideo, setShowStartVideo] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    if (groupId) fetchGroup(groupId);
  }, [groupId]);

  useEffect(() => {
    if (!roomId) return;
    socket?.emit('room:join', { roomId });
    return () => { socket?.emit('room:leave', { roomId }); };
  }, [roomId]);

  const room = activeGroup?.rooms?.find((r) => r.id === roomId);
  const isWatchParty = room?.type === 'VIDEO_WATCH';
  const isVideoCall = room?.type === 'VIDEO_CALL' || room?.type === 'AUDIO_CALL';

  if (!room || !groupId || !roomId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Room not found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Room header */}
      <div className="h-12 shrink-0 border-b border-white/5 bg-surface-1 flex items-center px-3 gap-2">
        <Link to={`/groups/${groupId}`} className="btn-ghost p-1.5">
          <ArrowLeft size={15} />
        </Link>
        <span className="text-sm font-medium text-slate-300 truncate">{room.name}</span>
        <span className="badge bg-surface-3 text-slate-500 text-[10px] hidden sm:inline-flex">
          {activeGroup?.name}
        </span>
        <div className="flex-1" />

        {isWatchParty && (
          <button
            onClick={() => setShowStartVideo(true)}
            className="btn-secondary text-xs gap-1.5 py-1.5 px-3"
          >
            <Film size={13} />
            <span className="hidden sm:inline">{videoSession ? 'Change' : 'Start Video'}</span>
            <span className="sm:hidden">▶</span>
          </button>
        )}

        {/* Panel toggles — desktop */}
        <div className="hidden sm:flex gap-1 bg-surface-2 p-0.5 rounded-lg">
          <button
            onClick={() => setPanel('chat')}
            className={clsx('p-1.5 rounded-md transition-colors', panel === 'chat' ? 'bg-brand/30 text-brand-light' : 'text-slate-500 hover:text-slate-300')}
          >
            <MessageSquare size={14} />
          </button>
          {isWatchParty && videoSession && (
            <button
              onClick={() => setPanel('comments')}
              className={clsx('p-1.5 rounded-md transition-colors', panel === 'comments' ? 'bg-brand/30 text-brand-light' : 'text-slate-500 hover:text-slate-300')}
            >
              <Film size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Room body */}
      <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
        {/* Main content */}
        <div className={clsx(
          'overflow-hidden bg-black relative',
          chatOpen ? 'h-[55vw] sm:h-auto sm:flex-1' : 'flex-1'
        )}>
          {isWatchParty && (
            videoSession ? (
              <VideoPlayer session={videoSession} roomId={roomId} groupId={groupId} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-brand/10 flex items-center justify-center">
                  <Play size={28} className="text-brand-light" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Watch Party</h2>
                <p className="text-slate-400 text-sm max-w-xs">
                  Start a synchronized watch session. Everyone watches in perfect sync.
                </p>
                <button onClick={() => setShowStartVideo(true)} className="btn-primary">
                  <Film size={16} />
                  Start a Video
                </button>
              </div>
            )
          )}

          {isVideoCall && groupId && (
            <VideoCall
              roomName={`${groupId}-${roomId}`}
              groupId={groupId}
              displayName={user?.name ?? 'Participant'}
            />
          )}
        </div>

        {/* Mobile chat toggle button */}
        <button
          onClick={() => setChatOpen((v) => !v)}
          className="sm:hidden flex items-center justify-between px-4 py-2.5 bg-surface-1 border-t border-white/5 text-sm text-slate-400"
        >
          <span className="flex items-center gap-2">
            <MessageSquare size={14} />
            Chat
          </span>
          {chatOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {/* Side panel — full on desktop, collapsible on mobile */}
        <div className={clsx(
          'sm:w-72 sm:flex shrink-0 overflow-hidden flex-col border-t sm:border-t-0 sm:border-l border-white/5',
          chatOpen ? 'flex h-64' : 'hidden sm:flex'
        )}>
          {panel === 'chat' && <ChatPanel groupId={groupId} roomId={roomId} />}
          {panel === 'comments' && videoSession && (
            <VideoComments session={videoSession} roomId={roomId} currentTime={0} />
          )}
        </div>
      </div>

      {showStartVideo && groupId && roomId && (
        <StartVideoModal
          open={showStartVideo}
          groupId={groupId}
          roomId={roomId}
          onClose={() => setShowStartVideo(false)}
        />
      )}
    </div>
  );
}
