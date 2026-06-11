import { useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { LocalVideoTrack, Track } from 'livekit-client';
import { Mic, MicOff, SwitchCamera, PhoneOff, Minimize2 } from 'lucide-react';

interface Props {
  onMinimize: () => void;
  onLeave: () => void;
}

/**
 * Minimal call control bar: mute/unmute, switch camera (front/back),
 * minimize (keep the call running while navigating elsewhere), and leave.
 * Intentionally avoids LiveKit's default ControlBar (screen share, chat,
 * settings, etc.) per user request for a simpler call UI.
 */
export default function CallControlBar({ onMinimize, onLeave }: Props) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flipping, setFlipping] = useState(false);

  const toggleMic = () => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  const flipCamera = async () => {
    if (flipping || !isCameraEnabled) return;
    setFlipping(true);
    try {
      const pub = Array.from(localParticipant.videoTrackPublications.values()).find(
        (p) => p.source === Track.Source.Camera
      );
      const track = pub?.track;
      if (track instanceof LocalVideoTrack) {
        const next = facingMode === 'user' ? 'environment' : 'user';
        await track.restartTrack({ facingMode: next });
        setFacingMode(next);
      }
    } catch {
      // device may not have a second camera — ignore
    } finally {
      setFlipping(false);
    }
  };

  return (
    <div className="absolute bottom-0 inset-x-0 flex justify-center pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-8 bg-gradient-to-t from-black/85 to-transparent pointer-events-none z-10">
      <div className="flex items-center gap-3 pointer-events-auto">
        <button
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            isMicrophoneEnabled ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-white text-black'
          }`}
          title={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        >
          {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        <button
          onClick={flipCamera}
          disabled={!isCameraEnabled || flipping}
          className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-40 flex items-center justify-center text-white transition-colors"
          title="Switch camera"
        >
          <SwitchCamera size={20} />
        </button>

        <button
          onClick={onMinimize}
          className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          title="Minimize (stay in call)"
        >
          <Minimize2 size={18} />
        </button>

        <button
          onClick={onLeave}
          className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
          title="Leave call"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}
