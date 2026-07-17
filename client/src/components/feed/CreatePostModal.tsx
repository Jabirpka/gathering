import { useRef, useState } from 'react';
import { X, Send, Loader2, ImagePlus, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { feedApi, mediaApi } from '../../services/api';
import { FeedPost } from '../../types';
import { FEED_CATEGORIES, FEED_KINDS, FeedKindDef } from '../../utils/feed';

/** Downscale a picked image (max 1280px wide) so posts stay light. */
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1280 / img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface Props {
  onClose: () => void;
  onPosted: (post: FeedPost) => void;
}

/** Two-step composer: pick a post type, then fill its fields + category. */
export default function CreatePostModal({ onClose, onPosted }: Props) {
  const [def, setDef] = useState<FeedKindDef | null>(null);
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>(['', '']);
  const [extraVals, setExtraVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Photo must be under 10MB'); return; }
    try {
      setImage(await downscale(file));
    } catch {
      toast.error('Could not read that image');
    }
  };

  const submit = async () => {
    if (!def || saving) return;
    if (!category) return toast.error('Pick a category');
    if (def.title?.required && !title.trim()) return toast.error(`Add a ${def.title.label.toLowerCase()}`);
    if (def.content.required && !content.trim()) return toast.error('Write something first');
    if (def.image === 'required' && !image) return toast.error('Add a photo');
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (def.poll && opts.length < 2) return toast.error('Add at least two options');

    setSaving(true);
    try {
      let imageOut = image;
      if (imageOut?.startsWith('data:')) {
        try { imageOut = await mediaApi.upload(imageOut); } catch { /* fall back to data URL */ }
      }
      const extra: Record<string, any> = {};
      (def.extraFields ?? []).forEach((f) => { if (extraVals[f.key]?.trim()) extra[f.key] = extraVals[f.key].trim(); });
      if (def.poll) extra.options = opts;

      const res = await feedApi.create({
        kind: def.kind,
        category,
        title: title.trim() || undefined,
        content: content.trim(),
        image: imageOut,
        extra: Object.keys(extra).length ? extra : undefined,
      });
      onPosted(res.data);
      toast.success('Posted!');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-surface flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-white/10 glass-panel flex items-center px-3 gap-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top),0px)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        <button onClick={() => (def ? setDef(null) : onClose())} className="btn-ghost p-1.5">
          {def ? <ArrowLeft size={18} /> : <X size={18} />}
        </button>
        <h1 className="text-base font-bold text-white">{def ? `${def.emoji} ${def.label}` : 'Create post'}</h1>
      </div>

      {!def ? (
        // Step 1 — what kind of post?
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-slate-400 mb-3">What do you want to share?</p>
          <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto">
            {FEED_KINDS.map((k) => (
              <button key={k.kind} onClick={() => setDef(k)}
                className="card p-3.5 flex flex-col items-center gap-1.5 hover:border-brand/40 transition-colors">
                <span className="text-2xl">{k.emoji}</span>
                <span className="text-xs font-semibold text-slate-200">{k.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        // Step 2 — the form for that kind
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg w-full mx-auto pb-28">
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {FEED_CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    category === c ? 'bg-gradient-to-br from-brand to-accent text-white' : 'bg-surface-2 border border-white/10 text-slate-400'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {def.title && (
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">{def.title.label}</label>
              <input className="input" placeholder={def.title.placeholder} value={title}
                onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">{def.content.label}</label>
            <textarea className="input resize-none" rows={def.content.rows ?? 2} maxLength={4000}
              placeholder={def.content.placeholder} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>

          {def.poll && (
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Options</label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className="input flex-1" placeholder={`Option ${i + 1}`} value={opt} maxLength={100}
                      onChange={(e) => setOptions((o) => o.map((x, idx) => (idx === i ? e.target.value : x)))} />
                    {options.length > 2 && (
                      <button onClick={() => setOptions((o) => o.filter((_, idx) => idx !== i))}
                        className="btn-ghost p-2 text-slate-500 hover:text-red-400"><Trash2 size={15} /></button>
                    )}
                  </div>
                ))}
                {options.length < 8 && (
                  <button onClick={() => setOptions((o) => [...o, ''])}
                    className="w-full input flex items-center gap-2 text-slate-400 hover:border-brand/50">
                    <Plus size={15} /> Add option
                  </button>
                )}
              </div>
            </div>
          )}

          {(def.extraFields ?? []).map((f) => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">{f.label}</label>
              <input type={f.type ?? 'text'} className="input" placeholder={f.placeholder}
                value={extraVals[f.key] ?? ''} maxLength={200}
                onChange={(e) => setExtraVals((v) => ({ ...v, [f.key]: e.target.value }))} />
            </div>
          ))}

          {def.image !== 'none' && (
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                Photo {def.image === 'optional' && <span className="text-slate-500">(optional)</span>}
              </label>
              {image ? (
                <div className="relative rounded-xl overflow-hidden border border-white/10">
                  <img src={image} className="w-full max-h-64 object-cover" alt="" />
                  <button onClick={() => setImage(null)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-red-500/80 flex items-center justify-center text-white">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-28 rounded-xl border-2 border-dashed border-white/15 hover:border-brand/50 flex flex-col items-center justify-center gap-1.5 text-slate-400 transition-colors">
                  <ImagePlus size={22} />
                  <span className="text-xs">Add a photo</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
            </div>
          )}
        </div>
      )}

      {def && (
        <div className="absolute bottom-6 right-5">
          <button onClick={submit} disabled={saving}
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#e879f9,#a855f7)', boxShadow: '0 8px 24px rgba(232,121,249,0.5)' }}>
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      )}
    </motion.div>
  );
}
