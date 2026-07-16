import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupsApi, usersApi } from '../services/api';
import { useGroupStore } from '../store/groupStore';
import { DiscoverGroup, PersonCard } from '../types';
import { GROUP_CATEGORIES } from '../utils/groups';
import { ArrowLeft, Search, Loader2, Users, Compass, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { motion } from 'framer-motion';

const CATS = ['All', ...GROUP_CATEGORIES];

/** One person row in search results / the hire directory. */
function PersonRow({ p, onOpen }: { p: PersonCard; onOpen: () => void }) {
  const label = p.nickname || p.name;
  return (
    <motion.button whileTap={{ scale: 0.99 }} onClick={onOpen} className="card p-3 flex items-center gap-3 w-full text-left">
      <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0">
        {p.avatar ? (
          <img src={p.avatar} className="w-full h-full object-cover" alt={label} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent to-brand flex items-center justify-center text-lg font-bold text-white">
            {label[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate">{label}</p>
          {p.availableForHire && (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-400/30 px-1.5 py-0.5 rounded-md shrink-0">Hire</span>
          )}
        </div>
        {p.username && <p className="text-xs text-slate-400 truncate">@{p.username}</p>}
        <p className="text-[11px] text-slate-500 truncate">
          {[p.currentJob, p.city].filter(Boolean).join(' · ') || 'Tap to view profile'}
        </p>
      </div>
    </motion.button>
  );
}

/** People half of Discover: search by name/skill/interest, or browse who's
 *  available for hire when the search box is empty. */
function PeopleTab() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PersonCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const req = q.trim().length >= 2 ? usersApi.searchPeople(q.trim()) : usersApi.hireDirectory();
      req.then((res) => setItems(res.data)).catch(() => setItems([])).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const browsing = q.trim().length < 2;

  return (
    <>
      <div className="shrink-0 p-3 border-b border-white/10">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8" placeholder="Search people by name, skill, interest…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 pb-28">
        {browsing && (
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.15em] text-slate-500 uppercase mb-2 max-w-lg mx-auto">
            <Briefcase size={12} /> Available for hire
          </p>
        )}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-brand" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-14">
            <Users size={34} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">{browsing ? 'Nobody is open to work yet' : 'No people found'}</p>
            <p className="text-slate-500 text-sm">{browsing ? 'Search people by name, skill or interest.' : 'Try a different name, skill or interest.'}</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-lg mx-auto">
            {items.map((p) => <PersonRow key={p.id} p={p} onOpen={() => navigate(`/u/${p.id}`)} />)}
          </div>
        )}
      </div>
    </>
  );
}

/** Browse & join public groups, and find people by skill/interest. */
export default function DiscoverPage() {
  const navigate = useNavigate();
  const fetchGroups = useGroupStore((s) => s.fetchGroups);
  const [tab, setTab] = useState<'groups' | 'people'>('groups');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [items, setItems] = useState<DiscoverGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  // Debounced fetch whenever the search text or category changes.
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      groupsApi.discover(q.trim(), cat)
        .then((res) => setItems(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, cat]);

  const join = async (g: DiscoverGroup) => {
    if (g.myStatus === 'APPROVED') { navigate(`/groups/${g.id}`); return; }
    if (joining) return;
    setJoining(g.id);
    try {
      const res = await groupsApi.joinById(g.id);
      if (res.data.status === 'APPROVED') {
        await fetchGroups();
        toast.success('Joined!');
        navigate(`/groups/${g.id}`);
      } else {
        toast.success('Request sent — awaiting approval.');
        setItems((cur) => cur.map((x) => (x.id === g.id ? { ...x, myStatus: 'PENDING' } : x)));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not join');
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 shrink-0 border-b border-white/10 glass-panel flex items-center px-3 gap-2">
        <button onClick={() => navigate(-1)} className="btn-ghost p-1.5"><ArrowLeft size={16} /></button>
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-brand" />
          <span className="text-sm font-semibold text-white">Discover</span>
        </div>
      </div>

      {/* Groups / People toggle */}
      <div className="shrink-0 px-3 pt-3">
        <div className="flex gap-1 p-1 rounded-2xl glass max-w-lg mx-auto">
          {([['groups', 'Groups'], ['people', 'People']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={clsx('flex-1 py-1.5 rounded-xl text-sm font-medium transition-all',
                tab === key ? 'bg-gradient-to-br from-brand to-accent text-white shadow-lg shadow-brand/30' : 'text-slate-400 hover:text-white')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'people' ? <PeopleTab /> : <>

      {/* Search + categories */}
      <div className="shrink-0 p-3 space-y-3 border-b border-white/10">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8" placeholder="Search public groups…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={clsx('shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                cat === c ? 'bg-gradient-to-br from-brand to-accent text-white' : 'bg-surface-2 border border-white/10 text-slate-400')}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 pb-28">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-brand" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-14">
            <Compass size={34} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">No public groups found</p>
            <p className="text-slate-500 text-sm">Try another category or search term.</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-lg mx-auto">
            {items.map((g) => (
              <motion.div key={g.id} whileTap={{ scale: 0.99 }} className="card p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0">
                  {g.avatar ? (
                    <img src={g.avatar} className="w-full h-full object-cover" alt={g.name} />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-lg font-bold text-white">
                      {g.name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{g.name}</p>
                    {g.category && <span className="text-[10px] font-semibold text-brand bg-brand-dim px-1.5 py-0.5 rounded-md shrink-0">{g.category}</span>}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{g.description || 'No description'}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5"><Users size={11} /> {g.memberCount} member{g.memberCount !== 1 ? 's' : ''}</p>
                </div>
                {g.myStatus === 'BANNED' ? (
                  <span className="text-xs text-red-400 shrink-0">Banned</span>
                ) : (
                  <button onClick={() => join(g)} disabled={joining === g.id || g.myStatus === 'PENDING'}
                    className={clsx('shrink-0 text-xs font-semibold rounded-lg px-3 py-2 transition-colors disabled:opacity-70',
                      g.myStatus === 'APPROVED' ? 'bg-surface-2 text-brand'
                        : g.myStatus === 'PENDING' ? 'bg-surface-2 text-slate-400'
                          : 'bg-gradient-to-br from-brand to-accent text-white')}>
                    {joining === g.id ? <Loader2 size={13} className="animate-spin" />
                      : g.myStatus === 'APPROVED' ? 'Open'
                        : g.myStatus === 'PENDING' ? 'Requested'
                          : 'Join'}
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      </>}
    </div>
  );
}
