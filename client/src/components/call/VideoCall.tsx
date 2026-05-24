import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useConnectionState,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { ConnectionState } from 'livekit-client';
import { livekitApi } from '../../services/api';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

interface Props {
  roomName: string;
  groupId: string;
  displayName: string;
}

function RoomLoader() {
  const state = useConnectionState();
  if (state === ConnectionState.Connecting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 pointer-events-none">
        <Loader2 size={32} className="animate-spin text-brand" />
        <p className="text-slate-400 text-sm">Connecting to room…</p>
      </div>
    );
  }
  return null;
}

export default function VideoCall({ roomName, groupId, displayName }: Props) {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setToken(null);
    setError(null);
    setLoading(true);

    livekitApi
      .getToken(roomName, groupId)
      .then((res) => {
        setToken(res.data.token);
        setWsUrl(res.data.wsUrl);
      })
      .catch(() => setError('Could not connect to the call. Check your LiveKit configuration.'))
      .finally(() => setLoading(false));
  }, [roomName, groupId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={28} className="animate-spin text-brand" />
        <p className="text-slate-400 text-sm">Preparing room…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <AlertCircle size={36} className="text-red-400" />
        <p className="text-red-400 font-semibold">Connection Error</p>
        <p className="text-slate-500 text-sm">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm transition-colors"
        >
          <ArrowLeft size={15} />
          Go back
        </button>
      </div>
    );
  }

  if (!token) return null;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={wsUrl}
      connect
      video
      audio
      data-lk-theme="default"
      style={{ height: '100%', background: '#0a0a0f' }}
      // Navigate back automatically when the user presses Leave inside the call UI
      onDisconnected={() => navigate(-1)}
    >
      <VideoConference />
      <RoomAudioRenderer />
      <RoomLoader />
    </LiveKitRoom>
  );
}
