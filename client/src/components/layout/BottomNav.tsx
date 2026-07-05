import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, Users, Plus, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useGroupStore } from '../../store/groupStore';
import { useDmStore } from '../../store/dmStore';
import clsx from 'clsx';

interface Props {
  onOpenGroups: () => void;
}

/**
 * Mobile bottom tab bar (dark neon). Shown only on the hub screens — hidden
 * inside conversations/calls where a composer or controls own the bottom edge.
 */
export default function BottomNav({ onOpenGroups }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const chatUnread = useGroupStore((s) => Object.values(s.unreadByGroup).reduce((a, b) => a + b, 0));
  const dmUnread = useDmStore((s) => Object.values(s.unreadByThread).reduce((a, b) => a + b, 0));
  const totalUnread = chatUnread + dmUnread;

  // Only the top-level hub screens get the tab bar.
  if (pathname !== '/dashboard' && pathname !== '/profile') return null;

  const isHome = pathname === '/dashboard';
  const isProfile = pathname === '/profile';

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass-panel border-t border-white/10 flex items-center justify-around px-2"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)', paddingTop: '0.5rem' }}
    >
      <button
        onClick={() => navigate('/dashboard')}
        className={clsx('relative flex flex-col items-center gap-1 w-14 py-1', isHome ? 'text-brand' : 'text-slate-400')}
      >
        <MessageSquare size={22} />
        <span className={clsx('w-1 h-1 rounded-full', isHome ? 'bg-brand' : 'bg-transparent')} />
        {totalUnread > 0 && (
          <span className="absolute top-0 right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand text-white text-[9px] font-bold flex items-center justify-center">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      <button onClick={onOpenGroups} className="flex flex-col items-center gap-1 w-14 py-1 text-slate-400">
        <Users size={22} />
        <span className="w-1 h-1 rounded-full bg-transparent" />
      </button>

      {/* Center FAB — opens the Join/Create sheet (v2) */}
      <button
        onClick={() => {
          if (pathname === '/dashboard') window.dispatchEvent(new CustomEvent('open-group-sheet'));
          else navigate('/dashboard');
        }}
        className="w-14 h-14 -mt-6 rounded-2xl flex items-center justify-center text-white shrink-0"
        style={{
          background: 'linear-gradient(135deg, #e879f9, #a855f7)',
          boxShadow: '0 8px 24px rgba(232,121,249,0.5)',
        }}
        title="Join or create a group"
      >
        <Plus size={26} />
      </button>

      <button
        onClick={() => {
          if (pathname === '/dashboard') window.dispatchEvent(new CustomEvent('open-add-status'));
          else navigate('/dashboard');
        }}
        className="flex flex-col items-center gap-1 w-14 py-1 text-slate-400"
        title="Status"
      >
        <div className="w-[22px] h-[22px] rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center">
          <User size={11} />
        </div>
        <span className="w-1 h-1 rounded-full bg-transparent" />
      </button>

      <button
        onClick={() => navigate('/profile')}
        className={clsx('flex flex-col items-center gap-1 w-14 py-1', isProfile ? 'text-brand' : 'text-slate-400')}
      >
        {user?.avatar ? (
          <img src={user.avatar} className={clsx('w-6 h-6 rounded-lg object-cover', isProfile && 'ring-2 ring-brand')} alt="" />
        ) : (
          <User size={22} />
        )}
        <span className={clsx('w-1 h-1 rounded-full', isProfile ? 'bg-brand' : 'bg-transparent')} />
      </button>
    </nav>
  );
}
