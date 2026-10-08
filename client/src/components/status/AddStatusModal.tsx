import { useRef, useState } from 'react';
import { X, Loader2, Image as ImageIcon, Type, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { statusApi } from '../../services/api';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
}

// Rich gradient canvases (the viewer renders `background`, so gradients work).
const BACKGROUNDS = [
  'linear-gradient(135deg,#FF8A5B,#E0503F)', // coral
  'linear-gradient(135deg,#F2A93B,#E0503F)', // amber → coral
  'linear-gradient(135deg,#5EB79A,#2f6f5a)', // sage
  'linear-gradient(135deg,#6f91d6,#5a3fd6)', // indigo
  'linear-gradient(135deg,#f472b6,#a855f7)', // pink → violet
  'linear-gradient(160deg,#334155,#0f172a)', // graphite
];

export default function AddStatusModal({ open, onClose, onPosted }: Props) {
  const [mode, setMode] = useState<'TEXT' | 'IMAGE'>('TEXT');
  const [text, setText] = useState('');
  const [bg, setBg] = useState(BACKGROUNDS[0]);
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
    if (mode === 'TEXT' && !text.trim()) return;
    if (mode === 'IMAGE' && !image) return;
    setPosting(true);
    try {
      if (mode === 'IMAGE' && image) {
        await statusApi.create({ kind: 'IMAGE', content: image });
      } else {
        await statusApi.create({ kind: 'TEXT', content: text.trim(), bg });
      }
      toast.success('Status shared — visible for 24h');
      onPosted();
      onClose();
      setText(''); setImage(null); setMode('TEXT'); setBg(BACKGROUNDS[0]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to post status');
    } finally {
      setPosting(false);
    }
  };

  // Scale the preview text down as it gets longer, like a real story composer.
  const fontSize = text.length > 120 ? 18 : text.length > 60 ? 22 : 28;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative card w-full sm:max-w-sm shadow-2xl rounded-b-none sm:rounded-3xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div>
                <h2 className="font-bold text-ink text-lg leading-none">New status</h2>
                <p className="text-[11px] text-muted mt-1">Shared with your people · disappears in 24h</p>
              </div>
              <button onClick={onClose} className="btn-ghost p-1.5 -mr-1" aria-label="Close"><X size={16} /></button>
            </div>

            {/* Segmented mode control */}
            <div className="px-5">
              <div className="flex p-1 rounded-2xl bg-surface-2 gap-1">
                <button onClick={() => setMode('TEXT')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all ${mode === 'TEXT' ? 'bg-card text-ink shadow-sm' : 'text-muted'}`}>
                  <Type size={14} /> Text
                </button>
                <button onClick={() => (image ? setMode('IMAGE') : fileRef.current?.click())}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all ${mode === 'IMAGE' ? 'bg-card text-ink shadow-sm' : 'text-muted'}`}>
                  <ImageIcon size={14} /> Photo
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
              </div>
            </div>

            {/* Story-style preview */}
            <div className="px-5 pt-4">
              {mode === 'TEXT' ? (
                <div className="rounded-3xl overflow-hidden aspect-[4/5] flex items-center justify-center p-6 shadow-inner" style={{ background: bg }}>
                  <textarea
                    className="w-full bg-transparent text-white text-center font-bold placeholder-white/55 focus:outline-none resize-none leading-snug"
                    style={{ fontSize }}
                    aria-label="Status text" placeholder="Share what's happening…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={500}
                    rows={4}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="rounded-3xl overflow-hidden aspect-[4/5] bg-surface-2 flex items-center justify-center relative">
                  {image ? (
                    <>
                      <img src={image} className="w-full h-full object-cover" alt="Status" />
                      <button onClick={() => fileRef.current?.click()}
                        className="absolute bottom-3 right-3 text-xs font-semibold text-white bg-black/50 backdrop-blur px-3 py-1.5 rounded-full">
                        Change
                      </button>
                    </>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-2 text-muted">
                      <ImageIcon size={28} />
                      <span className="text-sm font-medium">Pick a photo</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Gradient palette (text mode) */}
            {mode === 'TEXT' && (
              <div className="px-5 pt-3">
                <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {BACKGROUNDS.map((g) => (
                    <button key={g} onClick={() => setBg(g)}
                      className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center transition-transform ${bg === g ? 'scale-110 ring-2 ring-offset-2 ring-offset-[color:var(--card)] ring-brand' : ''}`}
                      style={{ background: g }} aria-label="Background">
                      {bg === g && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Post */}
            <div className="p-5 pt-4">
              <button onClick={post} disabled={posting || (mode === 'TEXT' ? !text.trim() : !image)}
                className="btn-primary w-full justify-center py-3">
                {posting ? <Loader2 size={16} className="animate-spin" /> : 'Share status'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
