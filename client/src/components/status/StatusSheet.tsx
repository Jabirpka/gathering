import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { statusApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { StatusGroup } from '../../types';
import AddStatusModal from './AddStatusModal';
import StatusViewer from './StatusViewer';

/**
 * Status is reached from the bottom-nav Status button (which dispatches
 * 'open-status'). This sheet shows my status plus everyone else's updates, so
 * the old Home stories strip can be removed without losing status viewing.
 */
export default function StatusSheet() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<StatusGroup[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [viewing, setViewing] = useState<StatusGroup | null>(null);

  const refresh = () => statusApi.list().then((res) => setGroups(res.data)).catch(() => {});

  useEffect(() => {
    const onOpen = () => { setOpen(true); refresh(); };
    window.addEventListener('open-status', onOpen);
    return () => window.removeEventListener('open-status', onOpen);
  }, []);

  const mine = groups.find((g) => g.user.id === user?.id);
  const others = groups.filter((g) => g.user.id !== user?.id);
  const close = () => setOpen(false);

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
            <motion.div initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="relative w-full sm:max-w-md glass-panel border-t border-white/10 sm:border sm:rounded-2xl rounded-t-[28px] p-5 pb-9 sm:pb-5 shadow-2xl max-h-[80vh] overflow-y-auto">
              <div className="w-9 h-1 rounded-full bg-white/20 mx-auto mb-4 sm:hidden" />
              <h2 className="text-base font-bold text-white mb-4">Status</h2>

              {/* My status */}
              <button onClick={() => (mine ? setViewing(mine) : setShowAdd(true))}
                className="w-full flex items-center gap-3 mb-2 hover:bg-white/5 rounded-xl p-1.5 -m-1.5 transition-colors text-left">
                <div className={`relative w-14 h-14 rounded-2xl p-[2px] shrink-0 ${mine ? 'bg-gradient-to-br from-brand to-accent' : 'border-2 border-dashed border-brand/50'}`}>
                  <div className="w-full h-full rounded-[13px] overflow-hidden">
                    {user?.avatar ? (
                      <img src={user.avatar} className="w-full h-full object-cover" alt="Me" />
                    ) : (
                      <div className="w-full h-full bg-brand-dim flex items-center justify-center text-lg font-bold text-brand">
                        {(user?.nickname || user?.name || '?')[0]}
                      </div>
                    )}
                  </div>
                  {!mine && (
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-brand text-white flex items-center justify-center border-2 border-surface">
                      <Plus size={11} />
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">My status</p>
                  <p className="text-xs text-slate-400">{mine ? 'Tap to view your update' : 'Tap to add an update'}</p>
                </div>
              </button>

              {/* Recent updates */}
              <div className="border-t border-white/10 my-3" />
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-2">RECENT UPDATES</p>
              {others.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No updates from your people yet.</p>
              ) : (
                <div className="space-y-1">
                  {others.map((g) => (
                    <button key={g.user.id} onClick={() => setViewing(g)}
                      className="w-full flex items-center gap-3 p-1.5 rounded-xl hover:bg-white/5 transition-colors text-left">
                      <div className="w-12 h-12 rounded-2xl p-[2px] bg-gradient-to-br from-brand to-accent shrink-0">
                        <div className="w-full h-full rounded-[11px] overflow-hidden">
                          {g.user.avatar ? (
                            <img src={g.user.avatar} className="w-full h-full object-cover" alt={g.user.name} />
                          ) : (
                            <div className="w-full h-full bg-brand-dim flex items-center justify-center text-base font-bold text-brand">
                              {(g.user.nickname || g.user.name)[0]}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-white truncate">{g.user.nickname || g.user.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AddStatusModal open={showAdd} onClose={() => setShowAdd(false)} onPosted={refresh} />
      {viewing && (
        <StatusViewer
          group={viewing}
          isMine={viewing.user.id === user?.id}
          onClose={() => setViewing(null)}
          onAddMore={() => { setViewing(null); setShowAdd(true); }}
          onDeleted={() => { setViewing(null); refresh(); }}
        />
      )}
    </>
  );
}
