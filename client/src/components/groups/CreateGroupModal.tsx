import { useState } from 'react';
import { X, Loader2, Lock, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { groupsApi } from '../../services/api';
import { useGroupStore } from '../../store/groupStore';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateGroupModal({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);
  const [loading, setLoading] = useState(false);
  const { addGroup } = useGroupStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await groupsApi.create({ name: name.trim(), description: description.trim() || undefined, isPublic, requireApproval });
      addGroup(res.data);
      toast.success('Group created!');
      onClose();
      navigate(`/groups/${res.data.id}`);
      setName(''); setDescription('');
    } catch {
      toast.error('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }} className="relative card w-full sm:max-w-md p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white text-lg">Create a group</h2>
              <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Group name *</label>
                <input className="input" placeholder="My Watch Party" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Description</label>
                <textarea className="input resize-none" placeholder="What's this group for?" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 block">Access</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: false, icon: Lock, label: 'Private', desc: 'Invite only' },
                    { val: true, icon: Globe, label: 'Public', desc: 'Anyone with code' },
                  ].map(({ val, icon: Icon, label, desc }) => (
                    <button key={label} type="button" onClick={() => setIsPublic(val)}
                      className={`p-3 rounded-xl border text-left transition-all ${isPublic === val ? 'border-brand/60 bg-brand/10' : 'border-white/10 bg-surface-2 hover:border-white/20'}`}>
                      <Icon size={14} className={isPublic === val ? 'text-brand-light mb-1' : 'text-slate-500 mb-1'} />
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />
                  <div className={`w-9 h-5 rounded-full transition-colors ${requireApproval ? 'bg-brand' : 'bg-surface-3'}`} />
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${requireApproval ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm text-slate-300">Require approval to join</span>
              </label>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading || !name.trim()} className="btn-primary flex-1 justify-center">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : 'Create group'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
