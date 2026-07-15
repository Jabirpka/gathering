import { useState } from 'react';
import { X, Plus, Send, Loader2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { pollsApi } from '../../services/api';

interface Props {
  groupId: string;
  onClose: () => void;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={clsx('w-11 h-6 rounded-full relative transition-colors shrink-0', on ? 'bg-brand' : 'bg-white/15')}>
      <span className={clsx('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

/** Full-screen "Create poll" composer (matches the reference screen). */
export default function CreatePoll({ groupId, onClose }: Props) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [hideVoters, setHideVoters] = useState(false);
  const [useEnd, setUseEnd] = useState(false);
  const [endsAt, setEndsAt] = useState('');
  const [saving, setSaving] = useState(false);

  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, idx) => (idx === i ? v : x)));
  const addOpt = () => setOptions((o) => (o.length >= 12 ? o : [...o, '']));
  const removeOpt = (i: number) => setOptions((o) => (o.length <= 2 ? o : o.filter((_, idx) => idx !== i)));

  const submit = async () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) return toast.error('Add a question');
    if (opts.length < 2) return toast.error('Add at least two options');
    setSaving(true);
    try {
      await pollsApi.create({
        groupId,
        question: question.trim(),
        options: opts,
        multiple,
        hideVoters,
        endsAt: useEnd && endsAt ? new Date(endsAt).toISOString() : null,
      });
      toast.success('Poll posted');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create poll');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-surface flex flex-col">
      {/* Header */}
      <div className="h-14 shrink-0 border-b border-white/10 glass-panel flex items-center px-3 gap-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top),0px)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        <h1 className="text-base font-bold text-white">Create poll</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-lg w-full mx-auto pb-28">
        <div>
          <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Question</label>
          <input className="input" placeholder="Ask question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} autoFocus />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Options</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input flex-1" placeholder={`Option ${i + 1}`} value={opt}
                  onChange={(e) => setOpt(i, e.target.value)} maxLength={100} />
                {options.length > 2 && (
                  <button onClick={() => removeOpt(i)} className="btn-ghost p-2 text-slate-500 hover:text-red-400"><Trash2 size={15} /></button>
                )}
              </div>
            ))}
            {options.length < 12 && (
              <button onClick={addOpt} className="w-full input flex items-center gap-2 text-slate-400 hover:border-brand/50">
                <Plus size={15} /> Add
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">Poll settings</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-white">Allow multiple answers</span>
              <Toggle on={multiple} onChange={setMultiple} />
            </div>
            <div className="flex items-center justify-between py-2.5 border-t border-white/10">
              <span className="text-sm text-white">Hide voter names</span>
              <Toggle on={hideVoters} onChange={setHideVoters} />
            </div>
            <div className="flex items-center justify-between py-2.5 border-t border-white/10">
              <span className="text-sm text-white">Set end time</span>
              <Toggle on={useEnd} onChange={setUseEnd} />
            </div>
            {useEnd && (
              <input type="datetime-local" className="input mt-1" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            )}
          </div>
        </div>
      </div>

      {/* Send */}
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
