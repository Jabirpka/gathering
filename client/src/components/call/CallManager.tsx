import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
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
import { Loader2, AlertCircle, Maximize2, PhoneOff } from 'lucide-react';
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
 * Video call layout. Small groups (≤4, no screen share) get a calm even grid —
 * no active-speaker switching, which flickers jarringly on 2-4 person calls.
 * Larger calls (or a screen share) switch to a focus + participant strip.
 */
function VideoStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  const speakers = useSpeakingParticipants();
  const topSpeakerId = speakers[0]?.identity;
  const screenShare = tracks.find((t) => t.source === Track.Source.ScreenShare);

  if (!screenShare && tracks.length <= 4) {
    return (
      <GridLayout tracks={tracks} style={{ height: '100%' }}>
        <ParticipantTile />
      </GridLayout>
    );
  }

  const speakerCam = tracks.find(
    (t) => t.source === Track.Source.Camera && t.participant.identity === topSpeakerId
  );
  const focus = screenShare ?? speakerCam ?? tracks[0];
  if (!focus) return null;

  const focusKey = trackKey(focus);
  const others = tracks.filter((t) => trackKey(t) !== focusKey);
  const focusIsSpeaker = !screenShare && focus.participant.identity === topSpeakerId;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, boxSizing: 'border-box' }}>
      <div
        style={{
          flex: 1, minHeight: 0, borderRadius: 16, overflow: 'hidden', position: 'relative',
          border: focusIsSpeaker ? '2px solid #e879f9' : '1px solid #330060',
          boxShadow: focusIsSpeaker ? '0 0 0 3px rgba(232,121,249,0.18)' : 'none',
        }}
      >
        <ParticipantTile trackRef={focus} style={{ height: '100%', width: '100%' }} />
      </div>

      {others.length > 0 && (
        <div style={{ flexShrink: 0, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {others.map((t) => {
            const isSpeaking = t.participant.identity === topSpeakerId;
            return (
              <div
                key={trackKey(t)}
                style={{
                  flexShrink: 0, width: 96, height: 72, borderRadius: 12, overflow: 'hidden',
                  border: isSpeaking ? '2px solid #a855f7' : '1px solid #330060',
                }}
              >
                <ParticipantTile trackRef={t} style={{ width: '100%', height: '100%' }} />
              </div>
            );
          })}
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
        <CallStage audioOnly={!!call.audioOnly} />
        <RoomAudioRenderer />
        <CallLoader />
        {minimized ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Maximize2 size={18} className="text-white drop-shadow" />
          </div>
        ) : (
          <CallControlBar audioOnly={!!call.audioOnly} onMinimize={handleMinimize} onLeave={leaveCall} />
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
