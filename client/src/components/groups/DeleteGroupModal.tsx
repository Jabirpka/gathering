import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { groupsApi } from '../../services/api';
import { useGroupStore } from '../../store/groupStore';
import { Group } from '../../types';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  group: Group;
}

export default function DeleteGroupModal({ open, onClose, group }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const { removeGroup } = useGroupStore();
  const navigate = useNavigate();

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    try {
      await groupsApi.remove(group.id);
      removeGroup(group.id);
      toast.success('Group deleted');
      onClose();
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete group');
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
            className="relative card w-full sm:max-w-md p-5 sm:p-6 shadow-2xl rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                Delete group
              </h2>
              <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              This permanently deletes <span className="font-semibold text-slate-900">{group.name}</span> and all its
              chats, calls, and messages. This can't be undone.
            </p>

            <label className="text-xs font-medium text-slate-500 mb-1.5 block">
              Type <span className="font-semibold text-slate-700">DELETE</span> to confirm
            </label>
            <input
              className="input mb-5"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoCapitalize="characters"
              autoFocus
            />

            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading || !canDelete}
                className="flex-1 justify-center flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : 'Delete forever'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
