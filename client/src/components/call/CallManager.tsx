import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  useConnectionState,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { ConnectionState, Track } from 'livekit-client';
import { Loader2, AlertCircle, Maximize2, PhoneOff } from 'lucide-react';
import { livekitApi } from '../../services/api';
import { useCallStore } from '../../store/callStore';
import CallControlBar from './CallControlBar';

function CallStage() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false });
  return (
    <GridLayout tracks={tracks} style={{ height: '100%' }}>
      <ParticipantTile />
    </GridLayout>
  );
}

function CallLoader() {
  const state = useConnectionState();
  if (state === ConnectionState.Connecting || state === ConnectionState.Reconnecting) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a0a0f] pointer-events-none z-20">
        <Loader2 size={24} className="animate-spin text-brand" />
        <p className="text-slate-500 text-xs">Connecting…</p>
      </div>
    );
  }
  return null;
}

/**
 * Mounted once near the app root. Holds the LiveKit room connection for an
 * active call so it survives navigation: while the user is on the room page
 * it renders into that page's mount point (full size), and when they
 * navigate away it shrinks into a floating picture-in-picture pill instead
 * of disconnecting. The call only ends when the user explicitly leaves.
 */
export default function CallManager() {
  const { call, mountNode, leaveCall } = useCallStore();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!call) return;
    setToken(null);
    setError(null);
    livekitApi
      .getToken(call.roomName, call.groupId)
      .then((res) => {
        setToken(res.data.token);
        setWsUrl(res.data.wsUrl);
      })
      .catch(() => setError('Could not connect to the call.'));
  }, [call?.roomName, call?.groupId]);

  if (!call) return null;

  const minimized = !mountNode;
  const handleMaximize = () => navigate(`/groups/${call.groupId}/rooms/${call.roomId}`);
  const handleMinimize = () => navigate(`/groups/${call.groupId}`);

  let body: ReactNode;
  if (error) {
    body = (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4 bg-[#0a0a0f]">
        <AlertCircle size={24} className="text-red-400" />
        <p className="text-red-400 text-xs font-medium">{error}</p>
        <button onClick={leaveCall} className="text-xs text-slate-500 hover:text-slate-200 underline">
          Close
        </button>
      </div>
    );
  } else if (!token) {
    body = (
      <div className="flex items-center justify-center h-full bg-[#0a0a0f]">
        <Loader2 size={22} className="animate-spin text-brand" />
      </div>
    );
  } else {
    body = (
      <LiveKitRoom
        token={token}
        serverUrl={wsUrl}
        connect
        video={!call.audioOnly}
        audio
        data-lk-theme="default"
        style={{ height: '100%', width: '100%', background: '#0a0a0f', position: 'relative' }}
        onDisconnected={leaveCall}
      >
        <CallStage />
        <RoomAudioRenderer />
        <CallLoader />
        {minimized ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Maximize2 size={18} className="text-white drop-shadow" />
          </div>
        ) : (
          <CallControlBar onMinimize={handleMinimize} onLeave={leaveCall} />
        )}
      </LiveKitRoom>
    );
  }

  if (minimized) {
    return createPortal(
      <div
        className="fixed bottom-24 right-3 sm:bottom-5 sm:right-5 z-[90] w-28 h-40 sm:w-36 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border border-white/10 cursor-pointer bg-black animate-fade-in"
        onClick={handleMaximize}
        title="Return to call"
      >
        {body}
        <button
          onClick={(e) => {
            e.stopPropagation();
            leaveCall();
          }}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-500/100/80 flex items-center justify-center text-white z-20"
          title="Leave call"
        >
          <PhoneOff size={11} />
        </button>
      </div>,
      document.body
    );
  }

  return createPortal(<div className="relative w-full h-full">{body}</div>, mountNode);
}
