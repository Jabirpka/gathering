import { useState, useEffect } from 'react';
import { Video, Bell, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotificationStore } from '../../store/notificationStore';
import NotificationPanel from '../notifications/NotificationPanel';

export default function Navbar() {
  const { unreadCount } = useNotificationStore();
  const [showNotifs, setShowNotifs] = useState(false);

  // The bottom-bar bell (if any) can open this panel via a window event.
  useEffect(() => {
    const open = () => setShowNotifs(true);
    window.addEventListener('open-notifications', open);
    return () => window.removeEventListener('open-notifications', open);
  }, []);

  return (
    <header
      className="border-b border-white/10 glass-panel flex items-center px-4 gap-3 shrink-0 z-20 h-14"
    >
      <Link to="/dashboard" className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-accent flex items-center justify-center shrink-0">
          <Video size={15} className="text-white" />
        </div>
        <div className="leading-none">
          <div className="text-base font-extrabold tracking-wide text-white leading-none">GATHERING</div>
          <div className="text-[9px] font-semibold tracking-[0.22em] text-brand/70 mt-0.5">YOUR PEOPLE</div>
        </div>
      </Link>

      <div className="flex-1" />

      {/* Discover / communities */}
      <Link to="/discover" className="btn-ghost p-2" aria-label="Discover">
        <Compass size={18} />
      </Link>

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
    </header>
  );
}
