import { useState } from 'react';
import { X, Loader2, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { groupsApi } from '../../services/api';
import { useGroupStore } from '../../store/groupStore';
import { GroupMember } from '../../types';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: string;
  members: GroupMember[];
}

export default function TransferOwnershipModal({ open, onClose, groupId, members }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { updateGroup } = useGroupStore();

  const handleTransfer = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await groupsApi.transferOwnership(groupId, selected);
      updateGroup(res.data);
      toast.success('Ownership transferred');
      onClose();
      setSelected(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to transfer ownership');
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
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
            className="relative card w-full sm:max-w-md p-5 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2">
                <Crown size={18} className="text-brand" />
                Transfer ownership
              </h2>
              <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              The new owner gets full control. You'll be demoted to admin.
            </p>

            {members.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No other members to transfer to yet.
              </p>
            ) : (
              <div className="space-y-1.5 mb-5">
                {members.map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => setSelected(m.userId)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                      selected === m.userId ? 'border-brand/60 bg-brand-dim' : 'border-black/10 bg-surface-2 hover:border-black/20'
                    }`}
                  >
                    {m.user.avatar ? (
                      <img src={m.user.avatar} className="w-9 h-9 rounded-full object-cover" alt={m.user.name} />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-brand-dim flex items-center justify-center text-sm font-semibold text-brand">
                        {m.user.name[0]}
                      </div>
                    )}
                    <span className="flex-1 text-sm font-medium text-slate-900 truncate">{m.user.name}</span>
                    {selected === m.userId && <Crown size={15} className="text-brand shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={loading || !selected}
                className="btn-primary flex-1 justify-center"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : 'Transfer'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
