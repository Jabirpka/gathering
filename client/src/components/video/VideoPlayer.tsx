import { useRef, useState, useEffect, useCallback } from 'react';
import { useGroupStore } from '../../store/groupStore';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../hooks/useSocket';
import { useVideoSync } from '../../hooks/useSocket';
import { VideoSession, VideoSyncEvent } from '../../types';
import VideoControls from './VideoControls';
import VideoComments from './VideoComments';

interface Props {
  session: VideoSession;
  roomId: string;
  groupId: string;
}

const SYNC_THRESHOLD = 2; // seconds

export default function VideoPlayer({ session, roomId, groupId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const user = useAuthStore((s) => s.user);
  const { videoComments } = useGroupStore();
  const [isPlaying, setIsPlaying] = useState(session.isPlaying);
  const [currentTime, setCurrentTime] = useState(session.currentTime);
  const [duration, setDuration] = useState(0);
  const [showComments, setShowComments] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const isHost = session.hostId === user?.id;
  const socket = getSocket();

  const isYouTube = session.videoUrl.includes('youtube.com') || session.videoUrl.includes('youtu.be');

  // Convert YouTube URL to embed
  const embedUrl = isYouTube
    ? (() => {
        const id = session.videoUrl.match(/(?:v=|youtu\.be\/)([^&?]+)/)?.[1];
        return id ? `https://www.youtube.com/embed/${id}?enablejsapi=1&controls=0&rel=0` : session.videoUrl;
      })()
    : null;

  // Sync handler for incoming events
  const handleSync = useCallback((event: VideoSyncEvent) => {
    const video = videoRef.current;
    if (!video) return;

    const latency = (Date.now() - event.timestamp) / 1000;
    const targetTime = event.currentTime + latency;

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
  }, []);

  const handleState = useCallback(
    (state: { isPlaying: boolean; currentTime: number; timestamp: number }) => {
      const video = videoRef.current;
      if (!video) return;
      const latency = (Date.now() - state.timestamp) / 1000;
      video.currentTime = state.currentTime + (state.isPlaying ? latency : 0);
      if (state.isPlaying) video.play().catch(() => {});
    },
    []
  );

  useVideoSync(roomId, handleSync, handleState);

  // Request current state on mount
  useEffect(() => {
    socket?.emit('video:request-state', { sessionId: session.id, roomId });
  }, [session.id, roomId]);

  // Host controls
  const emitSync = (action: 'play' | 'pause' | 'seek', time: number) => {
    socket?.emit('video:sync', { sessionId: session.id, roomId, action, currentTime: time });
  };

  const handlePlay = () => {
    if (!isHost) return;
    emitSync('play', videoRef.current?.currentTime ?? currentTime);
    setIsPlaying(true);
  };

  const handlePause = () => {
    if (!isHost) return;
    emitSync('pause', videoRef.current?.currentTime ?? currentTime);
    setIsPlaying(false);
  };

  const handleSeek = (time: number) => {
    if (!isHost) return;
    if (videoRef.current) videoRef.current.currentTime = time;
    emitSync('seek', time);
    setCurrentTime(time);
  };

  const handleTogglePlay = () => {
    if (!isHost) return;
    if (isPlaying) handlePause();
    else handlePlay();
  };

  // Auto-sync drift correction (non-host only)
  useEffect(() => {
    if (isHost || !videoRef.current || isYouTube) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const drift = Math.abs(video.currentTime - currentTime);
      if (drift > SYNC_THRESHOLD) {
        video.currentTime = currentTime;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isHost, currentTime, isYouTube]);

  const handleTimeUpdate = () => {
    setCurrentTime(videoRef.current?.currentTime ?? 0);
  };

  return (
    <div className="relative flex flex-col bg-black w-full h-full">
      {/* Video */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        {isYouTube ? (
          <iframe
            ref={iframeRef}
            src={embedUrl!}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            ref={videoRef}
            src={session.videoUrl}
            className="max-w-full max-h-full w-full h-full object-contain"
            onPlay={handlePlay}
            onPause={handlePause}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration)}
            onWaiting={() => setBuffering(true)}
            onCanPlay={() => setBuffering(false)}
            onClick={handleTogglePlay}
          />
        )}

        {buffering && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}

        {/* Timestamped comments overlay */}
        {showComments && videoComments
          .filter((c) => Math.abs(c.timestamp - currentTime) < 5)
          .map((c) => (
            <div key={c.id} className="absolute bottom-16 left-4 right-4 animate-slide-up">
              <div className="inline-flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm max-w-xs">
                {c.user.avatar && <img src={c.user.avatar} className="w-5 h-5 rounded-full" alt="" />}
                <span className="text-white/70 font-medium text-xs">{c.user.name}</span>
                <span className="text-white">{c.content}</span>
              </div>
            </div>
          ))}

        {!isHost && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full text-xs text-slate-400">
            👁 Synced
          </div>
        )}
        {isHost && (
          <div className="absolute top-3 right-3 bg-brand/80 backdrop-blur px-2.5 py-1 rounded-full text-xs text-white font-medium">
            🎬 You're the host
          </div>
        )}
      </div>

      {/* Controls */}
      {!isYouTube && (
        <VideoControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          isHost={isHost}
          showComments={showComments}
          onTogglePlay={handleTogglePlay}
          onSeek={handleSeek}
          onToggleComments={() => setShowComments((v) => !v)}
          session={session}
          roomId={roomId}
        />
      )}
    </div>
  );
}
