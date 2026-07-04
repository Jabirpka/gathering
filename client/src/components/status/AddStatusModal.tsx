import { useRef, useState } from 'react';
import { X, Loader2, Image as ImageIcon, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { statusApi } from '../../services/api';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
}

const BG_COLORS = ['#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706', '#0f172a'];

export default function AddStatusModal({ open, onClose, onPosted }: Props) {
  const [mode, setMode] = useState<'TEXT' | 'IMAGE'>('TEXT');
  const [text, setText] = useState('');
  const [bg, setBg] = useState(BG_COLORS[0]);
  const [image, setImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.8 * 1024 * 1024) { toast.error('Image must be under 1.8MB'); return; }
    const reader = new FileReader();
    reader.onload = () => { setImage(reader.result as string); setMode('IMAGE'); };
    reader.readAsDataURL(file);
  };

  const post = async () => {
    setPosting(true);
    try {
      if (mode === 'IMAGE' && image) {
        await statusApi.create({ kind: 'IMAGE', content: image });
      } else {
        if (!text.trim()) return;
        await statusApi.create({ kind: 'TEXT', content: text.trim(), bg });
      }
      toast.success('Status posted — visible for 24h');
      onPosted();
      onClose();
      setText(''); setImage(null); setMode('TEXT');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to post status');
    } finally {
      setPosting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
            className="relative card w-full sm:max-w-md p-5 sm:p-6 shadow-2xl rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-lg">Add status</h2>
              <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setMode('TEXT')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'TEXT' ? 'bg-brand text-white' : 'bg-surface-2 text-slate-300'}`}>
                <Type size={14} /> Text
              </button>
              <button onClick={() => fileRef.current?.click()}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'IMAGE' ? 'bg-brand text-white' : 'bg-surface-2 text-slate-300'}`}>
                <ImageIcon size={14} /> Photo
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
            </div>

            {mode === 'TEXT' ? (
              <>
                <div className="rounded-2xl p-6 mb-3 min-h-[140px] flex items-center justify-center" style={{ background: bg }}>
                  <textarea
                    className="w-full bg-transparent text-white text-center text-lg font-semibold placeholder-white/60 focus:outline-none resize-none"
                    placeholder="Type a status…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={500}
                    rows={3}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 mb-4 justify-center">
                  {BG_COLORS.map((c) => (
                    <button key={c} onClick={() => setBg(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${bg === c ? 'scale-110 ring-2 ring-offset-2 ring-brand' : ''}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl overflow-hidden mb-4 bg-white/[0.06] min-h-[140px] flex items-center justify-center">
                {image ? (
                  <img src={image} className="max-h-72 w-full object-contain" alt="Status" />
                ) : (
                  <p className="text-sm text-slate-500 py-10">Pick a photo above</p>
                )}
              </div>
            )}

            <button
              onClick={post}
              disabled={posting || (mode === 'TEXT' ? !text.trim() : !image)}
              className="btn-primary w-full justify-center"
            >
              {posting ? <Loader2 size={15} className="animate-spin" /> : 'Post status'}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
