import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usersApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useDmStore } from '../store/dmStore';
import { User } from '../types';
import { ArrowLeft, Loader2, Zap, MessageSquare, MapPin, User as UserIcon, Cake, Link as LinkIcon, BadgeCheck } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { PROFILE_SECTIONS, zodiacFrom, SectionDef, SkillEntry, AchievementEntry } from '../utils/profileSchema';
import { computeMatches } from '../utils/match';

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

const isFilled = (v: any) => (Array.isArray(v) ? v.length > 0 : typeof v === 'number' ? true : typeof v === 'boolean' ? v : !!(typeof v === 'string' ? v.trim() : v));

/** Make a pasted handle/URL clickable. */
function linkHref(v: string): string {
  const s = v.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('@')) return `https://instagram.com/${s.slice(1)}`;
  return `https://${s}`;
}

/** Read-only renderer for one extended-profile section. */
function SectionView({ section, extra }: { section: SectionDef; extra: Record<string, any> }) {
  if (section.privateSection) return null;

  if (section.kind === 'skills') {
    const skills = (Array.isArray(extra.skills) ? extra.skills : []) as SkillEntry[];
    if (skills.length === 0) return null;
    return (
      <div className="card p-5 mb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-3">SKILLS</p>
        <div className="space-y-2">
          {skills.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-white">{s.name}</span>
              <span className="text-xs font-semibold text-brand bg-brand-dim rounded-lg px-2 py-0.5">{s.level}</span>
              {s.years != null && <span className="text-xs text-slate-400">{s.years} yr{s.years !== 1 ? 's' : ''}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section.kind === 'achievements') {
    const items = (Array.isArray(extra.achievements) ? extra.achievements : []) as AchievementEntry[];
    if (items.length === 0) return null;
    return (
      <div className="card p-5 mb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-3">ACHIEVEMENTS</p>
        <div className="space-y-2">
          {items.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand shrink-0">{a.type}</span>
              <span className="text-sm text-white">{a.title}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filledFields = section.fields.filter((f) => isFilled(extra[f.key]));
  if (filledFields.length === 0) return null;
  const isSocials = section.id === 'socials';

  return (
    <div className="card p-5 mb-4">
      <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-3">{section.title.toUpperCase()}</p>
      <div className="space-y-2.5">
        {filledFields.map((f) => {
          const v = extra[f.key];
          return (
            <div key={f.key}>
              <p className="text-xs text-brand font-medium mb-0.5">{f.label}</p>
              {f.type === 'chips' ? (
                <div className="flex flex-wrap gap-1.5">
                  {(v as string[]).map((c) => (
                    <span key={c} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-2 border border-white/10 text-slate-200">{c}</span>
                  ))}
                </div>
              ) : f.type === 'toggle' ? (
                <p className="text-sm text-emerald-400 font-medium">Yes</p>
              ) : isSocials ? (
                <a href={linkHref(String(v))} target="_blank" rel="noreferrer"
                  className="text-sm text-brand underline underline-offset-2 flex items-center gap-1.5 break-all">
                  <LinkIcon size={12} className="shrink-0" /> {String(v)}
                </a>
              ) : (
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{String(v)}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Read-only profile of another user, opened from a DM avatar / member list.
 * Shows their details plus Poke and Message actions.
 */
export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const myId = me?.id;
  const openThread = useDmStore((s) => s.openThread);

  const [u, setU] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [strikes, setStrikes] = useState(0);
  const [poking, setPoking] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!userId) return;
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
  const extra = (u?.profileExtra ?? {}) as Record<string, any>;
  const zodiac = zodiacFrom(u?.dateOfBirth);
  const matches = me && u ? computeMatches(me, u) : [];

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
        <div className="flex-1 overflow-y-auto p-6 pt-0 max-w-lg mx-auto w-full pb-28 animate-fade-in">
          {/* Banner — full-bleed across the app width */}
          {u.banner ? (
            <div className="h-36 overflow-hidden border-b border-white/10 -mx-6">
              <img src={u.banner} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="pt-6" />
          )}

          {/* Avatar + identity */}
          <div className={`flex flex-col items-center mb-6 ${u.banner ? '-mt-12' : ''}`}>
            <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-surface bg-surface">
              {u.avatar ? (
                <img src={u.avatar} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-accent to-brand flex items-center justify-center text-3xl font-bold text-white">
                  {name[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <h1 className="text-xl font-bold text-white mt-3 flex items-center gap-1.5">
              {name}
              {(u.emailVerified || u.phoneVerified) && (
                <BadgeCheck size={17} className="text-brand" aria-label="Verified" />
              )}
            </h1>
            {extra.availableForHire && (
              <span className="mt-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2.5 py-0.5">
                Available for hire
              </span>
            )}
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

          {/* Match with you */}
          {matches.length > 0 && (
            <div className="card p-5 mb-4">
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-3">MATCH WITH YOU</p>
              <div className="space-y-2.5">
                {matches.map((m) => (
                  <div key={m.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-200">{m.emoji} {m.label}</span>
                      <span className="text-sm font-bold text-brand tabular-nums">{m.score}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-all duration-500"
                        style={{ width: `${m.score}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{m.reason}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-3">Based on both profiles — complete yours for sharper matches.</p>
            </div>
          )}

          {/* Basic info */}
          {((u.nickname && u.name && u.nickname !== u.name) || u.dateOfBirth || u.city) && (
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
                    {zodiac && <span className="text-slate-400"> · {zodiac}</span>}
                  </span>
                </div>
              )}
              {u.city && (
                <div className="flex items-center gap-3">
                  <MapPin size={15} className="text-brand shrink-0" />
                  <span className="text-sm text-slate-200">{u.city}{extra.country ? `, ${extra.country}` : ''}</span>
                </div>
              )}
            </div>
          )}

          {/* Interests (core column) */}
          {u.interests && u.interests.length > 0 && (
            <div className="card p-5 mb-4">
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-3">INTERESTS</p>
              <div className="flex flex-wrap gap-1.5">
                {u.interests.map((i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-2 border border-white/10 text-slate-200">{i}</span>
                ))}
              </div>
            </div>
          )}

          {/* Extended sections (config-driven, emergency stays private) */}
          {PROFILE_SECTIONS.map((s) => <SectionView key={s.id} section={s} extra={extra} />)}

          {u.createdAt && (
            <p className="text-center text-xs text-slate-500">Member since {format(new Date(u.createdAt), 'MMMM yyyy')}</p>
          )}
        </div>
      )}
    </div>
  );
}
