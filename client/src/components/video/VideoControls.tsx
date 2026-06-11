import { Play, Pause, MessageSquare, Volume2, VolumeX } from 'lucide-react';
import { useRef } from 'react';
import { VideoSession } from '../../types';

interface Props {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isHost: boolean;
  muted: boolean;
  showComments: boolean;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onToggleMute: () => void;
  onToggleComments: () => void;
  session: VideoSession;
  roomId: string;
}

function formatTime(s: number) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoControls({
  isPlaying, currentTime, duration, isHost, muted, showComments,
  onTogglePlay, onSeek, onToggleMute, onToggleComments,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isHost || !barRef.current || !duration) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct * duration);
  };

  const pct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-gradient-to-t from-black/90 to-transparent px-4 py-3 shrink-0">
      {/* Progress bar */}
      <div
        ref={barRef}
        onClick={handleBarClick}
        className={`w-full h-1.5 bg-white/20 rounded-full mb-3 relative ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
        {isHost && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md -ml-1.5 transition-all"
            style={{ left: `${pct}%` }}
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onTogglePlay}
          disabled={!isHost}
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 flex items-center justify-center transition-colors"
        >
          {isPlaying ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white fill-white" />}
        </button>

        <button
          onClick={onToggleMute}
          className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          {muted ? <VolumeX size={14} className="text-white" /> : <Volume2 size={14} className="text-white" />}
        </button>

        <span className="text-xs text-white/60 font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex-1" />

        <button
          onClick={onToggleComments}
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${showComments ? 'bg-brand/50 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
        >
          <MessageSquare size={14} />
        </button>
      </div>
    </div>
  );
}
