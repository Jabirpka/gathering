import { useState } from 'react';
import { X, Loader2, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { groupsApi } from '../../services/api';
import { useGroupStore } from '../../store/groupStore';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function JoinGroupModal({ open, onClose }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { addGroup, fetchGroups } = useGroupStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await groupsApi.join(code.trim().toUpperCase());
      if (res.data.status === 'APPROVED') {
        await fetchGroups();
        toast.success('Joined group!');
        onClose();
        navigate(`/groups/${res.data.group.id}`);
      } else {
        toast.success('Join request sent! Awaiting approval.');
        onClose();
      }
      setCode('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to join group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }} className="relative card w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white text-lg">Join a group</h2>
              <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Group code</label>
                <div className="relative">
                  <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-8 font-mono uppercase tracking-widest"
                    placeholder="XXXXXXXX"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                    maxLength={8}
                    required
                    autoFocus
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">Ask the group owner for their 8-character code.</p>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading || code.length !== 8} className="btn-primary flex-1 justify-center">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : 'Join'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
