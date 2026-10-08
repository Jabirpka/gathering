import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '../services/api';
import { usePresenceStore } from '../store/presenceStore';
import { Loader2, UserPlus, Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface Person {
  id: string;
  name: string;
  nickname?: string | null;
  avatar?: string | null;
  threadId: string;
  matchPercent?: number;
  reason?: string;
  online: boolean;
}

/** Avatar with an optional "available now" sage dot. */
function Avatar({ person, size = 48, online }: { person: Person; size?: number; online: boolean }) {
  const name = person.nickname || person.name;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-2xl overflow-hidden bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white font-bold"
        style={{ fontSize: size * 0.4 }}>
        {person.avatar ? <img src={person.avatar} className="w-full h-full object-cover" alt={name} /> : name[0]?.toUpperCase()}
      </div>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-sage border-2 border-[color:var(--bg)]"
          style={{ width: size * 0.28, height: size * 0.28 }} aria-label="Available now" />
      )}
    </div>
  );
}

/**
 * "People" — everyone you're connected with, available-first then by how well
 * you match. The Match is the spine of Gathering, so it rides on every row.
 */
export default function PeoplePage() {
  const navigate = useNavigate();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const onlineSet = usePresenceStore((s) => s.online);

  useEffect(() => {
    usersApi.people()
      .then((res) => setPeople(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Merge live presence over the fetched snapshot.
  const withLive = people.map((p) => ({ ...p, online: onlineSet.has(p.id) || p.online }));
  const available = withLive.filter((p) => p.online);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="h-14 shrink-0 border-b border-line/10 glass-panel flex items-center px-4 gap-2">
        <Users size={18} className="text-brand" />
        <h1 className="text-base font-bold text-ink flex-1">People</h1>
        <button onClick={() => window.dispatchEvent(new CustomEvent('open-contacts'))}
          className="btn-ghost p-2" aria-label="Find people">
          <UserPlus size={18} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 size={22} className="animate-spin text-brand" /></div>
      ) : withLive.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-surface-2 flex items-center justify-center text-3xl">👋</div>
          <p className="text-ink font-semibold">No people yet</p>
          <p className="text-muted text-sm">Find your people and start a conversation.</p>
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-contacts'))}
            className="btn-primary mt-1"><UserPlus size={16} /> Find people</button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 pb-28 max-w-2xl mx-auto w-full">
          {/* Available now */}
          {available.length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] font-bold tracking-[0.18em] text-muted mb-2.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sage" /> AVAILABLE NOW
              </p>
              <div className="flex gap-3.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {available.map((p) => (
                  <button key={p.id} onClick={() => navigate(`/dm/${p.threadId}`)} className="flex flex-col items-center gap-1 shrink-0 w-[64px]">
                    <Avatar person={p} size={56} online />
                    <span className="text-[11px] text-ink-soft truncate max-w-[64px]">{(p.nickname || p.name).split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] font-bold tracking-[0.18em] text-muted mb-2.5">YOUR PEOPLE</p>
          <div className="flex flex-col gap-2.5">
            {withLive.map((p) => (
              <motion.div key={p.id} whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/dm/${p.threadId}`)}
                className="card p-3 flex items-center gap-3 cursor-pointer">
                <div onClick={(e) => { e.stopPropagation(); navigate(`/u/${p.id}`); }}>
                  <Avatar person={p} size={50} online={p.online} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink text-sm truncate">{p.nickname || p.name}</span>
                    {p.online && <span className="text-[10px] font-semibold text-sage">· now</span>}
                  </div>
                  {p.reason && <p className="text-xs text-muted truncate mt-0.5">{p.reason}</p>}
                </div>
                {typeof p.matchPercent === 'number' && (
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-extrabold text-brand tabular-nums leading-none">{p.matchPercent}%</div>
                    <div className="text-[9px] font-semibold tracking-wide text-muted mt-0.5">MATCH</div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
