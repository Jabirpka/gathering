import { useRef, useState } from 'react';
import { Mic, Square, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  onSend: (dataUrl: string, seconds: number) => void;
}

const MAX_SECONDS = 120;

/**
 * WhatsApp-style voice note recorder: tap the mic to start, tap the square to
 * send (or ✕ to discard). Records opus/webm via MediaRecorder and hands back
 * a data URL the caller sends over the chat socket.
 */
export default function VoiceRecorderButton({ onSend }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    setSeconds(0);
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const elapsed = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        cleanup();
        if (cancelledRef.current || blob.size === 0) return;
        if (blob.size > 1_000_000) {
          toast.error('Voice message too long');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => onSend(reader.result as string, elapsed);
        reader.readAsDataURL(blob);
      };

      startedAtRef.current = Date.now();
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error('Microphone unavailable — check app permissions');
    }
  };

  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const cancel = () => {
    cancelledRef.current = true;
    stop();
  };

  if (recording) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
        </span>
        <button onClick={cancel} title="Discard"
          className="w-10 h-10 rounded-xl bg-surface-3 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors">
          <X size={16} />
        </button>
        <button onClick={stop} title="Send voice message"
          className="w-10 h-10 rounded-xl bg-brand hover:bg-brand-light flex items-center justify-center transition-colors">
          <Square size={14} className="text-white fill-white" />
        </button>
      </div>
    );
  }

  return (
    <button onClick={start} title="Record voice message"
      className="w-10 h-10 rounded-xl bg-surface-3 text-slate-400 hover:text-brand flex items-center justify-center transition-colors shrink-0">
      <Mic size={17} />
    </button>
  );
}
