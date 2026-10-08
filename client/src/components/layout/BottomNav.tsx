import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, Users, User, Compass, Newspaper } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useGroupStore } from '../../store/groupStore';
import { useDmStore } from '../../store/dmStore';
import clsx from 'clsx';

/**
 * Bottom tab bar (dark neon). Shown only on the hub screens — hidden inside
 * conversations/calls where a composer or controls own the bottom edge.
 */
export default function BottomNav() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const chatUnread = useGroupStore((s) => Object.values(s.unreadByGroup).reduce((a, b) => a + b, 0));
  const dmUnread = useDmStore((s) => Object.values(s.unreadByThread).reduce((a, b) => a + b, 0));
  const totalUnread = chatUnread + dmUnread;

  // Only the top-level hub screens get the tab bar.
  if (pathname !== '/dashboard' && pathname !== '/profile' && pathname !== '/discover' && pathname !== '/feed') return null;

  const isHome = pathname === '/dashboard';
  const isProfile = pathname === '/profile';
  const isDiscover = pathname === '/discover';
  const isFeed = pathname === '/feed';

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 glass-panel border-t border-line/10 flex items-center justify-around px-2"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)', paddingTop: '0.5rem' }}
    >
      <button
        onClick={() => navigate('/dashboard')}
        aria-label={totalUnread > 0 ? `Chats, ${totalUnread} unread` : 'Chats'}
        aria-current={isHome ? 'page' : undefined}
        className={clsx('relative flex flex-col items-center justify-center gap-1 w-12 min-h-[44px] py-1', isHome ? 'text-brand' : 'text-muted')}
      >
        <MessageSquare size={22} aria-hidden="true" />
        <span className={clsx('w-1 h-1 rounded-full', isHome ? 'bg-brand' : 'bg-transparent')} />
        {totalUnread > 0 && (
          <span className="absolute top-0 right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand text-white text-[9px] font-bold flex items-center justify-center">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      <button onClick={() => navigate('/feed')} aria-label="Digest" aria-current={isFeed ? 'page' : undefined}
        className={clsx('flex flex-col items-center justify-center gap-1 w-12 min-h-[44px] py-1', isFeed ? 'text-brand' : 'text-muted')}>
        <Newspaper size={22} aria-hidden="true" />
        <span className={clsx('w-1 h-1 rounded-full', isFeed ? 'bg-brand' : 'bg-transparent')} />
      </button>

      <button onClick={() => window.dispatchEvent(new CustomEvent('open-contacts'))} aria-label="People"
        className="flex flex-col items-center justify-center gap-1 w-12 min-h-[44px] py-1 text-muted">
        <Users size={22} aria-hidden="true" />
        <span className="w-1 h-1 rounded-full bg-transparent" />
      </button>

      <button onClick={() => navigate('/discover')} aria-label="Discover" aria-current={isDiscover ? 'page' : undefined}
        className={clsx('flex flex-col items-center justify-center gap-1 w-12 min-h-[44px] py-1', isDiscover ? 'text-brand' : 'text-muted')}>
        <Compass size={22} aria-hidden="true" />
        <span className={clsx('w-1 h-1 rounded-full', isDiscover ? 'bg-brand' : 'bg-transparent')} />
      </button>

      <button
        onClick={() => navigate('/profile')}
        aria-label="Profile"
        aria-current={isProfile ? 'page' : undefined}
        className={clsx('flex flex-col items-center justify-center gap-1 w-12 min-h-[44px] py-1', isProfile ? 'text-brand' : 'text-muted')}
      >
        {user?.avatar ? (
          <img src={user.avatar} className={clsx('w-6 h-6 rounded-lg object-cover', isProfile && 'ring-2 ring-brand')} alt="" />
        ) : (
          <User size={22} aria-hidden="true" />
        )}
        <span className={clsx('w-1 h-1 rounded-full', isProfile ? 'bg-brand' : 'bg-transparent')} />
      </button>
    </nav>
  );
}
