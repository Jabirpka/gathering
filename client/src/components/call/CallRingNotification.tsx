import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video, Headphones } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CallRing } from '../../types';

interface Props {
  ring: CallRing | null;
  onDismiss: () => void;
}

export default function CallRingNotification({ ring, onDismiss }: Props) {
  const navigate = useNavigate();
  const audioRef = useRef<AudioContext | null>(null);

  // Play ring tone
  useEffect(() => {
    if (!ring) return;
    try {
      const ctx = new AudioContext();
      audioRef.current = ctx;
      const playBeep = (time: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 480;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
        osc.start(time);
        osc.stop(time + 0.4);
      };
      for (let i = 0; i < 4; i++) playBeep(ctx.currentTime + i * 0.8);
    } catch {}

    // Auto-dismiss after 20 seconds
    const t = setTimeout(onDismiss, 20000);
    return () => {
      clearTimeout(t);
      audioRef.current?.close();
    };
  }, [ring]);

  const handleAccept = () => {
    if (ring!.threadId) {
      navigate(`/dm/${ring!.threadId}/call?type=${ring!.type === 'AUDIO_CALL' ? 'audio' : 'video'}`);
    } else {
      navigate(`/groups/${ring!.groupId}/rooms/${ring!.roomId}`);
    }
    onDismiss();
  };

  const isVideo = ring?.type === 'VIDEO_CALL';

  return (
    <AnimatePresence>
      {ring && (
        <motion.div
          initial={{ opacity: 0, y: -80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -80 }}
          className="fixed inset-x-0 mx-auto z-[100] w-[92vw] max-w-sm"
          style={{ top: '4rem' }}
        >
          <div className="card p-4 border border-brand/30 shadow-2xl bg-surface-1/95 backdrop-blur-md">
            <div className="flex items-center gap-3">
              {/* Animated ring icon */}
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-brand-dim flex items-center justify-center animate-pulse">
                  {isVideo ? <Video size={20} className="text-brand" /> : <Headphones size={20} className="text-brand" />}
                </div>
                <span className="absolute inset-0 rounded-full border-2 border-brand/40 animate-ping" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">Incoming {isVideo ? 'video' : 'audio'} call</p>
                <p className="text-sm font-semibold text-white truncate">{ring.caller.name}</p>
                {!ring.threadId && <p className="text-xs text-slate-400 truncate">{ring.groupName}</p>}
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={onDismiss}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 transition-colors text-sm font-medium"
              >
                <PhoneOff size={15} />
                Decline
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 transition-colors text-sm font-medium"
              >
                <Phone size={15} />
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
