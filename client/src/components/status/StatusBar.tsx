import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { statusApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { StatusGroup } from '../../types';
import AddStatusModal from './AddStatusModal';
import StatusViewer from './StatusViewer';

/**
 * WhatsApp-style status strip: your own ring first (tap + to post), then a
 * ring per contact with an active 24h status. Tap a ring to view.
 */
export default function StatusBar() {
  const user = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<StatusGroup[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [viewing, setViewing] = useState<StatusGroup | null>(null);

  const refresh = () => statusApi.list().then((res) => setGroups(res.data)).catch(() => {});

  useEffect(() => { refresh(); }, []);

  const mine = groups.find((g) => g.user.id === user?.id);
  const others = groups.filter((g) => g.user.id !== user?.id);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
        {/* My status / add */}
        <button onClick={() => (mine ? setViewing(mine) : setShowAdd(true))} className="flex flex-col items-center gap-1 shrink-0 w-16">
          <div className={`relative w-14 h-14 rounded-full p-[2px] ${mine ? 'bg-gradient-to-tr from-brand to-accent' : 'bg-slate-300'}`}>
            <div className="w-full h-full rounded-full overflow-hidden border-2 border-white">
              {user?.avatar ? (
                <img src={user.avatar} className="w-full h-full object-cover" alt="Me" />
              ) : (
                <div className="w-full h-full bg-brand-dim flex items-center justify-center text-lg font-bold text-brand">
                  {(user?.nickname || user?.name || '?')[0]}
                </div>
              )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center border-2 border-white">
              <Plus size={11} />
            </span>
          </div>
          <span className="text-[11px] text-slate-600 truncate w-full text-center">My status</span>
        </button>

        {others.map((g) => (
          <button key={g.user.id} onClick={() => setViewing(g)} className="flex flex-col items-center gap-1 shrink-0 w-16">
            <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-brand to-accent">
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-white">
                {g.user.avatar ? (
                  <img src={g.user.avatar} className="w-full h-full object-cover" alt={g.user.name} />
                ) : (
                  <div className="w-full h-full bg-brand-dim flex items-center justify-center text-lg font-bold text-brand">
                    {(g.user.nickname || g.user.name)[0]}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[11px] text-slate-600 truncate w-full text-center">
              {(g.user.nickname || g.user.name).split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

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
