import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  useParticipants,
  useSpeakingParticipants,
  useConnectionState,
} from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import '@livekit/components-styles';
import { ConnectionState, Track } from 'livekit-client';
import { Loader2, AlertCircle, Maximize2, Minimize2, PhoneOff } from 'lucide-react';
import { livekitApi } from '../../services/api';
import { useCallStore } from '../../store/callStore';
import CallControlBar from './CallControlBar';

const trackKey = (t: TrackReferenceOrPlaceholder) =>
  `${t.participant.identity}:${t.source}:${t.publication?.trackSid ?? 'ph'}`;

/** Audio-only call: avatar tiles with a speaking ring — no video, no switching. */
function AudioStage() {
  const participants = useParticipants();
  const speakers = useSpeakingParticipants();
  const speakingIds = new Set(speakers.map((p) => p.identity));
  const n = participants.length;
  const size = n <= 2 ? 116 : n <= 4 ? 92 : 72;
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', alignContent: 'center', justifyContent: 'center', gap: 22, padding: 16 }}>
      {participants.map((p) => {
        const speaking = speakingIds.has(p.identity);
        const label = p.name || p.identity || 'Guest';
        return (
          <div key={p.identity} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: size, height: size, borderRadius: '50%',
              background: 'linear-gradient(135deg, #e879f9, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: Math.round(size * 0.4), fontWeight: 700, color: '#fff',
              boxShadow: speaking ? '0 0 0 3px #e879f9, 0 0 30px rgba(232,121,249,0.6)' : '0 4px 20px rgba(0,0,0,0.4)',
              transition: 'box-shadow .15s ease',
            }}>
              {label[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 13, color: '#fff', fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 1:1 video: the other person fills the screen, and our own camera sits in a
 * small draggable picture-in-picture that can be moved anywhere on the video.
 */
function OneOnOneStage({ remote, selfTrack }: { remote: TrackReferenceOrPlaceholder; selfTrack?: TrackReferenceOrPlaceholder }) {
  const boundsRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={boundsRef} style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden', background: '#0a0a0f' }}>
      <ParticipantTile trackRef={remote} style={{ height: '100%', width: '100%' }} />
      {selfTrack && (
        <motion.div
          drag
          dragConstraints={boundsRef}
          dragMomentum={false}
          dragElastic={0}
          whileDrag={{ scale: 1.04 }}
          style={{
            position: 'absolute', top: 14, right: 14, width: 104, height: 152,
            borderRadius: 16, overflow: 'hidden', zIndex: 15,
            border: '2px solid rgba(232,121,249,0.7)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.55)',
            cursor: 'grab', touchAction: 'none',
          }}
        >
          <ParticipantTile trackRef={selfTrack} style={{ height: '100%', width: '100%' }} />
        </motion.div>
      )}
    </div>
  );
}

/**
 * Video call layout:
 *  - 1:1 → the other person full-screen with our own camera as a draggable PiP.
 *  - group → a calm even grid (no active-speaker switching, which flickered).
 *  - screen share → the shared screen focused with a camera strip below.
 */
function VideoStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  const cameras = tracks.filter((t) => t.source === Track.Source.Camera);
  const screenShare = tracks.find((t) => t.source === Track.Source.ScreenShare);
  const remoteCams = cameras.filter((t) => !t.participant.isLocal);
  const localCam = cameras.find((t) => t.participant.isLocal);

  // 1:1 — the other person full-screen, us as a draggable PiP.
  if (!screenShare && remoteCams.length === 1) {
    return <OneOnOneStage remote={remoteCams[0]} selfTrack={localCam} />;
  }

  // Group (or waiting alone) — even grid.
  if (!screenShare) {
    return (
      <GridLayout tracks={cameras} style={{ height: '100%' }}>
        <ParticipantTile />
      </GridLayout>
    );
  }

  // Screen share — big shared screen with a strip of the cameras.
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, boxSizing: 'border-box' }}>
      <div style={{ flex: 1, minHeight: 0, borderRadius: 16, overflow: 'hidden', border: '1px solid #330060' }}>
        <ParticipantTile trackRef={screenShare} style={{ height: '100%', width: '100%' }} />
      </div>
      {cameras.length > 0 && (
        <div style={{ flexShrink: 0, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {cameras.map((t) => (
            <div key={trackKey(t)} style={{ flexShrink: 0, width: 96, height: 72, borderRadius: 12, overflow: 'hidden', border: '1px solid #330060' }}>
              <ParticipantTile trackRef={t} style={{ width: '100%', height: '100%' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CallStage({ audioOnly }: { audioOnly: boolean }) {
  return audioOnly ? <AudioStage /> : <VideoStage />;
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
 * active call so it survives navigation: while the user is on the call page
 * it renders into that page's mount point (full size), and when they navigate
 * away it shrinks into a floating, draggable picture-in-picture pill instead
 * of disconnecting. The call only ends when the user explicitly leaves.
 */
export default function CallManager() {
  const { call, mountNode, leaveCall } = useCallStore();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pipLarge, setPipLarge] = useState(false);
  const pipBoundsRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    if (!call) return;
    setToken(null);
    setError(null);
    const req = call.threadId
      ? livekitApi.getDmToken(call.threadId)
      : livekitApi.getToken(call.roomName, call.groupId!);
    req
      .then((res) => {
        setToken(res.data.token);
        setWsUrl(res.data.wsUrl);
      })
      .catch(() => setError('Could not connect to the call.'));
  }, [call?.roomName, call?.groupId, call?.threadId]);

  if (!call) return null;

  const minimized = !mountNode;

  // Return to the chat without cutting the call (pop the call page off history
  // so it doesn't linger as a duplicate entry).
  const goToChat = () => {
    const idx = (window.history.state && (window.history.state as any).idx) ?? 0;
    const chatPath = call.threadId ? `/dm/${call.threadId}` : `/groups/${call.groupId}`;
    if (idx > 0) navigate(-1);
    else navigate(chatPath, { replace: true });
  };
  const handleMaximize = () => navigate(
    call.threadId
      ? `/dm/${call.threadId}/call?type=${call.audioOnly ? 'audio' : 'video'}`
      : `/groups/${call.groupId}/rooms/${call.roomId}`
  );

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
        <CallStage audioOnly={!!call.audioOnly} />
        <RoomAudioRenderer />
        <CallLoader />
        {minimized ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <Maximize2 size={18} className="text-white drop-shadow" />
          </div>
        ) : (
          <CallControlBar audioOnly={!!call.audioOnly} onMinimize={goToChat} onLeave={leaveCall} />
        )}
      </LiveKitRoom>
    );
  }

  if (minimized) {
    // Floating pill: draggable anywhere, with a resize toggle and leave button.
    return createPortal(
      <div ref={pipBoundsRef} className="fixed inset-0 z-[90] pointer-events-none">
        <motion.div
          drag
          dragConstraints={pipBoundsRef}
          dragMomentum={false}
          dragElastic={0}
          onDragStart={() => { draggedRef.current = true; }}
          onClick={() => { if (draggedRef.current) { draggedRef.current = false; return; } handleMaximize(); }}
          style={{ touchAction: 'none' }}
          className={`pointer-events-auto absolute bottom-24 right-3 sm:bottom-5 sm:right-5 rounded-2xl overflow-hidden shadow-2xl border border-white/10 cursor-grab bg-black ${
            pipLarge ? 'w-44 h-64 sm:w-56 sm:h-80' : 'w-28 h-40 sm:w-36 sm:h-48'
          }`}
          title="Drag to move · tap to return to the call"
        >
          {body}
          {/* Resize */}
          <button
            onClick={(e) => { e.stopPropagation(); setPipLarge((v) => !v); }}
            className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white z-20"
            title={pipLarge ? 'Shrink' : 'Enlarge'}
          >
            {pipLarge ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
          {/* Leave */}
          <button
            onClick={(e) => { e.stopPropagation(); leaveCall(); }}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-500 flex items-center justify-center text-white z-20"
            title="Leave call"
          >
            <PhoneOff size={11} />
          </button>
        </motion.div>
      </div>,
      document.body
    );
  }

  return createPortal(<div className="relative w-full h-full">{body}</div>, mountNode);
}
