import { useEffect, useState } from 'react';
import { X, Check, Ban, Loader2, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { groupsApi } from '../../services/api';
import { GroupMember } from '../../types';
import toast from 'react-hot-toast';

interface Props {
  groupId: string;
  onClose: () => void;
}

export default function MemberApproval({ groupId, onClose }: Props) {
  const [pending, setPending] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    groupsApi.pending(groupId)
      .then((res) => setPending(res.data))
      .catch(() => toast.error('Failed to load requests'))
      .finally(() => setLoading(false));
  }, [groupId]);

  const handle = async (userId: string, action: 'approve' | 'ban') => {
    setProcessing(userId);
    try {
      await groupsApi.approveMember(groupId, userId, action);
      setPending((p) => p.filter((m) => m.userId !== userId));
      toast.success(action === 'approve' ? 'Member approved' : 'Member banned');
    } catch {
      toast.error('Action failed');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative card w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-white text-lg flex items-center gap-2">
            <UserCheck size={18} className="text-brand" />
            Join Requests
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 size={24} className="animate-spin text-brand" /></div>
        ) : pending.length === 0 ? (
          <p className="text-center text-slate-400 py-8">No pending requests</p>
        ) : (
          <div className="space-y-2">
            {pending.map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl">
                {member.user.avatar ? (
                  <img src={member.user.avatar} className="w-9 h-9 rounded-full object-cover" alt={member.user.name} />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-brand-dim flex items-center justify-center font-semibold text-brand">
                    {member.user.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{member.user.name}</p>
                  <p className="text-xs text-slate-400">{(member.user as any).email}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handle(member.userId, 'approve')}
                    disabled={processing === member.userId}
                    className="w-8 h-8 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 flex items-center justify-center transition-colors"
                  >
                    {processing === member.userId ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  </button>
                  <button
                    onClick={() => handle(member.userId, 'ban')}
                    disabled={processing === member.userId}
                    className="w-8 h-8 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 flex items-center justify-center transition-colors"
                  >
                    <Ban size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
