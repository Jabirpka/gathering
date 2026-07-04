import { useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { LocalVideoTrack, Track } from 'livekit-client';
import { Mic, MicOff, SwitchCamera, ScreenShare, ScreenShareOff, PhoneOff, Minimize2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

interface Props {
  onMinimize: () => void;
  onLeave: () => void;
}

/**
 * Minimal call control bar: mute/unmute, switch camera (front/back), screen
 * share, minimize (keep the call running while navigating elsewhere), and
 * leave. Intentionally avoids LiveKit's default ControlBar (chat, settings,
 * etc.) per user request for a simpler call UI.
 */
export default function CallControlBar({ onMinimize, onLeave }: Props) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flipping, setFlipping] = useState(false);
  const [sharing, setSharing] = useState(false);

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

  const toggleScreenShare = async () => {
    if (sharing) return;

    // Android's WebView doesn't implement getDisplayMedia, so screen sharing
    // only works on the web/desktop build. Tell the user instead of failing
    // silently when they tap it in the app.
    const turningOn = !isScreenShareEnabled;
    const isNative = Capacitor.isNativePlatform();

    if (turningOn && typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
      toast.error(
        isNative
          ? 'Screen sharing needs an up-to-date Android System WebView. Update it from the Play Store.'
          : 'Screen sharing isn’t supported in this browser.'
      );
      return;
    }

    setSharing(true);
    try {
      // System-audio capture is unsupported on Android's WebView and makes the
      // whole request fail, so share video only on native; keep audio on web.
      await localParticipant.setScreenShareEnabled(turningOn, { audio: !isNative });
    } catch (err: any) {
      // Ignore the user cancelling the picker; surface anything else.
      if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
        toast.error('Couldn’t start screen sharing.');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      {isScreenShareEnabled && (
        <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none z-10">
          <span className="flex items-center gap-1.5 bg-brand/90 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur">
            <ScreenShare size={13} />
            You're sharing your screen
          </span>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 flex justify-center pb-[max(env(safe-area-inset-bottom),1rem)] pt-8 bg-gradient-to-t from-black/85 to-transparent pointer-events-none z-10">
        <div className="flex items-end gap-3.5 sm:gap-4 pointer-events-auto">
          {/* Mute */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={toggleMic}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isMicrophoneEnabled ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-white text-black'
              }`}
            >
              {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <span className="text-[10px] text-white/70">{isMicrophoneEnabled ? 'Mute' : 'Unmute'}</span>
          </div>

          {/* Flip camera */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={flipCamera}
              disabled={!isCameraEnabled || flipping}
              className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-40 flex items-center justify-center text-white transition-colors"
            >
              <SwitchCamera size={20} />
            </button>
            <span className="text-[10px] text-white/70">Flip</span>
          </div>

          {/* Screen share */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={toggleScreenShare}
              disabled={sharing}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${
                isScreenShareEnabled ? 'bg-gradient-to-br from-brand to-accent text-white' : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              {isScreenShareEnabled ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
            </button>
            <span className="text-[10px] text-white/70">Share</span>
          </div>

          {/* Minimize */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={onMinimize}
              className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
            >
              <Minimize2 size={18} />
            </button>
            <span className="text-[10px] text-white/70">Minimize</span>
          </div>

          {/* Leave */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={onLeave}
              className="w-[58px] h-12 rounded-[24px] bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors shadow-lg shadow-red-500/40"
            >
              <PhoneOff size={20} />
            </button>
            <span className="text-[10px] font-semibold text-red-400">Leave</span>
          </div>
        </div>
      </div>
    </>
  );
}
