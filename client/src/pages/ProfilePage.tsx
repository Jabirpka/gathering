import { useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { usersApi } from '../services/api';
import { Camera, Loader2, LogOut, Save, Zap, Music, Film, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { User } from '../types';
import { PROFILE_QUESTIONS, profileCompletion } from '../utils/profile';

const INTEREST_OPTIONS = ['🎮 Gaming', '🎵 Music', '📸 Photography', '✈️ Travel', '🍕 Food', '📚 Books', '🎬 Movies', '⚽ Sports'];

type AboutState = Record<(typeof PROFILE_QUESTIONS)[number]['key'], string>;

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [favoriteSong, setFavoriteSong] = useState(user?.favoriteSong ?? '');
  const [favoriteMovie, setFavoriteMovie] = useState(user?.favoriteMovie ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [about, setAbout] = useState<AboutState>({
    whoAreYou: user?.whoAreYou ?? '',
    whatCanYouDo: user?.whatCanYouDo ?? '',
    trust: user?.trust ?? '',
    lookingFor: user?.lookingFor ?? '',
    wantToMeet: user?.wantToMeet ?? '',
  });
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Photo must be under 2MB');
      return;
    }
    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const toggleInterest = (i: string) => {
    setInterests((cur) => {
      if (cur.includes(i)) return cur.filter((x) => x !== i);
      if (cur.length >= 5) { toast('Pick up to 5 interests', { icon: '✨' }); return cur; }
      return [...cur, i];
    });
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
        interests,
        favoriteSong: favoriteSong.trim() || undefined,
        favoriteMovie: favoriteMovie.trim() || undefined,
        city: city.trim() || undefined,
        whoAreYou: about.whoAreYou.trim() || undefined,
        whatCanYouDo: about.whatCanYouDo.trim() || undefined,
        trust: about.trust.trim() || undefined,
        lookingFor: about.lookingFor.trim() || undefined,
        wantToMeet: about.wantToMeet.trim() || undefined,
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

  // Live completeness from the fields currently in the form.
  const draft = { ...user, avatar, username, bio, dateOfBirth, city, interests, favoriteSong, favoriteMovie, ...about } as User;
  const completion = profileCompletion(draft);

  return (
    <div className="p-6 max-w-lg mx-auto animate-fade-in pb-28">
      <h1 className="text-xl font-bold text-white mb-6">Profile</h1>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-8">
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
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute inset-0 rounded-3xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            {uploadingPhoto ? <Loader2 size={20} className="animate-spin text-white" /> : <Camera size={20} className="text-white" />}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        <p className="text-xs text-slate-400 mt-2">Tap photo to change · Max 2MB</p>

        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-200">
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

      {/* Basic info */}
      <div className="card p-5 space-y-4 mb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">BASIC INFO</p>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Display name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Your name" />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Username <span className="text-slate-500">(optional)</span></label>
          <div className="input flex items-center gap-1.5 focus-within:border-brand/70">
            <span className="text-slate-500">@</span>
            <input
              className="flex-1 bg-transparent outline-none text-white placeholder-slate-500"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24))}
              placeholder="username"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Nickname <span className="text-slate-500">(optional)</span></label>
          <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} placeholder="Shown in chats & pokes" />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Date of birth</label>
          <input type="date" className="input" value={dateOfBirth ?? ''} onChange={(e) => setDateOfBirth(e.target.value)} />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Email</label>
          <input className="input opacity-60 cursor-not-allowed" value={user?.email ?? ''} disabled />
        </div>
      </div>

      {/* Personal details */}
      <div className="card p-5 space-y-4 mb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">PERSONAL DETAILS</p>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Bio</label>
          <textarea className="input resize-none" rows={2} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Just hanging out ✨" />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-2 block">
            Interests <span className="text-slate-500">({interests.length}/5)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((opt) => {
              const on = interests.includes(opt);
              return (
                <button key={opt} type="button" onClick={() => toggleInterest(opt)}
                  className={clsx('px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                    on ? 'bg-gradient-to-br from-brand to-accent text-white' : 'bg-surface-2 border border-white/10 text-slate-400')}>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Favorite song</label>
          <div className="input flex items-center gap-2">
            <Music size={14} className="text-brand shrink-0" />
            <input className="flex-1 bg-transparent outline-none text-white placeholder-slate-500" value={favoriteSong} onChange={(e) => setFavoriteSong(e.target.value)} maxLength={80} placeholder="A song you love" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Favorite movie</label>
          <div className="input flex items-center gap-2">
            <Film size={14} className="text-brand shrink-0" />
            <input className="flex-1 bg-transparent outline-none text-white placeholder-slate-500" value={favoriteMovie} onChange={(e) => setFavoriteMovie(e.target.value)} maxLength={80} placeholder="A movie you love" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">City</label>
          <div className="input flex items-center gap-2">
            <MapPin size={14} className="text-brand shrink-0" />
            <input className="flex-1 bg-transparent outline-none text-white placeholder-slate-500" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder="Where you're based" />
          </div>
        </div>

      </div>

      {/* About you */}
      <div className="card p-5 space-y-4 mb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">ABOUT YOU</p>
        {PROFILE_QUESTIONS.map((item) => (
          <div key={item.key}>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">{item.q}</label>
            <textarea
              className="input resize-none"
              rows={2}
              maxLength={280}
              value={about[item.key]}
              onChange={(e) => setAbout((a) => ({ ...a, [item.key]: e.target.value }))}
              placeholder={item.placeholder}
            />
          </div>
        ))}
      </div>

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
