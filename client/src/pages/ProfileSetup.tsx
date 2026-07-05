import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usersApi } from '../services/api';
import { Camera, Loader2, Music, Film, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

const INTEREST_OPTIONS = ['🎮 Gaming', '🎵 Music', '📸 Photography', '✈️ Travel', '🍕 Food', '📚 Books', '🎬 Movies', '⚽ Sports'];

/**
 * v2 "Step 2 of 2" onboarding, shown once right after a new user's first sign-in
 * (gated in App by user.onboarded === false). Saving flips onboarded → true.
 */
export default function ProfileSetup() {
  const { user, updateUser, logout } = useAuthStore();
  // Phone users are created with name = their number; start blank so they type a real one.
  const looksLikePhone = (user?.name ?? '').startsWith('+');
  const [name, setName] = useState(looksLikePhone ? '' : (user?.name ?? ''));
  const [username, setUsername] = useState(user?.username ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [favoriteSong, setFavoriteSong] = useState(user?.favoriteSong ?? '');
  const [favoriteMovie, setFavoriteMovie] = useState(user?.favoriteMovie ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => { setAvatar(reader.result as string); setUploading(false); };
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
    if (!name.trim()) return toast.error('Please enter your name');
    setSaving(true);
    try {
      const res = await usersApi.updateMe({
        name: name.trim(),
        username: username.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        bio: bio.trim() || undefined,
        interests,
        favoriteSong: favoriteSong.trim() || undefined,
        favoriteMovie: favoriteMovie.trim() || undefined,
        city: city.trim() || undefined,
        avatar: avatar ?? undefined,
        onboarded: true,
      });
      updateUser(res.data);
      toast.success('Welcome to Gathering! 🎉');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const initial = (name.trim() || user?.name || '?')[0]?.toUpperCase();

  return (
    <div className="min-h-screen overflow-y-auto">
      <div className="max-w-md mx-auto p-6 pb-12">
        {/* Header + progress */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Set up profile</h1>
            <p className="text-xs text-slate-400 mt-0.5">Step 2 of 2</p>
          </div>
          <div className="flex gap-1">
            <div className="w-7 h-1 rounded-full bg-surface-3" />
            <div className="w-7 h-1 rounded-full bg-gradient-to-r from-brand to-accent" />
          </div>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-1.5 mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl overflow-hidden">
              {avatar ? (
                <img src={avatar} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-accent to-brand flex items-center justify-center text-3xl font-bold text-white">{initial}</div>
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-gradient-to-br from-accent to-brand border-2 border-surface flex items-center justify-center text-white">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          <span className="text-xs text-brand font-medium">Add a photo</span>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">BASIC INFO</p>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Full name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Your name" autoFocus />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Username <span className="text-slate-500">(optional)</span></label>
            <div className="input flex items-center gap-1.5">
              <span className="text-slate-500">@</span>
              <input className="flex-1 bg-transparent outline-none text-white placeholder-slate-500"
                value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24))} placeholder="username" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Date of birth</label>
            <input type="date" className="input" value={dateOfBirth ?? ''} onChange={(e) => setDateOfBirth(e.target.value)} />
          </div>

          <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 pt-1">PERSONAL DETAILS</p>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Bio</label>
            <textarea className="input resize-none" rows={2} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Just hanging out ✨" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">Interests <span className="text-slate-500">({interests.length}/5)</span></label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((opt) => {
                const on = interests.includes(opt);
                return (
                  <button key={opt} type="button" onClick={() => toggleInterest(opt)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${on ? 'bg-gradient-to-br from-brand to-accent text-white' : 'bg-surface-2 border border-white/10 text-slate-400'}`}>
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

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center py-3.5 text-[15px] mt-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : "Let's go 🚀"}
          </button>
          <button onClick={() => logout()} className="w-full text-center text-xs text-slate-500 hover:text-slate-300">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
