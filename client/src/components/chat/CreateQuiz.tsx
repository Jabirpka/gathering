import { useState } from 'react';
import { X, Plus, Send, Loader2, Trash2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { quizzesApi } from '../../services/api';

interface Props {
  groupId: string;
  onClose: () => void;
}

/** Full-screen "Create quiz" composer: mark the correct option and set points. */
export default function CreateQuiz({ groupId, onClose }: Props) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [points, setPoints] = useState(10);
  const [saving, setSaving] = useState(false);

  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, idx) => (idx === i ? v : x)));
  const addOpt = () => setOptions((o) => (o.length >= 8 ? o : [...o, '']));
  const removeOpt = (i: number) => {
    if (options.length <= 2) return;
    setOptions((o) => o.filter((_, idx) => idx !== i));
    setCorrectIndex((c) => (c === i ? 0 : c > i ? c - 1 : c));
  };

  const submit = async () => {
    const opts = options.map((o) => o.trim());
    if (!question.trim()) return toast.error('Add a question');
    if (opts.filter(Boolean).length < 2) return toast.error('Add at least two options');
    if (!opts[correctIndex]?.trim()) return toast.error('Mark which option is correct');
    setSaving(true);
    try {
      // Keep indexes aligned with the correct answer by only trimming, not filtering.
      await quizzesApi.create({ groupId, question: question.trim(), options: opts, correctIndex, points });
      toast.success('Quiz posted');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create quiz');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-surface flex flex-col">
      <div className="h-14 shrink-0 border-b border-white/10 glass-panel flex items-center px-3 gap-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top),0px)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        <h1 className="text-base font-bold text-white">Create quiz</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-lg w-full mx-auto pb-28">
        <div>
          <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Question</label>
          <input className="input" placeholder="Ask a question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} autoFocus />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Options — tap the circle to mark the correct answer</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <button onClick={() => setCorrectIndex(i)} title="Mark correct"
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    correctIndex === i ? 'bg-emerald-500 border-emerald-500' : 'border-white/30'
                  }`}>
                  {correctIndex === i && <Check size={13} className="text-white" />}
                </button>
                <input className="input flex-1" placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => setOpt(i, e.target.value)} maxLength={100} />
                {options.length > 2 && (
                  <button onClick={() => removeOpt(i)} className="btn-ghost p-2 text-slate-500 hover:text-red-400"><Trash2 size={15} /></button>
                )}
              </div>
            ))}
            {options.length < 8 && (
              <button onClick={addOpt} className="w-full input flex items-center gap-2 text-slate-400 hover:border-brand/50">
                <Plus size={15} /> Add
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Points for a correct answer</label>
          <input type="number" min={1} max={100} className="input w-28" value={points}
            onChange={(e) => setPoints(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
        </div>
      </div>

      <div className="absolute bottom-6 right-5">
        <button onClick={submit} disabled={saving}
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#e879f9,#a855f7)', boxShadow: '0 8px 24px rgba(232,121,249,0.5)' }}>
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>
    </motion.div>
  );
}
