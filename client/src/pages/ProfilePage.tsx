import { useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { usersApi } from '../services/api';
import { Camera, Loader2, LogOut, Save, Zap, ChevronDown, ChevronUp, Plus, Trash2, X, BadgeCheck, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { User } from '../types';
import { profileCompletion } from '../utils/profile';
import {
  PROFILE_SECTIONS, INTEREST_OPTIONS, SKILL_SUGGESTIONS, SKILL_LEVELS, ACHIEVEMENT_TYPES,
  zodiacFrom, FieldDef, SectionDef, SkillEntry, AchievementEntry,
} from '../utils/profileSchema';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={clsx('w-11 h-6 rounded-full relative transition-colors shrink-0', on ? 'bg-brand' : 'bg-white/15')}>
      <span className={clsx('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

/** Multi-select pills from preset options, with optional free-text additions. */
function ChipsField({ field, value, onChange }: { field: FieldDef; value: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState('');
  const max = field.maxChips ?? 20;
  const toggle = (opt: string) => {
    if (value.includes(opt)) return onChange(value.filter((v) => v !== opt));
    if (value.length >= max) return toast(`Pick up to ${max}`, { icon: '✨' });
    onChange([...value, opt]);
  };
  const addCustom = () => {
    const v = custom.trim();
    if (!v || value.includes(v)) return setCustom('');
    if (value.length >= max) { toast(`Pick up to ${max}`, { icon: '✨' }); return; }
    onChange([...value, v]);
    setCustom('');
  };
  // Selected customs (not in the preset list) render alongside the presets.
  const customs = value.filter((v) => !(field.options ?? []).includes(v));
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {(field.options ?? []).map((opt) => {
          const on = value.includes(opt);
          return (
            <button key={opt} type="button" onClick={() => toggle(opt)}
              className={clsx('px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                on ? 'bg-gradient-to-br from-brand to-accent text-white' : 'bg-surface-2 border border-white/10 text-slate-400')}>
              {opt}
            </button>
          );
        })}
        {customs.map((opt) => (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-br from-brand to-accent text-white">
            {opt} <X size={10} className="inline -mt-0.5" />
          </button>
        ))}
      </div>
      {field.allowCustom && (
        <div className="flex gap-2 mt-2">
          <input className="input flex-1 text-sm" placeholder="Add your own…" value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} maxLength={40} />
          <button type="button" onClick={addCustom} className="btn-ghost px-3"><Plus size={15} /></button>
        </div>
      )}
    </div>
  );
}

/** One generic field renderer for every 'fields' section. */
function FieldInput({ field, value, onChange }: { field: FieldDef; value: any; onChange: (v: any) => void }) {
  if (field.type === 'toggle') {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-white">{field.label}</span>
        <Toggle on={!!value} onChange={onChange} />
      </div>
    );
  }
  return (
    <div>
      <label className="text-xs font-medium text-slate-400 mb-1.5 block">
        {field.label} {field.optional && <span className="text-slate-500">(optional)</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea className="input resize-none" rows={2} maxLength={300} value={value ?? ''}
          onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
      ) : field.type === 'select' ? (
        <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === 'chips' ? (
        <ChipsField field={field} value={Array.isArray(value) ? value : []} onChange={onChange} />
      ) : field.type === 'number' ? (
        <input type="number" min={0} max={80} className="input w-32" value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      ) : (
        <input type={field.type === 'date' ? 'date' : 'text'} className="input" value={value ?? ''}
          onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} maxLength={200} />
      )}
    </div>
  );
}

/** Skills list builder: name + level + years each. */
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

/** Achievements list builder: type + title each. */
function AchievementsEditor({ items, onChange }: { items: AchievementEntry[]; onChange: (v: AchievementEntry[]) => void }) {
  const [type, setType] = useState(ACHIEVEMENT_TYPES[0]);
  const [title, setTitle] = useState('');
  const add = () => {
    const v = title.trim();
    if (!v) return;
    onChange([...items, { type, title: v }]);
    setTitle('');
  };
  return (
    <div className="space-y-2">
      {items.map((a, i) => (
        <div key={i} className="flex items-center gap-2 rounded-xl bg-surface-2 border border-white/10 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand shrink-0">{a.type}</span>
          <span className="flex-1 text-sm text-white truncate">{a.title}</span>
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="btn-ghost p-1 text-slate-500 hover:text-red-400"><Trash2 size={13} /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <select className="input w-32 text-sm shrink-0" value={type} onChange={(e) => setType(e.target.value)}>
          {ACHIEVEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input flex-1 text-sm" placeholder="Title" value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} maxLength={120} />
        <button type="button" onClick={add} className="btn-ghost px-3"><Plus size={15} /></button>
      </div>
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
  const [username, setUsername] = useState(user?.username ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? '');
  const [bio, setBio] = useState(user?.bio ?? (user?.whoAreYou ?? ''));
  const [city, setCity] = useState(user?.city ?? '');
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  // The extended profile blob — prefilled from the old standalone columns so
  // the merged questions carry existing answers over.
  const [extra, setExtra] = useState<Record<string, any>>(() => ({
    strength: user?.whatCanYouDo ?? '',
    lifeGoal: user?.lookingFor ?? '',
    values: user?.trust ?? '',
    favSong: user?.favoriteSong ?? '',
    favMovie: user?.favoriteMovie ?? '',
    ...(user?.profileExtra ?? {}),
  }));
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [openSection, setOpenSection] = useState<string | null>('about');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setX = (key: string, v: any) => setExtra((e) => ({ ...e, [key]: v }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); return; }
    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = () => { setAvatar(reader.result as string); setUploadingPhoto(false); };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Name cannot be empty');
    setSaving(true);
    try {
      const res = await usersApi.updateMe({
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        username: username.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        bio: bio.trim() || undefined,
        city: city.trim() || undefined,
        interests,
        profileExtra: extra,
        avatar: avatar ?? undefined,
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

  // Live completeness from what's currently in the form.
  const draft = { ...user, avatar, username, bio, dateOfBirth, city, interests, profileExtra: extra } as User;
  const completion = profileCompletion(draft);

  const renderSection = (section: SectionDef) => {
    const open = openSection === section.id;
    return (
      <div key={section.id} className="card overflow-hidden mb-3">
        <button onClick={() => setOpenSection(open ? null : section.id)}
          className="w-full flex items-center justify-between px-5 py-4 text-left">
          <span className="text-sm font-bold text-white">{section.title}</span>
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        {open && (
          <div className="px-5 pb-5 space-y-4">
            {section.kind === 'skills' ? (
              <SkillsEditor skills={Array.isArray(extra.skills) ? extra.skills : []} onChange={(v) => setX('skills', v)} />
            ) : section.kind === 'achievements' ? (
              <AchievementsEditor items={Array.isArray(extra.achievements) ? extra.achievements : []} onChange={(v) => setX('achievements', v)} />
            ) : (
              section.fields.map((f) => (
                <FieldInput key={f.key} field={f} value={extra[f.key]} onChange={(v) => setX(f.key, v)} />
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-lg mx-auto animate-fade-in pb-28">
      <h1 className="text-xl font-bold text-white mb-6">Profile</h1>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative group">
          <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-white/10">
            {avatar ? (
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent to-brand flex items-center justify-center text-3xl font-bold text-white">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}
            className="absolute inset-0 rounded-3xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            {uploadingPhoto ? <Loader2 size={20} className="animate-spin text-white" /> : <Camera size={20} className="text-white" />}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        <p className="text-xs text-slate-400 mt-2">Tap photo to change · Max 2MB</p>

        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-200/60">
          <Zap size={13} className="text-amber-300" />
          <span className="text-xs font-semibold text-amber-300">
            {user?.strikePoints ?? 0} strike point{(user?.strikePoints ?? 0) !== 1 ? 's' : ''}
          </span>
        </motion.div>
      </div>

      {/* Profile completion */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-white">Profile {completion}% complete</p>
          {completion === 100 ? (
            <span className="text-xs font-medium text-emerald-400">All done ✓</span>
          ) : (
            <span className="text-xs text-brand">Fill in more below</span>
          )}
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-all duration-300" style={{ width: `${completion}%` }} />
        </div>
      </div>

      {/* Verification */}
      <div className="card p-5 mb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-2">VERIFICATION</p>
        <VerifyRow label="Email" ok={!!user?.email} hint="Sign in with Google to verify" />
        <VerifyRow label="Mobile" ok={!!user?.phone} hint="Sign in with phone to verify" />
        <VerifyRow label="Face verification" ok={null} hint="Coming soon" />
        <VerifyRow label="Address" ok={null} hint="Coming soon" />
      </div>

      {/* Basic info (core columns) */}
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
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Username <span className="text-slate-500">(optional)</span></label>
          <div className="input flex items-center gap-1.5 focus-within:border-brand/70">
            <span className="text-slate-500">@</span>
            <input className="flex-1 bg-transparent outline-none text-white placeholder-slate-500" value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24))} placeholder="username" />
          </div>
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

      {/* Interests (core column, 100+ options) */}
      <div className="card p-5 mb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-2">
          INTERESTS <span className="text-slate-500 normal-case">({interests.length}/20)</span>
        </p>
        <ChipsField
          field={{ key: 'interests', label: 'Interests', type: 'chips', options: INTEREST_OPTIONS, maxChips: 20 }}
          value={interests}
          onChange={setInterests}
        />
      </div>

      {/* Extended sections (config-driven) */}
      {PROFILE_SECTIONS.map(renderSection)}

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center mb-4">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        Save changes
      </button>

      {/* Logout */}
      <button onClick={() => logout()}
        className="w-full card p-4 flex items-center gap-3 hover:border-red-500/30 transition-colors group">
        <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
          <LogOut size={16} className="text-red-400" />
        </div>
        <span className="text-sm font-medium text-slate-200 group-hover:text-red-400 transition-colors">Sign out</span>
      </button>
    </div>
  );
}
