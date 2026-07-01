import { useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { usersApi } from '../services/api';
import { Camera, Loader2, LogOut, Save, Zap, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [nickname, setNickname] = useState(user?.nickname ?? '');
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
      const base64 = reader.result as string;
      setAvatar(base64);
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Name cannot be empty');
    setSaving(true);
    try {
      const res = await usersApi.updateMe({
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        avatar: avatar ?? undefined,
      });
      updateUser(res.data);
      toast.success('Profile saved!');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const displayName = user?.nickname || user?.name || '';

  return (
    <div className="p-6 max-w-lg mx-auto animate-fade-in">
      <h1 className="text-xl font-bold text-slate-900 mb-6">Profile</h1>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative group">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-black/10">
            {avatar ? (
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-brand-dim flex items-center justify-center text-3xl font-bold text-brand">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            {uploadingPhoto ? (
              <Loader2 size={20} className="animate-spin text-white" />
            ) : (
              <Camera size={20} className="text-white" />
            )}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        <p className="text-xs text-slate-500 mt-2">Click photo to change · Max 2MB</p>

        {/* Strike points badge */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-200"
        >
          <Zap size={13} className="text-amber-600" />
          <span className="text-xs font-semibold text-amber-600">
            {user?.strikePoints ?? 0} strike point{(user?.strikePoints ?? 0) !== 1 ? 's' : ''}
          </span>
        </motion.div>
      </div>

      {/* Form */}
      <div className="card p-5 space-y-4 mb-4">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">
            <UserIcon size={12} className="inline mr-1" />
            Display name
          </label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">
            Nickname <span className="text-slate-400">(optional)</span>
          </label>
          <input
            className="input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            placeholder="@nickname"
          />
          <p className="text-xs text-slate-400 mt-1">Shown instead of your name in chats & pokes</p>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Email</label>
          <input className="input opacity-60 cursor-not-allowed" value={user?.email ?? ''} disabled />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full justify-center"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save Changes
        </button>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full card p-4 flex items-center gap-3 hover:border-red-500/30 transition-colors group"
      >
        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
          <LogOut size={16} className="text-red-500" />
        </div>
        <span className="text-sm font-medium text-slate-700 group-hover:text-red-500 transition-colors">
          Sign out
        </span>
      </button>
    </div>
  );
}
