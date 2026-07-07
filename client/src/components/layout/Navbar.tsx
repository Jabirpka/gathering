import { useState, useEffect } from 'react';
import { Video, Bell } from 'lucide-react';
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
      className="border-b border-white/10 glass-panel flex items-center px-4 gap-3 shrink-0 z-20"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
    >
      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-accent flex items-center justify-center">
          <Video size={14} className="text-white" />
        </div>
        <span className="font-semibold text-white text-sm">Gathering</span>
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
    </header>
  );
}
