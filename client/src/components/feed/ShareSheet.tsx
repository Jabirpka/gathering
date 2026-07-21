import { useEffect, useMemo, useState } from 'react';
import { X, Search, Loader2, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { feedApi } from '../../services/api';
import { useGroupStore } from '../../store/groupStore';
import { useDmStore } from '../../store/dmStore';

/** Pick a group or a person (existing DM) to share a feed post into. */
export default function ShareSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const groups = useGroupStore((s) => s.groups);
  const fetchGroups = useGroupStore((s) => s.fetchGroups);
  const threads = useDmStore((s) => s.threads);
  const fetchThreads = useDmStore((s) => s.fetchThreads);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => { fetchGroups(); fetchThreads(); }, []);

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    const gs = groups.map((g) => ({ key: `g-${g.id}`, name: g.name, avatar: g.avatar, sub: 'Group', target: { groupId: g.id }, isGroup: true }));
    const ts = threads.map((t) => ({ key: `t-${t.id}`, name: t.partner.nickname || t.partner.name, avatar: t.partner.avatar, sub: 'Direct message', target: { threadId: t.id }, isGroup: false }));
    return [...gs, ...ts].filter((i) => !query || i.name.toLowerCase().includes(query));
  }, [groups, threads, q]);

  const share = async (item: (typeof items)[number]) => {
    if (busy || done.has(item.key)) return;
    setBusy(item.key);
    try {
      await feedApi.share(postId, item.target);
      setDone((d) => new Set(d).add(item.key));
      toast.success(`Shared to ${item.name}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not share');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        className="relative w-full sm:max-w-md glass-panel border-t sm:border border-white/10 rounded-t-[24px] sm:rounded-2xl max-h-[75vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <span className="text-sm font-semibold text-white">Share to…</span>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={15} /></button>
        </div>
        <div className="p-3 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-8 text-sm" placeholder="Search groups & people…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          {items.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">No groups or chats yet.</p>
          ) : (
            items.map((i) => (
              <button key={i.key} onClick={() => share(i)} disabled={done.has(i.key)}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white/5 transition-colors text-left disabled:opacity-60">
                <div className={`w-10 h-10 rounded-xl overflow-hidden shrink-0 ${i.isGroup ? 'rounded-xl' : ''}`}>
                  {i.avatar ? (
                    <img src={i.avatar} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-sm font-bold text-white ${i.isGroup ? 'bg-gradient-to-br from-brand to-accent' : 'bg-brand-dim !text-brand'}`}>
                      {i.isGroup ? <Users size={16} /> : i.name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{i.name}</p>
                  <p className="text-[11px] text-slate-500">{i.sub}</p>
                </div>
                {busy === i.key ? <Loader2 size={15} className="animate-spin text-brand" />
                  : done.has(i.key) ? <span className="text-xs text-emerald-400 font-semibold">Sent</span>
                    : <span className="text-xs font-semibold text-brand">Send</span>}
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
