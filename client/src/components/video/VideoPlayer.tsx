import { useRef, useState, useEffect, useCallback } from 'react';
import { useGroupStore } from '../../store/groupStore';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../hooks/useSocket';
import { useVideoSync } from '../../hooks/useSocket';
import { VideoSession, VideoSyncEvent } from '../../types';
import VideoControls from './VideoControls';
import { AlertCircle } from 'lucide-react';

interface Props {
  session: VideoSession;
  roomId: string;
  groupId: string;
  onTimeUpdate?: (seconds: number) => void;
}

const SYNC_THRESHOLD = 2; // seconds

// ── YouTube IFrame API loader (loaded once, shared across mounts) ──────────
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
  return ytApiPromise;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function VideoPlayer({ session, roomId, groupId, onTimeUpdate }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const currentTimeRef = useRef(session.currentTime);
  const lastReportedSecRef = useRef(-1);
  const mutedRef = useRef(false);

  const user = useAuthStore((s) => s.user);
  const { videoComments } = useGroupStore();
  const [isPlaying, setIsPlaying] = useState(session.isPlaying);
  const [currentTime, setCurrentTime] = useState(session.currentTime);
  const [duration, setDuration] = useState(0);
  const [showComments, setShowComments] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [muted, setMuted] = useState(false);
  const isHost = session.hostId === user?.id;

  const isYouTube = session.videoUrl.includes('youtube.com') || session.videoUrl.includes('youtu.be');
  const youTubeId = isYouTube ? extractYouTubeId(session.videoUrl) : null;

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const emitSync = useCallback(
    (action: 'play' | 'pause' | 'seek', time: number) => {
      getSocket()?.emit('video:sync', { sessionId: session.id, roomId, action, currentTime: time });
    },
    [session.id, roomId]
  );

  // Report time to parent (throttled to ~1Hz for video comments timestamping)
  const reportTime = useCallback((t: number) => {
    setCurrentTime(t);
    const sec = Math.floor(t);
    if (sec !== lastReportedSecRef.current) {
      lastReportedSecRef.current = sec;
      onTimeUpdate?.(sec);
    }
  }, [onTimeUpdate]);

  // ── YouTube player setup ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isYouTube || !youTubeId || !ytContainerRef.current) return;
    let cancelled = false;
    let player: any;

    loadYouTubeApi().then(() => {
      if (cancelled || !ytContainerRef.current || !window.YT) return;
      player = new window.YT.Player(ytContainerRef.current, {
        videoId: youTubeId,
        playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, playsinline: 1, disablekb: 1 },
        events: {
          onReady: (e: any) => {
            ytPlayerRef.current = e.target;
            setDuration(e.target.getDuration() || 0);
            if (mutedRef.current) e.target.mute();
            // Sync to whatever the room's current state is
            getSocket()?.emit('video:request-state', { sessionId: session.id, roomId });
          },
          onStateChange: (e: any) => {
            const YTState = window.YT?.PlayerState;
            if (!YTState) return;
            if (e.data === YTState.PLAYING) {
              setBuffering(false);
              setIsPlaying(true);
              if (isHost) emitSync('play', e.target.getCurrentTime());
            } else if (e.data === YTState.PAUSED) {
              setIsPlaying(false);
              if (isHost) emitSync('pause', e.target.getCurrentTime());
            } else if (e.data === YTState.BUFFERING) {
              setBuffering(true);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try { player?.destroy(); } catch {}
      ytPlayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYouTube, youTubeId]);

  // Poll YouTube playback time (no native timeupdate event for iframes)
  useEffect(() => {
    if (!isYouTube) return;
    const interval = setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;
      reportTime(player.getCurrentTime());
    }, 500);
    return () => clearInterval(interval);
  }, [isYouTube, reportTime]);

  // ── Incoming sync events from the host ────────────────────────────────────
  const handleSync = useCallback((event: VideoSyncEvent) => {
    const latency = Math.max(0, (Date.now() - event.timestamp) / 1000);
    const targetTime = event.action === 'pause' ? event.currentTime : event.currentTime + latency;

    if (isYouTube) {
      const player = ytPlayerRef.current;
      if (!player) return;
      if (event.action === 'play') {
        player.seekTo(targetTime, true);
        player.playVideo();
        setIsPlaying(true);
      } else if (event.action === 'pause') {
        player.seekTo(event.currentTime, true);
        player.pauseVideo();
        setIsPlaying(false);
      } else if (event.action === 'seek') {
        player.seekTo(targetTime, true);
      }
    } else {
      const video = videoRef.current;
      if (!video) return;
      if (event.action === 'play') {
        video.currentTime = targetTime;
        video.play().catch(() => {});
        setIsPlaying(true);
      } else if (event.action === 'pause') {
        video.currentTime = event.currentTime;
        video.pause();
        setIsPlaying(false);
      } else if (event.action === 'seek') {
        video.currentTime = targetTime;
      }
    }
    reportTime(targetTime);
  }, [isYouTube, reportTime]);

  // ── State response for late joiners / YouTube player (re)ready ───────────
  const handleState = useCallback((state: { isPlaying: boolean; currentTime: number; timestamp: number }) => {
    const latency = Math.max(0, (Date.now() - state.timestamp) / 1000);
    const targetTime = state.currentTime + (state.isPlaying ? latency : 0);

    if (isYouTube) {
      const player = ytPlayerRef.current;
      if (!player) return;
      player.seekTo(targetTime, true);
      if (state.isPlaying) player.playVideo();
      else player.pauseVideo();
    } else {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = targetTime;
      if (state.isPlaying) video.play().catch(() => {});
    }
    setIsPlaying(state.isPlaying);
    reportTime(targetTime);
  }, [isYouTube, reportTime]);

  useVideoSync(roomId, handleSync, handleState);

  // Request current state on mount (direct video; YouTube requests in onReady)
  useEffect(() => {
    if (isYouTube) return;
    getSocket()?.emit('video:request-state', { sessionId: session.id, roomId });
  }, [session.id, roomId, isYouTube]);

  // ── Host controls ──────────────────────────────────────────────────────────
  const handleTogglePlay = () => {
    if (!isHost) return;
    if (isYouTube) {
      const player = ytPlayerRef.current;
      if (!player) return;
      if (isPlaying) player.pauseVideo();
      else player.playVideo();
    } else {
      const video = videoRef.current;
      if (!video) return;
      if (isPlaying) video.pause();
      else video.play().catch(() => {});
    }
  };

  const handleSeek = (time: number) => {
    if (!isHost) return;
    if (isYouTube) {
      ytPlayerRef.current?.seekTo(time, true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    reportTime(time);
    emitSync('seek', time);
  };

  const handleToggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      if (isYouTube) {
        const player = ytPlayerRef.current;
        if (player) next ? player.mute() : player.unMute();
      } else if (videoRef.current) {
        videoRef.current.muted = next;
      }
      return next;
    });
  };

  // Native <video> events (direct file playback)
  const handleVideoPlay = () => {
    setIsPlaying(true);
    if (isHost) emitSync('play', videoRef.current?.currentTime ?? currentTimeRef.current);
  };
  const handleVideoPause = () => {
    setIsPlaying(false);
    if (isHost) emitSync('pause', videoRef.current?.currentTime ?? currentTimeRef.current);
  };
  const handleTimeUpdate = () => {
    reportTime(videoRef.current?.currentTime ?? 0);
  };

  // Auto-sync drift correction (non-host only) — uses refs so the interval
  // doesn't get torn down/recreated on every currentTime update
  useEffect(() => {
    if (isHost) return;
    const interval = setInterval(() => {
      if (isYouTube) {
        const player = ytPlayerRef.current;
        if (!player || typeof player.getCurrentTime !== 'function') return;
        const drift = Math.abs(player.getCurrentTime() - currentTimeRef.current);
        if (drift > SYNC_THRESHOLD) player.seekTo(currentTimeRef.current, true);
      } else {
        const video = videoRef.current;
        if (!video) return;
        const drift = Math.abs(video.currentTime - currentTimeRef.current);
        if (drift > SYNC_THRESHOLD) video.currentTime = currentTimeRef.current;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isHost, isYouTube]);

  if (isYouTube && !youTubeId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-red-400 font-medium">Couldn't read this YouTube link</p>
        <p className="text-slate-500 text-sm">Try pasting the full video URL.</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col bg-black w-full h-full">
      {/* Video */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        {isYouTube ? (
          <div ref={ytContainerRef} className="w-full h-full" />
        ) : (
          <video
            ref={videoRef}
            src={session.videoUrl}
            className="max-w-full max-h-full w-full h-full object-contain"
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration)}
            onWaiting={() => setBuffering(true)}
            onCanPlay={() => setBuffering(false)}
            onClick={handleTogglePlay}
            playsInline
          />
        )}

        {buffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}

        {/* Timestamped comments overlay */}
        {showComments && videoComments
          .filter((c) => Math.abs(c.timestamp - currentTime) < 5)
          .map((c) => (
            <div key={c.id} className="absolute bottom-16 left-4 right-4 animate-slide-up pointer-events-none">
              <div className="inline-flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm max-w-xs">
                {c.user.avatar && <img src={c.user.avatar} className="w-5 h-5 rounded-full" alt="" />}
                <span className="text-white/70 font-medium text-xs">{c.user.name}</span>
                <span className="text-white">{c.content}</span>
              </div>
            </div>
          ))}

        {!isHost && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full text-xs text-slate-400 pointer-events-none">
            👁 Synced
          </div>
        )}
        {isHost && (
          <div className="absolute top-3 right-3 bg-brand/80 backdrop-blur px-2.5 py-1 rounded-full text-xs text-white font-medium pointer-events-none">
            🎬 You're the host
          </div>
        )}
      </div>

      {/* Controls */}
      <VideoControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        isHost={isHost}
        muted={muted}
        showComments={showComments}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onToggleMute={handleToggleMute}
        onToggleComments={() => setShowComments((v) => !v)}
        session={session}
        roomId={roomId}
      />
    </div>
  );
}
