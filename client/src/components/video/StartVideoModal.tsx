import { useState } from 'react';
import { X, Loader2, Link, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '../../hooks/useSocket';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  groupId: string;
  roomId: string;
  onClose: () => void;
}

export default function StartVideoModal({ open, groupId, roomId, onClose }: Props) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const socket = getSocket();
    if (!socket) return toast.error('Not connected');
    setLoading(true);
    socket.emit('video:start', {
      groupId,
      roomId,
      videoUrl: url.trim(),
      title: title.trim() || 'Watch Party',
    });
    setTimeout(() => {
      setLoading(false);
      onClose();
      setUrl(''); setTitle('');
    }, 500);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }} className="relative card w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white text-lg flex items-center gap-2">
                <Film size={18} className="text-brand-light" />
                Start Watch Party
              </h2>
              <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Video URL *</label>
                <div className="relative">
                  <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input className="input pl-8" placeholder="https://youtube.com/watch?v=... or .mp4 URL"
                    value={url} onChange={(e) => setUrl(e.target.value)} required autoFocus />
                </div>
                <p className="text-xs text-slate-600 mt-1">YouTube videos or direct video URLs</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Title</label>
                <input className="input" placeholder="Movie Night 🎬" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading || !url.trim()} className="btn-primary flex-1 justify-center">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : 'Start'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
