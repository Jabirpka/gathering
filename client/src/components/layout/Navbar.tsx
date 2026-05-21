import { Video, Bell, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 border-b border-white/5 bg-surface-1 flex items-center px-4 gap-4 shrink-0 z-20">
      <Link to="/dashboard" className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-accent flex items-center justify-center">
          <Video size={14} className="text-white" />
        </div>
        <span className="font-semibold text-white text-sm">Gathering</span>
      </Link>

      <div className="flex-1" />

      <button className="btn-ghost p-2">
        <Bell size={17} />
      </button>
      <button className="btn-ghost p-2">
        <Settings size={17} />
      </button>

      {user && (
        <button
          onClick={logout}
          className="flex items-center gap-2 hover:bg-white/5 px-2 py-1.5 rounded-xl transition-colors"
          title="Sign out"
        >
          {user.avatar ? (
            <img src={user.avatar} className="w-7 h-7 rounded-full object-cover" alt={user.name} />
          ) : (
            <div className="w-7 h-7 rounded-full bg-brand/30 flex items-center justify-center text-xs font-semibold text-brand-light">
              {user.name[0]}
            </div>
          )}
          <span className="text-sm text-slate-300 hidden sm:block">{user.name}</span>
        </button>
      )}
    </header>
  );
}
