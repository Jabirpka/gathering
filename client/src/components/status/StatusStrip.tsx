import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { statusApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { StatusGroup } from '../../types';
import AddStatusModal from './AddStatusModal';
import StatusViewer from './StatusViewer';

/**
 * Horizontal "stories" strip shown at the top of Home. Replaces the old
 * bottom-nav Status tab: stories live where people expect them. Tapping my
 * ring views or adds my update; tapping someone else's plays theirs and then
 * auto-advances through the rest (StatusViewer owns that).
 */
export default function StatusStrip() {
  const user = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<StatusGroup[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  const refresh = () => statusApi.list().then((res) => setGroups(res.data)).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const mine = groups.find((g) => g.user.id === user?.id);
  const others = groups.filter((g) => g.user.id !== user?.id);
  // Play order: my status first, then everyone else's.
  const ordered = [...(mine ? [mine] : []), ...others];

  const openViewer = (userId: string) => {
    const idx = ordered.findIndex((x) => x.user.id === userId);
    if (idx >= 0) setViewIndex(idx);
  };

  const Ring = ({ children, seen }: { children: React.ReactNode; seen?: boolean }) => (
    <div className={`w-[58px] h-[58px] rounded-2xl p-[2px] shrink-0 ${seen ? 'bg-line/15' : 'bg-gradient-to-br from-brand to-accent'}`}>
      <div className="w-full h-full rounded-[13px] overflow-hidden bg-surface">{children}</div>
    </div>
  );

  const Avatar = ({ avatar, label }: { avatar?: string | null; label: string }) =>
    avatar ? (
      <img src={avatar} className="w-full h-full object-cover" alt={label} />
    ) : (
      <div className="w-full h-full bg-brand-dim flex items-center justify-center text-lg font-bold text-brand">{label[0]?.toUpperCase()}</div>
    );

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 mb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* My status / add */}
        <button onClick={() => (mine ? openViewer(mine.user.id) : setShowAdd(true))}
          className="flex flex-col items-center gap-1 shrink-0 w-[62px]">
          <div className="relative">
            <Ring>
              <Avatar avatar={user?.avatar} label={user?.nickname || user?.name || '?'} />
            </Ring>
            {!mine && (
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-lg bg-brand text-white flex items-center justify-center border-2 border-[color:var(--bg)]">
                <Plus size={11} />
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted truncate max-w-[62px]">{mine ? 'Your story' : 'Add story'}</span>
        </button>

        {/* Everyone else */}
        {others.map((g) => (
          <button key={g.user.id} onClick={() => openViewer(g.user.id)}
            className="flex flex-col items-center gap-1 shrink-0 w-[62px]">
            <Ring>
              <Avatar avatar={g.user.avatar} label={g.user.nickname || g.user.name} />
            </Ring>
            <span className="text-[10px] text-ink-soft truncate max-w-[62px]">{(g.user.nickname || g.user.name).split(' ')[0]}</span>
          </button>
        ))}
      </div>

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
