import { useEffect, useState } from 'react';
import { Loader2, Hash, Lock, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { groupsApi } from '../../services/api';
import { useGroupStore } from '../../store/groupStore';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

interface Props {
  open: boolean;
  /** Which tab to open on. */
  initialTab?: 'join' | 'create';
  onClose: () => void;
}

/**
 * v2 bottom sheet that unifies joining and creating a group behind a single
 * toggle — reuses the same group API as the standalone modals it replaces.
 */
export default function GroupSheet({ open, initialTab = 'join', onClose }: Props) {
  const [tab, setTab] = useState<'join' | 'create'>(initialTab);
  const [loading, setLoading] = useState(false);
  // join
  const [code, setCode] = useState('');
  // create
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const { addGroup, fetchGroups } = useGroupStore();
  const navigate = useNavigate();

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  const join = async (e: React.FormEvent) => {
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

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await groupsApi.create({ name: name.trim(), description: description.trim() || undefined, isPublic, requireApproval: true });
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative w-full sm:max-w-md glass-panel border-t border-white/10 sm:border sm:rounded-2xl rounded-t-[28px] p-5 pb-9 sm:pb-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Drag handle */}
            <div className="w-9 h-1 rounded-full bg-white/20 mx-auto mb-4 sm:hidden" />

            {/* Toggle */}
            <div className="flex gap-1 p-1 rounded-2xl bg-surface-2 border border-white/10 mb-5">
              {(['join', 'create'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={clsx('flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-all',
                    tab === t ? 'bg-gradient-to-br from-brand to-accent text-white shadow-lg shadow-brand/30' : 'text-slate-400')}>
                  {t} group
                </button>
              ))}
            </div>

            {tab === 'join' ? (
              <form onSubmit={join} className="space-y-3">
                <p className="text-sm text-slate-400">Enter an invite code to join a group.</p>
                <div className="relative">
                  <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input pl-8 font-mono uppercase tracking-widest"
                    placeholder="XXXXXXXX"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                    maxLength={8}
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={loading || code.length !== 8} className="btn-primary w-full justify-center py-3">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : 'Join →'}
                </button>
              </form>
            ) : (
              <form onSubmit={create} className="space-y-3">
                <p className="text-sm text-slate-400">Start a new gathering for your people.</p>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Group name</label>
                  <input className="input" placeholder="Family, Work Squad…" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Description <span className="text-slate-500">(optional)</span></label>
                  <input className="input" placeholder="What's this group about?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: false, icon: Lock, label: 'Private' },
                      { val: true, icon: Globe, label: 'Public' },
                    ].map(({ val, icon: Icon, label }) => (
                      <button key={label} type="button" onClick={() => setIsPublic(val)}
                        className={clsx('p-2.5 rounded-xl border text-center text-sm font-semibold flex items-center justify-center gap-1.5 transition-all',
                          isPublic === val ? 'border-brand/60 bg-brand/10 text-brand' : 'border-white/10 bg-surface-2 text-slate-400')}>
                        <Icon size={14} /> {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading || !name.trim()} className="btn-primary w-full justify-center py-3">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : 'Create group 🚀'}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
