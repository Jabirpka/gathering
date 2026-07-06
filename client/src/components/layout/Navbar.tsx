import { useState, useEffect } from 'react';
import { Video, Bell, Menu } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotificationStore } from '../../store/notificationStore';
import { useGroupStore } from '../../store/groupStore';
import { useDmStore } from '../../store/dmStore';
import NotificationPanel from '../notifications/NotificationPanel';

interface Props {
  onMenuClick?: () => void;
}

export default function Navbar({ onMenuClick }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotificationStore();
  const groupUnread = useGroupStore((s) => Object.values(s.unreadByGroup).reduce((a, b) => a + b, 0));
  const dmUnread = useDmStore((s) => Object.values(s.unreadByThread).reduce((a, b) => a + b, 0));
  const totalChatUnread = groupUnread + dmUnread;
  const [showNotifs, setShowNotifs] = useState(false);

  // The mobile bottom-bar bell opens this panel via a window event.
  useEffect(() => {
    const open = () => setShowNotifs(true);
    window.addEventListener('open-notifications', open);
    return () => window.removeEventListener('open-notifications', open);
  }, []);

  return (
    <header
      className="h-14 border-b border-white/10 glass-panel flex items-center px-4 gap-3 shrink-0 z-20"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden btn-ghost p-2 -ml-1 relative"
        aria-label="Open menu"
      >
        <Menu size={18} />
        {totalChatUnread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-brand rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {totalChatUnread > 9 ? '9+' : totalChatUnread}
          </span>
        )}
      </button>

      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-accent flex items-center justify-center">
          <Video size={14} className="text-white" />
        </div>
        <span className="font-semibold text-white text-sm hidden sm:block">Gathering</span>
      </Link>

      <div className="flex-1" />

      {/* Notification bell */}
      <div className="relative">
        <button
          onClick={() => setShowNotifs((v) => !v)}
          className="btn-ghost p-2 relative"
          aria-label="Notifications"
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <NotificationPanel open={showNotifs} onClose={() => setShowNotifs(false)} />
      </div>

      {/* Avatar → profile page (desktop only; mobile uses the bottom-nav Profile) */}
      {user && (
        <button
          onClick={() => navigate('/profile')}
          className="hidden lg:flex items-center gap-2 hover:bg-white/10 px-2 py-1.5 rounded-xl transition-colors"
          title="Profile"
        >
          {user.avatar ? (
            <img src={user.avatar} className="w-7 h-7 rounded-full object-cover" alt={user.name} />
          ) : (
            <div className="w-7 h-7 rounded-full bg-brand-dim flex items-center justify-center text-xs font-semibold text-brand">
              {(user.nickname || user.name)[0]}
            </div>
          )}
          <span className="text-sm text-slate-200 hidden sm:block max-w-[120px] truncate">
            {user.nickname || user.name}
          </span>
        </button>
      )}
    </header>
  );
}
