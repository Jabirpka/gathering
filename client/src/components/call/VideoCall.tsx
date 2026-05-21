import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useConnectionState,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { ConnectionState } from 'livekit-client';
import { livekitApi } from '../../services/api';
import { Loader2, AlertCircle } from 'lucide-react';

interface Props {
  roomName: string;
  groupId: string;
  displayName: string;
}

function RoomLoader() {
  const state = useConnectionState();
  if (state === ConnectionState.Connecting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={32} className="animate-spin text-brand" />
        <p className="text-slate-400 text-sm">Connecting to room…</p>
      </div>
    );
  }
  return null;
}

export default function VideoCall({ roomName, groupId, displayName }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    livekitApi.getToken(roomName, groupId)
      .then((res) => {
        setToken(res.data.token);
        setWsUrl(res.data.wsUrl);
      })
      .catch(() => setError('Failed to get room token. Check your LiveKit configuration.'));
  }, [roomName, groupId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-red-400 font-medium">Connection Error</p>
        <p className="text-slate-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={28} className="animate-spin text-brand" />
        <p className="text-slate-400 text-sm">Preparing room…</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={wsUrl}
      connect
      video
      audio
      data-lk-theme="default"
      style={{ height: '100%', background: '#0a0a0f' }}
    >
      <VideoConference />
      <RoomAudioRenderer />
      <RoomLoader />
    </LiveKitRoom>
  );
}
