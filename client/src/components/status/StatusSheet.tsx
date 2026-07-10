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
 * 'open-status'). This sheet shows my status plus everyone else's updates.
 * Opening a status plays it, then auto-advances to the next person and closes
 * once everyone's updates have been seen (see StatusViewer).
 */
export default function StatusSheet() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<StatusGroup[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  const refresh = () => statusApi.list().then((res) => setGroups(res.data)).catch(() => {});

  useEffect(() => {
    const onOpen = () => { setOpen(true); refresh(); };
    window.addEventListener('open-status', onOpen);
    return () => window.removeEventListener('open-status', onOpen);
  }, []);

  const mine = groups.find((g) => g.user.id === user?.id);
  const others = groups.filter((g) => g.user.id !== user?.id);
  // Play order: my status first, then everyone else's.
  const ordered = [...(mine ? [mine] : []), ...others];
  const close = () => setOpen(false);

  const openViewer = (g: StatusGroup) => {
    const idx = ordered.findIndex((x) => x.user.id === g.user.id);
    if (idx >= 0) setViewIndex(idx);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
              className="relative w-full max-w-sm glass-panel border border-white/10 rounded-2xl p-5 shadow-2xl max-h-[80vh] overflow-y-auto">
              <h2 className="text-base font-bold text-white mb-4">Status</h2>

              {/* My status */}
              <button onClick={() => (mine ? openViewer(mine) : setShowAdd(true))}
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
                    <button key={g.user.id} onClick={() => openViewer(g)}
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
      {viewIndex !== null && ordered[viewIndex] && (
        <StatusViewer
          groups={ordered}
          startIndex={viewIndex}
          myId={user?.id}
          onClose={() => setViewIndex(null)}
          onAddMore={() => { setViewIndex(null); setShowAdd(true); }}
          onDeleted={() => { setViewIndex(null); refresh(); }}
        />
      )}
    </>
  );
}
