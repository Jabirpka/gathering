import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { usersApi, mediaApi } from '../services/api';
import { Camera, Loader2, LogOut, Save, Zap, ChevronDown, ChevronUp, Plus, Trash2, X, BadgeCheck, ShieldAlert, Eye, Lock, Sparkles, Search, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { User, ProfileVisitor } from '../types';
import { profileCompletion } from '../utils/profile';
import ImageAdjustModal from '../components/profile/ImageAdjustModal';
import {
  PROFILE_SECTIONS, INTEREST_OPTIONS, GENDER_OPTIONS, EDUCATION_LEVELS,
  SKILL_SUGGESTIONS, SKILL_LEVELS, FieldDef, SectionDef, SkillEntry, WorkEntry, EducationEntry, zodiacFrom,
} from '../utils/profileSchema';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={clsx('w-11 h-6 rounded-full relative transition-colors shrink-0', on ? 'bg-brand' : 'bg-white/15')}>
      <span className={clsx('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

/** Generic field renderer for the simple ('fields') sections. */
function FieldInput({ field, value, onChange }: { field: FieldDef; value: any; onChange: (v: any) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-400 mb-1.5 block">
        {field.label} {field.optional && <span className="text-slate-500">(optional)</span>}
      </label>
      {field.type === 'select' ? (
        <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} maxLength={200} />
      )}
    </div>
  );
}

/** Interests as a searchable list of rows with a check (not wrapping pills). */
function InterestList({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('');
  const max = 20;
  const toggle = (opt: string) => {
    if (value.includes(opt)) return onChange(value.filter((v) => v !== opt));
    if (value.length >= max) return toast(`Pick up to ${max}`, { icon: '✨' });
    onChange([...value, opt]);
  };
  const list = INTEREST_OPTIONS.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-8 text-sm" placeholder="Search interests…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
        {list.map((opt) => {
          const on = value.includes(opt);
          return (
            <button key={opt} type="button" onClick={() => toggle(opt)}
              className={clsx('w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors', on ? 'bg-brand/10' : 'hover:bg-white/5')}>
              <span className={clsx('w-5 h-5 rounded-md border flex items-center justify-center shrink-0', on ? 'bg-brand border-brand' : 'border-white/25')}>
                {on && <Check size={12} className="text-white" />}
              </span>
              <span className="text-sm text-slate-200">{opt}</span>
            </button>
          );
        })}
        {list.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No matches</p>}
      </div>
    </div>
  );
}

function SkillsEditor({ skills, onChange }: { skills: SkillEntry[]; onChange: (v: SkillEntry[]) => void }) {
  const [name, setName] = useState('');
  const add = (n?: string) => {
    const v = (n ?? name).trim();
    if (!v || skills.some((s) => s.name.toLowerCase() === v.toLowerCase())) return setName('');
    onChange([...skills, { name: v, level: 'Intermediate', years: null }]);
    setName('');
  };
  const update = (i: number, patch: Partial<SkillEntry>) => onChange(skills.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-2">
      {skills.map((s, i) => (
        <div key={i} className="rounded-xl bg-surface-2 border border-white/10 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm font-semibold text-white">{s.name}</span>
            <button onClick={() => onChange(skills.filter((_, idx) => idx !== i))} className="btn-ghost p-1 text-slate-500 hover:text-red-400"><Trash2 size={13} /></button>
          </div>
          <div className="flex gap-2">
            <select className="input flex-1 text-sm" value={s.level} onChange={(e) => update(i, { level: e.target.value })}>
              {SKILL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input type="number" min={0} max={60} className="input w-24 text-sm" placeholder="Years"
              value={s.years ?? ''} onChange={(e) => update(i, { years: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <input className="input flex-1 text-sm" placeholder="Add a skill (e.g. Welding)" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} maxLength={40} />
        <button type="button" onClick={() => add()} className="btn-ghost px-3"><Plus size={15} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SKILL_SUGGESTIONS.filter((s) => !skills.some((k) => k.name === s)).slice(0, 8).map((s) => (
          <button key={s} type="button" onClick={() => add(s)}
            className="px-2.5 py-1 rounded-full text-[11px] bg-surface-2 border border-white/10 text-slate-400">+ {s}</button>
        ))}
      </div>
    </div>
  );
}

/** Multiple work experiences: designation, company, join/end date, still working. */
function WorkEditor({ work, hire, onWork, onHire }: { work: WorkEntry[]; hire: boolean; onWork: (v: WorkEntry[]) => void; onHire: (v: boolean) => void }) {
  const update = (i: number, patch: Partial<WorkEntry>) => onWork(work.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white">Available for hire</span>
        <Toggle on={hire} onChange={onHire} />
      </div>
      {work.map((w, i) => (
        <div key={i} className="rounded-xl bg-surface-2 border border-white/10 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Experience {i + 1}</span>
            <button onClick={() => onWork(work.filter((_, idx) => idx !== i))} className="btn-ghost p-1 text-slate-500 hover:text-red-400"><Trash2 size={13} /></button>
          </div>
          <input className="input text-sm" placeholder="Designation (e.g. Welder)" value={w.designation ?? ''} onChange={(e) => update(i, { designation: e.target.value })} maxLength={80} />
          <input className="input text-sm" placeholder="Company" value={w.company ?? ''} onChange={(e) => update(i, { company: e.target.value })} maxLength={80} />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-1 block">Joining date</label>
              <input type="month" className="input text-sm" value={w.joinDate ?? ''} onChange={(e) => update(i, { joinDate: e.target.value })} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-1 block">{w.current ? 'Still working' : 'Last date'}</label>
              <input type="month" className="input text-sm disabled:opacity-40" disabled={w.current} value={w.current ? '' : (w.endDate ?? '')} onChange={(e) => update(i, { endDate: e.target.value })} />
            </div>
          </div>
          <button type="button" onClick={() => update(i, { current: !w.current, endDate: w.current ? w.endDate : '' })}
            className="flex items-center gap-2 text-xs text-slate-300">
            <span className={clsx('w-4 h-4 rounded border flex items-center justify-center', w.current ? 'bg-brand border-brand' : 'border-white/30')}>
              {w.current && <Check size={11} className="text-white" />}
            </span>
            I currently work here
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onWork([...work, { designation: '', company: '', joinDate: '', current: false }])}
        className="w-full input flex items-center justify-center gap-2 text-slate-400 hover:border-brand/50">
        <Plus size={15} /> Add work experience
      </button>
    </div>
  );
}

/** Multiple education entries: level, institution, pass-out year / still going. */
function EducationEditor({ items, onChange }: { items: EducationEntry[]; onChange: (v: EducationEntry[]) => void }) {
  const update = (i: number, patch: Partial<EducationEntry>) => onChange(items.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const years = Array.from({ length: 60 }, (_, k) => String(new Date().getFullYear() + 5 - k));
  return (
    <div className="space-y-3">
      {items.map((e, i) => (
        <div key={i} className="rounded-xl bg-surface-2 border border-white/10 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Education {i + 1}</span>
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="btn-ghost p-1 text-slate-500 hover:text-red-400"><Trash2 size={13} /></button>
          </div>
          <select className="input text-sm" value={e.level ?? ''} onChange={(ev) => update(i, { level: ev.target.value })}>
            <option value="">Choose level…</option>
            {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <input className="input text-sm" placeholder="Name of institution" value={e.institution ?? ''} onChange={(ev) => update(i, { institution: ev.target.value })} maxLength={100} />
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-1 block">{e.ongoing ? 'Still going' : 'Year of passout'}</label>
              <select className="input text-sm disabled:opacity-40" disabled={e.ongoing} value={e.ongoing ? '' : (e.endYear ?? '')} onChange={(ev) => update(i, { endYear: ev.target.value })}>
                <option value="">Year…</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => update(i, { ongoing: !e.ongoing, endYear: e.ongoing ? e.endYear : '' })}
              className="flex items-center gap-1.5 text-xs text-slate-300 pb-2.5">
              <span className={clsx('w-4 h-4 rounded border flex items-center justify-center', e.ongoing ? 'bg-brand border-brand' : 'border-white/30')}>
                {e.ongoing && <Check size={11} className="text-white" />}
              </span>
              Still going
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { level: '', institution: '', endYear: '', ongoing: false }])}
        className="w-full input flex items-center justify-center gap-2 text-slate-400 hover:border-brand/50">
        <Plus size={15} /> Add education
      </button>
    </div>
  );
}

function VerifyRow({ label, ok, hint }: { label: string; ok: boolean | null; hint: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      {ok ? <BadgeCheck size={16} className="text-emerald-400 shrink-0" /> : <ShieldAlert size={16} className="text-slate-500 shrink-0" />}
      <span className="flex-1 text-sm text-white">{label}</span>
      <span className={clsx('text-xs', ok ? 'text-emerald-400' : 'text-slate-500')}>{ok ? 'Verified' : hint}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const usernameLocked = !!user?.username;
  const [username, setUsername] = useState(user?.username ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [extra, setExtra] = useState<Record<string, any>>(() => ({ ...(user?.profileExtra ?? {}) }));
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [banner, setBanner] = useState<string | null>(user?.banner ?? null);
  const [openSection, setOpenSection] = useState<string | null>('work');
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [views, setViews] = useState<{ total: number; visitors: ProfileVisitor[] } | null>(null);
  const [adjust, setAdjust] = useState<{ src: string; kind: 'avatar' | 'banner' } | null>(null);

  useEffect(() => { usersApi.myVisitors().then((r) => setViews(r.data)).catch(() => {}); }, []);

  const setX = (key: string, v: any) => setExtra((e) => ({ ...e, [key]: v }));
  const privacyOf = (id: string) => (extra.privacy?.[id] ?? 'everyone') as string;
  const setPrivacy = (id: string, level: string) => setExtra((e) => ({ ...e, privacy: { ...(e.privacy ?? {}), [id]: level } }));

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>, kind: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Photo must be under 8MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setAdjust({ src: reader.result as string, kind });
    reader.readAsDataURL(file);
  };
  const applyAdjusted = (dataUrl: string) => {
    if (!adjust) return;
    if (adjust.kind === 'avatar') setAvatar(dataUrl); else setBanner(dataUrl);
    setAdjust(null);
  };

  const genUsername = async () => {
    setSuggesting(true);
    try {
      const res = await usersApi.suggestUsername(name.trim());
      setUsername(res.data.username);
    } catch { toast.error('Could not generate a username'); }
    finally { setSuggesting(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Name cannot be empty');
    if (!usernameLocked && username.trim().length < 3) return toast.error('Choose a username (3+ characters) — it can’t be changed later');
    setSaving(true);
    try {
      let avatarOut = avatar, bannerOut = banner;
      if (avatarOut?.startsWith('data:')) { try { avatarOut = await mediaApi.upload(avatarOut); setAvatar(avatarOut); } catch {} }
      if (bannerOut?.startsWith('data:')) { try { bannerOut = await mediaApi.upload(bannerOut); setBanner(bannerOut); } catch {} }
      const res = await usersApi.updateMe({
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        username: usernameLocked ? undefined : (username.trim() || undefined),
        dateOfBirth: dateOfBirth || undefined,
        bio: bio.trim() || undefined,
        city: city.trim() || undefined,
        interests,
        profileExtra: extra,
        avatar: avatarOut ?? undefined,
        banner: bannerOut,
      });
      updateUser(res.data);
      toast.success('Profile saved!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const displayName = user?.nickname || user?.name || '';
  const zodiac = zodiacFrom(dateOfBirth);
  const draft = { ...user, avatar, username, bio, dateOfBirth, city, interests, profileExtra: extra } as User;
  const completion = profileCompletion(draft);

  const renderSection = (section: SectionDef) => {
    const open = openSection === section.id;
    return (
      <div key={section.id} className="card overflow-hidden mb-3">
        <button onClick={() => setOpenSection(open ? null : section.id)} className="w-full flex items-center gap-2 px-5 py-4 text-left">
          <span className="text-sm font-bold text-white flex-1">{section.title}</span>
          <select value={privacyOf(section.id)} onChange={(e) => setPrivacy(section.id, e.target.value)} onClick={(e) => e.stopPropagation()}
            className="appearance-none bg-surface-2 border border-white/10 rounded-lg text-[11px] text-slate-300 px-2 py-1 outline-none cursor-pointer">
            <option value="everyone">🌍 Everyone</option>
            <option value="groups">👥 My groups</option>
            <option value="me">🔒 Only me</option>
          </select>
          {open ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
        </button>
        {open && (
          <div className="px-5 pb-5 space-y-4">
            {section.kind === 'skills' ? (
              <SkillsEditor skills={Array.isArray(extra.skills) ? extra.skills : []} onChange={(v) => setX('skills', v)} />
            ) : section.kind === 'work' ? (
              <WorkEditor work={Array.isArray(extra.work) ? extra.work : []} hire={!!extra.availableForHire}
                onWork={(v) => setX('work', v)} onHire={(v) => setX('availableForHire', v)} />
            ) : section.kind === 'education' ? (
              <EducationEditor items={Array.isArray(extra.educations) ? extra.educations : []} onChange={(v) => setX('educations', v)} />
            ) : (
              section.fields.map((f) => <FieldInput key={f.key} field={f} value={extra[f.key]} onChange={(v) => setX(f.key, v)} />)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 pt-0 max-w-lg mx-auto animate-fade-in pb-28">
      {/* Banner — full-bleed */}
      <div className="relative -mx-6">
        <div className="h-36 overflow-hidden border-b border-white/10">
          {banner ? (
            <img src={banner} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand/40 via-surface-2 to-accent/30 flex items-center justify-center">
              <span className="text-xs text-slate-400">Add a banner image</span>
            </div>
          )}
        </div>
        <div className="absolute top-2 right-3 flex gap-1.5">
          <button onClick={() => bannerRef.current?.click()} className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white" title={banner ? 'Change banner' : 'Add banner'}>
            <Camera size={14} />
          </button>
          {banner && (
            <button onClick={() => setBanner(null)} className="w-8 h-8 rounded-full bg-black/60 hover:bg-red-500/80 flex items-center justify-center text-white" title="Remove banner">
              <X size={14} />
            </button>
          )}
        </div>
        <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e, 'banner')} />
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-6 -mt-12">
        <div className="relative group">
          <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-surface bg-surface">
            {avatar ? (
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent to-brand flex items-center justify-center text-3xl font-bold text-white">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <button onClick={() => fileRef.current?.click()} className="absolute inset-0 rounded-3xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Camera size={20} className="text-white" />
          </button>
          <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand border-2 border-surface flex items-center justify-center text-white sm:hidden" title="Change photo">
            <Camera size={12} />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e, 'avatar')} />
        <p className="text-xs text-slate-400 mt-2">Tap photo to change</p>

        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-200/60">
          <Zap size={13} className="text-amber-300" />
          <span className="text-xs font-semibold text-amber-300">{user?.strikePoints ?? 0} strike point{(user?.strikePoints ?? 0) !== 1 ? 's' : ''}</span>
        </motion.div>
      </div>

      {/* Completion */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-white">Profile {completion}% complete</p>
          {completion === 100 ? <span className="text-xs font-medium text-emerald-400">All done ✓</span> : <span className="text-xs text-brand">Fill in more below</span>}
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-all duration-300" style={{ width: `${completion}%` }} />
        </div>
      </div>

      {/* Profile views */}
      {views && views.total > 0 && (
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye size={14} className="text-brand" />
            <p className="text-sm font-semibold text-white flex-1">{views.total} profile view{views.total !== 1 ? 's' : ''} <span className="text-slate-500 text-xs font-normal">· 30 days</span></p>
          </div>
          <div className="flex items-center gap-1.5">
            {views.visitors.slice(0, 8).map((v) => (
              v.user.avatar ? (
                <img key={v.user.id} src={v.user.avatar} className="w-8 h-8 rounded-xl object-cover" alt={v.user.name} title={v.user.nickname || v.user.name} />
              ) : (
                <div key={v.user.id} title={v.user.nickname || v.user.name} className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-brand flex items-center justify-center text-xs font-bold text-white">
                  {(v.user.nickname || v.user.name)[0]?.toUpperCase()}
                </div>
              )
            ))}
            {views.visitors.length > 8 && <span className="text-xs text-slate-400 ml-1">+{views.visitors.length - 8}</span>}
          </div>
        </div>
      )}

      {/* Verification */}
      <div className="card p-5 mb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-2">VERIFICATION</p>
        <VerifyRow label="Email" ok={!!user?.email} hint="Sign in with Google to verify" />
        <VerifyRow label="Mobile" ok={!!user?.phone} hint="Sign in with phone to verify" />
        <VerifyRow label="Face verification" ok={null} hint="Coming soon" />
        <VerifyRow label="Address" ok={null} hint="Coming soon" />
      </div>

      {/* Basic info */}
      <div className="card p-5 space-y-4 mb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">BASIC INFO</p>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Full name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Your full name" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Display name / nickname</label>
          <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} placeholder="Shown in chats & pokes" />
        </div>

        {/* Username — mandatory, set once, never editable */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">
            Username <span className="text-brand">*</span> {!usernameLocked && <span className="text-slate-500">(permanent — can’t be changed later)</span>}
          </label>
          {usernameLocked ? (
            <div className="input flex items-center gap-1.5 opacity-80">
              <span className="text-slate-500">@</span>
              <span className="flex-1 text-white">{username}</span>
              <Lock size={13} className="text-slate-500" />
            </div>
          ) : (
            <>
              <div className="input flex items-center gap-1.5 focus-within:border-brand/70">
                <span className="text-slate-500">@</span>
                <input className="flex-1 bg-transparent outline-none text-white placeholder-slate-500" value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24))} placeholder="username" />
                <button onClick={genUsername} disabled={suggesting} className="flex items-center gap-1 text-[11px] font-semibold text-brand shrink-0">
                  {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate
                </button>
              </div>
            </>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Gender</label>
          <select className="input" value={extra.gender ?? ''} onChange={(e) => setX('gender', e.target.value)}>
            <option value="">—</option>
            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Short bio</label>
          <textarea className="input resize-none" rows={2} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Just hanging out ✨" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Date of birth {zodiac && <span className="text-brand ml-1">{zodiac}</span>}</label>
          <input type="date" className="input" value={dateOfBirth ?? ''} onChange={(e) => setDateOfBirth(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">City</label>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder="Where you're based" />
        </div>
      </div>

      {/* Interests — list style */}
      <div className="card p-5 mb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-2">
          INTERESTS <span className="text-slate-500 normal-case">({interests.length}/20)</span>
        </p>
        <InterestList value={interests} onChange={setInterests} />
      </div>

      {/* Config-driven sections: Work, Education, Skills, Lifestyle, Favorites */}
      {PROFILE_SECTIONS.map(renderSection)}

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center mb-4">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        Save changes
      </button>

      <button onClick={() => logout()} className="w-full card p-4 flex items-center gap-3 hover:border-red-500/30 transition-colors group">
        <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
          <LogOut size={16} className="text-red-400" />
        </div>
        <span className="text-sm font-medium text-slate-200 group-hover:text-red-400 transition-colors">Sign out</span>
      </button>

      {adjust && (
        <ImageAdjustModal src={adjust.src} aspect={adjust.kind === 'banner' ? 3 : 1} outWidth={adjust.kind === 'banner' ? 1200 : 512}
          title={adjust.kind === 'banner' ? 'Adjust banner' : 'Adjust photo'} onCancel={() => setAdjust(null)} onDone={applyAdjusted} />
      )}
    </div>
  );
}
