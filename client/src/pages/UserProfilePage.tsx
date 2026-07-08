import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usersApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useDmStore } from '../store/dmStore';
import { User } from '../types';
import { ArrowLeft, Loader2, Zap, MessageSquare, Music, Film, MapPin, User as UserIcon, Cake } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

/** Whole years between a date of birth and today. */
function ageFrom(dob: string): number | null {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Read-only profile of another user, opened from a DM avatar / member list.
 * Shows their details plus Poke (adds a strike point + rings a notification)
 * and Message (open a DM) actions.
 */
export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const myId = useAuthStore((s) => s.user?.id);
  const openThread = useDmStore((s) => s.openThread);

  const [u, setU] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [strikes, setStrikes] = useState(0);
  const [poking, setPoking] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!userId) return;
    // Your own profile lives on the editable /profile screen.
    if (userId === myId) { navigate('/profile', { replace: true }); return; }
    setLoading(true);
    usersApi.getUser(userId)
      .then((res) => { setU(res.data); setStrikes(res.data.strikePoints ?? 0); })
      .catch(() => toast.error('Could not load profile'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, myId]);

  const poke = async () => {
    if (!userId || poking) return;
    setPoking(true);
    try {
      const res = await usersApi.poke(userId);
      setStrikes(res.data.strikePoints ?? strikes + 1);
      toast.success(`Poked ${u?.nickname || u?.name || ''}! 👉`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to poke');
    } finally {
      setPoking(false);
    }
  };

  const message = async () => {
    if (!userId || opening) return;
    setOpening(true);
    try {
      const thread = await openThread(userId);
      navigate(`/dm/${thread.id}`);
    } catch {
      toast.error('Could not open chat');
    } finally {
      setOpening(false);
    }
  };

  const name = u?.nickname || u?.name || '';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 shrink-0 border-b border-white/10 glass-panel flex items-center px-3 gap-2">
        <button onClick={() => navigate(-1)} className="btn-ghost p-1.5"><ArrowLeft size={16} /></button>
        <div className="text-sm font-semibold text-white truncate">Profile</div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 size={22} className="animate-spin text-brand" /></div>
      ) : !u ? (
        <div className="flex-1 flex items-center justify-center"><p className="text-slate-400 text-sm">Profile not found</p></div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto w-full pb-28 animate-fade-in">
          {/* Avatar + identity */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-white/10">
              {u.avatar ? (
                <img src={u.avatar} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-accent to-brand flex items-center justify-center text-3xl font-bold text-white">
                  {name[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <h1 className="text-xl font-bold text-white mt-3">{name}</h1>
            {u.username && <p className="text-sm text-slate-400">@{u.username}</p>}
            {u.bio && <p className="text-sm text-slate-300 text-center mt-2 max-w-xs">{u.bio}</p>}

            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-200/60">
              <Zap size={13} className="text-amber-300" />
              <span className="text-xs font-semibold text-amber-300">
                {strikes} strike point{strikes !== 1 ? 's' : ''}
              </span>
            </motion.div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-6">
            <button onClick={poke} disabled={poking}
              className="flex-1 justify-center flex items-center gap-2 rounded-2xl py-3 font-semibold text-white bg-gradient-to-br from-brand to-accent shadow-lg shadow-brand/30 active:scale-[0.98] transition-transform disabled:opacity-60">
              {poking ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              Poke
            </button>
            <button onClick={message} disabled={opening}
              className="flex-1 justify-center flex items-center gap-2 rounded-2xl py-3 font-semibold text-brand bg-brand-dim border border-brand/30 active:scale-[0.98] transition-transform disabled:opacity-60">
              {opening ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
              Message
            </button>
          </div>

          {/* Basic info — real name (when a nickname is shown) + date of birth */}
          {((u.nickname && u.name && u.nickname !== u.name) || u.dateOfBirth) && (
            <div className="card p-5 space-y-3 mb-4">
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">BASIC INFO</p>
              {u.nickname && u.name && u.nickname !== u.name && (
                <div className="flex items-center gap-3">
                  <UserIcon size={15} className="text-brand shrink-0" />
                  <span className="text-sm text-slate-200">{u.name}</span>
                </div>
              )}
              {u.dateOfBirth && (
                <div className="flex items-center gap-3">
                  <Cake size={15} className="text-brand shrink-0" />
                  <span className="text-sm text-slate-200">
                    {format(new Date(u.dateOfBirth), 'MMMM d, yyyy')}
                    {ageFrom(u.dateOfBirth) !== null && <span className="text-slate-400"> · {ageFrom(u.dateOfBirth)} yrs</span>}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Interests */}
          {u.interests && u.interests.length > 0 && (
            <div className="card p-5 mb-4">
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-3">INTERESTS</p>
              <div className="flex flex-wrap gap-2">
                {u.interests.map((i) => (
                  <span key={i} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface-2 border border-white/10 text-slate-200">{i}</span>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          {(u.favoriteSong || u.favoriteMovie || u.city) && (
            <div className="card p-5 space-y-3 mb-4">
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">DETAILS</p>
              {u.favoriteSong && (
                <div className="flex items-center gap-3">
                  <Music size={15} className="text-brand shrink-0" />
                  <span className="text-sm text-slate-200">{u.favoriteSong}</span>
                </div>
              )}
              {u.favoriteMovie && (
                <div className="flex items-center gap-3">
                  <Film size={15} className="text-brand shrink-0" />
                  <span className="text-sm text-slate-200">{u.favoriteMovie}</span>
                </div>
              )}
              {u.city && (
                <div className="flex items-center gap-3">
                  <MapPin size={15} className="text-brand shrink-0" />
                  <span className="text-sm text-slate-200">{u.city}</span>
                </div>
              )}
            </div>
          )}

          {u.createdAt && (
            <p className="text-center text-xs text-slate-500">Member since {format(new Date(u.createdAt), 'MMMM yyyy')}</p>
          )}
        </div>
      )}
    </div>
  );
}
