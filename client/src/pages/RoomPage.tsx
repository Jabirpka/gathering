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
import { ArrowLeft, Film, Users, MessageSquare, Play } from 'lucide-react';
import clsx from 'clsx';

type Panel = 'chat' | 'comments';

export default function RoomPage() {
  const { groupId, roomId } = useParams<{ groupId: string; roomId: string }>();
  const { activeGroup, fetchGroup, videoSession, messages } = useGroupStore();
  const user = useAuthStore((s) => s.user);
  const [panel, setPanel] = useState<Panel>('chat');
  const [showStartVideo, setShowStartVideo] = useState(false);
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
  const myMember = activeGroup?.members?.find((m) => m.userId === user?.id);
  const isHost = videoSession?.hostId === user?.id;

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
      <div className="h-12 shrink-0 border-b border-white/5 bg-surface-1 flex items-center px-4 gap-3">
        <Link to={`/groups/${groupId}`} className="btn-ghost p-1.5">
          <ArrowLeft size={15} />
        </Link>
        <span className="text-sm font-medium text-slate-300 truncate">{room.name}</span>
        <span className="badge bg-surface-3 text-slate-500 text-[10px]">{activeGroup?.name}</span>

        <div className="flex-1" />

        {isWatchParty && myMember?.status === 'APPROVED' && (
          <button
            onClick={() => setShowStartVideo(true)}
            className="btn-secondary text-xs gap-1.5 py-1.5"
          >
            <Film size={13} />
            {videoSession ? 'Change Video' : 'Start Video'}
          </button>
        )}

        {/* Panel toggles */}
        <div className="flex gap-1 bg-surface-2 p-0.5 rounded-lg">
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
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-hidden bg-black relative">
          {isWatchParty && (
            <>
              {videoSession ? (
                <VideoPlayer session={videoSession} roomId={roomId} groupId={groupId} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
                  <div className="w-20 h-20 rounded-2xl bg-brand/10 flex items-center justify-center mb-2">
                    <Play size={36} className="text-brand-light" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Watch Party</h2>
                  <p className="text-slate-400 text-sm max-w-xs">
                    Start a synchronized watch session. Everyone in the room will watch in perfect sync.
                  </p>
                  <button onClick={() => setShowStartVideo(true)} className="btn-primary">
                    <Film size={16} />
                    Start a Video
                  </button>
                </div>
              )}
            </>
          )}

          {isVideoCall && groupId && (
            <VideoCall
              roomName={`${groupId}-${roomId}`}
              groupId={groupId}
              displayName={user?.name ?? 'Participant'}
            />
          )}
        </div>

        {/* Side panel */}
        <div className="w-72 shrink-0 overflow-hidden flex flex-col">
          {panel === 'chat' && <ChatPanel groupId={groupId} roomId={roomId} />}
          {panel === 'comments' && videoSession && (
            <VideoComments
              session={videoSession}
              roomId={roomId}
              currentTime={0}
            />
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
